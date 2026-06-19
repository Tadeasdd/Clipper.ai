-- E1 — per-job cost ledger. One row per resource consumed by a stage (ASR
-- seconds, LLM tokens in/out, render CPU ms, stored/egress bytes), priced to a
-- USD figure. client_id is denormalized so costs roll up to the client without
-- a join. Append-only; an itemized recording cost is the sum of its rows.
CREATE TABLE IF NOT EXISTS cost_entries (
  id            text PRIMARY KEY,
  recording_id  text REFERENCES recordings(id),
  client_id     text REFERENCES clients(id),
  stage         text NOT NULL,            -- transcribe | analyze | generate | ingest | serve
  resource      text NOT NULL,            -- asr_seconds | llm_tokens_in | llm_tokens_out | cpu_ms | storage_bytes | egress_bytes
  quantity      numeric NOT NULL,
  unit_cost_usd numeric NOT NULL,
  cost_usd      numeric NOT NULL,
  meta          jsonb,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cost_entries_recording_idx ON cost_entries (recording_id);
CREATE INDEX IF NOT EXISTS cost_entries_client_idx ON cost_entries (client_id);
