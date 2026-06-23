# ADR-0009 — Vendor-neutral observability (OpenTelemetry + Prometheus)

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

Production needs real visibility into the recording lifecycle and queue health,
but committing to a single observability vendor is a lock-in we don't want this
early.

## Decision

Emit OpenTelemetry traces spanning the recording lifecycle and Prometheus-style
metrics for per-stage latency, queue depth, and error/retry counts. Both are
exportable to any OTel/Prometheus-compatible backend — no vendor lock.

## Consequences

- Production visibility without choosing a vendor up front.
- A shipped dashboard definition makes the metrics usable immediately.
- Verified by `npm run smoke:observability`.

## Implementing files

- `backend/src/lib/telemetry.js` — traces + metrics emission.
- `backend/ops/dashboards/clipper-observability.json` — portable dashboard.
