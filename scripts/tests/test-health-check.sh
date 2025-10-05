#!/bin/bash
#
# Health Check Script Test Suite
# ===============================
# Validates the health-check.sh script logic
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTH_CHECK_SCRIPT="${SCRIPT_DIR}/../health-check.sh"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

test_start() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -e "\n${BLUE}[TEST $TESTS_RUN]${NC} $1"
}

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASS${NC}: $1"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}✗ FAIL${NC}: $1"
}

# Test 1: Script exists and is executable
test_start "Script file existence and permissions"
if [ -f "$HEALTH_CHECK_SCRIPT" ]; then
    if [ -x "$HEALTH_CHECK_SCRIPT" ]; then
        test_pass "Health check script exists and is executable"
    else
        test_fail "Health check script exists but is not executable"
    fi
else
    test_fail "Health check script not found at $HEALTH_CHECK_SCRIPT"
fi

# Test 2: Script has valid bash syntax
test_start "Script syntax validation"
if bash -n "$HEALTH_CHECK_SCRIPT" 2>/dev/null; then
    test_pass "Script has valid bash syntax"
else
    test_fail "Script has syntax errors"
fi

# Test 3: Script contains all required check functions
test_start "Required check functions present"
required_functions=(
    "check_database_file"
    "check_api_service"
    "check_web_service"
    "check_api_http_health"
    "check_web_http_response"
    "check_required_directories"
    "check_directory_permissions"
    "check_secrets_file"
    "check_contracts_dist"
    "check_systemd_services_loaded"
    "check_escapeplan_user"
    "check_node_installation"
)

all_functions_present=1
for func in "${required_functions[@]}"; do
    if ! grep -q "^${func}()" "$HEALTH_CHECK_SCRIPT"; then
        test_fail "Missing check function: $func"
        all_functions_present=0
    fi
done

if [ $all_functions_present -eq 1 ]; then
    test_pass "All required check functions present"
fi

# Test 4: Exit codes are defined correctly
test_start "Exit code logic validation"
if grep -q "exit 0" "$HEALTH_CHECK_SCRIPT" && grep -q "exit 1" "$HEALTH_CHECK_SCRIPT"; then
    test_pass "Script defines proper exit codes (0 for success, 1 for failure)"
else
    test_fail "Script missing proper exit code definitions"
fi

# Test 5: Color codes are defined
test_start "Output formatting (color codes)"
if grep -q "RED=" "$HEALTH_CHECK_SCRIPT" && \
   grep -q "GREEN=" "$HEALTH_CHECK_SCRIPT" && \
   grep -q "BLUE=" "$HEALTH_CHECK_SCRIPT"; then
    test_pass "Color codes defined for formatted output"
else
    test_fail "Missing color code definitions"
fi

# Test 6: Verbose flag support
test_start "Verbose mode flag support"
if grep -q "\-\-verbose" "$HEALTH_CHECK_SCRIPT"; then
    test_pass "Verbose mode flag supported"
else
    test_fail "Verbose mode flag not found"
fi

# Test 7: Check for critical paths validation
test_start "Critical system paths checked"
critical_paths=(
    "/var/lib/escapeplan/escapeplan.db"
    "/opt/escapeplan/api"
    "/opt/escapeplan/web"
    "/etc/escapeplan"
    "/var/log/escapeplan"
)

all_paths_checked=1
for path in "${critical_paths[@]}"; do
    if ! grep -q "$path" "$HEALTH_CHECK_SCRIPT"; then
        test_fail "Critical path not checked: $path"
        all_paths_checked=0
    fi
done

if [ $all_paths_checked -eq 1 ]; then
    test_pass "All critical system paths are validated"
fi

# Test 8: Service status checks
test_start "Service status validation"
if grep -q "systemctl is-active escapeplan-api" "$HEALTH_CHECK_SCRIPT" && \
   grep -q "systemctl is-active escapeplan-web" "$HEALTH_CHECK_SCRIPT"; then
    test_pass "Script checks systemd service status"
else
    test_fail "Missing systemd service status checks"
fi

# Test 9: HTTP health endpoint validation
test_start "HTTP health endpoint checks"
if grep -q "curl.*localhost:4000.*health" "$HEALTH_CHECK_SCRIPT"; then
    test_pass "Script validates API HTTP health endpoint"
else
    test_fail "Missing API HTTP health check"
fi

# Test 10: Secrets configuration validation
test_start "Secrets and environment validation"
if grep -q "BETTER_AUTH_SECRET" "$HEALTH_CHECK_SCRIPT" && \
   grep -q "CAMERA_ENCRYPTION_KEY" "$HEALTH_CHECK_SCRIPT"; then
    test_pass "Script validates environment secrets configuration"
else
    test_fail "Missing secrets validation"
fi

# Test 11: Contracts dist files check
test_start "Contracts package distribution validation"
if grep -q "@escapeplan/contracts/dist" "$HEALTH_CHECK_SCRIPT"; then
    test_pass "Script validates contracts dist files"
else
    test_fail "Missing contracts dist validation"
fi

# Test 12: Permission checks
test_start "File and directory permission validation"
if grep -q "stat.*%U:%G" "$HEALTH_CHECK_SCRIPT" || \
   grep -q "stat.*%a" "$HEALTH_CHECK_SCRIPT"; then
    test_pass "Script checks file/directory permissions"
else
    test_fail "Missing permission validation"
fi

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Suite Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
else
    echo -e "Tests Failed: $TESTS_FAILED"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed!${NC}"
    echo ""
    exit 1
fi
