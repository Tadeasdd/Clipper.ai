# Backend test depth (Capstone D3)

The smoke suite (`scripts/smoke-*.mjs`) covers the system end-to-end against a
live server. D3 adds four focused layers underneath it. All are offline and need
zero external keys; the DB-bound ones use the same Postgres the smokes do.

| Layer                          | Command                  | Needs                    |
| ------------------------------ | ------------------------ | ------------------------ |
| Unit + coverage gate           | `npm run coverage`       | nothing (pure)           |
| Mutation score                 | `npm run test:mutation`  | nothing (pure)           |
| API contract                   | `npm run test:contract`  | a booted server (`BASE`) |
| Migration drift / forward-safe | `npm run test:migration` | Postgres                 |

## Unit + coverage (`test/unit/`)

`node:test` specs for the pure, dependency-free core logic — `src/lib/stats.js`,
`src/lib/validate.js`, `src/lib/password-policy.js`. `npm run coverage` runs them
under `c8` with `--check-coverage` (lines 95 / functions 100 / branches 90,
scoped to those three modules), so the build fails if the floor regresses.

## Mutation (`stryker.conf.json`)

Stryker mutates the same three modules and re-runs the unit suite per mutant; the
**mutation score** proves the tests actually assert behaviour rather than just
execute it. The `break` threshold fails CI if the score collapses (a gutted or
assertion-free test suite can't pass silently).

## API contract (`test/contract/`)

Hits the live API and validates each core endpoint's response **shape + types**
against `contract-schema.mjs`. The schema asserter reuses `checkBody`
(`src/lib/validate.js`), so a dropped, renamed, or retyped field the
dashboards/portal rely on fails the gate before it ships.

## Migration drift / forward-safe (`test/migration/`)

The migrations are **forward-only + transactional** by design (CLAUDE.md;
`src/db/index.js` `migrate()`) — there are no down-migrations. "Reversible /
forward-safe" is therefore honoured as: filenames are 3-digit, gapless and
strictly increasing; every migration applies cleanly on a freshly-created
throwaway database; and a second `migrate()` is a no-op (the applied set matches
the files on disk — no drift). The test creates and drops its own scratch DB.
