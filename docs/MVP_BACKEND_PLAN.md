# Clipper.ai — Backend MVP Plan (for Claude Code)

A repo-grounded plan to take the backend from "the machine runs end-to-end on
audio loudness" to "a real recording in produces genuinely good, publishable
clips out." Written to be executed by Claude Code, one milestone per branch,
each with files, approach, and acceptance criteria.

---

## 0. Ground truth: what's already real (don't rebuild it)

This codebase is far past a skeleton. The following are genuinely well-built and
should be treated as load-bearing, not touched except to extend:

- **A Postgres-native job queue** (`pipeline/queue.js`, `publish/index.js`,
  `metrics/index.js`) — three queues, same shape: `FOR UPDATE SKIP LOCKED`
  claims, idempotent enqueue, 3-attempt exponential backoff, parked `failed`
  rows, retry endpoints. No Redis/BullMQ needed.
- **Status machine enforced in the schema** — `clips.status` is a CHECK
  constraint; review transitions are single atomic CTEs (`routes/review.js`)
  so concurrent reviewers can't double-decide (lost race → 409).
- **Auth done right** (`lib/auth.js`, `008_auth.sql`) — scrypt passwords,
  server-side sessions storing only `sha256(token)`, role walls
  (`requireAuth(...roles)`), client fencing on every read, login rate limit,
  bootstrap-once founding account.
- **Encryption at rest** for platform credentials (AES-256-GCM, `lib/crypto.js`).
- **Real ffmpeg rendering** of 9:16 1080×1920 clips (`pipeline/media.js`):
  center-crop for video, branded waveform card for audio-only.
- **Real loudness analysis** (`ebur128` momentary LUFS) driving moment detection.
- **Forward-only transactional migrations** (`db/index.js`, `migrations/`).
- **Feedback-loop scaffolding** — Spearman correlation + bounded, floored,
  append-only weight retraining (`metrics/loop.js`).
- **Provider seams** for ASR (Deepgram), LLM (Anthropic), publish + metrics
  (YouTube), storage (local/S3), all swappable by env.
- **Smoke tests + CI** with a real Postgres service container and ffmpeg.

> **Important caveat:** `docs/BUILD_STAGES.md` marks B1–B7 as ✅. That is true
> for the *machinery and the offline `builtin`/`local` drivers*. It is **not**
> true for the content intelligence that is the actual product. The defaults
> make everything *run*; they do not make the clips *good*. The gap below is
> precisely that distance.

---

## 1. The core gap, in one sentence

**A clip company that picks clips by volume is not a great MVP.** Today
`analyze` ranks moments purely by audio energy; `transcribe` stores an empty
transcript by default; `score`'s `signals` only carry `energyZ / durationFit /
positionBonus` — none of the six things the business model sells ("high-
retention moments, emotional peaks, controversial statements, educational
insights, storytelling moments, hooks"). The MVP work is to make the pipeline
**transcript- and LLM-driven**, then make the output **publishable** (real
hooks, burned captions), then make intake handle the **headline input
(YouTube)**, then **harden** the queue and one real publish path.

---

## 2. Milestones (priority order)

```
M1 transcription that works out of the box   ← unblocks everything semantic
M2 transcript + LLM driven analyze/score      ← THE product (#1 gap)
M3 real hooks + caption burn-in               ← makes clips publishable
M4 robust ingest (YouTube + files + limits)   ← the headline input
M5 queue reliability (stuck-job reaper, DLQ)  ← won't survive prod without it
M6 one real publish + metrics path end-to-end ← closes the loop for real
M7 production hardening                        ← validation, CORS, secrets, logs
M8 tests + seed/demo for the new real paths
```

M1→M3 are the difference between a demo and a product. M4→M8 are the difference
between a product and one you can run for paying clients.

---

### M1 — Transcription that works with zero external keys

**Why:** `transcribe.js` `builtin` returns `{words:[], text:null}`. Every
semantic improvement (M2, M3) depends on a transcript existing. The Deepgram
adapter is "written to spec, exercise against a live key before relying on it"
— i.e. unverified, and cloud-keyed.

**Goal:** at least one ASR path that produces real word-level timestamps with
**no paid API key**, plus a verified cloud path for scale.

**Files:** `src/pipeline/transcribe.js`, `src/pipeline/media.js` (audio
extraction helper), `.env.example`, `package.json` (CI installs the binary).

**Approach:**
- Add a `whisper` provider (`TRANSCRIPTION_PROVIDER=whisper`) that shells out to
  `whisper.cpp` (or `faster-whisper` via a small Python sidecar) on the
  extracted 16 kHz mono WAV. Add a `media.extractAudioWav(src)` helper. Return
  the same `{ words:[{w,s,e}], text }` shape the schema already expects.
- Keep `deepgram` as the scale path but add a real recorded-audio test against
  a short fixture (gated on `TRANSCRIPTION_API_KEY` so CI skips when unset).
- Make `builtin` honestly *fail closed* on real recordings only when a later
  stage needs words — it can still store the empty transcript for the loudness-
  only fallback, but log a clear warning that semantic stages are degraded.

**Acceptance:**
- With `TRANSCRIPTION_PROVIDER=whisper` and no API keys, a 30 s fixture yields
  `transcripts.text` non-empty and `words` length > 0.
- New smoke `smoke:transcribe` asserts word timestamps land within the clip
  windows analyze produced.
- CI installs the whisper binary + a tiny model and runs the smoke offline.

**Commit:** `M1: offline whisper ASR provider + verified deepgram path`

---

### M2 — Transcript + LLM-driven analyze and score (the product)

**Why:** This is the literal IP. Right now moment selection is loudness only;
`signals` is three audio numbers. The company sells *semantic* clip-finding.

**Goal:** moments are chosen and scored from **what is said**, with the six
signal types stored on each clip so reviewers and the ops board can see *why*.

**Files:** `src/pipeline/analyze.js`, `src/pipeline/score.js`,
`src/metrics/loop.js` (extend `DEFAULT_WEIGHTS` + retrain dimensions),
new `src/pipeline/llm.js` (shared LLM client behind the existing seam),
migration `009_signals.sql` if you widen what's indexed.

**Approach:**
- Keep loudness as a cheap **prior** that proposes candidate windows (it works
  and it's free). Then, when a transcript exists, run an LLM pass over each
  candidate window's transcript span to emit structured signals:
  ```json
  { "retention": 0.0-1, "emotion": 0-1, "controversy": 0-1,
    "education": 0-1, "story": 0-1, "hookStrength": 0-1,
    "rationale": "one line" }
  ```
  Use the existing Anthropic seam; batch windows into one call where possible;
  enforce JSON-only output and parse defensively (the artifact-API guidance in
  this repo already documents the "respond ONLY in JSON, strip fences" pattern).
- `analyze` should *also* be able to find moments the loudness prior misses:
  give the LLM the full transcript with timestamps and let it nominate spans,
  then snap each span to sentence boundaries from the word timestamps. Union
  the loudness candidates and the LLM candidates; dedupe by overlap.
- `score` blends the audio signal with the semantic signals via the weight
  vector. Extend `DEFAULT_WEIGHTS` to include the new dimensions; keep the
  bounded/floored retrain in `loop.js` honest (it already records its basis).
- Store every signal in `clips.signals` (jsonb, already opaque) and the LLM
  `rationale` so the ops review desk (F4.3 already renders signal meters) shows
  the real why, not an energy z-score.
- **Cost guard:** cap transcript characters per call, cap candidates per
  recording, and make the LLM pass *optional and degradable* — no key →
  loudness-only with a visible `signalsSource: "audio_only"` marker (never
  silently pretend semantic ran).

**Acceptance:**
- On a fixture with one obviously controversial/educational segment, that
  segment scores top even when it is **not** the loudest (plant a louder but
  vacuous segment and assert it loses).
- `clips.signals` contains all six semantic fields plus the audio fields.
- With no LLM key, the pipeline still completes and marks `signalsSource`
  honestly.
- Extend `smoke:pipeline` with the planted semantic-vs-loud assertion.

**Commit:** `M2: transcript-grounded LLM moment scoring with explainable signals`

---

### M3 — Real hooks + burned-in captions

**Why:** Two publishability gaps. (a) Hooks are `"Moment #N — hook pending
editor"` unless `LLM_PROVIDER=anthropic` *and* a transcript exists (which
`builtin` ASR never produced — M1 fixes the precondition). (b) `media.js`
`renderVertical` has **no caption burn-in** despite the docs claiming it.
Short-form clips live or die on on-screen captions.

**Goal:** every rendered clip ships with a real hook and burned, word-timed
captions in the client's brand style.

**Files:** `src/pipeline/generate.js`, `src/pipeline/media.js`,
`src/pipeline/llm.js` (from M2), `clients.brand_config` consumption.

**Approach:**
- **Captions:** from the transcript word timestamps (now real after M1), build
  an `.ass`/`.srt` for the clip's time range, offset to clip-local time, and
  add `subtitles=` (or `ass=`) to the ffmpeg filtergraph in `renderVertical`.
  Style (font, size, highlight color, position) comes from
  `clients.brand_config` with sensible defaults; the neon green already used in
  the waveform card (`0x53fc18`) is a good default highlight.
- **Hooks:** route through the M2 LLM client; generate 2–3 hook variants and
  store them so editors pick/adjust in the F4 review desk (the `PATCH
  /api/clips/:id` route already edits `hook`). Keep the placeholder only as the
  no-key fallback, clearly labelled.
- Make caption burn-in a per-clip flag (`brand_config.captions !== false`) so
  audio-only podcasts and video both work.

**Acceptance:**
- A rendered fixture clip, ffprobed, has burned text (assert via a frame
  extract + nonzero pixel diff in the caption band, or simpler: assert the ass
  filter was applied and the file differs from a no-caption render).
- `clips.hook` is a real sentence (≤ 9 words) when an LLM key is present.
- `smoke:pipeline` B5 continuation still publishes the captioned clip.

**Commit:** `M3: word-timed caption burn-in + LLM hook variants from brand config`

---

### M4 — Robust ingest: YouTube + direct files + limits

**Why:** The business lists **YouTube videos** as a primary input, but
`ingest.js` does a plain `fetch(source_url)` — fine for a direct `.mp4/.mp3`
link, useless for a YouTube *watch* URL (it fetches HTML). There is no
`yt-dlp`. Also: no upload size cap, no content-type validation, and intake is
not idempotent (double-submit → duplicate `recordings`).

**Goal:** "paste your YouTube/podcast URL" actually works; uploads are bounded
and validated; resubmits don't duplicate.

**Files:** `src/pipeline/ingest.js`, `src/routes/intake.js`,
`src/storage/*` (size cap on `saveStream`), `.env.example`, CI (install
`yt-dlp`).

**Approach:**
- In `ingest`, detect platform URLs (YouTube, etc.) and pull with `yt-dlp`
  (`-f bestaudio/best`, `--max-filesize`, `--no-playlist`) into storage; fall
  back to `fetch` for direct media URLs. Probe as today.
- Add `MAX_UPLOAD_BYTES` enforced in `saveStream` (stream-count bytes, abort +
  delete partial on overflow) and reject non-AV content-types on the PUT path.
- Idempotency: accept an optional `Idempotency-Key` (or dedupe on
  `client_id + source_url` within a window) so the F3/F5 forms can't create
  duplicate recordings on a double click.
- Validate `kind` against the allowed enum; default by source.

**Acceptance:**
- A real short YouTube URL ingests to a probed recording with audio + duration.
  (CI: gate the live-network YouTube assertion; always run the direct-file path
  offline against a fixture HTTP server.)
- Uploading > `MAX_UPLOAD_BYTES` returns 413 and leaves no partial object.
- Submitting the same `source_url` twice yields one recording.

**Commit:** `M4: yt-dlp URL ingest, upload size/type limits, idempotent intake`

---

### M5 — Queue reliability: stuck-job reaper + dead-letter + depth metrics

**Why:** `claim()` sets `status='running'`; if a worker process dies mid-job the
row is stuck `running` forever — nothing reclaims it (no visibility timeout).
Same risk in the publish and metrics queues. There's no dead-letter view and no
queue-depth signal for ops.

**Goal:** crashes self-heal; permanently failed work is visible and separable;
ops can see queue health.

**Files:** `src/pipeline/queue.js`, `src/publish/scheduler.js`,
`src/metrics/index.js`, migration `010_queue_health.sql`,
`src/routes/jobs.js` + `src/routes/analytics.js` (ops surface).

**Approach:**
- Add a **visibility timeout**: a reaper sweep returns `running` jobs whose
  `started_at` is older than `JOB_VISIBILITY_TIMEOUT_S` back to `pending`
  (respecting attempts/backoff). One sweep per queue, cheap, runs on the same
  loop tick.
- Treat the 3rd-attempt park as a **dead-letter** state distinct from transient
  failure (it already parks as `failed`; add a `dead_letter` boolean or a
  reason so the ops board separates "retrying" from "needs a human").
- Add `GET /api/analytics/queues` (ops-gated): per-stage counts of
  pending/running/failed and oldest `run_after` — wire into the F4 processing
  board.

**Acceptance:**
- A job killed mid-run (simulate: set `started_at` in the past, process exits)
  is reclaimed and completes on the next sweep.
- `smoke:pipeline` adds a "kill a running job, assert recovery" case.
- Queue-depth endpoint returns correct counts under the smoke load.

**Commit:** `M5: visibility-timeout reaper, dead-letter separation, queue health`

---

### M6 — One real publish + metrics path, end-to-end

**Why:** `local` publish/metrics drivers are honest offline simulators — good
scaffolding, but the feedback loop ("the moat") can't learn because
`metrics/local.js` generates performance **independent of score by design**.
The loop only becomes real with a live metrics source, which needs a real
publish to a real channel. Only YouTube adapters exist and they're unverified
live.

**Goal:** an approved clip publishes to a real YouTube channel and its real
view metrics flow into `clip_metrics` and through one retrain cycle.

**Files:** `src/publish/youtube.js`, `src/metrics/youtube.js`,
`src/routes/publish.js` (OAuth connect flow), docs runbook.

**Approach:**
- Build the **OAuth connect flow** to mint the `{clientId, clientSecret,
  refreshToken}` the adapter expects, store via the existing encrypted
  `platform_connections`. (Document the Google Cloud console steps; the upload
  scope is `youtube.upload`, metrics needs `youtube.readonly`.)
- Verify `publish/youtube.js` `videos.insert` against a real test channel
  (resumable upload is more robust than multipart for larger files —
  consider switching). Confirm the returned id resolves as a Short.
- Verify `metrics/youtube.js` `videos.list` populates views/likes/comments;
  leave fields the Data API doesn't expose as `null` (it already does this).
- Keep `local` as the default so CI and offline dev are unaffected; live is
  opt-in via `PUBLISH_DRIVER=live` / `METRICS_DRIVER=live`.
- After ≥1 real capture cycle, run `POST /api/analytics/retrain` and confirm a
  non-trivial correlation and a weight move (this is the first time the moat is
  real rather than scaffolded).

**Acceptance:**
- Manual (documented) live run: clip → published Short → metrics row with real
  views → retrain produces ρ ≠ 0 and a recorded weight change with basis.
- Offline CI unchanged (local drivers).

**Commit:** `M6: YouTube OAuth connect + verified live publish/metrics + first real retrain`

---

### M7 — Production hardening

**Why:** The docs themselves flag deliberate gaps: CORS wide open, no DB
backups, rate-limiting only on login. Add the rest before real clients.

**Goal:** safe to run for paying clients on a public origin.

**Tasks (each small, can be one commit):**
- **Request validation:** introduce a lightweight schema validator (e.g. `zod`)
  for all write routes; today validation is hand-rolled and inconsistent.
- **CORS:** lock to configured origins via `CORS_ORIGINS` (keep wide-open only
  when unset for dev).
- **Rate limits beyond login:** per-IP limit on intake + lead capture (the lead
  form is the one public door).
- **Secrets/config:** fail fast on boot if `PUBLISH_TOKEN_KEY` or
  `DATABASE_URL` look unset/insecure in production (`NODE_ENV=production`).
- **Structured logging + error reporting:** replace `console.error` with a
  JSON logger and a Sentry (or equivalent) hook in the central error handler;
  redact tokens.
- **Backups runbook:** document `pg_dump` schedule + object-storage lifecycle;
  this is infra, but write the runbook in `docs/`.
- **Security headers + payload limits** already partly present (`express.json`
  2 mb cap) — add `helmet`, confirm the upload PUT path stays unbuffered.

**Acceptance:** a "prod config" smoke that boots with `NODE_ENV=production` and
a strict env, asserts CORS rejects an unlisted origin, and asserts boot fails
on a missing `PUBLISH_TOKEN_KEY`.

**Commit(s):** `M7.x: <each item>`

---

### M8 — Tests + seed/demo for the new real paths

**Why:** The existing smokes are excellent but cover the offline drivers. The
new semantic/caption/ingest paths need their own coverage, and onboarding needs
a one-command demo.

**Tasks:**
- New smokes: `smoke:transcribe` (M1), semantic assertion in `smoke:pipeline`
  (M2), caption assertion (M3), ingest-limits + idempotency (M4), reaper (M5).
- A `npm run seed:demo` that creates a client, ingests a bundled fixture
  recording, and runs it through to rendered captioned clips — so a new
  developer (or a sales demo) sees real output in one command.
- Wire the new smokes into CI; keep all live-key/live-network assertions gated
  so the offline CI stays green and fast.

**Commit:** `M8: coverage for ASR/semantic/caption/ingest/reaper + demo seed`

---

## 3. Suggested branch/PR sequence

```
M1 ─► M2 ─► M3        (the product: demo → publishable clips)
         └─► M4        (headline input; parallel-safe after M1)
M5                     (reliability; independent, do early if shipping soon)
M6                     (needs M3 output + real channel)
M7, M8                 (continuous; M8 grows with each milestone)
```

Each milestone is independently shippable and leaves CI green. Do **M1–M3
first** — they convert the existing machine from "renders the loudest 30
seconds" into "finds and packages the moments worth clipping," which is the
whole pitch.

## 4. Two things to decide before starting

1. **ASR substrate** (M1): self-hosted whisper.cpp (no per-minute cost, more ops
   surface) vs. Deepgram/AssemblyAI (simplest, per-minute cost). Recommendation:
   ship whisper.cpp as the default so the MVP has zero marginal ASR cost, keep
   the cloud seam for scale.
2. **First publish platform** (M6): YouTube is the only adapter written and has
   the friendliest API for programmatic upload + metrics. Recommendation: make
   YouTube the one real end-to-end path for the MVP; keep the others on the
   honest `local` outbox until there's demand.
