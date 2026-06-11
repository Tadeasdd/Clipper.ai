# Build Stages

The roadmap for taking the marketing sandbox to a full operations platform.
Guiding rule from the business model: **when choosing between software customers
use and software employees use to deliver client outcomes, choose the latter.**
The ops dashboard is the product; the client dashboard is a window into it.

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

### F4 — Operations dashboard (the primary product)
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
- **Depends on:** B2–B4.

### F5 — Client dashboard (limited visibility)
Secondary by design. Four surfaces only:
- Upload content (file or URL)
- View deliverables
- Approve content (the client side of the review workflow)
- Analytics reports
- **Depends on:** B4, B6, plus client-role auth (B7).

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

### B3 — The pipeline (the heart of the company)
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
  visible in the ops board with per-stage status and retry.

### B4 — Review workflow
- Internal QA decisions (`POST /api/review/:clipId/decision`) with the
  status machine already encoded in the schema:
  `candidate → awaiting_review → approved_internal → awaiting_client → approved`.
- Client approval path honors the FAQ promise: **nothing publishes without
  sign-off unless the client opts into auto-publish.**
- **Done when:** a clip can travel the full status machine via the API.

### B5 — Publishing
- Platform adapters (YouTube Shorts, TikTok, Instagram Reels, LinkedIn, X)
  behind one interface; per-client OAuth tokens stored encrypted.
- Scheduler drains `publish_jobs` at `scheduled_at`; failures retry and
  surface in the ops queue.
- **Done when:** an approved clip auto-publishes to one platform end-to-end.

### B6 — Measurement + the optimization loop
- Pollers pull per-post metrics into `clip_metrics`.
- Client report aggregation (`GET /api/analytics/clients/:id`) for F5.
- The differentiator: correlate `clips.score` with realized performance and
  feed it back into the B3 scoring stage. This loop is the moat.
- **Done when:** weekly client report generates itself; score model retrains
  on ≥ one cycle of real data.

### B7 — Auth, roles, hardening
- Roles per the org: ops, editor, reviewer, account_manager, client
  (already in the `users` schema). Session auth, rate limits, audit log
  (review_events is the start), backups.
- **Done when:** client users can only see their own data; every publish
  and approval is attributable.

---

## Suggested sequence

```
F1 ──► B1 ──► B2 ──► B3 ──► B4 ──► B5 ──► B6 ──► B7
        │      │      │      │
        └─F2   └─F3   └────F4┘            └─F5
```

Ship the marketing site now (F1 — done), build the machine (B-track),
and grow the two dashboards alongside the stages they depend on.
