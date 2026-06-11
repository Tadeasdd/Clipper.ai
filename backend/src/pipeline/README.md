# Pipeline (Stage B3)

`pipeline_jobs` in Postgres IS the queue — `queue.js` claims rows with
`FOR UPDATE SKIP LOCKED`, runs the stage handler, enqueues the next stage,
and retries failures with backoff (3 attempts, then parked as `failed` for
the ops retry button). Run in-process with the API (default) or as separate
processes via `npm run worker`; SKIP LOCKED makes any mix safe.

ingest → transcribe → analyze → score → generate · see each module's header
for what's real today vs. provider-gated (ASR via `TRANSCRIPTION_PROVIDER`,
hooks via `LLM_PROVIDER`).
