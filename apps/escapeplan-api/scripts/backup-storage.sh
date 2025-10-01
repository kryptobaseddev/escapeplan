#!/usr/bin/env bash

# EscapePlan Storage Backup Script
# Backs up SQLite database and asset files
# Usage: ./backup-storage.sh [backup-name]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_ROOT="$(dirname "$SCRIPT_DIR")"

# Environment detection
if [ -f "$API_ROOT/.env" ]; then
    set -a
    source "$API_ROOT/.env"
    set +a
fi

# Paths (development vs production)
if [ "${NODE_ENV:-development}" = "production" ]; then
    DATA_DIR="${ESCAPEPLAN_DATA_DIR:-/var/lib/escapeplan}"
    BACKUP_DIR="${ESCAPEPLAN_BACKUP_DIR:-/var/backups/escapeplan}"
else
    DATA_DIR="$API_ROOT/data"
    BACKUP_DIR="$API_ROOT/data/backups"
fi

DB_PATH="$DATA_DIR/escapeplan.db"
ASSETS_DIR="$DATA_DIR/assets"

# Backup configuration
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_NAME="${1:-auto-$(date +%Y%m%d-%H%M%S)}"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $*" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $*"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "Starting EscapePlan backup: $BACKUP_NAME"
log "Data directory: $DATA_DIR"
log "Backup directory: $BACKUP_DIR"

# Create backup subdirectory
mkdir -p "$BACKUP_PATH"

# Backup SQLite database
if [ -f "$DB_PATH" ]; then
    log "Backing up database..."

    # Use SQLite backup command for safe online backup
    if command -v sqlite3 &> /dev/null; then
        sqlite3 "$DB_PATH" ".backup '$BACKUP_PATH/escapeplan.db'"
        log "Database backup completed: $(du -h "$BACKUP_PATH/escapeplan.db" | cut -f1)"
    else
        warn "sqlite3 not found, using file copy (may be inconsistent if DB is in use)"
        cp "$DB_PATH" "$BACKUP_PATH/escapeplan.db"
    fi

    # Also backup WAL and SHM files if they exist
    for ext in db-wal db-shm; do
        if [ -f "$DB_PATH-$ext" ]; then
            cp "$DB_PATH-$ext" "$BACKUP_PATH/escapeplan.$ext"
        fi
    done
else
    error "Database not found at $DB_PATH"
    exit 1
fi

# Backup assets directory
if [ -d "$ASSETS_DIR" ]; then
    log "Backing up assets..."
    ASSET_COUNT=$(find "$ASSETS_DIR" -type f | wc -l)
    log "Found $ASSET_COUNT asset files"

    # Use rsync for efficient incremental backup if available
    if command -v rsync &> /dev/null; then
        rsync -a --delete "$ASSETS_DIR/" "$BACKUP_PATH/assets/"
        log "Assets backup completed (rsync)"
    else
        cp -r "$ASSETS_DIR" "$BACKUP_PATH/assets"
        log "Assets backup completed (cp)"
    fi

    ASSET_SIZE=$(du -sh "$BACKUP_PATH/assets" | cut -f1)
    log "Assets backup size: $ASSET_SIZE"
else
    warn "Assets directory not found at $ASSETS_DIR (skipping)"
fi

# Create backup manifest
cat > "$BACKUP_PATH/manifest.json" <<EOF
{
  "backupName": "$BACKUP_NAME",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "environment": "${NODE_ENV:-development}",
  "database": {
    "path": "$DB_PATH",
    "size": $(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null || echo 0)
  },
  "assets": {
    "path": "$ASSETS_DIR",
    "fileCount": ${ASSET_COUNT:-0}
  }
}
EOF

log "Created backup manifest"

# Create compressed archive
log "Creating compressed archive..."
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
ARCHIVE_SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)
log "Archive created: $BACKUP_NAME.tar.gz ($ARCHIVE_SIZE)"

# Generate checksum
if command -v sha256sum &> /dev/null; then
    sha256sum "$BACKUP_NAME.tar.gz" > "$BACKUP_NAME.tar.gz.sha256"
    log "Checksum generated: $BACKUP_NAME.tar.gz.sha256"
elif command -v shasum &> /dev/null; then
    shasum -a 256 "$BACKUP_NAME.tar.gz" > "$BACKUP_NAME.tar.gz.sha256"
    log "Checksum generated: $BACKUP_NAME.tar.gz.sha256"
fi

# Remove uncompressed backup directory
rm -rf "$BACKUP_PATH"
log "Removed temporary backup directory"

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "auto-*.tar.gz" -mtime +$RETENTION_DAYS 2>/dev/null || true)
if [ -n "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | while read -r old_backup; do
        log "Removing old backup: $(basename "$old_backup")"
        rm -f "$old_backup" "${old_backup}.sha256"
    done
else
    log "No old backups to remove"
fi

# Update storage metrics in database
log "Updating storage metrics..."
if [ -f "$DB_PATH" ] && command -v sqlite3 &> /dev/null; then
    sqlite3 "$DB_PATH" <<SQL
    INSERT OR REPLACE INTO storage_metrics (
        metric_type,
        metric_value,
        recorded_at
    ) VALUES (
        'last_backup',
        '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
        CURRENT_TIMESTAMP
    );
SQL
    log "Storage metrics updated"
fi

# Summary
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "*.tar.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Backup completed successfully!"
log "Backup archive: $BACKUP_NAME.tar.gz ($ARCHIVE_SIZE)"
log "Total backups: $TOTAL_BACKUPS"
log "Total backup storage: $TOTAL_SIZE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
