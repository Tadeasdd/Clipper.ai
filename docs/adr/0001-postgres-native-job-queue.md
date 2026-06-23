# ADR-0001 — Postgres-native job queue (no Redis/BullMQ)

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

The pipeline needs durable background work (ingest → transcribe → analyze → score
→ generate), plus publish scheduling and metrics capture. The obvious reach is
Redis + BullMQ, but that adds a second datastore to run, back up, secure, and keep
consistent with the system of record. Postgres is already the source of truth and
already operated to a high standard.

## Decision

Build the queues directly on Postgres. Workers claim jobs with
`SELECT … FOR UPDATE SKIP LOCKED`, enqueue is idempotent, failures retry with
3-attempt exponential backoff, and exhausted jobs are parked in a `failed` /
dead-letter row rather than lost. All three queues (pipeline, publish, metrics)
share the same shape.

## Consequences

- One datastore to operate, back up, and reason about; transactions span the job
  and its side effects, so there's no queue↔DB drift.
- No Redis/BullMQ dependency — CI and offline dev need nothing extra.
- We forgo BullMQ's built-in dashboards/rate-limiters; we provide our own retry
  endpoints and ops board instead.
- This is load-bearing: keep claims `FOR UPDATE SKIP LOCKED`, enqueue idempotent,
  and transitions atomic. Do not add a queue dependency.

## Implementing files

- `backend/src/pipeline/queue.js` — claim/enqueue/retry/backoff core.
- `backend/src/publish/index.js` — `publish_jobs` queue (same shape).
- `backend/src/metrics/index.js` — metrics-capture queue (same shape).
- Retry endpoints: `POST /api/jobs/:id/retry`, `POST /api/publish/:id/retry`.
