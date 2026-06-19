/* O2 smoke: capacity & workload planning.
 *
 *  Offline + deterministic (isolated DB). Seeds a reviewer/editor pool and an
 *  unassigned awaiting_review backlog, then asserts:
 *   - assignClip assigns to a valid reviewer; rejects a non-review role and a
 *     clip that isn't in an assignable state; never moves clips.status;
 *   - balanceAssignments spreads the backlog so loads converge (within 1);
 *   - workloadForecast reports per-reviewer load + throughput, backlog depth,
 *     and a clear-time that is null with no measured rate, then a real number
 *     once decisions exist (= backlog ÷ throughput).
 */
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_capacity';
{
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`;
  process.env.DATABASE_URL = u.toString();
}

const { migrate, q, pool } = await import('../src/db/index.js');
const { id } = await import('../src/lib/ids.js');
const { assignClip, balanceAssignments, leastLoadedReviewer, workloadForecast } = await import('../src/ops/capacity.js');
await migrate();

// pool: 3 reviewers + 1 editor (the assignable staff), plus an account_manager
const mkUser = async (role, n) => { const uid = id('usr'); await q(`INSERT INTO users (id, email, role) VALUES ($1,$2,$3)`, [uid, `${role}${n}@clipper.ai`, role]); return uid; };
const r1 = await mkUser('reviewer', 1);
const r2 = await mkUser('reviewer', 2);
const r3 = await mkUser('reviewer', 3);
const e1 = await mkUser('editor', 1);
const am = await mkUser('account_manager', 1);
const POOL = 4; // r1,r2,r3,e1

const cli = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Capacity Co','growth','weekly')`, [cli]);
const rec = id('rec');
await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rec, cli]);

const mkClip = async (status) => {
  const clip = id('clip');
  await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status) VALUES ($1,$2,10,40,80,'{}',$3)`, [clip, rec, status]);
  return clip;
};
const backlogClips = [];
for (let i = 0; i < 8; i++) backlogClips.push(await mkClip('awaiting_review'));
const candidate = await mkClip('candidate'); // not assignable

// ── assignment: valid, role-guarded, state-guarded ───────────────────────────
let res = await assignClip(backlogClips[0], r1);
assert(res.ok && res.assignee.id === r1, 'a clip is assigned to a reviewer');
const owned = (await q(`SELECT assigned_to, status FROM clips WHERE id=$1`, [backlogClips[0]])).rows[0];
assert(owned.assigned_to === r1 && owned.status === 'awaiting_review', 'assignment sets assigned_to and never moves clips.status');

res = await assignClip(backlogClips[1], am);
assert(!res.ok && /not a reviewer\/editor/.test(res.reason), 'assigning to a non-review role is rejected');

res = await assignClip(candidate, r1);
assert(!res.ok && /not in an assignable state/.test(res.reason), 'a non-assignable (candidate) clip is rejected');

res = await assignClip(backlogClips[2], 'usr_nobody');
assert(!res.ok && /unknown user/.test(res.reason), 'assigning to an unknown user is rejected');

// least-loaded: r1 has 1, everyone else 0 → next pick is not r1
const least = await leastLoadedReviewer();
assert(least && least !== r1, 'least-loaded reviewer is one of the idle staff, not the loaded r1');

// ── balance: spread the remaining unassigned backlog evenly ──────────────────
const bal = await balanceAssignments();
// 8 backlog clips, 1 pre-assigned → 7 to distribute across 4 → 2 each
assert(bal.assigned === 7, `balance assigned every unassigned awaiting_review clip (${bal.assigned}/7)`);
const loads = bal.reviewers.map((r) => r.open);
assert(Math.max(...loads) - Math.min(...loads) <= 1, `work is balanced across reviewers (loads ${loads.join(',')}, spread ≤ 1)`);
const stillUnassigned = (await q(`SELECT count(*)::int n FROM clips WHERE status='awaiting_review' AND assigned_to IS NULL`)).rows[0].n;
assert(stillUnassigned === 0, 'no unassigned awaiting_review work remains after balancing');

// ── forecast: null clear-time with no rate, real number once decisions exist ─
let fc = await workloadForecast(7);
assert(fc.backlog.awaitingReview === 8 && fc.backlog.unassigned === 0, 'backlog depth is reported (8 awaiting, 0 unassigned)');
assert(fc.reviewers.length === POOL && fc.reviewers.every((r) => r.open >= 0), 'per-reviewer load is reported for the whole pool');
assert(fc.forecastHours === null, 'with no decisions yet there is no rate to project (forecast null)');

// seed 24 completed decisions across the window → a measurable throughput
for (let i = 0; i < 24; i++) {
  const who = [r1, r2, r3, e1][i % 4];
  await q(`INSERT INTO review_events (id, clip_id, reviewer_id, decision, created_at) VALUES ($1,$2,$3,$4, now() - ($5 || ' hours')::interval)`,
    [id('rev'), backlogClips[i % 8], who, ['approve', 'reject', 'changes'][i % 3], String(i)]);
}
fc = await workloadForecast(7);
assert(fc.throughputPerHour > 0, `pool throughput is measured (${fc.throughputPerHour}/hr)`);
const expected = Number((fc.backlog.awaitingReview / fc.throughputPerHour).toFixed(1));
assert(fc.forecastHours === expected, `clear-time forecasts from backlog ÷ throughput (${fc.forecastHours}h)`);
assert(fc.reviewers.some((r) => r.throughputPerDay > 0), 'per-reviewer throughput is reported');

await pool.end();
console.log('\nO2 smoke passed: review work assigns to the reviewer/editor pool, balances evenly, and the backlog clear-time forecasts from measured throughput — all offline, status machine untouched.');
process.exit(0);
