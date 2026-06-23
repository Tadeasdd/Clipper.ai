#!/usr/bin/env bash
# Clipper.ai — canary deploy with health-gated auto-rollback (Capstone D5).
#
# Blue/green on one host via docker compose:
#   1. ensure the db + the current "stable" backend are up and healthy (blue);
#   2. build + start the new version as the canary on its own port (green);
#   3. HEALTH GATE — poll the canary's /readyz until it is ready, within a budget;
#   4. PROMOTE  → rebuild+restart the stable backend onto the validated new build,
#                 wait until it is healthy, then retire the canary;  exit 0
#      ROLLBACK → the canary never became healthy: tear ONLY the canary down and
#                 leave the stable backend serving, untouched;        exit 1
#
# Everything here is real (real containers, real /readyz checks). It runs offline
# with zero external keys against the staging overlay; a real host/registry is
# additive via env. `--dry-run` prints the plan and touches nothing.
#
# Env knobs:
#   TARGET=staging|prod         (default staging; prod requires confirmation/secrets)
#   CANARY_PORT=8090            host port for the green slot
#   STABLE_PORT=8080            host port the stable backend serves on
#   HEALTH_TIMEOUT=120          seconds to wait for the canary to become ready
#   CANARY_DATABASE_URL=...     point the canary at a bad DSN to exercise rollback
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT/docker-compose.yml -f $ROOT/docker-compose.staging.yml"
CANARY="$COMPOSE --profile canary"

TARGET="${TARGET:-staging}"
CANARY_PORT="${CANARY_PORT:-8090}"
STABLE_PORT="${STABLE_PORT:-8080}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --target) TARGET="$2"; shift ;;
    --target=*) TARGET="${1#*=}" ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

log() { printf '\n\033[1m[deploy:%s]\033[0m %s\n' "$TARGET" "$*"; }

# Poll an HTTP endpoint until it returns 2xx, or give up after $2 seconds.
wait_ready() {
  local url="$1" budget="$2" waited=0
  while [ "$waited" -lt "$budget" ]; do
    if curl -fsS -o /dev/null --max-time 4 "$url" 2>/dev/null; then return 0; fi
    sleep 3; waited=$((waited + 3))
    printf '  …waiting for %s (%ss/%ss)\n' "$url" "$waited" "$budget"
  done
  return 1
}

retire_canary() { $CANARY stop backend-canary >/dev/null 2>&1 || true; $CANARY rm -f backend-canary >/dev/null 2>&1 || true; }

if [ "$DRY_RUN" = "1" ]; then
  log "DRY RUN — plan only, nothing will be built or started"
  cat <<EOF
  target            : $TARGET
  compose files     : docker-compose.yml + docker-compose.staging.yml
  stable (blue)     : service 'backend'        on :$STABLE_PORT  (/readyz, /api/health)
  canary (green)    : service 'backend-canary' on :$CANARY_PORT  (/readyz)
  health budget     : ${HEALTH_TIMEOUT}s
  flow              : up db+stable → build+start canary → gate canary /readyz
                      → PASS: rebuild+restart stable onto the new build, retire canary (exit 0)
                      → FAIL: retire canary, leave stable serving               (exit 1)
EOF
  exit 0
fi

if [ "$TARGET" = "prod" ] && [ -z "${CONFIRM_PROD:-}" ]; then
  echo "refusing to deploy to prod without CONFIRM_PROD=1 (prod is a reviewed, deliberate action)" >&2
  exit 2
fi

trap 'retire_canary' EXIT

log "1/4 bring up db + stable backend (blue)"
$COMPOSE up -d db
$COMPOSE up -d --build backend
if ! wait_ready "http://localhost:${STABLE_PORT}/readyz" 120; then
  echo "stable backend never became ready — aborting before we risk a deploy" >&2
  exit 1
fi
log "stable is healthy on :${STABLE_PORT}"

log "2/4 build + start the canary (green) on :${CANARY_PORT}"
$CANARY up -d --build backend-canary

log "3/4 health gate — waiting up to ${HEALTH_TIMEOUT}s for the canary /readyz"
if wait_ready "http://localhost:${CANARY_PORT}/readyz" "$HEALTH_TIMEOUT"; then
  log "4/4 canary is healthy → PROMOTE: rebuild + restart stable onto the new build"
  $COMPOSE up -d --build backend
  if ! wait_ready "http://localhost:${STABLE_PORT}/readyz" 120; then
    echo "promotion failed: stable did not come back healthy" >&2
    exit 1
  fi
  retire_canary
  trap - EXIT
  log "✅ DEPLOY OK — stable serving the new build on :${STABLE_PORT}, canary retired"
  exit 0
else
  log "4/4 canary FAILED the health gate → AUTO-ROLLBACK"
  retire_canary
  trap - EXIT
  if curl -fsS -o /dev/null --max-time 4 "http://localhost:${STABLE_PORT}/api/health" 2>/dev/null; then
    log "↩️  ROLLED BACK — canary discarded; previous version still serving on :${STABLE_PORT}"
  else
    echo "WARNING: rollback done but stable is not answering — investigate immediately" >&2
  fi
  exit 1
fi
