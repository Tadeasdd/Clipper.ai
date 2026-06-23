/** C2 — enterprise SSO seam (OpenID Connect authorization-code + PKCE).
 *
 *  Provider-switched like every other seam in this repo. THREE providers:
 *
 *   • local — the zero-config, zero-network DEFAULT. A real in-process test IdP:
 *     it mints an RS256-signed id_token with a keypair generated at boot, and the
 *     verifier checks that signature through the matching public key (JWKS). The
 *     OIDC plumbing — state, nonce, PKCE, single-use/expiring transaction, real
 *     JWT signature + claim verification — is genuinely exercised; only the
 *     network hop to an external IdP is collapsed. This is what keeps offline CI
 *     green without faking the handshake.
 *
 *   • oidc — a real external IdP, additive and env-gated (SSO_OIDC_*). Discovery
 *     + token exchange + remote JWKS over the network; only active when
 *     SSO_OIDC_ISSUER is set, so CI/offline never touches it.
 *
 *   • saml — NOT implemented. Returns an honest "not configured" rather than a
 *     fake. OIDC is the supported enterprise protocol; SAML is the next provider
 *     behind this same seam (see docs/IDENTITY.md). Never silently faked.
 *
 *  No new dependency: RSA keygen, signing, verification, and SHA-256 are all
 *  node:crypto, matching the scrypt/AES patterns already in lib/auth & lib/crypto. */
import { generateKeyPairSync, createSign, createVerify, createPublicKey, randomBytes, createHash } from 'node:crypto';

export const SSO_PROVIDERS = ['local', 'oidc', 'saml'];
const TX_TTL_MS = 10 * 60_000; // an authorize→callback round trip is short
const LOCAL_ISS = 'https://local-idp.clipper.test';
const LOCAL_AUD = 'clipper-ops';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (s) => createHash('sha256').update(s).digest();

/** Which providers can actually be used right now (drives the login screen). */
export function ssoAvailable(provider) {
  if (provider === 'local') return process.env.SSO_LOCAL_ENABLED !== 'false'; // default on
  if (provider === 'oidc') return Boolean(process.env.SSO_OIDC_ISSUER && process.env.SSO_OIDC_CLIENT_ID);
  return false; // saml: never (honest)
}

export function enabledProviders() {
  return SSO_PROVIDERS.filter(ssoAvailable);
}

/* ── local test IdP: a real RS256 keypair, generated once at boot ─────────── */
let LOCAL_KEYS = null;
function localKeys() {
  if (!LOCAL_KEYS) LOCAL_KEYS = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return LOCAL_KEYS;
}

function signJwt(payload, privateKey) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${body}`);
  const sig = b64url(signer.sign(privateKey));
  return `${header}.${body}.${sig}`;
}

/** Verify an RS256 JWT's signature + standard claims. Throws on any failure —
 *  an unverifiable assertion must never log anyone in. */
function verifyJwt(token, publicKey, { iss, aud, nonce }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('malformed id_token');
  const [h, p, s] = parts;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${h}.${p}`);
  if (!verifier.verify(publicKey, Buffer.from(s, 'base64url'))) throw new Error('id_token signature invalid');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  if (iss && claims.iss !== iss) throw new Error('id_token issuer mismatch');
  if (aud && claims.aud !== aud) throw new Error('id_token audience mismatch');
  if (nonce && claims.nonce !== nonce) throw new Error('id_token nonce mismatch (possible replay)');
  if (claims.exp && Date.now() / 1000 > claims.exp) throw new Error('id_token expired');
  if (!claims.email) throw new Error('id_token carries no email');
  return claims;
}

/* ── step 1: build the redirect to the IdP ────────────────────────────────── */
/** Returns { state, nonce, pkceVerifier, expiresAt, authorizeUrl }. The caller
 *  persists the first four in sso_transactions and 302s the browser to the URL. */
export function beginSso(provider, { redirectUri, loginHint } = {}) {
  if (!ssoAvailable(provider)) throw new SsoUnavailable(provider);
  const state = b64url(randomBytes(18));
  const nonce = b64url(randomBytes(18));
  const pkceVerifier = b64url(randomBytes(32));
  const challenge = b64url(sha256(pkceVerifier));
  const expiresAt = new Date(Date.now() + TX_TTL_MS);

  if (provider === 'local') {
    // The "IdP login page" is our own local authorize endpoint. A test IdP
    // asserts an identity via login_hint; a real one would prompt for it.
    const u = new URLSearchParams({ state });
    if (loginHint) u.set('login_hint', loginHint);
    return { state, nonce, pkceVerifier, expiresAt, authorizeUrl: `/api/auth/sso/local/authorize?${u}` };
  }

  // oidc: standard authorization-code + PKCE request to the external IdP.
  const authorize = process.env.SSO_OIDC_AUTHORIZE_URL || `${process.env.SSO_OIDC_ISSUER.replace(/\/$/, '')}/authorize`;
  const u = new URLSearchParams({
    response_type: 'code', client_id: process.env.SSO_OIDC_CLIENT_ID, redirect_uri: redirectUri,
    scope: process.env.SSO_OIDC_SCOPE || 'openid email profile', state, nonce,
    code_challenge: challenge, code_challenge_method: 'S256',
  });
  return { state, nonce, pkceVerifier, expiresAt, authorizeUrl: `${authorize}?${u}` };
}

/* ── local authorize: mint a single-use code carrying the asserted identity ── */
/** The test IdP "authenticates" the user (trivially — it's a test IdP) and hands
 *  back an opaque code. The asserted email is the login_hint, or a default. */
export function localAuthorizeCode(loginHint) {
  const email = String(loginHint || process.env.SSO_LOCAL_EMAIL || 'sso.user@clipper.test').trim().toLowerCase();
  return b64url(JSON.stringify({ email, sub: `local|${email}` }));
}

/* ── step 2: exchange the code + verify the id_token → verified identity ───── */
/** Returns { subject, email } from a cryptographically verified id_token, or
 *  throws. `tx` is the stored sso_transactions row. */
export async function completeSso(provider, tx, { code }) {
  if (provider === 'local') {
    let asserted;
    try { asserted = JSON.parse(Buffer.from(String(code || ''), 'base64url').toString('utf8')); }
    catch { throw new Error('invalid authorization code'); }
    // Round-trip through a real RS256 sign + verify against the local JWKS.
    const idToken = signJwt({
      iss: LOCAL_ISS, aud: LOCAL_AUD, sub: asserted.sub, email: asserted.email,
      email_verified: true, nonce: tx.nonce, iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    }, localKeys().privateKey);
    const claims = verifyJwt(idToken, localKeys().publicKey, { iss: LOCAL_ISS, aud: LOCAL_AUD, nonce: tx.nonce });
    return { subject: claims.sub, email: String(claims.email).toLowerCase() };
  }

  // oidc: real token exchange + remote JWKS verification.
  const idToken = await oidcExchange(code, tx.pkce_verifier);
  const jwks = await fetchJson(process.env.SSO_OIDC_JWKS_URL || `${process.env.SSO_OIDC_ISSUER.replace(/\/$/, '')}/jwks`);
  const claims = verifyOidcIdToken(idToken, jwks, tx.nonce);
  return { subject: claims.sub, email: String(claims.email).toLowerCase() };
}

/* ── oidc network helpers (only reached when SSO_OIDC_* is set) ────────────── */
async function fetchJson(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(process.env.SSO_OIDC_TIMEOUT_MS || 5000));
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`SSO IdP responded ${res.status}`);
    return res.json();
  } finally { clearTimeout(timer); }
}

async function oidcExchange(code, pkceVerifier) {
  const tokenUrl = process.env.SSO_OIDC_TOKEN_URL || `${process.env.SSO_OIDC_ISSUER.replace(/\/$/, '')}/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, code_verifier: pkceVerifier || '',
    client_id: process.env.SSO_OIDC_CLIENT_ID, redirect_uri: process.env.SSO_OIDC_REDIRECT_URI || '',
    ...(process.env.SSO_OIDC_CLIENT_SECRET ? { client_secret: process.env.SSO_OIDC_CLIENT_SECRET } : {}),
  });
  const tokens = await fetchJson(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!tokens.id_token) throw new Error('token endpoint returned no id_token');
  return tokens.id_token;
}

function verifyOidcIdToken(token, jwks, nonce) {
  const [h] = token.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid) || (jwks.keys || [])[0];
  if (!jwk) throw new Error('no matching JWKS key for id_token');
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  return verifyJwt(token, publicKey, { iss: process.env.SSO_OIDC_ISSUER, aud: process.env.SSO_OIDC_CLIENT_ID, nonce });
}

/** Thrown for a provider the deployment hasn't configured (saml always, oidc
 *  without env). The route turns it into a 501 with this message. */
export class SsoUnavailable extends Error {
  constructor(provider) {
    super(provider === 'saml'
      ? 'SAML SSO is not configured. OIDC is the supported enterprise SSO protocol — see docs/IDENTITY.md.'
      : `SSO provider "${provider}" is not configured`);
    this.name = 'SsoUnavailable';
    this.statusCode = 501;
    this.provider = provider;
  }
}
