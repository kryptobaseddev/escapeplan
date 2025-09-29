#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

"${ROOT_DIR}/scripts/lint.sh"

REQUIRED_PATHS=(
  "${ROOT_DIR}/config/config"
  "${ROOT_DIR}/stages/stage2/05-escapeplan-base/00-packages"
  "${ROOT_DIR}/stages/stage2/05-escapeplan-base/01-run.sh"
  "${ROOT_DIR}/stages/stage2/05-escapeplan-base/02-run.sh"
  "${ROOT_DIR}/stages/stage2/05-escapeplan-base/files/usr/local/sbin/escapeplan-config-apply"
  "${ROOT_DIR}/scripts/package-deb.sh"
  "${ROOT_DIR}/scripts/test-image.sh"
)

for path in "${REQUIRED_PATHS[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
done

echo "Static file checks passed."

LATEST_IMAGE=$(ls -t "${ROOT_DIR}/artifacts"/*.img* 2>/dev/null | head -n1 || true)
if [[ -n "$LATEST_IMAGE" ]]; then
  if command -v guestfish >/dev/null 2>&1; then
    echo "Running offline image validation on $LATEST_IMAGE"
    "${ROOT_DIR}/scripts/test-image.sh" "$LATEST_IMAGE"
  else
    echo "guestfish not installed; skipping offline image validation." >&2
  fi
else
  echo "No image artifacts to validate. Build the image to run offline checks."
fi

if [[ -n "${ESCAPEPLAN_PI_HOST:-}" ]]; then
  echo "Running remote hardware validation against $ESCAPEPLAN_PI_HOST"
  "${ROOT_DIR}/scripts/test-hardware.sh"
else
  echo "ESCAPEPLAN_PI_HOST not set; skipping hardware validation."
fi

echo "Platform smoke tests passed."
