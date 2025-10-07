#!/bin/bash
# ============================================================================
# FIX NULL CONFIGS IN GAMES TABLE
# ============================================================================
# Task: Fix NULL pricing_config, media_config, booking_rules_config
# Game: Pirate Mutiny
# Production Server: 10.0.10.138 (escapeplan/escapeplan)
# Created: 2025-10-06
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_PATH="${DB_PATH:-/var/lib/escapeplan/escapeplan.db}"
BACKUP_DIR="/var/lib/escapeplan/backups"
BACKUP_FILE="$BACKUP_DIR/escapeplan_backup_$(date +%Y%m%d_%H%M%S).db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    log_error "Database not found at: $DB_PATH"
    log_info "Please set DB_PATH environment variable or ensure database exists"
    exit 1
fi

log_info "Database found: $DB_PATH"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# STEP 1: CREATE BACKUP
log_info "Creating database backup..."
cp "$DB_PATH" "$BACKUP_FILE"
if [ $? -eq 0 ]; then
    log_success "Backup created: $BACKUP_FILE"
else
    log_error "Failed to create backup"
    exit 1
fi

# STEP 2: CHECK CURRENT NULL VALUES
log_info "Checking for NULL values in games table..."
echo ""
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT
    id,
    slug,
    name,
    CASE WHEN pricing_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as pricing_config,
    CASE WHEN media_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as media_config,
    CASE WHEN booking_rules_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as booking_rules_config
FROM games
WHERE pricing_config IS NULL
   OR media_config IS NULL
   OR booking_rules_config IS NULL;
EOF

# Count NULL values
NULL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM games WHERE pricing_config IS NULL OR media_config IS NULL OR booking_rules_config IS NULL;")
log_info "Found $NULL_COUNT game(s) with NULL config values"

if [ "$NULL_COUNT" -eq 0 ]; then
    log_warning "No NULL values found. Nothing to fix."
    exit 0
fi

# Prompt for confirmation
echo ""
read -p "Do you want to proceed with fixing NULL values? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warning "Operation cancelled by user"
    exit 0
fi

# STEP 3: UPDATE pricing_config
log_info "Updating pricing_config..."
sqlite3 "$DB_PATH" "UPDATE games SET pricing_config = '{\"tiers\":[{\"id\":\"tier-1\",\"label\":\"Standard\",\"model\":\"per_person\",\"priceCents\":2000,\"minPlayers\":1,\"maxPlayers\":5,\"displayOrder\":1,\"active\":true}],\"discounts\":[]}' WHERE pricing_config IS NULL;"
ROWS_UPDATED=$(sqlite3 "$DB_PATH" "SELECT changes();")
log_success "Updated pricing_config for $ROWS_UPDATED row(s)"

# STEP 4: UPDATE media_config
log_info "Updating media_config..."
sqlite3 "$DB_PATH" "UPDATE games SET media_config = '{\"galleryAssetIds\":[]}' WHERE media_config IS NULL;"
ROWS_UPDATED=$(sqlite3 "$DB_PATH" "SELECT changes();")
log_success "Updated media_config for $ROWS_UPDATED row(s)"

# STEP 5: UPDATE booking_rules_config
log_info "Updating booking_rules_config..."
sqlite3 "$DB_PATH" "UPDATE games SET booking_rules_config = '{\"isMobile\":false,\"reservationStyle\":\"public\",\"customFields\":[]}' WHERE booking_rules_config IS NULL;"
ROWS_UPDATED=$(sqlite3 "$DB_PATH" "SELECT changes();")
log_success "Updated booking_rules_config for $ROWS_UPDATED row(s)"

# STEP 6: VERIFY UPDATES
log_info "Verifying updates..."
echo ""
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT
    id,
    slug,
    name,
    CASE WHEN pricing_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as pricing_config,
    CASE WHEN media_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as media_config,
    CASE WHEN booking_rules_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as booking_rules_config
FROM games
WHERE id = '431402af-463f-4173-b9a9-1b8d48efd273';
EOF

# STEP 7: VALIDATE JSON
log_info "Validating JSON..."
echo ""
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT
    slug as game_slug,
    json_valid(pricing_config) as pricing_valid,
    json_valid(media_config) as media_valid,
    json_valid(booking_rules_config) as booking_valid
FROM games
WHERE id = '431402af-463f-4173-b9a9-1b8d48efd273';
EOF

# Check JSON validity
INVALID_JSON=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM games WHERE json_valid(pricing_config) = 0 OR json_valid(media_config) = 0 OR json_valid(booking_rules_config) = 0;")
if [ "$INVALID_JSON" -gt 0 ]; then
    log_error "Found $INVALID_JSON game(s) with invalid JSON. Rolling back..."
    cp "$BACKUP_FILE" "$DB_PATH"
    log_warning "Database restored from backup"
    exit 1
fi

log_success "All JSON is valid!"

# Final verification - check for any remaining NULLs
REMAINING_NULLS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM games WHERE pricing_config IS NULL OR media_config IS NULL OR booking_rules_config IS NULL;")
if [ "$REMAINING_NULLS" -gt 0 ]; then
    log_warning "Warning: Still found $REMAINING_NULLS game(s) with NULL values"
else
    log_success "All NULL values have been fixed!"
fi

# STEP 8: DISPLAY SUMMARY
echo ""
log_success "=================================="
log_success "DATABASE MIGRATION COMPLETE"
log_success "=================================="
log_info "Backup location: $BACKUP_FILE"
log_info "Database: $DB_PATH"
log_info "NULL configs fixed: $NULL_COUNT"
log_info "JSON validation: PASSED"
echo ""
log_warning "IMPORTANT: Test the application to ensure everything works correctly"
log_warning "If issues occur, restore from backup:"
log_warning "  cp $BACKUP_FILE $DB_PATH"
echo ""
