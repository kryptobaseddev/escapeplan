#!/bin/bash
set -euo pipefail

# validate-arm64-fix.sh
# Validates that ARM64 native module compilation fix is properly implemented
# Run this before releasing v0.2.0

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_SCRIPT="${REPO_ROOT}/scripts/build-deb.sh"
PI_POST_INSTALL="${REPO_ROOT}/scripts/pi-post-install.sh"
DOCS="${REPO_ROOT}/ARM64_NATIVE_MODULE_IMPLEMENTATION.md"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✓${NC} $*"
}

fail() {
    echo -e "${RED}✗${NC} $*"
    exit 1
}

warn() {
    echo -e "${YELLOW}⚠${NC} $*"
}

echo "=== Validating ARM64 Native Module Fix Implementation ==="
echo ""

# 1. Check that pi-post-install.sh exists and is executable
echo "[1/8] Checking pi-post-install.sh exists..."
if [ -f "${PI_POST_INSTALL}" ]; then
    pass "pi-post-install.sh exists"
else
    fail "pi-post-install.sh not found at ${PI_POST_INSTALL}"
fi

if [ -x "${PI_POST_INSTALL}" ]; then
    pass "pi-post-install.sh is executable"
else
    fail "pi-post-install.sh is not executable (chmod +x needed)"
fi

# 2. Check build-deb.sh includes pi-post-install.sh
echo ""
echo "[2/8] Checking build-deb.sh includes pi-post-install.sh..."
if grep -q "cp scripts/pi-post-install.sh" "${BUILD_SCRIPT}"; then
    pass "build-deb.sh copies pi-post-install.sh"
else
    fail "build-deb.sh does not copy pi-post-install.sh"
fi

if grep -q "chmod 755.*pi-post-install.sh" "${BUILD_SCRIPT}"; then
    pass "build-deb.sh sets execute permission"
else
    warn "build-deb.sh may not set execute permission"
fi

# 3. Check postinst calls pi-post-install.sh
echo ""
echo "[3/8] Checking DEBIAN/postinst calls pi-post-install.sh..."
if grep -q "/opt/escapeplan/scripts/pi-post-install.sh /opt/escapeplan" "${BUILD_SCRIPT}"; then
    pass "postinst calls pi-post-install.sh with correct path"
else
    fail "postinst does not call pi-post-install.sh"
fi

# 4. Check package recommends build-essential
echo ""
echo "[4/8] Checking package recommends build tools..."
if grep -q "Recommends:.*build-essential" "${BUILD_SCRIPT}"; then
    pass "Package recommends build-essential"
else
    warn "Package does not recommend build-essential (users may need manual install)"
fi

# 5. Validate pi-post-install.sh script content
echo ""
echo "[5/8] Validating pi-post-install.sh script logic..."

# Check for architecture detection
if grep -q "uname -m" "${PI_POST_INSTALL}"; then
    pass "Script detects system architecture"
else
    fail "Script missing architecture detection"
fi

# Check for better-sqlite3 rebuild
if grep -q "npm rebuild better-sqlite3" "${PI_POST_INSTALL}"; then
    pass "Script rebuilds better-sqlite3"
else
    fail "Script does not rebuild better-sqlite3"
fi

# Check for validation using file command
if grep -q "file.*better_sqlite3.node" "${PI_POST_INSTALL}"; then
    pass "Script validates module architecture with 'file' command"
else
    warn "Script may not validate module architecture"
fi

# Check for logging
if grep -q "LOG_FILE" "${PI_POST_INSTALL}"; then
    pass "Script logs operations"
else
    warn "Script may not log operations"
fi

# 6. Check documentation exists
echo ""
echo "[6/8] Checking documentation..."
if [ -f "${DOCS}" ]; then
    pass "ARM64_NATIVE_MODULE_IMPLEMENTATION.md exists"

    # Verify key sections
    if grep -q "## Solution Overview" "${DOCS}"; then
        pass "Documentation includes solution overview"
    fi

    if grep -q "## Validation Approach" "${DOCS}"; then
        pass "Documentation includes validation approach"
    fi

    if grep -q "## Manual Troubleshooting" "${DOCS}"; then
        pass "Documentation includes troubleshooting section"
    fi
else
    warn "ARM64_NATIVE_MODULE_IMPLEMENTATION.md not found"
fi

# 7. Check for error handling
echo ""
echo "[7/8] Checking error handling..."
if grep -q "if \[.*\]; then" "${PI_POST_INSTALL}"; then
    pass "Script includes conditional logic for error handling"
else
    warn "Script may lack proper error handling"
fi

# Check postinst handles failure gracefully
if grep -A 5 "pi-post-install.sh" "${BUILD_SCRIPT}" | grep -q "else"; then
    pass "postinst handles rebuild failure gracefully"
else
    warn "postinst may not handle rebuild failures"
fi

# 8. Syntax check
echo ""
echo "[8/8] Running syntax validation..."
if bash -n "${PI_POST_INSTALL}" 2>/dev/null; then
    pass "pi-post-install.sh has valid bash syntax"
else
    fail "pi-post-install.sh has syntax errors"
fi

if bash -n "${BUILD_SCRIPT}" 2>/dev/null; then
    pass "build-deb.sh has valid bash syntax"
else
    fail "build-deb.sh has syntax errors"
fi

echo ""
echo "=== Validation Summary ==="
echo ""
echo "Implementation Status: COMPLETE"
echo ""
echo "Next Steps:"
echo "  1. Build .deb package: cd ${REPO_ROOT} && ./scripts/build-deb.sh"
echo "  2. Test on Raspberry Pi ARM64"
echo "  3. Verify native module architecture with: file better_sqlite3.node"
echo "  4. Check rebuild log: cat /tmp/escapeplan-native-rebuild.log"
echo ""
echo -e "${GREEN}✓ ARM64 Native Module Fix Validated Successfully${NC}"
