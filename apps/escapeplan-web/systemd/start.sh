#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-4173}
export ORIGIN=${ORIGIN:-http://localhost:${PORT}}

exec node "${APP_DIR}/build/index.js"
