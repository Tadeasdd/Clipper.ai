-- M5 — queue reliability. A job that exhausts its retries (or is reaped one too
-- many times) parks as 'failed' AND is flagged dead_letter, so the ops board can
-- separate "still retrying with backoff" from "needs a human". A transient
-- failure on its way back to pending is never dead_letter.
ALTER TABLE pipeline_jobs ADD COLUMN dead_letter BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE publish_jobs  ADD COLUMN dead_letter BOOLEAN NOT NULL DEFAULT false;
