/** Stage B5 — publishing: connections, scheduling, the ops queue.
 *
 *  Only the status machine can put a clip here: scheduleClip's atomic
 *  transition accepts clips in 'approved' (or already 'scheduled' when adding
 *  a platform), so client sign-off is structurally unskippable. Credentials
 *  are encrypted at rest and never leave the API. */
import { Router } from 'express';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { encryptJson } from '../lib/crypto.js';
import { objectInfo, localPathFor } from '../storage/index.js';
import { PLATFORMS, scheduleClip } from '../publish/index.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { validate } from '../lib/validate.js';

const r = Router();
const CONN_COLS = 'id, client_id, platform, handle, status, created_at'; // never credentials_enc

// ── YouTube OAuth (M6) ──────────────────────────────────────────────────────
// The connect flow mints the { clientId, clientSecret, refreshToken } the live
// adapter needs and stores it encrypted, like any other connection. The app
// credentials come from env (one Google Cloud OAuth client); the refresh token
// is per-channel, obtained via consent. See docs/RUNBOOK_YOUTUBE.md.
const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',   // publish
  'https://www.googleapis.com/auth/youtube.readonly', // metrics
];
const STATE_TTL_S = 600;
const oauthRedirectUri = () =>
  `${(process.env.OAUTH_REDIRECT_BASE || 'http://localhost:8080').replace(/\/$/, '')}/api/publish/connections/youtube/oauth/callback`;
const stateKey = () => process.env.PUBLISH_TOKEN_KEY || 'dev-publish-key — set PUBLISH_TOKEN_KEY in production';

// State is stateless and HMAC-signed: the authenticated /start endpoint binds
// the clientId into it, the unauthenticated callback trusts only what verifies.
function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', stateKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyState(state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', stateKey()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// POST /api/publish/connections { clientId, platform, handle?, credentials }
// Re-connecting the same client+platform replaces the stored credentials
// (that's what an OAuth re-auth is).
r.post('/connections', requireAuth('ops', 'account_manager'),
  validate({
    clientId: { type: 'string', required: true, maxLength: 80 },
    platform: { type: 'string', required: true, enum: PLATFORMS },
    credentials: { type: 'object', required: true },
    handle: { type: 'string', maxLength: 200 },
  }),
  async (req, res, next) => {
  try {
    const { clientId, platform, handle, credentials } = req.body || {};
    const client = await q('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (!client.rowCount) return res.status(404).json({ error: 'unknown clientId' });
    const { rows } = await q(`
      INSERT INTO platform_connections (id, client_id, platform, handle, credentials_enc)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (client_id, platform) DO UPDATE
        SET handle = EXCLUDED.handle, credentials_enc = EXCLUDED.credentials_enc,
            status = 'active'
      RETURNING ${CONN_COLS}`,
      [id('conn'), clientId, platform, handle || null, encryptJson(credentials)]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// GET /api/publish/connections?clientId=
r.get('/connections', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { clientId } = req.query;
    const { rows } = clientId
      ? await q(`SELECT ${CONN_COLS} FROM platform_connections WHERE client_id = $1 ORDER BY platform`, [clientId])
      : await q(`SELECT ${CONN_COLS} FROM platform_connections ORDER BY created_at`);
    res.json({ connections: rows });
  } catch (e) { next(e); }
});

// GET /api/publish/connections/youtube/oauth/start?clientId= — returns the
// Google consent URL to open in a browser. Ops/AM only.
r.get('/connections/youtube/oauth/start', requireAuth('ops', 'account_manager'), async (req, res, next) => {
  try {
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const cid = process.env.YOUTUBE_CLIENT_ID;
    if (!cid || !process.env.YOUTUBE_CLIENT_SECRET) {
      return res.status(503).json({ error: 'YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET not configured' });
    }
    const client = await q('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (!client.rowCount) return res.status(404).json({ error: 'unknown clientId' });

    const state = signState({ clientId, n: randomBytes(8).toString('hex'), exp: Math.floor(Date.now() / 1000) + STATE_TTL_S });
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: cid, redirect_uri: oauthRedirectUri(), response_type: 'code',
      scope: YT_SCOPES.join(' '), access_type: 'offline', prompt: 'consent',
      include_granted_scopes: 'true', state,
    }).toString();
    res.json({ authUrl, state, redirectUri: oauthRedirectUri() });
  } catch (e) { next(e); }
});

// GET /api/publish/connections/youtube/oauth/callback?code=&state= — Google's
// browser redirect lands here. No Bearer (it's a redirect); trust comes from the
// signed state. Exchanges the code for a refresh token and stores it encrypted.
r.get('/connections/youtube/oauth/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthErr } = req.query;
    if (oauthErr) return res.status(400).json({ error: `OAuth consent declined: ${String(oauthErr).slice(0, 120)}` });
    const payload = verifyState(state);
    if (!payload) return res.status(400).json({ error: 'invalid or expired state' });
    if (!code) return res.status(400).json({ error: 'missing authorization code' });
    const cid = process.env.YOUTUBE_CLIENT_ID, csec = process.env.YOUTUBE_CLIENT_SECRET;
    if (!cid || !csec) return res.status(503).json({ error: 'YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET not configured' });

    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: cid, client_secret: csec, redirect_uri: oauthRedirectUri(), grant_type: 'authorization_code',
      }),
    });
    if (!tok.ok) return res.status(502).json({ error: `token exchange failed (${tok.status}): ${(await tok.text()).slice(0, 200)}` });
    const data = await tok.json();
    if (!data.refresh_token) {
      return res.status(400).json({ error: 'no refresh_token returned — revoke prior access and re-consent (Google only returns it on first grant)' });
    }
    // Best-effort: name the connection by the channel title (display only).
    let handle = null;
    try {
      const ch = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { authorization: `Bearer ${data.access_token}` } });
      if (ch.ok) handle = (await ch.json()).items?.[0]?.snippet?.title || null;
    } catch { /* handle is cosmetic */ }

    const { rows } = await q(`
      INSERT INTO platform_connections (id, client_id, platform, handle, credentials_enc)
      VALUES ($1, $2, 'youtube', $3, $4)
      ON CONFLICT (client_id, platform) DO UPDATE
        SET handle = EXCLUDED.handle, credentials_enc = EXCLUDED.credentials_enc, status = 'active'
      RETURNING ${CONN_COLS}`,
      [id('conn'), payload.clientId, handle, encryptJson({ clientId: cid, clientSecret: csec, refreshToken: data.refresh_token })]);
    res.json({ connected: true, platform: 'youtube', connection: rows[0] });
  } catch (e) { next(e); }
});

// POST /api/publish/connections/:id/revoke — kills future publishes; queued
// jobs for it will park with a visible error.
r.post('/connections/:id/revoke', requireAuth('ops', 'account_manager'), async (req, res, next) => {
  try {
    const { rows } = await q(
      `UPDATE platform_connections SET status = 'revoked' WHERE id = $1 RETURNING ${CONN_COLS}`,
      [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'unknown connection' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /api/publish { clipId, platform, scheduledAt? } — schedule one clip on
// one platform. The client must have an active connection for it.
r.post('/', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { clipId, platform, scheduledAt } = req.body || {};
    if (!clipId || !PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `clipId and platform (${PLATFORMS.join(' | ')}) required` });
    }
    const clip = await q(`
      SELECT cl.id, cl.status, r.client_id FROM clips cl
      JOIN recordings r ON r.id = cl.recording_id WHERE cl.id = $1`, [clipId]);
    if (!clip.rowCount) return res.status(404).json({ error: 'unknown clip' });
    const conn = await q(
      `SELECT id FROM platform_connections WHERE client_id = $1 AND platform = $2 AND status = 'active'`,
      [clip.rows[0].client_id, platform]);
    if (!conn.rowCount) return res.status(409).json({ error: `client has no active ${platform} connection — connect it first` });

    const job = await scheduleClip({ clipId, connectionId: conn.rows[0].id, platform, scheduledAt, scheduledBy: req.user.id });
    if (!job) {
      return res.status(409).json({
        error: `clip is '${clip.rows[0].status}' — only approved clips can be scheduled (the sign-off guarantee)`,
        status: clip.rows[0].status,
      });
    }
    res.status(202).json({ id: job.id, clipId, platform, scheduledAt: job.scheduled_at, status: job.status });
  } catch (e) { next(e); }
});

// GET /api/publish/queue — the ops surface: what ships next, what shipped,
// what parked. Failed first (they need a human), then by schedule.
r.get('/queue', requireAuth(...INTERNAL), async (_req, res, next) => {
  try {
    const { rows } = await q(`
      SELECT pj.id, pj.clip_id, pj.platform, pj.scheduled_at, pj.published_at,
             pj.status, pj.attempts, pj.error, pj.external_url,
             cl.hook, c.name AS client_name, pc.handle, u.email AS scheduled_by_email
      FROM publish_jobs pj
      LEFT JOIN users u ON u.id = pj.scheduled_by
      JOIN clips cl ON cl.id = pj.clip_id
      JOIN recordings r ON r.id = cl.recording_id
      JOIN clients c ON c.id = r.client_id
      LEFT JOIN platform_connections pc ON pc.id = pj.connection_id
      ORDER BY (pj.status = 'failed') DESC, pj.scheduled_at NULLS FIRST
      LIMIT 200`);
    res.json({ items: rows });
  } catch (e) { next(e); }
});

// POST /api/publish/:id/retry — re-arm a parked publish.
r.post('/:id/retry', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { rows } = await q(`
      UPDATE publish_jobs SET status = 'scheduled', run_after = now(), error = NULL,
             attempts = 0, dead_letter = false, updated_at = now(), scheduled_by = $2
      WHERE id = $1 AND status = 'failed' RETURNING id, status`, [req.params.id, req.user.id]);
    if (!rows.length) return res.status(409).json({ error: 'only failed publishes can be retried' });
    res.status(202).json(rows[0]);
  } catch (e) { next(e); }
});

// POST /api/publish/:id/cancel — pull a scheduled publish. The clip returns
// to 'approved' only when no other live job still holds it.
r.post('/:id/cancel', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { rows } = await q(`
      UPDATE publish_jobs SET status = 'canceled', updated_at = now()
      WHERE id = $1 AND status = 'scheduled' RETURNING clip_id`, [req.params.id]);
    if (!rows.length) return res.status(409).json({ error: 'only scheduled (not yet publishing) jobs can be canceled' });
    await q(`
      UPDATE clips SET status = 'approved'
      WHERE id = $1 AND status = 'scheduled'
        AND NOT EXISTS (SELECT 1 FROM publish_jobs
                        WHERE clip_id = $1 AND status IN ('scheduled','publishing','published'))`,
      [rows[0].clip_id]);
    res.json({ id: req.params.id, status: 'canceled' });
  } catch (e) { next(e); }
});

// GET /api/publish/outbox/:platform/:file — serve what the local adapter
// delivered (the receipt the smoke and the ops UI verify against).
r.get('/outbox/:platform/:file', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { platform, file } = req.params;
    if (!PLATFORMS.includes(platform) || !/^[\w.-]+\.(mp4|json)$/.test(file)) {
      return res.status(400).json({ error: 'bad outbox path' });
    }
    const key = `outbox/${platform}/${file}`;
    const info = await objectInfo(key);
    if (!info) return res.status(404).json({ error: 'nothing delivered at this path' });
    res.sendFile(await localPathFor(key), {
      headers: { 'content-type': file.endsWith('.json') ? 'application/json' : 'video/mp4' },
    });
  } catch (e) { next(e); }
});

export default r;
