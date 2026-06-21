-- C1 — content lifecycle. Per-client retention window for stored media; null means
-- "use the global default" (CONTENT_RETENTION_DAYS env; unset/0 = keep forever).
-- The retention sweep (lib/retention.js) and GDPR erasure delete the actual rows
-- + storage objects; this migration only adds the policy column + the index the
-- sweep scans. Forward-only.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS retention_days INT;  -- null = global default

-- The sweep finds recordings older than their client's retention window.
CREATE INDEX IF NOT EXISTS recordings_created_idx ON recordings (created_at);
