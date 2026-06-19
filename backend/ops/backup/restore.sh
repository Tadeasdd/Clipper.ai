#!/usr/bin/env bash
# R5 — restore a pg_dump into a target database (drop + recreate + restore), the
# companion to backup.sh. Use against a SCRATCH database for a restore drill, or
# the real target during recovery. Decrypts .gpg dumps transparently.
#
#   ADMIN_URL=postgres://user:pw@host:5432/postgres \
#   RESTORE_DB=clipper_restore ./restore.sh path/to/clipper-…dump
set -euo pipefail

DUMP="${1:?usage: restore.sh <dump-file>}"
: "${ADMIN_URL:?set ADMIN_URL (a maintenance DB connection, e.g. .../postgres)}"
RESTORE_DB="${RESTORE_DB:-clipper_restore}"

echo "[restore] recreate database $RESTORE_DB"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $RESTORE_DB WITH (FORCE);"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $RESTORE_DB;"

TARGET_URL="$(printf '%s' "$ADMIN_URL" | sed -E "s#/[^/?]+(\?|$)#/$RESTORE_DB\1#")"

echo "[restore] pg_restore $DUMP → $RESTORE_DB"
if [[ "$DUMP" == *.gpg ]]; then
  gpg --decrypt "$DUMP" | pg_restore --no-owner --no-privileges -d "$TARGET_URL"
else
  pg_restore --no-owner --no-privileges -d "$TARGET_URL" "$DUMP"
fi

echo "[restore] done → $RESTORE_DB"
