/** Stage B5 — Publishing queue: scheduled, per-platform, with client sign-off honored. */
import { Router } from 'express';
const r = Router();

// GET /api/publish/queue — ops dashboard: what ships next, per client/platform
r.get('/queue', (_req, res) => {
  // TODO(B5): scheduled posts joined with platform connection health
  res.json({ items: [] });
});

// POST /api/publish  { clipId, platform, scheduledAt }
r.post('/', (req, res) => {
  const { clipId, platform } = req.body || {};
  if (!clipId || !platform) return res.status(400).json({ error: 'clipId and platform required' });
  // TODO(B5): enqueue publish job via platform adapter (youtube|tiktok|instagram|linkedin|x)
  res.status(202).json({ clipId, platform, status: 'scheduled' });
});

export default r;
