/** Stage B3 — Pipeline orchestration: transcribe → analyze → score → generate. */
import { Router } from 'express';
const r = Router();

// GET /api/jobs — ops dashboard: processing status board
r.get('/', (_req, res) => {
  // TODO(B3): join recordings + pipeline_jobs, return per-stage progress
  res.json({ jobs: [] });
});

// GET /api/jobs/:id — single job with stage timeline (mirrors PIPELINE_STAGES in the frontend)
r.get('/:id', (req, res) => {
  // TODO(B3): stages: transcribe, analyze, moments, score, generate
  res.json({ id: req.params.id, stages: [], status: 'pending' });
});

// POST /api/jobs/:id/retry — ops action
r.post('/:id/retry', (req, res) => {
  // TODO(B3): re-enqueue failed stage
  res.status(202).json({ id: req.params.id, status: 'requeued' });
});

export default r;
