# Load tests (k6)

P5 load tests for the hot **read** paths — the public health probe and the
authenticated ops analytics/board reads backed by the indexes audited in
`scripts/smoke-perf.mjs`.

## Targets (the documented SLO these tests enforce)

| Metric | Target | Threshold in `read-paths.js` |
|--------|--------|------------------------------|
| Read latency p95 | < **300 ms** | `http_req_duration: p(95)<300` |
| Error rate | < **1%** | `http_req_failed: rate<0.01` |
| Concurrency | **20** virtual users, 20s | `constant-vus`, env-tunable |

A failing run means a real regression — a lost index, an N+1, or pool starvation
under concurrency — not a flaky test.

## Run it

Needs a booted backend + Postgres (no external keys):

```bash
# from backend/, with DATABASE_URL pointing at a Postgres
node src/server.js &                 # API on :8080 (auto-migrates)
k6 run loadtest/read-paths.js
```

## Tune via env

| Var | Default | Meaning |
|-----|---------|---------|
| `BASE_URL` | `http://localhost:8080` | backend origin |
| `VUS` | `20` | concurrent virtual users |
| `DURATION` | `20s` | test duration |
| `P95_MS` | `300` | p95 latency threshold (ms) |

Example — push harder:

```bash
VUS=50 DURATION=1m P95_MS=500 k6 run loadtest/read-paths.js
```

CI runs this in the dedicated `loadtest` job (installs k6, boots the backend
against the Postgres service). It's a separate job so the core offline gates
never depend on k6 being present.
