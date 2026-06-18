-- Q5 — online quality calibration. A time series of how well clips.score
-- predicted realized performance, so silent drift (a model update, a content-mix
-- shift) shows up as a decaying number. A snapshot flagged drift=true is the
-- alert/review record. Additive — nothing else changes.
CREATE TABLE IF NOT EXISTS calibration_snapshots (
  id          text PRIMARY KEY,
  captured_at timestamptz DEFAULT now(),
  value       numeric,          -- Spearman(score, perf) over the recent window; null below the sample gate
  sample      integer NOT NULL DEFAULT 0,
  baseline    numeric,          -- the prior snapshot's value (what we compare against)
  drift       boolean NOT NULL DEFAULT false,
  detail      jsonb
);
CREATE INDEX IF NOT EXISTS calibration_snapshots_captured_idx ON calibration_snapshots (captured_at DESC);
