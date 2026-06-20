-- U4 — clip feedback capture. The FeedbackWidget rated clips but faked its
-- submit (setTimeout, no persistence). This is the real store behind it: one
-- row per thumbs-up/down on a job's clips, with an optional note. Public-origin
-- (the widget lives on the marketing/studio surface), so it carries no identity
-- requirement — request meta (ip/ua) is kept for abuse triage, like leads.
CREATE TABLE IF NOT EXISTS feedback (
  id         text PRIMARY KEY,
  job_id     text,                                         -- the rated job/clip batch (free-form; no FK — origin is public)
  rating     text NOT NULL CHECK (rating IN ('up', 'down')),
  note       text,
  meta       jsonb NOT NULL DEFAULT '{}',                  -- { ip, ua } for triage
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_job_idx ON feedback (job_id, created_at DESC);
