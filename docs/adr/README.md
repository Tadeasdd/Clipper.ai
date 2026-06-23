# Architecture Decision Records

An ADR captures one significant, hard-to-reverse decision: the context that forced
it, the choice made, and the consequences we accepted. They explain **why** the
codebase is shaped the way it is, so a future engineer changes it deliberately
rather than by accident.

These records are descriptive of decisions already implemented and load-bearing
(see the "load-bearing — extend, never rewrite" list in `CLAUDE.md`). Each links
to the code that enforces it.

## Index

| ADR                                                     | Decision                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| [0001](0001-postgres-native-job-queue.md)               | Postgres-native job queue (no Redis/BullMQ)                         |
| [0002](0002-forward-only-transactional-migrations.md)   | Forward-only, transactional migrations                              |
| [0003](0003-server-side-sessions-and-client-fencing.md) | Server-side sessions, scrypt, client fencing                        |
| [0004](0004-envelope-encryption-rotatable-keyring.md)   | AES-256-GCM envelope encryption + rotatable keyring                 |
| [0005](0005-env-switched-provider-seams.md)             | Env-switched provider seams with offline defaults                   |
| [0006](0006-schema-enforced-status-machine.md)          | Schema-enforced clip status machine (atomic CTEs)                   |
| [0007](0007-resilience-timeout-breaker-bulkhead.md)     | Timeout + circuit breaker + bulkhead on external calls              |
| [0008](0008-ssrf-safe-ingest-fetch.md)                  | SSRF-safe ingest fetch                                              |
| [0009](0009-vendor-neutral-observability.md)            | Vendor-neutral observability (OpenTelemetry + Prometheus)           |
| [0010](0010-in-process-workers-by-default.md)           | In-process workers by default, env opt-out                          |
| [0011](0011-layered-testing-strategy.md)                | Layered testing: smokes + unit/coverage/mutation/contract/migration |

## How to add an ADR

ADRs are append-only, like the migrations. To record a new decision, copy the
template below into the next number (`NNNN-kebab-title.md`) and add a row above.
**Never rewrite a decided ADR** — if a later decision overturns it, write a new
ADR and set the old one's status to `Superseded by ADR-NNNN`.

```markdown
# ADR-NNNN — <title>

- **Status:** Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD

## Context

What forces the decision (constraints, the problem, what we rejected and why).

## Decision

The choice, stated plainly.

## Consequences

What this buys us and what we accept in return.

## Implementing files

`path/to/file.js` — what it does.
```
