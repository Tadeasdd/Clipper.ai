/** U4 — clip feedback. The real endpoint behind FeedbackWidget, which used to
 *  fake its submit. Public POST (the widget's origin is the marketing/studio
 *  surface, like the leads form), rate-limited + shape-validated; ops-only
 *  listing so the signal is actually inspectable, not write-only. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { rateLimit } from '../lib/ratelimit.js';
import { validate, paginate } from '../lib/validate.js';

const r = Router();

// POST /api/feedback { rating: 'up'|'down', jobId?, note? }
// One public door, so it's rate-limited per IP and shape-validated. The CHECK
// constraint and the enum rule both reject anything but up/down.
r.post('/',
  rateLimit({ name: 'feedback', max: 60 }),
  validate({
    rating: { type: 'string', required: true, enum: ['up', 'down'] },
    jobId: { type: 'string', maxLength: 200 },
    note: { type: 'string', maxLength: 4000 },
  }),
  async (req, res, next) => {
    try {
      const { rating, jobId, note } = req.body || {};
      const fid = id('fb');
      const meta = { ip: req.ip, ua: req.headers['user-agent'] || null };
      await q(
        `INSERT INTO feedback (id, job_id, rating, note, meta) VALUES ($1,$2,$3,$4,$5)`,
        [fid, jobId || null, rating, note || null, meta]);
      res.status(201).json({ id: fid, ok: true });
    } catch (e) { next(e); }
  });

// GET /api/feedback — ops listing. May hold free-form notes, so it's walled to
// internal roles and paginated with a hard cap (same posture as leads).
r.get('/', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { limit, offset } = paginate(req, { def: 100, max: 200 });
    const { rows } = await q(
      'SELECT id, job_id, rating, note, created_at FROM feedback ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]);
    res.json({ feedback: rows });
  } catch (e) { next(e); }
});

export default r;
