#!/usr/bin/env bash
set -euo pipefail

echo "[escapeplan-web] Starting pre-flight checks..."

# 1. Check Node.js available
if ! command -v node &> /dev/null; then
  echo "[escapeplan-web] ERROR: Node.js not found in PATH"
  exit 1
fi

# 2. Verify build directory exists
BUILD_DIR="/opt/escapeplan/web/build"
if [ ! -d "$BUILD_DIR" ]; then
  echo "[escapeplan-web] ERROR: Build directory not found: $BUILD_DIR"
  exit 1
fi

if [ ! -f "$BUILD_DIR/index.js" ]; then
  echo "[escapeplan-web] ERROR: Build entry point not found: $BUILD_DIR/index.js"
  exit 1
fi

# 3. Check API availability (non-blocking warning)
API_URL="${API_URL:-http://localhost:4000}"
if command -v curl &> /dev/null; then
  if ! curl -sf "$API_URL/health" > /dev/null 2>&1; then
    echo "[escapeplan-web] WARNING: API health check failed at $API_URL/health"
    echo "[escapeplan-web] Web app will retry connections, but functionality may be limited"
  else
    echo "[escapeplan-web] ✅ API health check passed"
  fi
fi

# 4. Check port availability
PORT="${PORT:-3000}"
if command -v nc &> /dev/null && nc -z localhost "$PORT" 2>/dev/null; then
  echo "[escapeplan-web] WARNING: Port $PORT already in use"
  echo "[escapeplan-web] Service may fail to start"
fi

echo "[escapeplan-web] ✅ Pre-flight checks complete"

# Get paths
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

# ----------------------------------------------------------------------------
# Environment Variable Defaults
# ----------------------------------------------------------------------------
# These can be overridden by systemd EnvironmentFile (/etc/escapeplan/web.env)

export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}

# CSRF Protection: Use forwarded headers from nginx
export PROTOCOL_HEADER=${PROTOCOL_HEADER:-x-forwarded-proto}
export HOST_HEADER=${HOST_HEADER:-x-forwarded-host}

# Alternative: Explicit origin (uncomment if not using forwarded headers)
# export ORIGIN=${ORIGIN:-https://escapeplan.local}

# Public API base URL for client-side requests
export PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL:-/api}

# Internal API URL for server-side requests
export API_URL=${API_URL:-http://localhost:4000}

# ----------------------------------------------------------------------------
# Start SvelteKit Server
# ----------------------------------------------------------------------------

cd "${APP_DIR}"

# adapter-node builds to build/index.js (not server.js)
exec node build/index.js
