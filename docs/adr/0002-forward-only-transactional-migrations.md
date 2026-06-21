# ADR-0002 — Forward-only, transactional migrations

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

The schema is the system of record and changes constantly as the pipeline grows.
We need an auditable history of every change, atomic apply (a half-applied schema
is worse than none), and zero drift between environments.

## Decision

Numbered SQL migrations applied on boot, in order. Each runs inside its own
`BEGIN`/`COMMIT` and is recorded in `schema_migrations`, so a failed migration
rolls back cleanly and is never half-recorded. Migrations are forward-only: never
edit an applied migration — add a new numbered one.

## Consequences

- Auditable, deterministic schema history; clean atomic apply or full rollback.
- No down-migrations by design — recovery is a new forward migration, not a revert.
- D3's migration test verifies a clean forward apply plus idempotency (re-running
  the runner is a no-op).

## Implementing files

- `backend/src/db/index.js` — the `migrate()` runner (per-file transaction,
  `schema_migrations` bookkeeping).
- `backend/migrations/001_init.sql … 026_identity.sql` — the ordered, append-only
  migration set.
