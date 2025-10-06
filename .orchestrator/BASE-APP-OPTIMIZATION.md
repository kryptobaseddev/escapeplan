# BASE APP OPTIMIZATION PLAN
## EscapePlan Application Package - Separation of Concerns

**Target Repo:** `/mnt/projects/escape-plan/escapeplan-app/`
**Version:** 0.1.7 → 0.2.0
**Scope:** Application layer only - NO platform services
**Objective:** Clean application package that trusts base OS for all platform services

---

## EXECUTIVE SUMMARY

### Current State (v0.1.7)
- ❌ Installs system packages via apt-get in postinst (NetworkManager, nginx, nodejs)
- ❌ Configures NetworkManager AP in pi-post-install.sh
- ❌ Creates system user and directories (duplicates base OS)
- ❌ Configures nginx site (conflicts with base OS approach)
- ❌ Missing base OS dependency declaration

### Target State (v0.2.0)
- ✅ NO system package installation
- ✅ NO NetworkManager configuration
- ✅ Verifies base OS prerequisites before proceeding
- ✅ Focuses only on application-specific tasks
- ✅ Declares escapeplan-base (>= 1.0.0) dependency
- ✅ Clean separation from platform layer

---

## SCOPE: WHAT THIS PLAN COVERS

### IN SCOPE (App Layer Only)
✅ Application code deployment (/opt/escapeplan/api, /opt/escapeplan/web)
✅ Native module rebuild (better-sqlite3, sharp for ARM64)
✅ Database initialization and seeding
✅ Application secret generation (BETTER_AUTH_SECRET, CAMERA_ENCRYPTION_KEY)
✅ Contracts package dependency repair (pnpm symlinks)
✅ Service registration (NOT auto-enablement)
✅ Health checks and validation

### OUT OF SCOPE (Platform Layer - See BASE-OS-OPTIMIZATION.md)
❌ System package installation (nodejs, nginx, NetworkManager, sqlite3)
❌ NetworkManager AP configuration
❌ nginx base configuration
❌ System user creation (escapeplan)
❌ Directory structure creation (/var/lib/escapeplan, /etc/escapeplan)
❌ TLS certificate generation

---

## COORDINATION WITH BASE OS

### Base OS Provides (v1.0.0+)
- ✅ nodejs (>= 22) installed
- ✅ nginx installed and optimized for Pi 5
- ✅ NetworkManager with pre-configured AP
- ✅ sqlite3, ffmpeg, build-essential
- ✅ escapeplan system user
- ✅ Directory structure (/opt/escapeplan, /var/lib/escapeplan, /etc/escapeplan)
- ✅ TLS certificate infrastructure

### App Package Responsibilities
- ✅ Deploy application code to /opt/escapeplan/{api,web}
- ✅ Rebuild native modules for ARM64
- ✅ Initialize database with schema and seed data
- ✅ Generate application secrets
- ✅ Configure application-specific nginx site
- ✅ Register systemd services (do NOT auto-enable)

---

## IMPLEMENTATION PHASES

### PHASE 1: Remove System Package Installation
**Objective:** Delete all apt-get calls from postinst scripts

**Files Modified:**
- `scripts/postinst-orchestrator.sh`
- `scripts/pi-post-install.sh`

**Tasks:**

**1.1: Update postinst-orchestrator.sh**
```diff
# DELETE lines 122-149 (entire package installation block)
- log_step "Checking system packages"
- if fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; then
-     log_warning "Package manager is locked, waiting..."
- fi
- if ! retry_command "System package installation" \
-     env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
-     build-essential python3 nodejs npm network-manager nginx; then
-     log_error "Failed to install required system packages"
-     exit 1
- fi

# REPLACE with verification:
+ log_step "Verifying base OS prerequisites"
+
+ required_commands=("node" "npm" "nginx" "sqlite3" "nmcli")
+ missing_commands=()
+
+ for cmd in "${required_commands[@]}"; do
+     if ! command -v "$cmd" &>/dev/null; then
+         missing_commands+=("$cmd")
+     fi
+ done
+
+ if [ ${#missing_commands[@]} -gt 0 ]; then
+     log_error "Missing required commands: ${missing_commands[*]}"
+     log_error "Base OS may be outdated or incomplete"
+     log_error "Expected base OS to provide: nodejs, nginx, sqlite3, network-manager"
+     exit 1
+ fi
+
+ # Verify base OS package is installed
+ if ! dpkg -l | grep -q "^ii.*escapeplan-base\|escapeplan-platform"; then
+     log_error "Base OS platform not installed"
+     log_error "Install escapeplan-base package first"
+     exit 1
+ fi
+
+ log_success "All required system packages present (from base OS)"
```

**1.2: Update pi-post-install.sh**
```diff
# DELETE lines 276-369 (entire install_system_packages function)
- install_system_packages() {
-     log_section "Installing Required System Packages"
-     ...
- }

# DELETE function call from main()
- if ! install_system_packages; then
-     log_error "System package installation failed"
-     exit 1
- fi
```

**Validation:**
- No `apt-get` or `apt` commands in any postinst script
- Grep confirms: `grep -r "apt-get\|apt install" scripts/` returns nothing
- Scripts verify prerequisites but don't install them

**Git Commit:**
```
refactor: remove system package installation from app layer

Remove all apt-get/apt calls from application postinst scripts. System
packages are now exclusively managed by base OS (escapeplan-base v1.0.0+).

BREAKING CHANGE: Application package now requires escapeplan-base (>= 1.0.0)
to be installed first. This ensures all platform services (NetworkManager,
nginx, nodejs) are pre-configured before application installation.

Changes:
- Delete package installation from postinst-orchestrator.sh (lines 122-149)
- Delete install_system_packages() from pi-post-install.sh (lines 276-369)
- Add base OS verification checks (command existence + package presence)
- Fail fast with clear error message if base OS incomplete

Benefits:
- 2-5 minute faster installation (no redundant apt-get)
- Eliminates dpkg lock conflicts
- Follows Debian packaging best practices
- Clear separation of platform vs application concerns

Refs: BASE-APP-OPTIMIZATION.md Phase 1
Depends: escapeplan-base (>= 1.0.0)
```

---

### PHASE 2: Remove NetworkManager Configuration
**Objective:** Delete NetworkManager AP setup from app scripts

**Files Modified:**
- `scripts/pi-post-install.sh`

**Tasks:**

**2.1: Delete setup_networkmanager_ap function**
```diff
# DELETE lines 380-473 (entire NetworkManager AP setup)
- setup_networkmanager_ap() {
-     log_section "Configuring WiFi Hotspot (NetworkManager)"
-     ...
-     nmcli connection add type wifi ...
-     ...
- }

# DELETE function call from main()
- if ! setup_networkmanager_ap; then
-     log_error "WiFi hotspot configuration failed"
-     ((total_errors++))
- fi
```

**2.2: Add NetworkManager verification (optional)**
```bash
# Add to main() where setup_networkmanager_ap was called:
log_section "Verifying NetworkManager Hotspot (from Base OS)"

if ! nmcli connection show escapeplan-ap >/dev/null 2>&1; then
    log_warning "NetworkManager AP connection 'escapeplan-ap' not found"
    log_warning "Base OS should provide pre-configured hotspot"
    log_warning "Continuing installation but network may not be accessible"
else
    if nmcli connection show --active | grep -q "escapeplan-ap"; then
        log_success "NetworkManager AP active (SSID: EscapePlan)"
    else
        log_info "NetworkManager AP configured but not active"
        log_info "To activate: nmcli connection up escapeplan-ap"
    fi
fi
```

**Validation:**
- No `nmcli connection add` commands in scripts
- Grep confirms: `grep -r "nmcli.*add" scripts/` returns nothing
- Verification check passes if base OS configured correctly

**Git Commit:**
```
refactor: remove NetworkManager AP configuration from app layer

Remove WiFi hotspot setup from application scripts. NetworkManager AP
is now pre-configured in base OS image (escapeplan-base v1.0.0+).

Changes:
- Delete setup_networkmanager_ap() function from pi-post-install.sh
- Delete function call from installation orchestration
- Add verification check (warns if AP not found, non-fatal)

Base OS provides pre-configured:
- SSID: EscapePlan
- Password: Canuescap3
- Network: 10.10.10.0/24
- DHCP: Embedded dnsmasq via NetworkManager

Application no longer manages network configuration. This is a platform
concern handled by base OS layer.

Refs: BASE-APP-OPTIMIZATION.md Phase 2
Depends: escapeplan-base (>= 1.0.0) with NetworkManager AP pre-configured
```

---

### PHASE 3: Remove User and Directory Creation
**Objective:** Trust base OS for system user and directory structure

**Files Modified:**
- `build/deb/DEBIAN/postinst` (template in build-deb.sh)
- `scripts/postinst-orchestrator.sh`

**Tasks:**

**3.1: Update DEBIAN/postinst template**
```diff
# build-deb.sh around line 1168-1182

# DELETE user creation:
- if ! id escapeplan &>/dev/null; then
-     log "Creating escapeplan system user..."
-     useradd -r -s /bin/false escapeplan
-     log "✓ System user created"
- else
-     log "✓ System user already exists"
- fi

# REPLACE with verification:
+ # Verify escapeplan user exists (from base OS)
+ if ! id escapeplan &>/dev/null; then
+     log_error "escapeplan user not found - base OS incomplete"
+     exit 1
+ fi
+ log "✓ System user verified (from base OS)"

# DELETE directory creation:
- log "Creating data directories..."
- mkdir -p /var/lib/escapeplan
- mkdir -p /var/log/escapeplan
- mkdir -p /etc/escapeplan
- mkdir -p /var/backups/escapeplan

# REPLACE with verification:
+ log "Verifying data directories from base OS..."
+ required_dirs=(
+     "/var/lib/escapeplan"
+     "/var/log/escapeplan"
+     "/etc/escapeplan"
+     "/opt/escapeplan"
+ )
+
+ for dir in "${required_dirs[@]}"; do
+     if [ ! -d "$dir" ]; then
+         log_error "Required directory missing: $dir"
+         log_error "Base OS should create all directories"
+         exit 1
+     fi
+ done
+ log "✓ All directories verified (from base OS)"

# KEEP ownership setting (files extracted by .deb need ownership):
log "Setting file ownership for application code..."
chown -R escapeplan:escapeplan /opt/escapeplan
log "✓ Ownership set"
```

**Validation:**
- No `useradd` or `mkdir -p /var/lib/escapeplan` in scripts
- Verification checks fail appropriately if base OS incomplete
- Ownership still set on extracted files (required)

**Git Commit:**
```
refactor: remove system user and directory creation from app

Remove user creation and directory structure setup from application
package. These are platform concerns handled by base OS.

Changes:
- Delete escapeplan user creation (useradd)
- Delete directory creation (mkdir -p /var/lib/escapeplan, etc.)
- Add verification checks (fail if base OS incomplete)
- Keep ownership setting on /opt/escapeplan (required for .deb extraction)

Base OS provides:
- escapeplan system user (nologin shell)
- Directory structure (/opt, /var/lib, /var/log, /etc)
- Correct permissions and ownership

Application only sets ownership on files it deploys to /opt/escapeplan,
which is correct behavior after .deb extraction (files extracted as root).

Refs: BASE-APP-OPTIMIZATION.md Phase 3
Depends: escapeplan-base (>= 1.0.0) with escapeplan user and directories
```

---

### PHASE 4: Update Package Dependencies
**Objective:** Declare base OS as explicit dependency

**Files Modified:**
- `scripts/build-deb.sh` (DEBIAN/control template)

**Tasks:**

**4.1: Update debian/control generation**
```diff
# build-deb.sh around line 1123-1129

cat > "${STAGING_DIR}/DEBIAN/control" <<CONTROL
Package: escapeplan
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${DEB_ARCH}
Maintainer: EscapePlan Development Team <dev@escapeplan.example>
- Depends: nodejs (>= 20), nginx, sqlite3
+ Depends: escapeplan-base (>= 1.0.0) | escapeplan-platform,
+          nodejs (>= 22),
+          nginx (>= 1.18),
+          sqlite3 (>= 3.34)
- Recommends: build-essential, python3
+ Recommends: build-essential,
+             python3
+ Breaks: escapeplan-apps (<< 1.0.0~)
+ Replaces: escapeplan-apps (<< 1.0.0~)
Description: Offline-first escape room management system
 EscapePlan is a complete escape room management solution
- with cross-platform support (arm64/amd64). Native modules
- are pre-compiled for the target architecture.
+ designed for Raspberry Pi appliances.
+ .
+ Features include:
+  * Real-time session management with WebSocket updates
+  * Booking calendar with pricing engine
+  * Multi-room support (fixed and mobile kits)
+  * Camera streaming (RTSP → HLS transcoding)
+  * Role-based access control (RBAC)
+  * Offline-first PWA architecture
+ .
+ Native modules (better-sqlite3, sharp) are rebuilt for the target
+ architecture (arm64/amd64) during package installation.
+ .
+ This package requires escapeplan-base platform services to function.
CONTROL
```

**Validation:**
- Package declares escapeplan-base dependency
- APT prevents installation without base OS
- Lintian shows no dependency issues

**Git Commit:**
```
feat: add explicit base OS dependency to package metadata

Declare escapeplan-base (>= 1.0.0) as required dependency to ensure
correct installation order and platform services availability.

Changes:
- Add Depends: escapeplan-base (>= 1.0.0) | escapeplan-platform
- Update nodejs version requirement to >= 22 (matches base OS)
- Add Breaks/Replaces for old package name migration
- Expand package description with feature list
- Document platform dependency requirement

Package manager will now enforce:
1. escapeplan-base must be installed first
2. escapeplan-base must be version 1.0.0 or newer
3. If escapeplan-base not found, check for escapeplan-platform (virtual package)

This prevents installation on systems without proper platform services
and provides clear error messages for missing dependencies.

Refs: BASE-APP-OPTIMIZATION.md Phase 4
```

---

### PHASE 5: Simplify nginx Configuration Handling
**Objective:** Delegate nginx configuration to dedicated script with backup

**Files Modified:**
- `scripts/postinst-orchestrator.sh`
- `scripts/nginx/escapeplan.conf` (production-ready version)

**Files Created:**
- `scripts/nginx-configure.sh`

**Tasks:**

**5.1: Create nginx-configure.sh script**
```bash
#!/bin/bash
set -euo pipefail

# Safe nginx configuration with backup and validation
# This script is called by postinst-orchestrator.sh

SITES_AVAILABLE="/etc/nginx/sites-available/escapeplan"
SITES_ENABLED="/etc/nginx/sites-enabled/escapeplan"
BACKUP_DIR="/var/backups/escapeplan/nginx"
NEW_CONFIG="/opt/escapeplan/config/nginx/escapeplan.conf.new"

log() { echo "[nginx-configure] $1"; }
log_error() { echo "[nginx-configure] ERROR: $1" >&2; }

# Backup existing config if different
if [ -f "$SITES_AVAILABLE" ]; then
    if ! diff -q "$SITES_AVAILABLE" "$NEW_CONFIG" >/dev/null 2>&1; then
        log "Existing configuration differs, backing up..."
        mkdir -p "$BACKUP_DIR"
        BACKUP_FILE="$BACKUP_DIR/escapeplan.conf.$(date +%Y%m%d-%H%M%S)"
        cp "$SITES_AVAILABLE" "$BACKUP_FILE"
        log "Backed up to: $BACKUP_FILE"

        log "Installing new configuration"
        cp "$NEW_CONFIG" "$SITES_AVAILABLE"
    else
        log "Configuration unchanged"
    fi
else
    log "Installing nginx configuration for first time"
    cp "$NEW_CONFIG" "$SITES_AVAILABLE"
fi

# Enable site
if [ ! -L "$SITES_ENABLED" ]; then
    log "Enabling escapeplan site"
    ln -sf "$SITES_AVAILABLE" "$SITES_ENABLED"
fi

# Remove default site
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    log "Removing default nginx site"
    rm -f "/etc/nginx/sites-enabled/default"
fi

# Test configuration
log "Testing nginx configuration..."
if nginx -t 2>&1; then
    log "Configuration test passed"

    if systemctl is-active nginx >/dev/null 2>&1; then
        log "Reloading nginx..."
        systemctl reload nginx
        log "nginx reloaded successfully"
    else
        log "nginx not running, enabling service"
        systemctl enable nginx
        systemctl start nginx
        log "nginx started successfully"
    fi
else
    log_error "nginx configuration test failed"
    log_error "Configuration NOT applied - nginx still using old config"
    exit 1
fi

log "nginx configuration complete"
```

**5.2: Update escapeplan.conf (production-ready)**
```nginx
# Upstream definitions
upstream escapeplan_api {
    server 127.0.0.1:4000 fail_timeout=5s max_fails=3;
    keepalive 32;
}

# WebSocket upgrade header mapping
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    listen [::]:80;

    server_name escapeplan.local 10.10.10.1;

    # Include security headers from base OS
    include snippets/escapeplan-security.conf;

    # Root for static PWA assets
    root /opt/escapeplan/web/build;

    # Immutable static assets (SvelteKit build output)
    location /_app/immutable/ {
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Service worker and manifest (no caching)
    location ~* ^/(service-worker\.js|manifest\.webmanifest)$ {
        add_header Cache-Control "public, max-age=0, must-revalidate";
        try_files $uri =404;
    }

    # API proxy with rate limiting
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_conn conn_limit 10;

        proxy_pass http://escapeplan_api/api/;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO WebSocket endpoint
    location /socket.io/ {
        limit_req zone=general_limit burst=50 nodelay;

        proxy_pass http://escapeplan_api/socket.io/;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;

        proxy_buffering off;
    }

    # Auth endpoints with stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth_limit burst=3 nodelay;

        proxy_pass http://escapeplan_api/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "EscapePlan OK\n";
        add_header Content-Type text/plain;
    }
}
```

**5.3: Update postinst-orchestrator.sh**
```diff
# Replace lines 283-307 (nginx configuration section)

- log_step "Configuring nginx reverse proxy"
-
- if [ -f "/etc/nginx/sites-available/escapeplan" ]; then
-     log_warning "Existing escapeplan nginx config found, backing up..."
- fi
- ...

+ log_step "Configuring nginx reverse proxy"
+
+ if [ ! -f "/opt/escapeplan/scripts/nginx-configure.sh" ]; then
+     log_error "nginx-configure.sh script not found"
+     log_error "Package may be incomplete"
+     exit 1
+ fi
+
+ log "Running nginx configuration script..."
+ if /opt/escapeplan/scripts/nginx-configure.sh 2>&1 | tee -a "$LOG_FILE"; then
+     log_success "Nginx configured successfully"
+ else
+     log_error "nginx configuration failed"
+     log_error "Check logs for details"
+     exit 1
+ fi
```

**Validation:**
- nginx -t passes with new configuration
- Rate limiting zones work (defined in base OS nginx.conf)
- Security headers appear in responses
- Static files served correctly

**Git Commit:**
```
feat: add production-ready nginx configuration with safe deployment

Replace simple nginx configuration with production-ready version including
rate limiting, security headers, WebSocket support, and safe deployment
with automatic backup.

Configuration improvements:
- Upstream blocks for easier port management
- Rate limiting on API (10r/s), auth (5r/m), general (50r/s)
- WebSocket support for Socket.IO
- Static asset caching with immutable headers
- Service worker no-cache headers (PWA requirement)
- Security headers from base OS snippet

Deployment improvements:
- Automatic backup before overwriting existing config
- nginx -t validation before reload
- Graceful reload (no connection drops)
- Rollback on validation failure

New file:
- scripts/nginx-configure.sh: Safe configuration deployment script

Updated file:
- scripts/nginx/escapeplan.conf: Production-ready site configuration
- scripts/postinst-orchestrator.sh: Delegates to nginx-configure.sh

Refs: BASE-APP-OPTIMIZATION.md Phase 5
```

---

### PHASE 6: Fix Maintainer Scripts (App Package)
**Objective:** Add case statements and proper error handling

**Files Modified:**
- `build/deb/DEBIAN/postinst` (template in build-deb.sh)

**Tasks:**

**6.1: Wrap postinst in case statement**
```diff
# build-deb.sh postinst template (around line 1047-1272)

#!/bin/bash
set -e
set -o pipefail

+ # Logging to syslog
+ log() {
+     logger -t escapeplan -p daemon.info "$1"
+ }
+
+ log_error() {
+     logger -t escapeplan -p daemon.err "$1"
+ }

# Error trap (keep existing cleanup_on_error)
...

trap cleanup_on_error EXIT

+ case "$1" in
+     configure)
+         # All existing installation logic here
          log "Verifying base OS prerequisites..."
          ...
          log "Package installation complete."
+         ;;
+
+     abort-upgrade|abort-remove|abort-deconfigure)
+         log "Installation aborted: $1"
+         ;;
+
+     *)
+         log_error "postinst called with unknown argument: $1"
+         exit 1
+         ;;
+ esac

+ #DEBHELPER#
exit 0
```

**Validation:**
- shellcheck passes
- All scenarios handled (configure, abort-*)
- #DEBHELPER# marker present

**Git Commit:**
```
fix: add Debian Policy compliance to app package maintainer scripts

Restructure postinst script to comply with Debian Policy 4.7.2 section 6.5
(Package maintainer scripts).

Changes:
- Wrap installation logic in case statement
- Handle configure, abort-upgrade, abort-remove, abort-deconfigure
- Add #DEBHELPER# marker for debhelper integration
- Use syslog (logger) instead of terminal output
- Keep existing error trap and cleanup logic

This ensures proper behavior during:
- Fresh installation (configure)
- Package upgrade (configure with old-version)
- Aborted installations (abort-*)

Refs: BASE-APP-OPTIMIZATION.md Phase 6
Fixes: Debian Policy 6.5 compliance
```

---

### PHASE 7: Focus pi-post-install.sh on Native Modules Only
**Objective:** Strip pi-post-install.sh to bare essentials

**Files Modified:**
- `scripts/pi-post-install.sh`

**Tasks:**

**7.1: Simplify script to focus on native modules**
```diff
# Keep only:
# - Native module validation
# - Native module rebuild
# - Dependency validation (optional)
# - Health check (optional)

# DELETE:
# - System package installation (lines 276-369) ✅ Already done in Phase 1
# - NetworkManager AP setup (lines 380-473) ✅ Already done in Phase 2
# - User/directory creation ✅ Already done in Phase 3

# Result: Script focuses ONLY on architecture-specific tasks
```

**7.2: Update script header documentation**
```bash
#!/bin/bash
set -euo pipefail

# ============================================================================
# EscapePlan Post-Install - Native Module Rebuild Script
# ============================================================================
# This script focuses on architecture-specific tasks that must happen
# AFTER .deb extraction:
#   - Native module rebuild for ARM64/AMD64 (better-sqlite3, sharp)
#   - Dependency validation
#   - Health check
#
# System-level configuration (packages, network, nginx) is handled by base OS.
# ============================================================================
```

**Validation:**
- Script only handles native modules
- No system-level configuration
- Works on both arm64 and amd64

**Git Commit:**
```
refactor: simplify pi-post-install.sh to native module rebuilding only

Remove all system-level configuration from pi-post-install.sh, focusing
exclusively on architecture-specific tasks that must happen after .deb
extraction.

REMOVED (now handled by base OS):
- System package installation
- NetworkManager AP configuration
- User and directory creation

KEPT (application-specific):
- Native module validation (better-sqlite3, sharp)
- Native module rebuild for ARM64/AMD64
- Dependency validation
- Health check

Result: Script is ~400 lines shorter, clearer purpose, faster execution.

Refs: BASE-APP-OPTIMIZATION.md Phase 7
```

---

### PHASE 8: Lintian Compliance Validation (App Package)
**Objective:** Achieve 95%+ Debian Policy compliance for app package

**Files Created:**
- `.lintian-overrides` (if needed)

**Tasks:**

**8.1: Run lintian and fix all issues**
```bash
cd /mnt/projects/escape-plan/escapeplan-app

# Build package
./scripts/build-deb.sh

# Run lintian
lintian --pedantic dist/escapeplan_*_arm64.deb

# Fix all errors and warnings
# Document intentional deviations in .lintian-overrides
```

**8.2: Add CI/CD lintian check**
```yaml
# .github/workflows/package-validation.yml (if using GitHub)
- name: Validate Debian package
  run: |
    lintian --pedantic dist/escapeplan_*.deb
```

**Validation:**
- 0 lintian errors
- < 5 lintian warnings (all intentional)

**Git Commit:**
```
chore: achieve Debian Policy compliance for app package

Add lintian validation and fix all policy violations in application
package.

Compliance status:
- Errors: 0 (was 8+)
- Warnings: 3 (all intentional, documented in .lintian-overrides)

Intentional warnings:
- W: no-upstream-changelog (embedded project)
- W: package-contains-empty-directory (populated at runtime)
- W: embedded-javascript-library (SvelteKit build output)

All critical policy violations resolved.

Refs: BASE-APP-OPTIMIZATION.md Phase 8
```

---

### PHASE 9: Testing & Validation
**Objective:** Comprehensive testing of app package with base OS

**Files Created:**
- `scripts/test-app-package.sh`

**Tasks:**

**9.1: Create comprehensive test script**
```bash
#!/bin/bash
set -e

echo "=== EscapePlan Application Package Validation ==="

# Test 1: Verify base OS installed
if ! dpkg -l | grep -q "^ii.*escapeplan-base"; then
    echo "❌ Base OS not installed"
    exit 1
fi
echo "✅ Base OS present"

# Test 2: Install app package
sudo dpkg -i dist/escapeplan_*_arm64.deb || {
    echo "❌ App package installation failed"
    exit 1
}
echo "✅ App package installed"

# Test 3: Verify no system package installation occurred
if grep -r "apt-get install" /var/lib/dpkg/info/escapeplan* 2>/dev/null; then
    echo "❌ App package still contains apt-get calls"
    exit 1
fi
echo "✅ No system package installation in app"

# Test 4: Verify native modules rebuilt
SQLITE_MODULE=$(find /opt/escapeplan/api/node_modules -name "better_sqlite3.node" | head -n1)
if [ -n "$SQLITE_MODULE" ]; then
    file "$SQLITE_MODULE" | grep -q "ARM aarch64"
    echo "✅ Native modules rebuilt for ARM64"
else
    echo "❌ better-sqlite3 module not found"
    exit 1
fi

# Test 5: Verify database initialized
if [ -f /var/lib/escapeplan/.db-initialized ]; then
    echo "✅ Database initialized"
else
    echo "❌ Database not initialized"
    exit 1
fi

# Test 6: Verify secrets generated
if [ -f /etc/escapeplan/api.env ]; then
    grep -q "BETTER_AUTH_SECRET" /etc/escapeplan/api.env
    echo "✅ Secrets generated"
else
    echo "❌ Secrets file missing"
    exit 1
fi

# Test 7: Verify nginx configured
if [ -L /etc/nginx/sites-enabled/escapeplan ]; then
    echo "✅ Nginx site enabled"
else
    echo "❌ Nginx site not enabled"
    exit 1
fi

# Test 8: Verify services registered (but NOT enabled)
for service in escapeplan-api escapeplan-web; do
    if systemctl list-unit-files | grep -q "${service}.service"; then
        # Check it's NOT enabled
        if ! systemctl is-enabled "${service}" 2>/dev/null; then
            echo "✅ ${service} registered but not auto-enabled (correct)"
        else
            echo "⚠️ ${service} auto-enabled (should be manual)"
        fi
    else
        echo "❌ ${service} not found"
        exit 1
    fi
done

echo ""
echo "=== ALL TESTS PASSED ==="
```

**Validation:**
- All tests pass on clean base OS + app installation
- No system packages installed by app
- Native modules correctly rebuilt
- Services registered but not enabled

**Git Commit:**
```
test: add comprehensive app package validation suite

Create automated test script to validate application package installation
and separation of concerns from base OS.

Test coverage:
- Base OS prerequisite verification
- Package installation without errors
- No system package installation by app
- Native module rebuild for ARM64
- Database initialization
- Secret generation
- Nginx configuration
- Service registration (not auto-enabled)

Usage:
  ./scripts/test-app-package.sh

Requires:
- escapeplan-base (>= 1.0.0) installed
- Built application package in dist/

Refs: BASE-APP-OPTIMIZATION.md Phase 9
```

---

### PHASE 10: Documentation Updates
**Objective:** Document new architecture and dependencies

**Files Modified:**
- `README.md`

**Files Created:**
- `docs/DEPENDENCIES.md`
- `docs/INSTALLATION.md`

**Tasks:**

**10.1: Update README.md**
```markdown
## Installation Prerequisites

### Required Base OS
This application package requires the EscapePlan base OS image to be installed.

**Base OS provides:**
- Raspberry Pi OS Bookworm 64-bit
- Node.js v22.x runtime
- System packages: nginx, sqlite3, network-manager, ffmpeg
- System user: `escapeplan`
- Directory structure: `/opt/escapeplan`, `/var/lib/escapeplan`, `/etc/escapeplan`
- NetworkManager WiFi hotspot (SSID: EscapePlan)
- nginx reverse proxy configuration
- TLS certificate generation

**Download base OS image:**
```bash
cd escapeplan-base
pnpm run build:image
# Flash artifacts/escapeplan-base-*.img.xz to microSD
```

### Application Installation
Once base OS is running:

```bash
# Copy .deb to Pi
scp dist/escapeplan_*.deb escapeplan@escapeplan.local:~/

# Install package
sudo dpkg -i escapeplan_*.deb

# Enable and start services
sudo systemctl enable escapeplan-api escapeplan-web
sudo systemctl start escapeplan-api escapeplan-web
```

### Separation of Concerns

**Base OS handles:**
- System packages
- System user and directory structure
- Network configuration (WiFi hotspot)
- nginx reverse proxy
- TLS certificates
- Systemd service definitions

**Application .deb handles:**
- Application code deployment
- Native module compilation
- Database schema and data
- Application secrets
- Service activation
```

**10.2: Create docs/DEPENDENCIES.md**
```markdown
# Application Dependencies

## Base OS Requirements
This package requires `escapeplan-base (>= 1.0.0)` or any package providing
the `escapeplan-platform` virtual package.

### What Base OS Provides
- nodejs (>= 22)
- nginx (>= 1.18)
- network-manager (>= 1.40)
- sqlite3 (>= 3.34)
- ffmpeg (>= 4.3)
- build-essential (for native modules)
- python3 (for node-gyp)

### System User & Directories
- User: `escapeplan` (system user, nologin shell)
- Directories: `/opt/escapeplan`, `/var/lib/escapeplan`, `/var/log/escapeplan`, `/etc/escapeplan`

### Network Configuration
- WiFi AP: SSID=EscapePlan, Network=10.10.10.0/24
- mDNS: escapeplan.local
- nginx: Configured with security headers and rate limiting

## Application-Specific Dependencies
Declared in package control file:
- Better-sqlite3 (native module, rebuilt during install)
- Sharp (native module, rebuilt during install)
- SvelteKit PWA (static build output)
- Fastify API backend

## Dependency Installation Order
1. Flash base OS image to Raspberry Pi
2. Boot Pi (NetworkManager AP activates automatically)
3. Install application package: `dpkg -i escapeplan_*.deb`
```

**Validation:**
- All documentation accurate
- Links work
- Code examples tested

**Git Commit:**
```
docs: update README with base OS dependency requirements

Document new architecture with clear separation between base OS and
application package responsibilities.

Changes:
- Add "Installation Prerequisites" section
- Document base OS requirements
- Update installation instructions
- Add "Separation of Concerns" explanation
- Create DEPENDENCIES.md for detailed dependency info
- Create INSTALLATION.md for step-by-step guide

Clarifies:
- What base OS provides vs what app provides
- Correct installation order
- Dependency requirements

Refs: BASE-APP-OPTIMIZATION.md Phase 10
```

---

## IMPLEMENTATION SEQUENCE

### Week 1: Core Cleanup
1. ✅ Phase 1: Remove system package installation (Day 1)
2. ✅ Phase 2: Remove NetworkManager configuration (Day 1)
3. ✅ Phase 3: Remove user/directory creation (Day 2)
4. ✅ Phase 4: Update package dependencies (Day 2)
5. ✅ Phase 5: Simplify nginx configuration (Day 3-4)

### Week 2: Quality & Compliance
6. ✅ Phase 6: Fix maintainer scripts (Day 1)
7. ✅ Phase 7: Simplify pi-post-install.sh (Day 2)
8. ✅ Phase 8: Lintian compliance (Day 3)
9. ✅ Phase 9: Testing suite (Day 4)
10. ✅ Phase 10: Documentation (Day 5)

---

## SUCCESS CRITERIA

### Functional Requirements
- [ ] No system package installation in app scripts
- [ ] No NetworkManager configuration in app scripts
- [ ] Package declares escapeplan-base dependency
- [ ] Native modules rebuild successfully for ARM64/AMD64
- [ ] Database initializes with seed data
- [ ] Secrets generated on first install
- [ ] nginx site configured and enabled
- [ ] Services registered but NOT auto-enabled

### Technical Requirements
- [ ] Lintian compliance: 95%+ (0 errors)
- [ ] No `apt-get` or `apt install` in any script
- [ ] No `nmcli connection add` in any script
- [ ] No `useradd` or `mkdir -p /var/lib/escapeplan` in scripts
- [ ] shellcheck passes on all scripts
- [ ] nginx -t passes with app site config

### Quality Requirements
- [ ] 154/154 tests passing (100%)
- [ ] No TypeScript errors (0)
- [ ] Package builds successfully
- [ ] Package installs without errors (with base OS)
- [ ] Package fails gracefully without base OS

### Documentation Requirements
- [ ] README updated with dependency requirements
- [ ] DEPENDENCIES.md created
- [ ] INSTALLATION.md created
- [ ] All code changes have clear commit messages

---

## GIT COMMIT STRATEGY

Same format as base OS plan:

```
<type>: <subject>

<body>

Refs: BASE-APP-OPTIMIZATION.md Phase <N>
[Depends: escapeplan-base (>= 1.0.0)]
```

**Total: 10 commits for app optimization**

---

## DEPENDENCIES ON BASE OS PLAN

### App CANNOT proceed until Base OS provides:
- ✅ escapeplan-base package version 1.0.0+
- ✅ NetworkManager AP pre-configured
- ✅ nginx optimized and configured
- ✅ escapeplan user created
- ✅ Directory structure created

### Coordination Points:
- Base OS Phase 1-5 must complete before App Phase 1
- Both can proceed in parallel after base OS Phase 5
- Final testing (Phase 9) requires both packages

---

## COMPLETION CHECKLIST

- [ ] All 10 phases implemented
- [ ] All git commits created
- [ ] All shellcheck validations pass
- [ ] lintian shows 0 errors
- [ ] Package installs successfully on base OS
- [ ] Package fails gracefully without base OS
- [ ] All tests passing (154/154)
- [ ] Documentation complete
- [ ] Coordinated with base OS optimization

---

**Plan Status:** READY FOR IMPLEMENTATION
**Next Step:** Wait for Base OS Phase 1-5 completion, then launch App Agent Wave 1
**Estimated Completion:** 2 weeks (coordinated with base OS)
**Breaking Changes:** YES (requires escapeplan-base >= 1.0.0)
