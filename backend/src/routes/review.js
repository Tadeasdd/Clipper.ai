/** Stage B4 — the human review workflow. Nothing ships without sign-off.
 *
 *  The status machine lives in the clips CHECK constraint (001); this route
 *  drives it. Every transition is one atomic statement: a CTE moves the clip
 *  only if it's in the expected state AND writes the review_events audit row
 *  in the same breath — concurrent reviewers can't double-decide.
 *
 *    candidate ──(generate)──► awaiting_review
 *    awaiting_review ──approve──► approved_internal ──send──► awaiting_client
 *                  └─changes──► changes_requested ──resubmit──► awaiting_review
 *                  └─reject───► rejected
 *    awaiting_client ──client approve──► approved   (B5 publishes from here)
 *                   └─client changes──► changes_requested
 *                   └─client reject───► rejected
 *
 *  The FAQ promise is honored in one place: an internal approve goes straight
 *  to 'approved' ONLY if the client opted into auto-publish
 *  (clients.brand_config.auto_publish = true); otherwise it must pass through
 *  the client's own queue. B7: identity comes from the session — req.user is
 *  who decided, and the audit trail is attributable by construction.
 */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { autoScheduleApproved } from '../publish/index.js';
import { assignClip, balanceAssignments, leastLoadedReviewer } from '../ops/capacity.js';
import { notify } from '../notify/index.js';
import { audit } from '../lib/audit.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { validate, paginate } from '../lib/validate.js';

const r = Router();
const DECISIONS = ['approve', 'reject', 'changes'];
const notesOnly = { notes: { type: 'string', maxLength: 4000 } };

/** Load clip + its recording's client (incl. brand_config) in one query. */
async function clipContext(clipId) {
  const { rows } = await q(`
    SELECT cl.id, cl.status, cl.recording_id, r.client_id, c.name AS client_name,
           c.brand_config
    FROM clips cl
    JOIN recordings r ON r.id = cl.recording_id
    JOIN clients c ON c.id = r.client_id
    WHERE cl.id = $1`, [clipId]);
  return rows[0] || null;
}

/** Atomic transition: move the clip iff it's in `from`, audit in the same
 *  statement. Returns the event row, or null if the clip wasn't in `from`
 *  (someone else got there first, or the caller is out of order). */
async function transition(clipId, from, to, reviewerId, decision, notes) {
  const { rows } = await q(`
    WITH moved AS (
      UPDATE clips SET status = $3 WHERE id = $1 AND status = $2 RETURNING id
    )
    INSERT INTO review_events (id, clip_id, reviewer_id, decision, notes)
    SELECT $4, id, $5, $6, $7 FROM moved
    RETURNING id, decision, notes, created_at`,
    [clipId, from, to, id('rev'), reviewerId, decision, notes || null]);
  return rows[0] || null;
}

const conflict = (res, clip) =>
  res.status(409).json({ error: `clip is '${clip.status}' — not reviewable in this state`, status: clip.status });

// GET /api/review/queue?status=&clientId= — the worklists.
//   default 'awaiting_review' (reviewers) · 'changes_requested' (editors)
//   'approved_internal' (account managers) · 'awaiting_client' (client portal, F5)
// Oldest first: until clients carry an SLA field, age IS the SLA order.
r.get('/queue', requireAuth(), async (req, res, next) => {
  try {
    let status = req.query.status || 'awaiting_review';
    let clientId = req.query.clientId;
    if (req.user.role === 'client') {
      // client users see exactly one worklist: their own sign-off queue (F5)
      status = 'awaiting_client';
      clientId = req.user.client_id;
    }
    if (!['awaiting_review', 'changes_requested', 'approved_internal', 'awaiting_client'].includes(status)) {
      return res.status(400).json({ error: 'unreviewable status' });
    }
    const params = [status];
    const conds = [];
    if (clientId) { params.push(clientId); conds.push(`r.client_id = $${params.length}`); }
    // O2: filter a worklist to one owner ('unassigned' for the backlog).
    const assignedTo = req.user.role === 'client' ? undefined : req.query.assignedTo;
    if (assignedTo === 'unassigned') {
      conds.push('cl.assigned_to IS NULL');
    } else if (assignedTo) {
      params.push(assignedTo); conds.push(`cl.assigned_to = $${params.length}`);
    }
    const filterCond = conds.length ? `AND ${conds.join(' AND ')}` : '';
    const { limit, offset } = paginate(req, { def: 200, max: 200 });
    params.push(limit, offset);
    const { rows } = await q(`
      SELECT cl.id, cl.recording_id, cl.t_start_s, cl.t_end_s, cl.score, cl.signals,
             cl.hook, cl.captions, cl.format, cl.asset_key IS NOT NULL AS rendered,
             cl.status, cl.created_at, cl.assigned_to, au.email AS assignee_email,
             r.client_id, c.name AS client_name, r.kind
      FROM clips cl
      JOIN recordings r ON r.id = cl.recording_id
      JOIN clients c ON c.id = r.client_id
      LEFT JOIN users au ON au.id = cl.assigned_to
      WHERE cl.status = $1 ${filterCond}
      ORDER BY cl.created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ status, items: rows });
  } catch (e) { next(e); }
});

// GET /api/review/:clipId/history — the audit trail for one clip.
r.get('/:clipId/history', requireAuth(), async (req, res, next) => {
  try {
    if (req.user.role === 'client') {
      const clip = await clipContext(req.params.clipId);
      // S4: another client's clip id is a 404, not a 403 — don't confirm it exists.
      if (!clip || clip.client_id !== req.user.client_id) {
        return res.status(404).json({ error: 'unknown clip' });
      }
    }
    const { rows } = await q(`
      SELECT e.id, e.decision, e.notes, e.created_at, u.email AS reviewer_email, u.role AS reviewer_role
      FROM review_events e JOIN users u ON u.id = e.reviewer_id
      WHERE e.clip_id = $1 ORDER BY e.created_at ASC`, [req.params.clipId]);
    res.json({ clipId: req.params.clipId, events: rows });
  } catch (e) { next(e); }
});

// POST /api/review/:clipId/decision { decision, notes? }
// Role-aware (the "single API, role-gated" principle): internal roles decide
// from awaiting_review; client users decide from awaiting_client — and only
// for their own clips. The decider is the session user — attributable by
// construction (the B7 done-criterion).
r.post('/:clipId/decision', requireAuth(), validate({
  decision: { type: 'string', required: true, enum: DECISIONS },
  ...notesOnly,
}), async (req, res, next) => {
  try {
    const { decision, notes } = req.body || {};
    if (!DECISIONS.includes(decision)) {
      return res.status(400).json({ error: 'decision must be approve | reject | changes' });
    }
    const u = req.user;
    const clip = await clipContext(req.params.clipId);
    if (!clip) return res.status(404).json({ error: 'unknown clip' });

    let from, to, autoPublished = false;
    if (u.role === 'client') {
      // S4: deciding on another client's clip id is a 404 — no existence leak.
      if (u.client_id !== clip.client_id) {
        return res.status(404).json({ error: 'unknown clip' });
      }
      from = 'awaiting_client';
      to = { approve: 'approved', changes: 'changes_requested', reject: 'rejected' }[decision];
    } else {
      from = 'awaiting_review';
      if (decision === 'approve') {
        // The FAQ promise, enforced here: client sign-off unless they opted out.
        autoPublished = clip.brand_config?.auto_publish === true;
        to = autoPublished ? 'approved' : 'approved_internal';
      } else {
        to = decision === 'changes' ? 'changes_requested' : 'rejected';
      }
    }

    const event = await transition(clip.id, from, to, u.id, decision, notes);
    if (!event) return conflict(res, await clipContext(clip.id));
    // B5: a clip that just reached 'approved' is the service's to ship —
    // schedule it now on every platform the client has connected. Best-effort:
    // a scheduling hiccup never rolls back the decision.
    const scheduled = to === 'approved' ? await autoScheduleApproved(clip.id, u.id) : [];
    // O5: the decision lands in the activity feed; a client's own sign-off is
    // visible to them, internal QA steps are not.
    await audit('review', 'review_decision', {
      actorId: u.id, actorRole: u.role, clientId: clip.client_id, entityType: 'clip', entityId: clip.id,
      summary: `${u.role === 'client' ? 'Client' : 'Reviewer'} ${decision} → ${to}`,
      meta: { decision, from, to }, clientVisible: u.role === 'client' });
    res.json({ clipId: clip.id, from, to, autoPublished, scheduled, event });
  } catch (e) { next(e); }
});

// POST /api/review/:clipId/send { userId } — route an internally-approved clip
// into the client's queue (the account-manager step between QA and sign-off).
r.post('/:clipId/send', requireAuth(...INTERNAL), validate(notesOnly), async (req, res, next) => {
  try {
    const u = req.user;
    const clip = await clipContext(req.params.clipId);
    if (!clip) return res.status(404).json({ error: 'unknown clip' });
    const event = await transition(clip.id, 'approved_internal', 'awaiting_client', u.id, 'send_to_client', req.body?.notes);
    if (!event) return conflict(res, await clipContext(clip.id));
    // O4: the clip is now in the client's sign-off queue — tell them (best-effort).
    await notify('ready_for_approval', { clientId: clip.client_id, clipId: clip.id });
    res.json({ clipId: clip.id, from: 'approved_internal', to: 'awaiting_client', event });
  } catch (e) { next(e); }
});

// POST /api/review/:clipId/resubmit { userId } — an editor fixed the hook /
// captions (PATCH /api/clips/:id) and puts the clip back in the review queue.
r.post('/:clipId/resubmit', requireAuth(...INTERNAL), validate(notesOnly), async (req, res, next) => {
  try {
    const u = req.user;
    const clip = await clipContext(req.params.clipId);
    if (!clip) return res.status(404).json({ error: 'unknown clip' });
    const event = await transition(clip.id, 'changes_requested', 'awaiting_review', u.id, 'resubmit', req.body?.notes);
    if (!event) return conflict(res, await clipContext(clip.id));
    res.json({ clipId: clip.id, from: 'changes_requested', to: 'awaiting_review', event });
  } catch (e) { next(e); }
});

// POST /api/review/assign/balance — O2: spread the unassigned awaiting_review
// backlog across the reviewer/editor pool, least-loaded-first. Ops action.
// (Registered before /:clipId/assign so 'assign' is never read as a clip id.)
r.post('/assign/balance', requireAuth('ops', 'account_manager'), async (_req, res, next) => {
  try { res.json(await balanceAssignments()); } catch (e) { next(e); }
});

// POST /api/review/:clipId/assign { userId? } — O2: assign one clip's review to a
// reviewer/editor; with no userId, auto-pick the least-loaded. Orthogonal to the
// status machine (sets assigned_to only). 409 if the clip isn't assignable.
r.post('/:clipId/assign', requireAuth(...INTERNAL), validate({ userId: { type: 'string', maxLength: 80 } }),
  async (req, res, next) => {
    try {
      const userId = req.body?.userId || await leastLoadedReviewer();
      if (!userId) return res.status(409).json({ error: 'no reviewer/editor available to assign' });
      const result = await assignClip(req.params.clipId, userId);
      if (!result.ok) {
        const code = result.reason === 'clip is not in an assignable state' ? 409 : 400;
        return res.status(code).json({ error: result.reason });
      }
      res.json({ clipId: req.params.clipId, assigned: true, assignee: result.assignee });
    } catch (e) { next(e); }
  });

export default r;
