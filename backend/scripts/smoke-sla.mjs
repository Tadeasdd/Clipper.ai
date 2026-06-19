/* O1 smoke: SLA / turnaround tracking + breach surfacing.
 *
 *  Offline + deterministic (isolated DB). Seeds, per client, recordings with
 *  controlled submit→deliver timings and asserts turnaroundByClient computes
 *  per-client turnaround vs the plan SLA target and flags both breach kinds:
 *    - late:    a delivered recording over the target;
 *    - overdue: an in-flight recording past the target, not yet delivered.
 *  Also asserts per-plan targets (scale 24h, growth 48h, plan-less → default)
 *  and that R4's SLO turnaround objective still exists (what the endpoint folds
 *  in to "feed R4 SLOs").
 */
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_sla';
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
const { turnaroundByClient } = await import('../src/ops/sla.js');
const { evaluateSlos } = await import('../src/ops/slo.js');
await migrate();

// A delivered recording: created `agoH` hours ago, its clip published now.
const mkDelivered = async (clientId, agoH) => {
  const rec = id('rec'); const clip = id('clip');
  await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s, created_at)
           VALUES ($1,$2,'podcast','ready',180, now() - ($3 || ' hours')::interval)`, [rec, clientId, String(agoH)]);
  await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status)
           VALUES ($1,$2,10,40,80,'{}','published')`, [clip, rec]);
  await q(`INSERT INTO publish_jobs (id, clip_id, platform, status, published_at)
           VALUES ($1,$2,'youtube','published', now())`, [id('pub'), clip]);
  return rec;
};
// An in-flight recording: created `agoH` hours ago, still processing, undelivered.
const mkInflight = async (clientId, agoH) => {
  const rec = id('rec');
  await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s, created_at)
           VALUES ($1,$2,'podcast','processing',180, now() - ($3 || ' hours')::interval)`, [rec, clientId, String(agoH)]);
  return rec;
};

// growth (sla 48h): one on-time delivery (2h), one late (100h), one overdue in-flight (100h)
const growth = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Growth Co','growth','weekly')`, [growth]);
await mkDelivered(growth, 2);
await mkDelivered(growth, 100);
await mkInflight(growth, 100);

// scale (sla 24h): a 30h delivery → late under the tighter target
const scale = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Scale Co','scale','weekly')`, [scale]);
await mkDelivered(scale, 30);

// plan-less (sla default 72h): one overdue in-flight (100h)
const noplan = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'No Plan Co', NULL,'weekly')`, [noplan]);
await mkInflight(noplan, 100);

// a healthy client whose only delivery is well inside SLA → not breaching
const healthy = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Healthy Co','growth','weekly')`, [healthy]);
await mkDelivered(healthy, 3);

const report = await turnaroundByClient(365);
const byId = Object.fromEntries(report.clients.map((c) => [c.clientId, c]));

// ── per-client turnaround is computed ────────────────────────────────────────
const g = byId[growth];
assert(g && g.delivered === 2, 'growth: both delivered recordings counted (2)');
assert(g.slaHours === 48, 'growth: SLA target comes from the plan (48h)');
assert(g.medianHours != null && g.worstHours >= 99 && g.worstHours <= 101, `growth: turnaround computed from timestamps (worst ~100h, got ${g.worstHours})`);

// ── breaches flag: late (delivered over target) + overdue (in-flight) ────────
assert(g.late === 1, 'growth: exactly one delivery breached SLA (the 100h one; the 2h one did not)');
assert(g.overdue === 1 && g.oldestOverdueHours >= 99, 'growth: the undelivered 100h recording is flagged overdue');
assert(g.breached === true && g.breaches === 2, 'growth: client flagged breaching (1 late + 1 overdue)');

// ── per-plan targets ─────────────────────────────────────────────────────────
const s = byId[scale];
assert(s && s.slaHours === 24, 'scale: tighter SLA target from the plan (24h)');
assert(s.late === 1 && s.breached === true, 'scale: a 30h delivery breaches the 24h SLA');

const n = byId[noplan];
assert(n && n.slaHours === report.defaultSlaHours && n.slaHours === 72, 'plan-less client falls back to the default SLA (72h)');
assert(n.overdue === 1 && n.breached === true, 'plan-less: overdue in-flight flagged against the default SLA');

// ── healthy client is not flagged ────────────────────────────────────────────
const h = byId[healthy];
assert(h && h.delivered === 1 && h.breached === false && h.late === 0 && h.overdue === 0, 'a within-SLA client is on time (not breaching)');

// ── totals + worst-first ordering ────────────────────────────────────────────
assert(report.totals.breachingClients === 3 && report.totals.late === 2 && report.totals.overdue === 2,
  'totals roll up across clients (3 breaching, 2 late, 2 overdue)');
const breachingFirst = report.clients.findIndex((c) => !c.breached);
assert(breachingFirst === -1 || report.clients.slice(breachingFirst).every((c) => !c.breached),
  'clients are sorted worst-first (breaching clients on top)');

// ── feeds R4: the SLO turnaround objective the endpoint folds in still exists ─
const slo = await evaluateSlos({ alert: false });
assert((slo.objectives || []).some((o) => o.objective === 'turnaround_p95_seconds'),
  'the R4 SLO turnaround objective is available (the endpoint surfaces it alongside per-client SLA)');

await pool.end();
console.log('\nO1 smoke passed: per-client submit→deliver turnaround is computed against plan SLA targets, late + overdue breaches are flagged and rolled up, and the R4 SLO turnaround objective feeds the same surface.');
process.exit(0);
