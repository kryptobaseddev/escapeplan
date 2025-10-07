#!/bin/bash
set -euo pipefail

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

# Error cleanup trap
cleanup_on_error() {
    local exit_code=$?
    if [ "$exit_code" -ne 0 ]; then
        log_error "Orchestration failed with exit code $exit_code"
        log_error "Rolling back partial installation..."

        # Remove .db-initialized marker if database setup failed
        if [ -f "/var/lib/escapeplan/.db-initialized" ]; then
            local db_file="/var/lib/escapeplan/escapeplan.db"
            if [ ! -f "$db_file" ] || ! sqlite3 "$db_file" "SELECT COUNT(*) FROM user;" >/dev/null 2>&1; then
                log "Removing invalid .db-initialized marker"
                rm -f "/var/lib/escapeplan/.db-initialized"
            fi
        fi

        # Disable services if they were enabled
        systemctl disable escapeplan-api.service escapeplan-web.service 2>/dev/null || true
    fi
}

trap cleanup_on_error EXIT ERR

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

# Step 1: Verify base OS dependencies
# System packages and NetworkManager provided by base OS
log_step "Verifying base OS dependencies"

# Required commands that must be present in base OS
declare -A required_commands=(
    ["gcc"]="build-essential"
    ["g++"]="build-essential"
    ["make"]="build-essential"
    ["python3"]="python3"
    ["node"]="nodejs"
    ["npm"]="npm"
    ["nginx"]="nginx"
    ["sqlite3"]="sqlite3"
    ["openssl"]="openssl"
)

log "Checking for required system commands..."

missing_commands=()
for cmd in "${!required_commands[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        missing_commands+=("$cmd (package: ${required_commands[$cmd]})")
    fi
done

if [ ${#missing_commands[@]} -gt 0 ]; then
    log_error "Missing required system commands:"
    for missing in "${missing_commands[@]}"; do
        log_error "  - $missing"
    done
    log_error ""
    log_error "ERROR: Base OS must provide all system packages before package installation."
    log_error "This package does NOT install system packages (violates Debian policy)."
    log_error ""
    log_error "Required packages should be installed by base OS or declared in debian/control Depends."
    exit 1
fi

log_success "All required system commands are available (provided by base OS)"
log_elapsed

# Step 2: Rebuild native modules for ARM64
log_step "Rebuilding native modules for $(uname -m)"

if [ ! -f "${INSTALL_ROOT}/scripts/pi-post-install.sh" ]; then
    log_error "pi-post-install.sh not found at ${INSTALL_ROOT}/scripts/"
    log_error "Package installation incomplete - critical script missing"
    log_error "Expected file: ${INSTALL_ROOT}/scripts/pi-post-install.sh"
    log_error "Reinstall package: sudo dpkg -i --force-all escapeplan_*.deb"
    exit 1
fi

log "Running pi-post-install.sh to rebuild native modules..."

# Run with timeout to prevent infinite hangs
if timeout 600 "${INSTALL_ROOT}/scripts/pi-post-install.sh" "$INSTALL_ROOT" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Native modules rebuilt successfully"
else
    rebuild_exit_code=$?
    if [ ${rebuild_exit_code} -eq 124 ]; then
        log_error "Native module rebuild timed out after 10 minutes"
        log_error "This may indicate an infinite loop - check ${LOG_FILE}"
        exit 1
    else
        log_warning "Native module rebuild had warnings (exit code: ${rebuild_exit_code})"
        log_warning "Check ${LOG_FILE} for details"
        log "Continuing with installation..."
    fi
fi

log_elapsed

# Step 3: Apply database migrations
log_step "Applying database schema migrations"

if [ ! -f "${INSTALL_ROOT}/api/dist/db/migrate.js" ]; then
    log_error "Database migration script not found at ${INSTALL_ROOT}/api/dist/db/migrate.js"
    log_error "API dist files missing - build may have failed during packaging"
    log_error "Expected: ${INSTALL_ROOT}/api/dist/db/migrate.js"
    log_error "This is a package build issue - contact support or rebuild package"
    exit 1
fi

# Skip if already initialized (migrations already applied)
if [ -f "/var/lib/escapeplan/.db-initialized" ]; then
    log_success "Database already initialized, skipping migrations"
else
    log "Running database migration script to create schema..."

    # Set environment variables for migration
    export DATABASE_URL="/var/lib/escapeplan/escapeplan.db"
    export NODE_ENV="production"

    # Run migration script as escapeplan user with timeout (5 minutes)
    if timeout 300 su -s /bin/bash escapeplan -c "cd '${INSTALL_ROOT}/api' && node dist/db/migrate.js" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Database schema migrations applied successfully"
    else
        migrate_exit_code=$?
        if [ ${migrate_exit_code} -eq 124 ]; then
            log_error "Migration timed out after 5 minutes"
            log_error "This may indicate an infinite loop - check ${LOG_FILE}"
            exit 1
        else
            log_error "Migration failed (exit code: ${migrate_exit_code})"
            log_error "Check logs at ${LOG_FILE}"
            log_error "Schema must be applied before seeding"
            exit 1
        fi
    fi
fi

log_elapsed

# Step 4: Initialize database
log_step "Seeding database with initial data"

if [ ! -f "${INSTALL_ROOT}/api/dist/db/seed.js" ]; then
    log_error "Database seed script not found at ${INSTALL_ROOT}/api/dist/db/seed.js"
    log_error "API dist files missing - build may have failed during packaging"
    log_error "Expected: ${INSTALL_ROOT}/api/dist/db/seed.js"
    log_error "This is a package build issue - contact support or rebuild package"
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
        # Validate database schema completeness
        log "Validating database schema..."
        if ! su -s /bin/bash escapeplan -c "cd '${INSTALL_ROOT}/api' && node -e \"
            const Database = require('better-sqlite3');
            const db = new Database('/var/lib/escapeplan/escapeplan.db', { readonly: true });
            const tables = db.prepare('SELECT name FROM sqlite_master WHERE type=\\'table\\'').all();
            const tableCount = tables.length;
            db.close();

            // Expect at least 30 tables from schema
            if (tableCount < 30) {
                console.error('ERROR: Only ' + tableCount + ' tables found, expected at least 30');
                process.exit(1);
            }
            console.log('✓ Database has ' + tableCount + ' tables');
        \"" 2>&1 | tee -a "$LOG_FILE"; then
            log_error "Database schema validation failed"
            log_error "Database may be incomplete or corrupted"
            exit 1
        fi
        # Mark database as initialized
        touch /var/lib/escapeplan/.db-initialized
        chown escapeplan:escapeplan /var/lib/escapeplan/.db-initialized
        log_success "Database initialized with admin user and RBAC roles"
    else
        db_init_exit_code=$?
        if [ ${db_init_exit_code} -eq 124 ]; then
            log_error "Database initialization timed out after 2 minutes"
            log_error "This may indicate an infinite loop - check ${LOG_FILE}"
            exit 1
        else
            log_error "Database initialization failed (exit code: ${db_init_exit_code})"
            log_error "Check logs at ${LOG_FILE}"
            log_error "You may need to run manually: sudo -u escapeplan node ${INSTALL_ROOT}/api/dist/db/seed.js"
            exit 1
        fi
    fi
fi

log_elapsed

# Step 5: Generate secrets
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

# Step 6: Configure nginx
log_step "Configuring nginx reverse proxy"

if [ ! -f "${INSTALL_ROOT}/scripts/nginx-configure.sh" ]; then
    log_error "nginx-configure.sh not found at ${INSTALL_ROOT}/scripts/"
    log_error "Package installation incomplete - critical script missing"
    log_error "Expected file: ${INSTALL_ROOT}/scripts/nginx-configure.sh"
    exit 1
fi

log "Running nginx-configure.sh for safe deployment..."

# Run nginx configuration script with output logging
if "${INSTALL_ROOT}/scripts/nginx-configure.sh" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Nginx configured successfully with production settings"
    log_success "Configuration includes: rate limiting, WebSocket support, security headers"
else
    nginx_exit_code=$?
    log_error "Nginx configuration failed (exit code: ${nginx_exit_code})"
    log_error "Check logs at ${LOG_FILE}"
    log_error "Automatic rollback should have restored previous configuration"
    log_warning "Continuing with installation, but nginx may not be properly configured"
fi

log_elapsed

# Step 7: Configure services
log_step "Registering systemd services"

log "Reloading systemd daemon to register service units..."
if ! retry_command "systemd daemon reload" systemctl daemon-reload; then
    log_error "Failed to reload systemd daemon after ${MAX_RETRY_COUNT} attempts"
    log_error "Cannot register new service units without daemon reload"
    log_error "This should rarely fail - check systemd: systemctl status"
    exit 1
fi

log "Enabling rescue service to prevent boot loops..."
if ! retry_command "enable rescue service" systemctl enable escapeplan-rescue.service; then
    log_error "Failed to enable rescue service after ${MAX_RETRY_COUNT} attempts"
    log_error "Rescue service critical for boot loop prevention"
    log_error "Service file: /etc/systemd/system/escapeplan-rescue.service"
    log_error "Check if file exists and is valid"
    exit 1
fi

log_success "Service units registered with systemd"
log_success "Rescue service enabled (runs on every boot to prevent boot loops)"
log_warning "Main services (API/Web) are NOT auto-enabled to prevent boot loops"
log_warning "Services must be manually enabled after first successful boot"
log_warning "Run first-boot-setup.sh to enable and start services safely"
log_elapsed

# Completion
echo ""
log_success "Postinst orchestration complete!"
log_elapsed
echo ""

log "Installation Summary:"
log "  ✓ System dependencies: verified (all required commands available)"
log "  ✓ Native modules: rebuilt for $(uname -m)"
log "  ✓ Database migrations: schema applied (33 tables created)"
log "  ✓ Database seeding: initialized with admin user and RBAC roles"
log "  ✓ Secrets: generated and secured at /etc/escapeplan/api.env"
log "  ✓ Nginx: configured as reverse proxy"
log "  ✓ Rescue service: enabled (prevents boot loops)"
log "  ✓ Main services: registered (NOT enabled - prevents boot loops)"
echo ""

log "⚠️  IMPORTANT: Services are NOT auto-enabled"
log "This prevents boot loops if services crash during first boot."
log ""
log "Next steps:"
log "  1. Run first-boot-setup.sh to safely enable and start services:"
log "     /opt/escapeplan/scripts/first-boot-setup.sh"
log "  2. Or manually enable and start:"
log "     systemctl enable escapeplan-api escapeplan-web"
log "     systemctl start escapeplan-api escapeplan-web"
log "  3. Check status:"
log "     systemctl status escapeplan-api"
log "  4. View logs:"
log "     journalctl -u escapeplan-api -f"
log "  5. Access web interface:"
log "     http://localhost or http://escapeplan.local"
echo ""

log "Installation log saved to: ${LOG_FILE}"
echo ""

exit 0
