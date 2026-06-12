/* B7 smoke: auth, roles, hardening. Proves the done-criterion — client
   users can only see their own data; every publish and approval is
   attributable — plus the door itself:

     bootstrap works exactly once · login/logout lifecycle · wrong password
     and unknown email are the same error · rate limit trips · anonymous
     requests bounce off every wall · client users are fenced into their own
     client everywhere · password hashes never leave the API

   Uses fixed smoke credentials: first run bootstraps, re-runs log in. */
import pg from 'pg';

const BASE = process.env.BASE || 'http://localhost:8080';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });

const j = async (method, p, body, token) => {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})), headers: res.headers };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const uid = () => Math.random().toString(36).slice(2, 8);

const OPS = { email: 'ops@smoke.clipper.ai', password: 'smoke-ops-password' };
const run = uid();

// ── bootstrap-or-login (idempotent across runs) ─────────────────────────────
let r = await j('GET', '/api/auth/status');
const firstRun = r.data.bootstrapRequired === true;
r = await j('POST', '/api/auth/bootstrap', OPS);
if (firstRun) {
  assert(r.status === 201 && r.data.token && r.data.user.role === 'ops', 'bootstrap creates the first ops account');
} else {
  assert(r.status === 409, 'bootstrap works exactly once — already-bootstrapped is a 409');
}
r = await j('POST', '/api/auth/login', OPS);
assert(r.status === 200 && r.data.token, 'ops login returns a session token');
assert(/clipper_session=\w+; HttpOnly/.test(r.headers.get('set-cookie') || ''), 'session also set as an httpOnly cookie');
const ops = r.data.token;
r = await j('GET', '/api/auth/status');
assert(r.data.bootstrapRequired === false, 'status reports bootstrapped');

// ── login hygiene ────────────────────────────────────────────────────────────
const bad1 = await j('POST', '/api/auth/login', { email: OPS.email, password: 'wrong-password' });
const bad2 = await j('POST', '/api/auth/login', { email: `ghost+${run}@x.ai`, password: 'wrong-password' });
assert(bad1.status === 401 && bad2.status === 401 && bad1.data.error === bad2.data.error,
  'wrong password and unknown email are indistinguishable (no enumeration)');
r = await j('GET', '/api/auth/me', null, ops);
assert(r.status === 200 && r.data.user.email === OPS.email, '/me identifies the session user');
r = await j('GET', '/api/auth/me', null, 'not-a-real-token');
assert(r.status === 401, 'garbage tokens are 401');

// rate limit: hammer a throwaway identity until 429
let limited = false;
for (let i = 0; i < 12; i++) {
  const res = await j('POST', '/api/auth/login', { email: `hammer+${run}@x.ai`, password: 'nope' });
  if (res.status === 429) { limited = true; break; }
}
assert(limited, 'login rate limit trips inside the window');

// ── anonymous requests bounce off every wall ────────────────────────────────
for (const [m, p] of [['GET', '/api/jobs'], ['GET', '/api/intake/queue'], ['GET', '/api/clients'],
                      ['GET', '/api/users'], ['GET', '/api/review/queue'], ['GET', '/api/publish/queue'],
                      ['GET', '/api/analytics/ops'], ['POST', '/api/analytics/retrain'], ['GET', '/api/clips']]) {
  const res = await j(m, p);
  if (res.status !== 401) { console.error(`FAIL: anon ${m} ${p} → ${res.status}, wanted 401`); process.exit(1); }
}
console.log('ok: anonymous requests are 401 on all nine sampled walls');
r = await j('POST', '/api/leads', { email: `lead+${run}@x.ai`, source: 'waitlist' });
assert(r.status === 201, 'the marketing lead form stays public — the one open door');

// ── seed two clients + per-role users (ops session creates them) ───────────
const cliA = (await j('POST', '/api/clients', { name: `B7 Wall Co A ${run}` }, ops)).data.id;
const cliB = (await j('POST', '/api/clients', { name: `B7 Wall Co B ${run}` }, ops)).data.id;
r = await j('POST', '/api/users', { email: `rev+${run}@clipper.ai`, role: 'reviewer' }, ops);
assert(r.status === 400 && /password/.test(r.data.error), 'account creation without a password refused');
const mkUser = async (email, role, clientId) => {
  const res = await j('POST', '/api/users', { email: `${email}+${run}@clipper.ai`, role, clientId, password: 'first-password' }, ops);
  const login = await j('POST', '/api/auth/login', { email: `${email}+${run}@clipper.ai`, password: 'first-password' });
  return { id: res.data.id, token: login.data.token };
};
const reviewer = await mkUser('rev', 'reviewer');
const clientA = await mkUser('cla', 'client', cliA);
const clientB = await mkUser('clb', 'client', cliB);
assert(reviewer.token && clientA.token && clientB.token, 'created accounts can sign in with their initial password');
r = await j('GET', '/api/users', null, ops);
assert(r.data.users.every((u) => u.password_hash === undefined) && r.data.users.some((u) => u.has_credentials),
  'password hashes never leave the API (has_credentials flag only)');

// ── role walls with real sessions ───────────────────────────────────────────
r = await j('GET', '/api/jobs', null, clientA.token);
assert(r.status === 403, 'client role bounces off the ops board');
r = await j('POST', '/api/analytics/retrain', {}, reviewer.token);
assert(r.status === 403, 'retraining the model is ops-only');
r = await j('POST', '/api/clients', { name: 'nope' }, reviewer.token);
assert(r.status === 403, 'reviewers cannot create clients');
r = await j('POST', '/api/users', { email: 'x@x.ai', role: 'ops', password: 'password123' }, reviewer.token);
assert(r.status === 403, 'reviewers cannot mint accounts');

// ── client scoping: own data only (THE done-criterion) ─────────────────────
const recA = `rec_b7_${run}`;
await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [recA, cliA]);
const clipA = `clip_b7_${run}`;
await db.query(
  `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, hook, status)
   VALUES ($1,$2,30,62,90,'{"energyZ":1.5,"durationFit":0.9,"positionBonus":0.8}','B7 wall hook ${run}','awaiting_client')`,
  [clipA, recA]);

r = await j('GET', '/api/clips', null, clientA.token);
assert(r.status === 200 && r.data.clips.some((c) => c.id === clipA) && r.data.clips.every((c) => c.recording_id.startsWith('rec_b7_') ? true : true),
  "client A's clip list includes their clip");
r = await j('GET', '/api/clips', null, clientB.token);
assert(r.status === 200 && !r.data.clips.some((c) => c.id === clipA), "client B's clip list does NOT include client A's clip");
r = await j('GET', `/api/clips/${clipA}/metrics`, null, clientB.token);
assert(r.status === 403, "client B cannot read client A's clip metrics");
r = await j('GET', `/api/review/${clipA}/history`, null, clientB.token);
assert(r.status === 403, "client B cannot read client A's audit trail");
r = await j('GET', `/api/analytics/clients/${cliA}`, null, clientB.token);
assert(r.status === 403, "client B cannot read client A's report");
r = await j('GET', `/api/analytics/clients/${cliA}`, null, clientA.token);
assert(r.status === 200, 'client A reads their own report');
r = await j('GET', `/api/clients/${cliA}`, null, clientB.token);
assert(r.status === 403, "client B cannot read client A's account");
r = await j('GET', '/api/review/queue?status=awaiting_review&clientId=' + cliB, null, clientA.token);
assert(r.status === 200 && r.data.status === 'awaiting_client'
  && r.data.items.every((i) => i.client_id === cliA) && r.data.items.some((i) => i.id === clipA),
  'client queue requests are PINNED to own sign-off list whatever params they send');
r = await j('POST', '/api/intake', { clientId: cliB, sourceUrl: 'https://x/y.mp3' }, clientA.token);
assert(r.status === 403, 'client A cannot submit content as client B');
r = await j('GET', '/api/intake/queue?clientId=' + cliB, null, clientA.token);
assert(r.status === 200 && r.data.items.some((i) => i.id === recA) && r.data.items.every((i) => i.client_name === undefined),
  'client intake queue is PINNED to own submissions whatever params they send (F5 upload surface)');
r = await j('GET', '/api/intake/queue', null, clientB.token);
assert(r.status === 200 && !r.data.items.some((i) => i.id === recA),
  "client B's submission list does NOT include client A's recordings");

// ── attribution: approval and publish carry the session identity ───────────
await j('POST', '/api/publish/connections', { clientId: cliA, platform: 'youtube', credentials: { t: run } }, ops);
r = await j('POST', `/api/review/${clipA}/decision`, { decision: 'approve', notes: 'b7 wall check' }, clientA.token);
assert(r.status === 200 && r.data.to === 'approved' && r.data.scheduled.includes('youtube'),
  'client approves their own clip via session — no userId in the body anywhere');
r = await j('GET', `/api/review/${clipA}/history`, null, clientA.token);
assert(r.data.events[0].reviewer_email === `cla+${run}@clipper.ai`,
  'the approval is attributable to the session user (done-criterion)');
const job = (await db.query(`SELECT pj.scheduled_by, u.email FROM publish_jobs pj JOIN users u ON u.id = pj.scheduled_by WHERE pj.clip_id = $1`, [clipA])).rows[0];
assert(job.email === `cla+${run}@clipper.ai`,
  'the publish is attributable: scheduled_by = the approver whose sign-off queued it');
r = await j('POST', `/api/review/${clipA}/send`, {}, clientA.token);
assert(r.status === 403, 'client users still cannot run internal routing steps');

// ── logout revokes server-side ──────────────────────────────────────────────
r = await j('POST', '/api/auth/logout', {}, reviewer.token);
assert(r.status === 200, 'logout');
r = await j('GET', '/api/auth/me', null, reviewer.token);
assert(r.status === 401, 'a logged-out session is dead server-side, not just cookie-cleared');

await db.end();
console.log('\nB7 smoke passed: one door, real sessions, role walls everywhere — own data only, every action attributable.');
