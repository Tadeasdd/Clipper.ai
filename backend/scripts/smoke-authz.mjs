/* S4 smoke: cross-tenant isolation (IDOR). Two clients; client B must not be
 *  able to reach ANY of client A's id-addressed resources — clip asset, clip
 *  metrics, review history, report, account, or a decision — by guessing the
 *  id. The wall is a 404, never a 403 that would confirm the id exists. Ops,
 *  by role, reads across tenants; client A reads its own. Needs Postgres + the
 *  API; all requests use bearer tokens (CSRF-exempt API clients). */
import pg from 'pg';

const BASE = process.env.BASE || 'http://localhost:8080';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });

const j = async (method, p, body, token) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const run = Math.random().toString(36).slice(2, 8);

// ── ops session (bootstrap-or-login the fixed smoke account) ────────────────
const OPS = { email: 'ops@smoke.clipper.ai', password: 'smoke-ops-password' };
await j('POST', '/api/auth/bootstrap', OPS);
const ops = (await j('POST', '/api/auth/login', OPS)).data.token;
assert(ops, 'ops signed in');

// ── two clients + a client user for each ────────────────────────────────────
const cliA = (await j('POST', '/api/clients', { name: `S4 Tenant A ${run}` }, ops)).data.id;
const cliB = (await j('POST', '/api/clients', { name: `S4 Tenant B ${run}` }, ops)).data.id;
const mkClient = async (tag, clientId) => {
  const email = `${tag}+${run}@clipper.ai`;
  await j('POST', '/api/users', { email, role: 'client', clientId, password: 'first-password' }, ops);
  return (await j('POST', '/api/auth/login', { email, password: 'first-password' })).data.token;
};
const aTok = await mkClient('s4a', cliA);
const bTok = await mkClient('s4b', cliB);
assert(aTok && bTok, 'both client users signed in');

// ── seed one of client A's clips + an audit row (asset_key null → 409 once
//    authorized, so we can tell "authz passed" from "blocked"). ──────────────
const recA = `rec_s4_${run}`;
const clipA = `clip_s4_${run}`;
await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [recA, cliA]);
await db.query(
  `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, hook, status)
   VALUES ($1,$2,30,62,90,'{"energyZ":1.5}','S4 tenant hook ${run}','awaiting_client')`, [clipA, recA]);
const aUserId = (await db.query('SELECT id FROM users WHERE email = $1', [`s4a+${run}@clipper.ai`])).rows[0].id;
await db.query(`INSERT INTO review_events (id, clip_id, reviewer_id, decision, notes) VALUES ($1,$2,$3,'approve','seed')`,
  [`rev_s4_${run}`, clipA, aUserId]);

// ── client B: every cross-tenant id is a 404 (no existence leak) ────────────
for (const [label, m, p, body] of [
  ['clip asset', 'GET', `/api/clips/${clipA}/asset`],
  ['clip metrics', 'GET', `/api/clips/${clipA}/metrics`],
  ['review history', 'GET', `/api/review/${clipA}/history`],
  ['client report', 'GET', `/api/analytics/clients/${cliA}`],
  ['client account', 'GET', `/api/clients/${cliA}`],
  ['decision (write)', 'POST', `/api/review/${clipA}/decision`, { decision: 'approve' }],
]) {
  const r = await j(m, p, body, bTok);
  assert(r.status === 404, `client B → A's ${label} is 404 (not 403 — no existence leak)`);
}
const bList = await j('GET', '/api/clips', null, bTok);
assert(bList.status === 200 && !bList.data.clips.some((c) => c.id === clipA), "client B's clip list never includes A's clip");

// ── client A: its OWN resources are reachable (the fence blocks only cross-tenant)
let r = await j('GET', `/api/clips/${clipA}/asset`, null, aTok);
assert(r.status === 409, "client A reaches its own clip asset (409 not-rendered — past the authz wall, not a 404)");
r = await j('GET', `/api/clips/${clipA}/metrics`, null, aTok);
assert(r.status === 200, "client A reads its own clip metrics");
r = await j('GET', `/api/review/${clipA}/history`, null, aTok);
assert(r.status === 200 && r.data.events.length >= 1, "client A reads its own clip's audit trail");
r = await j('GET', `/api/clients/${cliA}`, null, aTok);
assert(r.status === 200, 'client A reads its own account');

// ── ops: cross-tenant by role (runs the service) ───────────────────────────
r = await j('GET', `/api/clips/${clipA}/metrics`, null, ops);
assert(r.status === 200, 'ops reads any clip across tenants (by role)');
r = await j('GET', `/api/analytics/clients/${cliA}`, null, ops);
assert(r.status === 200, 'ops reads any client report across tenants (by role)');

await db.end();
console.log('\nS4 smoke passed: id-addressed resources are tenant-scoped — cross-tenant reads/writes 404, the asset is authorized before streaming, ops crosses by role.');
process.exit(0);
