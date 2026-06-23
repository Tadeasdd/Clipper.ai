# Deploy — staging, canary & rollback

Clipper.ai deploys with a **canary**: the new version is started alongside the
running one, must pass a health gate, and is promoted only if it does — otherwise
the deploy **auto-rolls-back** and the previous version keeps serving. Staging
mirrors production's posture so a bad change is caught before it reaches users.

Everything here runs offline against the local Docker stack with zero external
keys; a real host is additive via env/secrets.

## Environments

| Environment    | Config                         | Posture                                                                                |
| -------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| **dev**        | `docker-compose.yml`           | `NODE_ENV=development`, offline drivers, dev keys                                      |
| **staging**    | `+ docker-compose.staging.yml` | `NODE_ENV=production`, strong (local-placeholder) keys, CORS locked — **mirrors prod** |
| **production** | same overlay, real secrets     | `NODE_ENV=production`, secrets from the host's store                                   |

`NODE_ENV=production` activates the boot guard (`backend/src/lib/config.js`
`assertProdConfig`): it refuses to start unless `PUBLISH_TOKEN_KEY` +
`CONTENT_ENCRYPTION_KEY` are strong (≥16 chars, not the dev default) and
`DATABASE_URL` is set. The staging overlay supplies clearly-labelled local
placeholders so it boots offline; real staging/prod override them from a secret
store.

## The canary deploy

`ops/deploy/canary.sh` orchestrates one host with `docker compose`:

```
db + stable backend (blue, :8080)  ──►  build + start canary (green, :8090)
                                          │
                                   health gate: poll canary /readyz
                                   ┌──────┴───────┐
                                 PASS            FAIL (timeout/503)
                                   │                │
                   rebuild+restart stable    retire ONLY the canary;
                   onto the new build,        stable is untouched and
                   retire canary (exit 0)     keeps serving (exit 1)
```

The gate is the real `GET /readyz` endpoint (200 only when the DB is reachable and
the process isn't draining). Nothing is faked — a canary that can't serve never
gets promoted.

### Run it

```bash
ops/deploy/canary.sh --dry-run            # print the plan, touch nothing
ops/deploy/canary.sh --target staging     # real canary deploy to the local staging stack
make deploy-staging                       # same, via the Makefile
make canary-dry                           # the dry-run
```

Knobs: `CANARY_PORT` (8090), `STABLE_PORT` (8080), `HEALTH_TIMEOUT` (120s),
`CANARY_DATABASE_URL` (point a test canary at a bad DSN to exercise rollback).

### Verifying rollback

A canary that can't reach its DB never becomes ready, so the gate fails and the
deploy rolls back while the stable version keeps serving:

```bash
CANARY_DATABASE_URL=postgres://nobody:nobody@db:5432/nope HEALTH_TIMEOUT=30 \
  ops/deploy/canary.sh --target staging   # → AUTO-ROLLBACK, exit 1
curl -fsS localhost:8080/api/health        # → still 200: the old version is intact
```

## CI/CD (`.github/workflows/deploy.yml`)

- **push to `main` → staging, automatically.** The `staging` job runs the canary
  deploy against an ephemeral stack on the runner. A failed health gate fails the
  job (red) with the stable version left running — changes only "land" in staging
  when the canary is healthy.
- **production → one reviewed action.** `workflow_dispatch` with
  `target=production` runs the `production` job, pinned to the `production` GitHub
  Environment. Configure that environment with **required reviewers** so the run
  pauses for one approval. It ships in `--dry-run` until a real host is wired.

## Wiring a real host

The script is host-agnostic. To target real infrastructure:

1. Build/push the image to your registry (or build on the host).
2. Provide the production secrets (`PUBLISH_TOKEN_KEY`, `CONTENT_ENCRYPTION_KEY`,
   `DATABASE_URL`, real `CORS_ORIGINS`) via the deploy environment's secret store.
3. In the `production` job, set `CONFIRM_PROD=1` and drop `--dry-run`.
4. Point `STABLE_PORT`/`CANARY_PORT` (or the compose service hosts) at the host's
   blue/green slots behind your load balancer.

Rollback and disaster recovery beyond a single bad deploy are in
[`DR.md`](DR.md); operator procedures are indexed in [`RUNBOOKS.md`](RUNBOOKS.md).
