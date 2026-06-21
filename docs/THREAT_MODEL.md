# Threat model (C5)

A STRIDE threat model for Clipper.ai, component by component, with every threat
linked to the control that mitigates it and the item that built it. Tags map to
the three plans: **S#** = Excellence security track, **C#/R#** = Capstone
compliance/reliability tracks, **B#/M#** = MVP machinery. Where a threat is only
partially mitigated it is called out as **residual risk** at the end.

Methodology: STRIDE (Spoofing, Tampering, Repudiation, Information disclosure,
Denial of service, Elevation of privilege) per component across the trust
boundaries in `ARCHITECTURE.md`. Reviewed on every C5 update.

## Trust boundaries

```
[browser: marketing · /ops · /portal]  ── HTTPS ──▶  [Express API]  ── SQL ──▶ [Postgres]
                                                          │  enqueue
                                                          ▼
                                                  [pipeline workers] ── streams ──▶ [object storage]
                                                          │
                                   ┌──────────────────────┼───────────────────────┐
                                   ▼                       ▼                        ▼
                           [AI providers]          [publish adapters]        [secrets manager]
                           (ASR/LLM/vision)        + metrics pollers          (env/file/KMS)

           [CI/CD + supply chain]  ──build/sign──▶  the deployed artifacts
```

Boundaries crossed: browser→API (untrusted client), API→DB, workers→external
providers (egress), API/workers→object storage, anyone→ingest URL (SSRF surface),
CI→artifact (supply chain). Identity is always taken from the server-side session,
never the request body (B7).

---

## 1. Browser clients → API

| STRIDE | Threat | Mitigation (item · where) |
|---|---|---|
| **S**poofing | Forged identity / session theft | Server-side sessions; only `sha256(token)` stored, never the raw token (B7 `lib/auth.js`). httpOnly + SameSite cookies, not localStorage (S2). SSO (OIDC) + TOTP MFA, lockout on repeated failure (C2 `lib/sso.js`/`totp.js`/`lockout.js`). |
| **T**ampering | CSRF on state-changing calls; mutated payloads | Header-only CSRF guard on cookie-auth mutations (S2 `csrfGuard`). Schema-based request validation rejects malformed bodies (S3 `lib/validate.js`). |
| **R**epudiation | "I didn't do that" | Append-only security audit trail (S6/O5 `lib/audit.js`), correlation id per request (S6), login success/failure events recorded. |
| **I**nfo disclosure | Reading another tenant's data/assets | Tenant fencing on every read and asset path; id-addressed resources scoped to the caller's client → 404 cross-tenant (S4, `smoke:authz`). Credentials never returned by the API (B5). |
| **D**oS | Login / form floods | Per-(email+IP) login rate limit (B7) and per-route rate limiting (S3 `lib/ratelimit.js`); body-size limits (S5). |
| **E**levation | Client acting as ops | `requireAuth(...roles)` role walls on every privileged route; client role sees an own-data slice only (S4 + ARCHITECTURE "single API, role-gated"). |

## 2. Express API

| STRIDE | Threat | Mitigation |
|---|---|---|
| **S** | Unauthenticated access to privileged routes | One auth door; `requireAuth` walls; identity from session not body (B7). |
| **T** | Injection (SQL/headers) | Parameterized queries throughout (`db/index.js` `q(text, params)`); validation at the boundary (S3). |
| **R** | Action without a trace | Correlation-id stamping + structured logs (S6 `lib/log.js`); audit log (O5). |
| **I** | Secrets/PII leaking into responses or logs | Log redaction of secret-looking fields + Bearer tokens (S6 `redact()`); generic error bodies, detail server-side only (S6); CORS locked to `CORS_ORIGINS` with credentials (S5 `corsOptions`). |
| **D** | Resource exhaustion | Rate limiting (S3); JSON body cap (2 MB, S5); workers off the request path so heavy work can't stall the API (ARCHITECTURE). |
| **E** | Status-machine bypass (publish without sign-off) | Clip lifecycle is a Postgres CHECK constraint; review transitions are atomic CTEs (load-bearing) — "nothing publishes without sign-off" is DB-enforced. |

Security headers (nosniff, frame DENY, referrer, HSTS in prod), `x-powered-by`
removed (S5 `server.js`).

## 3. Postgres

| STRIDE | Threat | Mitigation |
|---|---|---|
| **S/E** | Insecure local fallback DSN in prod | Boot refuses an unset `DATABASE_URL` in production (M7 `assertProdConfig`). |
| **T** | Schema drift / unsafe migration | Forward-only transactional migrations; never edit an applied migration (load-bearing `db/index.js`). |
| **I** | At-rest exposure of credentials/MFA secrets | AES-256-GCM encryption of stored credentials + MFA secrets (B5/C2 `lib/crypto.js`), key-stamped + rotatable (C3). |
| **D** | Connection exhaustion | Pooled connections, tuned (P5); health/readiness reflect DB connectivity (R2). |
| **R** | Data loss without recovery | Automated backups + tested restore/PITR (R5 `ops/backup`, `docs/DR.md`). |

## 4. Pipeline workers

| STRIDE | Threat | Mitigation |
|---|---|---|
| **T** | Poisoned job / duplicate processing | Idempotent enqueue; `FOR UPDATE SKIP LOCKED` claims; 3-attempt backoff; parked `failed` rows (load-bearing queue). |
| **R** | Silent capability fabrication | Stages complete honestly with a visible marker (e.g. `signalsSource: "audio_only"`) — never a fabricated result (CLAUDE.md convention). |
| **I** | Media leaking between clients | Content encrypted at rest; per-client object scoping; retention purge + GDPR erasure (C1). |
| **D** | A hung dependency stalls all workers | Timeouts + circuit breakers + bulkheads per dependency (R3 `lib/resilience.js`); reaper recovers jobs from a crashed worker (M5). |

## 5. Object storage

| STRIDE | Threat | Mitigation |
|---|---|---|
| **I** | Stored media readable by storage operator | Streaming AES-256-GCM at rest, self-describing header (C1 `lib/content-crypto.js`); key from the manager, rotatable (C3). |
| **T** | Tampered object goes undetected | GCM auth tag fails closed on tamper/wrong key (C1). |
| **R** | Orphaned media after client leaves | Retention windows + verifiable per-client erasure across DB + storage (C1, `docs/DATA_LIFECYCLE.md`). |

## 6. External AI providers (ASR / LLM / vision)

| STRIDE | Threat | Mitigation |
|---|---|---|
| **I** | Sending client content to a third party unknowingly | Offline `builtin`/`local` defaults send nothing off-box (CLAUDE.md); configured providers are disclosed sub-processors (`SUBPROCESSORS.md`). |
| **S** | Untrusted provider response treated as truth | Provider output is validated/clamped before use; provenance (prompt/model/version) stamped for reproducibility (Q2). |
| **D** | Provider latency/outage cascades | Per-call timeout + breaker + bounded retry with jitter (R3). |

## 7. Publish adapters + metrics pollers

| STRIDE | Threat | Mitigation |
|---|---|---|
| **S** | Forged OAuth callback | Stateless HMAC-signed OAuth `state`, expiry-checked; signing key from the manager (C3 `routes/publish.js`). |
| **I** | Platform tokens at rest | Encrypted (AES-256-GCM), never returned by the API (B5); key rotatable (C3). |
| **T** | Publishing an unapproved clip | Only the status machine can schedule a clip (approved/scheduled) — sign-off structurally unskippable (load-bearing). |

## 8. Secrets manager

| STRIDE | Threat | Mitigation |
|---|---|---|
| **I** | Plaintext secrets in env in prod | Secrets resolved through a manager seam (C3 `lib/secrets.js`); cloud KMS/Vault additive behind the same `getSecret()`. |
| **S/E** | Weak/dev key in production | Boot fails fast on a missing/dev-default/short `PUBLISH_TOKEN_KEY`/`CONTENT_ENCRYPTION_KEY` (C3 `assertProdConfig`). |
| **T** | Key compromise with no rotation path | Rotatable envelope encryption: active + retired keyring, key-stamped ciphertext, downtime-free rotation + re-wrap (C3 `lib/keyring.js`, `npm run rewrap`). |

## 9. CI/CD + supply chain

| STRIDE | Threat | Mitigation |
|---|---|---|
| **T** | Compromised dependency / unreviewed bump | Locked installs (`npm ci`), pinned versions (`.npmrc`), dependency-review blocks high-severity adds, Dependabot PRs run the full gate (C4). |
| **I** | Committed secret | gitleaks secret scanning fails the build (S0). |
| **R/T** | Tampered build artifact | CycloneDX SBOM emitted; SLSA build-provenance + signed SBOM attestation (keyless Sigstore) on push (C4). |
| **E** | Vulnerable code path merged | CodeQL static analysis + `npm audit` of shipped deps on every run (S0/C4). |

---

## Residual risks (honest gaps)

- **No formal access-review / least-privilege audit** of human operator accounts
  beyond role walls — tracked for SOC 2 (`SOC2_READINESS.md`).
- **No external penetration test** yet; controls are self-asserted + smoke/CI-tested.
- **No staging/canary with auto-rollback** (D5 pending) — deploy risk is manual.
- **Single encryption key per domain** rather than per-tenant DEKs; envelope
  rotation mitigates key-lifetime risk but not blast radius of one key.
- **Provider data-handling** depends on the configured third party's own posture;
  offline defaults avoid the exposure entirely.
- **DoS at the edge** (network/L7 volumetric) is out of app scope — relies on the
  hosting/CDN layer.
