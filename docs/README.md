# Clipper.ai — Engineering Program

Clipper.ai is an **AI-native content operations company**: long-form content in,
scored, captioned, publish-ready short-form out. Customers buy a managed service
and outcomes — the ops dashboard is the product; the software serves delivery.
(See each plan for the full positioning contract.)

## Onboarding (read in this order)

1. `CLAUDE.md` — always-loaded context: load-bearing parts, conventions, verify commands.
2. `ARCHITECTURE.md` — how the system is put together.
3. `DEV_STACK.md` — run the whole stack locally with one command.
4. `adr/` — the decision records: why it's shaped this way.
5. `RUNBOOKS.md` — the operator's index of everyday procedures.
6. `INCIDENT_RESPONSE.md` — what to do when something is on fire.

## The plans

| Plan       | File                  | Run with                  | Covers                                                                                                                                                               |
| ---------- | --------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP        | `MVP_BACKEND_PLAN.md` | `/milestone M#`           | Make it work: real ASR, transcript+LLM scoring, hooks+captions, ingest, queue reliability, real publish, hardening, tests                                            |
| Excellence | `EXCELLENCE_PLAN.md`  | `/harden S#` `/harden U#` | Make it safe & clean: SSRF, cookie/CSRF, validation/limits, IDOR, headers/CSP, logging; UI de-vibe (color tokens, modularization, states) with the design preserved  |
| Capstone   | `CAPSTONE_PLAN.md`    | `/elevate <id>`           | Make it excellent: AI quality eval (Q), reliability (R), unit economics (E), compliance/identity (C), dev-experience (D), performance/E2E (P), service-ops depth (O) |

`CLAUDE.md` (repo root) is the always-loaded context: the "load-bearing — don't
rewrite" list, conventions, and the verify-after-every-change commands.

**Current status (honest):** MVP M1–M8 ✅, Excellence S0–S6 + U1–U5 ✅, Capstone
Q/R/E/C/D/P/O largely ✅ (D4 in progress).

## How to execute

1. Open Claude Code in the repo with permissions on: `claude`
2. Run **one item at a time** with its command (e.g. `/milestone M1`,
   `/harden S0`, `/elevate Q1`). Each enters plan mode, shows the plan, waits for
   approval, implements only that item, runs the smokes, and stops.
3. Review the diff (`git diff HEAD`), then let it commit. Push the branch, open a
   PR per item. `/clear` between items.

## Order (master roadmap)

The recommended cross-plan sequence is in `CAPSTONE_PLAN.md` → "Master roadmap."
The short version:

1. **Phase 1 — make it real:** MVP M1→M3, then D1 (docker stack), then S0 (CI).
2. **Phase 2 — make it trustworthy:** S1→S6 + MVP M4–M5 before anything ships.
3. **Phase 3 — make it provably good:** Q1→Q5, R1→R3, MVP M6.
4. **Phase 4 — make it a business:** E1→E4, O1→O5.
5. **Phase 5 — make it excellent to use & maintain:** U1→U5, P1→P5, R4–R5,
   C1→C5, D2→D5.

Two rules hold throughout: **S0 lands before anything ships**, and **U1 (color
tokens) lands before any other UI/perf item**.

## Architecture & operations docs

| Doc                       | Covers                                       |
| ------------------------- | -------------------------------------------- |
| `ARCHITECTURE.md`         | System design                                |
| `adr/`                    | Decision records                             |
| `BUILD_STAGES.md`         | Original B/F roadmap — see its status banner |
| `DEV_STACK.md`            | One-command local stack                      |
| `RUNBOOKS.md`             | Operator procedures                          |
| `DEPLOY.md`               | Staging, canary deploy & rollback (D5)       |
| `INCIDENT_RESPONSE.md`    | Incident playbooks                           |
| `COMMITS_AND_RELEASES.md` | Commit hooks + releases                      |

## Security & compliance docs

| Doc                            | Covers                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `THREAT_MODEL.md`              | STRIDE per component, each threat linked to its S/C/R mitigation + residual risks (C5) |
| `SOC2_READINESS.md`            | Trust Services Criteria mapped to real controls, with coverage + honest gaps (C5)      |
| `SUBPROCESSORS.md`             | Sub-processor register + DPA summary; offline-by-default disclosure (C5)               |
| `SECRETS.md`                   | Secret-manager seam + rotatable envelope encryption (C3)                               |
| `IDENTITY.md`                  | SSO, MFA, account security (C2)                                                        |
| `DATA_LIFECYCLE.md`            | At-rest encryption, retention, GDPR erasure (C1)                                       |
| `DR.md` · `RUNBOOK_BACKUPS.md` | Backups, tested restore/PITR, chaos (R5)                                               |
| `SLO.md`                       | SLIs/SLOs, error budgets (R4)                                                          |
| `SUPPLY_CHAIN.md`              | SBOM, signed provenance, pinned deps, Dependabot (C4)                                  |

## Non-negotiables (enforced by the commands)

- Offline-first: `builtin`/`local`/dry-run drivers always work with no keys.
- Never fabricate a capability or fake an interaction — wire it or label it.
- UI preservation: SVGs, the black/`#53fc18`/stone color scheme, and layouts
  stay pixel-identical through every refactor (one documented exception: WCAG
  contrast fixes in U5, only with explicit sign-off).
