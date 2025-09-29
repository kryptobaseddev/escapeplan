#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ARTIFACTS_DIR="${ROOT_DIR}/artifacts"

if [[ ! -d "$ARTIFACTS_DIR" ]]; then
  echo "No artifacts directory present. Run scripts/build-image.sh first." >&2
  exit 1
fi

LATEST_MANIFEST=$(ls -t "$ARTIFACTS_DIR"/*.manifest.json 2>/dev/null | head -n1 || true)
if [[ -z "$LATEST_MANIFEST" ]]; then
  echo "No manifest present. Build image to generate health data." >&2
  exit 1
fi

echo "Latest build info:"
cat "$LATEST_MANIFEST"
