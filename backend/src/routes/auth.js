/** Stage B7 — auth endpoints.
 *
 *  Bootstrap solves the first-user problem honestly: it works exactly once,
 *  while NO user holds credentials, and creates the first ops account.
 *  Every later account is created by an authenticated ops/account_manager
 *  through POST /api/users (which now sets a password). */
import { Router } from 'express';
import { q } from '../db/index.js';
import {
  hashPassword, verifyPassword, createSession, revokeSession,
  requireAuth, loginAllowed, recordLoginAttempt, clearLoginAttempts, COOKIE, SESSION_TTL_H,
} from '../lib/auth.js';
import { rateLimit } from '../lib/ratelimit.js';
import { validate } from '../lib/validate.js';
import { log } from '../lib/log.js';
import { id } from '../lib/ids.js';
import { audit } from '../lib/audit.js';

const r = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW_MIN = 8;

// S3: per-IP throttle across the whole auth surface (the login endpoint keeps
// its stricter per-email+IP limiter on top). Generous default; tighten in prod.
r.use(rateLimit({ name: 'auth', max: 120 }));
const credentials = { email: { type: 'string', required: true, maxLength: 200 }, password: { type: 'string', required: true, maxLength: 200 } };

// httpOnly so JS can't read it (no localStorage token after S2); SameSite=Lax
// blocks cross-site sends on its own, and Secure forces HTTPS in production.
const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const setCookie = (res, token) => res.setHeader('Set-Cookie',
  `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_H * 3600}; SameSite=Lax${secure}`);
const clearCookie = (res) => res.setHeader('Set-Cookie',
  `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);

async function bootstrapRequired() {
  const { rows } = await q('SELECT count(*)::int AS n FROM users WHERE password_hash IS NOT NULL');
  return rows[0].n === 0;
}

// GET /api/auth/status — the login screen asks this one question.
r.get('/status', async (_req, res, next) => {
  try { res.json({ bootstrapRequired: await bootstrapRequired() }); }
  catch (e) { next(e); }
});

// POST /api/auth/bootstrap { email, password } — first ops account, once.
r.post('/bootstrap', validate(credentials), async (req, res, next) => {
  try {
    if (!(await bootstrapRequired())) {
      return res.status(409).json({ error: 'already bootstrapped — sign in, or ask an ops user for an account' });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'valid email required' });
    if (password.length < PW_MIN) return res.status(400).json({ error: `password must be ≥ ${PW_MIN} characters` });
    // the email may already exist as a credential-less B4-era row — upgrade it
    const existing = await q('SELECT id, role FROM users WHERE email = $1', [email]);
    let userId;
    if (existing.rowCount) {
      if (existing.rows[0].role !== 'ops') return res.status(409).json({ error: `email exists with role ${existing.rows[0].role}` });
      userId = existing.rows[0].id;
      await q('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, hashPassword(password)]);
    } else {
      userId = id('usr');
      await q(`INSERT INTO users (id, email, role, password_hash) VALUES ($1, $2, 'ops', $3)`,
        [userId, email, hashPassword(password)]);
    }
    const { token, expiresAt } = await createSession(userId);
    setCookie(res, token);
    log.security('auth.bootstrap', { userId, email, ip: req.ip, requestId: req.id });
    res.status(201).json({ token, expiresAt, user: { id: userId, email, role: 'ops' } });
  } catch (e) { next(e); }
});

// POST /api/auth/login { email, password }
r.post('/login', validate(credentials), async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const key = `${email}|${req.ip}`;
    if (!loginAllowed(key)) {
      log.security('auth.login.ratelimited', { email, ip: req.ip, requestId: req.id });
      return res.status(429).json({ error: 'too many attempts — try again in 15 minutes' });
    }
    recordLoginAttempt(key);
    const { rows } = await q('SELECT id, email, role, client_id, password_hash FROM users WHERE email = $1', [email]);
    // one generic error for unknown email AND wrong password — no enumeration
    if (!rows.length || !verifyPassword(String(req.body?.password || ''), rows[0].password_hash)) {
      log.security('auth.login.fail', { email, ip: req.ip, requestId: req.id });
      return res.status(401).json({ error: 'invalid email or password' });
    }
    const u = rows[0];
    clearLoginAttempts(key);
    const { token, expiresAt } = await createSession(u.id);
    setCookie(res, token);
    log.security('auth.login.ok', { userId: u.id, email: u.email, role: u.role, ip: req.ip, requestId: req.id });
    await audit('admin', 'login_success', { actorId: u.id, actorRole: u.role, clientId: u.client_id, // O5
      entityType: 'user', entityId: u.id, summary: `Signed in: ${u.email} (${u.role})` });
    res.json({ token, expiresAt, user: { id: u.id, email: u.email, role: u.role, clientId: u.client_id } });
  } catch (e) { next(e); }
});

// POST /api/auth/logout — revoke THIS session server-side.
r.post('/logout', requireAuth(), async (req, res, next) => {
  try {
    await revokeSession(req.sessionToken);
    clearCookie(res);
    log.security('auth.logout', { userId: req.user.id, email: req.user.email, ip: req.ip, requestId: req.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/auth/me
r.get('/me', requireAuth(), (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role, clientId: req.user.client_id } });
});

// POST /api/auth/password { current, next } — change your own.
r.post('/password', requireAuth(), validate({
  current: { type: 'string', required: true, maxLength: 200 },
  next: { type: 'string', required: true, maxLength: 200 },
}), async (req, res, next) => {
  try {
    const { rows } = await q('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!verifyPassword(String(req.body?.current || ''), rows[0].password_hash)) {
      return res.status(401).json({ error: 'current password is wrong' });
    }
    const nextPw = String(req.body?.next || '');
    if (nextPw.length < PW_MIN) return res.status(400).json({ error: `password must be ≥ ${PW_MIN} characters` });
    await q('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hashPassword(nextPw)]);
    log.security('auth.password.changed', { userId: req.user.id, ip: req.ip, requestId: req.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
