# Disaster Recovery — Clipper.ai

How the service survives losing its data or a component mid-flight: backup +
restore tooling, recovery objectives, and the failure-injection drills that
prove recovery actually works. The backup **policy** (schedule, retention,
encryption, object-storage lifecycle, secrets) lives in
[RUNBOOK_BACKUPS.md](./RUNBOOK_BACKUPS.md); this document adds the **tooling,
objectives, and tested drills**.

## Recovery objectives

| | Target | Basis |
|---|---|---|
| **RPO** (max data loss) | **≤ 5 min** with WAL PITR; ≤ 24h on the logical-dump backstop alone | continuous WAL archiving on managed Postgres; nightly `pg_dump` otherwise |
| **RTO** (max downtime) | **≤ 30 min** for a full DB restore + API boot | `restore.sh` into a fresh instance; the API runs `migrate()` on start |
| **Pipeline RTO** (mid-flight job) | **≤ 1 min** | the M5 visibility-timeout reaper reclaims orphaned jobs automatically |

Assets (rendered clips) are reproducible by re-running `generate`, so the
precious bytes are the **source uploads** + the **database** — prioritize those.

## Backups

- **One-command logical backup:** `backend/ops/backup/backup.sh` — custom-format
  `pg_dump` to `BACKUP_DIR`, pruned to `BACKUP_KEEP`, optional gpg encryption.
  Cron it (see the runbook for the schedule/retention policy).
- **PITR:** on managed Postgres (RDS / Cloud SQL / Neon) keep **WAL archiving /
  point-in-time recovery** on — that's the ≤5-min RPO. The logical dump is the
  portable, provider-independent backstop.
- **Object storage:** versioning + lifecycle + cross-region replication per the
  runbook.

## Restore

- **Tooling:** `backend/ops/backup/restore.sh <dump>` drops, recreates, and
  `pg_restore`s into a scratch (drill) or real (recovery) database. PITR restore
  is a provider console / `recovery_target_time` operation — see the runbook.
- **Tested, two ways:**
  - **Portable drill — `npm run smoke:restore`** (CI + container + laptop): snapshot
    the DB at point T, mutate it (insert + delete), restore, and assert the DB is
    reproduced **exactly to T**. Uses the binary-free logical engine
    (`ops/backup/snapshot.mjs`) so it runs without postgres client tools.
  - **Real `pg_dump`/`pg_restore` round-trip** in CI (with `postgresql-client`
    installed): `backup.sh` → `restore.sh` → row-count check, exercising the
    actual production tooling.

> An untested backup is not a backup — both drills run in CI on every push.

## Chaos / failure injection

A component dies mid-pipeline; the system must recover without losing work.

| Failure | Recovery mechanism | Coverage |
|---|---|---|
| **Worker killed mid-job** | M5 reaper reclaims the orphaned `running` job → another worker finishes it | **Automated — `npm run smoke:chaos`** (recovers within `CHAOS_RTO_S`) |
| **DB connection lost** | R2 `/readyz` flips 503 (LB routes away); the `pg` pool reconnects; in-flight jobs retry | mechanism-backed (R2 readiness smoke) |
| **External dependency hangs** | R3 timeout + circuit breaker fails fast; the queue retries / dead-letters | mechanism-backed (R3 resilience smoke) |
| **Storage blip** | the stage throws → queue retries with backoff → parks as dead-letter, retryable from the ops board | mechanism-backed (M5 dead-letter) |

`smoke:chaos` injects a crashed worker (an orphaned `running` job left behind),
starts the workers with a short visibility timeout, and asserts the recording is
driven to `ready` within the pipeline RTO — the reaper self-heals with zero lost
work.

## Running the drills

```bash
cd backend
npm run smoke:restore   # snapshot → mutate → restore → reproduced-to-point-in-time
npm run smoke:chaos     # crash a worker mid-pipeline → reaper recovers within RTO
# real pg_dump tooling (needs postgresql-client):
DATABASE_URL=… BACKUP_DIR=/tmp/bk ops/backup/backup.sh
ADMIN_URL=…/postgres RESTORE_DB=clipper_restore ops/backup/restore.sh /tmp/bk/clipper-*.dump
```
