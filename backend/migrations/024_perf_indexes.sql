-- P5 — index audit. `review_events` (migration 001) carried only its primary key,
-- yet its foreign keys are the join/filter columns on every hot read of it:
--   * clip_id     — analytics margin + sign-off joins (routes/analytics.js, routes/review.js)
--   * reviewer_id — reviewer throughput in capacity/health/labels, plus the review audit
-- Postgres does NOT auto-index foreign keys, so both were sequential scans
-- (proven by scripts/smoke-perf.mjs with enable_seqscan=off). Add them.
--
-- The reviewer index is composite (reviewer_id, created_at DESC) so it also serves
-- the time-windowed reviewer rollups (this-month vs last-month counts) without a
-- second index. Forward-only, idempotent.

CREATE INDEX IF NOT EXISTS review_events_clip_idx ON review_events (clip_id);
CREATE INDEX IF NOT EXISTS review_events_reviewer_idx ON review_events (reviewer_id, created_at DESC);
