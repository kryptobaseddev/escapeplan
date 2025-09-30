#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-4000}
export ESCAPEPLAN_DB_PATH=${ESCAPEPLAN_DB_PATH:-/var/lib/escapeplan/escapeplan.db}

exec node "${APP_DIR}/dist/index.js"
