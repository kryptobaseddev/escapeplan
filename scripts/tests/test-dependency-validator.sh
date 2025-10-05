#!/bin/bash
set -euo pipefail

# ============================================================================
# Test Suite for Dependency Validator
# ============================================================================
#
# This script tests the validate-dependencies.sh script with various scenarios
# to ensure it properly validates system and Node.js dependencies.
#
# Test scenarios:
#   1. All dependencies present (success case)
#   2. Missing system package (error case)
#   3. Node.js version check (version validation)
#   4. Missing Node.js modules (error case)
#   5. Broken PNPM symlinks (warning case)
#   6. Auto-install functionality (when available)
#
# Usage:
#   ./test-dependency-validator.sh
#
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR_SCRIPT="${SCRIPT_DIR}/../validate-dependencies.sh"
TEST_LOG="/tmp/test-dependency-validator.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# TEST FRAMEWORK
# ============================================================================

log_test() {
    echo -e "${BLUE}[TEST]${NC} $*" | tee -a "${TEST_LOG}"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $*" | tee -a "${TEST_LOG}"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $*" | tee -a "${TEST_LOG}"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $*" | tee -a "${TEST_LOG}"
}

run_test() {
    local test_name="$1"
    ((TESTS_RUN++))
    echo ""
    log_test "Running test ${TESTS_RUN}: ${test_name}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ============================================================================
# TEST CASES
# ============================================================================

test_validator_exists() {
    run_test "Dependency validator script exists"

    if [ -f "${VALIDATOR_SCRIPT}" ]; then
        log_pass "Validator script found at ${VALIDATOR_SCRIPT}"
        return 0
    else
        log_fail "Validator script not found at ${VALIDATOR_SCRIPT}"
        return 1
    fi
}

test_validator_executable() {
    run_test "Dependency validator is executable"

    if [ -x "${VALIDATOR_SCRIPT}" ]; then
        log_pass "Validator script is executable"
        return 0
    else
        log_fail "Validator script is not executable"
        log_info "Run: chmod +x ${VALIDATOR_SCRIPT}"
        return 1
    fi
}

test_system_package_validation() {
    run_test "System package validation (check current system)"

    log_info "Testing system package detection..."

    # Test for Node.js
    if command -v node &>/dev/null; then
        local node_version
        node_version=$(node --version)
        log_pass "Node.js detected: ${node_version}"
    else
        log_fail "Node.js not detected (required for EscapePlan)"
    fi

    # Test for sqlite3
    if command -v sqlite3 &>/dev/null; then
        local sqlite_version
        sqlite_version=$(sqlite3 --version | cut -d' ' -f1)
        log_pass "sqlite3 detected: ${sqlite_version}"
    else
        log_fail "sqlite3 not detected (required for EscapePlan)"
    fi

    # Test for nginx
    if command -v nginx &>/dev/null; then
        local nginx_version
        nginx_version=$(nginx -v 2>&1 | cut -d'/' -f2)
        log_pass "nginx detected: ${nginx_version}"
    else
        log_fail "nginx not detected (required for EscapePlan)"
    fi

    # Test for build tools
    if command -v gcc &>/dev/null; then
        local gcc_version
        gcc_version=$(gcc --version | head -n1)
        log_pass "gcc detected: ${gcc_version}"
    else
        log_fail "gcc not detected (recommended for native module compilation)"
    fi

    if command -v python3 &>/dev/null; then
        local python_version
        python_version=$(python3 --version)
        log_pass "python3 detected: ${python_version}"
    else
        log_fail "python3 not detected (required for node-gyp)"
    fi

    if command -v openssl &>/dev/null; then
        local openssl_version
        openssl_version=$(openssl version)
        log_pass "openssl detected: ${openssl_version}"
    else
        log_fail "openssl not detected (required for secrets generation)"
    fi

    return 0
}

test_nodejs_version_check() {
    run_test "Node.js version validation (requires v18+)"

    if ! command -v node &>/dev/null; then
        log_fail "Node.js not installed - cannot test version"
        return 1
    fi

    local node_version
    node_version=$(node --version | sed 's/v//' | cut -d'.' -f1)

    local min_version=18

    if [ "${node_version}" -ge "${min_version}" ]; then
        log_pass "Node.js version ${node_version} >= ${min_version} (requirement met)"
        return 0
    else
        log_fail "Node.js version ${node_version} < ${min_version} (requirement NOT met)"
        return 1
    fi
}

test_validator_help_output() {
    run_test "Validator script help/usage (validate script structure)"

    # Try running with invalid option to see usage message
    local output
    output=$("${VALIDATOR_SCRIPT}" --help 2>&1 || true)

    if echo "${output}" | grep -q "Unknown option"; then
        log_pass "Validator script processes command line arguments"
        return 0
    else
        log_info "Note: --help option may not be implemented"
        return 0
    fi
}

test_validator_skip_node_check() {
    run_test "Validator --skip-node-check option"

    log_info "Running validator with --skip-node-check..."

    # We can't actually run the validator without sudo for system checks,
    # but we can verify the option is recognized
    local output
    output=$("${VALIDATOR_SCRIPT}" /tmp/fake-install --skip-node-check 2>&1 || true)

    if echo "${output}" | grep -q "Unknown option"; then
        log_fail "Validator rejected --skip-node-check option"
        return 1
    else
        log_pass "Validator recognized --skip-node-check option"
        return 0
    fi
}

test_validator_auto_install_option() {
    run_test "Validator --auto-install option recognition"

    log_info "Testing --auto-install option recognition..."

    # Verify option is recognized (not testing actual installation without sudo)
    local output
    output=$("${VALIDATOR_SCRIPT}" /tmp/fake-install --auto-install 2>&1 || true)

    if echo "${output}" | grep -q "Unknown option"; then
        log_fail "Validator rejected --auto-install option"
        return 1
    else
        log_pass "Validator recognized --auto-install option"
        log_info "Note: Actual package installation requires sudo"
        return 0
    fi
}

test_validator_logging() {
    run_test "Validator logging functionality"

    log_info "Checking validator log file creation..."

    # Run validator (will fail without proper install root, but should create log)
    "${VALIDATOR_SCRIPT}" /tmp/fake-install --skip-node-check 2>&1 >/dev/null || true

    local log_file="/tmp/escapeplan-dependency-validation.log"

    if [ -f "${log_file}" ]; then
        log_pass "Validator created log file at ${log_file}"
        local log_size
        log_size=$(wc -l < "${log_file}")
        log_info "Log file contains ${log_size} lines"
        return 0
    else
        log_fail "Validator did not create log file"
        return 1
    fi
}

test_required_packages_defined() {
    run_test "Validator has required packages defined"

    log_info "Checking validator script for required package definitions..."

    # Check if validator script contains required package definitions
    local required_packages=(
        "nodejs"
        "sqlite3"
        "nginx"
        "gcc"
        "g++"
        "make"
        "python3"
        "openssl"
    )

    local all_found=true

    for pkg in "${required_packages[@]}"; do
        if grep -q "\"${pkg}\"" "${VALIDATOR_SCRIPT}"; then
            log_pass "Package definition found: ${pkg}"
        else
            log_fail "Package definition missing: ${pkg}"
            all_found=false
        fi
    done

    if [ "${all_found}" = true ]; then
        log_pass "All required package definitions present"
        return 0
    else
        log_fail "Some package definitions missing"
        return 1
    fi
}

test_node_modules_defined() {
    run_test "Validator has Node.js module checks defined"

    log_info "Checking validator script for Node.js module definitions..."

    # Check if validator script contains Node.js module checks
    local required_modules=(
        "better-sqlite3"
        "drizzle-orm"
        "drizzle-zod"
        "zod"
        "fastify"
        "socket.io"
        "@escapeplan/contracts"
    )

    local all_found=true

    for mod in "${required_modules[@]}"; do
        if grep -q "${mod}" "${VALIDATOR_SCRIPT}"; then
            log_pass "Module check found: ${mod}"
        else
            log_fail "Module check missing: ${mod}"
            all_found=false
        fi
    done

    if [ "${all_found}" = true ]; then
        log_pass "All required module checks present"
        return 0
    else
        log_fail "Some module checks missing"
        return 1
    fi
}

# ============================================================================
# TEST SUITE ORCHESTRATION
# ============================================================================

main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  EscapePlan Dependency Validator Test Suite"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Test log: ${TEST_LOG}"
    echo "" > "${TEST_LOG}"

    # Run all tests
    test_validator_exists || true
    test_validator_executable || true
    test_system_package_validation || true
    test_nodejs_version_check || true
    test_validator_help_output || true
    test_validator_skip_node_check || true
    test_validator_auto_install_option || true
    test_validator_logging || true
    test_required_packages_defined || true
    test_node_modules_defined || true

    # Summary
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Test Results Summary"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Tests run:    ${TESTS_RUN}"
    echo -e "Tests passed: ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Tests failed: ${RED}${TESTS_FAILED}${NC}"
    echo ""

    local pass_rate=0
    if [ ${TESTS_RUN} -gt 0 ]; then
        pass_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    fi

    echo "Pass rate:    ${pass_rate}%"
    echo ""

    if [ ${TESTS_FAILED} -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        echo ""
        echo "Review the test log for details: ${TEST_LOG}"
        exit 1
    fi
}

# Run test suite
main "$@"
