#!/bin/bash
set -euo pipefail

# ============================================================================
# EscapePlan nginx Configuration Switch
# ============================================================================
# Switches nginx from captive portal mode to main application mode
# Safe execution with rollback on failure
# ============================================================================

LOG_PREFIX="[nginx-configure]"

log() {
    echo "${LOG_PREFIX} $1"
}

log_success() {
    echo "${LOG_PREFIX} ✓ $1"
}

log_error() {
    echo "${LOG_PREFIX} ERROR: $1" >&2
}

# Backup current nginx configuration
BACKUP_DIR="/var/backups/nginx-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"

log "Creating backup of current nginx configuration..."
cp -r /etc/nginx/sites-enabled "${BACKUP_DIR}/"
log_success "Backup created at ${BACKUP_DIR}"

# Check if escapeplan.conf exists
if [ ! -f "/etc/nginx/sites-available/escapeplan.conf" ]; then
    log_error "escapeplan.conf not found in /etc/nginx/sites-available/"
    log_error "This should be provided by the base OS image"
    log_error "Skipping nginx configuration - manual setup required"
    exit 0  # Exit gracefully, not a hard failure
fi

log "Disabling captive portal nginx configuration..."
rm -f /etc/nginx/sites-enabled/captive-portal.conf || true
log_success "Captive portal disabled"

log "Enabling main application nginx configuration..."
ln -sf /etc/nginx/sites-available/escapeplan.conf /etc/nginx/sites-enabled/escapeplan.conf
log_success "Main application config enabled"

# Test nginx configuration
log "Testing nginx configuration..."
if nginx -t 2>&1; then
    log_success "nginx configuration test passed"
else
    log_error "nginx configuration test FAILED"
    log_error "Rolling back to previous configuration..."

    # Restore backup
    rm -rf /etc/nginx/sites-enabled
    cp -r "${BACKUP_DIR}/sites-enabled" /etc/nginx/

    log_error "Configuration restored from backup"
    log_error "nginx was NOT reloaded - running previous config"
    exit 1
fi

# Reload nginx
log "Reloading nginx..."
if systemctl reload nginx 2>&1; then
    log_success "nginx reloaded successfully"
    log_success "Main application is now accessible at:"
    log_success "  - http://escapeplan.local (redirects to HTTPS)"
    log_success "  - https://escapeplan.local"
    log_success "  - https://10.10.10.1"
else
    log_error "nginx reload FAILED"
    log_error "Rolling back to previous configuration..."

    # Restore backup
    rm -rf /etc/nginx/sites-enabled
    cp -r "${BACKUP_DIR}/sites-enabled" /etc/nginx/
    systemctl reload nginx 2>&1 || true

    log_error "Configuration restored from backup"
    exit 1
fi

log_success "nginx configuration switch complete!"
exit 0
