/** Stage B3/B4 — clip candidates and their evidence. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { objectInfo, localPathFor } from '../storage/index.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { validate, paginate } from '../lib/validate.js';

const r = Router();

/** Tenant-scoped clip lookup (S4 IDOR guard): returns the requested columns
 *  only if the clip is visible to the caller — internal roles see any clip;
 *  client users see only clips under their own client. A wrong-tenant id is
 *  therefore indistinguishable from a missing one (the caller gets 404, never a
 *  403 that would confirm the clip exists). */
async function scopedClip(user, clipId, cols = 'cl.id') {
  const scope = user.role === 'client' ? 'AND rec.client_id = $2' : '';
  const params = user.role === 'client' ? [clipId, user.client_id] : [clipId];
  const { rows } = await q(
    `SELECT ${cols} FROM clips cl JOIN recordings rec ON rec.id = cl.recording_id
     WHERE cl.id = $1 ${scope}`, params);
  return rows[0] || null;
}

// GET /api/clips?recordingId=&status= — scored candidates with signals.
r.get('/', requireAuth(), async (req, res, next) => {
  try {
    const { recordingId, status } = req.query;
    const cond = [], params = [];
    if (recordingId) { params.push(recordingId); cond.push(`cl.recording_id = $${params.length}`); }
    if (status) { params.push(status); cond.push(`cl.status = $${params.length}`); }
    if (req.user.role === 'client') {
      params.push(req.user.client_id);
      cond.push(`rec.client_id = $${params.length}`); // own data only — the B7 criterion
    }
    const { limit, offset } = paginate(req, { def: 200, max: 200 });
    params.push(limit, offset);
    const { rows } = await q(
      `SELECT cl.* FROM clips cl JOIN recordings rec ON rec.id = cl.recording_id
       ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       ORDER BY cl.score DESC NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ clips: rows });
  } catch (e) { next(e); }
});

// GET /api/clips/:id/asset — stream the rendered mp4 (ops preview, F4).
// Local driver serves from disk; the s3 driver path would 302 to a presigned
// GET once that's needed.
r.get('/:id/asset', requireAuth(), async (req, res, next) => {
  try {
    // Authorized, not just authenticated: the scoped lookup gates the stream —
    // another client's id (or a guessed one) returns 404 before any bytes flow.
    const clip = await scopedClip(req.user, req.params.id, 'cl.asset_key');
    if (!clip) return res.status(404).json({ error: 'unknown clip' });
    if (!clip.asset_key) return res.status(409).json({ error: 'clip not rendered yet' });
    const info = await objectInfo(clip.asset_key);
    if (!info) return res.status(410).json({ error: 'asset missing from storage' });
    res.sendFile(await localPathFor(clip.asset_key), {
      headers: { 'content-type': 'video/mp4' },
    });
  } catch (e) { next(e); }
});

// PATCH /api/clips/:id — editors adjust hook/captions before review (B4).
r.patch('/:id', requireAuth(...INTERNAL), validate({
  hook: { type: 'string', maxLength: 300 },
  captions: { type: 'string', maxLength: 20000 },
}), async (req, res, next) => {
  try {
    const { hook, captions } = req.body || {};
    const { rows } = await q(
      `UPDATE clips SET hook = COALESCE($2, hook), captions = COALESCE($3, captions)
       WHERE id = $1 RETURNING *`,
      [req.params.id, hook ?? null, captions ?? null]);
    if (!rows.length) return res.status(404).json({ error: 'unknown clip' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// GET /api/clips/:id/metrics — the B6 capture series, grouped per platform.
// Latest-first inside each platform; the ops detail and F5 read this.
r.get('/:id/metrics', requireAuth(), async (req, res, next) => {
  try {
    // Scoped lookup: a wrong-tenant clip id is a 404, never a 403 that leaks it.
    if (!(await scopedClip(req.user, req.params.id))) return res.status(404).json({ error: 'unknown clip' });
    const { rows } = await q(`
      SELECT pj.platform, pj.external_url, m.captured_at, m.views, m.watch_time_s,
             m.retention, m.likes, m.comments, m.shares, m.follows
      FROM clip_metrics m
      JOIN publish_jobs pj ON pj.id = m.publish_id
      WHERE pj.clip_id = $1
      ORDER BY pj.platform, m.captured_at DESC`, [req.params.id]);
    const platforms = {};
    const num = (v) => (v === null ? null : Number(v));
    for (const row of rows) {
      (platforms[row.platform] ||= { externalUrl: row.external_url, series: [] })
        .series.push({ capturedAt: row.captured_at, views: num(row.views), watchTimeS: num(row.watch_time_s),
                       retention: num(row.retention), likes: num(row.likes), comments: num(row.comments),
                       shares: num(row.shares), follows: num(row.follows) });
    }
    res.json({ clipId: req.params.id, platforms });
  } catch (e) { next(e); }
});

export default r;
