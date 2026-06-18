-- Q2 — AI provenance. Stamp every AI artifact with which producer made it:
-- the ASR provider/model on a transcript, and the semantic prompt version +
-- hash + model on each clip's signals. Nullable + additive — existing rows and
-- the offline drivers are untouched; the column simply fills going forward.
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS ai_provenance jsonb;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_provenance jsonb;
