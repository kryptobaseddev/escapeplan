#!/bin/bash
#
# Quick ARM64 Validation Test
# ============================
# Validates ARM64 test infrastructure without full end-to-end test
# This is a smoke test to verify Docker + QEMU setup works
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_error() {
    echo -e "${RED}[✗]${NC} $*"
}

echo ""
echo "ARM64 Test Infrastructure Validation"
echo "====================================="
echo ""

# Test 1: Docker available
log_info "Checking Docker availability..."
if command -v docker &> /dev/null; then
    log_success "Docker installed: $(docker --version)"
else
    log_error "Docker not found"
    exit 1
fi

# Test 2: ARM64 emulation works
log_info "Testing ARM64 emulation..."
ARCH=$(docker run --rm --platform linux/arm64 alpine uname -m 2>&1)
if [ "$ARCH" = "aarch64" ]; then
    log_success "ARM64 emulation working (architecture: $ARCH)"
else
    log_error "ARM64 emulation failed (got: $ARCH)"
    exit 1
fi

# Test 3: .deb package exists
log_info "Checking for .deb package..."
DEB_PATH=$(find "${PROJECT_ROOT}/dist" -name "escapeplan_*_arm64.deb" -type f 2>/dev/null | head -n1)
if [ -n "$DEB_PATH" ]; then
    log_success "Found .deb package: $(basename "$DEB_PATH") ($(du -h "$DEB_PATH" | cut -f1))"
else
    log_info "No .deb package found (will need to build before testing)"
fi

# Test 4: Quick container test
log_info "Testing ARM64 container creation..."
CONTAINER_ID=$(docker run -d --rm --platform linux/arm64 debian:12 sleep 30 2>&1)
if [ -n "$CONTAINER_ID" ]; then
    log_success "ARM64 container created: ${CONTAINER_ID:0:12}"

    # Test command execution
    log_info "Testing command execution in container..."
    RESULT=$(docker exec "$CONTAINER_ID" bash -c 'echo "Hello from ARM64" && uname -m' 2>&1)
    if echo "$RESULT" | grep -q "aarch64"; then
        log_success "Container command execution working"
    else
        log_error "Container command failed: $RESULT"
    fi

    # Cleanup
    docker stop "$CONTAINER_ID" >/dev/null 2>&1 || true
else
    log_error "Failed to create ARM64 container"
    exit 1
fi

# Test 5: Test script exists and is executable
log_info "Checking test script..."
TEST_SCRIPT="${SCRIPT_DIR}/test-arm64-emulated.sh"
if [ -x "$TEST_SCRIPT" ]; then
    log_success "Test script ready: test-arm64-emulated.sh"
else
    log_error "Test script not found or not executable"
    exit 1
fi

echo ""
log_success "All infrastructure checks passed!"
echo ""
log_info "Ready to run full ARM64 tests:"
echo "  ./scripts/tests/test-arm64-emulated.sh --skip-build"
echo ""
