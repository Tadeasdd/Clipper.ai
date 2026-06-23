# ADR-0007 — Timeout + circuit breaker + bulkhead on external calls

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

External dependencies fail slowly as often as they fail fast. Without bounds, one
hanging dependency can exhaust workers and stall the whole system.

## Decision

Every outbound call is wrapped with a timeout, a bounded retry with jitter, a
circuit breaker (with half-open recovery), and a bulkhead concurrency cap — so a
slow or failing dependency is isolated rather than allowed to drain capacity.

## Consequences

- Fault isolation: a bad dependency degrades its own stage, not the system.
- Failures surface as typed errors (`TimeoutError`, `CircuitOpenError`,
  `BulkheadFullError`) rather than indefinite hangs.
- Verified by `npm run smoke:resilience`.

## Implementing files

- `backend/src/lib/resilience.js` — timeout, retry/jitter, breaker, bulkhead
  (exports `TimeoutError`, `CircuitOpenError`, `BulkheadFullError`).
