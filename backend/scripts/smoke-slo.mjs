/* R4 smoke: SLOs + error budgets + alert routing.
 *
 *  Offline + deterministic (isolated DB). Seeds a healthy window (no breach, no
 *  page), then burns the processing budget (failures beyond the SLO) and a slow
 *  turnaround — asserting the report flags each breach AND a slo.breach alert is
 *  delivered to a local webhook (the "real channel"), while the healthy window
 *  stayed quiet. Confirms docs/SLO.md exists.
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_slo';
{
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`;
  process.env.DATABASE_URL = u.toString();
}

const alerts = [];
const hook = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { try { alerts.push(JSON.parse(b)); } catch {} res.writeHead(204); res.end(); }); });
await new Promise((r) => hook.listen(0, '127.0.0.1', r));
process.env.ALERT_WEBHOOK_URL = `http://127.0.0.1:${hook.address().port}/alert`;
process.env.SLO_SUCCESS_TARGET = '0.99';
process.env.SLO_TURNAROUND_P95_S = '60';
process.env.SLO_WINDOW_S = '86400';

const { migrate, q, pool } = await import('../src/db/index.js');
const { id } = await import('../src/lib/ids.js');
const { evaluateSlos } = await import('../src/ops/slo.js');
await migrate();

const cli = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'SLO Co','growth','weekly')`, [cli]);

const mkReady = async (turnaroundS) => {
  const rec = id('rec');
  await q(`INSERT INTO recordings (id, client_id, kind, status, created_at) VALUES ($1,$2,'podcast','ready', now() - ($3 || ' seconds')::interval)`, [rec, cli, String(turnaroundS)]);
  await q(`INSERT INTO pipeline_jobs (id, recording_id, stage, status, attempts, finished_at) VALUES ($1,$2,'generate','done',1, now())`, [id('job'), rec]);
  return rec;
};
const mkFailed = async () => q(`INSERT INTO recordings (id, client_id, kind, status) VALUES ($1,$2,'podcast','failed')`, [id('rec'), cli]);

// ── 1. healthy window: no breach, no page ────────────────────────────────────
for (let i = 0; i < 5; i++) await mkReady(5); // fast turnaround, all succeeded
const healthy = await evaluateSlos({ alert: true });
const succ = healthy.objectives.find((o) => o.objective === 'processing_success_rate');
const ta = healthy.objectives.find((o) => o.objective === 'turnaround_p95_seconds');
assert(healthy.breached === false, 'a healthy window does not breach any SLO');
assert(succ.sli === 1 && succ.sample === 5, 'processing success rate is measured (100% of 5)');
assert(ta.sli != null && ta.sli <= 60 && ta.sample === 5, `p95 turnaround is computed from real timestamps (~${ta.sli}s)`);
assert(alerts.length === 0, 'no alert fires while inside the budget');

// ── 2. burn the processing budget → breach + alert ───────────────────────────
for (let i = 0; i < 10; i++) await mkFailed(); // 5 ready / 15 total = 33% << 99%
const burned = await evaluateSlos({ alert: true });
const sb = burned.objectives.find((o) => o.objective === 'processing_success_rate');
assert(burned.breached === true && sb.breached === true, 'burning the processing budget breaches the SLO');
assert(sb.burn > 1, `the error-budget burn is over 1 (${sb.burn}×)`);
assert(alerts.some((a) => a.kind === 'slo.breach'), 'a slo.breach alert is delivered to the configured channel');
assert(alerts.at(-1).detail.breaches.some((b) => b.objective === 'processing_success_rate'), 'the alert names the breached objective');

// ── 3. slow turnaround also breaches its objective ───────────────────────────
await mkReady(300); // 300s ≫ 60s target → drags p95 over the bound
const slow = await evaluateSlos({ alert: true });
assert(slow.objectives.find((o) => o.objective === 'turnaround_p95_seconds').breached === true, 'a slow p95 turnaround breaches its SLO');

// ── 4. the SLOs are documented (file where the repo is present; otherwise — e.g.
//    inside the backend image whose build context excludes repo-root docs/ —
//    assert the report still carries an explicit target per objective) ────────
const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');
if (existsSync(docsDir)) {
  assert(existsSync(path.join(docsDir, 'SLO.md')), 'docs/SLO.md documents the SLIs/SLOs/error budgets');
} else {
  assert(slow.objectives.every((o) => typeof o.target === 'number'), 'every SLO carries a documented target (docs/ not in this container; see docs/SLO.md in the repo)');
}

await pool.end();
hook.close();
console.log('\nR4 smoke passed: SLIs are measured from real data, a burning error budget breaches + pages, a healthy window stays quiet, and the SLOs are documented.');
process.exit(0);
