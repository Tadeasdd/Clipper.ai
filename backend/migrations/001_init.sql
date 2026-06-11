-- Clipper.ai operations schema (Stage B1)
-- Postgres. Mirrors the internal operating system end-to-end.

CREATE TABLE clients (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  plan          TEXT,                 -- scoped on the strategy call; priced on output
  cadence       TEXT,                 -- e.g. 'weekly'
  brand_config  JSONB DEFAULT '{}',   -- caption style, fonts, platform handles
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('ops','editor','reviewer','account_manager','client')),
  client_id  TEXT REFERENCES clients(id),   -- only for role = 'client'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1. Ingest
CREATE TABLE recordings (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id),
  source_url  TEXT,
  storage_key TEXT,                  -- S3 object for the raw long-form
  duration_s  INT,
  kind        TEXT,                  -- podcast | interview | livestream | webinar | youtube
  status      TEXT NOT NULL DEFAULT 'queued',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2–6. Pipeline orchestration
CREATE TABLE pipeline_jobs (
  id           TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL REFERENCES recordings(id),
  stage        TEXT NOT NULL,        -- ingest | transcribe | analyze | score | generate
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | running | done | failed
  attempts     INT DEFAULT 0,
  error        TEXT,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ
);

CREATE TABLE transcripts (
  recording_id TEXT PRIMARY KEY REFERENCES recordings(id),
  provider     TEXT,
  words        JSONB,                -- word-level timestamps
  text         TEXT
);

-- 4–6. Candidates and generated assets
CREATE TABLE clips (
  id           TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL REFERENCES recordings(id),
  t_start_s    NUMERIC NOT NULL,
  t_end_s      NUMERIC NOT NULL,
  score        NUMERIC,              -- model score; retrained from performance data
  signals      JSONB,                -- retention/emotional/controversial/educational/story/hook
  hook         TEXT,
  captions     JSONB,
  format       TEXT,                 -- 9:16 | 1:1 | 16:9 variants
  asset_key    TEXT,                 -- rendered output in object storage
  status       TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','awaiting_review','changes_requested','approved_internal',
                      'awaiting_client','approved','rejected','scheduled','published')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 7. Human review (internal QA, then client approval)
CREATE TABLE review_events (
  id          TEXT PRIMARY KEY,
  clip_id     TEXT NOT NULL REFERENCES clips(id),
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  decision    TEXT NOT NULL CHECK (decision IN ('approve','reject','changes')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 8. Publishing
CREATE TABLE publish_jobs (
  id           TEXT PRIMARY KEY,
  clip_id      TEXT NOT NULL REFERENCES clips(id),
  platform     TEXT NOT NULL,        -- youtube | tiktok | instagram | linkedin | x
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_id  TEXT,                 -- platform post id
  status       TEXT NOT NULL DEFAULT 'scheduled'
);

-- 9–10. Performance measurement → feedback into scoring
CREATE TABLE clip_metrics (
  id           TEXT PRIMARY KEY,
  publish_id   TEXT NOT NULL REFERENCES publish_jobs(id),
  captured_at  TIMESTAMPTZ DEFAULT now(),
  views        BIGINT,
  watch_time_s BIGINT,
  retention    NUMERIC,
  likes        BIGINT,
  comments     BIGINT,
  shares       BIGINT,
  follows      BIGINT
);

CREATE INDEX ON recordings (client_id, status);
CREATE INDEX ON pipeline_jobs (recording_id, stage);
CREATE INDEX ON clips (recording_id, status);
CREATE INDEX ON publish_jobs (platform, status, scheduled_at);
