#!/bin/bash
# ============================================================================
# PRODUCTION DEPLOYMENT SCRIPT - Database Migration
# ============================================================================
# Server: 10.0.10.138 (escapeplan/escapeplan)
# Task: Fix NULL configs in games table
# Date: 2025-10-06
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROD_SERVER="10.0.10.138"
PROD_USER="escapeplan"
PROD_PASSWORD="escapeplan"
PROD_DB_PATH="/var/lib/escapeplan/escapeplan.db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Main deployment
echo ""
log_info "============================================"
log_info "PRODUCTION DEPLOYMENT - Database Migration"
log_info "============================================"
echo ""
log_warning "This will migrate the database on production server: $PROD_SERVER"
log_warning "Ensure you have reviewed the migration report before proceeding"
echo ""

# Check if migration script exists
if [ ! -f "$SCRIPT_DIR/fix-null-configs.ts" ]; then
    log_error "Migration script not found: $SCRIPT_DIR/fix-null-configs.ts"
    exit 1
fi

log_success "Migration script found"

# Copy script to production
log_info "Copying migration script to production server..."
sshpass -p "$PROD_PASSWORD" scp "$SCRIPT_DIR/fix-null-configs.ts" "$PROD_USER@$PROD_SERVER:/tmp/fix-null-configs.ts"

if [ $? -eq 0 ]; then
    log_success "Script copied successfully"
else
    log_error "Failed to copy script to production"
    exit 1
fi

# Execute migration on production
log_info "Executing migration on production server..."
echo ""
log_warning "The following steps will be performed:"
log_warning "  1. Create database backup"
log_warning "  2. Check for NULL values"
log_warning "  3. Update configs with valid defaults"
log_warning "  4. Validate JSON"
log_warning "  5. Verify results"
echo ""

read -p "Do you want to proceed with production deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warning "Deployment cancelled by user"
    exit 0
fi

# Run migration
log_info "Running migration script..."
sshpass -p "$PROD_PASSWORD" ssh "$PROD_USER@$PROD_SERVER" << 'ENDSSH'
cd /opt/escapeplan/api

# Stop API service
echo "Stopping API service..."
sudo systemctl stop escapeplan-api

# Run migration
echo "Running migration..."
pnpm tsx /tmp/fix-null-configs.ts --db=/var/lib/escapeplan/escapeplan.db <<< "y"

# Verify
echo "Verifying migration..."
sqlite3 /var/lib/escapeplan/escapeplan.db "
SELECT
  'Verification Results:' as result
UNION ALL
SELECT
  '  Game: ' || slug || ' - ' ||
  CASE WHEN pricing_config IS NULL THEN 'FAIL (pricing NULL)'
       WHEN media_config IS NULL THEN 'FAIL (media NULL)'
       WHEN booking_rules_config IS NULL THEN 'FAIL (booking NULL)'
       ELSE 'PASS'
  END
FROM games
WHERE slug = 'pirate-mutiny';
"

# Start API service
echo "Starting API service..."
sudo systemctl start escapeplan-api

# Check service status
echo "Checking service status..."
sleep 3
sudo systemctl status escapeplan-api --no-pager | head -15

# Cleanup
rm /tmp/fix-null-configs.ts

echo ""
echo "Migration complete!"
ENDSSH

if [ $? -eq 0 ]; then
    log_success "Production deployment completed successfully!"
    echo ""
    log_info "Next steps:"
    log_info "  1. Verify game details page loads"
    log_info "  2. Test booking flow"
    log_info "  3. Check API logs for errors"
    log_info "  4. Monitor for 24 hours"
    echo ""
    log_success "Deployment successful!"
else
    log_error "Deployment failed. Check logs above for details."
    exit 1
fi
