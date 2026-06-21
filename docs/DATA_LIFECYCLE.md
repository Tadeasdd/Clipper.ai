# Data lifecycle — encryption, retention, erasure (C1)

How client media is protected at rest, how long it lives, and how it's removed.

## Encryption at rest

Every stored media object — the raw upload, every rendered clip, and every
published outbox derivative — is encrypted at rest with **AES-256-GCM**.

- **Local driver** (`STORAGE_DRIVER=local`, the offline default): encryption is
  applied as a stream Transform in `storage/local.js` using `lib/content-crypto.js`.
  Each object is self-describing: `MAGIC("CLP1") | VERSION | IV(12) | ciphertext | GCM-tag(16)`.
  Reads (`localPathFor`) detect the magic header and decrypt to a tmp file
  transparently, so ffmpeg / `res.sendFile` / workers see plaintext. Objects with
  no magic header (legacy/plaintext) still read, so the change is backward-compatible.
- **S3 driver** (`STORAGE_DRIVER=s3`): objects are written with **SSE-S3 (AES256)**
  server-side encryption; pair with bucket-default encryption as defence in depth.

### Keys
- `CONTENT_ENCRYPTION_KEY` — the at-rest media key (scrypt-derived). A dev default
  exists so local runs are zero-config, but it is **NOT a secret**: any deployment
  holding real client media **MUST** set `CONTENT_ENCRYPTION_KEY`, or stored
  objects are decryptable by anyone with the source. Same contract as
  `PUBLISH_TOKEN_KEY` / `lib/crypto.js`.

## Retention

A recording is purged once it is older than its **effective retention window**:

```
effective_days = COALESCE(clients.retention_days, CONTENT_RETENTION_DAYS)
```

- `clients.retention_days` — per-client override (migration `025_retention.sql`; null = use global).
- `CONTENT_RETENTION_DAYS` — global default (env). Unset/0 → **keep forever** (the sweep is a no-op).
- `CONTENT_RETENTION_SWEEP_MS` — interval for the in-process sweep (`lib/retention.js#startRetentionSweep`).
  Unset/0 → **off** (CI and offline dev never purge unexpectedly). Set it in prod
  to run `purgeExpired()` periodically.

A purge deletes the recording's DB rows (FK-ordered, one transaction) **and** all
its storage objects, then writes an `admin / content_purged` audit row.

## GDPR erasure (right to be forgotten)

```
DELETE /api/clients/:id/content      (requireAuth: ops)
```

Removes **all** of a client's content + derivatives — raw media, rendered clips,
published outbox objects, and the DB rows that descend from them — in one
transaction, and returns a verifiable manifest (`{ recordings, objects, keys }`).

- The client **account row survives** — erasure is of content, not identity.
- The **audit trail survives**: the erasure writes an `admin / client_content_erased`
  row (actor, client, manifest) so the deletion itself is provable.
- The DB commit is the source of truth; storage objects are deleted after it, so a
  missed object is a harmless orphan rather than a dangling reference.

## Verify

`npm run smoke:lifecycle` (Postgres only, offline) asserts: objects are encrypted
at rest yet round-trip exactly; erasure removes a client's content + derivatives +
storage objects and is audited (account row kept); a past-retention recording is
auto-purged and audited while an in-window one is kept.
