#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

# Port can be overridden via environment
export PORT=${PORT:-4000}

# NOTE: Environment detection is automatic via runtime.ts
# No need to set NODE_ENV - it's detected from:
#   - Installation path (/opt/escapeplan)
#   - Systemd invocation (INVOCATION_ID env var)
#   - Built code presence (dist/ without src/)

exec node "${APP_DIR}/index.js"
