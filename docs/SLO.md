# Service Level Objectives — Clipper.ai

Reliability targets for the content-operations pipeline, the error budgets that
go with them, and how a burning budget pages someone. The SLIs are computed from
data the system already records (R1 metrics + the pipeline timestamps), so these
targets are measured, not aspirational. Code: `backend/src/ops/slo.js`.

## SLIs and SLOs

| Objective | SLI (how it's measured) | SLO (target) | Window |
|---|---|---|---|
| **Processing success rate** | recordings reaching `ready` ÷ (`ready` + `failed`) | **≥ 99%** | rolling 24h |
| **Turnaround (p95)** | p95 of `generate.finished_at − recording.created_at` for recordings completed in the window | **≤ 1800s** (30 min) | rolling 24h |

Targets are environment-tunable: `SLO_SUCCESS_TARGET`, `SLO_TURNAROUND_P95_S`,
`SLO_WINDOW_S`. They are starting points — tighten them as the live baseline
(R1's `clipper_stage_duration_seconds`, the calibration history) proves out.

> **Turnaround note:** turnaround is derived today from the recording's creation
> timestamp and the final `generate` stage completion. Track O (service-ops
> depth) will add richer human-turnaround data (e.g. review queue dwell time);
> when it lands, the SLI gains those terms — the objective itself is unchanged.

## Error budgets

The error budget is what's left of `1 − SLO` over the window:

- **Processing**: a 99% target ⇒ a **1% failure budget**. Burn = `actual failure
  rate ÷ allowed failure rate`. `burn > 1` means the budget for the window is
  spent — the objective is breached.
- **Turnaround**: burn = `observed p95 ÷ target p95`. `burn > 1` means p95 is
  over the bound.

Burn is exported as `clipper_slo_budget_burn{objective}` on `GET /metrics`
(R1), so it's graphable next to queue depth and stage latency.

## Alerting

The periodic monitor (`startQualityMonitor`, every `DRIFT_SNAPSHOT_INTERVAL_S`)
evaluates the SLOs each tick. On any breach it raises `slo.breach` through the
shared alert channel (`backend/src/lib/alert.js`):

- **Dry-run (default):** the structured security/audit log — CI and offline dev
  fire nothing external.
- **Real channel:** set `ALERT_WEBHOOK_URL` to a Slack/PagerDuty/Opsgenie
  inbound webhook; the breach payload (objective, SLI, target, burn, sample)
  POSTs there. This is the same routing Q5's quality-drift alert uses, and the
  seam Track R's alert routing plugs into.

Disable alerting with `SLO_BURN_ALERT=false` (the report still computes).

## Observing

- `GET /api/analytics/slo` (ops) — the current report: each objective's SLI,
  target, sample size, breach flag, and budget burn. Read-only (it never pages).
- `GET /metrics` — `clipper_slo_budget_burn{objective}` for dashboards/alert rules.

## Verifying

`npm run smoke:slo` seeds a budget-burning window (failures beyond the SLO),
asserts the report flags the breach **and** a `slo.breach` alert is delivered to
a local webhook, and that a healthy window stays quiet (no false page).
