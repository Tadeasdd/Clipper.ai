# Clipper.ai Backend — Phases 1–6

The full processing + auth + billing pipeline for Clipper.ai, plus production hardening. Upload a podcast → get back rendered short-form clips, billed by the minute.

- **Phase 1 (done)**: API, DB, R2 uploads, Inngest orchestration
- **Phase 2 (done)**: audio extraction (FFmpeg) → transcription (Deepgram Nova-3) → segmentation (Claude Sonnet 4.5)
- **Phase 3 (done)**: virality scoring (Claude Haiku 4.5) with structured rubric
- **Phase 4 (done)**: render workers — FFmpeg cut + crop + caption burn-in across 9:16, 1:1, 16:9
- **Phase 5 (done)**: Clerk JWT auth, Stripe checkout + portal + webhooks, per-tier quotas, Starter watermark
- **Phase 6 (done)**: request IDs + structured logging, standardized error envelope, optional Sentry, parallel readiness checks (DB + R2), per-org token-bucket rate limiting, idempotent job creation, cooperative job cancellation, webhook dedupe
- **Future**: public API keys + SDKs, MediaPipe face tracking, chunked 4hr+ podcast segmentation, multi-language transcription

## What works end-to-end now

1. User signs in via Clerk on the frontend → JWT issued
2. Frontend `POST /v1/uploads/presign` with `Authorization: Bearer <jwt>` → R2 presigned PUT URL (key namespaced by org)
3. Frontend uploads the video direct to R2 (4GB cap)
4. Frontend `POST /v1/jobs` — auth dependency resolves to (User, Org), auto-creating both on first sign-in. Quota check rejects with `402 Payment Required` if the org is at their monthly minute cap. Otherwise Inngest fires the pipeline.
5. Worker downloads from R2, FFmpeg extracts mono 16kHz audio
6. Deepgram Nova-3 transcribes with word-level timestamps + speaker diarization
7. Claude Sonnet 4.5 segments → Claude Haiku 4.5 scores → real Clip rows inserted
8. Renderer loads the Org's plan tier and decides whether to add the "Made with Clipper.ai" watermark. Three aspect ratios per clip, parallel FFmpeg, uploaded to R2.
9. Successful jobs append a row to `usage_minutes` (rounded up to nearest minute). Failed jobs don't burn quota.
10. `GET /v1/jobs/{id}` returns presigned download URLs per aspect — scoped to the caller's org.
11. `GET /v1/usage` returns the current month's plan tier + minutes used / limit / remaining.
12. `POST /v1/billing/checkout` returns a Stripe Checkout URL for the requested plan. After payment, the `checkout.session.completed` webhook flips `org.plan_tier`.
13. `POST /v1/billing/portal` returns a Stripe customer portal URL so users can manage their subscription. Cancellations drop the org back to Starter (data preserved).

## Phase 5 setup

To run with real auth + billing, configure these env vars (see `.env.example`):

**Clerk** — sign up at clerk.com, create an application:
- `CLERK_JWKS_URL` — `https://{your-frontend-api}.clerk.accounts.dev/.well-known/jwks.json`
- `CLERK_ISSUER` — your Clerk issuer URL
- `CLERK_WEBHOOK_SECRET` — only needed if you wire up Clerk → Inngest sync (Phase 6)

**Stripe** — create three products in Stripe dashboard for Starter / Studio / Scale, copy the price IDs:
- `STRIPE_SECRET_KEY` — `sk_test_…` or `sk_live_…`
- `STRIPE_WEBHOOK_SECRET` — from your webhook endpoint config
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_STUDIO`, `STRIPE_PRICE_SCALE`
- `STRIPE_CHECKOUT_SUCCESS_URL`, `STRIPE_CHECKOUT_CANCEL_URL` — where to redirect after checkout

**For local dev without Clerk/Stripe**: set `DEV_MODE_SKIP_AUTH=true` and the API will use the seeded dev org for every request. Quota + watermark logic still works (Starter tier).

## Architecture

```
Frontend ──POST /v1/uploads/presign──▶ API ──▶ returns presigned R2 URL
Frontend ──PUT video──▶ R2 (direct, no API in the path)
Frontend ──POST /v1/jobs (with R2 key)──▶ API ──▶ Inngest trigger
                                          │
                                          ▼
                                    Inngest worker
                                    (no-op for now,
                                     real pipeline later)
                                          │
                                          ▼
                                  Postgres job.status updates
Frontend ──GET /v1/jobs/{id}──▶ API ──▶ returns current status
```

## Running locally

You need:
- Docker (for Postgres)
- Python 3.12
- **FFmpeg** installed locally (`brew install ffmpeg` or `apt install ffmpeg`)
- Cloudflare R2 account + bucket
- Deepgram API key (free $200 credit at signup)
- Anthropic API key
- Inngest CLI for local dev (`npm i -g inngest-cli`)

```bash
# 1. Install deps
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt

# 2. Start Postgres (Docker)
docker compose up -d postgres

# 3. Set env
cp .env.example .env
# fill in R2 + Inngest + Deepgram + Anthropic keys

# 4. Migrate
alembic upgrade head

# 5. Run API
uvicorn app.main:app --reload --port 8000

# 6. In a second terminal, run the Inngest worker
inngest-cli dev -u http://localhost:8000/api/inngest
```

## What Phase 4 proves

Run the full flow with a real podcast and you get downloadable MP4s back:

- `GET /v1/jobs/{id}` returns clips with real `rendered_urls: { "9:16": "https://...", "1:1": "...", "16:9": "..." }`
- All three aspect ratios have burned-in karaoke-style captions (TikTok-standard, word-by-word highlight in neon green)
- 9:16 is center-cropped (no face tracking yet — that's a Phase 4.5 if customers need it)
- Clips are playable in the frontend's results modal directly from R2

## Cost per processed minute (Phases 1–4)

| Step | Cost per 60-min podcast |
|---|---|
| Deepgram Nova-3 | $0.26 |
| Claude Sonnet 4.5 segmentation (~10k input, ~2k output) | $0.06 |
| Claude Haiku 4.5 scoring (10 beats × ~1k in, ~300 out) | $0.025 |
| Render compute (~5s per aspect × 3 aspects × 10 clips = ~150s of CPU) | ~$0.01 on Fly.io |
| R2 storage (transcripts + rendered clips, ~50MB) | $0.0008 |
| **Total per 60-min podcast** | **~$0.35** |

Render is dominated by CPU time, not API spend. If we ever need GPU-fast rendering (real-time-or-better), Modal's $0.50/hr GPU workers would handle ~720 clips/hr — still ~95% gross margin at the Studio $49/1000min tier.

## Repo layout

```
app/
  main.py                   FastAPI entrypoint
  core/
    config.py               Pydantic settings
    r2.py                   Cloudflare R2 client + presigning + uploads
    inngest_client.py       Inngest client setup
    ffmpeg.py               PHASE 2: audio extraction + duration probe
    deepgram_client.py      PHASE 2: Nova-3 transcription + response normalization
    anthropic_client.py     PHASE 2: Claude Sonnet segmentation + JSON parsing
    scorer.py               PHASE 3: Claude Haiku virality scoring + parallel fan-out
    captions.py             PHASE 4: ASS subtitle generation from word timestamps + watermark
    renderer.py             PHASE 4: FFmpeg cut/crop/burn-in per aspect, R2 upload
    auth.py                 PHASE 5: Clerk JWT verification + FastAPI dep
    quotas.py               PHASE 5: plan limits, usage counting, quota enforcement
    billing.py              PHASE 5: Stripe checkout / portal / webhook handlers
  db/
    base.py                 SQLAlchemy async session
    models.py               ORM models
  schemas/
    jobs.py                 Pydantic request/response models
    uploads.py
    billing.py              PHASE 5: checkout / portal / usage schemas
  api/
    health.py
    jobs.py                 (PHASE 5 rewritten: auth-scoped, quota-checked)
    uploads.py              (PHASE 5 rewritten: auth-scoped, org-namespaced keys)
    billing.py              PHASE 5: /v1/billing/{checkout,portal,webhook}, /v1/usage
    inngest_webhook.py
  workers/
    pipeline.py             5-step Inngest pipeline + usage_minutes record on success + cooperative cancellation
  core/
    middleware.py           PHASE 6: per-request ID + structured log binding + timing
    rate_limit.py           PHASE 6: per-org token bucket, tier multipliers, swappable for Redis
  schemas/
    errors.py               PHASE 6: standard error envelope
alembic/                    DB migrations (schema forward-built since Phase 1)
  versions/
    0001_initial.py
    0002_hardening.py       PHASE 6: cancelled status + idempotency_keys + processed_webhooks
tests/
  conftest.py               Phase 5: test-friendly env var setup
  test_smoke.py             API endpoint smoke tests (auth dep overridden)
  test_phase2.py            JSON extraction, beat filtering, Deepgram normalization
  test_phase3.py            Score validation, clamping, fallback paths
  test_phase4.py            Caption generation, ASS escaping, filter graph
  test_phase5.py            Quota math, watermark, Stripe plan mapping, auth dev mode
  test_phase6.py            Token bucket, rate limits, idempotency, cancellation, webhook dedupe, readiness
  test_phase6b.py           Cleanup crons, cursor encode/decode, get_db rollback
```

**129 unit tests passing** (13 + 19 + 22 + 33 + 23 + 11 + 8 smoke).

## Phase 6 production hardening — what's new

**Per-request observability**
- Every request gets an `X-Request-ID` (incoming or minted). Bound into structlog contextvars so every log line tagged by request. Returned to the client for support / log lookup.
- `request_complete` log line per request: status, elapsed_ms, method, path.
- Optional Sentry — set `SENTRY_DSN`; gracefully degrades if `sentry-sdk` isn't installed.

**Standardized error envelope**
- Every 4xx/5xx returns `{"error": {"code", "message", "request_id", "details"}}`.
- Frontend can switch on `error.code` instead of parsing `message`.
- Stack traces never leak — internal errors are scrubbed to a generic `internal_error` with the request_id for support.

**Readiness probe with parallel dep checks**
- `GET /health/ready` runs DB `SELECT 1` and R2 `head_bucket` in parallel (2s timeout each).
- Returns **503** if any dep fails so your load balancer pulls the replica out of rotation.
- `GET /health` stays cheap and always 200 — DB hiccups should not restart containers.

**Per-org rate limiting (token bucket)**
- Three endpoint groups: `expensive` (POST jobs / presign, 10/min), `read` (GET jobs / usage, 60/min), `billing` (checkout / portal, 5/min).
- Per-tier multipliers: Starter 1×, Studio/Scale 5×, Enterprise 50×.
- In-memory per-replica today; swap `_BUCKETS` for Redis-backed dict when scaling. Interface stays identical.
- Returns 429 with `Retry-After` header.

**Idempotent job creation**
- `POST /v1/jobs` accepts `Idempotency-Key` header. Same key from same org → returns the existing job (no duplicate billing on network retries).
- `UniqueConstraint("org_id", "key")` is the race-safe lock — if two concurrent requests slip past the lookup, one gets `IntegrityError` and we resolve to the winner.
- Stale rows (job was deleted) get dropped + a new job is created.

**Cooperative job cancellation**
- `DELETE /v1/jobs/{id}` flips status to `cancelled`. The Inngest worker checks status at each step boundary (`_set_status` raises `CancellationRequested` if it sees `cancelled`) and unwinds cleanly without marking the job FAILED.
- Already-running steps (e.g. an in-flight Deepgram call) finish naturally — no forced kill needed.
- Calling DELETE on a terminal job (COMPLETE / FAILED / CANCELLED) returns 200 with `already_terminal: true`. Fully idempotent.

**Webhook dedupe**
- Incoming Stripe webhooks are deduped against `processed_webhooks` table by event ID before the handler runs.
- Race condition handled via `UniqueConstraint("provider", "event_id")` — concurrent retries get caught by the DB.
- If the handler throws, the dedupe row is rolled back so Stripe's retry gets a clean slate. Always returns 200 to Stripe to avoid retry storms on bad event data.

## Phase 6.5 follow-ups — bounded growth + pagination

After the main hardening pass, four more issues needed addressing before launch:

**Scheduled cleanup workers** (`app/workers/cleanup.py`, Inngest cron-triggered)
- `cleanup_idempotency_keys` — hourly, drops rows >24h old. Without this the table grows linearly with traffic forever.
- `cleanup_processed_webhooks` — daily at 03:30 UTC, drops rows >30d old (10× Stripe's max retry window).
- `cleanup_orphan_uploads` — every 6h, walks `uploads/` in R2 and deletes objects with no matching `jobs.source_r2_key`. 1h grace window protects in-flight uploads from a racy upload+create-job sequence; 30d hard cap is defensive.

**DB connection pool tuning** (`app/db/base.py`)
- Added `pool_recycle=1800` (30 min). Without this, connections idle past Supabase's pooler timeout fail mid-query under low traffic — the classic "works in dev, mystery 500s in prod" pattern.
- `pool_pre_ping=True` already on, validates connections at checkout.

**Cursor-paginated `GET /v1/jobs`**
- Returns `{"items": [...], "next_cursor": "..."}` instead of a bare list.
- Cursor is base64 of `(created_at, job_id)` — stable under inserts (new jobs don't shift page boundaries) and O(log N) on big tables vs offset-based.
- Composite index `(org_id, created_at DESC)` added in migration 0003 so the query stays index-ordered.

**`get_db` lifecycle audit**
- Verified that the FastAPI dep correctly rolls back on exception before close (test added).
- Removed redundant `session.close()` — the `async with` context manager already handles it.
