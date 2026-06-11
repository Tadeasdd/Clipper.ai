/** Stage B3/B4 — Clip candidates: scored moments + generated short-form assets. */
import { Router } from 'express';
const r = Router();

// GET /api/clips?recordingId=&status= — candidates for a recording
r.get('/', (req, res) => {
  // TODO(B3): return clips with { score, hook, captions, format, status }
  res.json({ clips: [], recordingId: req.query.recordingId || null });
});

// PATCH /api/clips/:id — edit metadata (hook variant, caption, crop) before review
r.patch('/:id', (req, res) => {
  // TODO(B4): persist edits, version the asset
  res.json({ id: req.params.id, ...req.body });
});

export default r;
