#!/bin/bash
set -euo pipefail

# Get version from VERSION file
VERSION=$(cat VERSION | tr -d '\n')
ARCH="arm64"
PKG_NAME="escapeplan"
BUILD_DIR="build/deb"
DIST_DIR="dist"

# Ensure required pieces are present before packaging.
if [ ! -d "packages/contracts/dist" ]; then
    echo "Contracts dist artifacts not found. Run pnpm --filter @escapeplan/contracts build first." >&2
    exit 1
fi

# Validate that critical runtime files exist in contracts dist/
REQUIRED_CONTRACTS_FILES=(
    "packages/contracts/dist/runtime.js"
    "packages/contracts/dist/runtime.d.ts"
    "packages/contracts/dist/validation.js"
    "packages/contracts/dist/validation.d.ts"
    "packages/contracts/dist/index.js"
    "packages/contracts/dist/index.d.ts"
    "packages/contracts/dist/paths.js"
    "packages/contracts/dist/paths.d.ts"
)

for file in "${REQUIRED_CONTRACTS_FILES[@]}"; do
    if [ ! -f "${file}" ]; then
        echo "Required contracts file missing: ${file}" >&2
        echo "Run: pnpm --filter @escapeplan/contracts build" >&2
        exit 1
    fi
done

echo "Contracts dist validation passed - all required files present."

resolve_pnpm_module() {
    # Locate an actual module directory inside .pnpm for a given dependency.
    local node_modules_root="$1"
    local module_name="$2"
    local pnpm_root="${node_modules_root}/.pnpm"
    if [ ! -d "${pnpm_root}" ]; then
        echo "Unable to locate .pnpm directory in ${node_modules_root}" >&2
        return 1
    fi

    local match
    match=$(find "${pnpm_root}" -maxdepth 1 -type d -name "${module_name}@*" | sort | head -n1 || true)
    if [ -z "${match}" ]; then
        echo "Unable to resolve ${module_name} within ${pnpm_root}" >&2
        return 1
    fi

    local module_path="${match}/node_modules/${module_name}"
    if [ ! -d "${module_path}" ]; then
        echo "Resolved path ${module_path} for ${module_name} is missing" >&2
        return 1
    fi

    echo "${module_path}"
}

create_relative_symlink() {
    # Create or refresh a symlink using a relative path to keep the .deb relocatable.
    local target_path="$1"
    local source_path="$2"

    mkdir -p "$(dirname "${target_path}")"
    local relative_source
    relative_source=$(realpath --relative-to="$(dirname "${target_path}")" "${source_path}")
    ln -sfn "${relative_source}" "${target_path}"
}

prepare_contracts_package() {
    # Copy contracts dist output and repair dependency links for a given deployment root.
    local deploy_root="$1"
    local node_modules_root="${deploy_root}/node_modules"
    local contracts_root="${node_modules_root}/@escapeplan/contracts"

    rm -rf "${contracts_root}"
    mkdir -p "${contracts_root}/dist"
    cp -r packages/contracts/dist/. "${contracts_root}/dist/"
    cp packages/contracts/package.json "${contracts_root}/"
    mkdir -p "${contracts_root}/node_modules"

    # Validate that all required runtime files were copied successfully
    local required_files=(
        "runtime.js"
        "runtime.d.ts"
        "validation.js"
        "validation.d.ts"
        "index.js"
        "index.d.ts"
        "paths.js"
        "paths.d.ts"
    )

    for file in "${required_files[@]}"; do
        if [ ! -f "${contracts_root}/dist/${file}" ]; then
            echo "CRITICAL: Failed to copy ${file} to ${contracts_root}/dist/" >&2
            echo "Source file exists: $([ -f "packages/contracts/dist/${file}" ] && echo "yes" || echo "no")" >&2
            exit 1
        fi
    done

    echo "Contracts package prepared at ${contracts_root} - all required files verified."

    local dependency
    for dependency in drizzle-zod drizzle-orm zod; do
        local resolved_path
        resolved_path=$(resolve_pnpm_module "${node_modules_root}" "${dependency}") || exit 1
        create_relative_symlink "${node_modules_root}/${dependency}" "${resolved_path}"
        create_relative_symlink "${contracts_root}/node_modules/${dependency}" "${resolved_path}"
    done
}

echo "Building ${PKG_NAME} v${VERSION} for ${ARCH}..."

# Clean previous builds
rm -rf "${BUILD_DIR}" "${DIST_DIR}"
mkdir -p "${BUILD_DIR}/DEBIAN" "${DIST_DIR}"

# Create package structure
mkdir -p "${BUILD_DIR}/opt/escapeplan/api"
mkdir -p "${BUILD_DIR}/opt/escapeplan/web"
mkdir -p "${BUILD_DIR}/etc/systemd/system"
mkdir -p "${BUILD_DIR}/etc/escapeplan"
mkdir -p "${BUILD_DIR}/etc/nginx/sites-available"

# Use pnpm deploy to create production node_modules with real files (no symlinks)
echo "Deploying production dependencies for API..."
pnpm --filter escapeplan-api deploy --prod --legacy "${BUILD_DIR}/opt/escapeplan/api"

echo "Deploying production dependencies for Web..."
pnpm --filter escapeplan-web deploy --prod --legacy "${BUILD_DIR}/opt/escapeplan/web"

# Copy built files over the deployed structure
echo "Copying built API files..."
cp -r apps/escapeplan-api/dist/* "${BUILD_DIR}/opt/escapeplan/api/"

echo "Copying built Web files..."
cp -r apps/escapeplan-web/.svelte-kit "${BUILD_DIR}/opt/escapeplan/web/"

# Replace workspace contracts with actual built content
echo "Replacing contracts workspace dependency with built files..."
prepare_contracts_package "${BUILD_DIR}/opt/escapeplan/api"
prepare_contracts_package "${BUILD_DIR}/opt/escapeplan/web"

# Copy utility scripts
echo "Adding utility scripts to package..."
mkdir -p "${BUILD_DIR}/opt/escapeplan/scripts"
cp scripts/pi-post-install.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/postinst-orchestrator.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/health-check.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/validate-dependencies.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp apps/escapeplan-api/scripts/backup.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp apps/escapeplan-api/scripts/backup.ts "${BUILD_DIR}/opt/escapeplan/scripts/"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/pi-post-install.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/postinst-orchestrator.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/health-check.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/validate-dependencies.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/backup.sh"

# Create environment file templates
cat > "${BUILD_DIR}/etc/escapeplan/api.env.example" << 'EOF'
# EscapePlan API Environment Configuration
# Copy this file to api.env and customize as needed
# Usage: cp /etc/escapeplan/api.env.example /etc/escapeplan/api.env

# Node environment
NODE_ENV=production

# API server port
PORT=4000

# Database path
ESCAPEPLAN_DB_PATH=/var/lib/escapeplan/escapeplan.db

# Better Auth secret (CHANGE THIS!)
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=CHANGE_ME_GENERATE_RANDOM_SECRET

# Better Auth URL (update for production)
BETTER_AUTH_URL=http://localhost:4000

# Logging configuration
LOG_LEVEL=info
LOG_DIR=/var/log/escapeplan

# Backup configuration
BACKUP_DIR=/var/backups/escapeplan
EOF

cat > "${BUILD_DIR}/etc/escapeplan/web.env.example" << 'EOF'
# EscapePlan Web Environment Configuration
# Copy this file to web.env and customize as needed
# Usage: cp /etc/escapeplan/web.env.example /etc/escapeplan/web.env

# Node environment
NODE_ENV=production

# Web server port
PORT=3000

# Origin URL (update for production domain)
ORIGIN=http://localhost:3000

# API server URL for server-side requests
API_URL=http://localhost:4000
EOF

# Create systemd service files
cat > "${BUILD_DIR}/etc/systemd/system/escapeplan-api.service" << 'EOF'
[Unit]
Description=EscapePlan Fastify API
After=network.target
ConditionPathExists=/opt/escapeplan/api/systemd/start.sh
ConditionPathExists=/var/lib/escapeplan/.db-initialized

[Service]
Type=simple
User=escapeplan
Group=escapeplan
EnvironmentFile=-/etc/escapeplan/api.env
WorkingDirectory=/opt/escapeplan/api
ExecStartPre=/bin/bash -c 'while [ ! -f /var/lib/escapeplan/.db-initialized ]; do sleep 1; done'
ExecStart=/opt/escapeplan/api/systemd/start.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=escapeplan-api

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/escapeplan /var/log/escapeplan /tmp

[Install]
WantedBy=multi-user.target
EOF

cat > "${BUILD_DIR}/etc/systemd/system/escapeplan-web.service" << 'EOF'
[Unit]
Description=EscapePlan SvelteKit Web Frontend
After=escapeplan-api.service
ConditionPathExists=/opt/escapeplan/web/systemd/start.sh

[Service]
Type=simple
User=escapeplan
Group=escapeplan
EnvironmentFile=-/etc/escapeplan/web.env
WorkingDirectory=/opt/escapeplan/web
ExecStart=/opt/escapeplan/web/systemd/start.sh
Restart=always
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=escapeplan-web

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/escapeplan /var/log/escapeplan /tmp

[Install]
WantedBy=multi-user.target
EOF

# Copy backup systemd units from scripts directory
echo "Adding backup systemd units to package..."
cp scripts/systemd/escapeplan-backup.service "${BUILD_DIR}/etc/systemd/system/"
cp scripts/systemd/escapeplan-backup.timer "${BUILD_DIR}/etc/systemd/system/"
cp scripts/systemd/escapeplan-backup-notify@.service "${BUILD_DIR}/etc/systemd/system/"

# Copy nginx configuration
echo "Adding nginx reverse proxy configuration to package..."
cp scripts/nginx/escapeplan.conf "${BUILD_DIR}/etc/nginx/sites-available/"

# Create control file
cat > "${BUILD_DIR}/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${ARCH}
Depends: nodejs (>= 20), nginx, sqlite3
Recommends: build-essential, python3
Maintainer: EscapePlan Team
Description: Offline-first escape room management system
 EscapePlan is a complete escape room management solution
 designed for Raspberry Pi deployments. Native ARM64 modules
 will be rebuilt automatically if build tools are available.
EOF

# Create postinst script that delegates to the orchestrator
cat > "${BUILD_DIR}/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Logging helpers
LOG_FILE="${LOG_FILE:-/tmp/escapeplan-install.log}"

log() {
    echo "[postinst] $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo "[postinst] ERROR: $1" >&2 | tee -a "${LOG_FILE}"
}

resolve_pnpm_module() {
    local node_modules_root="$1"
    local module_name="$2"
    local pnpm_root="${node_modules_root}/.pnpm"
    if [ ! -d "${pnpm_root}" ]; then
        echo "[postinst] Missing .pnpm directory at ${pnpm_root}" >&2
        return 1
    fi

    local match
    match=$(find "${pnpm_root}" -maxdepth 1 -type d -name "${module_name}@*" | sort | head -n1 || true)
    if [ -z "${match}" ]; then
        echo "[postinst] Failed to resolve ${module_name} inside ${pnpm_root}" >&2
        return 1
    fi

    local module_path="${match}/node_modules/${module_name}"
    if [ ! -d "${module_path}" ]; then
        echo "[postinst] Resolved module path ${module_path} missing for ${module_name}" >&2
        return 1
    fi

    echo "${module_path}"
}

create_relative_symlink() {
    local target_path="$1"
    local source_path="$2"

    mkdir -p "$(dirname "${target_path}")"
    local relative_source
    relative_source=$(realpath --relative-to="$(dirname "${target_path}")" "${source_path}")
    ln -sfn "${relative_source}" "${target_path}"
}

repair_contracts_dependencies() {
    local install_root="$1"
    local node_modules_root="${install_root}/node_modules"
    local contracts_root="${node_modules_root}/@escapeplan/contracts"

    if [ ! -d "${contracts_root}" ]; then
        echo "[postinst] Contracts package missing at ${contracts_root}" >&2
        return 1
    fi

    mkdir -p "${contracts_root}/node_modules"

    local dependency
    for dependency in drizzle-zod drizzle-orm zod; do
        echo "[postinst] Ensuring ${dependency} is linked for ${install_root}"
        local resolved_path
        resolved_path=$(resolve_pnpm_module "${node_modules_root}" "${dependency}") || return 1
        create_relative_symlink "${node_modules_root}/${dependency}" "${resolved_path}"
        create_relative_symlink "${contracts_root}/node_modules/${dependency}" "${resolved_path}"
    done

    return 0
}

log "EscapePlan package installation starting..."

# Create escapeplan user if doesn't exist
if ! id escapeplan &>/dev/null; then
    log "Creating escapeplan system user..."
    useradd -r -s /bin/false escapeplan
    log "✓ System user created"
else
    log "✓ System user already exists"
fi

# Create required data directories
log "Creating data directories..."
mkdir -p /var/lib/escapeplan
mkdir -p /var/log/escapeplan
mkdir -p /etc/escapeplan
mkdir -p /var/backups/escapeplan

# Set ownership (node_modules already bundled in package)
log "Setting directory ownership..."
chown -R escapeplan:escapeplan /opt/escapeplan
chown -R escapeplan:escapeplan /var/lib/escapeplan
chown -R escapeplan:escapeplan /var/log/escapeplan
chown -R escapeplan:escapeplan /etc/escapeplan
chown -R escapeplan:escapeplan /var/backups/escapeplan

# Repair contracts dependencies (critical for package installation)
log "Repairing pnpm symlinks for contracts dependencies..."
if ! repair_contracts_dependencies "/opt/escapeplan/api"; then
    log_error "Failed to repair API contracts dependencies"
    exit 1
fi

if ! repair_contracts_dependencies "/opt/escapeplan/web"; then
    log_error "Failed to repair Web contracts dependencies"
    exit 1
fi

log "✓ Contracts dependencies repaired successfully"

# Configure nginx reverse proxy
log "Configuring nginx reverse proxy..."
ln -sf /etc/nginx/sites-available/escapeplan /etc/nginx/sites-enabled/escapeplan
rm -f /etc/nginx/sites-enabled/default
log "✓ Nginx configuration installed"

log "Package installation complete. Running orchestrator for system configuration..."
log ""

# Call the orchestrator script to handle all post-installation steps
if [ -f /opt/escapeplan/scripts/postinst-orchestrator.sh ]; then
    if /opt/escapeplan/scripts/postinst-orchestrator.sh /opt/escapeplan; then
        log ""
        log "✓ EscapePlan installation and configuration complete!"
        log ""
        log "Services have been enabled but not started."
        log "To start services, run:"
        log "  systemctl start escapeplan-api escapeplan-web"
        log ""
        log "Check installation status with:"
        log "  /opt/escapeplan/scripts/health-check.sh"
        log ""
        log "View installation log at: /tmp/escapeplan-postinst.log"
    else
        log_error "Orchestrator script failed - installation may be incomplete"
        log_error "Check logs at: /tmp/escapeplan-postinst.log"
        exit 1
    fi
else
    log_error "Orchestrator script not found at /opt/escapeplan/scripts/postinst-orchestrator.sh"
    log_error "Package may be corrupted or incomplete"
    exit 1
fi
EOF

chmod 755 "${BUILD_DIR}/DEBIAN/postinst"

# Build .deb package
DEB_FILE="${DIST_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build "${BUILD_DIR}" "${DEB_FILE}"

echo "✅ Built: ${DEB_FILE}"
echo "📦 $(du -h ${DEB_FILE} | cut -f1)"
