-- Stage B7 — auth, roles, hardening.
-- users gain credentials; sessions are server-side rows (revocable, expiring)
-- keyed by the HASH of the token — a leaked sessions table mints nothing.
ALTER TABLE users ADD COLUMN password_hash TEXT;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,          -- sha256(token); the token itself never lands in the DB
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX sessions_user ON sessions (user_id);

-- "every publish is attributable" (the B7 done-criterion): who put it in
-- the queue — a human scheduling from ops, or the approver whose sign-off
-- auto-scheduled it.
ALTER TABLE publish_jobs ADD COLUMN scheduled_by TEXT REFERENCES users(id);
