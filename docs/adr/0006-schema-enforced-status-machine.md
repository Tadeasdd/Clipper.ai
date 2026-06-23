# ADR-0006 — Schema-enforced clip status machine (atomic CTEs)

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

Nothing may publish without sign-off, and concurrent reviewers must not be able to
double-decide a clip. UI-level guards are not enough — the guarantee has to live
in the database.

## Decision

`clips.status` is a Postgres CHECK constraint. Each review transition is a single
atomic CTE statement that moves the status AND writes the audit row together, so
two concurrent reviewers can't both win — the loser gets a 409. Auto-publish is an
explicit opt-out; sign-off is enforced by the DB, not just the UI.

## Consequences

- Publishing without sign-off is structurally impossible.
- Transitions are race-safe and audited in the same write.
- Keep transitions atomic — splitting status move from the audit row reopens the
  double-decision race.

## Implementing files

- `backend/src/routes/review.js` — the atomic-CTE transitions.
- `backend/src/db/schema.sql` — the `clips.status` CHECK constraint.
