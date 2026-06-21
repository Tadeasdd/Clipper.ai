/* C2 smoke: enterprise identity — SSO (OIDC), TOTP MFA, account-security policy.
   Proves the acceptance criteria end to end, all offline (zero external keys,
   zero network — the local test IdP signs/verifies real RS256 in-process):

     · TOTP MFA enrol → verify → MFA-gated login → recovery-code login → disable
     · per-client policy: mfa_required forces enrolment before a session is issued
     · account lockout trips after N failures and blocks even the right password
     · SSO local IdP: links an existing account, JIT-provisions by email domain,
       and refuses an identity no account/domain claims (403)
     · SAML is honestly unconfigured (501), not faked
     · sessions are listable + revocable; secrets never leave the API

   Re-runnable: every identity is namespaced by a per-run token. */
import pg from 'pg';
import { totp } from '../src/lib/totp.js';
import { opsSession, mintUser } from './lib-smoke-auth.mjs';

const BASE = process.env.BASE || 'http://localhost:8080';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });
const run = Math.random().toString(36).slice(2, 8);
const PW = 'smoke-first-password';

const j = async (method, p, body, token, headers = {}) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})), headers: res.headers };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

/* Walk an SSO redirect chain manually so we can observe the Set-Cookie the
   callback issues (the browser would follow these automatically). */
async function ssoWalk(startPath) {
  let url = BASE + startPath;
  let res, setCookie = null;
  for (let i = 0; i < 6; i++) {
    res = await fetch(url, { redirect: 'manual' });
    const sc = res.headers.get('set-cookie');
    if (sc) setCookie = sc;
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) { url = new URL(loc, BASE).toString(); continue; }
    break;
  }
  const token = (setCookie || '').match(/clipper_session=(\w+)/)?.[1] || null;
  return { status: res.status, token, data: await res.json().catch(() => ({})) };
}

const ops = await opsSession(BASE);
assert(ops, 'ops session established');

/* ── 1. self-service MFA: enrol → verify → MFA login → recovery → disable ── */
const mfaEmail = `mfa+${run}@clipper.ai`;
const u = await mintUser(BASE, ops, { email: mfaEmail, role: 'reviewer' });
assert(u.token, 'created a reviewer who can sign in with a password');

let r = await j('POST', '/api/auth/mfa/enroll', null, u.token);
assert(r.status === 200 && /^[A-Z2-7]+$/.test(r.data.secret) && r.data.otpauthUri.startsWith('otpauth://'),
  'enrol returns a base32 secret + otpauth URI');
const secret = r.data.secret;

r = await j('POST', '/api/auth/mfa/verify', { code: '000000' }, u.token);
assert(r.status === 400, 'a wrong code does not enable MFA');
r = await j('POST', '/api/auth/mfa/verify', { code: totp(secret) }, u.token);
assert(r.status === 200 && Array.isArray(r.data.recoveryCodes) && r.data.recoveryCodes.length >= 8,
  'a correct code enables MFA and returns recovery codes');
const recoveryCodes = r.data.recoveryCodes;

r = await j('POST', '/api/auth/login', { email: mfaEmail, password: PW });
assert(r.status === 200 && r.data.mfaRequired === true && r.data.challenge && !r.data.token,
  'password login by an MFA user returns a challenge, not a session');

let bad = await j('POST', '/api/auth/mfa/login', { challenge: r.data.challenge, code: '000000' });
assert(bad.status === 401, 'a wrong TOTP code does not complete the login');
r = await j('POST', '/api/auth/mfa/login', { challenge: r.data.challenge, code: totp(secret) });
assert(r.status === 200 && r.data.token && r.data.user.email === mfaEmail,
  'a correct TOTP code completes the login and issues a session');
let mfaToken = r.data.token;

// recovery-code path (single-use)
r = await j('POST', '/api/auth/login', { email: mfaEmail, password: PW });
r = await j('POST', '/api/auth/mfa/login', { challenge: r.data.challenge, code: recoveryCodes[0] });
assert(r.status === 200 && r.data.token, 'a recovery code completes the login');
mfaToken = r.data.token;
r = await j('POST', '/api/auth/login', { email: mfaEmail, password: PW });
r = await j('POST', '/api/auth/mfa/login', { challenge: r.data.challenge, code: recoveryCodes[0] });
assert(r.status === 401, 'a recovery code is single-use — the second attempt is refused');

r = await j('GET', '/api/auth/me', null, mfaToken);
assert(r.status === 200 && r.data.user.mfa_secret === undefined && r.data.user.mfaSecret === undefined,
  'the TOTP secret never leaves via /me');

r = await j('POST', '/api/auth/mfa/disable', { code: totp(secret) }, mfaToken);
assert(r.status === 200, 'MFA can be disabled with a current code');
r = await j('POST', '/api/auth/login', { email: mfaEmail, password: PW });
assert(r.status === 200 && r.data.token && !r.data.mfaRequired, 'after disable, password login issues a session directly');

/* ── 2. per-client policy: mfa_required forces enrolment before a session ── */
const cli = (await j('POST', '/api/clients', { name: `Identity Policy Co ${run}` }, ops)).data.id;
await db.query('UPDATE clients SET mfa_required = true WHERE id = $1', [cli]);
const polEmail = `pol+${run}@clipper.ai`;
// Create the account directly (no login): the policy below blocks a session, so
// mintUser's login step would fail — that block is exactly what we're testing.
r = await j('POST', '/api/users', { email: polEmail, role: 'client', clientId: cli, password: PW }, ops);
assert(r.status === 201, 'policy client account created');
r = await j('POST', '/api/auth/login', { email: polEmail, password: PW });
assert(r.status === 200 && r.data.mfaEnrolmentRequired === true && r.data.challenge && !r.data.token,
  'a client under an mfa_required policy gets no session until enrolled');
const enrolChallenge = r.data.challenge;
r = await j('POST', '/api/auth/mfa/setup', { challenge: enrolChallenge });
assert(r.status === 200 && r.data.secret, 'policy-forced enrolment hands back a secret without a session');
const polSecret = r.data.secret;
r = await j('POST', '/api/auth/mfa/setup/confirm', { challenge: enrolChallenge, code: totp(polSecret) });
assert(r.status === 200 && r.data.recoveryCodes, 'policy-forced enrolment completes with recovery codes');
r = await j('POST', '/api/auth/login', { email: polEmail, password: PW });
r = await j('POST', '/api/auth/mfa/login', { challenge: r.data.challenge, code: totp(polSecret) });
assert(r.status === 200 && r.data.token, 'the now-enrolled client can complete an MFA login');

/* ── 3. account lockout: N failures lock the account, right password blocked ─ */
const lockEmail = `lock+${run}@clipper.ai`;
await mintUser(BASE, ops, { email: lockEmail, role: 'reviewer' });
let locked = false;
for (let i = 0; i < 7; i++) {
  const res = await j('POST', '/api/auth/login', { email: lockEmail, password: 'definitely-wrong' });
  if (res.status === 423) { locked = true; break; }
}
assert(locked, 'repeated wrong passwords lock the account (423)');
r = await j('POST', '/api/auth/login', { email: lockEmail, password: PW });
assert(r.status === 423, 'while locked, even the correct password is refused');

/* ── 4. SSO via the local test IdP ────────────────────────────────────────── */
// (a) link an existing account by email
const linkEmail = `sso.link+${run}@clipper.ai`;
await mintUser(BASE, ops, { email: linkEmail, role: 'editor' });
let s = await ssoWalk(`/api/auth/sso/local/start?email=${encodeURIComponent(linkEmail)}`);
assert(s.token, 'SSO login against the local test IdP issues a session cookie');
r = await j('GET', '/api/auth/me', null, s.token);
assert(r.status === 200 && r.data.user.email === linkEmail && r.data.user.role === 'editor',
  'SSO links to the existing account (role preserved)');

// (b) JIT-provision a client user by sso_domain
const jitCli = (await j('POST', '/api/clients', { name: `JIT Co ${run}` }, ops)).data.id;
const domain = `jit-${run}.test`;
await db.query('UPDATE clients SET sso_domain = $2 WHERE id = $1', [jitCli, domain]);
const jitEmail = `newperson@${domain}`;
s = await ssoWalk(`/api/auth/sso/local/start?email=${encodeURIComponent(jitEmail)}`);
assert(s.token, 'SSO JIT login issues a session');
r = await j('GET', '/api/auth/me', null, s.token);
assert(r.status === 200 && r.data.user.email === jitEmail && r.data.user.clientId === jitCli && r.data.user.role === 'client',
  'an unknown email under a claimed domain is JIT-provisioned as that client');

// (c) an identity no account and no domain claims is refused
s = await ssoWalk(`/api/auth/sso/local/start?email=${encodeURIComponent(`stranger+${run}@nobody-${run}.test`)}`);
assert(s.status === 403 && !s.token, 'an unclaimed SSO identity is refused (403), not silently provisioned');

// (d) SAML is honestly unconfigured
s = await ssoWalk('/api/auth/sso/saml/start');
assert(s.status === 501, 'SAML is not configured — an honest 501, not a fake login');

/* ── 5. session management: list + revoke ─────────────────────────────────── */
const mgrEmail = `mgr+${run}@clipper.ai`;
const mgr = await mintUser(BASE, ops, { email: mgrEmail, role: 'reviewer' });
const second = (await j('POST', '/api/auth/login', { email: mgrEmail, password: PW })).data.token;
r = await j('GET', '/api/auth/sessions', null, mgr.token);
assert(r.status === 200 && r.data.sessions.length >= 2 && r.data.sessions.some((x) => x.current),
  'a user can list their active sessions, current one flagged');
assert(r.data.sessions.every((x) => x.token_hash === undefined),
  'the session list never exposes the token hash');
const other = r.data.sessions.find((x) => !x.current && x.id);
r = await j('DELETE', `/api/auth/sessions/${other.id}`, null, mgr.token);
assert(r.status === 200, 'a specific session can be revoked by id');
r = await j('GET', '/api/auth/me', null, second);
assert(r.status === 401, 'the revoked session is dead server-side');
r = await j('POST', '/api/auth/sessions/revoke-others', {}, mgr.token);
assert(r.status === 200 && typeof r.data.revoked === 'number', 'sign-out-everywhere-else revokes the rest');

await db.end();
console.log('\nC2 smoke passed: SSO + TOTP MFA + lockout + session management — real crypto, offline, nothing faked.');
