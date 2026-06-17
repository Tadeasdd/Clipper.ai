-- M4 — idempotent intake. A double-submitted form (or a paste-the-same-URL
-- retry) must not create duplicate recordings. The key is the client-supplied
-- Idempotency-Key when present, else one derived from the source URL; the
-- partial unique index makes the dedupe race-proof at the database, not in app
-- logic. Rows without a key (e.g. file uploads with no header) are unconstrained.
ALTER TABLE recordings ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX recordings_client_idem_uq
  ON recordings (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
