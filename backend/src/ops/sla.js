/** O1 — SLA / turnaround tracking.
 *
 *  The service sells fast, consistent delivery; this measures it. Turnaround is
 *  submit → deliver: a recording's created_at to the moment its FIRST clip went
 *  live (publish_jobs.published_at). Each client is held to its plan's SLA target
 *  (migration 017; plan-less clients fall back to SLA_DEFAULT_HOURS), and two
 *  kinds of breach are surfaced:
 *    - late:    a delivered recording whose turnaround exceeded the target;
 *    - overdue: an in-flight recording still undelivered past its target — the
 *               actionable one, since ops can still save it.
 *
 *  Derived entirely from timestamps we already record — no new pipeline. Pairs
 *  with R4's org-level SLO turnaround (analytics surfaces both together).
 */
import { q } from '../db/index.js';

const num = (k, d) => Number(process.env[k] ?? d);
const round = (v) => (v == null ? null : Number(Number(v).toFixed(2)));

export const defaultSlaHours = () => num('SLA_DEFAULT_HOURS', 72);

/** Per-client submit→deliver turnaround vs the plan SLA, over a trailing window.
 *  Returns one row per client that has either a delivery or an overdue in-flight
 *  recording in the window, sorted worst-first (breaching clients on top). */
export async function turnaroundByClient(windowDays = num('SLA_WINDOW_DAYS', 30)) {
  const win = String(Math.max(1, windowDays));
  const fallback = defaultSlaHours();

  // Delivered turnaround per recording: created_at → first published clip.
  const { rows: delivered } = await q(`
    WITH first_delivery AS (
      SELECT r.id, r.client_id, r.created_at, min(pj.published_at) AS delivered_at
      FROM recordings r
      JOIN clips cl ON cl.recording_id = r.id
      JOIN publish_jobs pj ON pj.clip_id = cl.id AND pj.status = 'published'
      WHERE pj.published_at >= now() - ($1 || ' days')::interval
      GROUP BY r.id, r.client_id, r.created_at
    )
    SELECT c.id AS client_id, c.name AS client, c.plan,
           COALESCE(p.sla_hours, $2) AS sla_hours,
           count(fd.id)::int AS delivered,
           percentile_cont(0.5)  WITHIN GROUP (ORDER BY extract(epoch FROM (fd.delivered_at - fd.created_at)) / 3600.0) AS median_h,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (fd.delivered_at - fd.created_at)) / 3600.0) AS p95_h,
           max(extract(epoch FROM (fd.delivered_at - fd.created_at)) / 3600.0) AS worst_h,
           count(*) FILTER (
             WHERE extract(epoch FROM (fd.delivered_at - fd.created_at)) / 3600.0 > COALESCE(p.sla_hours, $2)
           )::int AS late
    FROM clients c
    LEFT JOIN plans p ON p.name = c.plan
    JOIN first_delivery fd ON fd.client_id = c.id
    GROUP BY c.id, c.name, c.plan, p.sla_hours`,
    [win, fallback]);

  // Overdue in-flight: recordings still processing/queued, not yet delivered,
  // already past their SLA target (the breaches ops can still act on).
  const { rows: overdue } = await q(`
    SELECT c.id AS client_id, c.name AS client, c.plan,
           COALESCE(p.sla_hours, $1) AS sla_hours,
           count(*)::int AS overdue,
           max(extract(epoch FROM (now() - r.created_at)) / 3600.0) AS oldest_h
    FROM recordings r
    JOIN clients c ON c.id = r.client_id
    LEFT JOIN plans p ON p.name = c.plan
    WHERE r.status NOT IN ('failed')
      AND extract(epoch FROM (now() - r.created_at)) / 3600.0 > COALESCE(p.sla_hours, $1)
      AND NOT EXISTS (
        SELECT 1 FROM clips cl JOIN publish_jobs pj ON pj.clip_id = cl.id AND pj.status = 'published'
        WHERE cl.recording_id = r.id
      )
    GROUP BY c.id, c.name, c.plan, p.sla_hours`,
    [fallback]);

  // Merge the two views into one per-client picture.
  const byId = new Map();
  for (const d of delivered) {
    byId.set(d.client_id, {
      clientId: d.client_id, client: d.client, plan: d.plan,
      slaHours: Number(d.sla_hours),
      delivered: d.delivered,
      medianHours: round(d.median_h), p95Hours: round(d.p95_h), worstHours: round(d.worst_h),
      late: d.late, overdue: 0, oldestOverdueHours: null,
    });
  }
  for (const o of overdue) {
    const row = byId.get(o.client_id) || {
      clientId: o.client_id, client: o.client, plan: o.plan,
      slaHours: Number(o.sla_hours),
      delivered: 0, medianHours: null, p95Hours: null, worstHours: null, late: 0,
    };
    row.overdue = o.overdue;
    row.oldestOverdueHours = round(o.oldest_h);
    byId.set(o.client_id, row);
  }

  const clients = [...byId.values()].map((r) => ({
    ...r, breaches: r.late + r.overdue, breached: r.late + r.overdue > 0,
  }));
  // Worst first: breaching clients on top, then by overdue, then by p95.
  clients.sort((a, b) =>
    Number(b.breached) - Number(a.breached) ||
    b.overdue - a.overdue ||
    (b.p95Hours ?? -1) - (a.p95Hours ?? -1));

  return {
    windowDays: Math.max(1, windowDays),
    defaultSlaHours: fallback,
    clients,
    totals: {
      breachingClients: clients.filter((c) => c.breached).length,
      late: clients.reduce((s, c) => s + c.late, 0),
      overdue: clients.reduce((s, c) => s + c.overdue, 0),
    },
  };
}
