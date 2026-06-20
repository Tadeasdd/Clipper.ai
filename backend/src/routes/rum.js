/** P2 — Core Web Vitals (RUM). The first-party sink behind lib/perf.jsx's
 *  initWebVitals(): the browser beacons finalized LCP/INP/CLS/FCP/TTFB at
 *  page-hide, this stores them, and the ops dashboard reads the aggregate.
 *
 *  Same posture as U4 feedback: ONE public door (the marketing/studio surface
 *  has no session), so it is rate-limited + shape-validated; the aggregate read
 *  is walled to internal roles. Privacy-respecting by construction — the client
 *  sends no identity, only metric values + URL path + coarse device/connection;
 *  meta {ip, ua} is kept for abuse triage, never returned to clients. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { rateLimit } from '../lib/ratelimit.js';
import { validate } from '../lib/validate.js';

const r = Router();

const METRICS = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'];
// web.dev "good"/"poor" thresholds — the server re-derives rating from value so
// a client can't mislabel its own numbers (the dashboard's colors are ours).
const THRESHOLDS = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25], fcp: [1800, 3000], ttfb: [800, 1800] };
const rate = (metric, v) => {
  const [good, poor] = THRESHOLDS[metric];
  return v <= good ? 'good' : v <= poor ? 'needs-improvement' : 'poor';
};

// POST /api/rum { metrics: [{ name, value }], path?, device?, conn? }
// One beacon per page carries every finalized metric. The top-level shape is
// validated by the library; each metric item is checked here (the validator is
// flat and doesn't recurse). Unknown/garbage items are dropped, not fatal — a
// best-effort beacon should never 500, but an empty/garbage body is a 400.
r.post('/',
  rateLimit({ name: 'rum', max: 240 }),
  validate({
    metrics: { type: 'array', required: true },
    path: { type: 'string', maxLength: 512 },
    device: { type: 'string', enum: ['mobile', 'desktop'] },
    conn: { type: 'string', maxLength: 20 },
  }),
  async (req, res, next) => {
    try {
      const { metrics, path, device, conn } = req.body || {};
      // pathname only — defensively strip any query/hash a client might send.
      const cleanPath = typeof path === 'string' ? path.split(/[?#]/)[0].slice(0, 512) : null;
      const meta = { ip: req.ip, ua: req.headers['user-agent'] || null };
      const rows = [];
      for (const m of Array.isArray(metrics) ? metrics.slice(0, 10) : []) {
        const name = String(m?.name || '').toLowerCase();
        const value = Number(m?.value);
        if (!METRICS.includes(name) || !Number.isFinite(value) || value < 0) continue;
        rows.push([id('wv'), name, value, rate(name, value), cleanPath, device || null, conn || null, meta]);
      }
      if (!rows.length) return res.status(400).json({ error: 'no valid web-vitals metrics in beacon' });
      for (const row of rows) {
        await q(`INSERT INTO web_vitals (id, metric, value, rating, path, device, conn, meta)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, row);
      }
      res.status(201).json({ ok: true, stored: rows.length });
    } catch (e) { next(e); }
  });

// GET /api/rum?days=7 — ops aggregate: per-metric p75 + rating split + trend vs
// the previous equal window (so a regression is visible), and the worst paths.
// Walled to internal roles; meta (ip/ua) is never exposed. Lower is better for
// every CWV metric, so a higher p75 this window than last is the regression.
r.get('/', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days || 7)));
    const window = `${days} days`;

    const cur = await q(`
      SELECT metric,
             count(*)::int AS samples,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75,
             count(*) FILTER (WHERE rating = 'good')::int              AS good,
             count(*) FILTER (WHERE rating = 'needs-improvement')::int AS needs_improvement,
             count(*) FILTER (WHERE rating = 'poor')::int             AS poor
      FROM web_vitals
      WHERE created_at >= now() - ($1)::interval
      GROUP BY metric`, [window]);

    const prev = await q(`
      SELECT metric, percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75
      FROM web_vitals
      WHERE created_at >= now() - ($1)::interval * 2 AND created_at < now() - ($1)::interval
      GROUP BY metric`, [window]);
    const prevP75 = Object.fromEntries(prev.rows.map((x) => [x.metric, x.p75 == null ? null : Number(x.p75)]));

    const round = (m, v) => (v == null ? null : Number(Number(v).toFixed(m === 'cls' ? 3 : 0)));
    const metrics = METRICS.map((name) => {
      const row = cur.rows.find((x) => x.metric === name);
      const p75 = row ? round(name, row.p75) : null;
      const prior = prevP75[name] ?? null;
      let trend = 'flat';
      if (p75 != null && prior != null && prior > 0) {
        if (p75 > prior * 1.05) trend = 'worse';        // regression
        else if (p75 < prior * 0.95) trend = 'better';
      }
      return {
        metric: name,
        p75,
        rating: p75 == null ? null : rate(name, p75),
        samples: row ? row.samples : 0,
        split: row ? { good: row.good, needsImprovement: row.needs_improvement, poor: row.poor } : null,
        previousP75: prior == null ? null : round(name, prior),
        trend,
      };
    });

    // Worst paths by LCP p75 (the field metric a page most directly owns).
    const byPath = await q(`
      SELECT path,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS lcp_p75,
             count(*)::int AS samples
      FROM web_vitals
      WHERE metric = 'lcp' AND path IS NOT NULL AND created_at >= now() - ($1)::interval
      GROUP BY path
      HAVING count(*) >= 1
      ORDER BY lcp_p75 DESC NULLS LAST
      LIMIT 20`, [window]);

    res.json({
      periodDays: days,
      metrics,
      regressions: metrics.filter((m) => m.trend === 'worse').map((m) => m.metric),
      byPath: byPath.rows.map((x) => ({ path: x.path, lcpP75: round('lcp', x.lcp_p75), samples: x.samples, rating: rate('lcp', Number(x.lcp_p75)) })),
    });
  } catch (e) { next(e); }
});

export default r;
