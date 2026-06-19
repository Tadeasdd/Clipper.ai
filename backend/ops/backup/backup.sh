#!/usr/bin/env bash
# R5 — one-command Postgres backup (the script docs/RUNBOOK_BACKUPS.md flagged as
# missing). Compressed custom-format pg_dump to BACKUP_DIR, oldest pruned to
# BACKUP_KEEP. Pair with WAL archiving on managed Postgres for PITR (see
# docs/DR.md). Optionally encrypt with gpg and ship off-box.
#
#   DATABASE_URL=... BACKUP_DIR=/var/backups/clipper ./backup.sh
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP="${BACKUP_KEEP:-7}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/clipper-$STAMP.dump"

echo "[backup] pg_dump → $OUT"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > "$OUT"

# Optional off-box encryption: set BACKUP_GPG_RECIPIENT to encrypt + remove plaintext.
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$OUT"
  rm -f "$OUT"; OUT="$OUT.gpg"
  echo "[backup] encrypted → $OUT"
fi

# Retention: keep the newest BACKUP_KEEP dumps, prune the rest.
ls -1t "$BACKUP_DIR"/clipper-*.dump* 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while read -r old; do
  echo "[backup] prune $old"; rm -f "$old"
done

echo "[backup] done ($OUT)"
echo "$OUT"
