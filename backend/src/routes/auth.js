/** Stage B7 + C2 — auth endpoints.
 *
 *  B7 (unchanged contract): bootstrap the first ops account once; password
 *  login/logout with server-side sessions; /me; self-service password change.
 *
 *  C2 adds enterprise identity on top, all opt-in / policy-gated so the password
 *  path above is byte-for-byte what it was:
 *    · TOTP MFA — enrol, verify, disable; a login by an MFA-enabled user returns
 *      a short-lived challenge instead of a session, completed at /mfa/login.
 *    · Per-client policy — clients.mfa_required forces enrolment before a session
 *      is issued (challenge-driven, no half-session).
 *    · Account lockout — N failed sign-ins lock the account (lib/lockout), on top
 *      of the existing per-(email+ip) in-memory rate limit.
 *    · SSO — OIDC authorization-code (lib/sso), with a zero-network local test IdP.
 *    · Session management — list + revoke your own sessions. */
import { Router } from 'express';
import { createHmac, timingSafeEqual, scryptSync } from 'node:crypto';
import { q } from '../db/index.js';
import {
  hashPassword, verifyPassword, createSession, revokeSession,
  requireAuth, loginAllowed, recordLoginAttempt, clearLoginAttempts, COOKIE, SESSION_TTL_H,
  listSessions, revokeSessionById, revokeOtherSessions,
} from '../lib/auth.js';
import { encryptJson, decryptJson } from '../lib/crypto.js';
import {
  generateSecret, verifyTotp, otpauthUri, generateRecoveryCodes, spendRecoveryCode,
} from '../lib/totp.js';
import { lockState, recordFailure, clearFailures, LOCKOUT_MINUTES } from '../lib/lockout.js';
import { passwordError } from '../lib/password-policy.js';
import { beginSso, completeSso, localAuthorizeCode, enabledProviders, SsoUnavailable } from '../lib/sso.js';
import { rateLimit } from '../lib/ratelimit.js';
import { validate } from '../lib/validate.js';
import { log } from '../lib/log.js';
import { id } from '../lib/ids.js';
import { audit } from '../lib/audit.js';

const r = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

r.use(rateLimit({ name: 'auth', max: 120 }));
const credentials = { email: { type: 'string', required: true, maxLength: 200 }, password: { type: 'string', required: true, maxLength: 200 } };

const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const setCookie = (res, token) => res.setHeader('Set-Cookie',
  `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_H * 3600}; SameSite=Lax${secure}`);
const clearCookie = (res) => res.setHeader('Set-Cookie',
  `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);

const sessionMeta = (req, authMethod) => ({ ip: req.ip, userAgent: req.headers['user-agent'], authMethod });

/* ── short-lived signed challenges (stateless; no DB row) ─────────────────────
 *  A challenge proves "this person just passed step 1" between the password step
 *  and the MFA step, or between a policy-forced login and enrolment. HMAC-signed
 *  with a key derived from the same secret credential encryption uses; it carries
 *  only a user id + purpose + expiry, never anything sensitive. */
const CHALLENGE_KEY = scryptSync(
  process.env.PUBLISH_TOKEN_KEY || 'dev-publish-key — set PUBLISH_TOKEN_KEY in production',
  'clipper-challenge-v1', 32);
const CHALLENGE_TTL_MS = Number(process.env.MFA_CHALLENGE_TTL_MS || 5 * 60_000);

function signChallenge(userId, purpose) {
  const payload = Buffer.from(JSON.stringify({ u: userId, p: purpose, exp: Date.now() + CHALLENGE_TTL_MS })).toString('base64url');
  const mac = createHmac('sha256', CHALLENGE_KEY).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}
function verifyChallenge(token, purpose) {
  const [payload, mac] = String(token || '').split('.');
  if (!payload || !mac) return null;
  const expect = createHmac('sha256', CHALLENGE_KEY).update(payload).digest('base64url');
  if (mac.length !== expect.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (data.p !== purpose || Date.now() > data.exp) return null;
  return data.u;
}

/* ── MFA policy: does this user have to use MFA? ──────────────────────────── */
const GLOBAL_MFA_REQUIRED = process.env.MFA_REQUIRED === 'true';
function mfaRequiredFor(user) {
  return GLOBAL_MFA_REQUIRED || user.client_mfa_required === true;
}

/* ── enrolment core (shared by self-service + policy-forced paths) ────────── */
async function startEnrolment(userId, email) {
  const secret = generateSecret();
  await q('UPDATE users SET mfa_pending_secret = $2 WHERE id = $1', [userId, encryptJson({ secret })]);
  return { secret, otpauthUri: otpauthUri(secret, { label: email }) };
}

/** The not-yet-confirmed secret for an in-progress enrolment (decrypted), or null. */
async function pendingMfaSecret(userId) {
  const { rows } = await q('SELECT mfa_pending_secret FROM users WHERE id = $1', [userId]);
  return rows[0]?.mfa_pending_secret ? decryptJson(rows[0].mfa_pending_secret).secret : null;
}

/** Promote the pending secret to active, enable MFA, and mint recovery codes
 *  (returned once, in plaintext, for the holder to store). */
async function enableMfa(userId) {
  const { plain, hashed } = generateRecoveryCodes();
  await q(`UPDATE users SET mfa_enabled = true, mfa_secret = mfa_pending_secret,
           mfa_pending_secret = NULL, mfa_recovery_codes = $2 WHERE id = $1`,
    [userId, JSON.stringify(hashed)]);
  return plain;
}

/* ── status ──────────────────────────────────────────────────────────────── */
async function bootstrapRequired() {
  const { rows } = await q('SELECT count(*)::int AS n FROM users WHERE password_hash IS NOT NULL');
  return rows[0].n === 0;
}

// GET /api/auth/status — the login screen asks this; now also advertises SSO.
r.get('/status', async (_req, res, next) => {
  try { res.json({ bootstrapRequired: await bootstrapRequired(), ssoProviders: enabledProviders() }); }
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
    const pwErr = passwordError(password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    const existing = await q('SELECT id, role FROM users WHERE email = $1', [email]);
    let userId;
    if (existing.rowCount) {
      if (existing.rows[0].role !== 'ops') return res.status(409).json({ error: `email exists with role ${existing.rows[0].role}` });
      userId = existing.rows[0].id;
      await q('UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1', [userId, hashPassword(password)]);
    } else {
      userId = id('usr');
      await q(`INSERT INTO users (id, email, role, password_hash, password_changed_at) VALUES ($1, $2, 'ops', $3, now())`,
        [userId, email, hashPassword(password)]);
    }
    const { token, expiresAt } = await createSession(userId, sessionMeta(req, 'password'));
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
    const { rows } = await q(`
      SELECT u.id, u.email, u.role, u.client_id, u.password_hash, u.mfa_enabled,
             u.failed_attempts, u.locked_until, c.mfa_required AS client_mfa_required
      FROM users u LEFT JOIN clients c ON c.id = u.client_id
      WHERE u.email = $1`, [email]);
    const u = rows[0];

    // Account lockout is checked before the password so a locked account can't be
    // probed; the message is the same shape whether locked or simply wrong.
    if (u) {
      const lock = lockState(u);
      if (lock.locked) {
        log.security('auth.login.locked', { userId: u.id, email, ip: req.ip, requestId: req.id });
        return res.status(423).json({ error: `account locked after too many attempts — try again in ${LOCKOUT_MINUTES} minutes` });
      }
    }
    // one generic error for unknown email AND wrong password — no enumeration
    if (!u || !verifyPassword(String(req.body?.password || ''), u.password_hash)) {
      if (u) await recordFailure(u.id);
      log.security('auth.login.fail', { email, ip: req.ip, requestId: req.id });
      return res.status(401).json({ error: 'invalid email or password' });
    }

    // Password is correct → the failed-attempt slate is wiped.
    clearLoginAttempts(key);
    await clearFailures(u.id);

    // MFA enabled → hand back a challenge, NOT a session. The code completes it.
    if (u.mfa_enabled) {
      return res.json({ mfaRequired: true, challenge: signChallenge(u.id, 'mfa') });
    }
    // Policy requires MFA but the user hasn't enrolled → force enrolment first,
    // again without issuing a usable session (the challenge drives /mfa/setup).
    if (mfaRequiredFor(u)) {
      log.security('auth.login.mfa_enrolment_required', { userId: u.id, email, requestId: req.id });
      return res.json({ mfaEnrolmentRequired: true, challenge: signChallenge(u.id, 'enrol') });
    }

    const { token, expiresAt } = await createSession(u.id, sessionMeta(req, 'password'));
    setCookie(res, token);
    log.security('auth.login.ok', { userId: u.id, email: u.email, role: u.role, ip: req.ip, requestId: req.id });
    await audit('admin', 'login_success', { actorId: u.id, actorRole: u.role, clientId: u.client_id,
      entityType: 'user', entityId: u.id, summary: `Signed in: ${u.email} (${u.role})` });
    res.json({ token, expiresAt, user: { id: u.id, email: u.email, role: u.role, clientId: u.client_id } });
  } catch (e) { next(e); }
});

/* ── MFA: complete a login challenge ─────────────────────────────────────── */
// POST /api/auth/mfa/login { challenge, code } — code is a TOTP or a recovery code.
r.post('/mfa/login', validate({
  challenge: { type: 'string', required: true, maxLength: 500 },
  code: { type: 'string', required: true, maxLength: 40 },
}), async (req, res, next) => {
  try {
    const userId = verifyChallenge(req.body.challenge, 'mfa');
    if (!userId) return res.status(401).json({ error: 'challenge expired — sign in again' });
    const { rows } = await q('SELECT id, email, role, client_id, mfa_enabled, mfa_secret, mfa_recovery_codes FROM users WHERE id = $1', [userId]);
    const u = rows[0];
    if (!u || !u.mfa_enabled) return res.status(400).json({ error: 'MFA is not enabled for this account' });

    const code = String(req.body.code || '');
    const secret = decryptJson(u.mfa_secret).secret;
    let method = null;
    if (verifyTotp(secret, code)) {
      method = 'mfa';
    } else {
      const remaining = spendRecoveryCode(u.mfa_recovery_codes, code);
      if (remaining) {
        method = 'recovery';
        await q('UPDATE users SET mfa_recovery_codes = $2 WHERE id = $1', [u.id, JSON.stringify(remaining)]);
        log.security('auth.mfa.recovery_used', { userId: u.id, remaining: remaining.length, requestId: req.id });
      }
    }
    if (!method) {
      await recordFailure(u.id);
      log.security('auth.mfa.fail', { userId: u.id, ip: req.ip, requestId: req.id });
      return res.status(401).json({ error: 'invalid verification code' });
    }
    await clearFailures(u.id);
    const { token, expiresAt } = await createSession(u.id, sessionMeta(req, method));
    setCookie(res, token);
    log.security('auth.login.ok', { userId: u.id, email: u.email, role: u.role, method, ip: req.ip, requestId: req.id });
    await audit('admin', 'login_success', { actorId: u.id, actorRole: u.role, clientId: u.client_id,
      entityType: 'user', entityId: u.id, summary: `Signed in (${method}): ${u.email} (${u.role})` });
    res.json({ token, expiresAt, user: { id: u.id, email: u.email, role: u.role, clientId: u.client_id } });
  } catch (e) { next(e); }
});

/* ── MFA: policy-forced enrolment (challenge-driven, no session yet) ──────── */
// POST /api/auth/mfa/setup { challenge } → { secret, otpauthUri }
r.post('/mfa/setup', validate({ challenge: { type: 'string', required: true, maxLength: 500 } }), async (req, res, next) => {
  try {
    const userId = verifyChallenge(req.body.challenge, 'enrol');
    if (!userId) return res.status(401).json({ error: 'challenge expired — sign in again' });
    const { rows } = await q('SELECT email FROM users WHERE id = $1', [userId]);
    if (!rows[0]) return res.status(404).json({ error: 'account not found' });
    res.json(await startEnrolment(userId, rows[0].email));
  } catch (e) { next(e); }
});

// POST /api/auth/mfa/setup/confirm { challenge, code } → { recoveryCodes }
r.post('/mfa/setup/confirm', validate({
  challenge: { type: 'string', required: true, maxLength: 500 },
  code: { type: 'string', required: true, maxLength: 10 },
}), async (req, res, next) => {
  try {
    const userId = verifyChallenge(req.body.challenge, 'enrol');
    if (!userId) return res.status(401).json({ error: 'challenge expired — sign in again' });
    const pending = await pendingMfaSecret(userId);
    if (!pending || !verifyTotp(pending, String(req.body.code || ''))) {
      return res.status(400).json({ error: 'invalid verification code' });
    }
    const recoveryCodes = await enableMfa(userId);
    log.security('auth.mfa.enabled', { userId, forced: true, requestId: req.id });
    await audit('admin', 'mfa_enabled', { actorId: userId, entityType: 'user', entityId: userId, summary: 'MFA enrolled (policy-required)' });
    res.json({ ok: true, recoveryCodes });
  } catch (e) { next(e); }
});

/* ── MFA: self-service enrolment (authenticated) ─────────────────────────── */
// POST /api/auth/mfa/enroll → { secret, otpauthUri }
r.post('/mfa/enroll', requireAuth(), async (req, res, next) => {
  try {
    const { rows } = await q('SELECT mfa_enabled FROM users WHERE id = $1', [req.user.id]);
    if (rows[0]?.mfa_enabled) return res.status(409).json({ error: 'MFA is already enabled — disable it first to re-enrol' });
    res.json(await startEnrolment(req.user.id, req.user.email));
  } catch (e) { next(e); }
});

// POST /api/auth/mfa/verify { code } → { recoveryCodes }
r.post('/mfa/verify', requireAuth(), validate({ code: { type: 'string', required: true, maxLength: 10 } }), async (req, res, next) => {
  try {
    const pending = await pendingMfaSecret(req.user.id);
    if (!pending || !verifyTotp(pending, String(req.body.code || ''))) {
      return res.status(400).json({ error: 'invalid verification code — check the time on your device' });
    }
    const recoveryCodes = await enableMfa(req.user.id);
    log.security('auth.mfa.enabled', { userId: req.user.id, requestId: req.id });
    await audit('admin', 'mfa_enabled', { actorId: req.user.id, actorRole: req.user.role,
      entityType: 'user', entityId: req.user.id, summary: `MFA enabled: ${req.user.email}` });
    res.json({ ok: true, recoveryCodes });
  } catch (e) { next(e); }
});

// POST /api/auth/mfa/disable { code } — proving possession of a current code.
r.post('/mfa/disable', requireAuth(), validate({ code: { type: 'string', required: true, maxLength: 40 } }), async (req, res, next) => {
  try {
    const { rows } = await q('SELECT u.mfa_enabled, u.mfa_secret, u.mfa_recovery_codes, c.mfa_required FROM users u LEFT JOIN clients c ON c.id = u.client_id WHERE u.id = $1', [req.user.id]);
    const u = rows[0];
    if (!u?.mfa_enabled) return res.status(409).json({ error: 'MFA is not enabled' });
    const code = String(req.body.code || '');
    const ok = verifyTotp(decryptJson(u.mfa_secret).secret, code) || spendRecoveryCode(u.mfa_recovery_codes, code) !== null;
    if (!ok) return res.status(401).json({ error: 'invalid verification code' });
    // Don't let a user escape a policy that requires MFA.
    if (GLOBAL_MFA_REQUIRED || u.mfa_required) return res.status(403).json({ error: 'MFA is required by policy and cannot be disabled' });
    await q('UPDATE users SET mfa_enabled = false, mfa_secret = NULL, mfa_pending_secret = NULL, mfa_recovery_codes = NULL WHERE id = $1', [req.user.id]);
    log.security('auth.mfa.disabled', { userId: req.user.id, requestId: req.id });
    await audit('admin', 'mfa_disabled', { actorId: req.user.id, actorRole: req.user.role,
      entityType: 'user', entityId: req.user.id, summary: `MFA disabled: ${req.user.email}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/auth/mfa — is MFA on for me, and is it required?
r.get('/mfa', requireAuth(), async (req, res, next) => {
  try {
    const { rows } = await q('SELECT u.mfa_enabled, c.mfa_required FROM users u LEFT JOIN clients c ON c.id = u.client_id WHERE u.id = $1', [req.user.id]);
    res.json({ enabled: rows[0]?.mfa_enabled === true, required: GLOBAL_MFA_REQUIRED || rows[0]?.mfa_required === true });
  } catch (e) { next(e); }
});

/* ── SSO (OIDC; local test IdP by default) ───────────────────────────────── */
const localRedirect = (p) => (typeof p === 'string' && /^\/[^/]/.test(p) ? p : '/ops');

// GET /api/auth/sso/:provider/start — kick off the flow; 302 to the IdP.
r.get('/sso/:provider/start', async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const redirectUri = `${process.env.PUBLIC_BASE_URL || ''}/api/auth/sso/${provider}/callback`;
    const { state, nonce, pkceVerifier, expiresAt, authorizeUrl } =
      beginSso(provider, { redirectUri, loginHint: req.query.email });
    await q(`INSERT INTO sso_transactions (state, provider, nonce, pkce_verifier, redirect_to, expires_at)
             VALUES ($1,$2,$3,$4,$5,$6)`,
      [state, provider, nonce, pkceVerifier, localRedirect(req.query.redirect), expiresAt]);
    log.security('auth.sso.start', { provider, ip: req.ip, requestId: req.id });
    res.redirect(authorizeUrl);
  } catch (e) {
    if (e instanceof SsoUnavailable) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
});

// GET /api/auth/sso/local/authorize — the local test IdP's "login page".
r.get('/sso/local/authorize', async (req, res, next) => {
  try {
    const { rows } = await q('SELECT state FROM sso_transactions WHERE state = $1 AND consumed_at IS NULL AND expires_at > now()', [req.query.state]);
    if (!rows[0]) return res.status(400).json({ error: 'unknown or expired SSO transaction' });
    const code = localAuthorizeCode(req.query.login_hint);
    res.redirect(`/api/auth/sso/local/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(req.query.state)}`);
  } catch (e) { next(e); }
});

// GET /api/auth/sso/:provider/callback — verify, provision/link, open a session.
r.get('/sso/:provider/callback', async (req, res, next) => {
  try {
    const provider = req.params.provider;
    // Atomic single-use claim: the row can be consumed exactly once.
    const { rows } = await q(
      `UPDATE sso_transactions SET consumed_at = now()
       WHERE state = $1 AND provider = $2 AND consumed_at IS NULL AND expires_at > now()
       RETURNING state, nonce, pkce_verifier, redirect_to`, [req.query.state, provider]);
    const tx = rows[0];
    if (!tx) return res.status(400).json({ error: 'invalid or expired SSO transaction' });

    const { subject, email } = await completeSso(provider, tx, { code: req.query.code });
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'SSO identity has no usable email' });

    const user = await provisionSsoUser(provider, subject, email);
    if (!user) {
      log.security('auth.sso.no_account', { provider, email, ip: req.ip, requestId: req.id });
      return res.status(403).json({ error: 'no account is provisioned for this identity — ask an administrator for access' });
    }
    const { token } = await createSession(user.id, sessionMeta(req, 'sso'));
    setCookie(res, token);
    log.security('auth.sso.ok', { provider, userId: user.id, email: user.email, role: user.role, ip: req.ip, requestId: req.id });
    await audit('admin', 'login_success', { actorId: user.id, actorRole: user.role, clientId: user.client_id,
      entityType: 'user', entityId: user.id, summary: `Signed in (SSO/${provider}): ${user.email} (${user.role})` });
    res.redirect(localRedirect(tx.redirect_to));
  } catch (e) {
    if (e instanceof SsoUnavailable) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
});

/** Resolve an SSO identity to a local account: match the IdP subject, else the
 *  email, else JIT-provision under a client whose sso_domain owns the email
 *  domain. Returns null when no account exists and no domain claims it — SSO
 *  never silently mints an internal account. */
async function provisionSsoUser(provider, subject, email) {
  const bySub = await q('SELECT id, email, role, client_id FROM users WHERE sso_provider = $1 AND sso_subject = $2', [provider, subject]);
  if (bySub.rowCount) return bySub.rows[0];

  const byEmail = await q('SELECT id, email, role, client_id FROM users WHERE email = $1', [email]);
  if (byEmail.rowCount) {
    await q('UPDATE users SET sso_provider = $2, sso_subject = $3 WHERE id = $1', [byEmail.rows[0].id, provider, subject]);
    return byEmail.rows[0];
  }

  const domain = email.split('@')[1];
  const client = await q('SELECT id FROM clients WHERE lower(sso_domain) = $1', [domain]);
  if (!client.rowCount) return null;
  const userId = id('usr');
  const { rows } = await q(
    `INSERT INTO users (id, email, role, client_id, sso_provider, sso_subject)
     VALUES ($1, $2, 'client', $3, $4, $5) RETURNING id, email, role, client_id`,
    [userId, email, client.rows[0].id, provider, subject]);
  log.security('auth.sso.provisioned', { provider, userId, email, clientId: client.rows[0].id });
  await audit('admin', 'user_provisioned', { actorId: userId, clientId: client.rows[0].id,
    entityType: 'user', entityId: userId, summary: `JIT-provisioned via SSO/${provider}: ${email}` });
  return rows[0];
}

/* ── session management ──────────────────────────────────────────────────── */
// GET /api/auth/sessions — my active sessions (current one flagged).
r.get('/sessions', requireAuth(), async (req, res, next) => {
  try { res.json({ sessions: await listSessions(req.user.id, req.sessionToken) }); }
  catch (e) { next(e); }
});

// DELETE /api/auth/sessions/:id — revoke one of my sessions.
r.delete('/sessions/:id', requireAuth(), async (req, res, next) => {
  try {
    const ok = await revokeSessionById(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'no such active session' });
    log.security('auth.session.revoked', { userId: req.user.id, sessionId: req.params.id, requestId: req.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/auth/sessions/revoke-others — sign out everywhere else.
r.post('/sessions/revoke-others', requireAuth(), async (req, res, next) => {
  try {
    const count = await revokeOtherSessions(req.user.id, req.sessionToken);
    log.security('auth.session.revoked_others', { userId: req.user.id, count, requestId: req.id });
    res.json({ ok: true, revoked: count });
  } catch (e) { next(e); }
});

/* ── unchanged B7 endpoints ──────────────────────────────────────────────── */
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
    const pwErr = passwordError(String(req.body?.next || ''));
    if (pwErr) return res.status(400).json({ error: pwErr });
    await q('UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1', [req.user.id, hashPassword(String(req.body.next))]);
    log.security('auth.password.changed', { userId: req.user.id, ip: req.ip, requestId: req.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
