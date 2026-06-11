# Pipeline workers (Stage B3)

Each module is one stage of the internal operating system. They run as queue
workers (BullMQ/Redis or pg-boss recommended), never inside HTTP handlers.

| Order | Module          | Responsibility                                              |
|-------|-----------------|-------------------------------------------------------------|
| 1     | `ingest.js`     | Pull file/URL into object storage, probe duration/format    |
| 2     | `transcribe.js` | Provider-agnostic transcription (word-level timestamps)     |
| 3     | `analyze.js`    | NLP + multimodal pass: retention moments, emotional peaks, hooks, educational/storytelling segments |
| 4     | `score.js`      | Score candidates; later retrained on Stage B6 performance data |
| 5     | `generate.js`   | Cut clips, reframe (9:16), burn captions, hook variants, platform formatting |

Each worker: reads a job, updates `pipeline_jobs.stage_status`, writes outputs,
enqueues the next stage. Failures are retryable and visible in the ops dashboard.
