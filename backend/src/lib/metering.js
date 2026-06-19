/** E2 — usage metering + plan/quota enforcement.
 *
 *  Clients buy a volume of outcomes, not seats. This meters what they've used
 *  this billing period — delivered clips + minutes of content processed —
 *  against their plan's quota, and decides the behavior at the boundary:
 *  warn (allow + flag), queue (allow but hold, don't process), or block (deny).
 *
 *  Usage is computed live from clips/recordings; nothing to keep in sync.
 *  Unknown/empty plans fall back to a generous default, and the seeded plans
 *  default to 'warn', so offline dev and CI are never blocked.
 */
import { q } from '../db/index.js';

const round = (v) => Number(Number(v || 0).toFixed(3));
const SOFT_PCT = Number(process.env.USAGE_SOFT_PCT || 0.8);
const DEFAULT_PLAN = { name: 'default', clip_quota: 100000, minute_quota: 1000000, limit_policy: 'warn', monthly_price_usd: 0 };

export async function getPlan(name) {
  if (!name) return DEFAULT_PLAN;
  const { rows } = await q('SELECT * FROM plans WHERE name=$1', [name]);
  return rows[0] || DEFAULT_PLAN;
}

/** Outcomes used this calendar month: delivered (rendered) clips + minutes processed. */
export async function usageFor(clientId) {
  const { rows } = await q(`
    WITH month_recs AS (
      SELECT id, duration_s FROM recordings
      WHERE client_id = $1 AND created_at >= date_trunc('month', now())
    )
    SELECT
      COALESCE((SELECT round(sum(duration_s) / 60.0, 1) FROM month_recs), 0) AS minutes,
      COALESCE((SELECT count(*) FROM clips cl JOIN month_recs r ON r.id = cl.recording_id WHERE cl.status <> 'candidate'), 0) AS clips`,
    [clientId]);
  return { clipsDelivered: Number(rows[0].clips), minutesProcessed: Number(rows[0].minutes) };
}

export async function meterStatus(clientId) {
  const { rows } = await q('SELECT plan FROM clients WHERE id = $1', [clientId]);
  const plan = await getPlan(rows[0]?.plan);
  const usage = await usageFor(clientId);
  const clipPct = plan.clip_quota ? usage.clipsDelivered / plan.clip_quota : 0;
  const minPct = plan.minute_quota ? usage.minutesProcessed / plan.minute_quota : 0;
  const pct = round(Math.max(clipPct, minPct));
  const state = pct >= 1 ? 'over' : pct >= SOFT_PCT ? 'warn' : 'ok';
  return {
    plan: plan.name, policy: plan.limit_policy, state, pct,
    usage, quota: { clips: plan.clip_quota, minutes: plan.minute_quota },
    over: { clips: usage.clipsDelivered >= plan.clip_quota, minutes: usage.minutesProcessed >= plan.minute_quota },
  };
}

/** The intake-boundary decision. allow=false → deny (402); hold=true → accept
 *  but don't process (queued for next period); otherwise proceed (warn flagged). */
export async function checkIntake(clientId) {
  const m = await meterStatus(clientId);
  if (m.state === 'over' && m.policy === 'block') return { allow: false, hold: false, reason: 'plan limit reached', ...m };
  if (m.state === 'over' && m.policy === 'queue') return { allow: true, hold: true, reason: 'over quota — held for next period', ...m };
  return { allow: true, hold: false, ...m };
}
