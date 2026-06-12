-- Stage B6.1 — metrics ingestion.
-- publish_jobs gets a capture clock: the poller claims published jobs whose
-- metrics_next_at has passed (FOR UPDATE SKIP LOCKED, same pattern as every
-- other queue here), appends a clip_metrics row, and pushes the clock to the
-- next interval. Set to now() the moment a job publishes → first capture is
-- immediate, so reports and the loop have data without waiting a cycle.
ALTER TABLE publish_jobs ADD COLUMN metrics_next_at TIMESTAMPTZ;

-- jobs published before this migration join the rotation now
UPDATE publish_jobs SET metrics_next_at = now() WHERE status = 'published';

CREATE INDEX publish_jobs_metrics_claim ON publish_jobs (status, metrics_next_at);
CREATE INDEX clip_metrics_series ON clip_metrics (publish_id, captured_at DESC);
