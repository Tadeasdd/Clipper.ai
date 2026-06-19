/** Q5 — online quality calibration + drift detection.
 *
 *  The Q1 eval gates quality OFFLINE, but production quality can still drift
 *  silently: a model update, a content-mix shift, an audience change. This
 *  watches the live signal — how well clips.score predicts realized performance
 *  — over a recent window, snapshots it on a clock, and when calibration decays
 *  past a threshold versus the prior snapshot it raises an alert and records the
 *  drift as a review item.
 *
 *  Under METRICS_DRIVER=local the realized numbers are score-independent by
 *  design, so calibration sits near null and the monitor never false-alarms —
 *  the honest reading. The machinery is what's proven here; a live driver makes
 *  it real. The alert channel is a dry-run log by default; ALERT_WEBHOOK_URL (or
 *  Track R's routing) makes it page someone.
 */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { spearman } from '../lib/stats.js';
import { log } from '../lib/log.js';

const WINDOW_DAYS = Number(process.env.DRIFT_WINDOW_DAYS || 14);
const THRESHOLD = Number(process.env.DRIFT_THRESHOLD || 0.4);
const MIN_SAMPLE = Number(process.env.DRIFT_MIN_SAMPLE || 8);
const SNAPSHOT_INTERVAL_S = Number(process.env.DRIFT_SNAPSHOT_INTERVAL_S || 21600); // 6h
const round = (v) => (v === null || v === undefined ? null : Number(Number(v).toFixed(3)));

/** Spearman(score, client-normalized views) over published clips whose latest
 *  capture is inside the recent window — the live calibration signal. */
export async function windowedCalibration(windowDays = WINDOW_DAYS, minSample = MIN_SAMPLE) {
  const { rows } = await q(`
    WITH latest AS (
      SELECT DISTINCT ON (m.publish_id) m.publish_id, m.views, m.captured_at
      FROM clip_metrics m ORDER BY m.publish_id, m.captured_at DESC
    ),
    per_clip AS (
      SELECT cl.id, cl.score, rec.client_id, max(latest.views) AS views
      FROM clips cl
      JOIN recordings rec ON rec.id = cl.recording_id
      JOIN publish_jobs pj ON pj.clip_id = cl.id AND pj.status = 'published'
      JOIN latest ON latest.publish_id = pj.id
      WHERE cl.score IS NOT NULL AND latest.views IS NOT NULL
        AND latest.captured_at >= now() - ($1 || ' days')::interval
      GROUP BY cl.id, cl.score, rec.client_id
    )
    SELECT score, views / GREATEST(avg(views) OVER (PARTITION BY client_id), 1) AS perf FROM per_clip`,
    [String(windowDays)]);
  if (rows.length < minSample) return { value: null, sample: rows.length };
  return { value: round(spearman(rows.map((r) => Number(r.score)), rows.map((r) => Number(r.perf)))), sample: rows.length };
}

/** Pure: did calibration decay past the threshold versus the baseline? */
export function detectDrift(current, baseline, threshold = THRESHOLD) {
  if (current?.value == null || baseline == null) return { drift: false, delta: null, reason: 'insufficient history' };
  const delta = round(current.value - baseline);
  return { drift: delta <= -threshold, delta, reason: delta <= -threshold ? `calibration fell ${delta} (≥ ${threshold}) vs the prior snapshot` : 'within tolerance' };
}

/** Emit an alert. Dry-run default: the structured audit log (+ a recorded
 *  snapshot). ALERT_WEBHOOK_URL (or Track R routing) makes it page for real. */
export async function raiseAlert(kind, detail) {
  log.security(kind, detail);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return; // dry run — logged, not paged
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, detail }) });
  } catch (e) { log.warn('alert webhook failed', { error: e.message }); }
}

/** Take one calibration snapshot: compute current vs the prior snapshot, store
 *  it, and alert + flag a review when it has drifted. Returns the snapshot. */
export async function snapshotCalibration() {
  const current = await windowedCalibration();
  const prior = (await q('SELECT value FROM calibration_snapshots ORDER BY captured_at DESC LIMIT 1')).rows[0];
  const baseline = prior ? Number(prior.value) : null;
  const { drift, delta, reason } = detectDrift(current, baseline);
  const snap = { id: id('cal'), value: current.value, sample: current.sample, baseline, drift,
    detail: { delta, reason, windowDays: WINDOW_DAYS, threshold: THRESHOLD } };
  await q(`INSERT INTO calibration_snapshots (id, value, sample, baseline, drift, detail)
           VALUES ($1,$2,$3,$4,$5,$6)`,
    [snap.id, snap.value, snap.sample, snap.baseline, snap.drift, JSON.stringify(snap.detail)]);
  if (drift) {
    await raiseAlert('quality.drift', { snapshotId: snap.id, value: current.value, baseline, delta, sample: current.sample });
  }
  return snap;
}

export async function calibrationHistory(limit = 50) {
  const { rows } = await q('SELECT id, captured_at, value, sample, baseline, drift, detail FROM calibration_snapshots ORDER BY captured_at DESC LIMIT $1', [limit]);
  return rows;
}

let running = false;
/** Periodic monitor: snapshot calibration on a clock (6h default). Started with
 *  the in-process workers; a missed tick is harmless (the series self-heals). */
export function startQualityMonitor() {
  if (running) return;
  running = true;
  (async function loop() {
    await new Promise((r) => setTimeout(r, 5000)); // let boot settle
    while (running) {
      try { await snapshotCalibration(); }
      catch (e) { log.warn('calibration snapshot failed', { error: e.message }); }
      await new Promise((r) => setTimeout(r, SNAPSHOT_INTERVAL_S * 1000));
    }
  })();
  console.log(`[monitor] quality calibration monitor started (window ${WINDOW_DAYS}d, drift threshold ${THRESHOLD}, every ${SNAPSHOT_INTERVAL_S}s)`);
}

export function stopQualityMonitor() { running = false; } // R2: halt the periodic snapshot on shutdown
