#!/usr/bin/env bash
set -euo pipefail

echo "[escapeplan-api] Starting pre-flight checks..."

# 1. Check Node.js available
if ! command -v node &> /dev/null; then
  echo "[escapeplan-api] ERROR: Node.js not found in PATH"
  exit 1
fi

# 2. Check secrets directory (will be auto-created by app if missing)
SECRETS_DIR="${SECRETS_DIR:-/etc/escapeplan/secrets}"
if [ ! -d "$(dirname "$SECRETS_DIR")" ]; then
  echo "[escapeplan-api] WARNING: Parent directory for secrets not found"
  echo "[escapeplan-api] Secrets will be stored in-memory only"
fi

# 3. Check data directory
DATA_DIR="${ESCAPEPLAN_DATA_DIR:-/var/lib/escapeplan}"
if [ ! -d "$DATA_DIR" ]; then
  echo "[escapeplan-api] Creating data directory: $DATA_DIR"
  mkdir -p "$DATA_DIR"
fi

# 4. Check log directory
LOG_DIR="${LOG_DIR:-/var/log/escapeplan}"
if [ ! -d "$LOG_DIR" ]; then
  echo "[escapeplan-api] Creating log directory: $LOG_DIR"
  mkdir -p "$LOG_DIR"
fi

# 5. Check database permissions (if exists)
DB_PATH="${DATA_DIR}/escapeplan.db"
if [ -f "$DB_PATH" ]; then
  if [ ! -w "$DB_PATH" ]; then
    echo "[escapeplan-api] ERROR: Database file not writable: $DB_PATH"
    exit 1
  fi
  echo "[escapeplan-api] ✅ Database file writable"
else
  echo "[escapeplan-api] Database file not found (will be created)"
fi

# 6. Check port availability (optional, non-blocking)
PORT="${PORT:-4000}"
if command -v nc &> /dev/null && nc -z localhost "$PORT" 2>/dev/null; then
  echo "[escapeplan-api] WARNING: Port $PORT already in use"
  echo "[escapeplan-api] Service may fail to start"
fi

echo "[escapeplan-api] ✅ Pre-flight checks complete"

# Start server
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
