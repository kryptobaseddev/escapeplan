#!/bin/bash
set -euo pipefail

# ============================================================================
# EscapePlan Nginx Configuration Script
# ============================================================================
# Safely deploys production-ready nginx configuration with rate limiting,
# security headers, and WebSocket support. Includes automatic backup and
# rollback on failure.
# ============================================================================

NGINX_CONF="/etc/nginx/sites-available/escapeplan"
NGINX_ENABLED="/etc/nginx/sites-enabled/escapeplan"
NGINX_DEFAULT="/etc/nginx/sites-enabled/default"
BACKUP_DIR="/var/backups/nginx"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log() {
    echo "[nginx-configure] $1"
}

log_success() {
    echo "[nginx-configure] [✓] $1"
}

log_error() {
    echo "[nginx-configure] [ERROR] $1" >&2
}

log_warning() {
    echo "[nginx-configure] [⚠] $1"
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
        chmod 755 "$BACKUP_DIR"
    fi
}

# Backup existing configuration
backup_existing_config() {
    if [ -f "$NGINX_CONF" ]; then
        local backup_file="${BACKUP_DIR}/escapeplan.conf.${TIMESTAMP}"
        log "Backing up existing configuration to: $backup_file"
        cp "$NGINX_CONF" "$backup_file"
        log_success "Configuration backed up successfully"
        return 0
    else
        log_warning "No existing configuration to backup"
        return 1
    fi
}

# Restore from backup
restore_from_backup() {
    local backup_file="${BACKUP_DIR}/escapeplan.conf.${TIMESTAMP}"
    if [ -f "$backup_file" ]; then
        log "Restoring configuration from backup: $backup_file"
        cp "$backup_file" "$NGINX_CONF"
        log_success "Configuration restored from backup"
        return 0
    else
        log_error "Backup file not found: $backup_file"
        return 1
    fi
}

# Validate nginx configuration
validate_nginx_config() {
    log "Validating nginx configuration..."
    if nginx -t 2>&1; then
        log_success "Nginx configuration is valid"
        return 0
    else
        log_error "Nginx configuration validation failed"
        return 1
    fi
}

# Enable site configuration
enable_site() {
    log "Enabling escapeplan site..."

    # Create symlink if it doesn't exist
    if [ ! -L "$NGINX_ENABLED" ]; then
        ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
        log_success "Site enabled"
    else
        log "Site already enabled"
    fi

    # Remove default site
    if [ -f "$NGINX_DEFAULT" ] || [ -L "$NGINX_DEFAULT" ]; then
        log "Removing default nginx site..."
        rm -f "$NGINX_DEFAULT"
        log_success "Default site removed"
    fi
}

# Reload nginx
reload_nginx() {
    log "Reloading nginx..."
    if systemctl reload nginx 2>&1; then
        log_success "Nginx reloaded successfully"
        return 0
    else
        log_error "Failed to reload nginx"
        return 1
    fi
}

# Main deployment function
main() {
    log "Starting nginx configuration deployment..."
    log "Target configuration: $NGINX_CONF"

    # Check if nginx configuration file exists
    if [ ! -f "$NGINX_CONF" ]; then
        log_error "Nginx configuration file not found: $NGINX_CONF"
        log_error "Expected file should be installed by package"
        exit 1
    fi

    # Create backup directory
    create_backup_dir

    # Backup existing configuration
    backup_existing_config
    local backup_exists=$?

    # Validate new configuration
    if ! validate_nginx_config; then
        log_error "New nginx configuration is invalid"

        # Restore backup if it exists
        if [ $backup_exists -eq 0 ]; then
            log "Attempting to restore previous configuration..."
            if restore_from_backup && validate_nginx_config; then
                log_success "Previous configuration restored successfully"
            else
                log_error "Failed to restore previous configuration"
            fi
        fi

        exit 1
    fi

    # Enable site
    enable_site

    # Reload nginx
    if ! reload_nginx; then
        log_error "Failed to reload nginx with new configuration"

        # Restore backup if it exists
        if [ $backup_exists -eq 0 ]; then
            log "Attempting to restore previous configuration..."
            if restore_from_backup && validate_nginx_config && reload_nginx; then
                log_success "Previous configuration restored and reloaded"
            else
                log_error "Failed to restore and reload previous configuration"
                log_error "Manual intervention required"
            fi
        fi

        exit 1
    fi

    log_success "Nginx configuration deployed successfully"
    log "Backup saved at: ${BACKUP_DIR}/escapeplan.conf.${TIMESTAMP}"

    return 0
}

# Run main function
main
