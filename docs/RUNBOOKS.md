# Runbooks

The operator's index. The deep procedures live in the linked runbooks below; this
page does not duplicate them — it points to them and lists the everyday commands.

## Deep runbooks

| Runbook                                    | Covers                                                  |
| ------------------------------------------ | ------------------------------------------------------- |
| [`DR.md`](DR.md)                           | Disaster recovery — RPO/RTO, restore/PITR, chaos drills |
| [`RUNBOOK_BACKUPS.md`](RUNBOOK_BACKUPS.md) | `pg_dump` policy, retention, restore drill              |
| [`RUNBOOK_YOUTUBE.md`](RUNBOOK_YOUTUBE.md) | Live publish setup (YouTube)                            |
| [`SLO.md`](SLO.md)                         | SLIs/SLOs, error budgets                                |
| [`SECRETS.md`](SECRETS.md)                 | Secret manager + key rotation                           |
| [`DATA_LIFECYCLE.md`](DATA_LIFECYCLE.md)   | At-rest encryption, retention, GDPR erasure             |

## Common operations

| Goal                      | Command / endpoint                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bring up the stack        | `docker compose up --build` (frontend :5173, backend :8080)                                                                                                   |
| Seed demo data            | `docker compose --profile seed run --rm seed` or `make demo`                                                                                                  |
| Tear down                 | `make down`                                                                                                                                                   |
| Apply migrations          | `npm run migrate` (also runs on boot)                                                                                                                         |
| Run workers separately    | `WORKERS_ENABLED=false` on the API + `npm run worker`                                                                                                         |
| Retry a stuck recording   | `POST /api/jobs/:id/retry` (re-arms every failed stage; 409 if none)                                                                                          |
| Retry a parked publish    | `POST /api/publish/:id/retry`                                                                                                                                 |
| Health (db check)         | `GET /api/health`                                                                                                                                             |
| Liveness                  | `GET /healthz`                                                                                                                                                |
| Readiness                 | `GET /readyz` (503 while draining)                                                                                                                            |
| Rotate the encryption key | set `PUBLISH_TOKEN_KEY` (new) + `PUBLISH_TOKEN_KEY_PREVIOUS` (old), run `npm run rewrap`, then drop PREVIOUS — see [`SECRETS.md`](SECRETS.md)                 |
| GDPR erasure for a client | `DELETE /api/clients/:id/content` (ops-only) — see [`DATA_LIFECYCLE.md`](DATA_LIFECYCLE.md)                                                                   |
| List sessions             | `GET /api/auth/sessions`                                                                                                                                      |
| Revoke a session          | `DELETE /api/auth/sessions/:id`                                                                                                                               |
| Back up the database      | `backend/ops/backup/backup.sh` (pg_dump custom format → `$BACKUP_DIR`)                                                                                        |
| Restore the database      | `backend/ops/backup/restore.sh <dump>` (pg_restore into `$RESTORE_DB`) — see [`DR.md`](DR.md) / [`RUNBOOK_BACKUPS.md`](RUNBOOK_BACKUPS.md)                    |
| Verify a deploy           | the smoke suite (`npm run smoke`, `smoke:pipeline`, `smoke:review`, `smoke:publish`, `smoke:metrics`, `smoke:auth`, …) and `npm run eval` (clip-quality gate) |
| Deploy (canary)           | `make deploy-staging` or `ops/deploy/canary.sh --target staging` — health-gated, auto-rollback; see [`DEPLOY.md`](DEPLOY.md)                                  |
| Roll back a bad deploy    | automatic: a canary that fails `/readyz` is discarded and the previous version keeps serving — see [`DEPLOY.md`](DEPLOY.md)                                   |

Makefile targets: `up`, `demo`, `verify`/`smoke`, `seed`, `down`, `logs`.

Dead-letter rows carry `dead_letter=true` and surface on the ops board.
