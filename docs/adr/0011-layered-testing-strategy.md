# ADR-0011 — Layered testing: smokes + unit/coverage/mutation/contract/migration

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

Broad end-to-end coverage and fast offline gates pull in different directions.
The smokes prove the whole system works against real infrastructure, but they're
slow and need a live stack; the pure core logic deserves faster, sharper checks.

## Decision

Keep integration **smoke** scripts (run against a live server + real Postgres +
ffmpeg in CI) as the end-to-end coverage. Underneath them, D3 adds `node:test`
unit tests with a c8 coverage gate, Stryker mutation testing, API contract tests,
and migration drift/forward-safe tests over the pure core logic.

## Consequences

- Fast offline gates sit beneath broad integration coverage — both, not either.
- Mutation testing keeps the unit tests honest (they must catch injected faults).
- Commands: `npm run coverage`, `npm run test:mutation`, `npm run test:contract`,
  `npm run test:migration`.

## Implementing files

- `backend/scripts/smoke-*.mjs` — integration smokes.
- `backend/test/{unit,contract,migration}/` — offline test layers.
- `backend/stryker.conf.json` — mutation config.
- See `backend/test/README.md` and `docs/adr/0001` for the queue these exercise.
