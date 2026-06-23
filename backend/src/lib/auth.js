/** Stage B7 — sessions, passwords, role walls. No new dependencies: scrypt
 *  and timing-safe compares come from node:crypto, cookies are one header.
 *
 *  Sessions are server-side rows (revocable, expiring) holding only the
 *  sha256 of the token. The token travels either as an httpOnly cookie
 *  (browsers: the ops dashboard, F5) or an Authorization bearer (API
 *  clients, smokes) — same session either way. */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { q } from '../db/index.js';
import { log } from './log.js';
import { id } from './ids.js';

export const INTERNAL = ['ops', 'editor', 'reviewer', 'account_manager'];
export const SESSION_TTL_H = Number(process.env.SESSION_TTL_H || 24 * 7);
export const COOKIE = 'clipper_session';

/* ── passwords ─────────────────────────────────────────────────────────── */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `s2$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false; // user predates B7 or never got credentials
  const [, salt, hash] = stored.split('$');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

/* ── sessions ──────────────────────────────────────────────────────────── */
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** Create a session. `meta` (C2) records how + from where it was minted so the
 *  security panel can list and revoke it; all fields are optional, so the old
 *  one-arg call sites keep working unchanged. */
export async function createSession(userId, meta = {}) {
  const token = randomBytes(24).toString('hex');
  const sessionId = id('ses');
  const expiresAt = new Date(Date.now() + SESSION_TTL_H * 3600_000);
  await q(`INSERT INTO sessions (token_hash, user_id, expires_at, id, ip, user_agent, auth_method, last_seen_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [sha256(token), userId, expiresAt, sessionId,
     meta.ip || null, (meta.userAgent || '').slice(0, 300) || null, meta.authMethod || 'password']);
  return { token, expiresAt, sessionId };
}

export async function revokeSession(token) {
  await q('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [sha256(token)]);
}

/* ── session management (C2): list + revoke your own sessions ─────────────── */
/** Active sessions for a user, newest first; `current` marks the caller's own. */
export async function listSessions(userId, currentToken) {
  const { rows } = await q(`
    SELECT id, ip, user_agent, auth_method, created_at, last_seen_at, expires_at,
           (token_hash = $2) AS current
    FROM sessions
    WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC`,
    [userId, sha256(currentToken || '')]);
  return rows;
}

/** Revoke one of a user's own sessions by its public id. Returns true if a row
 *  was revoked (scoped to userId so nobody can revoke another account's). */
export async function revokeSessionById(userId, sessionId) {
  const { rowCount } = await q(
    'UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
    [sessionId, userId]);
  return rowCount > 0;
}

/** "Sign out everywhere else" — revoke every active session except the caller's. */
export async function revokeOtherSessions(userId, currentToken) {
  const { rowCount } = await q(
    'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL',
    [userId, sha256(currentToken || '')]);
  return rowCount;
}

function tokenFrom(req) {
  const bearer = req.headers.authorization?.match(/^Bearer (\w+)$/)?.[1];
  if (bearer) return bearer;
  return req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\w+)`))?.[1] || null;
}

async function userForToken(token) {
  if (!token) return null;
  const hash = sha256(token);
  const { rows } = await q(`
    SELECT u.id, u.email, u.role, u.client_id, s.last_seen_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hash]);
  const row = rows[0];
  if (!row) return null;
  // Best-effort, throttled activity stamp (≤ 1 write/min) so the session list
  // shows honest "last active" without a write on every authed request.
  const last = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  if (Date.now() - last > 60_000) {
    q('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [hash]).catch(() => {});
  }
  const { last_seen_at, ...user } = row;
  return user;
}

/* ── middleware ────────────────────────────────────────────────────────── */
/** requireAuth() → any authenticated user; requireAuth(...INTERNAL) → role
 *  wall. Attaches req.user and req.sessionToken. 401 without a valid
 *  session, 403 with the wrong role — never silently. */
export function requireAuth(...roles) {
  return async (req, res, next) => {
    try {
      const token = tokenFrom(req);
      const user = await userForToken(token);
      if (!user) return res.status(401).json({ error: 'sign in required' });
      if (roles.length && !roles.includes(user.role)) {
        // Audit the role-wall denial (authenticated-but-forbidden). Routine 401s
        // — the not-signed-in case — are left unlogged to avoid noise.
        log.security('authz.deny', { method: req.method, path: req.path, role: user.role, required: roles, requestId: req.id });
        return res.status(403).json({ error: `requires role: ${roles.join(' | ')}` });
      }
      req.user = user;
      req.sessionToken = token;
      next();
    } catch (e) { next(e); }
  };
}

/* ── CSRF guard (S2) ───────────────────────────────────────────────────────
 *  Cookie-borne sessions are ambient: a browser attaches the cookie to any
 *  request to our origin, including cross-site form posts — classic CSRF. Defend
 *  with the custom-header pattern: a state-changing request authenticated by the
 *  session COOKIE must carry a header a cross-site page cannot set (CORS blocks
 *  custom headers without a passing preflight). Bearer clients (smokes, API)
 *  aren't browser-ambient, so they're exempt; safe methods never mutate. */
export function csrfGuard(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (/^Bearer /.test(req.headers.authorization || '')) return next();         // API client, not a browser cookie
  const hasSessionCookie = new RegExp(`(?:^|;\\s*)${COOKIE}=`).test(req.headers.cookie || '');
  if (!hasSessionCookie) return next();                                        // unauthenticated / pre-login (e.g. login, leads)
  if (!req.headers['x-requested-with']) {
    return res.status(403).json({ error: 'CSRF: state-changing requests need the X-Requested-With header' });
  }
  next();
}

/* ── login rate limit (in-memory; per email+ip) ────────────────────────── */
const attempts = new Map(); // key → [timestamps]
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 10);

export function loginAllowed(key) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((t) => now - t < WINDOW_MS);
  attempts.set(key, recent);
  return recent.length < MAX_ATTEMPTS;
}
export function recordLoginAttempt(key) {
  (attempts.get(key) || attempts.set(key, []).get(key)).push(Date.now());
}
/** Success clears the slate — the limiter punishes failed guesses, not
 *  legitimate activity (six smoke runs in a row must not lock ops out). */
export function clearLoginAttempts(key) { attempts.delete(key); }
