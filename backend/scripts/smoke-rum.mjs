/* P2 — Core Web Vitals (RUM) smoke. Proves the real first-party path: a public
   beacon of finalized metrics persists with server-derived ratings, garbage is
   rejected, the ops aggregate computes p75 + rating split + trend + per-path,
   the read is walled to internal roles, and the per-IP limiter trips. */
const BASE = process.env.BASE || 'http://localhost:8080';
import { opsSession } from './lib-smoke-auth.mjs';
const OPS = await opsSession(BASE);

const post = async (body) => {
  const res = await fetch(BASE + '/api/rum', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const report = async (token, days = 7) => {
  const res = await fetch(BASE + `/api/rum?days=${days}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

const path = `/smoke-rum-${Date.now()}`;

// A full page's worth of finalized vitals persists; the server stores each row
// and derives the rating itself (the client never gets to label its own colors).
let r = await post({ metrics: [
  { name: 'lcp', value: 1200 }, { name: 'inp', value: 90 }, { name: 'cls', value: 0.03 },
  { name: 'fcp', value: 900 }, { name: 'ttfb', value: 300 },
], path, device: 'desktop', conn: '4g' });
assert(r.status === 201 && r.data.ok && r.data.stored === 5, 'good vitals beacon persisted all 5 metrics');

// A second, slower page so LCP p75 has spread and a worst-path row exists.
for (const v of [2600, 3200, 4200]) {
  r = await post({ metrics: [{ name: 'lcp', value: v }], path, device: 'mobile' });
  assert(r.status === 201 && r.data.stored === 1, `lcp=${v} beacon persisted`);
}

// Garbage is rejected, never 500'd: unknown metric names drop out → empty → 400;
// a bad value is dropped; the strict validator rejects unknown top-level fields.
r = await post({ metrics: [{ name: 'bogus', value: 1 }, { name: 'lcp', value: -5 }] });
assert(r.status === 400, 'beacon with no valid metrics rejected (400, not 500)');
r = await post({ metrics: [{ name: 'lcp', value: 1500 }], surprise: 'x' });
assert(r.status === 400, 'unknown top-level field rejected (strict validate)');
r = await post({ metrics: [] });
assert(r.status === 400, 'empty metrics array rejected');

// The aggregate is walled, then computes the dashboard's numbers.
r = await report(null);
assert(r.status === 401 || r.status === 403, 'GET /api/rum requires internal auth');

r = await report(OPS);
assert(r.status === 200 && Array.isArray(r.data.metrics), 'ops reads the CWV aggregate');
const byName = Object.fromEntries(r.data.metrics.map((m) => [m.metric, m]));
assert(['lcp', 'inp', 'cls', 'fcp', 'ttfb'].every((k) => k in byName), 'every CWV metric present in the report');
const lcp = byName.lcp;
assert(Number.isFinite(lcp.p75) && lcp.samples >= 4, `lcp p75 computed over ${lcp.samples} samples (p75=${lcp.p75})`);
assert(['good', 'needs-improvement', 'poor'].includes(lcp.rating), 'lcp p75 carries a server-derived rating');
assert(lcp.split && Number.isFinite(lcp.split.good + lcp.split.poor), 'rating split present (good/needs-improvement/poor)');
assert(['worse', 'better', 'flat'].includes(byName.lcp.trend), 'trend vs previous window present (regression-visible)');
assert(Array.isArray(r.data.regressions), 'regressions list present');
assert(r.data.byPath.some((p) => p.path === path && Number.isFinite(p.lcpP75)), 'our path appears in the worst-pages LCP breakdown');

// The per-IP limiter trips under a flood (default 240/min) — bounded loop.
let tripped = false;
for (let i = 0; i < 300 && !tripped; i++) {
  const res = await post({ metrics: [{ name: 'cls', value: 0.01 }], path });
  if (res.status === 429) tripped = true;
}
assert(tripped, 'rum rate limiter trips under a flood');

console.log('\nP2 web-vitals RUM smoke passed.');
