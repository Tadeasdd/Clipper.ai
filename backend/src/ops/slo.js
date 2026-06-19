/** R4 — SLIs / SLOs / error budgets.
 *
 *  Reliability targets computed from data we already record (R1 metrics + the
 *  pipeline timestamps), not a new pipeline:
 *    - processing_success_rate: recordings that reached 'ready' vs 'failed'.
 *    - turnaround_p95_seconds:  p95(generate.finished_at − recording.created_at).
 *  Each objective has a target; the error budget is what's left of (1 − target).
 *  When the budget is burning (failure rate beyond the budget, or p95 over the
 *  bound) we raise an alert through the shared dry-run/webhook channel.
 *
 *  Turnaround is derived from existing timestamps; Track O will later enrich it
 *  with richer ops-turnaround data, but the SLI is real today.
 */
import { q } from '../db/index.js';
import { raiseAlert } from '../lib/alert.js';

const num = (k, d) => Number(process.env[k] ?? d);
const round = (v) => (v == null ? null : Number(Number(v).toFixed(2)));

export async function processingSuccessRate(windowS) {
  const { rows } = await q(
    `SELECT count(*) FILTER (WHERE status='ready')::int AS ready,
            count(*) FILTER (WHERE status='failed')::int AS failed
     FROM recordings
     WHERE created_at >= now() - ($1 || ' seconds')::interval AND status IN ('ready','failed')`,
    [String(windowS)]);
  const { ready, failed } = rows[0];
  const total = ready + failed;
  return { rate: total ? ready / total : null, ready, failed, sample: total };
}

export async function turnaroundP95(windowS) {
  const { rows } = await q(
    `WITH done AS (
       SELECT recording_id, max(finished_at) AS ready_at
       FROM pipeline_jobs WHERE stage='generate' AND status='done' GROUP BY recording_id
     )
     SELECT extract(epoch FROM (d.ready_at - r.created_at)) AS secs
     FROM done d JOIN recordings r ON r.id = d.recording_id
     WHERE d.ready_at >= now() - ($1 || ' seconds')::interval
     ORDER BY secs`,
    [String(windowS)]);
  const secs = rows.map((r) => Number(r.secs)).filter((x) => Number.isFinite(x) && x >= 0);
  if (!secs.length) return { p95: null, sample: 0 };
  return { p95: round(secs[Math.min(secs.length - 1, Math.floor(0.95 * secs.length))]), sample: secs.length };
}

let lastReport = null;
export const sloReport = () => lastReport;
/** /metrics gauge: error-budget burn per objective (>1 means over budget). */
export const sloGauge = () => (lastReport?.objectives || []).map((o) => ({ labels: { objective: o.objective }, value: o.burn ?? 0 }));

/** Compute every objective vs its target + error-budget burn. Fires an alert on
 *  any breach unless opts.alert === false (the read-only endpoint passes false). */
export async function evaluateSlos(opts = {}) {
  const windowS = num('SLO_WINDOW_S', 86400);
  const successTarget = num('SLO_SUCCESS_TARGET', 0.99);
  const turnaroundTarget = num('SLO_TURNAROUND_P95_S', 1800);

  const succ = await processingSuccessRate(windowS);
  const ta = await turnaroundP95(windowS);
  const objectives = [
    { objective: 'processing_success_rate', sli: succ.rate == null ? null : round(succ.rate), target: successTarget, unit: 'ratio', sample: succ.sample,
      breached: succ.rate != null && succ.rate < successTarget,
      burn: succ.rate == null ? null : round((1 - succ.rate) / Math.max(1e-9, 1 - successTarget)) },
    { objective: 'turnaround_p95_seconds', sli: ta.p95, target: turnaroundTarget, unit: 'seconds', sample: ta.sample,
      breached: ta.p95 != null && ta.p95 > turnaroundTarget,
      burn: ta.p95 == null ? null : round(ta.p95 / turnaroundTarget) },
  ];
  const breaches = objectives.filter((o) => o.breached);
  lastReport = { windowS, objectives, breached: breaches.length > 0 };

  const alertEnabled = (process.env.SLO_BURN_ALERT ?? 'true') !== 'false';
  if (breaches.length && alertEnabled && opts.alert !== false) {
    await raiseAlert('slo.breach', { breaches: breaches.map((b) => ({ objective: b.objective, sli: b.sli, target: b.target, burn: b.burn, sample: b.sample })) });
  }
  return lastReport;
}
