-- C2 — enterprise identity: SSO (OIDC), TOTP MFA, account-security policy.
-- Extends the B7 auth machinery (008_auth.sql) — never rewrites it. Every column
-- is additive with a safe default so existing accounts keep working untouched:
-- MFA and SSO are opt-in / policy-gated and default OFF, so password login is
-- byte-for-byte what it was. Forward-only, idempotent.

-- ── users: MFA enrolment, account lockout, SSO linkage ──────────────────────
-- mfa_secret holds the AES-256-GCM ciphertext of the TOTP shared secret (the
-- same lib/crypto.js envelope publish credentials use) — never the plaintext.
-- mfa_pending_secret is the not-yet-confirmed secret during enrolment; it is
-- promoted to mfa_secret + mfa_enabled only after the holder proves one code.
-- mfa_recovery_codes is a JSON array of sha256(code) — single-use backup codes
-- (we store the hash, exactly like sessions store sha256(token)).
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_codes JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts    INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until       TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider       TEXT;   -- 'local' | 'oidc' | 'saml'
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_subject        TEXT;   -- the IdP 'sub' claim

-- One IdP subject maps to at most one account (linkage is unique per provider).
CREATE UNIQUE INDEX IF NOT EXISTS users_sso_subject_idx
  ON users (sso_provider, sso_subject) WHERE sso_subject IS NOT NULL;

-- ── clients: per-tenant identity policy ─────────────────────────────────────
-- mfa_required forces a client's users to enrol MFA before they can finish a
-- login. sso_domain enables JIT provisioning: an SSO login whose verified email
-- domain matches is auto-created as a client user under that tenant.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sso_provider TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sso_domain   TEXT;   -- e.g. 'acme.com'

-- ── sessions: management UX (list + revoke) needs a public handle + context ──
-- token_hash stays the PK (a leaked sessions table still mints nothing); id is
-- a non-secret handle the holder can see and revoke by. ip/user_agent/auth_method
-- give the security panel something honest to show; last_seen_at powers it.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id           TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip           TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent   TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_method  TEXT;   -- 'password' | 'mfa' | 'sso' | 'recovery'
CREATE UNIQUE INDEX IF NOT EXISTS sessions_id_idx ON sessions (id) WHERE id IS NOT NULL;

-- ── OIDC code-flow transactions (short-lived, server-side) ──────────────────
-- The authorize→callback round trip carries state/nonce/PKCE. We keep them in
-- the DB (not a cookie) so the callback can validate them and they expire.
CREATE TABLE IF NOT EXISTS sso_transactions (
  state          TEXT PRIMARY KEY,
  provider       TEXT NOT NULL,
  nonce          TEXT NOT NULL,
  pkce_verifier  TEXT,
  redirect_to    TEXT,                 -- where to land the browser after success
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  consumed_at    TIMESTAMPTZ           -- single-use: set on callback
);
CREATE INDEX IF NOT EXISTS sso_transactions_expires_idx ON sso_transactions (expires_at);
