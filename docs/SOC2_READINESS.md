# SOC 2 readiness (C5)

A self-assessment of Clipper.ai against the AICPA Trust Services Criteria (TSC),
mapping each criterion to the **technical** control that implements it and an
honest status. This is engineering readiness, not an audit opinion — the
organizational controls (HR, formal policies, vendor management) a SOC 2 Type II
also requires are listed as gaps with an owner.

Status legend: **✅ covered** (implemented + tested) · **🟡 partial** (built, not
yet formalized/evidenced) · **⛔ gap** (not yet built).

References: `THREAT_MODEL.md`, `SECRETS.md`, `IDENTITY.md`, `DATA_LIFECYCLE.md`,
`DR.md`, `SLO.md`, `SUPPLY_CHAIN.md`.

## Common Criteria — Security (CC)

| TSC | Control | Status | Evidence |
|---|---|---|---|
| CC6.1 Logical access | Server-side sessions, role walls, identity from session | ✅ | B7 `lib/auth.js`, `requireAuth`; `smoke:auth` |
| CC6.1 Strong auth | SSO (OIDC), TOTP MFA, password policy, lockout | ✅ | C2 `lib/sso.js`/`totp.js`/`lockout.js`/`password-policy.js`; `smoke:identity` |
| CC6.1 Tenant isolation | IDOR audit; per-client fencing on reads + assets | ✅ | S4; `smoke:authz` |
| CC6.6 Boundary protection | CORS lock, security headers, HSTS, body limits | ✅ | S5 `lib/config.js`, `server.js`; `smoke:prod` |
| CC6.6 Ingress safety | SSRF lockdown on content ingest | ✅ | S1 `lib/safe-fetch.js`; `smoke:ssrf` |
| CC6.1 Encryption in transit | HTTPS + HSTS in prod | 🟡 | S5 (HSTS set; TLS termination is a deployment concern) |
| CC6.1 Encryption at rest | AES-256-GCM for credentials + media; rotatable keys | ✅ | B5/C1/C3 `lib/crypto.js`/`content-crypto.js`/`keyring.js` |
| CC6.7 Secrets management | Manager seam (env/file/KMS), fail-fast on weak keys | ✅ | C3 `lib/secrets.js`; `smoke:secrets` |
| CC7.1 Vulnerability mgmt | CodeQL, `npm audit`, dependency-review, Dependabot | ✅ | S0/C4 `ci.yml`, `dependabot.yml` |
| CC7.2 Anomaly detection | Online quality drift monitor + alerting | ✅ | Q5 `metrics/monitor.js`; `smoke:drift` |
| CC7.2 Logging/monitoring | Structured logs + redaction, traces, Prometheus metrics | ✅ | S6 `lib/log.js`, R1 `lib/telemetry.js`; `smoke:observability` |
| CC7.3 Incident detection | SLO error-budget burn fires alerts | 🟡 | R4 `ops/slo.js`; alert routing to a real channel pending |
| CC8.1 Change management | PR-gated CI, locked deps, signed artifacts | 🟡 | S0/C4; formal change-approval policy not documented |
| CC4.1 Monitoring of controls | Smoke/CI gate enforces controls on every change | ✅ | `ci.yml` (the full smoke suite + eval gate) |
| CC1–CC5 Governance/HR/risk | Org policies, access reviews, security training | ⛔ | gap — organizational, owner: founder/ops |

## Availability (A)

| TSC | Control | Status | Evidence |
|---|---|---|---|
| A1.1 Capacity | Pool tuning, load test with p95 targets | ✅ | P5 `loadtest/`; capacity planning O2 |
| A1.2 Recovery | Automated backups + tested restore/PITR | ✅ | R5 `ops/backup`, `DR.md`; `smoke:restore` |
| A1.2 Resilience | Timeouts, circuit breakers, bulkheads; reaper | ✅ | R3 `lib/resilience.js`, M5; `smoke:resilience`/`smoke:chaos` |
| A1.1 Health/rollout | Liveness/readiness probes, graceful drain | ✅ | R2 `lib/lifecycle.js`; `smoke:shutdown` |
| A1.1 SLOs/error budgets | Documented SLIs/SLOs, turnaround tracking | ✅ | R4 `SLO.md`, O1 `smoke:sla` |
| A1.3 DR testing cadence | Chaos drill in CI | 🟡 | R5; scheduled production DR drills not yet formalized |

## Confidentiality (C)

| TSC | Control | Status | Evidence |
|---|---|---|---|
| C1.1 Data classification | Client media + credentials treated as sensitive | ✅ | `DATA_LIFECYCLE.md` |
| C1.1 Confidential at rest | Encrypted media + credentials | ✅ | C1/B5/C3 |
| C1.2 Disposal | Retention windows + verifiable erasure | ✅ | C1 `lib/retention.js`; `smoke:lifecycle` |
| C1.1 Secret leakage | Log redaction; API never returns secrets | ✅ | S6 `redact()`, B5 |

## Processing Integrity (PI)

| TSC | Control | Status | Evidence |
|---|---|---|---|
| PI1.1 Lifecycle integrity | Status machine as a DB CHECK constraint; atomic transitions | ✅ | load-bearing schema + `routes/review.js`; `smoke:review` |
| PI1.2 No fabricated output | Honest completion markers, never faked results | ✅ | CLAUDE.md convention; pipeline stages |
| PI1.4 Reproducibility | AI provenance: prompt/model/version stamped | ✅ | Q2; `smoke:provenance` |
| PI1.5 Quality regression gate | Golden eval set fails CI on quality drop | ✅ | Q1 `npm run eval` |
| PI1.2 Idempotency | Idempotent enqueue + dedup | ✅ | load-bearing queue; `smoke:ingest` |

## Privacy (P)

| TSC | Control | Status | Evidence |
|---|---|---|---|
| P1/P4 Notice & purpose | Sub-processor register + DPA summary | ✅ | `SUBPROCESSORS.md` |
| P4 Retention | Retention windows enforced | ✅ | C1 `DATA_LIFECYCLE.md` |
| P6 Erasure / data-subject rights | Per-client GDPR erasure, auditable | ✅ | C1; `smoke:lifecycle` |
| P6 Sub-processor disclosure | Documented + offline-by-default | ✅ | `SUBPROCESSORS.md` |
| P8 Privacy program | DPIA, breach-notification SLA, DPA signatures | ⛔ | gap — organizational |

## Summary

- **Technical controls for CC/Availability/Confidentiality/Processing Integrity
  are largely covered and CI-tested.**
- **Partial:** alert routing to a real channel (R4), formal change-management and
  DR-drill cadence, in-transit TLS evidence (deployment-layer).
- **Gaps are organizational, not technical:** governance/HR/risk policies, access
  reviews, security training, DPIA, and signed DPAs — required for a SOC 2 Type II
  but outside the codebase. Owner: founder/ops.

## Path to audit-ready

1. Route R4 alerts to a real channel (Slack/email/PagerDuty) and record an incident drill.
2. Document change-management, access-review, and DR-drill cadence as policies.
3. Engage an external penetration test; track findings to closure.
4. Execute DPAs with each enabled sub-processor (`SUBPROCESSORS.md`) and run a DPIA.
5. Engage a SOC 2 auditor for a readiness assessment, then a Type II observation window.
