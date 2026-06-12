-- Stage B5 — publishing.
-- platform_connections: one per client per platform; credentials are an
-- AES-256-GCM blob (lib/crypto.js) — never stored or returned in plaintext.
CREATE TABLE platform_connections (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id),
  platform        TEXT NOT NULL CHECK (platform IN ('youtube','tiktok','instagram','linkedin','x')),
  handle          TEXT,                -- display only: @channel / page name
  credentials_enc TEXT NOT NULL,       -- encrypted OAuth tokens / API creds
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, platform)
);

-- publish_jobs grows into a real queue, same shape as pipeline_jobs:
-- claimed with FOR UPDATE SKIP LOCKED, 3-attempt backoff, parked as 'failed',
-- revivable from the ops queue.
ALTER TABLE publish_jobs
  ADD COLUMN connection_id TEXT REFERENCES platform_connections(id),
  ADD COLUMN external_url  TEXT,
  ADD COLUMN attempts      INT NOT NULL DEFAULT 0,
  ADD COLUMN run_after     TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN error         TEXT,
  ADD COLUMN created_at    TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN updated_at    TIMESTAMPTZ DEFAULT now();

ALTER TABLE publish_jobs
  ADD CONSTRAINT publish_jobs_status_check
  CHECK (status IN ('scheduled','publishing','published','failed','canceled'));

-- one publish per clip per platform; rescheduling re-arms the row
ALTER TABLE publish_jobs ADD CONSTRAINT publish_jobs_clip_platform UNIQUE (clip_id, platform);

CREATE INDEX publish_jobs_claim ON publish_jobs (status, run_after);
