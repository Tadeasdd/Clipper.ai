# ADR-0010 — In-process workers by default, env opt-out

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

Simple deploys want one process; scaling wants workers separated from the API.
Either way, a rolling restart must not drop in-flight jobs.

## Decision

Pipeline, publish, and metrics workers run in-process with the API by default. Set
`WORKERS_ENABLED=false` to run them separately via `npm run worker` — `FOR UPDATE
SKIP LOCKED` makes both modes safe simultaneously. On `SIGTERM` the queues drain
in-flight work before exit (zero loss) and readiness flips false.

## Consequences

- One process for simple deploys; separable workers when scaling — same code.
- Safe rolling restarts: draining + readiness flip means no lost or double work.
- Liveness/readiness exposed at `GET /healthz`, `GET /readyz`.

## Implementing files

- `backend/src/server.js` — process wiring, probes.
- `backend/src/pipeline/index.js` — in-process vs separate worker loop.
- `backend/src/lib/lifecycle.js` — SIGTERM drain, readiness state.
