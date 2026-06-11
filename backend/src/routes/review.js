/** Stage B4 — Human QA workflow: nothing ships without a reviewer (and client) decision. */
import { Router } from 'express';
const r = Router();

// GET /api/review/queue — reviewer worklist
r.get('/queue', (_req, res) => {
  // TODO(B4): clips WHERE status = 'awaiting_review' ordered by client SLA
  res.json({ items: [] });
});

// POST /api/review/:clipId/decision  { decision: 'approve'|'reject'|'changes', notes }
r.post('/:clipId/decision', (req, res) => {
  const { decision } = req.body || {};
  if (!['approve', 'reject', 'changes'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approve | reject | changes' });
  }
  // TODO(B4): write review_events row; approve → client_approval or publish queue
  res.json({ clipId: req.params.clipId, decision, status: 'recorded' });
});

export default r;
