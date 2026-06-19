/* E2 smoke: usage metering + plan/quota enforcement.
 *
 *  Sets up clients on tiny-quota plans (one per policy) already over their limit,
 *  then drives the real intake endpoint and asserts the boundary behaves per
 *  policy — block → 402, queue → accepted but held (not processed), warn →
 *  accepted with a flag — and that usage accrues and is visible on the clients
 *  API. Plans/usage are seeded via SQL (no plan-admin API); enforcement is HTTP.
 */
import pg from 'pg';

const BASE = process.env.BASE || 'http://localhost:8080';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const uid = (p) => `${p}_${Date.now().toString(36)}${Math.floor(performance.now()).toString(36)}`;

const { opsSession } = await import('./lib-smoke-auth.mjs');
const OPS = await opsSession(BASE);
const j = async (m, p, body) => {
  const res = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', authorization: `Bearer ${OPS}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const db = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });
await db.connect();

// tiny-quota plans, one per policy
for (const [name, policy] of [['t_block', 'block'], ['t_queue', 'queue'], ['t_warn', 'warn']]) {
  await db.query(`INSERT INTO plans (name, clip_quota, minute_quota, limit_policy, monthly_price_usd)
                  VALUES ($1, 1, 1, $2, 0) ON CONFLICT (name) DO UPDATE SET clip_quota=1, minute_quota=1, limit_policy=$2`, [name, policy]);
}

// a client on a plan, already over quota (1 delivered clip + a processed minute this month)
const seedOverQuota = async (plan) => {
  const cli = uid('cli'); const rec = uid('rec'); const clip = uid('clip');
  await db.query(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,$2,$3,'weekly')`, [cli, `Meter ${plan}`, plan]);
  await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s, created_at) VALUES ($1,$2,'podcast','ready',180, now())`, [rec, cli]);
  await db.query(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status) VALUES ($1,$2,10,40,80,'{}','published')`, [clip, rec]);
  return cli;
};

const blockCli = await seedOverQuota('t_block');
const queueCli = await seedOverQuota('t_queue');
const warnCli = await seedOverQuota('t_warn');

// ── usage accrues + is visible ───────────────────────────────────────────────
const usage = (await j('GET', `/api/clients/${blockCli}/usage`)).data;
assert(usage.usage.clipsDelivered === 1 && usage.usage.minutesProcessed === 3, 'usage accrues per client (1 clip, 3 min) and is visible on the clients API');
assert(usage.state === 'over' && usage.pct >= 1, 'an over-quota client reads state=over');

// ── block: denied at the boundary (402, no recording) ────────────────────────
const blocked = await j('POST', '/api/intake', { clientId: blockCli, sourceUrl: 'https://example.com/a.mp3' });
assert(blocked.status === 402, 'a block-policy client over quota is denied at intake (402)');
assert(blocked.data.meter?.policy === 'block' && blocked.data.meter?.state === 'over', 'the 402 carries the metered reason');

// ── queue: accepted but held (not enqueued) ──────────────────────────────────
const queued = await j('POST', '/api/intake', { clientId: queueCli, sourceUrl: 'https://example.com/b.mp3' });
assert(queued.status === 201 && queued.data.held === true, 'a queue-policy client over quota is accepted but held');
const jobs = await db.query(`SELECT count(*)::int n FROM pipeline_jobs WHERE recording_id=$1`, [queued.data.recordingId]);
assert(jobs.rows[0].n === 0, 'a held intake is NOT enqueued for processing');

// ── warn: accepted, processed, but flagged ───────────────────────────────────
const warned = await j('POST', '/api/intake', { clientId: warnCli, filename: 'c.mp4', kind: 'podcast' });
assert(warned.status === 201 && warned.data.held !== true, 'a warn-policy client over quota is still accepted');
assert(warned.data.meter?.state === 'over', 'the response flags the over-quota state (warn)');

await db.end();
console.log('\nE2 smoke passed: usage accrues per client; the plan boundary blocks / holds / warns per policy and is visible on the ops API.');
process.exit(0);
