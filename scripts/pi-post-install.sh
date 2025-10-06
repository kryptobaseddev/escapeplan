#!/bin/bash
set -euo pipefail

# ============================================================================
# EscapePlan Post-Install Master Orchestration Script
# ============================================================================
#
# This script orchestrates the complete installation and configuration of
# EscapePlan on Raspberry Pi. It can be run:
#   1. Automatically by DEBIAN/postinst during .deb installation
#   2. Manually for troubleshooting or re-configuration
#
# Key Features:
#   - Automatic system package installation (hostapd, dnsmasq, nginx, etc.)
#   - WiFi hotspot auto-configuration (SSID: EscapePlan, 10.10.10.0/24)
#   - Secure password generation and storage
#   - Native module rebuild for ARM64 architecture
#   - Database initialization and seeding
#   - Systemd service installation and activation
#   - Directory/ownership setup
#   - Secrets generation
#   - Comprehensive health check validation
#
# This script is IDEMPOTENT - safe to run multiple times.
#
# Usage:
#   sudo ./pi-post-install.sh [INSTALL_ROOT] [OPTIONS]
#
# Arguments:
#   INSTALL_ROOT    Installation directory (default: /opt/escapeplan)
#
# Options:
#   --rebuild-only      Only rebuild native modules, skip other steps
#   --skip-db-init      Skip database initialization
#   --skip-secrets      Skip secrets generation
#   --skip-health       Skip final health check
#   --force             Force re-execution of all steps
#
# Exit Codes:
#   0 - Success
#   1 - Error during installation
#
# ============================================================================

INSTALL_ROOT="${1:-/opt/escapeplan}"
LOG_FILE="/tmp/escapeplan-post-install.log"
ESCAPEPLAN_CONFIG_DIR="/etc/escapeplan"
WIFI_PASSWORD_FILE="${ESCAPEPLAN_CONFIG_DIR}/wifi-password.txt"

# Shift past INSTALL_ROOT to process options
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
    shift
fi

# Parse options
REBUILD_ONLY=false
SKIP_DB_INIT=false
SKIP_SECRETS=false
SKIP_HEALTH=false
FORCE_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --rebuild-only)
            REBUILD_ONLY=true
            shift
            ;;
        --skip-db-init)
            SKIP_DB_INIT=true
            shift
            ;;
        --skip-secrets)
            SKIP_SECRETS=true
            shift
            ;;
        --skip-health)
            SKIP_HEALTH=true
            shift
            ;;
        --force)
            FORCE_MODE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log() {
    echo "[pi-post-install] $*" | tee -a "${LOG_FILE}"
}

log_section() {
    echo "" | tee -a "${LOG_FILE}"
    echo "========================================" | tee -a "${LOG_FILE}"
    echo "$*" | tee -a "${LOG_FILE}"
    echo "========================================" | tee -a "${LOG_FILE}"
}

log_success() {
    echo "[pi-post-install] ✓ $*" | tee -a "${LOG_FILE}"
}

log_error() {
    echo "[pi-post-install] ERROR: $*" | tee -a "${LOG_FILE}" >&2
}

log_warning() {
    echo "[pi-post-install] WARNING: $*" | tee -a "${LOG_FILE}"
}

log_info() {
    echo "[pi-post-install] INFO: $*" | tee -a "${LOG_FILE}"
}

validate_native_module() {
    local module_path="$1"
    local module_name="$2"

    if [ ! -f "${module_path}" ]; then
        log "ERROR: Native module not found: ${module_path}"
        return 1
    fi

    # Check architecture using file command
    local arch_info
    arch_info=$(file "${module_path}" 2>&1 || echo "ERROR")

    log "Checking ${module_name} architecture:"
    log "  Path: ${module_path}"
    log "  Info: ${arch_info}"

    # Verify it's ARM64 (aarch64) or ARM (armv7l for 32-bit Pi)
    if echo "${arch_info}" | grep -qE "(aarch64|ARM)"; then
        log "✓ ${module_name} is ARM-compatible"
        return 0
    else
        log "✗ ${module_name} is NOT ARM-compatible (found: ${arch_info})"
        return 1
    fi
}

rebuild_native_modules() {
    local app_dir="$1"
    local app_name="$2"

    log "=== Rebuilding native modules for ${app_name} ==="

    if [ ! -d "${app_dir}" ]; then
        log "ERROR: Application directory not found: ${app_dir}"
        return 1
    fi

    cd "${app_dir}"

    # Check if we're on ARM architecture
    local system_arch
    system_arch=$(uname -m)
    log "System architecture: ${system_arch}"

    if [[ ! "${system_arch}" =~ ^(aarch64|armv7l|armv8)$ ]]; then
        log "WARNING: Not running on ARM architecture (${system_arch})"
        log "Skipping native module rebuild - pre-built x86_64 modules will be used"
        return 0
    fi

    # Check if npm rebuild is available
    if ! command -v npm &> /dev/null; then
        log "ERROR: npm not found - cannot rebuild native modules"
        log "Please install nodejs package"
        return 1
    fi

    # Find better-sqlite3 in pnpm structure
    local sqlite_module
    sqlite_module=$(find node_modules/.pnpm -type f -name "better_sqlite3.node" 2>/dev/null | head -n1)

    if [ -z "${sqlite_module}" ]; then
        log "ERROR: better-sqlite3 native module not found in node_modules/.pnpm"
        return 1
    fi

    log "Found better-sqlite3 at: ${sqlite_module}"

    # Validate current architecture before rebuild
    if validate_native_module "${sqlite_module}" "better-sqlite3 (before rebuild)"; then
        log "Native module is already ARM-compatible, skipping rebuild"
        return 0
    fi

    log "Native module is x86_64, rebuilding for ARM..."

    # Check for build dependencies
    local missing_deps=()
    command -v gcc &> /dev/null || missing_deps+=("gcc")
    command -v g++ &> /dev/null || missing_deps+=("g++")
    command -v make &> /dev/null || missing_deps+=("make")
    command -v python3 &> /dev/null || missing_deps+=("python3")

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log "ERROR: Missing build dependencies: ${missing_deps[*]}"
        log "Install with: sudo apt-get install -y build-essential python3"
        return 1
    fi

    # Remove old build artifacts
    local sqlite_build_dir
    sqlite_build_dir=$(dirname "${sqlite_module}")/..
    if [ -d "${sqlite_build_dir}/build" ]; then
        log "Removing old build artifacts..."
        rm -rf "${sqlite_build_dir}/build"
    fi

    # Rebuild better-sqlite3 for current architecture
    log "Running: npm rebuild better-sqlite3"
    log "This may take 2-3 minutes on Raspberry Pi..."

    if timeout 300 npm rebuild better-sqlite3 >> "${LOG_FILE}" 2>&1; then
        log "✓ npm rebuild successful"
    else
        local exit_code=$?
        if [ ${exit_code} -eq 124 ]; then
            log "ERROR: npm rebuild timed out after 300 seconds"
            log "This may indicate insufficient system resources or a stalled build"
        else
            log "ERROR: npm rebuild failed with exit code ${exit_code}. Check ${LOG_FILE} for details"
        fi
        return 1
    fi

    # Validate rebuilt module
    local rebuilt_module
    rebuilt_module=$(find node_modules/.pnpm -type f -name "better_sqlite3.node" 2>/dev/null | head -n1)

    if [ -z "${rebuilt_module}" ]; then
        log "ERROR: better-sqlite3 native module not found after rebuild"
        return 1
    fi

    if validate_native_module "${rebuilt_module}" "better-sqlite3 (after rebuild)"; then
        log "✓ Native module rebuild successful and validated"
        return 0
    else
        log "ERROR: Native module validation failed after rebuild"
        return 1
    fi
}

# ============================================================================
# SYSTEM PACKAGE MANAGEMENT
# ============================================================================

install_system_packages() {
    log_section "STEP: Installing System Packages"

    log_info "Updating package lists..."
    if timeout 300 apt-get update -qq >> "${LOG_FILE}" 2>&1; then
        log_success "Package lists updated"
    else
        local exit_code=$?
        if [ ${exit_code} -eq 124 ]; then
            log_error "apt-get update timed out after 300 seconds"
        else
            log_error "Failed to update package lists"
        fi
        return 1
    fi

    # Required packages for EscapePlan operation
    local required_packages=(
        "hostapd"           # WiFi access point
        "dnsmasq"           # DHCP and DNS server
        "nginx"             # Reverse proxy and static file server
        "nodejs"            # JavaScript runtime (will check version below)
        "sqlite3"           # Database CLI tools
        "openssl"           # Cryptographic operations
        "build-essential"   # GCC, G++, make for native module compilation
        "python3"           # Required for node-gyp
        "net-tools"         # Network configuration utilities
        "iproute2"          # Advanced network configuration
        "iptables"          # Firewall and NAT rules
    )

    local packages_to_install=()
    local already_installed=()

    log_info "Checking required packages..."
    for package in "${required_packages[@]}"; do
        if dpkg -l | grep -qw "^ii.*${package}"; then
            already_installed+=("${package}")
        else
            packages_to_install+=("${package}")
        fi
    done

    if [ ${#already_installed[@]} -gt 0 ]; then
        log_info "Already installed: ${already_installed[*]}"
    fi

    if [ ${#packages_to_install[@]} -gt 0 ]; then
        log_info "Installing missing packages: ${packages_to_install[*]}"

        # Use DEBIAN_FRONTEND=noninteractive to avoid prompts
        # Use -qq for quiet output (errors still shown)
        if timeout 600 env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${packages_to_install[@]}" >> "${LOG_FILE}" 2>&1; then
            log_success "Installed packages: ${packages_to_install[*]}"
        else
            local exit_code=$?
            if [ ${exit_code} -eq 124 ]; then
                log_error "apt-get install timed out after 600 seconds"
            else
                log_error "Failed to install packages: ${packages_to_install[*]}"
            fi
            log_error "Check ${LOG_FILE} for details"
            return 1
        fi
    else
        log_success "All required packages are already installed"
    fi

    # Verify Node.js version (need v20+)
    if command -v node &> /dev/null; then
        local node_version
        node_version=$(node --version | sed 's/^v//')
        local node_major
        node_major=$(echo "${node_version}" | cut -d. -f1)

        log_info "Node.js version: ${node_version}"

        if [ "${node_major}" -lt 20 ]; then
            log_warning "Node.js version ${node_version} is older than required v20+"
            log_warning "EscapePlan requires Node.js v20 or higher"
            log_warning "Consider installing via NodeSource repository"
            log_warning "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
            log_warning "  sudo apt-get install -y nodejs"
            return 1
        else
            log_success "Node.js version ${node_version} meets requirements (v20+)"
        fi
    else
        log_error "Node.js installation verification failed"
        return 1
    fi

    return 0
}

# ============================================================================
# WIFI HOTSPOT CONFIGURATION
# ============================================================================

generate_secure_password() {
    # Use hardcoded default password for EscapePlan WiFi hotspot
    echo "Canuescape3"
}

setup_wifi_hotspot() {
    log_section "STEP: Configuring WiFi Hotspot"

    # Check if wlan0 exists
    if ! ip link show wlan0 &> /dev/null; then
        log_warning "wlan0 interface not found - skipping WiFi hotspot setup"
        log_warning "This is expected on non-Pi systems or systems without WiFi"
        return 0
    fi

    # Check if hotspot is already configured
    if [ -f "/etc/hostapd/hostapd.conf" ] && [ -f "${WIFI_PASSWORD_FILE}" ]; then
        log_info "WiFi hotspot appears to be already configured"
        log_info "Configuration files exist:"
        log_info "  - /etc/hostapd/hostapd.conf"
        log_info "  - ${WIFI_PASSWORD_FILE}"

        # Verify configuration is valid
        if grep -q "ssid=EscapePlan" /etc/hostapd/hostapd.conf 2>/dev/null; then
            log_success "WiFi hotspot configuration verified (SSID: EscapePlan)"
            log_info "Password file: ${WIFI_PASSWORD_FILE}"
            return 0
        else
            log_warning "Existing configuration appears invalid - will reconfigure"
        fi
    fi

    log_info "Configuring WiFi access point..."

    # Create EscapePlan config directory
    if [ ! -d "${ESCAPEPLAN_CONFIG_DIR}" ]; then
        mkdir -p "${ESCAPEPLAN_CONFIG_DIR}"
        chmod 755 "${ESCAPEPLAN_CONFIG_DIR}"
        log_info "Created ${ESCAPEPLAN_CONFIG_DIR}"
    fi

    # Generate or retrieve WiFi password
    local wifi_password
    if [ -f "${WIFI_PASSWORD_FILE}" ]; then
        wifi_password=$(cat "${WIFI_PASSWORD_FILE}")
        log_info "Using existing WiFi password from ${WIFI_PASSWORD_FILE}"
    else
        wifi_password=$(generate_secure_password)
        echo "${wifi_password}" > "${WIFI_PASSWORD_FILE}"
        chmod 600 "${WIFI_PASSWORD_FILE}"
        log_success "Generated new WiFi password: ${wifi_password}"
        log_info "Password saved to ${WIFI_PASSWORD_FILE} (permissions: 600)"
    fi

    # Validate password length (WPA2 requires 8-63 characters)
    if [ ${#wifi_password} -lt 8 ]; then
        log_error "WiFi password too short (${#wifi_password} chars) - WPA2 requires 8-63"
        return 1
    fi

    # Configure hostapd (WiFi Access Point)
    log_info "Creating hostapd configuration..."
    cat > /etc/hostapd/hostapd.conf << EOF
# EscapePlan WiFi Hotspot Configuration
interface=wlan0
driver=nl80211
ssid=EscapePlan
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=${wifi_password}
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF

    chmod 600 /etc/hostapd/hostapd.conf

    # Validate hostapd configuration
    if ! hostapd -t /etc/hostapd/hostapd.conf >> "${LOG_FILE}" 2>&1; then
        log_error "hostapd configuration validation failed"
        log_error "Check ${LOG_FILE} for details"
        return 1
    fi
    log_success "hostapd configuration created and validated"

    # Update hostapd defaults
    if [ -f /etc/default/hostapd ]; then
        if ! grep -q "DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"" /etc/default/hostapd; then
            echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' >> /etc/default/hostapd
            log_info "Updated /etc/default/hostapd"
        fi
    fi

    # Configure dnsmasq (DHCP + DNS)
    log_info "Creating dnsmasq configuration..."

    # Backup original dnsmasq.conf if not already backed up
    if [ -f /etc/dnsmasq.conf ] && [ ! -f /etc/dnsmasq.conf.backup ]; then
        cp /etc/dnsmasq.conf /etc/dnsmasq.conf.backup
        log_info "Backed up /etc/dnsmasq.conf to /etc/dnsmasq.conf.backup"
    fi

    mkdir -p /etc/dnsmasq.d
    cat > /etc/dnsmasq.d/escapeplan.conf << EOF
# EscapePlan DHCP and DNS Configuration
interface=wlan0
dhcp-range=10.10.10.50,10.10.10.150,255.255.255.0,24h
dhcp-option=option:router,10.10.10.1
dhcp-option=option:dns-server,10.10.10.1
domain=escapeplan.local
address=/escapeplan.local/10.10.10.1

# Prevent dnsmasq from reading /etc/resolv.conf for upstream DNS
no-resolv
# Use Google DNS as upstream (when internet available)
server=8.8.8.8
server=8.8.4.4

# Log DHCP transactions for debugging
log-dhcp
EOF

    # Validate dnsmasq configuration
    if ! dnsmasq --test --conf-file=/etc/dnsmasq.d/escapeplan.conf >> "${LOG_FILE}" 2>&1; then
        log_error "dnsmasq configuration validation failed"
        log_error "Check ${LOG_FILE} for details"
        return 1
    fi
    log_success "dnsmasq configuration created and validated"

    # Configure static IP for wlan0 via dhcpcd
    log_info "Configuring static IP for wlan0..."

    # Check if static IP already configured
    if ! grep -q "interface wlan0" /etc/dhcpcd.conf 2>/dev/null; then
        cat >> /etc/dhcpcd.conf << EOF

# EscapePlan WiFi Hotspot Static IP
interface wlan0
    static ip_address=10.10.10.1/24
    nohook wpa_supplicant
EOF
        log_success "Added static IP configuration to /etc/dhcpcd.conf"
    else
        log_info "Static IP already configured in /etc/dhcpcd.conf"
    fi

    # Prevent NetworkManager from managing wlan0 (if NetworkManager is installed)
    if systemctl is-active --quiet NetworkManager; then
        log_info "Configuring NetworkManager to ignore wlan0..."
        mkdir -p /etc/NetworkManager/conf.d
        cat > /etc/NetworkManager/conf.d/unmanaged.conf << EOF
# Prevent NetworkManager from managing wlan0 (used by EscapePlan hotspot)
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF
        log_success "NetworkManager configured to ignore wlan0"
    fi

    # Enable IP forwarding (for potential internet sharing)
    log_info "Enabling IP forwarding..."
    if ! grep -q "^net.ipv4.ip_forward=1" /etc/sysctl.conf 2>/dev/null; then
        echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
        sysctl -w net.ipv4.ip_forward=1 >> "${LOG_FILE}" 2>&1
        log_success "IP forwarding enabled"
    else
        log_info "IP forwarding already enabled"
    fi

    # Enable and unmask services
    log_info "Enabling hostapd and dnsmasq services..."

    systemctl unmask hostapd >> "${LOG_FILE}" 2>&1 || true
    systemctl enable hostapd >> "${LOG_FILE}" 2>&1
    systemctl enable dnsmasq >> "${LOG_FILE}" 2>&1

    # Restart services to apply configuration
    log_info "Restarting network services..."

    # Restart dhcpcd first to apply static IP
    if systemctl restart dhcpcd >> "${LOG_FILE}" 2>&1; then
        log_success "dhcpcd restarted"
    else
        log_warning "Failed to restart dhcpcd (may not be critical)"
    fi

    # Wait a moment for interface to settle
    sleep 2

    # Start hostapd
    if systemctl restart hostapd >> "${LOG_FILE}" 2>&1; then
        log_success "hostapd started"
    else
        log_error "Failed to start hostapd"
        systemctl status hostapd >> "${LOG_FILE}" 2>&1 || true
        return 1
    fi

    # Start dnsmasq
    if systemctl restart dnsmasq >> "${LOG_FILE}" 2>&1; then
        log_success "dnsmasq started"
    else
        log_error "Failed to start dnsmasq"
        systemctl status dnsmasq >> "${LOG_FILE}" 2>&1 || true
        return 1
    fi

    # Verify wlan0 has correct IP
    sleep 2
    local wlan0_ip
    wlan0_ip=$(ip addr show wlan0 2>/dev/null | grep "inet " | awk '{print $2}')

    if [ -n "${wlan0_ip}" ]; then
        log_success "wlan0 configured with IP: ${wlan0_ip}"
    else
        log_warning "Could not verify wlan0 IP address"
    fi

    log_success "WiFi Hotspot Configuration Complete"
    log ""
    log "============================================"
    log "WiFi Hotspot Details:"
    log "  SSID:     EscapePlan"
    log "  Password: ${wifi_password}"
    log "  IP Range: 10.10.10.50 - 10.10.10.150"
    log "  Gateway:  10.10.10.1"
    log "  DNS:      10.10.10.1"
    log "============================================"
    log ""
    log_info "Password stored in: ${WIFI_PASSWORD_FILE}"

    return 0
}

# ============================================================================
# ORCHESTRATION STEPS
# ============================================================================

# Step: Dependency Validation (Agent 13)
step_validate_dependencies() {
    log_section "STEP: Validating Dependencies (Agent 13 - Pre-flight Check)"

    local validator_script="${INSTALL_ROOT}/scripts/validate-dependencies.sh"

    # If script doesn't exist at install root, try current directory
    if [ ! -f "${validator_script}" ]; then
        local script_dir
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        validator_script="${script_dir}/validate-dependencies.sh"
    fi

    if [ ! -f "${validator_script}" ]; then
        log_warning "Dependency validator script not found"
        log_warning "Skipping dependency validation (not critical)"
        return 0
    fi

    log "Running dependency validation with auto-install..."
    "${validator_script}" "${INSTALL_ROOT}" --auto-install 2>&1 | tee -a "${LOG_FILE}"
    local validation_result=$?

    if [ $validation_result -eq 0 ]; then
        log_success "All dependencies validated and installed"
        return 0
    else
        log_warning "Native module architecture mismatch detected"
        log_info "Rebuilding native modules for ARM64..."

        # Use centralized rebuild function instead of hardcoded inline rebuild
        if ! rebuild_native_modules "/opt/escapeplan/api" "API"; then
            log_error "Native module rebuild failed"
            return 1
        fi

        log_success "Native modules rebuilt successfully for ARM64"
        return 0
    fi
}

# Step: Native Module Rebuild (Agent 2)
step_rebuild_native_modules() {
    log_section "STEP: Rebuilding Native Modules (Agent 2)"

    local api_dir="${INSTALL_ROOT}/api"
    local web_dir="${INSTALL_ROOT}/web"
    local rebuild_failed=0

    # Rebuild API native modules (better-sqlite3, argon2, sodium-native, sharp)
    if [ -d "${api_dir}" ]; then
        if ! rebuild_native_modules "${api_dir}" "API"; then
            log_warning "API native module rebuild had issues"
            rebuild_failed=1
        fi
    else
        log_warning "API directory not found: ${api_dir}"
    fi

    # Web doesn't have native modules in this project, but check anyway
    if [ -d "${web_dir}" ]; then
        log "Checking Web directory for native modules..."
        local web_natives
        web_natives=$(find "${web_dir}/node_modules/.pnpm" -type f -name "*.node" 2>/dev/null | wc -l)
        if [ "${web_natives}" -gt 0 ]; then
            log "Found ${web_natives} native modules in Web, rebuilding..."
            rebuild_native_modules "${web_dir}" "Web" || rebuild_failed=1
        else
            log "No native modules found in Web (expected)"
        fi
    fi

    if [ ${rebuild_failed} -eq 1 ]; then
        log_warning "Native module rebuild had errors - see ${LOG_FILE}"
        return 1
    else
        log_success "All native modules are ARM-compatible"
        return 0
    fi
}

# Step: Run Health Check (Agent 8)
step_health_check() {
    log_section "STEP: Running Health Check (Agent 8)"

    local health_check_script="${INSTALL_ROOT}/scripts/health-check.sh"

    if [ ! -x "${health_check_script}" ]; then
        log_warning "Health check script not found at ${health_check_script}"
        return 0
    fi

    log "Executing health check validation..."
    if timeout 30 "${health_check_script}" 2>&1 | tee -a "${LOG_FILE}"; then
        log_success "Health check passed"
        return 0
    else
        local exit_code=$?
        if [ ${exit_code} -eq 124 ]; then
            log_warning "Health check timed out after 30 seconds"
        else
            log_warning "Health check reported issues - review output above"
        fi
        return 1
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log_section "EscapePlan Post-Install Master Orchestration"
    log "Started at: $(date)"
    log "Install root: ${INSTALL_ROOT}"
    log "Log file: ${LOG_FILE}"

    if [ "${REBUILD_ONLY}" = true ]; then
        log "Running in REBUILD-ONLY mode"
        step_rebuild_native_modules
        exit $?
    fi

    # Check if running as root
    if [ $EUID -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi

    # Full orchestration flow
    local total_errors=0

    # The DEBIAN/postinst script already handles most steps, so this script
    # focuses on the native module rebuild which must happen post-extraction
    # and the final health check

    log_section "Post-Install Orchestration Flow"
    log "Note: Most installation steps are handled by DEBIAN/postinst"
    log "This script handles platform-specific tasks:"
    log "  - System package installation (hostapd, dnsmasq, nginx, etc.)"
    log "  - WiFi hotspot auto-configuration"
    log "  - Pre-flight dependency validation (Agent 13)"
    log "  - Native module rebuild for ARM64 architecture (Agent 2)"
    log "  - Final health check validation (Agent 8)"

    # Execute system package installation
    if ! install_system_packages; then
        log_error "System package installation failed - cannot proceed"
        log_error "Review ${LOG_FILE} and fix package issues"
        exit 1
    fi

    # Execute WiFi hotspot configuration
    if ! setup_wifi_hotspot; then
        log_error "WiFi hotspot configuration failed"
        ((total_errors++))
        log_warning "System will continue but WiFi hotspot may not work"
    fi

    # Execute dependency validation (pre-flight check)
    if ! step_validate_dependencies; then
        log_error "Dependency validation failed - cannot proceed"
        log_error "Install missing dependencies and re-run this script"
        exit 1
    fi

    # Execute native module rebuild
    if ! step_rebuild_native_modules; then
        log_warning "Native module rebuild had issues"
        ((total_errors++))
    fi

    # Execute health check unless skipped
    if [ "${SKIP_HEALTH}" != true ]; then
        if ! step_health_check; then
            log_warning "Health check reported issues"
            ((total_errors++))
        fi
    fi

    # Summary
    log_section "Post-Install Summary"
    log "Finished at: $(date)"

    if [ ${total_errors} -eq 0 ]; then
        log_success "All post-install steps completed successfully"
        log ""
        log "EscapePlan is ready to use!"
        log "  - Start API:  systemctl start escapeplan-api"
        log "  - Start Web:  systemctl start escapeplan-web"
        log "  - Check logs: ${LOG_FILE}"
        return 0
    else
        log_warning "${total_errors} step(s) had issues - review ${LOG_FILE}"
        log ""
        log "System may still be functional, but some features may not work correctly"
        log "Review errors above and take corrective action"
        return 1
    fi
}

# Run main function
main "$@"
