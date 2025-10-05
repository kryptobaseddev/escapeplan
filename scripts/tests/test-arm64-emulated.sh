#!/bin/bash
#
# ARM64 Emulated .deb Package End-to-End Test
# ============================================
# Tests .deb package installation and health validation in ARM64 environment
#
# This script provides multiple testing approaches:
#   1. Docker with QEMU ARM64 emulation
#   2. GitHub Actions ARM64 runners (via workflow)
#   3. Local QEMU user-mode emulation
#
# Exit Codes:
#   0 - All tests passed
#   1 - Test failure or setup error
#   2 - Prerequisites missing
#
# Usage:
#   ./test-arm64-emulated.sh [OPTIONS]
#
# Options:
#   --method=docker          Use Docker with ARM64 platform (default)
#   --method=qemu            Use QEMU user-mode emulation
#   --deb=<path>             Path to .deb file (auto-detected if not specified)
#   --keep-container         Don't remove container after test (for debugging)
#   --verbose                Show detailed output
#   --skip-build             Skip building .deb (use existing)
#   --interactive            Drop into shell on failure
#
# Requirements:
#   - Docker with QEMU support (for docker method)
#   - qemu-user-static (for qemu method)
#   - pnpm (if building .deb)
#
# Examples:
#   # Run full test with auto-build
#   ./test-arm64-emulated.sh
#
#   # Test existing .deb file
#   ./test-arm64-emulated.sh --deb=dist/escapeplan_0.1.0_arm64.deb --skip-build
#
#   # Debug failed installation
#   ./test-arm64-emulated.sh --keep-container --interactive --verbose
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEST_METHOD="docker"
DEB_PATH=""
KEEP_CONTAINER=false
VERBOSE=false
SKIP_BUILD=false
INTERACTIVE=false
CONTAINER_NAME="escapeplan-arm64-test-$$"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
for arg in "$@"; do
    case $arg in
        --method=*)
            TEST_METHOD="${arg#*=}"
            shift
            ;;
        --deb=*)
            DEB_PATH="${arg#*=}"
            shift
            ;;
        --keep-container)
            KEEP_CONTAINER=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --interactive|-i)
            INTERACTIVE=true
            KEEP_CONTAINER=true
            shift
            ;;
        --help|-h)
            grep '^#' "$0" | grep -v '#!/bin/bash' | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $*"
}

log_error() {
    echo -e "${RED}[✗]${NC} $*"
}

log_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $*${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    if [ "$KEEP_CONTAINER" = false ] && [ -n "${CONTAINER_ID:-}" ]; then
        log_info "Cleaning up container ${CONTAINER_ID}"
        docker rm -f "${CONTAINER_ID}" >/dev/null 2>&1 || true
    fi
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"

    local missing_deps=()

    if [ "$TEST_METHOD" = "docker" ]; then
        if ! command -v docker &> /dev/null; then
            missing_deps+=("docker")
        else
            log_success "Docker installed"

            # Check if Docker supports ARM64 emulation
            if docker run --rm --platform linux/arm64 alpine uname -m 2>/dev/null | grep -q "aarch64"; then
                log_success "Docker ARM64 emulation available"
            else
                log_error "Docker ARM64 emulation not available"
                log_info "Install with: docker run --rm --privileged multiarch/qemu-user-static --reset -p yes"
                missing_deps+=("docker-arm64-support")
            fi
        fi
    elif [ "$TEST_METHOD" = "qemu" ]; then
        if ! command -v qemu-aarch64-static &> /dev/null; then
            missing_deps+=("qemu-user-static")
        else
            log_success "QEMU user-mode emulation installed"
        fi
    fi

    if [ "$SKIP_BUILD" = false ] && ! command -v pnpm &> /dev/null; then
        missing_deps+=("pnpm")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing prerequisites: ${missing_deps[*]}"
        log_info "Install missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            case $dep in
                docker)
                    log_info "  - Docker: https://docs.docker.com/get-docker/"
                    ;;
                qemu-user-static)
                    log_info "  - QEMU: sudo apt-get install -y qemu-user-static"
                    ;;
                pnpm)
                    log_info "  - pnpm: npm install -g pnpm"
                    ;;
                docker-arm64-support)
                    log_info "  - Docker ARM64: docker run --rm --privileged multiarch/qemu-user-static --reset -p yes"
                    ;;
            esac
        done
        return 1
    fi

    log_success "All prerequisites met"
    return 0
}

# Build .deb package
build_deb() {
    log_section "Building .deb Package"

    cd "${PROJECT_ROOT}"

    log_info "Installing dependencies..."
    if [ "$VERBOSE" = true ]; then
        pnpm install --frozen-lockfile
    else
        pnpm install --frozen-lockfile > /dev/null 2>&1
    fi

    log_info "Building contracts..."
    if [ "$VERBOSE" = true ]; then
        pnpm --filter @escapeplan/contracts build
    else
        pnpm --filter @escapeplan/contracts build > /dev/null 2>&1
    fi

    log_info "Building API..."
    if [ "$VERBOSE" = true ]; then
        pnpm --filter escapeplan-api build
    else
        pnpm --filter escapeplan-api build > /dev/null 2>&1
    fi

    log_info "Building Web..."
    if [ "$VERBOSE" = true ]; then
        pnpm --filter escapeplan-web build
    else
        pnpm --filter escapeplan-web build > /dev/null 2>&1
    fi

    log_info "Building .deb package..."
    if [ "$VERBOSE" = true ]; then
        ./scripts/build-deb.sh
    else
        ./scripts/build-deb.sh > /dev/null 2>&1
    fi

    # Find the built .deb
    DEB_PATH=$(find dist -name "escapeplan_*_arm64.deb" -type f | head -n1)

    if [ -z "$DEB_PATH" ]; then
        log_error "Failed to find built .deb package in dist/"
        return 1
    fi

    log_success "Built package: ${DEB_PATH}"
    return 0
}

# Test using Docker with ARM64 platform
test_docker_arm64() {
    log_section "Testing with Docker ARM64 Emulation"

    local deb_filename
    deb_filename=$(basename "${DEB_PATH}")

    log_info "Creating ARM64 Debian container..."

    # Use Debian 12 (bookworm) ARM64 base image
    CONTAINER_ID=$(docker run -d \
        --platform linux/arm64 \
        --name "${CONTAINER_NAME}" \
        -v "${PROJECT_ROOT}:/workspace:ro" \
        debian:12 \
        sleep infinity)

    log_success "Container created: ${CONTAINER_ID:0:12}"

    log_info "Container architecture: $(docker exec "${CONTAINER_ID}" uname -m)"

    # Install dependencies in container
    log_info "Installing dependencies in container..."
    docker exec "${CONTAINER_ID}" bash -c "
        apt-get update -qq &&
        apt-get install -y -qq \
            nodejs \
            npm \
            nginx \
            sqlite3 \
            build-essential \
            python3 \
            curl \
            file \
            > /dev/null 2>&1
    " || {
        log_error "Failed to install dependencies"
        return 1
    }

    log_success "Dependencies installed"

    # Copy .deb to container
    log_info "Installing .deb package..."
    docker exec "${CONTAINER_ID}" bash -c "
        dpkg -i /workspace/${DEB_PATH} 2>&1 || true
        apt-get install -f -y -qq > /dev/null 2>&1
    " || {
        log_error "Failed to install .deb package"
        if [ "$INTERACTIVE" = true ]; then
            log_info "Dropping into container shell for debugging..."
            docker exec -it "${CONTAINER_ID}" bash
        fi
        return 1
    }

    log_success ".deb package installed"

    # Verify native modules
    log_info "Verifying native module architecture..."
    docker exec "${CONTAINER_ID}" bash -c '
        BETTER_SQLITE=$(find /opt/escapeplan/api/node_modules/.pnpm -name "better_sqlite3.node" -type f 2>/dev/null | head -n1)
        if [ -n "$BETTER_SQLITE" ]; then
            echo "Found better-sqlite3 at: $BETTER_SQLITE"
            file "$BETTER_SQLITE"
            if file "$BETTER_SQLITE" | grep -q "aarch64"; then
                echo "✓ Native module is ARM64"
                exit 0
            else
                echo "✗ Native module is NOT ARM64"
                exit 1
            fi
        else
            echo "✗ better-sqlite3.node not found"
            exit 1
        fi
    ' || {
        log_error "Native module verification failed"
        return 1
    }

    log_success "Native modules verified as ARM64"

    # Create minimal environment configuration
    log_info "Creating environment configuration..."
    docker exec "${CONTAINER_ID}" bash -c '
        mkdir -p /var/lib/escapeplan /var/log/escapeplan /etc/escapeplan

        cat > /etc/escapeplan/api.env << EOF
NODE_ENV=production
PORT=4000
ESCAPEPLAN_DB_PATH=/var/lib/escapeplan/escapeplan.db
BETTER_AUTH_SECRET=test-secret-key-for-ci-do-not-use-in-production-12345678
BETTER_AUTH_URL=http://localhost:4000
LOG_LEVEL=info
LOG_DIR=/var/log/escapeplan
BACKUP_DIR=/var/backups/escapeplan
EOF

        cat > /etc/escapeplan/web.env << EOF
NODE_ENV=production
PORT=3000
ORIGIN=http://localhost:3000
API_URL=http://localhost:4000
EOF

        chmod 600 /etc/escapeplan/*.env
        chown -R escapeplan:escapeplan /etc/escapeplan /var/lib/escapeplan /var/log/escapeplan
    ' || {
        log_error "Failed to create environment configuration"
        return 1
    }

    log_success "Environment configured"

    # Initialize database
    log_info "Initializing database..."
    docker exec "${CONTAINER_ID}" bash -c '
        cd /opt/escapeplan/api
        touch /var/lib/escapeplan/escapeplan.db
        chown escapeplan:escapeplan /var/lib/escapeplan/escapeplan.db
    ' || {
        log_error "Failed to initialize database"
        return 1
    }

    log_success "Database initialized"

    # Run health check
    log_info "Running health check..."
    docker exec "${CONTAINER_ID}" bash -c '
        # Start services
        systemctl start escapeplan-api || true
        systemctl start escapeplan-web || true

        # Wait for services to start
        sleep 5

        # Run health check
        /opt/escapeplan/scripts/health-check.sh --verbose
    ' || {
        log_warning "Health check reported issues"

        if [ "$INTERACTIVE" = true ]; then
            log_info "Dropping into container shell for debugging..."
            docker exec -it "${CONTAINER_ID}" bash
        fi

        # Show logs for debugging
        log_info "API service status:"
        docker exec "${CONTAINER_ID}" systemctl status escapeplan-api --no-pager || true

        log_info "Web service status:"
        docker exec "${CONTAINER_ID}" systemctl status escapeplan-web --no-pager || true

        return 1
    }

    log_success "Health check passed"

    # Test API endpoints
    log_info "Testing API endpoints..."
    docker exec "${CONTAINER_ID}" bash -c '
        # Test health endpoint
        if curl -f -s http://localhost:4000/api/health >/dev/null 2>&1; then
            echo "✓ API health endpoint responding"
        else
            echo "✗ API health endpoint not responding"
            exit 1
        fi

        # Test auth endpoint (should return method not allowed or similar, but should respond)
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/auth/session 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" != "000" ]; then
            echo "✓ API auth endpoint responding (HTTP ${HTTP_CODE})"
        else
            echo "✗ API auth endpoint not responding"
            exit 1
        fi
    ' || {
        log_error "API endpoint tests failed"
        return 1
    }

    log_success "API endpoints validated"

    log_success "All tests passed in ARM64 environment!"
    return 0
}

# Main test execution
main() {
    log_section "EscapePlan ARM64 .deb Package Test"
    log_info "Test method: ${TEST_METHOD}"
    log_info "Project root: ${PROJECT_ROOT}"

    # Check prerequisites
    if ! check_prerequisites; then
        exit 2
    fi

    # Auto-detect or build .deb
    if [ -z "$DEB_PATH" ]; then
        DEB_PATH=$(find "${PROJECT_ROOT}/dist" -name "escapeplan_*_arm64.deb" -type f 2>/dev/null | head -n1)
    fi

    if [ -z "$DEB_PATH" ] || [ ! -f "$DEB_PATH" ]; then
        if [ "$SKIP_BUILD" = true ]; then
            log_error "No .deb file found and --skip-build specified"
            log_info "Build with: ./scripts/build-deb.sh"
            exit 1
        else
            if ! build_deb; then
                log_error "Failed to build .deb package"
                exit 1
            fi
        fi
    else
        log_info "Using existing .deb: ${DEB_PATH}"
    fi

    # Validate .deb exists
    if [ ! -f "$DEB_PATH" ]; then
        log_error "DEB file not found: ${DEB_PATH}"
        exit 1
    fi

    log_info "Testing package: $(basename "${DEB_PATH}") ($(du -h "${DEB_PATH}" | cut -f1))"

    # Run test based on method
    case $TEST_METHOD in
        docker)
            if test_docker_arm64; then
                log_section "Test Result: SUCCESS"
                log_success "ARM64 .deb package validation passed!"
                exit 0
            else
                log_section "Test Result: FAILED"
                log_error "ARM64 .deb package validation failed"
                exit 1
            fi
            ;;
        qemu)
            log_error "QEMU user-mode testing not yet implemented"
            log_info "Use --method=docker instead"
            exit 1
            ;;
        *)
            log_error "Unknown test method: ${TEST_METHOD}"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
