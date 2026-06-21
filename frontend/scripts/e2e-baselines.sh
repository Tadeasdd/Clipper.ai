#!/usr/bin/env bash
# P3 — regenerate the visual-regression DESIGN LOCK baselines.
#
# A screenshot lock is only sound if the baselines are byte-identical to what CI
# renders. CI runs the suite inside mcr.microsoft.com/playwright:v1.61.0-jammy,
# so the baselines MUST be generated in that same image — never on the host
# (macOS would write *-darwin.png with different glyph AA, useless for a Linux
# CI compare). This script does exactly that: a freshly built frontend, the
# `visual` specs run under --update-snapshots, writing *-linux.png into
# e2e/visual.spec.js-snapshots/.
#
# The marketing pages the lock covers make no backend call on load, so no
# Postgres/backend is needed here — only the built static bundle + preview server
# (the journey specs, which DO need the backend, run in CI, not here).
#
# Usage:  npm run e2e:baselines        (from frontend/)
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.61.0-jammy"
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "P3 baselines → $IMAGE (visual project only)"

# Mount only the frontend dir; install + build + screenshot all inside the image
# so the rendering toolchain matches CI byte-for-byte. --ipc=host avoids Chromium
# crashing on the default small /dev/shm.
docker run --rm --ipc=host \
  -v "$FRONTEND_DIR":/work \
  -w /work \
  "$IMAGE" \
  bash -lc '
    set -euo pipefail
    npm ci
    npm run build
    npx playwright test visual.spec.js --update-snapshots
  '

echo "Baselines written to e2e/visual.spec.js-snapshots/ — review the diff, then commit."
