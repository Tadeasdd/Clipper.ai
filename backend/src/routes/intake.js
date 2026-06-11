/** Stage B2 — Intake: clients submit long-form by URL or file upload.
 *  Every submission creates a recordings row that feeds the ops queue. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { createUploadTarget, saveStream, objectInfo } from '../storage/index.js';

const r = Router();

// POST /api/intake
//   { clientId, sourceUrl }              → queued immediately (B3 ingest pulls it)
//   { clientId, filename, kind? }        → awaiting_upload + an upload target
r.post('/', async (req, res, next) => {
  try {
    const { clientId, sourceUrl, filename, kind } = req.body || {};
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    if (!sourceUrl && !filename) return res.status(400).json({ error: 'sourceUrl or filename required' });
    const client = await q('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (!client.rowCount) return res.status(404).json({ error: 'unknown clientId' });

    const recId = id('rec');
    const status = sourceUrl ? 'queued' : 'awaiting_upload';
    await q(
      `INSERT INTO recordings (id, client_id, source_url, kind, status) VALUES ($1,$2,$3,$4,$5)`,
      [recId, clientId, sourceUrl || null, kind || null, status]
    );
    const upload = sourceUrl ? null : await createUploadTarget(recId, filename);
    if (upload) await q('UPDATE recordings SET storage_key = $1 WHERE id = $2', [upload.key, recId]);
    res.status(201).json({ recordingId: recId, status, upload });
  } catch (e) { next(e); }
});

// PUT /api/intake/upload/:id — local driver only: the file body lands here.
r.put('/upload/:id', async (req, res, next) => {
  try {
    const rec = await q('SELECT id, storage_key, status FROM recordings WHERE id = $1', [req.params.id]);
    if (!rec.rowCount) return res.status(404).json({ error: 'unknown recording' });
    if (rec.rows[0].status !== 'awaiting_upload') return res.status(409).json({ error: `recording is ${rec.rows[0].status}` });
    const { bytes } = await saveStream(rec.rows[0].storage_key, req);
    await q(`UPDATE recordings SET status = 'queued' WHERE id = $1`, [req.params.id]);
    res.json({ recordingId: req.params.id, bytes, status: 'queued' });
  } catch (e) { next(e); }
});

// GET /api/intake/queue — ops dashboard: incoming content queue.
r.get('/queue', async (_req, res, next) => {
  try {
    const { rows } = await q(`
      SELECT r.id, r.client_id, c.name AS client_name, r.source_url, r.storage_key,
             r.kind, r.status, r.created_at
      FROM recordings r JOIN clients c ON c.id = r.client_id
      WHERE r.status IN ('awaiting_upload','queued','ingesting')
      ORDER BY r.created_at ASC`);
    res.json({ items: rows });
  } catch (e) { next(e); }
});

// GET /api/intake/:id — single recording with storage state (ops detail view).
r.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await q('SELECT * FROM recordings WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'unknown recording' });
    const stored = rows[0].storage_key ? await objectInfo(rows[0].storage_key) : null;
    res.json({ ...rows[0], stored });
  } catch (e) { next(e); }
});

export default r;
