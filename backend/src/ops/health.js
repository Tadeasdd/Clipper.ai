/** O3 — client health & lifecycle.
 *
 *  A client's lifecycle stage (onboarding → active → at_risk → churned) is an
 *  operator-owned workflow field on clients; everything else here is COMPUTED
 *  from real activity, never set by hand:
 *    - onboarding: a checklist derived from real state (plan, a live platform
 *      connection, content submitted, a clip delivered);
 *    - health score (0–100): the mean of whatever sub-signals have data —
 *      approval rate, turnaround-within-SLA, realized performance (retention),
 *      and submission recency — so a brand-new client scores null, not zero;
 *    - churn signals: concrete reasons (inactive, low approval, SLA breaches),
 *      which flag the client at-risk regardless of the stored stage.
 *
 *  Importable + offline-testable (like ops/slo.js, ops/sla.js, ops/capacity.js).
 */
import { q } from '../db/index.js';

const num = (k, d) => Number(process.env[k] ?? d);
const INACTIVE_DAYS = num('CHURN_INACTIVE_DAYS', 21);
const DEFAULT_SLA_HOURS = num('SLA_DEFAULT_HOURS', 72);
const LOW_APPROVAL = num('CHURN_LOW_APPROVAL', 0.5);
const round = (v) => (v == null ? null : Number(Number(v).toFixed(1)));
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Onboarding checklist for one client, computed from real state. */
async function onboarding(client) {
  const { rows } = await q(`
    SELECT
      EXISTS(SELECT 1 FROM platform_connections WHERE client_id = $1 AND status = 'active') AS platform_connected,
      EXISTS(SELECT 1 FROM recordings WHERE client_id = $1) AS content_submitted,
      EXISTS(SELECT 1 FROM clips cl JOIN recordings r ON r.id = cl.recording_id
             WHERE r.client_id = $1 AND cl.status IN ('approved','scheduled','published')) AS first_clip_delivered`,
    [client.id]);
  const s = rows[0];
  const steps = [
    { key: 'plan_selected', done: !!client.plan },
    { key: 'platform_connected', done: s.platform_connected },
    { key: 'content_submitted', done: s.content_submitted },
    { key: 'first_clip_delivered', done: s.first_clip_delivered },
  ];
  const done = steps.filter((x) => x.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}

/** Full health + lifecycle picture for one client. */
export async function clientHealth(clientId) {
  const { rows: cr } = await q(
    'SELECT id, name, plan, lifecycle_stage, onboarded_at, created_at FROM clients WHERE id = $1', [clientId]);
  if (!cr.length) return null;
  const client = cr[0];

  const ob = await onboarding(client);

  // approval rate: internal verdicts on this client's clips
  const { rows: ap } = await q(`
    SELECT count(*) FILTER (WHERE e.decision = 'approve')::int AS approve, count(*)::int AS total
    FROM review_events e
    JOIN users u ON u.id = e.reviewer_id AND u.role <> 'client'
    JOIN clips cl ON cl.id = e.clip_id
    JOIN recordings r ON r.id = cl.recording_id
    WHERE r.client_id = $1 AND e.decision IN ('approve','reject','changes')`, [clientId]);
  const verdicts = ap[0].total;
  const approvalRate = verdicts ? ap[0].approve / verdicts : null;

  // turnaround: share of recent deliveries within the plan SLA (+ late count)
  const { rows: ta } = await q(`
    WITH sla AS (SELECT COALESCE((SELECT sla_hours FROM plans WHERE name = $2), $3) AS hours),
    fd AS (
      SELECT r.id, r.created_at, min(pj.published_at) AS delivered_at
      FROM recordings r
      JOIN clips cl ON cl.recording_id = r.id
      JOIN publish_jobs pj ON pj.clip_id = cl.id AND pj.status = 'published'
      WHERE r.client_id = $1 AND pj.published_at >= now() - interval '90 days'
      GROUP BY r.id, r.created_at)
    SELECT (SELECT hours FROM sla) AS sla_hours,
           count(*)::int AS delivered,
           count(*) FILTER (WHERE extract(epoch FROM (delivered_at - created_at)) / 3600.0 <= (SELECT hours FROM sla))::int AS within,
           count(*) FILTER (WHERE extract(epoch FROM (delivered_at - created_at)) / 3600.0 > (SELECT hours FROM sla))::int AS late
    FROM fd`, [clientId, client.plan, DEFAULT_SLA_HOURS]);
  const slaHours = Number(ta[0].sla_hours);
  const delivered = ta[0].delivered;
  const turnaroundScore = delivered ? (ta[0].within / delivered) * 100 : null;

  // overdue in-flight (past SLA, undelivered) — a live breach
  const { rows: ov } = await q(`
    SELECT count(*)::int AS overdue FROM recordings r
    WHERE r.client_id = $1 AND r.status <> 'failed'
      AND extract(epoch FROM (now() - r.created_at)) / 3600.0 > $2
      AND NOT EXISTS (SELECT 1 FROM clips cl JOIN publish_jobs pj ON pj.clip_id = cl.id AND pj.status = 'published'
                      WHERE cl.recording_id = r.id)`, [clientId, slaHours]);
  const overdue = ov[0].overdue;

  // performance: avg retention of the latest capture per published post
  const { rows: pf } = await q(`
    SELECT avg(latest.retention) AS retention FROM (
      SELECT DISTINCT ON (m.publish_id) m.retention
      FROM clip_metrics m
      JOIN publish_jobs pj ON pj.id = m.publish_id AND pj.status = 'published'
      JOIN clips cl ON cl.id = pj.clip_id
      JOIN recordings r ON r.id = cl.recording_id
      WHERE r.client_id = $1 AND m.retention IS NOT NULL
      ORDER BY m.publish_id, m.captured_at DESC) latest`, [clientId]);
  const performanceScore = pf[0].retention == null ? null : clamp(Number(pf[0].retention) * 100);

  // activity: recency of last submission
  const { rows: ac } = await q(
    `SELECT extract(epoch FROM (now() - max(created_at))) / 86400.0 AS days FROM recordings WHERE client_id = $1`, [clientId]);
  const daysSinceLast = ac[0].days == null ? null : Number(ac[0].days);
  const activityScore = daysSinceLast == null ? null : clamp(100 * (1 - daysSinceLast / INACTIVE_DAYS));

  const sub = {
    approval: approvalRate == null ? null : clamp(approvalRate * 100),
    turnaround: turnaroundScore == null ? null : clamp(turnaroundScore),
    performance: performanceScore,
    activity: activityScore,
  };
  const present = Object.values(sub).filter((v) => v != null);
  const score = present.length ? clamp(mean(present)) : null;

  // churn signals — concrete, named reasons
  const reasons = [];
  if (daysSinceLast != null && daysSinceLast > INACTIVE_DAYS) reasons.push('inactive');
  if (approvalRate != null && verdicts >= 4 && approvalRate < LOW_APPROVAL) reasons.push('low_approval');
  if (ta[0].late + overdue > 0) reasons.push('sla_breaches');
  if (score != null && score < 50) reasons.push('low_health');
  const atRisk = reasons.length > 0;

  const recommendedStage = !ob.complete ? 'onboarding'
    : (daysSinceLast != null && daysSinceLast > INACTIVE_DAYS * 2) ? 'churned'
      : atRisk ? 'at_risk' : 'active';

  return {
    clientId: client.id, name: client.name, plan: client.plan,
    stage: client.lifecycle_stage, recommendedStage, onboardedAt: client.onboarded_at,
    onboarding: ob,
    score,
    subscores: sub,
    detail: { verdicts, approvalRate: approvalRate == null ? null : Number(approvalRate.toFixed(2)), delivered, slaHours, late: ta[0].late, overdue, daysSinceLast: round(daysSinceLast) },
    churn: { atRisk, reasons },
  };
}

/** Health + lifecycle for every client (the ops panel). Sorted at-risk first,
 *  then by ascending score (worst-attention-needed on top). */
export async function healthOverview() {
  const { rows } = await q('SELECT id FROM clients ORDER BY created_at DESC');
  const clients = [];
  for (const c of rows) {
    const h = await clientHealth(c.id);
    if (h) clients.push(h);
  }
  clients.sort((a, b) =>
    Number(b.churn.atRisk) - Number(a.churn.atRisk) ||
    (a.score ?? 101) - (b.score ?? 101));
  return {
    clients,
    totals: {
      atRisk: clients.filter((c) => c.churn.atRisk).length,
      onboarding: clients.filter((c) => c.stage === 'onboarding').length,
      active: clients.filter((c) => c.stage === 'active').length,
    },
  };
}
