#!/bin/bash
#
# backup.sh - Automated database backup wrapper script for EscapePlan
#
# This script is called by systemd timers or manually by operators.
# It invokes the Node.js backup script with the specified trigger type.
#
# Usage:
#   backup.sh [trigger]
#
# Arguments:
#   trigger - Backup trigger type (optional, defaults to 'scheduled-daily')
#             Valid values: scheduled-daily, manual, pre-update, pre-migration, on-demand
#
# Exit codes:
#   0 - Backup completed successfully
#   1 - Backup failed
#
# Examples:
#   backup.sh                    # Daily automated backup
#   backup.sh manual             # Manual backup
#   backup.sh pre-update         # Pre-update backup
#
# Environment:
#   This script auto-detects whether it's running in development or production.
#   Production: /opt/escapeplan or /var/lib/escapeplan
#   Development: project workspace
#

set -euo pipefail

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine trigger (default to scheduled-daily)
TRIGGER="${1:-scheduled-daily}"

# Validate trigger
case "$TRIGGER" in
  scheduled-daily|manual|pre-update|pre-migration|on-demand)
    # Valid trigger
    ;;
  *)
    echo "ERROR: Invalid trigger type: $TRIGGER" >&2
    echo "Valid triggers: scheduled-daily, manual, pre-update, pre-migration, on-demand" >&2
    exit 1
    ;;
esac

# Log backup start
echo "=== EscapePlan Database Backup ==="
echo "Trigger: $TRIGGER"
echo "Timestamp: $(date --iso-8601=seconds)"
echo ""

# Determine environment and set paths
if [[ -d "/opt/escapeplan" ]]; then
  # Production environment
  BACKUP_SCRIPT="/opt/escapeplan/scripts/backup.ts"
  NODE_BIN="/usr/bin/tsx"
elif [[ -d "/var/lib/escapeplan" ]]; then
  # Alternative production path
  BACKUP_SCRIPT="/var/lib/escapeplan/scripts/backup.ts"
  NODE_BIN="/usr/bin/tsx"
else
  # Development environment
  BACKUP_SCRIPT="$SCRIPT_DIR/backup.ts"
  # Use pnpm tsx from node_modules
  NODE_BIN="npx tsx"
fi

# Check if backup script exists
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
  echo "ERROR: Backup script not found: $BACKUP_SCRIPT" >&2
  exit 1
fi

# Execute backup script
echo "Executing backup script..."
if $NODE_BIN "$BACKUP_SCRIPT" "$TRIGGER"; then
  echo ""
  echo "=== Backup Completed Successfully ==="
  exit 0
else
  EXIT_CODE=$?
  echo ""
  echo "=== Backup Failed ===" >&2
  echo "Exit code: $EXIT_CODE" >&2
  exit 1
fi
