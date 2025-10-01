#!/usr/bin/env bash

# EscapePlan Storage Restore Script
# Restores SQLite database and asset files from backup
# Usage: ./restore-storage.sh <backup-name.tar.gz>

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

# Check for backup file argument
if [ $# -eq 0 ]; then
    error "Usage: $0 <backup-name.tar.gz>"
    error ""
    error "Available backups:"
    find "$BACKUP_DIR" -name "*.tar.gz" -type f -printf "  %f\n" 2>/dev/null || echo "  (none found)"
    exit 1
fi

BACKUP_FILE="$1"
BACKUP_ARCHIVE="$BACKUP_DIR/$BACKUP_FILE"

# Check if backup exists
if [ ! -f "$BACKUP_ARCHIVE" ]; then
    error "Backup file not found: $BACKUP_ARCHIVE"
    exit 1
fi

# Verify checksum if available
if [ -f "$BACKUP_ARCHIVE.sha256" ]; then
    log "Verifying backup checksum..."
    if command -v sha256sum &> /dev/null; then
        if ! sha256sum -c "$BACKUP_ARCHIVE.sha256"; then
            error "Checksum verification failed!"
            exit 1
        fi
    elif command -v shasum &> /dev/null; then
        if ! shasum -a 256 -c "$BACKUP_ARCHIVE.sha256"; then
            error "Checksum verification failed!"
            exit 1
        fi
    else
        warn "No checksum tool available, skipping verification"
    fi
    log "Checksum verified successfully"
fi

# Confirmation prompt
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn "WARNING: This will REPLACE the current database and assets!"
warn "Current data will be backed up to: ${DATA_DIR}-pre-restore-$(date +%Y%m%d-%H%M%S)"
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    log "Restore cancelled"
    exit 0
fi

# Create pre-restore backup
PRE_RESTORE_BACKUP="${DATA_DIR}-pre-restore-$(date +%Y%m%d-%H%M%S)"
log "Creating pre-restore backup at: $PRE_RESTORE_BACKUP"
mkdir -p "$PRE_RESTORE_BACKUP"

if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$PRE_RESTORE_BACKUP/"
    for ext in db-wal db-shm; do
        if [ -f "$DB_PATH-$ext" ]; then
            cp "$DB_PATH-$ext" "$PRE_RESTORE_BACKUP/"
        fi
    done
fi

if [ -d "$ASSETS_DIR" ]; then
    cp -r "$ASSETS_DIR" "$PRE_RESTORE_BACKUP/"
fi

log "Pre-restore backup completed"

# Extract backup archive
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log "Extracting backup archive..."
tar -xzf "$BACKUP_ARCHIVE" -C "$TEMP_DIR"

BACKUP_NAME=$(basename "$BACKUP_FILE" .tar.gz)
EXTRACTED_DIR="$TEMP_DIR/$BACKUP_NAME"

if [ ! -d "$EXTRACTED_DIR" ]; then
    error "Extracted backup directory not found: $EXTRACTED_DIR"
    exit 1
fi

# Show backup manifest
if [ -f "$EXTRACTED_DIR/manifest.json" ]; then
    log "Backup manifest:"
    cat "$EXTRACTED_DIR/manifest.json"
    echo ""
fi

# Restore database
if [ -f "$EXTRACTED_DIR/escapeplan.db" ]; then
    log "Restoring database..."
    cp "$EXTRACTED_DIR/escapeplan.db" "$DB_PATH"

    # Restore WAL and SHM files if present
    for ext in db-wal db-shm; do
        if [ -f "$EXTRACTED_DIR/escapeplan.$ext" ]; then
            cp "$EXTRACTED_DIR/escapeplan.$ext" "$DB_PATH-$ext"
        fi
    done

    log "Database restored successfully"
else
    error "Database not found in backup"
    exit 1
fi

# Restore assets
if [ -d "$EXTRACTED_DIR/assets" ]; then
    log "Restoring assets..."

    # Remove old assets directory
    if [ -d "$ASSETS_DIR" ]; then
        rm -rf "$ASSETS_DIR"
    fi

    cp -r "$EXTRACTED_DIR/assets" "$ASSETS_DIR"

    ASSET_COUNT=$(find "$ASSETS_DIR" -type f | wc -l)
    ASSET_SIZE=$(du -sh "$ASSETS_DIR" | cut -f1)
    log "Restored $ASSET_COUNT asset files ($ASSET_SIZE)"
else
    warn "Assets directory not found in backup"
fi

# Summary
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Restore completed successfully!"
log "Database: $DB_PATH"
log "Assets: $ASSETS_DIR"
log "Pre-restore backup: $PRE_RESTORE_BACKUP"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
warn "IMPORTANT: Restart the EscapePlan API service for changes to take effect:"
warn "  systemctl restart escapeplan-api  # (production)"
warn "  or restart your development server manually"

exit 0
