# ADR-0005 — Env-switched provider seams with offline defaults

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

The pipeline depends on external capabilities (ASR, LLM, publish, metrics,
storage), but CI and offline dev must run with zero keys and zero network. A stage
that can't run for real must never fabricate a result.

## Decision

Every external capability sits behind an env-switched seam whose `builtin`/`local`
default works fully offline. Real providers are additive behind the same seam — no
fork in the calling code. A stage that cannot run for real completes honestly with
a visible marker (e.g. `signalsSource: "audio_only"`), never an invented result.

## Consequences

- CI and offline dev need no keys and no network.
- Degradation is honest and visible, not silent.
- New providers extend the seam rather than re-architecting the stage.

## Implementing files

- `backend/src/pipeline/transcribe.js` — ASR seam.
- `backend/src/pipeline/llm.js` — LLM seam.
- `backend/src/publish/index.js` — publish seam.
- `backend/src/metrics/index.js` — metrics seam.
- `backend/src/storage/index.js` — storage seam.
