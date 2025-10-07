#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
TOTAL=0

# Test result function
test_result() {
    local test_name="$1"
    local result="$2"
    local message="${3:-}"

    TOTAL=$((TOTAL + 1))

    if [ "$result" -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $test_name"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}[FAIL]${NC} $test_name"
        if [ -n "$message" ]; then
            echo -e "       ${YELLOW}$message${NC}"
        fi
        FAILED=$((FAILED + 1))
    fi
}

echo "========================================"
echo "App Package Validation Test Suite"
echo "========================================"
echo ""

# Test 1: Base OS Installed Check
echo "Test 1: Checking if base OS is installed..."
if [ -f "/etc/os-release" ] && grep -q "Fedora\|Ubuntu\|Debian" /etc/os-release 2>/dev/null; then
    test_result "Base OS installed" 0
else
    test_result "Base OS installed" 1 "Could not detect supported base OS (Fedora/Ubuntu/Debian)"
fi

# Test 2: No apt-get in Scripts Check
echo "Test 2: Checking for apt-get commands in scripts..."
if grep -r "apt-get" scripts/ 2>/dev/null | grep -v "test-app-package.sh" | grep -q .; then
    test_result "No apt-get in scripts" 1 "Found apt-get commands in scripts (should use base OS)"
else
    test_result "No apt-get in scripts" 0
fi

# Test 3: No nmcli in Scripts Check
echo "Test 3: Checking for nmcli commands in scripts..."
if grep -r "nmcli" scripts/ 2>/dev/null | grep -v "test-app-package.sh" | grep -q .; then
    test_result "No nmcli in scripts" 1 "Found nmcli commands in scripts (should use base OS)"
else
    test_result "No nmcli in scripts" 0
fi

# Test 4: Native Modules Rebuilt Check
echo "Test 4: Checking if native modules can be rebuilt..."
if [ -f "package.json" ]; then
    if command -v npm >/dev/null 2>&1; then
        if npm list 2>/dev/null | grep -q "better-sqlite3\|bcrypt"; then
            # Check if node-gyp is available
            if command -v node-gyp >/dev/null 2>&1 || npm list node-gyp >/dev/null 2>&1; then
                test_result "Native modules rebuild support" 0
            else
                test_result "Native modules rebuild support" 1 "node-gyp not available for rebuilding native modules"
            fi
        else
            test_result "Native modules rebuild support" 0 "No native modules detected"
        fi
    else
        test_result "Native modules rebuild support" 1 "npm not available"
    fi
else
    test_result "Native modules rebuild support" 1 "package.json not found"
fi

# Test 5: Database Initialized Check
echo "Test 5: Checking if database initialization is configured..."
if [ -f "scripts/init-db.sh" ] || [ -f "prisma/schema.prisma" ] || grep -q "database.*init" scripts/*.sh 2>/dev/null; then
    test_result "Database initialization configured" 0
else
    test_result "Database initialization configured" 1 "No database initialization scripts or schema found"
fi

# Test 6: Secrets Generated Check
echo "Test 6: Checking if secrets generation is configured..."
if [ -f "scripts/generate-secrets.sh" ] || grep -q "JWT_SECRET\|SESSION_SECRET" scripts/*.sh 2>/dev/null; then
    test_result "Secrets generation configured" 0
else
    test_result "Secrets generation configured" 1 "No secrets generation mechanism found"
fi

# Test 7: Nginx Configured Check
echo "Test 7: Checking if Nginx configuration exists..."
if [ -f "config/nginx.conf" ] || [ -f "nginx.conf" ] || [ -f "scripts/configure-nginx.sh" ]; then
    test_result "Nginx configuration exists" 0
else
    test_result "Nginx configuration exists" 1 "No Nginx configuration files found"
fi

# Test 8: Services Registered Check
echo "Test 8: Checking if systemd service files exist..."
if [ -f "config/escapeplan.service" ] || [ -f "escapeplan.service" ] || find . -name "*.service" 2>/dev/null | grep -q .; then
    test_result "Systemd service files exist" 0
else
    test_result "Systemd service files exist" 1 "No systemd service files found"
fi

# Test 9: Package.json Integrity Check
echo "Test 9: Checking package.json integrity..."
if [ -f "package.json" ]; then
    if node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" 2>/dev/null; then
        test_result "Package.json valid JSON" 0
    else
        test_result "Package.json valid JSON" 1 "package.json contains invalid JSON"
    fi
else
    test_result "Package.json valid JSON" 1 "package.json not found"
fi

# Test 10: Build Script Exists Check
echo "Test 10: Checking if build scripts exist..."
if [ -f "package.json" ]; then
    if grep -q '"build"' package.json; then
        test_result "Build script configured" 0
    else
        test_result "Build script configured" 1 "No build script found in package.json"
    fi
else
    test_result "Build script configured" 1 "package.json not found"
fi

# Summary
echo ""
echo "========================================"
echo "Test Suite Summary"
echo "========================================"
echo -e "Total Tests:  $TOTAL"
echo -e "${GREEN}Passed:       $PASSED${NC}"
echo -e "${RED}Failed:       $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
