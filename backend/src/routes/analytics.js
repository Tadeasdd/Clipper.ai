/** Stage B6 — Performance measurement + feedback loop into scoring.
 *  F4.6 brought forward the two metrics computable from data that already
 *  exists (review_events, pipeline_jobs). The differentiator — correlating
 *  clips.score with realized performance and retraining the weights — needs
 *  published clips and clip_metrics, so it stays null until B6 proper. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { computeCorrelation, retrain, loadWeights, computeEditorAgreement } from '../metrics/loop.js';
import { snapshotCalibration, calibrationHistory, windowedCalibration } from '../metrics/monitor.js';
import { recentTraces, traceFor } from '../lib/telemetry.js';
import { evaluateSlos } from '../ops/slo.js';
import { turnaroundByClient } from '../ops/sla.js';
import { workloadForecast } from '../ops/capacity.js';
import { recordingCost, costRollup } from '../ops/cost-ledger.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { validate } from '../lib/validate.js';
import { log } from '../lib/log.js';
import { STAGES } from '../pipeline/index.js';

const r = Router();
const round2 = (v) => Number(Number(v || 0).toFixed(2));
const round3 = (v) => Number(Number(v || 0).toFixed(3));
const round4 = (v) => Number(Number(v || 0).toFixed(4));

// GET /api/analytics/queues — ops queue health (M5). Per-stage pipeline depth,
// publish queue depth, and how many published posts are due a metrics capture —
// the signal the F4 processing board needs to see backlog and dead-letter work.
r.get('/queues', requireAuth(...INTERNAL), async (_req, res, next) => {
  try {
    const pipeline = await q(`
      SELECT stage,
             count(*) FILTER (WHERE status = 'pending')::int  AS pending,
             count(*) FILTER (WHERE status = 'running')::int  AS running,
             count(*) FILTER (WHERE status = 'done')::int     AS done,
             count(*) FILTER (WHERE status = 'failed')::int   AS failed,
             count(*) FILTER (WHERE dead_letter)::int         AS dead_letter,
             min(run_after) FILTER (WHERE status = 'pending') AS oldest_pending
      FROM pipeline_jobs GROUP BY stage
      ORDER BY array_position($1, stage)`, [STAGES]);
    const publish = await q(`
      SELECT count(*) FILTER (WHERE status = 'scheduled')::int  AS scheduled,
             count(*) FILTER (WHERE status = 'publishing')::int AS publishing,
             count(*) FILTER (WHERE status = 'published')::int  AS published,
             count(*) FILTER (WHERE status = 'failed')::int     AS failed,
             count(*) FILTER (WHERE dead_letter)::int           AS dead_letter,
             min(run_after) FILTER (WHERE status = 'scheduled') AS oldest_scheduled
      FROM publish_jobs`);
    const metrics = await q(`
      SELECT count(*) FILTER (WHERE status = 'published' AND metrics_next_at IS NOT NULL
                                AND metrics_next_at <= now())::int AS due,
             count(*) FILTER (WHERE status = 'published')::int     AS tracked
      FROM publish_jobs`);
    res.json({ pipeline: pipeline.rows, publish: publish.rows[0], metrics: metrics.rows[0] });
  } catch (e) { next(e); }
});

// GET /api/analytics/clients/:id — the client-facing report (F5 renders
// this; B6.2 made it real). Per published clip: the LATEST capture per
// platform post, plus exact totals over the period. Weekly report = this
// payload + a date filter; it generates itself.
r.get('/clients/:id', requireAuth(), async (req, res, next) => {
  // internal roles read any client's report; client users exactly their own (F5).
  // S4: another client's id is a 404, not a 403 — don't confirm it exists.
  if (req.user.role === 'client' && req.user.client_id !== req.params.id) {
    return res.status(404).json({ error: 'unknown client' });
  }
  try {
    const client = await q('SELECT id, name FROM clients WHERE id = $1', [req.params.id]);
    if (!client.rowCount) return res.status(404).json({ error: 'unknown client' });
    const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
    // latest capture per publish, for this client's posts in the window
    const { rows } = await q(`
      SELECT DISTINCT ON (pj.id)
             pj.id AS publish_id, pj.platform, pj.external_url, pj.published_at,
             cl.id AS clip_id, cl.hook, cl.score,
             m.captured_at, m.views, m.watch_time_s, m.retention, m.likes,
             m.comments, m.shares, m.follows
      FROM publish_jobs pj
      JOIN clips cl ON cl.id = pj.clip_id
      JOIN recordings rec ON rec.id = cl.recording_id
      LEFT JOIN clip_metrics m ON m.publish_id = pj.id
      WHERE rec.client_id = $1 AND pj.status = 'published'
        AND pj.published_at >= now() - ($2 || ' days')::interval
      ORDER BY pj.id, m.captured_at DESC NULLS LAST`,
      [req.params.id, String(days)]);

    const posts = rows.map((p) => ({
      clipId: p.clip_id, publishId: p.publish_id, platform: p.platform,
      externalUrl: p.external_url, publishedAt: p.published_at,
      hook: p.hook, score: p.score === null ? null : Number(p.score),
      capturedAt: p.captured_at,
      views: p.views === null ? null : Number(p.views),
      watchTimeS: p.watch_time_s === null ? null : Number(p.watch_time_s),
      retention: p.retention === null ? null : Number(p.retention),
      likes: p.likes === null ? null : Number(p.likes),
      comments: p.comments === null ? null : Number(p.comments),
      shares: p.shares === null ? null : Number(p.shares),
      follows: p.follows === null ? null : Number(p.follows),
    })).sort((a, b) => (b.views ?? -1) - (a.views ?? -1));

    const sum = (k) => posts.reduce((a, p) => a + (p[k] ?? 0), 0);
    const measured = posts.filter((p) => p.retention !== null && p.views !== null);
    const weighted = measured.reduce((a, p) => a + p.retention * p.views, 0);
    const weights = measured.reduce((a, p) => a + p.views, 0);
    res.json({
      clientId: req.params.id, clientName: client.rows[0].name,
      periodDays: days, posts,
      totals: {
        postsPublished: posts.length,
        clipsPublished: new Set(posts.map((p) => p.clipId)).size,
        views: sum('views'), watchTimeS: sum('watchTimeS'),
        likes: sum('likes'), comments: sum('comments'),
        shares: sum('shares'), follows: sum('follows'),
        // views-weighted: a 10-view post shouldn't drag a 100k-view post's number
        avgRetention: weights ? Number((weighted / weights).toFixed(3)) : null,
      },
    });
  } catch (e) { next(e); }
});

// GET /api/analytics/ops — internal: QA pass rate, pipeline turnaround, and
// (B6) scoring-model precision vs. published performance.
r.get('/ops', requireAuth(...INTERNAL), async (_req, res, next) => {
  try {
    // First-pass internal QA: of every verdict by a non-client reviewer,
    // what share approved? (send_to_client / resubmit are routing, not verdicts.)
    const qa = await q(`
      SELECT count(*) FILTER (WHERE e.decision = 'approve')::float AS approvals,
             count(*)::int AS verdicts
      FROM review_events e JOIN users u ON u.id = e.reviewer_id
      WHERE u.role <> 'client' AND e.decision IN ('approve','reject','changes')`);
    const { approvals, verdicts } = qa.rows[0];

    // Pipeline turnaround: ingest start → generate finish, recordings where
    // all five stages completed. Median, in hours.
    const turn = await q(`
      SELECT percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (last_done - first_start)) / 3600.0
             ) AS median_h
      FROM (
        SELECT recording_id, min(started_at) AS first_start, max(finished_at) AS last_done
        FROM pipeline_jobs GROUP BY recording_id
        HAVING count(*) FILTER (WHERE status = 'done') = 5
      ) done_recordings`);

    // Distribution totals: latest capture per published post (B6.2).
    const dist = await q(`
      SELECT count(*)::int AS posts, COALESCE(sum(latest.views), 0)::bigint AS views
      FROM (
        SELECT DISTINCT ON (m.publish_id) m.views
        FROM clip_metrics m
        JOIN publish_jobs pj ON pj.id = m.publish_id AND pj.status = 'published'
        ORDER BY m.publish_id, m.captured_at DESC
      ) latest`);

    res.json({
      approvalRate: verdicts ? Number((approvals / verdicts).toFixed(3)) : null,
      verdicts,
      medianTurnaroundHours: turn.rows[0].median_h === null ? null : Number(Number(turn.rows[0].median_h).toFixed(3)),
      postsMeasured: dist.rows[0].posts,
      totalViews: Number(dist.rows[0].views),
      // B6.3: the loop, live. Under the local metrics driver this hovers
      // near zero by design (the simulator never peeks at the score).
      scoreCorrelation: await computeCorrelation(),
      // Q3: model↔editor agreement — does the score predict what editors keep?
      editorAgreement: await computeEditorAgreement(),
      scoringWeights: await loadWeights(),
    });
  } catch (e) { next(e); }
});

// GET /api/analytics/cost — E1 cost rollup per client (the E3 margin input).
r.get('/cost', requireAuth(...INTERNAL), async (_req, res, next) => {
  try { res.json({ clients: await costRollup() }); } catch (e) { next(e); }
});

// GET /api/analytics/cost/:recordingId — itemized + summed cost for one recording.
r.get('/cost/:recordingId', requireAuth(...INTERNAL), async (req, res, next) => {
  try { res.json(await recordingCost(req.params.recordingId)); } catch (e) { next(e); }
});

// GET /api/analytics/margin — E3 per-client profitability: plan revenue minus
// AI cost (E1) minus estimated human-editor cost, with a month-over-month trend,
// sorted by margin (most profitable first). Editor cost is an estimate from
// review activity × a configurable rate — labeled, never presented as measured.
r.get('/margin', requireAuth(...INTERNAL), async (_req, res, next) => {
  try {
    const hourly = Number(process.env.EDITOR_HOURLY_USD || 35);
    const minPer = Number(process.env.EDITOR_MIN_PER_REVIEW || 4);
    const editorCost = (reviews) => round2(reviews * minPer * hourly / 60);
    const { rows } = await q(`
      WITH month_cost AS (
        SELECT client_id, sum(cost_usd) c FROM cost_entries WHERE created_at >= date_trunc('month', now()) GROUP BY client_id),
      last_cost AS (
        SELECT client_id, sum(cost_usd) c FROM cost_entries
        WHERE created_at >= date_trunc('month', now()) - interval '1 month' AND created_at < date_trunc('month', now()) GROUP BY client_id),
      reviews AS (
        SELECT r.client_id,
          count(*) FILTER (WHERE e.created_at >= date_trunc('month', now())) AS this,
          count(*) FILTER (WHERE e.created_at >= date_trunc('month', now()) - interval '1 month' AND e.created_at < date_trunc('month', now())) AS last
        FROM review_events e JOIN clips cl ON cl.id = e.clip_id JOIN recordings r ON r.id = cl.recording_id GROUP BY r.client_id)
      SELECT c.id, c.name, c.plan,
        COALESCE(p.monthly_price_usd, 0) AS revenue,
        COALESCE(mc.c, 0) AS ai_cost, COALESCE(lc.c, 0) AS ai_cost_last,
        COALESCE(rv.this, 0) AS reviews, COALESCE(rv.last, 0) AS reviews_last
      FROM clients c
      LEFT JOIN plans p ON p.name = c.plan
      LEFT JOIN month_cost mc ON mc.client_id = c.id
      LEFT JOIN last_cost lc ON lc.client_id = c.id
      LEFT JOIN reviews rv ON rv.client_id = c.id`);
    const clients = rows.map((r) => {
      const revenue = Number(r.revenue);
      const aiCost = round4(Number(r.ai_cost));
      const edCost = editorCost(Number(r.reviews));
      const margin = round2(revenue - aiCost - edCost);
      const lastMargin = revenue - Number(r.ai_cost_last) - editorCost(Number(r.reviews_last));
      return {
        clientId: r.id, client: r.name, plan: r.plan, revenue: round2(revenue),
        aiCost, editorCost: edCost, editorCostEstimated: true,
        margin, marginPct: revenue > 0 ? round3(margin / revenue) : null,
        trend: margin > lastMargin + 0.01 ? 'up' : margin < lastMargin - 0.01 ? 'down' : 'flat',
      };
    }).sort((a, b) => b.margin - a.margin);
    res.json({ clients, rate: { editorHourlyUsd: hourly, editorMinPerReview: minPer } });
  } catch (e) { next(e); }
});

// GET /api/analytics/turnaround — O1 SLA tracking: per-client submit→deliver
// turnaround vs the plan SLA target, with late + overdue breaches flagged for
// the ops board. Carries R4's org-level SLO turnaround objective alongside, so
// the per-client SLA and the organisation SLO read off one surface (read-only,
// alert:false — the R4 monitor is what pages, not a dashboard read).
r.get('/turnaround', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
    const report = await turnaroundByClient(days);
    const slo = await evaluateSlos({ alert: false });
    report.slo = (slo.objectives || []).find((o) => o.objective === 'turnaround_p95_seconds') || null;
    res.json(report);
  } catch (e) { next(e); }
});

// GET /api/analytics/capacity — O2 capacity & workload: per-reviewer open load
// and throughput, the review backlog depth, and the forecast clear-time at the
// measured rate (the board's "how long until we're caught up" number).
r.get('/capacity', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days || 7)));
    res.json(await workloadForecast(days));
  } catch (e) { next(e); }
});

// GET /api/analytics/slo — R4 reliability report: each SLI vs its target + the
// error-budget burn. Read-only (alert:false) — the periodic monitor is what
// pages on a burning budget, not a dashboard read.
r.get('/slo', requireAuth(...INTERNAL), async (_req, res, next) => {
  try { res.json(await evaluateSlos({ alert: false })); } catch (e) { next(e); }
});

// GET /api/analytics/traces — R1 trace inspector: recent pipeline/publish
// lifecycle traces (one per recording), for the ops board + debugging.
r.get('/traces', requireAuth(...INTERNAL), (_req, res) => res.json({ traces: recentTraces(50) }));

// GET /api/analytics/trace/:recordingId — the full span list for one recording's
// lifecycle (ingest → … → generate → publish), correlated by trace id.
r.get('/trace/:recordingId', requireAuth(...INTERNAL), (req, res) => {
  const trace = traceFor(req.params.recordingId);
  if (!trace) return res.status(404).json({ error: 'no trace for this recording (it may have aged out of the in-memory window)' });
  res.json(trace);
});

// GET /api/analytics/calibration — Q5 quality-drift dashboard: the current
// predicted-vs-realized calibration + the snapshot history (and which snapshots
// flagged drift). The data a calibration dashboard renders.
r.get('/calibration', requireAuth(...INTERNAL), async (_req, res, next) => {
  try {
    const history = await calibrationHistory(50);
    res.json({
      current: await windowedCalibration(),
      latest: history[0] || null,
      activeDrift: history.find((s) => s.drift) || null,
      history,
    });
  } catch (e) { next(e); }
});

// POST /api/analytics/calibration/snapshot — take a snapshot now (the periodic
// monitor does this on a clock; ops can force one). Alerts + records on drift.
r.post('/calibration/snapshot', requireAuth('ops'), async (_req, res, next) => {
  try { res.status(201).json(await snapshotCalibration()); }
  catch (e) { next(e); }
});

// POST /api/analytics/retrain — one cycle of the loop: correlate, step the
// weights toward the evidence, append the new row. 409 below the sample
// gate. An ops action for now; B7 puts it behind auth.
r.post('/retrain', requireAuth('ops'), validate({ note: { type: 'string', maxLength: 500 } }), async (req, res, next) => {
  try {
    const row = await retrain(undefined, req.body?.note || null);
    if (!row) {
      const corr = await computeCorrelation();
      return res.status(409).json({ error: `retraining needs ≥ ${corr.needed} published clips with captures (have ${corr.sample})` });
    }
    log.security('metrics.retrain', { by: req.user.email, ip: req.ip, requestId: req.id });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

export default r;
