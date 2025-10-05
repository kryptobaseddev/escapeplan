#!/bin/bash
#
# EscapePlan Health Check Validation Script
# =========================================
# Validates post-installation deployment health
#
# Exit Codes:
#   0 - All checks passed
#   1 - One or more checks failed
#
# Usage:
#   ./health-check.sh            # Run all checks
#   ./health-check.sh --verbose  # Show detailed output
#

set -euo pipefail

# Configuration
VERBOSE=0
FAILED_CHECKS=0
TOTAL_CHECKS=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
for arg in "$@"; do
    case $arg in
        --verbose|-v)
            VERBOSE=1
            shift
            ;;
    esac
done

# Utility Functions
# ================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

check_start() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ "$VERBOSE" -eq 1 ]; then
        echo -e "\n${BLUE}[CHECK $TOTAL_CHECKS]${NC} $1"
    fi
}

check_pass() {
    log_success "$1"
}

check_fail() {
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    log_error "$1"
}

# Health Check Functions
# =====================

check_database_file() {
    check_start "Database file existence and readability"

    local db_path="/var/lib/escapeplan/escapeplan.db"

    if [ ! -f "$db_path" ]; then
        check_fail "Database file missing at $db_path"
        return 1
    fi

    if [ ! -r "$db_path" ]; then
        check_fail "Database file exists but is not readable at $db_path"
        return 1
    fi

    # Check for WAL and SHM files (expected with WAL mode)
    if [ -f "${db_path}-wal" ] && [ -f "${db_path}-shm" ]; then
        check_pass "Database file exists and is readable (WAL mode active)"
    else
        check_pass "Database file exists and is readable"
    fi

    return 0
}

check_api_service() {
    check_start "API service status"

    if ! systemctl is-enabled escapeplan-api.service >/dev/null 2>&1; then
        check_fail "API service is not enabled"
        return 1
    fi

    if ! systemctl is-active escapeplan-api.service >/dev/null 2>&1; then
        check_fail "API service is not running (use 'systemctl start escapeplan-api')"
        [ "$VERBOSE" -eq 1 ] && systemctl status escapeplan-api.service --no-pager || true
        return 1
    fi

    check_pass "API service is enabled and running"
    return 0
}

check_web_service() {
    check_start "Web service status"

    if ! systemctl is-enabled escapeplan-web.service >/dev/null 2>&1; then
        check_fail "Web service is not enabled"
        return 1
    fi

    if ! systemctl is-active escapeplan-web.service >/dev/null 2>&1; then
        check_fail "Web service is not running (use 'systemctl start escapeplan-web')"
        [ "$VERBOSE" -eq 1 ] && systemctl status escapeplan-web.service --no-pager || true
        return 1
    fi

    check_pass "Web service is enabled and running"
    return 0
}

check_api_http_health() {
    check_start "API HTTP health endpoint"

    # Wait up to 10 seconds for API to respond
    local max_attempts=10
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s -o /dev/null http://localhost:4000/api/health 2>/dev/null; then
            check_pass "API responds to health check at http://localhost:4000/api/health"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    check_fail "API health endpoint not responding at http://localhost:4000/api/health"
    [ "$VERBOSE" -eq 1 ] && log_info "Attempted $max_attempts times over ${max_attempts}s"
    return 1
}

check_web_http_response() {
    check_start "Web service HTTP response"

    # Check if running in production with nginx
    if systemctl is-active nginx.service >/dev/null 2>&1; then
        # In production, check nginx serves the PWA
        if curl -f -s -o /dev/null https://escapeplan.local/ --insecure 2>/dev/null; then
            check_pass "Web app accessible via nginx at https://escapeplan.local/"
            return 0
        else
            check_fail "Web app not accessible via nginx at https://escapeplan.local/"
            return 1
        fi
    else
        # In dev/standalone mode, check if SvelteKit server responds
        # SvelteKit adapter-node runs on port 3000 by default in production
        if curl -f -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
            check_pass "Web service responds at http://localhost:3000/"
            return 0
        else
            check_fail "Web service not responding at http://localhost:3000/"
            [ "$VERBOSE" -eq 1 ] && log_info "Note: nginx not running, checking direct SvelteKit port"
            return 1
        fi
    fi
}

check_required_directories() {
    check_start "Required directories exist"

    local dirs=(
        "/opt/escapeplan"
        "/opt/escapeplan/api"
        "/opt/escapeplan/web"
        "/var/lib/escapeplan"
        "/var/log/escapeplan"
        "/etc/escapeplan"
    )

    local all_exist=1
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            check_fail "Required directory missing: $dir"
            all_exist=0
        fi
    done

    if [ $all_exist -eq 1 ]; then
        check_pass "All required directories exist"
        return 0
    fi

    return 1
}

check_directory_permissions() {
    check_start "Directory ownership and permissions"

    local escapeplan_dirs=(
        "/opt/escapeplan"
        "/var/lib/escapeplan"
        "/var/log/escapeplan"
        "/etc/escapeplan"
    )

    local all_correct=1
    for dir in "${escapeplan_dirs[@]}"; do
        if [ -d "$dir" ]; then
            local owner
            owner=$(stat -c '%U:%G' "$dir")
            if [ "$owner" != "escapeplan:escapeplan" ]; then
                check_fail "Incorrect ownership on $dir (expected escapeplan:escapeplan, got $owner)"
                all_correct=0
            fi
        fi
    done

    if [ $all_correct -eq 1 ]; then
        check_pass "All directories have correct ownership (escapeplan:escapeplan)"
        return 0
    fi

    return 1
}

check_secrets_file() {
    check_start "Environment configuration files"

    local api_env="/etc/escapeplan/api.env"

    # Check if API env file exists
    if [ ! -f "$api_env" ]; then
        check_fail "API environment file missing at $api_env"
        log_warning "Run: cp /opt/escapeplan/api/.env.example /etc/escapeplan/api.env"
        return 1
    fi

    # Check if secrets are configured (not using example values)
    if grep -q "your-secret-key-here" "$api_env" 2>/dev/null; then
        check_fail "BETTER_AUTH_SECRET not configured in $api_env"
        log_warning "Generate with: openssl rand -base64 32"
        return 1
    fi

    if grep -q "00000000000000000000000000000000" "$api_env" 2>/dev/null; then
        check_fail "CAMERA_ENCRYPTION_KEY using development default in $api_env"
        log_warning "Generate with: openssl rand -hex 32"
        return 1
    fi

    # Check file permissions (should be restricted)
    local perms
    perms=$(stat -c '%a' "$api_env")
    if [ "$perms" != "600" ] && [ "$perms" != "640" ]; then
        check_fail "Environment file has permissive permissions ($perms)"
        log_warning "Set secure permissions: chmod 600 $api_env"
        return 1
    fi

    check_pass "Environment file configured with production secrets"
    return 0
}

check_contracts_dist() {
    check_start "Contracts package distribution files"

    local api_contracts="/opt/escapeplan/api/node_modules/@escapeplan/contracts/dist"
    local web_contracts="/opt/escapeplan/web/node_modules/@escapeplan/contracts/dist"

    local all_exist=1

    # Check API contracts
    if [ ! -d "$api_contracts" ]; then
        check_fail "API contracts dist directory missing at $api_contracts"
        all_exist=0
    elif [ ! -f "$api_contracts/index.js" ]; then
        check_fail "API contracts missing index.js"
        all_exist=0
    fi

    # Check Web contracts
    if [ ! -d "$web_contracts" ]; then
        check_fail "Web contracts dist directory missing at $web_contracts"
        all_exist=0
    elif [ ! -f "$web_contracts/index.js" ]; then
        check_fail "Web contracts missing index.js"
        all_exist=0
    fi

    if [ $all_exist -eq 1 ]; then
        check_pass "Contracts distribution files present in API and Web packages"
        return 0
    fi

    return 1
}

check_systemd_services_loaded() {
    check_start "Systemd service files loaded"

    local services=(
        "escapeplan-api.service"
        "escapeplan-web.service"
    )

    local all_loaded=1
    for service in "${services[@]}"; do
        if ! systemctl list-unit-files | grep -q "$service"; then
            check_fail "Systemd service not loaded: $service"
            all_loaded=0
        fi
    done

    if [ $all_loaded -eq 1 ]; then
        check_pass "All systemd service files loaded"
        return 0
    fi

    return 1
}

check_escapeplan_user() {
    check_start "System user 'escapeplan' exists"

    if ! id escapeplan >/dev/null 2>&1; then
        check_fail "System user 'escapeplan' does not exist"
        return 1
    fi

    check_pass "System user 'escapeplan' exists"
    return 0
}

check_node_installation() {
    check_start "Node.js installation"

    if ! command -v node >/dev/null 2>&1; then
        check_fail "Node.js not installed or not in PATH"
        return 1
    fi

    local node_version
    node_version=$(node --version)
    check_pass "Node.js installed ($node_version)"
    return 0
}

# Main Execution
# =============

main() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  EscapePlan Health Check Validation${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    # Pre-flight checks
    check_escapeplan_user || true
    check_node_installation || true

    # Directory structure checks
    check_required_directories || true
    check_directory_permissions || true

    # Package integrity checks
    check_contracts_dist || true

    # Configuration checks
    check_secrets_file || true

    # Service checks
    check_systemd_services_loaded || true
    check_api_service || true
    check_web_service || true

    # Runtime health checks
    check_database_file || true
    check_api_http_health || true
    check_web_http_response || true

    # Summary
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Health Check Summary${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    local passed_checks=$((TOTAL_CHECKS - FAILED_CHECKS))

    if [ $FAILED_CHECKS -eq 0 ]; then
        log_success "All $TOTAL_CHECKS checks passed!"
        echo ""
        log_info "EscapePlan is healthy and ready for operation"
        echo ""
        exit 0
    else
        log_error "$FAILED_CHECKS of $TOTAL_CHECKS checks failed"
        echo ""
        log_info "Review the errors above and take corrective action"

        # Provide helpful next steps
        if ! systemctl is-active escapeplan-api.service >/dev/null 2>&1; then
            echo ""
            log_info "To start services:"
            echo "  systemctl start escapeplan-api"
            echo "  systemctl start escapeplan-web"
        fi

        echo ""
        exit 1
    fi
}

# Run main function
main "$@"
