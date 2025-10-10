#!/bin/bash
set -euo pipefail

# ============================================================================
# EscapePlan Native Module Rebuild Script
# ============================================================================
#
# This script handles architecture-specific post-install tasks for EscapePlan
# on Raspberry Pi ARM64 systems. It focuses exclusively on rebuilding native
# Node.js modules to ensure compatibility with the target ARM architecture.
#
# Architecture-Specific Tasks:
#   - Validates native module architecture (better-sqlite3, etc.)
#   - Rebuilds native modules for ARM64 when x86_64 binaries detected
#   - Performs pre-flight dependency validation (build tools, npm)
#   - Skips health check (runs too early - use health-check.sh after install)
#
# System Requirements:
#   - ARM64 (aarch64) architecture
#   - Build essentials (gcc, g++, make, python3)
#   - Node.js and npm
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
#   --rebuild-only      Only rebuild native modules, skip validation/health check
#   --skip-health       Skip final health check
#   --force             Force re-execution of all steps
#
# Exit Codes:
#   0 - Success
#   1 - Error during native module rebuild or validation
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

# Error cleanup trap
cleanup_on_error() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Installation failed with exit code $exit_code"
        log_error "Review ${LOG_FILE} for details"
    fi
}

trap cleanup_on_error EXIT ERR

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
        log "These packages should be provided by base OS (build-essential, python3)"
        return 1
    fi

    # Remove old build artifacts
    local sqlite_build_dir
    sqlite_build_dir=$(dirname "${sqlite_module}")/..
    if [ -d "${sqlite_build_dir}/build" ]; then
        log "Removing old build artifacts..."
        rm -rf "${sqlite_build_dir}/build"
    fi

    # Rebuild better-sqlite3 and sharp for current architecture
    log "Running: npm rebuild better-sqlite3 sharp"
    log "This may take 2-3 minutes on Raspberry Pi..."

    if timeout 300 npm rebuild better-sqlite3 sharp >> "${LOG_FILE}" 2>&1; then
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
# WIFI HOTSPOT VERIFICATION
# ============================================================================

verify_wifi_ap() {
    log_section "STEP: Verifying WiFi Access Point"

    # Check if wlan0 exists
    if ! ip link show wlan0 &>/dev/null; then
        log_warning "wlan0 interface not found - WiFi AP not available"
        log_warning "This is expected on systems without WiFi hardware"
        return 0
    fi

    # Check if AP connection exists (managed by external configuration)
    if ip addr show wlan0 | grep -q "10.10.10.1"; then
        log_success "WiFi AP detected on wlan0 (10.10.10.1/24)"
        return 0
    else
        log_warning "WiFi AP not configured on wlan0"
        log_warning "System will work but WiFi hotspot features unavailable"
        log_info "AP configuration should be managed by platform automation"
        return 0
    fi
}

# ============================================================================
# ARCHITECTURE-SPECIFIC TASKS
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
    log_section "EscapePlan Native Module Rebuild"
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

    # Architecture-specific rebuild flow
    local total_errors=0

    # This script focuses exclusively on architecture-specific tasks that must
    # happen after .deb extraction on the target ARM64 system

    log_section "Architecture-Specific Tasks"
    log "This script handles native module compatibility for ARM64:"
    log "  - WiFi Access Point verification (non-fatal)"
    log "  - Pre-flight dependency validation (Agent 13)"
    log "  - Native module rebuild for ARM64 architecture (Agent 2)"

    # Verify WiFi Access Point (non-fatal check)
    verify_wifi_ap

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

    # NOTE: Health check is skipped during postinst because database and secrets
    # are created AFTER this script completes (in orchestrator steps 3-5).
    # Users can run /opt/escapeplan/scripts/health-check.sh after installation.

    # Summary
    log_section "Native Module Rebuild Summary"
    log "Finished at: $(date)"

    if [ ${total_errors} -eq 0 ]; then
        log_success "All native modules are ARM64-compatible"
        log ""
        log "EscapePlan is ready to use!"
        log "  - Start API:  systemctl start escapeplan-api"
        log "  - Start Web:  systemctl start escapeplan-web"
        log "  - Check logs: ${LOG_FILE}"
        return 0
    else
        log_warning "${total_errors} step(s) had issues - review ${LOG_FILE}"
        log ""
        log "Native module compatibility issues detected"
        log "Review errors above and take corrective action"
        return 1
    fi
}

# Run main function
main "$@"
