#!/bin/bash
set -euo pipefail

# ============================================================================
# EscapePlan Dependency Validation Script
# ============================================================================
#
# This script validates that all required system and Node.js dependencies
# are installed before proceeding with the EscapePlan installation.
#
# It checks for:
#   - System packages (node, sqlite3, nginx, build-essential, python3, openssl)
#   - Node.js version requirements (v18+)
#   - Required Node.js modules (better-sqlite3, drizzle-orm, contracts deps)
#   - PNPM store integrity
#
# Usage:
#   ./validate-dependencies.sh [INSTALL_ROOT] [OPTIONS]
#
# Arguments:
#   INSTALL_ROOT    Installation directory (default: /opt/escapeplan)
#
# Options:
#   --auto-install      Automatically install missing system packages
#   --skip-node-check   Skip Node.js module validation
#   --strict            Fail on warnings (default: fail on errors only)
#
# Exit Codes:
#   0 - All dependencies validated successfully
#   1 - Validation errors found
#   2 - Missing system packages (when --auto-install not used)
#   3 - Missing Node.js modules
#   4 - Version requirements not met
#
# ============================================================================

INSTALL_ROOT="${1:-/opt/escapeplan}"
LOG_FILE="/tmp/escapeplan-dependency-validation.log"

# Shift past INSTALL_ROOT to process options
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
    shift
fi

# Parse options
AUTO_INSTALL=false
SKIP_NODE_CHECK=false
STRICT_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-install)
            AUTO_INSTALL=true
            shift
            ;;
        --skip-node-check)
            SKIP_NODE_CHECK=true
            shift
            ;;
        --strict)
            STRICT_MODE=true
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
    echo "[dependency-validator] $*" | tee -a "${LOG_FILE}"
}

log_section() {
    echo "" | tee -a "${LOG_FILE}"
    echo "========================================" | tee -a "${LOG_FILE}"
    echo "$*" | tee -a "${LOG_FILE}"
    echo "========================================" | tee -a "${LOG_FILE}"
}

log_success() {
    echo "[dependency-validator] ✓ $*" | tee -a "${LOG_FILE}"
}

log_error() {
    echo "[dependency-validator] ✗ ERROR: $*" | tee -a "${LOG_FILE}" >&2
}

log_warning() {
    echo "[dependency-validator] ⚠️  WARNING: $*" | tee -a "${LOG_FILE}"
}

log_info() {
    echo "[dependency-validator] ℹ️  $*" | tee -a "${LOG_FILE}"
}

# ============================================================================
# SYSTEM PACKAGE VALIDATION
# ============================================================================

# Required system packages with version requirements
declare -A REQUIRED_SYSTEM_PACKAGES=(
    ["nodejs"]="20"              # Node.js v20+ required
    ["sqlite3"]=""               # Any version
    ["nginx"]=""                 # Any version
    ["gcc"]=""                   # Part of build-essential
    ["g++"]=""                   # Part of build-essential
    ["make"]=""                  # Part of build-essential
    ["python3"]=""               # For node-gyp
    ["openssl"]=""               # For secrets generation
)

# Optional but recommended packages
declare -A RECOMMENDED_PACKAGES=(
    ["git"]=""                   # For potential updates
    ["curl"]=""                  # For health checks
)

# Package installation map (how to install if missing)
declare -A PACKAGE_INSTALL_MAP=(
    ["nodejs"]="nodejs"
    ["sqlite3"]="sqlite3"
    ["nginx"]="nginx"
    ["gcc"]="build-essential"
    ["g++"]="build-essential"
    ["make"]="build-essential"
    ["python3"]="python3"
    ["openssl"]="openssl"
    ["git"]="git"
    ["curl"]="curl"
)

check_command_exists() {
    local cmd="$1"
    command -v "${cmd}" &>/dev/null
}

get_nodejs_version() {
    if check_command_exists node; then
        node --version | sed 's/v//' | cut -d'.' -f1
    else
        echo "0"
    fi
}

validate_system_packages() {
    log_section "Validating System Packages"

    local missing_packages=()
    local version_mismatch=()
    local all_valid=true

    # Check required packages
    for package in "${!REQUIRED_SYSTEM_PACKAGES[@]}"; do
        local min_version="${REQUIRED_SYSTEM_PACKAGES[$package]}"

        if [ "${package}" = "nodejs" ]; then
            # Special handling for Node.js
            if check_command_exists node; then
                local node_version
                node_version=$(get_nodejs_version)

                if [ -n "${min_version}" ] && [ "${node_version}" -lt "${min_version}" ]; then
                    log_error "Node.js version ${node_version} found, but version ${min_version}+ required"
                    version_mismatch+=("nodejs (v${node_version} < v${min_version})")
                    all_valid=false
                else
                    log_success "Node.js v${node_version} installed (>= v${min_version} required)"
                fi
            else
                log_error "Node.js not installed (v${min_version}+ required)"
                missing_packages+=("${PACKAGE_INSTALL_MAP[$package]}")
                all_valid=false
            fi
        else
            # Standard package check
            if check_command_exists "${package}"; then
                local version
                version=$("${package}" --version 2>&1 | head -n1 || echo "unknown")
                log_success "${package} installed: ${version}"
            else
                log_error "${package} not installed"

                # Avoid duplicate entries for build-essential packages
                local install_package="${PACKAGE_INSTALL_MAP[$package]}"
                if [[ ! " ${missing_packages[*]} " =~ " ${install_package} " ]]; then
                    missing_packages+=("${install_package}")
                fi
                all_valid=false
            fi
        fi
    done

    # Check recommended packages (warnings only)
    log ""
    log "Checking recommended packages..."
    for package in "${!RECOMMENDED_PACKAGES[@]}"; do
        if check_command_exists "${package}"; then
            log_success "${package} installed (recommended)"
        else
            log_warning "${package} not installed (recommended but not required)"
        fi
    done

    # Handle missing packages
    if [ ${#missing_packages[@]} -gt 0 ]; then
        log ""
        log_error "Missing ${#missing_packages[@]} required system package(s):"
        for pkg in "${missing_packages[@]}"; do
            log_error "  - ${pkg}"
        done

        if [ "${AUTO_INSTALL}" = true ]; then
            install_missing_packages "${missing_packages[@]}"
        else
            log ""
            log_info "To install missing packages, run:"
            log_info "  sudo apt-get update"
            log_info "  sudo apt-get install -y ${missing_packages[*]}"
            log ""
            log_info "Or re-run this script with --auto-install flag"
            return 2
        fi
    fi

    if [ ${#version_mismatch[@]} -gt 0 ]; then
        log ""
        log_error "Version requirements not met:"
        for pkg in "${version_mismatch[@]}"; do
            log_error "  - ${pkg}"
        done
        return 4
    fi

    if [ "${all_valid}" = true ]; then
        log ""
        log_success "All required system packages validated"
        return 0
    else
        return 1
    fi
}

install_missing_packages() {
    local packages=("$@")

    log_section "Installing Missing Packages"
    log_info "Installing: ${packages[*]}"

    # Update package index
    log "Updating package index..."
    if ! apt-get update -qq 2>&1 | tee -a "${LOG_FILE}"; then
        log_error "Failed to update package index"
        return 1
    fi

    # Install packages
    log "Installing packages..."
    if ! apt-get install -y "${packages[@]}" 2>&1 | tee -a "${LOG_FILE}"; then
        log_error "Failed to install packages: ${packages[*]}"
        return 1
    fi

    log_success "All missing packages installed successfully"
    return 0
}

# ============================================================================
# NODE.JS MODULE VALIDATION
# ============================================================================

# Required Node.js modules (npm package names)
declare -A REQUIRED_NODE_MODULES=(
    ["better-sqlite3"]="API"
    ["drizzle-orm"]="API,Web,Contracts"
    ["drizzle-zod"]="Contracts"
    ["zod"]="API,Web,Contracts"
    ["fastify"]="API"
    ["socket.io"]="API"
    ["@escapeplan/contracts"]="API,Web"
)

# Native modules that require compilation
NATIVE_MODULES=(
    "better-sqlite3"
    "argon2"
    "sodium-native"
    "sharp"
)

check_node_module_exists() {
    local module_path="$1"
    local module_name="$2"

    # Check in regular node_modules
    if [ -d "${module_path}/node_modules/${module_name}" ]; then
        return 0
    fi

    # Check in pnpm store (.pnpm)
    if [ -d "${module_path}/node_modules/.pnpm" ]; then
        if find "${module_path}/node_modules/.pnpm" -maxdepth 1 -type d -name "${module_name}@*" | grep -q .; then
            return 0
        fi
    fi

    return 1
}

check_native_module_architecture() {
    local module_path="$1"
    local module_name="$2"

    # Find the native .node file
    local native_file
    native_file=$(find "${module_path}/node_modules" -type f -name "*.node" -path "*${module_name}*" 2>/dev/null | head -n1)

    if [ -z "${native_file}" ]; then
        log_warning "Native module ${module_name} not found or not compiled"
        return 1
    fi

    # Check architecture
    local arch_info
    arch_info=$(file "${native_file}" 2>&1 || echo "ERROR")

    local system_arch
    system_arch=$(uname -m)

    if [[ "${system_arch}" =~ ^(aarch64|armv7l|armv8)$ ]]; then
        # On ARM, require ARM architecture
        if echo "${arch_info}" | grep -qE "(aarch64|ARM)"; then
            log_success "${module_name} native module is ARM-compatible"
            return 0
        else
            log_error "${module_name} native module is NOT ARM-compatible"
            log_info "  Expected: ARM architecture"
            log_info "  Found: ${arch_info}"
            return 1
        fi
    else
        # On x86, just verify it's a valid binary
        if echo "${arch_info}" | grep -qE "(x86-64|x86_64|ELF)"; then
            log_success "${module_name} native module is x86_64-compatible"
            return 0
        else
            log_warning "${module_name} has unexpected architecture: ${arch_info}"
            return 1
        fi
    fi
}

validate_node_modules() {
    local install_root="$1"
    local app_name="$2"

    log_section "Validating Node.js Modules for ${app_name}"

    local missing_modules=()
    local invalid_modules=()
    local all_valid=true

    # Check required modules
    for module in "${!REQUIRED_NODE_MODULES[@]}"; do
        local used_in="${REQUIRED_NODE_MODULES[$module]}"

        # Skip if module not required for this app
        if [[ ! ",${used_in}," =~ ,${app_name}, ]]; then
            continue
        fi

        if check_node_module_exists "${install_root}" "${module}"; then
            log_success "${module} found in ${app_name}"

            # Check if it's a native module
            if [[ " ${NATIVE_MODULES[*]} " =~ " ${module} " ]]; then
                if ! check_native_module_architecture "${install_root}" "${module}"; then
                    invalid_modules+=("${module} (architecture mismatch)")
                    all_valid=false
                fi
            fi
        else
            log_error "${module} not found in ${app_name}"
            missing_modules+=("${module}")
            all_valid=false
        fi
    done

    # Validate contracts package
    if [[ ",${app_name}," =~ ,(API|Web), ]]; then
        validate_contracts_package "${install_root}" "${app_name}"
        local contracts_result=$?
        if [ ${contracts_result} -ne 0 ]; then
            all_valid=false
        fi
    fi

    # Report results
    if [ ${#missing_modules[@]} -gt 0 ]; then
        log ""
        log_error "Missing ${#missing_modules[@]} required Node.js module(s) in ${app_name}:"
        for mod in "${missing_modules[@]}"; do
            log_error "  - ${mod}"
        done
        log ""
        log_info "To fix missing modules, run:"
        log_info "  cd ${install_root}"
        log_info "  npm install"
    fi

    if [ ${#invalid_modules[@]} -gt 0 ]; then
        log ""
        log_error "Invalid ${#invalid_modules[@]} module(s) in ${app_name}:"
        for mod in "${invalid_modules[@]}"; do
            log_error "  - ${mod}"
        done
        log ""
        log_info "To rebuild native modules, run:"
        log_info "  cd ${install_root}"
        log_info "  npm rebuild"
    fi

    if [ "${all_valid}" = true ]; then
        log ""
        log_success "All Node.js modules validated for ${app_name}"
        return 0
    else
        return 3
    fi
}

validate_contracts_package() {
    local install_root="$1"
    local app_name="$2"

    log ""
    log "Validating @escapeplan/contracts package for ${app_name}..."

    local contracts_root="${install_root}/node_modules/@escapeplan/contracts"

    if [ ! -d "${contracts_root}" ]; then
        log_error "Contracts package not found at ${contracts_root}"
        return 1
    fi

    # Required contracts files
    local required_files=(
        "dist/runtime.js"
        "dist/runtime.d.ts"
        "dist/validation.js"
        "dist/validation.d.ts"
        "dist/index.js"
        "dist/index.d.ts"
        "dist/paths.js"
        "dist/paths.d.ts"
    )

    local missing_files=()
    for file in "${required_files[@]}"; do
        if [ ! -f "${contracts_root}/${file}" ]; then
            log_error "Contracts file missing: ${file}"
            missing_files+=("${file}")
        else
            log_success "Contracts file present: ${file}"
        fi
    done

    # Check contracts dependencies (drizzle-zod, drizzle-orm, zod)
    local contracts_deps=("drizzle-zod" "drizzle-orm" "zod")
    for dep in "${contracts_deps[@]}"; do
        local root_link="${install_root}/node_modules/${dep}"
        local contracts_link="${contracts_root}/node_modules/${dep}"

        # Check root symlink
        if [ -L "${root_link}" ] && [ -e "${root_link}" ]; then
            log_success "${dep} (root) - valid symlink"
        else
            log_error "${dep} (root) - invalid or missing symlink"
            missing_files+=("${dep} (root)")
        fi

        # Check contracts symlink
        if [ -L "${contracts_link}" ] && [ -e "${contracts_link}" ]; then
            log_success "${dep} (contracts) - valid symlink"
        else
            log_error "${dep} (contracts) - invalid or missing symlink"
            missing_files+=("${dep} (contracts)")
        fi
    done

    if [ ${#missing_files[@]} -gt 0 ]; then
        log ""
        log_error "Contracts package validation failed: ${#missing_files[@]} file(s) missing"
        log_info "Run the PNPM symlink recreation script to fix this"
        return 1
    fi

    log_success "Contracts package validated successfully"
    return 0
}

# ============================================================================
# PNPM STORE VALIDATION
# ============================================================================

validate_pnpm_store() {
    local install_root="$1"
    local app_name="$2"

    log_section "Validating PNPM Store for ${app_name}"

    local pnpm_store="${install_root}/node_modules/.pnpm"

    if [ ! -d "${pnpm_store}" ]; then
        log_error "PNPM store not found at ${pnpm_store}"
        log_info "This installation may not have been created with pnpm"
        return 1
    fi

    # Count modules in store
    local store_count
    store_count=$(find "${pnpm_store}" -maxdepth 1 -type d -name "*@*" | wc -l)

    if [ "${store_count}" -eq 0 ]; then
        log_error "PNPM store is empty"
        return 1
    fi

    log_success "PNPM store contains ${store_count} package(s)"

    # Check for broken symlinks
    local broken_count
    broken_count=$(find "${install_root}/node_modules" -type l -! -exec test -e {} \; -print 2>/dev/null | wc -l)

    if [ "${broken_count}" -gt 0 ]; then
        log_warning "Found ${broken_count} broken symlink(s) in node_modules"
        log_info "Run PNPM symlink recreation to fix"
    else
        log_success "No broken symlinks found"
    fi

    return 0
}

# ============================================================================
# MAIN VALIDATION ORCHESTRATOR
# ============================================================================

main() {
    log_section "EscapePlan Dependency Validation"
    log "Started at: $(date)"
    log "Install root: ${INSTALL_ROOT}"
    log "Auto-install: ${AUTO_INSTALL}"
    log "Skip Node check: ${SKIP_NODE_CHECK}"
    log "Strict mode: ${STRICT_MODE}"
    log ""

    local validation_errors=0

    # Step 1: Validate system packages
    if ! validate_system_packages; then
        local exit_code=$?
        if [ ${exit_code} -eq 2 ] || [ ${exit_code} -eq 4 ]; then
            log_error "System package validation failed"
            return ${exit_code}
        fi
        validation_errors=$((validation_errors + 1))
    fi

    # Step 2: Validate Node.js modules (unless skipped)
    if [ "${SKIP_NODE_CHECK}" = false ]; then
        local api_dir="${INSTALL_ROOT}/api"
        local web_dir="${INSTALL_ROOT}/web"

        # Validate API modules
        if [ -d "${api_dir}" ]; then
            if ! validate_node_modules "${api_dir}" "API"; then
                validation_errors=$((validation_errors + 1))
            fi

            if ! validate_pnpm_store "${api_dir}" "API"; then
                if [ "${STRICT_MODE}" = true ]; then
                    validation_errors=$((validation_errors + 1))
                fi
            fi
        else
            log_warning "API directory not found: ${api_dir}"
        fi

        # Validate Web modules
        if [ -d "${web_dir}" ]; then
            if ! validate_node_modules "${web_dir}" "Web"; then
                validation_errors=$((validation_errors + 1))
            fi

            if ! validate_pnpm_store "${web_dir}" "Web"; then
                if [ "${STRICT_MODE}" = true ]; then
                    validation_errors=$((validation_errors + 1))
                fi
            fi
        else
            log_warning "Web directory not found: ${web_dir}"
        fi
    fi

    # Final summary
    log_section "Validation Summary"
    log "Finished at: $(date)"

    if [ ${validation_errors} -eq 0 ]; then
        log_success "All dependency validations passed"
        log ""
        log "EscapePlan is ready for installation!"
        return 0
    else
        log_error "Dependency validation failed with ${validation_errors} error(s)"
        log ""
        log "Please fix the errors above before proceeding with installation"
        return 1
    fi
}

# Run main validation
main "$@"
