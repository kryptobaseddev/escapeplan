#!/bin/bash
set -e

# ============================================================================
# EscapePlan Post-Install Orchestrator
# ============================================================================
# Coordinates the installation process with comprehensive logging and
# retry logic to prevent infinite loops.
# ============================================================================

INSTALL_ROOT="${1:-/opt/escapeplan}"
LOG_FILE="/tmp/escapeplan-postinst.log"

# Progress tracking
STEP_COUNTER=0
SCRIPT_START_TIME=$(date +%s)
MAX_RETRY_COUNT=3
RETRY_DELAY=2

# Initialize log file
echo "==================================================================" > "${LOG_FILE}"
echo "EscapePlan Post-Install Orchestrator - $(date '+%Y-%m-%d %H:%M:%S')" >> "${LOG_FILE}"
echo "Installation root: ${INSTALL_ROOT}" >> "${LOG_FILE}"
echo "System: $(uname -a)" >> "${LOG_FILE}"
echo "==================================================================" >> "${LOG_FILE}"
echo "" >> "${LOG_FILE}"

log_step() {
    STEP_COUNTER=$((STEP_COUNTER + 1))
    local timestamp=$(date '+%H:%M:%S')
    local message="[STEP ${STEP_COUNTER}] [${timestamp}] $1"
    echo "${message}" | tee -a "${LOG_FILE}"
}

log() {
    local timestamp=$(date '+%H:%M:%S')
    local message="[orchestrator] [${timestamp}] $1"
    echo "${message}" | tee -a "${LOG_FILE}"
}

log_success() {
    local timestamp=$(date '+%H:%M:%S')
    local message="[orchestrator] [✓] [${timestamp}] $1"
    echo "${message}" | tee -a "${LOG_FILE}"
}

log_warning() {
    local timestamp=$(date '+%H:%M:%S')
    local message="[orchestrator] [⚠] [${timestamp}] $1"
    echo "${message}" | tee -a "${LOG_FILE}"
}

log_error() {
    local timestamp=$(date '+%H:%M:%S')
    local message="[orchestrator] [ERROR] [${timestamp}] $1"
    echo "${message}" >&2 | tee -a "${LOG_FILE}"
}

log_elapsed() {
    local current_time=$(date +%s)
    local elapsed=$((current_time - SCRIPT_START_TIME))
    local minutes=$((elapsed / 60))
    local seconds=$((elapsed % 60))
    log "Elapsed time: ${minutes}m ${seconds}s"
}

# Retry wrapper with max attempts
retry_command() {
    local description="$1"
    shift
    local retry_count=0

    while [ ${retry_count} -lt ${MAX_RETRY_COUNT} ]; do
        log "Attempting: ${description} (attempt $((retry_count + 1))/${MAX_RETRY_COUNT})"

        if "$@" >> "${LOG_FILE}" 2>&1; then
            log_success "${description} succeeded"
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ ${retry_count} -lt ${MAX_RETRY_COUNT} ]; then
                log_warning "${description} failed, retrying in ${RETRY_DELAY}s..."
                sleep ${RETRY_DELAY}
            else
                log_error "${description} failed after ${MAX_RETRY_COUNT} attempts"
                return 1
            fi
        fi
    done

    return 1
}

log "Starting EscapePlan postinst orchestration..."
log "Installation root: ${INSTALL_ROOT}"
log "Log file: ${LOG_FILE}"
echo ""

# Step 1: Install system packages
log_step "Installing system packages"
log "Updating package index..."

if ! retry_command "APT package index update" apt-get update -qq; then
    log_error "Failed to update package index after ${MAX_RETRY_COUNT} attempts"
    exit 1
fi

log "Installing required packages: build-essential, python3, nodejs, npm, dnsmasq, hostapd, nginx..."

if ! retry_command "System package installation" \
    env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    build-essential python3 nodejs npm dnsmasq hostapd nginx; then
    log_error "Failed to install system packages after ${MAX_RETRY_COUNT} attempts"
    exit 1
fi

log_success "System packages installed successfully"
log_elapsed

# Step 2: Rebuild native modules for ARM64
log_step "Rebuilding native modules for $(uname -m)"

if [ ! -f "${INSTALL_ROOT}/scripts/pi-post-install.sh" ]; then
    log_error "pi-post-install.sh not found at ${INSTALL_ROOT}/scripts/"
    exit 1
fi

log "Running pi-post-install.sh to rebuild native modules..."

# Run with timeout to prevent infinite hangs
if timeout 600 "${INSTALL_ROOT}/scripts/pi-post-install.sh" "$INSTALL_ROOT" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Native modules rebuilt successfully"
else
    local exit_code=$?
    if [ ${exit_code} -eq 124 ]; then
        log_error "Native module rebuild timed out after 10 minutes"
        log_error "This may indicate an infinite loop - check ${LOG_FILE}"
        exit 1
    else
        log_warning "Native module rebuild had warnings (exit code: ${exit_code})"
        log_warning "Check ${LOG_FILE} for details"
        log "Continuing with installation..."
    fi
fi

log_elapsed

# Step 3: Initialize database
log_step "Initializing database"

if [ ! -f "${INSTALL_ROOT}/api/dist/db/seed.js" ]; then
    log_error "Database seed script not found at ${INSTALL_ROOT}/api/dist/db/seed.js"
    exit 1
fi

# Skip if already initialized
if [ -f "/var/lib/escapeplan/.db-initialized" ]; then
    log_success "Database already initialized, skipping"
else
    log "Running database seed script..."

    # Set environment variables for database initialization
    export DATABASE_URL="/var/lib/escapeplan/escapeplan.db"
    export NODE_ENV="production"

    # Run seed script as escapeplan user with timeout
    if timeout 120 su -s /bin/bash escapeplan -c "cd '${INSTALL_ROOT}/api' && node dist/db/seed.js" 2>&1 | tee -a "$LOG_FILE"; then
        # Mark database as initialized
        touch /var/lib/escapeplan/.db-initialized
        chown escapeplan:escapeplan /var/lib/escapeplan/.db-initialized
        log_success "Database initialized with admin user and RBAC roles"
    else
        local exit_code=$?
        if [ ${exit_code} -eq 124 ]; then
            log_error "Database initialization timed out after 2 minutes"
            log_error "This may indicate an infinite loop - check ${LOG_FILE}"
            exit 1
        else
            log_error "Database initialization failed (exit code: ${exit_code})"
            log_error "Check logs at ${LOG_FILE}"
            log_error "You may need to run manually: sudo -u escapeplan node ${INSTALL_ROOT}/api/dist/db/seed.js"
            exit 1
        fi
    fi
fi

log_elapsed

# Step 4: Generate secrets
log_step "Generating security secrets"

if [ -f "/etc/escapeplan/api.env" ]; then
    log_success "Existing api.env found, preserving secrets"
else
    log "Generating cryptographic secrets..."

    # Generate Better Auth secret (64-char random string)
    BETTER_AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')

    # Generate camera encryption key (32-char hex)
    CAMERA_ENCRYPTION_KEY=$(openssl rand -hex 32 | tr -d '\n')

    log "Creating API environment file at /etc/escapeplan/api.env..."

    # Create API environment file
    cat > /etc/escapeplan/api.env <<-ENVEOF
PORT=4000
HOST=0.0.0.0
DATABASE_URL=/var/lib/escapeplan/escapeplan.db
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://escapeplan.local:3000,http://10.10.10.1:3000
CAMERA_ENCRYPTION_KEY=${CAMERA_ENCRYPTION_KEY}
NODE_ENV=production
ENVEOF

    chown escapeplan:escapeplan /etc/escapeplan/api.env
    chmod 600 /etc/escapeplan/api.env

    log_success "Secrets generated and saved to /etc/escapeplan/api.env"
fi

log_elapsed

# Step 5: Configure nginx
log_step "Configuring nginx reverse proxy"

if [ ! -f "/etc/nginx/sites-available/escapeplan" ]; then
    log_warning "Nginx configuration file not found at /etc/nginx/sites-available/escapeplan"
    log_warning "Skipping nginx configuration"
else
    log "Enabling escapeplan site..."
    ln -sf /etc/nginx/sites-available/escapeplan /etc/nginx/sites-enabled/escapeplan

    log "Removing default site..."
    rm -f /etc/nginx/sites-enabled/default

    log "Testing nginx configuration..."
    if nginx -t 2>&1 | tee -a "$LOG_FILE"; then
        log "Restarting nginx..."
        if systemctl restart nginx 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Nginx configured and restarted successfully"
        else
            log_warning "Failed to restart nginx - check configuration"
        fi
    else
        log_warning "Nginx configuration test failed - skipping restart"
    fi
fi

log_elapsed

# Step 6: Configure services
log_step "Configuring systemd services"

log "Reloading systemd daemon..."
if ! retry_command "systemd daemon reload" systemctl daemon-reload; then
    log_error "Failed to reload systemd daemon after ${MAX_RETRY_COUNT} attempts"
    exit 1
fi

log "Enabling escapeplan-api service..."
if ! retry_command "escapeplan-api service enable" systemctl enable escapeplan-api.service; then
    log_error "Failed to enable escapeplan-api service after ${MAX_RETRY_COUNT} attempts"
    exit 1
fi

log "Enabling escapeplan-web service..."
if ! retry_command "escapeplan-web service enable" systemctl enable escapeplan-web.service; then
    log_error "Failed to enable escapeplan-web service after ${MAX_RETRY_COUNT} attempts"
    exit 1
fi

log "Enabling escapeplan-backup timer..."
if ! retry_command "escapeplan-backup timer enable" systemctl enable escapeplan-backup.timer; then
    log_error "Failed to enable escapeplan-backup timer after ${MAX_RETRY_COUNT} attempts"
    exit 1
fi

log_success "Services configured and enabled"
log_elapsed

# Completion
echo ""
log_success "Postinst orchestration complete!"
log_elapsed
echo ""

log "Installation Summary:"
log "  ✓ System packages: installed (build-essential, python3, nodejs, npm, nginx)"
log "  ✓ Native modules: rebuilt for $(uname -m)"
log "  ✓ Database: initialized with admin user and RBAC roles"
log "  ✓ Secrets: generated and secured at /etc/escapeplan/api.env"
log "  ✓ Nginx: configured as reverse proxy"
log "  ✓ Services: enabled (not started)"
echo ""

log "Next steps:"
log "  1. Start services:"
log "     systemctl start escapeplan-api escapeplan-web"
log "  2. Check status:"
log "     systemctl status escapeplan-api"
log "  3. View logs:"
log "     journalctl -u escapeplan-api -f"
log "  4. Access web interface:"
log "     http://localhost or http://escapeplan.local"
echo ""

log "Installation log saved to: ${LOG_FILE}"
echo ""

exit 0
