/** O2 — capacity & workload planning.
 *
 *  Human reviewers/editors are the throughput constraint. This assigns review
 *  work across them, keeps it balanced, and forecasts how long the current
 *  backlog will take to clear at the measured rate.
 *
 *  Assignment is ORTHOGONAL to the status machine: assigned_to is set by a plain
 *  UPDATE guarded on an assignable status — it never moves a clip's status, so
 *  the atomic transition CTEs in routes/review.js are untouched. "Open" work for
 *  a person is clips they own that still need action (awaiting_review for
 *  reviewers, changes_requested for editors).
 *
 *  Importable + offline-testable (like ops/slo.js, ops/sla.js): routes call in.
 */
import { q } from '../db/index.js';

const num = (k, d) => Number(process.env[k] ?? d);
// The human-QA pool. ops/account_manager are admin/routing, not the constraint.
export const REVIEW_ROLES = ['reviewer', 'editor'];
// Statuses where an assigned clip still needs its owner's action.
const OPEN_STATUSES = ['awaiting_review', 'changes_requested'];

/** Assign one clip to one reviewer/editor. Atomic + guarded: the assignee must
 *  be a review-role user and the clip must be in an assignable (open) state.
 *  Returns { ok, reason?, assignee? }. Never touches clips.status. */
export async function assignClip(clipId, userId) {
  const { rows: u } = await q('SELECT id, email, role FROM users WHERE id = $1', [userId]);
  if (!u.length) return { ok: false, reason: 'unknown user' };
  if (!REVIEW_ROLES.includes(u[0].role)) return { ok: false, reason: `user role '${u[0].role}' is not a reviewer/editor` };
  const { rows } = await q(
    `UPDATE clips SET assigned_to = $2 WHERE id = $1 AND status = ANY($3) RETURNING id, status`,
    [clipId, userId, OPEN_STATUSES]);
  if (!rows.length) return { ok: false, reason: 'clip is not in an assignable state' };
  return { ok: true, assignee: { id: u[0].id, email: u[0].email, role: u[0].role }, status: rows[0].status };
}

/** Current open-work load per review-role user (zero-filled for idle staff). */
async function reviewerLoads() {
  const { rows } = await q(
    `SELECT u.id, u.email, u.role,
            count(cl.id) FILTER (WHERE cl.status = ANY($1)) ::int AS open
     FROM users u
     LEFT JOIN clips cl ON cl.assigned_to = u.id
     WHERE u.role = ANY($2)
     GROUP BY u.id, u.email, u.role
     ORDER BY open ASC, u.id ASC`,
    [OPEN_STATUSES, REVIEW_ROLES]);
  return rows.map((r) => ({ id: r.id, email: r.email, role: r.role, open: Number(r.open) }));
}

/** The reviewer/editor with the least open work right now (null if none exist). */
export async function leastLoadedReviewer() {
  const loads = await reviewerLoads();
  return loads[0]?.id || null;
}

/** Spread every UNASSIGNED awaiting_review clip across the pool, always handing
 *  the next one to whoever currently has the least, so loads converge. Returns
 *  how many were assigned + the resulting per-reviewer counts. */
export async function balanceAssignments() {
  const loads = await reviewerLoads();
  if (!loads.length) return { assigned: 0, reviewers: [], reason: 'no reviewers/editors to balance across' };
  const { rows: unassigned } = await q(
    `SELECT id FROM clips WHERE status = 'awaiting_review' AND assigned_to IS NULL ORDER BY created_at ASC`);
  // Always hand the next clip to whoever currently has the least open work.
  let assigned = 0;
  for (const clip of unassigned) {
    loads.sort((a, b) => a.open - b.open || (a.id < b.id ? -1 : 1));
    const pick = loads[0];
    const res = await assignClip(clip.id, pick.id);
    if (res.ok) { pick.open += 1; assigned += 1; }
  }
  return {
    assigned,
    reviewers: loads.sort((a, b) => b.open - a.open).map((l) => ({ id: l.id, email: l.email, open: l.open })),
  };
}

/** Per-reviewer load + throughput, backlog depth, and a clear-time forecast.
 *  forecastHours = awaiting-review backlog ÷ pool throughput (decisions/hour);
 *  null when nothing has been decided in the window (no rate to project). */
export async function workloadForecast(windowDays = num('CAPACITY_WINDOW_DAYS', 7)) {
  const win = Math.max(1, windowDays);

  const loads = await reviewerLoads();
  const { rows: thr } = await q(
    `SELECT u.id, count(e.id)::int AS decisions
     FROM users u
     LEFT JOIN review_events e ON e.reviewer_id = u.id
       AND e.decision IN ('approve','reject','changes')
       AND e.created_at >= now() - ($2 || ' days')::interval
     WHERE u.role = ANY($1)
     GROUP BY u.id`,
    [REVIEW_ROLES, String(win)]);
  const decisionsBy = Object.fromEntries(thr.map((r) => [r.id, Number(r.decisions)]));

  const reviewers = loads.map((l) => ({
    ...l,
    decisions: decisionsBy[l.id] || 0,
    throughputPerDay: Number(((decisionsBy[l.id] || 0) / win).toFixed(2)),
  }));

  const { rows: bk } = await q(`
    SELECT count(*) FILTER (WHERE status = 'awaiting_review')::int AS awaiting_review,
           count(*) FILTER (WHERE status = 'awaiting_review' AND assigned_to IS NULL)::int AS unassigned,
           count(*) FILTER (WHERE status = 'changes_requested')::int AS in_edit
    FROM clips`);
  const backlog = { awaitingReview: bk[0].awaiting_review, unassigned: bk[0].unassigned, inEdit: bk[0].in_edit };

  const totalDecisions = reviewers.reduce((s, r) => s + r.decisions, 0);
  const throughputPerHour = Number((totalDecisions / (win * 24)).toFixed(3));
  const forecastHours = throughputPerHour > 0
    ? Number((backlog.awaitingReview / throughputPerHour).toFixed(1))
    : null;

  return {
    windowDays: win,
    reviewers,
    backlog,
    throughputPerHour,
    forecastHours, // null = no measured rate yet (can't project a clear-time)
  };
}
