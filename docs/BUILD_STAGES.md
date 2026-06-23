# Build Stages

The roadmap for taking the marketing sandbox to a full operations platform.
Guiding rule from the business model: **when choosing between software customers
use and software employees use to deliver client outcomes, choose the latter.**
The ops dashboard is the product; the client dashboard is a window into it.

> **Status (read this first).** The B1–B7 / F1–F5 ✅ marks below describe the
> **machinery and offline drivers** — the queue, status machine, storage, auth,
> and the `builtin`/`local` pipeline. They do **not** by themselves describe the
> **content intelligence** that is the actual product (semantic moment scoring,
> real editor-grade hooks, live publish + metrics). That layer is the **MVP track
> (M1–M8) — now delivered** (`MVP_BACKEND_PLAN.md`), and it is hardened/extended
> by the Excellence (S/U) and Capstone (Q/R/E/C/D/P/O) tracks. For the
> authoritative current status of the whole program, see `docs/README.md`.

Stages are ordered so every stage ships something usable. Frontend stages are
`F#`, backend stages are `B#`. Dependencies are noted.

---

## Frontend

### F1 — Marketing site live (✅ this repo)

- The sandbox (`frontend/src/App.jsx`) running as a real Vite + React +
  Tailwind v4 build. Verified: `npm run build` passes.
- PostHog analytics, runtime SEO/JSON-LD, the interactive Studio demo,
  pricing, docs, status, company, legal pages — all already in the sandbox.
- Deploy `frontend/dist` to any static host (Vercel/Netlify/Cloudflare Pages).
- **Done when:** site is on a domain, PostHog receives real events.

### F2 — Split the monolith (✅)

- Break `App.jsx` (~7.7k lines) into modules: `pages/`, `components/`,
  `lib/` (track, SEO, demo pipeline). No behavior change — pure refactor,
  protected by the F1 build as a regression check.
- Replace the hash/state router with `react-router` so pages get real URLs
  (better SEO than runtime-injected canonicals alone).
- Remove `NEON_SHIM_CSS` (redundant now that real Tailwind generates the
  arbitrary-value classes).
- **Done when:** every page has a URL, bundle is code-split per route. ✅
  Done: 17 modules (lib/, components/, pages/, studio/), react-router URLs for
  all 9 routes, shim removed, eager JS cut 409→270 KB, happy-dom route smoke
  test (`npm run smoke`) wired into CI.

### F3 — Lead capture wired to backend (✅)

- The waitlist/strategy-call forms currently capture to PostHog only.
  Point them at `POST /api/clients` + a `/api/leads` endpoint (B2).
- **Depends on:** B1–B2.
- Done: the form was silently broken in production — it called the Claude
  artifact sandbox's `window.storage`, which doesn't exist on a real site.
  Now posts to `POST /api/leads` (idempotent per email) via `lib/api.js`;
  verified by a DOM-driven integration test (`scripts/f3-integration.mjs`)
  that types into the built form, clicks submit, and finds the row in
  Postgres.

### F4 — Operations dashboard (the primary product) (✅)

Internal app, separate route tree (`/ops`), role-gated:

1. **Incoming content queue** — `GET /api/intake/queue`
2. **Processing status board** — per-recording stage timeline
   (`GET /api/jobs`), mirroring the demo's `PIPELINE_STAGES`
3. **Clip candidate review** — scored grid, inline edit of hooks/captions
4. **Review workflow** — approve / reject / request changes
5. **Publishing queue** — per-client, per-platform calendar
6. **Client management** — plans, cadence, brand config
7. **Ops analytics** — approval rate, turnaround SLA, score-vs-performance

- Reuse the Studio demo's visual language (it's effectively the ops UI mockup).
- **Depends on:** B2–B4. ✅
  Done, built in phases (one commit each, each live-verified against the
  real backend before landing):
  - **F4.0** shell: lazy `/ops` chunk, shared-key gate (B7 placeholder —
    deployments must also gate `/ops` at the proxy), identity picker,
    `usePoll` that degrades to error bands (the route smoke runs the whole
    dashboard with NO backend and fails on any unhandled rejection)
  - **F4.1** processing board: five-segment stage rails (pulse on running),
    verbatim parked errors, retry, incoming-queue panel
  - **F4.2** recording detail: per-stage evidence one-liners straight from
    `pipeline_jobs` payloads (probe, provider+words, moments+LUFS baseline,
    candidates+top, rendered count), expandable raw payloads
  - **F4.3** clip grid: score + the three stored signals as meters, inline
    mp4 preview from the asset endpoint, click-to-edit hooks (PATCH)
  - **F4.4** review desk: the four worklists, decisions with notes,
    send/resubmit, inline audit trails; 409 = lost race = refresh to truth
  - **F4.5** clients: plan/cadence editor + the auto-publish toggle labelled
    as what it is (opting out of per-clip sign-off)
  - **F4.6** measure: real QA approval rate + median pipeline turnaround
    (the B6 slice computable today, in `/api/analytics/ops`); publish queue
    renders the B5 contract; score↔performance stays honestly "awaits B6"
    `npm run integration:f4` renders the BUILT dashboard in happy-dom against
    the live backend, clicks approve (typed note) + send through two
    worklists, and verifies both transitions + audit rows in Postgres.
    Publish/analytics surfaces fill in as B5/B6 land.

### F5 — Client dashboard (limited visibility)

Secondary by design. Four surfaces only:

- Upload content (file or URL)
- View deliverables
- Approve content (the client side of the review workflow)
- Analytics reports
- **Depends on:** B4, B6, plus client-role auth (B7). ✅
  Done. `/portal` is its own lazy chunk (`frontend/src/portal/`), sharing
  the session plumbing with `/ops` (one token key, one cookie). Client
  logins land here; ops logins get bounced to `/ops` and vice versa.
  - **Sign-off** is the client side of the B4 machine: clips awaiting the
    client, inline preview, approve / request changes with a typed note —
    the note lands in the audit trail attributed to the client session.
  - **Deliverables** lists approved + published clips with client-facing
    status labels (no internal pipeline vocabulary).
  - **Submit** posts a URL or file into the same intake the ops queue
    drains; `GET /api/intake/queue` now serves client users their own
    pinned submissions (ops still see the full queue).
  - **Report** renders the B6 client report (`/api/analytics/clients/:id`),
    which 403s server-side if a client asks for a different client.
    `npm run integration:f5` runs the whole thing in happy-dom against the
    live backend with two clients seeded: verifies the fence (the neighbor's
    data never renders), clicks approve with a note and checks the status
    transition + audit attribution in Postgres, submits a URL through the
    built UI and checks the `recordings` row, and renders the report.
    `smoke-auth` also asserts the intake-queue fence at the API level.

---

## Backend

### B1 — Skeleton (✅ this repo)

- Express API with health check and every stage route stubbed
  (`backend/src/server.js`, `routes/`). Verified: boots, routes respond.
- Postgres schema covering the whole operating system
  (`backend/src/db/schema.sql`): clients, users, recordings, pipeline_jobs,
  transcripts, clips, review_events, publish_jobs, clip_metrics.
- **Done when:** schema applied to a real Postgres, API deployed.

### B2 — Intake + client records (✅)

- Real `POST /api/intake`: presigned S3 upload or URL pull; create
  `recordings` row; feed the ops queue.
- `clients` CRUD + `leads` endpoint for F3.
- **Done when:** a real podcast file lands in object storage and shows up
  in `GET /api/intake/queue`. ✅
  Done: pg pool + forward-only migration runner (`migrations/`), prefixed
  ids, storage drivers behind one interface (local disk for dev, presigned
  S3 for prod), real intake/clients/leads routes, and a 14-assertion smoke
  (`npm run smoke`) run in CI against a Postgres service container —
  including the done-criterion: bytes on disk, recording in the queue.

### B3 — The pipeline (the heart of the company) (✅)

Queue workers (BullMQ + Redis or pg-boss), one per stage — stubs are in
`backend/src/pipeline/`:

1. `ingest` — probe media, normalize, store
2. `transcribe` — provider-agnostic, word-level timestamps
3. `analyze` — NLP/multimodal pass: high-retention moments, emotional peaks,
   controversial statements, educational insights, storytelling moments, hooks
4. `score` — rank candidates (v1: heuristic + LLM; later retrained on B6 data)
5. `generate` — cut, reframe to 9:16, caption burn-in, hook variants,
   platform-specific formatting (ffmpeg)

- **Done when:** one recording in → scored, rendered clip candidates out,
  visible in the ops board with per-stage status and retry. ✅
  Done: `pipeline_jobs` is the queue itself (FOR UPDATE SKIP LOCKED; workers
  run in-process or via `npm run worker`), with 3-attempt backoff and a retry
  endpoint. The analyze stage works on REAL signal — ebur128 momentary
  loudness → z-scored windows → region-grown moments; generate renders real
  9:16 mp4s with ffmpeg (center-crop for video, branded waveform for audio).
  ASR and hooks sit behind provider seams (`builtin` offline default;
  Deepgram + Anthropic adapters written, gated on keys). The CI smoke plants
  three loud bursts in a synthetic podcast and asserts the rendered clips
  land on them, the asset endpoint serves playable mp4, and a failing
  source URL parks → retries on demand.

### B4 — Review workflow (✅)

- Internal QA decisions (`POST /api/review/:clipId/decision`) with the
  status machine already encoded in the schema:
  `candidate → awaiting_review → approved_internal → awaiting_client → approved`.
- Client approval path honors the FAQ promise: **nothing publishes without
  sign-off unless the client opts into auto-publish.**
- **Done when:** a clip can travel the full status machine via the API. ✅
  Done: role-aware decision endpoint (internal roles decide from
  `awaiting_review`, client users from `awaiting_client` — only their own),
  plus `send` (approved_internal → awaiting_client) and `resubmit`
  (changes_requested → awaiting_review). Every transition is ONE atomic CTE
  statement: status move + `review_events` audit row together, so concurrent
  reviewers can't double-decide (lost race → 409). Auto-publish is read from
  `clients.brand_config.auto_publish` at the moment of internal approval —
  the single place the FAQ promise is enforced. A minimal `users` route
  exists as the B7 precursor (decisions must be attributable to real rows;
  identity is trusted until B7 sessions). Smokes: `npm run smoke:review`
  (29+ assertions: full machine both paths, role enforcement, the
  changes→edit→resubmit loop, double-decision races, audit trails) and a
  continuation in the pipeline smoke that takes a REAL rendered clip through
  QA → send → client sign-off. Both in CI.

### B5 — Publishing (✅)

- Platform adapters (YouTube Shorts, TikTok, Instagram Reels, LinkedIn, X)
  behind one interface; per-client OAuth tokens stored encrypted.
- Scheduler drains `publish_jobs` at `scheduled_at`; failures retry and
  surface in the ops queue.
- **Done when:** an approved clip auto-publishes to one platform end-to-end. ✅
  Done: `publish_jobs` is a real queue with the same runtime shape as the
  pipeline (FOR UPDATE SKIP LOCKED claims, 3-attempt backoff, parked
  'failed', retry/cancel from the ops queue) and it honors `scheduled_at`.
  Adapters sit behind `PUBLISH_DRIVER`: `local` (default) is a REAL offline
  delivery — asset + manifest copied to a per-platform storage outbox and
  served back via `/api/publish/outbox/...` — same honest pattern as the
  builtin ASR provider; `live` has a real YouTube Shorts adapter (token
  refresh + multipart videos.insert), others throw until written.
  `platform_connections` stores credentials AES-256-GCM-encrypted
  (`PUBLISH_TOKEN_KEY`; the API never returns them). Scheduling is one
  atomic CTE that only accepts clips in 'approved' — client sign-off is
  structurally unskippable — and arrival at 'approved' auto-schedules onto
  every connected platform (the B4→B5 hook; best-effort, never rolls back a
  decision). Smokes: `npm run smoke:publish` (27 assertions: encryption at
  rest, sign-off guarantee, full lifecycle, scheduled_at honored,
  failure/park/retry, cancel, auto-schedule) and the pipeline smoke's B5
  continuation publishes the REAL rendered clip and ffprobes the delivered
  file. Both in CI. The ops publishing queue (F4.6) now renders live jobs
  with errors, retry, and delivery links.

### B6 — Measurement + the optimization loop (✅)

- Pollers pull per-post metrics into `clip_metrics`.
- Client report aggregation (`GET /api/analytics/clients/:id`) for F5.
- The differentiator: correlate `clips.score` with realized performance and
  feed it back into the B3 scoring stage. This loop is the moat.
- **Done when:** weekly client report generates itself; score model retrains
  on ≥ one cycle of real data. ✅
  Done in three phases:
  - **B6.1** ingestion: a capture poller (the third queue, same SKIP LOCKED
    shape on purpose) claims published jobs whose `metrics_next_at` passed
    and appends `clip_metrics` rows; first capture lands the moment a job
    publishes. `METRICS_DRIVER` seam: `local` (default) simulates
    deterministically from the publish id + elapsed time — never from
    `clips.score`, so the loop can't be fooled by our own simulator; `live`
    carries a real YouTube `videos.list` driver (fields the Data API doesn't
    expose stay null rather than guessed).
  - **B6.2** reports: `GET /api/analytics/clients/:id` is real — latest
    capture per post, views-weighted retention, exact totals, `?days`
    window. The weekly report IS this payload; it generates itself.
  - **B6.3** the loop: Spearman correlation of score vs client-normalized
    performance, per-signal correlations, and a retrain that steps the
    weights toward the rewarded signals — bounded (LR 0.25), floored,
    gated on a minimum sample, append-only `scoring_weights` history with
    the evidence basis. `score.js` consumes the latest weights and records
    which ones it used in its payload. `POST /api/analytics/retrain` runs a
    cycle; the ops analytics surface shows ρ + weights with a retrain
    button.
    Smokes: `npm run smoke:metrics` (39 assertions, including a PLANTED
    signal→performance relationship the loop must detect and move toward) and
    the pipeline smoke's B6 continuation (the real published clip gets
    captured, appears in the client report, and its score stage records the
    retrained weights it used). Both in CI. Under the local driver the
    correlation reads near zero by design; live drivers make it the model.

### B7 — Auth, roles, hardening (✅)

- Roles per the org: ops, editor, reviewer, account_manager, client
  (already in the `users` schema). Session auth, rate limits, audit log
  (review_events is the start), backups.
- **Done when:** client users can only see their own data; every publish
  and approval is attributable. ✅
  Done: the API has one door. Server-side sessions (revocable rows holding
  only the sha256 of the token; bearer for API clients, httpOnly cookie for
  browsers and media elements), scrypt passwords, a bootstrap endpoint that
  works exactly once to create the founding ops account — every later
  account is created from inside with an initial password (≥ 8 chars) its
  holder changes after first sign-in. Login is rate-limited and refuses to
  distinguish wrong-password from unknown-email. Role walls on every
  endpoint (`requireAuth(...roles)`); the marketing lead form is the one
  deliberately open door. Client users are fenced structurally: clip lists,
  assets, metrics, audit trails, reports, accounts, intake, and the review
  queue are all pinned to their own client regardless of what parameters
  they send. Identity comes from the session everywhere — `userId` left
  every request body — so approvals are attributable by construction, and
  `publish_jobs.scheduled_by` records who queued each publish (a human from
  ops, or the approver whose sign-off auto-scheduled it; visible in the ops
  queue). The `/ops` shared-key gate became a real login screen (bootstrap
  mode on a fresh database); the identity picker became the session badge
  with server-side logout. Smokes: `npm run smoke:auth` (33 assertions);
  every other smoke migrated to real per-role sessions
  (`scripts/lib-smoke-auth.mjs`), and `integration:f4` signs in for real —
  the audit rows it verifies carry the session identity. Hash material
  never leaves the API (`has_credentials` flag only). Still deliberately
  out of scope, noted for ops runbooks: DB backups are an infrastructure
  task, and CORS stays wide-open for dev (same-origin deploys; tighten
  `cors()` per environment when a separate origin appears).

---

## Suggested sequence

```
F1 ──► B1 ──► B2 ──► B3 ──► B4 ──► B5 ──► B6 ──► B7
        │      │      │      │
        └─F2   └─F3   └────F4┘            └─F5
```

Ship the marketing site now (F1 — done), build the machine (B-track),
and grow the two dashboards alongside the stages they depend on.
