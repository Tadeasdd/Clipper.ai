-- Q4 — never recompute identical content. A content hash on transcripts lets a
-- re-submitted recording reuse a prior ASR result; a small keyed cache table
-- holds expensive analysis payloads keyed by (audio + transcript + model/prompt
-- version). Additive + nullable — offline drivers and existing rows untouched.
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS transcripts_content_hash_idx ON transcripts (content_hash);

CREATE TABLE IF NOT EXISTS compute_cache (
  cache_key   text PRIMARY KEY,
  kind        text NOT NULL,
  payload     jsonb NOT NULL,
  created_at  timestamptz DEFAULT now()
);
