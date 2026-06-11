-- Stage B3 — pipeline orchestration columns.
-- pipeline_jobs becomes a real Postgres-native queue: workers claim rows with
-- FOR UPDATE SKIP LOCKED, chain stages, and retry with backoff. One row per
-- (recording, stage); retries reuse the row so the ops board shows attempts.
ALTER TABLE pipeline_jobs
  ADD COLUMN run_after  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN payload    JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE pipeline_jobs
  ADD CONSTRAINT pipeline_jobs_one_per_stage UNIQUE (recording_id, stage);

CREATE INDEX pipeline_jobs_claim ON pipeline_jobs (status, run_after);

-- Where the analyze stage stores its raw signal, so score/generate (and the
-- ops board) can explain WHY a moment was picked.
ALTER TABLE recordings ADD COLUMN media_info JSONB DEFAULT '{}';
