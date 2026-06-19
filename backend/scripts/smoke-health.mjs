/* O3 smoke: client health & lifecycle.
 *
 *  Offline + deterministic (isolated DB). Seeds clients in distinct states and
 *  asserts the computed picture:
 *   - onboarding checklist reflects real state (complete vs partial);
 *   - health score is the mean of available sub-signals (null for a brand-new
 *     client, a real number once there's activity);
 *   - churn flags name concrete reasons (inactive, low_approval) and set
 *     at-risk; a healthy client is not flagged;
 *   - the lifecycle stage is the stored operator field; overview sorts at-risk
 *     first.
 */
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_health';
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
const { clientHealth, healthOverview } = await import('../src/ops/health.js');
await migrate();

const reviewer = id('usr');
await q(`INSERT INTO users (id, email, role) VALUES ($1,'rev@clipper.ai','reviewer')`, [reviewer]);

const mkClient = async (name, plan, stage) => {
  const cid = id('cli');
  await q(`INSERT INTO clients (id, name, plan, cadence, lifecycle_stage) VALUES ($1,$2,$3,'weekly',$4)`, [cid, name, plan, stage || 'onboarding']);
  return cid;
};
const addConnection = (cid) => q(`INSERT INTO platform_connections (id, client_id, platform, credentials_enc, status) VALUES ($1,$2,'youtube','x','active')`, [id('conn'), cid]);
const addRecording = (cid, agoDays, status = 'ready') => {
  const rec = id('rec');
  return q(`INSERT INTO recordings (id, client_id, kind, status, duration_s, created_at) VALUES ($1,$2,'podcast',$3,180, now() - ($4 || ' days')::interval)`, [rec, cid, status, String(agoDays)]).then(() => rec);
};
const addPublishedClip = async (rec, agoDays, retention) => {
  const clip = id('clip'); const pub = id('pub');
  await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status) VALUES ($1,$2,10,40,80,'{}','published')`, [clip, rec]);
  await q(`INSERT INTO publish_jobs (id, clip_id, platform, status, published_at) VALUES ($1,$2,'youtube','published', now() - ($3 || ' days')::interval)`, [pub, clip, String(agoDays)]);
  if (retention != null) await q(`INSERT INTO clip_metrics (id, publish_id, views, retention) VALUES ($1,$2,1000,$3)`, [id('met'), pub, retention]);
  return clip;
};
const addVerdict = async (rec, decision) => {
  const clip = id('clip');
  await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status) VALUES ($1,$2,10,40,80,'{}','awaiting_review')`, [clip, rec]);
  await q(`INSERT INTO review_events (id, clip_id, reviewer_id, decision) VALUES ($1,$2,$3,$4)`, [id('rev'), clip, reviewer, decision]);
};

// A — healthy: fully onboarded, recent, approved, on-time, decent retention
const A = await mkClient('Healthy Co', 'growth');
await addConnection(A);
const aRec = await addRecording(A, 0);
await addPublishedClip(aRec, 0, 0.6);
await addVerdict(aRec, 'approve'); await addVerdict(aRec, 'approve');

// B — inactive: onboarded but no activity in 30 days
const B = await mkClient('Inactive Co', 'growth');
await addConnection(B);
const bRec = await addRecording(B, 30);
await addPublishedClip(bRec, 30, null);

// C — low approval: recent, but reviewers mostly reject (4 verdicts, 1 approve)
const C = await mkClient('LowApproval Co', 'growth');
await addConnection(C);
const cRec = await addRecording(C, 0);
await addVerdict(cRec, 'approve');
await addVerdict(cRec, 'reject'); await addVerdict(cRec, 'reject'); await addVerdict(cRec, 'changes');

// D — brand new: nothing yet, no plan
const D = await mkClient('New Co', null);

// ── A: healthy ───────────────────────────────────────────────────────────────
const a = await clientHealth(A);
assert(a.onboarding.complete && a.onboarding.done === 4, 'A: onboarding checklist complete (4/4) from real state');
assert(typeof a.score === 'number' && a.score >= 70, `A: health score is a real number and healthy (${a.score})`);
assert(a.churn.atRisk === false, 'A: a healthy client is not flagged at-risk');
assert(a.recommendedStage === 'active', 'A: recommended stage is active');
assert(a.subscores.approval === 100 && a.subscores.performance === 60, 'A: subscores computed (approval 100, performance 60 from retention)');

// ── B: inactive ──────────────────────────────────────────────────────────────
const b = await clientHealth(B);
assert(b.churn.atRisk && b.churn.reasons.includes('inactive'), 'B: 30-day-silent client is flagged at-risk (inactive)');

// ── C: low approval ──────────────────────────────────────────────────────────
const c = await clientHealth(C);
assert(c.detail.verdicts === 4 && c.detail.approvalRate === 0.25, 'C: approval rate computed from verdicts (1/4)');
assert(c.churn.atRisk && c.churn.reasons.includes('low_approval'), 'C: low approval flags at-risk');

// ── D: brand new ─────────────────────────────────────────────────────────────
const d = await clientHealth(D);
assert(d.score === null, 'D: a brand-new client scores null, not zero');
assert(!d.onboarding.complete && d.onboarding.done === 0, 'D: onboarding incomplete (0/4)');
assert(d.recommendedStage === 'onboarding', 'D: recommended stage is onboarding');

// ── lifecycle stage is the stored operator field ─────────────────────────────
assert(a.stage === 'onboarding', 'stored lifecycle stage defaults to onboarding');
await q(`UPDATE clients SET lifecycle_stage = 'active' WHERE id = $1`, [A]);
const a2 = await clientHealth(A);
assert(a2.stage === 'active', 'an operator-set lifecycle stage is reflected');

// ── overview: at-risk first ──────────────────────────────────────────────────
const ov = await healthOverview();
assert(ov.totals.atRisk === 2, 'overview totals count the at-risk clients (B, C)');
const firstHealthyIdx = ov.clients.findIndex((x) => !x.churn.atRisk);
assert(ov.clients.slice(firstHealthyIdx).every((x) => !x.churn.atRisk), 'overview sorts at-risk clients first');

await pool.end();
console.log('\nO3 smoke passed: onboarding is derived from real state, health scores from real signals, churn flags name concrete reasons, and the lifecycle stage is an operator-owned workflow field — all offline.');
process.exit(0);
