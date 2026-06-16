# Runbook — backups & restore (M7)

Two stores hold everything: **Postgres** (the operating system of record — clients,
recordings, jobs, clips, reviews, metrics, encrypted connections) and **object
storage** (raw uploads + rendered clip assets). Both need a backup policy before
real clients depend on the service.

## Postgres

**Nightly logical dump.** Cron a compressed `pg_dump` to an off-box, encrypted
location (a different cloud account/region than the primary):

```
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" \
  | gpg --encrypt --recipient ops@clipper.ai \
  > "clipper-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg"
```

- Retention: 7 daily, 4 weekly, 6 monthly (tune to the data-loss tolerance).
- Managed Postgres (RDS/Cloud SQL/Neon) also enables **PITR** — keep it on; the
  logical dump is the portable, provider-independent backstop.

**Restore drill (run quarterly — an untested backup is not a backup):**

```
createdb clipper_restore
gpg --decrypt clipper-YYYYMMDD….dump.gpg | pg_restore --no-owner -d clipper_restore
# smoke it: psql clipper_restore -c 'select count(*) from recordings;'
```

Migrations are forward-only and transactional, so a restored DB is brought
current simply by booting the API (it runs `migrate()` on start).

## Object storage

Uploads and rendered assets live under the storage driver:

- **Local driver** (`backend/storage/`): include it in the same off-box backup
  as the DB dump, or — better — move to S3 for anything beyond dev.
- **S3 driver**: enable **versioning** + a **lifecycle policy** (e.g. transition
  to infrequent-access at 30d, expire noncurrent versions at 90d) and, for DR,
  **cross-region replication**. Server-side encryption on by default.

Assets are reproducible from the source recording by re-running `generate`, so
the source uploads are the precious bytes — prioritize those in any tiered plan.

## Secrets

`PUBLISH_TOKEN_KEY` decrypts stored platform credentials — **back it up
separately** from the database (a secrets manager), or a restored DB is useless.
Rotating it requires re-encrypting `platform_connections`; until then, treat it
as permanent and guard it like the database itself.

## What's covered vs. not

- Covered: full DB recovery, asset recovery, a tested restore path.
- Not yet: automated backup-success alerting and a one-command restore script —
  track these as ops follow-ups once a provider is chosen.
