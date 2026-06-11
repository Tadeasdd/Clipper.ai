/** Stage B2 — Intake: clients submit long-form (file or URL). Ops queue is fed from here. */
import { Router } from 'express';
const r = Router();

// POST /api/intake  { clientId, sourceUrl? } — or multipart upload (TODO: presigned S3 in B2)
r.post('/', (req, res) => {
  const { clientId, sourceUrl } = req.body || {};
  if (!clientId) return res.status(400).json({ error: 'clientId required' });
  // TODO(B2): create recordings row, presign upload, enqueue ingest job
  res.status(202).json({ recordingId: 'rec_stub', clientId, sourceUrl: sourceUrl || null, status: 'queued' });
});

// GET /api/intake/queue — ops dashboard: incoming content queue
r.get('/queue', (_req, res) => {
  // TODO(B2): SELECT * FROM recordings WHERE status IN ('queued','ingesting') ORDER BY created_at
  res.json({ items: [] });
});

export default r;
