# Identity & Account Security (C2)

Enterprise identity on top of the B7 auth core (`lib/auth.js`, `008_auth.sql`):
SSO, TOTP MFA, and account-security policy. Everything here is **opt-in and
policy-gated** — with nothing configured, password login behaves exactly as it
did in B7, and CI/offline dev needs zero external keys and zero network.

Migration: `026_identity.sql`. New libs: `lib/totp.js`, `lib/lockout.js`,
`lib/password-policy.js`, `lib/sso.js`. No new dependencies — RSA/HMAC/scrypt/AES
all come from `node:crypto`, matching the existing patterns.

## Multi-factor authentication (TOTP, RFC 6238)

- **Enrol (self-service):** `POST /api/auth/mfa/enroll` → `{ secret, otpauthUri }`.
  Load the secret into any authenticator app, then `POST /api/auth/mfa/verify
  { code }` → one-time **recovery codes** (shown once, stored as sha256).
- **Login:** a password login by an MFA-enabled user returns
  `{ mfaRequired, challenge }` — *not* a session. Complete it with
  `POST /api/auth/mfa/login { challenge, code }`, where `code` is a TOTP **or** a
  single-use recovery code.
- **Disable:** `POST /api/auth/mfa/disable { code }` (refused if policy requires MFA).
- **Secret at rest:** AES-256-GCM via `lib/crypto.js`; the plaintext secret leaves
  the API exactly once, at enrolment, for the holder to load into their app.

### Per-client policy

`clients.mfa_required = true` forces every user under that client to enrol before
a session is issued: their password login returns `{ mfaEnrolmentRequired,
challenge }`, and enrolment is completed via `POST /api/auth/mfa/setup` +
`/api/auth/mfa/setup/confirm` (challenge-driven — no half-privileged session is
ever minted). Global override: `MFA_REQUIRED=true`.

## Account-security policy

- **Password policy** (`lib/password-policy.js`): minimum length
  (`PASSWORD_MIN_LENGTH`, default 8) + a small common-password blocklist, enforced
  uniformly at bootstrap, account creation, and password change.
- **Account lockout** (`lib/lockout.js`): `ACCOUNT_LOCKOUT_THRESHOLD` (default 5)
  consecutive failures lock the account for `ACCOUNT_LOCKOUT_MINUTES` (default 15).
  This is durable and account-scoped — complementary to the existing in-memory
  per-(email+ip) rate limit, which is burst-scoped and forgetful. A successful
  sign-in (or a spent recovery code) clears the counter.

## Session management

- `GET /api/auth/sessions` — your active sessions (method, ip, user-agent, last
  seen; current one flagged). Never exposes the token or its hash.
- `DELETE /api/auth/sessions/:id` — revoke one by its public id.
- `POST /api/auth/sessions/revoke-others` — sign out everywhere else.

Ops UI: **/ops → Security**. Self-service MFA enrol/disable and the session list
live there, styled with the existing design tokens (no visual change elsewhere).

## SSO (OpenID Connect)

A provider-switched seam (`lib/sso.js`). Authorization-code flow with PKCE,
state + nonce, single-use/expiring transactions (`sso_transactions`), and **real
RS256 id_token signature + claim verification**.

| Provider | Status | Notes |
|----------|--------|-------|
| `local`  | **default, offline** | A real in-process test IdP: signs an RS256 id_token with a boot-generated keypair and verifies it through the matching JWKS. The whole OIDC handshake (state/nonce/PKCE/JWT verify) is exercised; only the network hop is collapsed. This keeps CI green with no keys. |
| `oidc`   | real, env-gated | An external IdP. Active only when `SSO_OIDC_ISSUER` + `SSO_OIDC_CLIENT_ID` are set; CI/offline never touches the network. |
| `saml`   | **not implemented** | Returns an honest `501`. SAML is the next provider behind this same seam — never faked. |

**Flow:** `GET /api/auth/sso/:provider/start` → IdP → `…/callback` →
verify → resolve identity → session cookie → redirect into the app.

**Identity resolution (never silently mints an internal account):**
1. match a linked IdP subject (`users.sso_provider` + `sso_subject`);
2. else link to an existing account by verified email;
3. else **JIT-provision** a `client` user under a client whose `sso_domain` owns
   the email domain;
4. else **403** — an unclaimed identity gets no access.

### Configuring a real OIDC IdP

```
SSO_OIDC_ISSUER=https://idp.example.com
SSO_OIDC_CLIENT_ID=...
SSO_OIDC_CLIENT_SECRET=...           # optional (public clients use PKCE only)
SSO_OIDC_REDIRECT_URI=https://app.example.com/api/auth/sso/oidc/callback
PUBLIC_BASE_URL=https://app.example.com
# optional explicit endpoints if discovery isn't used:
# SSO_OIDC_AUTHORIZE_URL / SSO_OIDC_TOKEN_URL / SSO_OIDC_JWKS_URL
```

## Verify

```bash
cd backend && npm run smoke:identity     # SSO + MFA + lockout + sessions, fully offline
```
