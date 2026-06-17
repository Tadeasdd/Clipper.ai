/** Stage B2 — Intake: clients submit long-form by URL or file upload.
 *  Every submission creates a recordings row that feeds the ops queue. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { createUploadTarget, saveStream, objectInfo } from '../storage/index.js';
import { enqueue, isPlatformUrl } from '../pipeline/index.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { rateLimit } from '../lib/ratelimit.js';
import { validate, paginate } from '../lib/validate.js';

const r = Router();

const KINDS = ['podcast', 'interview', 'livestream', 'webinar', 'youtube'];
const AV_CONTENT = /^(video|audio)\//;

// POST /api/intake
//   { clientId, sourceUrl }              → queued immediately (B3 ingest pulls it)
//   { clientId, filename, kind? }        → awaiting_upload + an upload target
//   Idempotency-Key header (or the source URL itself) dedupes double-submits.
r.post('/', requireAuth(),
  rateLimit({ name: 'intake', max: 120 }),
  validate({
    clientId: { type: 'string', required: true, maxLength: 80 },
    sourceUrl: { type: 'string', maxLength: 2000 },
    filename: { type: 'string', maxLength: 300 },
    kind: { type: 'string', enum: KINDS },
  }),
  async (req, res, next) => {
  try {
    const { clientId, sourceUrl, filename, kind } = req.body || {};
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    if (req.user.role === 'client' && req.user.client_id !== clientId) {
      return res.status(403).json({ error: 'client users can only submit for their own account' });
    }
    if (!sourceUrl && !filename) return res.status(400).json({ error: 'sourceUrl or filename required' });
    if (kind && !KINDS.includes(kind)) {
      return res.status(400).json({ error: `kind must be one of: ${KINDS.join(', ')}` });
    }
    const client = await q('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (!client.rowCount) return res.status(404).json({ error: 'unknown clientId' });

    // Default the kind from the source; validate it against the enum above.
    const kindVal = kind || (sourceUrl && isPlatformUrl(sourceUrl) ? 'youtube' : null);
    // Idempotency key: an explicit header wins; otherwise the URL is its own key
    // so a double-clicked "paste your URL" can't fan out into many recordings.
    const idemKey = (req.get('Idempotency-Key') || '').trim() || (sourceUrl ? `url:${String(sourceUrl).trim()}` : null);

    const recId = id('rec');
    const status = sourceUrl ? 'queued' : 'awaiting_upload';
    const ins = await q(
      `INSERT INTO recordings (id, client_id, source_url, kind, status, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (client_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [recId, clientId, sourceUrl || null, kindVal, status, idemKey]
    );
    if (!ins.rowCount) {
      // The unique index caught a duplicate — return the recording we already have.
      const ex = await q(
        'SELECT id, status FROM recordings WHERE client_id = $1 AND idempotency_key = $2', [clientId, idemKey]);
      return res.status(200).json({ recordingId: ex.rows[0].id, status: ex.rows[0].status, duplicate: true });
    }
    const upload = sourceUrl ? null : await createUploadTarget(recId, filename);
    if (upload) await q('UPDATE recordings SET storage_key = $1 WHERE id = $2', [upload.key, recId]);
    if (sourceUrl) await enqueue(recId, 'ingest'); // file path enqueues on upload completion
    res.status(201).json({ recordingId: recId, status, upload });
  } catch (e) { next(e); }
});

// PUT /api/intake/upload/:id — local driver only: the file body lands here.
r.put('/upload/:id', requireAuth(), async (req, res, next) => {
  if (req.user.role === 'client') {
    const own = await q('SELECT 1 FROM recordings WHERE id = $1 AND client_id = $2', [req.params.id, req.user.client_id]).catch(() => null);
    if (!own?.rowCount) return res.status(403).json({ error: 'client users can only upload to their own submissions' });
  }
  try {
    const ct = (req.get('content-type') || '').toLowerCase().split(';')[0].trim();
    if (ct && !AV_CONTENT.test(ct) && ct !== 'application/octet-stream') {
      // Drain the rejected body to completion BEFORE responding, otherwise Node
      // resets the socket on close and the client sees ECONNRESET, not the 415.
      await new Promise((resolve) => { req.on('end', resolve); req.on('error', resolve); req.on('close', resolve); req.resume(); });
      return res.status(415).json({ error: `unsupported content-type "${ct}" — audio/* or video/* only` });
    }
    const rec = await q('SELECT id, storage_key, status FROM recordings WHERE id = $1', [req.params.id]);
    if (!rec.rowCount) return res.status(404).json({ error: 'unknown recording' });
    if (rec.rows[0].status !== 'awaiting_upload') return res.status(409).json({ error: `recording is ${rec.rows[0].status}` });
    let bytes;
    try {
      ({ bytes } = await saveStream(rec.rows[0].storage_key, req));
    } catch (e) {
      if (e && (e.status === 413 || e.code === 'EUPLOADTOOLARGE')) {
        // The body was cut off mid-stream, so this socket can't be safely reused
        // — tell the client to close it rather than pool a half-broken connection.
        res.set('Connection', 'close');
        return res.status(413).json({ error: 'upload exceeds the maximum allowed size' });
      }
      throw e;
    }
    await q(`UPDATE recordings SET status = 'queued' WHERE id = $1`, [req.params.id]);
    await enqueue(req.params.id, 'ingest'); // B3: the upload is what arms the pipeline
    res.json({ recordingId: req.params.id, bytes, status: 'queued' });
  } catch (e) { next(e); }
});

// GET /api/intake/queue — ops dashboard: incoming content queue.
// Client users get their own recent submissions instead — pinned to their
// client in the query (F5 portal upload surface), whatever params they send.
r.get('/queue', requireAuth(), async (req, res, next) => {
  try {
    const { limit, offset } = paginate(req, { def: 200, max: 200 });
    if (req.user.role === 'client') {
      const { rows } = await q(`
        SELECT id, source_url, kind, status, duration_s, created_at
        FROM recordings WHERE client_id = $1
        ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [req.user.client_id, Math.min(limit, 50), offset]);
      return res.json({ items: rows });
    }
    const { rows } = await q(`
      SELECT r.id, r.client_id, c.name AS client_name, r.source_url, r.storage_key,
             r.kind, r.status, r.created_at
      FROM recordings r JOIN clients c ON c.id = r.client_id
      WHERE r.status IN ('awaiting_upload','queued','ingesting')
      ORDER BY r.created_at ASC LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ items: rows });
  } catch (e) { next(e); }
});

// GET /api/intake/:id — single recording with storage state (ops detail view).
r.get('/:id', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { rows } = await q('SELECT * FROM recordings WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'unknown recording' });
    const stored = rows[0].storage_key ? await objectInfo(rows[0].storage_key) : null;
    res.json({ ...rows[0], stored });
  } catch (e) { next(e); }
});

export default r;
