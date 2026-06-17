# Clipper.ai — Capstone Plan: True Excellence

The third and final plan. The MVP plan makes the product *work*; the Excellence
plan makes it *safe and clean*; this one makes it **defensible, measurable, and
operable at the standard a brand or agency expects before trusting you with their
content.**

Seven tracks, ordered by leverage:

- **Track Q — AI Quality & Evaluation** ← the moat; do first
- **Track R — Reliability & Operability**
- **Track E — Unit Economics & Metering** ← the service business's vital sign
- **Track C — Compliance, Trust & Identity**
- **Track D — Developer Experience & Delivery**
- **Track P — Performance & End-to-End Testing**
- **Track O — Service Operations Depth**

Same rules: one item per branch, plan before writing, offline drivers stay
working, U-track preservation contract still applies to any UI-touching item,
one reviewable commit per item, finish on green.

---

## Track Q — AI Quality & Evaluation (the moat)

An AI-native company's excellence *is* the quality and improvability of its
models. Today the "moat" (`metrics/loop.js`) is scaffolding: it correlates and
retrains but nothing **measures whether the clips are actually good**, and
nothing stops a prompt/model change from silently regressing quality. This track
makes clip quality a first-class, tested, monitored metric.

### Q1 — Golden eval set + offline clip-quality harness

**Why:** There is no way to answer "did that prompt change make clips better or
worse?" Right now quality is vibes.

**Goal:** a labeled corpus and a harness that scores the moment-selection +
scoring pipeline on precision / recall / ranking quality (nDCG, MAP), runnable
offline and wired as a **CI regression gate**.

**Files:** `backend/eval/` (datasets + runner), `scripts/eval.mjs`,
`package.json` (`eval` script), CI.

**Approach:** assemble fixture recordings with human-marked "good clip" spans;
run the real `analyze`+`score` pipeline; compute ranking metrics vs the labels;
store a baseline; fail CI if a change drops quality beyond a tolerance. Report
per-signal contribution so you can see *why* quality moved.

**Acceptance:** `npm run eval` prints metrics + delta vs baseline; a deliberately
worse prompt fails the gate; a better one is allowed and updates the baseline on
merge.

**Commit:** `Q1: golden clip-quality eval harness + CI regression gate`

### Q2 — Prompt & model versioning / reproducibility

**Why:** When analysis runs through the LLM (MVP M2), nothing records *which*
prompt/model/params produced a result — so outcomes aren't reproducible or
A/B-able.

**Goal:** every AI artifact is stamped with a versioned prompt hash, model id,
and params; runs are reproducible and comparable.

**Files:** `backend/src/pipeline/llm.js`, `prompts/` (versioned), migration
`011_ai_provenance.sql` (columns on transcripts/clips), `metrics/loop.js`.

**Approach:** a prompt registry (versioned files + hash); record provenance on
each transcript/analysis/clip; support running two prompt versions side by side
and comparing via the Q1 harness; expose an A/B flag.

**Acceptance:** every generated clip carries its prompt+model version; two
versions can be evaluated head-to-head with Q1; replays are deterministic given
the same inputs/version.

**Commit:** `Q2: versioned prompt/model registry + AI provenance + A/B`

### Q3 — Human-in-the-loop labels → eval/training feedback

**Why:** Editors already accept/reject/edit clips in the review desk — that's
gold-standard quality signal being thrown away.

**Goal:** review decisions continuously enrich the Q1 eval set and the retrain
loop, closing the loop with *human judgment*, not just view counts.

**Files:** `backend/src/routes/review.js`, `metrics/loop.js`, `eval/` ingestion.

**Approach:** persist structured editor verdicts (kept / rejected / edited-how)
as labels; periodically fold them into the eval corpus and the weight retrain;
track inter-stage agreement (did the model rank what editors kept?).

**Acceptance:** editor decisions appear as labels; the eval set grows from real
review data; a report shows model↔editor agreement trending.

**Commit:** `Q3: review decisions as quality labels feeding eval + retrain`

### Q4 — Quality-floored model routing + caching

**Why:** Excellence ≠ most expensive model everywhere. And re-transcribing /
re-analyzing identical content burns money and time.

**Goal:** cheapest path that meets a measured quality floor; never recompute what
hasn't changed.

**Files:** `backend/src/pipeline/llm.js`, `transcribe.js`, new cache layer.

**Approach:** route to a cheap model first; escalate to a stronger model when
confidence/quality is below the Q1-calibrated floor; content-hash cache for
transcripts and analysis so identical inputs are free; per-route model config.

**Acceptance:** routing keeps eval quality ≥ floor at lower average cost (measure
with Q1 + Track E cost data); a re-submitted identical recording hits cache.

**Commit:** `Q4: quality-floored model routing + transcript/analysis caching`

### Q5 — Online quality monitoring + drift detection

**Why:** Offline eval can pass while production quality silently drifts (model
updates, content-mix shifts).

**Goal:** continuously compare predicted clip score vs realized performance;
alert on drift.

**Files:** `backend/src/metrics/loop.js`, `metrics/monitor.js` (new),
Track R alerting.

**Approach:** track predicted-vs-actual calibration over time; detect
distribution drift; raise an alert + auto-open a review when calibration decays.

**Acceptance:** a simulated drift trips the monitor and emits an alert; a
calibration dashboard exists.

**Commit:** `Q5: online quality calibration + drift alerting`

---

## Track R — Reliability & Operability

### R1 — Observability: traces, metrics, dashboards

**Why:** The queue and pipeline are well-built but blind in production — no
metrics, traces, or dashboards.

**Goal:** OpenTelemetry traces across intake→publish, Prometheus metrics (queue
depth per stage, stage latency p50/p95/p99, error rates, retry counts), and
ready-made dashboards.

**Files:** `backend/src/lib/telemetry.js` (new), instrument `pipeline/queue.js`,
all stages, routes; `ops/metrics` endpoint; dashboard JSON in `ops/`.

**Acceptance:** a trace spans a full recording lifecycle; `/metrics` exposes
queue + latency series; dashboards render them.

**Commit:** `R1: OpenTelemetry tracing + Prometheus metrics + dashboards`

### R2 — Health probes + graceful shutdown

**Why:** No liveness/readiness probes; a worker killed mid-job is only partly
handled (MVP M5 reaper). A deploy can drop in-flight work.

**Goal:** `/healthz` + `/readyz`; workers drain in-flight jobs on SIGTERM before
exit.

**Files:** `backend/src/server.js`, `pipeline/index.js`, `publish/scheduler.js`,
`metrics/index.js`.

**Acceptance:** readiness flips false while draining; a rolling restart loses
zero jobs; probes reflect DB connectivity.

**Commit:** `R2: health/readiness probes + graceful job-draining shutdown`

### R3 — Resilience on every external call

**Why:** ASR, LLM, and publish APIs will fail, hang, and rate-limit. Backoff
exists for the queue but not consistent timeouts/circuit-breakers per dependency.

**Goal:** every outbound call has a timeout, bounded retry with jitter, and a
circuit breaker; one failing dependency can't take the system down.

**Files:** `backend/src/lib/resilience.js` (new), wrap ASR/LLM/publish/metrics
clients.

**Acceptance:** a stubbed hanging dependency trips the breaker and fails fast;
recovery closes it; no thread/connection exhaustion under fault injection.

**Commit:** `R3: timeouts + circuit breakers + bulkheads on external calls`

### R4 — SLOs, error budgets, alerting

**Why:** No defined reliability targets or alerts.

**Goal:** documented SLIs/SLOs (e.g. processing success rate, p95 turnaround),
error budgets, and alert routing.

**Files:** `docs/SLO.md`, alert rules alongside R1, Track O turnaround data.

**Acceptance:** SLOs documented; burning the budget fires an alert to a real
channel.

**Commit:** `R4: SLOs, error budgets, alert routing`

### R5 — Disaster recovery + chaos

**Why:** No backups, no tested restore (flagged in the original docs).

**Goal:** automated Postgres backups + object-storage lifecycle, a **tested**
restore, PITR, documented RPO/RTO, and a failure-injection test.

**Files:** `ops/backup/` scripts, `docs/DR.md`, a chaos test in CI/staging.

**Acceptance:** a restore drill reproduces the DB to a point in time; chaos test
(kill DB / worker / storage mid-pipeline) recovers within RTO.

**Commit:** `R5: automated backups, tested restore/PITR, chaos drill`

---

## Track E — Unit Economics & Metering (the service company's vital sign)

You sell **outcomes**, not seats. Without per-job cost and per-client margin you
are flying blind on the only number that decides whether the business works.

### E1 — Per-job cost accounting

**Why:** No record of what each recording costs to process.

**Goal:** every recording/clip records ASR seconds, LLM tokens (in/out), render
CPU time, storage bytes, and egress — priced into a cost figure.

**Files:** instrument `transcribe.js`, `pipeline/llm.js`, `media.js`,
`storage/*`; migration `012_cost_ledger.sql`.

**Acceptance:** a processed recording shows an itemized, summed cost; costs roll
up to the client.

**Commit:** `E1: per-job AI/compute/storage cost ledger`

### E2 — Usage metering + plan/quota enforcement

**Why:** Clients buy a volume of outcomes; nothing meters or enforces it.

**Goal:** meter delivered clips + minutes processed against each client's plan;
soft/hard limits with clear behavior at the boundary.

**Files:** `backend/src/routes/clients.js`, new `lib/metering.js`, migration
`013_plans_usage.sql`.

**Acceptance:** usage accrues per client; hitting a plan limit behaves per policy
(warn / queue / block) and is visible in the ops board.

**Commit:** `E2: usage metering + plan/quota enforcement`

### E3 — Margin & profitability dashboard

**Why:** Revenue minus AI+human cost per client is the number a service company
lives on — currently uncomputable.

**Goal:** ops dashboard panel: per-client revenue vs cost (E1) vs human-editor
time, with margin and trend.

**Files:** `backend/src/routes/analytics.js`, `frontend/src/ops/Measure.jsx`
(reuse the existing analytics surface; preserve design).

**Acceptance:** margin per client renders from real cost + plan data; sortable by
profitability.

**Commit:** `E3: per-client margin & profitability dashboard`

### E4 — Outcomes billing readiness

**Why:** Manual invoicing won't scale an outcomes model.

**Goal:** emit usage records to a billing provider (Stripe metered usage) so
invoices reflect delivered outcomes; idempotent, reconcilable.

**Files:** `backend/src/billing/` (new), webhook handler with signature
verification, migration `014_billing.sql`.

**Acceptance:** delivered clips create reconciled usage records; billing webhook
signatures are verified; a dry-run mode keeps CI offline.

**Commit:** `E4: metered outcomes billing integration (dry-run default)`

---

## Track C — Compliance, Trust & Identity

Brands and agencies will not hand you their unreleased content without these.

### C1 — Content encryption at rest + retention + GDPR erasure

**Why:** Client media is sensitive; there's no lifecycle or right-to-erasure.

**Goal:** encrypt stored media at rest, enforce retention windows, and support
verifiable per-client deletion across DB + object storage.

**Files:** `backend/src/storage/*`, `routes/clients.js`, migration
`015_retention.sql`, `docs/DATA_LIFECYCLE.md`.

**Acceptance:** stored objects are encrypted; an erasure request removes a
client's content + derivatives and is auditable; retention expiry purges
automatically.

**Commit:** `C1: at-rest content encryption + retention + GDPR erasure`

### C2 — Enterprise identity: SSO, MFA, account security

**Why:** Today there's one password mechanism; agencies/brands require SSO and
MFA.

**Goal:** OIDC/SAML SSO, TOTP MFA, password policy, lockout, session-management
UX.

**Files:** `backend/src/lib/auth.js`, `routes/auth.js`, `frontend` auth views
(preserve design), migration `016_identity.sql`.

**Acceptance:** SSO login works against a test IdP; MFA enrollable + enforced per
client policy; repeated failures lock out; sessions listable/revocable.

**Commit:** `C2: SSO (OIDC/SAML) + TOTP MFA + account-security policy`

### C3 — Secrets management + key rotation

**Why:** AES key + provider secrets live in env; no rotation story.

**Goal:** secrets from a KMS/vault (or cloud secret manager); rotatable
encryption keys with re-wrap; no plaintext secrets in env in prod.

**Files:** `backend/src/lib/crypto.js`, `lib/secrets.js` (new), `server.js` boot
guard.

**Acceptance:** prod loads secrets from the manager; `PUBLISH_TOKEN_KEY` rotates
without downtime (envelope/re-wrap); boot fails on missing/weak keys.

**Commit:** `C3: KMS-backed secrets + rotatable envelope encryption`

### C4 — Supply-chain security

**Why:** No SBOM, provenance, or automated dependency updates.

**Goal:** generated SBOM, pinned + locked deps, signed build artifacts, automated
update PRs.

**Files:** CI (extends S0), `.github/dependabot.yml` or Renovate config.

**Acceptance:** CI emits an SBOM; artifacts are signed/attested; dependency
update PRs open automatically and run the full gate.

**Commit:** `C4: SBOM + artifact signing + automated dependency updates`

### C5 — Threat model + SOC 2 readiness

**Why:** B2B buyers will ask for a security posture and likely SOC 2.

**Goal:** a STRIDE threat model and a SOC 2 readiness checklist mapped to the
controls this program implements; DPA + sub-processor docs.

**Files:** `docs/THREAT_MODEL.md`, `docs/SOC2_READINESS.md`,
`docs/SUBPROCESSORS.md`.

**Acceptance:** threat model covers each component with mitigations linked to
S/C items; readiness checklist shows coverage + gaps.

**Commit:** `C5: STRIDE threat model + SOC 2 readiness + DPA docs`

---

## Track D — Developer Experience & Delivery

### D1 — One-command local stack

**Why:** Onboarding requires Postgres + ffmpeg + whisper set up by hand.

**Goal:** `docker compose up` brings the whole system (DB, backend, workers,
frontend, whisper) to life with seed data.

**Files:** `docker-compose.yml`, `Dockerfile`(s), `.dockerignore`, seed script
(reuse MVP M8).

**Acceptance:** a clean machine runs the full app + smokes from one command.

**Commit:** `D1: docker-compose dev stack + seed`

### D2 — Pre-commit hooks + commit hygiene

**Why:** Quality gates only at CI; no formatting/commit standard.

**Goal:** pre-commit lint/format/typecheck/secret-scan; Prettier; Conventional
Commits; automated CHANGELOG + semver.

**Files:** `.husky/`, `.prettierrc`, commitlint config, release config.

**Acceptance:** a bad commit is blocked locally; releases generate a changelog +
version bump.

**Commit:** `D2: pre-commit hooks + conventional commits + release automation`

### D3 — Test depth: coverage, mutation, contracts, migrations

**Why:** Smokes are excellent but coverage/mutation/contract/migration testing
are absent.

**Goal:** coverage targets enforced; mutation testing on core logic; API contract
tests; migration up/down + drift tests.

**Files:** test config, `backend/test/contract/`, CI.

**Acceptance:** coverage gate enforced; mutation score reported; contract tests
catch a breaking API change; migrations verified reversible/forward-safe.

**Commit:** `D3: coverage + mutation + contract + migration testing`

### D4 — Docs, ADRs, runbooks, incident playbook

**Why:** Tribal knowledge; the existing docs overclaim (BUILD_STAGES).

**Goal:** an honest docs set — architecture, ADRs, runbooks, incident response,
onboarding — plus a master index of all four plans.

**Files:** `docs/adr/`, `docs/RUNBOOKS.md`, `docs/INCIDENT_RESPONSE.md`,
`docs/README.md` (index), correct `BUILD_STAGES.md`.

**Acceptance:** a new engineer can onboard from docs alone; each major decision
has an ADR; BUILD_STAGES reflects reality.

**Commit:** `D4: ADRs, runbooks, incident playbook, honest docs index`

### D5 — Staging + safe deploys

**Why:** No staging or rollback path.

**Goal:** a staging environment mirroring prod; blue/green or canary deploys with
automated rollback on health failure.

**Files:** deploy config, CI/CD pipeline, `docs/DEPLOY.md`.

**Acceptance:** changes flow to staging automatically; a failed canary
auto-rolls-back; prod deploy is one reviewed action.

**Commit:** `D5: staging environment + canary deploy + auto-rollback`

---

## Track P — Performance & End-to-End Testing

### P1 — Frontend performance budgets + code-splitting

**Why:** `landing-visuals.jsx` is 2,382 lines of SVG shipped eagerly; no budget
or analysis.

**Goal:** route-level code-splitting, lazy below-the-fold visuals, bundle
analysis, and Lighthouse CI gates — **with the visual output unchanged**
(U-track preservation contract applies).

**Files:** `frontend/src/App.jsx` (lazy routes), visuals (dynamic import),
`vite.config`, CI (Lighthouse).

**Acceptance:** initial bundle drops materially; Lighthouse perf gate passes; the
rendered pages are pixel-identical (screenshot diff).

**Commit:** `P1: code-splitting + perf budgets + Lighthouse CI (no visual change)`

### P2 — Core Web Vitals + RUM

**Why:** No real-user performance signal.

**Goal:** privacy-respecting Core Web Vitals collection + a dashboard.

**Files:** `frontend/src/lib/perf.jsx` (extend), an analytics sink.

**Acceptance:** LCP/INP/CLS reported from real sessions; regressions visible.

**Commit:** `P2: Core Web Vitals + privacy-respecting RUM`

### P3 — End-to-end + visual regression tests

**Why:** No E2E coverage of the real journeys; the U-track look is only protected
by hand.

**Goal:** Playwright E2E across lead→call, submit→process→review→publish, and
portal approve; screenshot visual-regression that **locks** the preserved
design.

**Files:** `frontend/e2e/`, CI.

**Acceptance:** E2E green on the core journeys; a stray pixel change fails the
visual-regression gate.

**Commit:** `P3: Playwright E2E + visual-regression design lock`

### P4 — Storybook design-system docs

**Why:** Once U3 primitives exist, they deserve living documentation.

**Goal:** Storybook cataloguing the primitives, color tokens, and visuals with
accessibility checks.

**Files:** `frontend/.storybook/`, stories alongside `components/ui.jsx`.

**Acceptance:** Storybook builds; every primitive + token documented; a11y addon
clean.

**Commit:** `P4: Storybook design-system documentation`

### P5 — Backend performance: queries, pooling, load tests

**Why:** No index audit, N+1 check, pool tuning, or load test.

**Goal:** audited indexes, no N+1s on hot paths, tuned pool, and a k6 load test
with documented targets.

**Files:** migration for indexes, `db/index.js` pool config, `loadtest/` (k6).

**Acceptance:** hot queries hit indexes (EXPLAIN); load test meets p95 targets at
target concurrency.

**Commit:** `P5: query/index audit + pool tuning + k6 load test`

---

## Track O — Service Operations Depth

The business doc is explicit: the **ops dashboard is the product**. These make it
a real media-operations platform, not just a pipeline viewer.

### O1 — SLA / turnaround tracking

**Why:** The service's core promise is fast, consistent delivery — unmeasured.

**Goal:** measure submit→deliver per recording/client, define SLA targets,
surface breaches.

**Files:** `backend/src/routes/analytics.js`, `frontend/src/ops/Board.jsx`
(preserve design), migration for SLA config.

**Acceptance:** turnaround per client is computed; breaches flag on the board and
feed R4 SLOs.

**Commit:** `O1: SLA turnaround tracking + breach surfacing`

### O2 — Capacity & workload planning

**Why:** Human editors/reviewers are the constraint; no load balancing or
forecast.

**Goal:** editor/reviewer workload view, fair assignment, and queue-depth
forecasting.

**Files:** `backend/src/routes/review.js` (assignment), `ops` views (preserve
design), forecasting in analytics.

**Acceptance:** work is balanced across reviewers; the board forecasts backlog
clear-time.

**Commit:** `O2: capacity planning + balanced review assignment`

### O3 — Client health & lifecycle

**Why:** No onboarding workflow, health score, or churn signal.

**Goal:** structured client onboarding, a health score (usage, turnaround,
approval rate, performance), and churn-risk flags.

**Files:** `routes/clients.js`, `ops/Clients.jsx` (preserve design), migration.

**Acceptance:** each client shows a health score + lifecycle stage; at-risk
clients are flagged.

**Commit:** `O3: client onboarding + health score + churn signals`

### O4 — Notifications & client comms

**Why:** No event notifications; the service runs on timely communication.

**Goal:** email/Slack notifications on content-received / ready-for-approval /
published / SLA-risk; client-facing status.

**Files:** `backend/src/notify/` (new), event hooks across the pipeline + review,
portal status (preserve design).

**Acceptance:** lifecycle events emit notifications via configured channels;
delivery is logged; opt-out respected.

**Commit:** `O4: lifecycle notifications + client comms`

### O5 — System-wide audit & activity feed

**Why:** Review history exists, but no holistic audit/activity trail.

**Goal:** an append-only activity feed across intake, processing, review,
publish, billing, and admin actions — visible to ops, scoped for clients.

**Files:** `backend/src/lib/audit.js` (new), event hooks, `ops` feed view
(preserve design), migration `017_audit.sql`.

**Acceptance:** every material action lands in the audit log; the ops feed
renders it; client view is correctly scoped.

**Commit:** `O5: system-wide audit log + activity feed`

---

## Master roadmap — all four plans in one program

A sane order across **MVP (M)**, **Excellence (S/U)**, and **Capstone
(Q/R/E/C/D/P/O)**:

```
PHASE 1 — Make it real
  MVP M1 → M2 → M3            (ASR → semantic scoring → captions+hooks)
  D1                         (docker-compose, so everyone can run it)
  S0                         (restore CI — gate everything from here on)

PHASE 2 — Make it trustworthy before anyone outside sees it
  S1 SSRF · S2 cookie/CSRF · S3 validation/limits · S4 IDOR · S5 headers/CSP · S6 logging
  MVP M4 ingest · M5 queue reliability

PHASE 3 — Make it provably good
  Q1 eval harness · Q2 prompt versioning · Q3 review-as-labels · Q4 routing · Q5 drift
  R1 observability · R2 health/shutdown · R3 resilience
  MVP M6 (real publish) · M7/M8 folded into S/D

PHASE 4 — Make it a business
  E1 cost · E2 metering · E3 margin · E4 billing
  O1 SLA · O2 capacity · O3 health · O4 notifications · O5 audit

PHASE 5 — Make it excellent to use and maintain
  U1 tokens · U2 split · U3 primitives · U4 states · U5 lint/a11y
  P1 perf · P2 CWV · P3 E2E/visual-lock · P4 Storybook · P5 backend perf
  R4 SLOs · R5 DR/chaos
  C1 erasure · C2 SSO/MFA · C3 KMS · C4 supply-chain · C5 threat model/SOC2
  D2 hooks · D3 test depth · D4 docs/ADRs · D5 staging/canary
```

Phases 1–2 are sequential and gating. Inside phases 3–5, items are largely
independent — pick by what unblocks the most next. Two hard rules carry
throughout: **S0 lands before anything ships**, and **U1 lands before the other
U/P UI items**.
