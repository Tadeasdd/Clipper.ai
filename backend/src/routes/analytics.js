/** Stage B6 — Performance measurement + feedback loop into scoring. */
import { Router } from 'express';
const r = Router();

// GET /api/analytics/clients/:id — client-facing report data
r.get('/clients/:id', (req, res) => {
  // TODO(B6): aggregate views/retention/follows per clip → weekly report payload
  res.json({ clientId: req.params.id, period: 'last_30d', clips: [], totals: {} });
});

// GET /api/analytics/ops — internal: model hit-rate, approval rate, turnaround SLAs
r.get('/ops', (_req, res) => {
  // TODO(B6): scoring-model precision vs. published performance (the optimization loop)
  res.json({ approvalRate: null, medianTurnaroundHours: null, scoreCorrelation: null });
});

export default r;
