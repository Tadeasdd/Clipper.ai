# Clipper.ai

AI-native content operations. Long-form content in → scored, captioned,
publish-ready short-form clips out. **Customers buy a managed service, not
software** — the ops dashboard is the product; the client portal is a window.

## How to work in this repo

- **The roadmap is `docs/MVP_BACKEND_PLAN.md`.** Work **one milestone at a
  time** (M1 → M8). Do not start the next milestone until the current one's
  acceptance criteria pass and CI is green.
- **Plan before you write.** For any non-trivial change, enter plan mode and
  show the plan before editing code.
- **Small commits.** One milestone ≈ one reviewable PR. Use the commit message
  given in the plan for that milestone.

## Load-bearing — extend, never rewrite

This codebase is past skeleton stage. These parts are correct and deliberate;
build on them, don't re-architect them:

- **Postgres-native job queue** — `backend/src/pipeline/queue.js`,
  `publish/index.js`, `metrics/index.js`. Three queues, same shape:
  `FOR UPDATE SKIP LOCKED` claims, idempotent enqueue, 3-attempt exponential
  backoff, parked `failed` rows, retry endpoints. **No Redis/BullMQ** — don't
  add a queue dependency.
- **Schema-enforced status machine** — `clips.status` is a CHECK constraint;
  review transitions are single atomic CTEs (`routes/review.js`) so concurrent
  reviewers can't double-decide (lost race → 409). Keep transitions atomic.
- **Auth** — `lib/auth.js`, `migrations/008_auth.sql`: scrypt passwords,
  server-side sessions storing only `sha256(token)`, `requireAuth(...roles)`
  walls, client fencing on every read, login rate limit. Identity comes from
  the session, never the request body.
- **Credential encryption** — AES-256-GCM via `lib/crypto.js`; the API never
  returns plaintext credentials.
- **Media** — `pipeline/media.js`: real ffmpeg 9:16 rendering + `ebur128`
  loudness analysis. ffmpeg/ffprobe are required at runtime.
- **Migrations** — forward-only, transactional (`db/index.js`). Add a new
  numbered file in `migrations/`; never edit an applied migration.

## Conventions

- **Provider seams are env-switched** (ASR, LLM, publish, metrics, storage).
  The `builtin` / `local` defaults **must keep working with zero external keys
  and zero network** — CI and offline dev depend on it. New providers are
  additive behind the same seam.
- **Never silently fake a capability.** If a stage can't run for real (no key,
  no transcript), complete honestly with a visible marker (e.g.
  `signalsSource: "audio_only"`), never a fabricated result.
- **The ops dashboard is primary, the client portal secondary.** When a choice
  arises between software clients use and software employees use to deliver
  outcomes, choose the latter.
- **Positioning:** never describe the company as SaaS / tool / platform /
  dashboard product, in code comments, copy, or docs.

## Verify after every milestone

```bash
cd backend
node --check src/server.js
npm run smoke            # B2: intake / clients / leads
npm run smoke:pipeline   # B3–B6: synthetic podcast → sign-off → published → measured
npm run smoke:review     # B4: status machine, roles, audit trail
npm run smoke:publish    # B5: connections, scheduler, sign-off guarantee
npm run smoke:metrics    # B6: capture, report, retrain loop
npm run smoke:auth       # B7: sessions, role walls, client fencing
```

Frontend regression (when a change can touch it):

```bash
cd frontend && npm run build && npm run smoke
# with both servers up: npm run integration:f4  /  npm run integration:f5
```

Requires Postgres + ffmpeg. Each milestone in the plan also lists its own
acceptance criteria and a new smoke to add — run those too, and keep any
live-key / live-network assertions gated so offline CI stays green.

## Layout

```
backend/   Express API + Postgres + the pipeline (this is the MVP work)
frontend/  Vite + React — marketing site, /ops dashboard, /portal
docs/      MVP_BACKEND_PLAN.md (the roadmap) · ARCHITECTURE.md · BUILD_STAGES.md
```

> Note: `docs/BUILD_STAGES.md` marks B1–B7 ✅. That's true for the machinery and
> the offline drivers — **not** for the content intelligence that is the actual
> product. `docs/MVP_BACKEND_PLAN.md` closes exactly that gap.
