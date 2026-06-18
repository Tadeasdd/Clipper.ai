/* Q5 smoke: online calibration + drift detection.
 *
 *  Offline + deterministic (isolated DB). Seeds published clips whose score
 *  PREDICTS realized performance (high calibration), snapshots it, then seeds a
 *  batch where score is ANTI-correlated with performance (the model has drifted)
 *  and snapshots again — asserting the monitor detects the decay, emits an alert
 *  (to a local webhook), records the drift as a review item, and does NOT
 *  false-alarm on a stable follow-up. The calibration history (dashboard data)
 *  exists. detectDrift() is unit-checked.
 */
import http from 'node:http';
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_drift';
{
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`;
  process.env.DATABASE_URL = u.toString();
}

// a local webhook so we can prove an alert is actually emitted (the dry-run
// default just logs; here we point it at ourselves)
const alerts = [];
const hook = http.createServer((req, res) => {
  let body = ''; req.on('data', (d) => { body += d; }); req.on('end', () => { try { alerts.push(JSON.parse(body)); } catch {} res.writeHead(204); res.end(); });
});
await new Promise((r) => hook.listen(0, '127.0.0.1', r));
process.env.ALERT_WEBHOOK_URL = `http://127.0.0.1:${hook.address().port}/alert`;
process.env.DRIFT_THRESHOLD = '0.4';

const { migrate, q, pool } = await import('../src/db/index.js');
const { id } = await import('../src/lib/ids.js');
const { snapshotCalibration, detectDrift, calibrationHistory } = await import('../src/metrics/monitor.js');
await migrate();

const cli = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Drift Co','growth','weekly')`, [cli]);
const rec = id('rec');
await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rec, cli]);

// seed a published clip: model score + realized views (captured now → in window)
const seed = async (score, views) => {
  const clip = id('clip'); const pub = id('pub');
  await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status) VALUES ($1,$2,10,40,$3,'{}','published')`, [clip, rec, score]);
  await q(`INSERT INTO publish_jobs (id, clip_id, platform, status, published_at) VALUES ($1,$2,'youtube','published',now())`, [pub, clip]);
  await q(`INSERT INTO clip_metrics (id, publish_id, views, retention) VALUES ($1,$2,$3,0.5)`, [id('m'), pub, views]);
};

// ── phase A: score PREDICTS performance (high calibration) ───────────────────
for (let i = 1; i <= 10; i++) await seed(i * 10, i * 1000);  // score↑ ⇒ views↑
const snap1 = await snapshotCalibration();
assert(snap1.value > 0.8 && snap1.sample === 10, `calibration is high when score predicts performance (ρ=${snap1.value}, n=${snap1.sample})`);
assert(snap1.drift === false, 'first snapshot has no baseline → no drift');

// ── phase B: score is ANTI-correlated with performance (the model drifted) ───
for (let i = 1; i <= 10; i++) await seed(i * 10, (11 - i) * 1000);  // score↑ ⇒ views↓
const snap2 = await snapshotCalibration();
assert(snap2.value < snap1.value - 0.4, `calibration decayed (${snap1.value} → ${snap2.value})`);
assert(snap2.drift === true, 'the monitor detects the drift');
assert(alerts.some((a) => a.kind === 'quality.drift'), 'a drift alert is emitted to the configured channel');
assert((await q('SELECT count(*)::int n FROM calibration_snapshots WHERE drift')).rows[0].n === 1,
  'the drift is recorded as a review item (one drifted snapshot)');

// ── no false alarm: a stable follow-up does not re-trip ──────────────────────
const before = alerts.length;
const snap3 = await snapshotCalibration();
assert(snap3.drift === false && alerts.length === before, 'a stable follow-up snapshot does NOT false-alarm');

// ── detectDrift unit ─────────────────────────────────────────────────────────
assert(detectDrift({ value: 0.2, sample: 10 }, 0.9).drift === true, 'detectDrift: a big decay trips');
assert(detectDrift({ value: 0.85, sample: 10 }, 0.9).drift === false, 'detectDrift: a small dip is within tolerance');
assert(detectDrift({ value: null, sample: 2 }, 0.9).drift === false, 'detectDrift: no value (below sample gate) never trips');

// ── dashboard data exists ────────────────────────────────────────────────────
const history = await calibrationHistory(50);
assert(history.length === 3, `calibration history (the dashboard series) exists (${history.length} snapshots)`);

await pool.end();
hook.close();
console.log('\nQ5 smoke passed: live calibration is tracked, drift trips an alert + a recorded review, stable runs stay quiet.');
process.exit(0);
