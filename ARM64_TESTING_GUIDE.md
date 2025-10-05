# ARM64 .deb Package Testing Guide

This guide explains how to test the EscapePlan .deb package in an ARM64 environment before deploying to Raspberry Pi.

## Table of Contents

- [Overview](#overview)
- [Testing Approaches](#testing-approaches)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Testing Instructions](#detailed-testing-instructions)
- [GitHub Actions Integration](#github-actions-integration)
- [Troubleshooting](#troubleshooting)
- [Test Coverage](#test-coverage)

## Overview

The ARM64 testing infrastructure validates that:

1. **Package builds correctly** for ARM64 architecture
2. **Native modules rebuild** successfully on ARM64 (better-sqlite3, etc.)
3. **Installation completes** without errors
4. **Services start** and respond to health checks
5. **API endpoints** are functional
6. **Database operations** work correctly

This prevents deployment failures on Raspberry Pi by catching ARM64-specific issues early.

## Testing Approaches

### 1. Docker with QEMU Emulation (Recommended)

**Best for:** Local development, CI/CD pipelines

**Pros:**
- Fast setup (no dedicated hardware needed)
- Reproducible environments
- Works on x86_64 development machines
- Easy cleanup

**Cons:**
- Emulation overhead (slower than native)
- May not catch hardware-specific issues

### 2. GitHub Actions ARM64 Runners

**Best for:** Automated testing on every commit

**Pros:**
- Runs automatically on pull requests
- Free for public repositories
- Results visible in GitHub UI
- Artifact storage included

**Cons:**
- Requires GitHub account
- Limited to GitHub-hosted runners

### 3. Native ARM64 Hardware

**Best for:** Final validation before release

**Pros:**
- True ARM64 performance
- Catches hardware-specific issues
- No emulation overhead

**Cons:**
- Requires physical Raspberry Pi
- Manual setup required
- Can't run on developer machines

## Prerequisites

### For Docker Testing (Local)

```bash
# 1. Install Docker
# Follow instructions at: https://docs.docker.com/get-docker/

# 2. Enable QEMU ARM64 support
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# 3. Verify ARM64 emulation works
docker run --rm --platform linux/arm64 alpine uname -m
# Should output: aarch64

# 4. Install pnpm (if not already installed)
npm install -g pnpm@10.12.4
```

### For GitHub Actions (Automatic)

No local setup required - configured via `.github/workflows/test-arm64.yml`

## Quick Start

### Run Full Test Suite (Recommended)

```bash
# From project root
cd /path/to/escapeplan-app

# Run complete test (builds .deb + validates in ARM64 container)
./scripts/tests/test-arm64-emulated.sh
```

This will:
1. Build the .deb package from source
2. Create an ARM64 Debian container
3. Install the package
4. Run health checks
5. Validate API endpoints
6. Report test results

**Expected output:**
```
═══════════════════════════════════════════════════════
  EscapePlan ARM64 .deb Package Test
═══════════════════════════════════════════════════════

[INFO] Test method: docker
[✓] Docker installed
[✓] Docker ARM64 emulation available
[✓] All prerequisites met

[INFO] Building .deb package...
[✓] Built package: dist/escapeplan_0.1.0_arm64.deb

═══════════════════════════════════════════════════════
  Testing with Docker ARM64 Emulation
═══════════════════════════════════════════════════════

[✓] Container created: abc123def456
[✓] Dependencies installed
[✓] .deb package installed
[✓] Native modules verified as ARM64
[✓] Environment configured
[✓] Database initialized
[✓] Health check passed
[✓] API endpoints validated

═══════════════════════════════════════════════════════
  Test Result: SUCCESS
═══════════════════════════════════════════════════════

[✓] ARM64 .deb package validation passed!
```

### Test Existing .deb Package

```bash
# Skip build and test pre-built .deb
./scripts/tests/test-arm64-emulated.sh \
  --deb=dist/escapeplan_0.1.0_arm64.deb \
  --skip-build
```

### Debug Failed Installation

```bash
# Keep container running and drop into shell on failure
./scripts/tests/test-arm64-emulated.sh \
  --interactive \
  --verbose \
  --keep-container
```

## Detailed Testing Instructions

### 1. Build .deb Package

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build contracts (required first)
pnpm --filter @escapeplan/contracts build

# Build API
pnpm --filter escapeplan-api build

# Build Web
pnpm --filter escapeplan-web build

# Create .deb package
./scripts/build-deb.sh
```

**Output location:** `dist/escapeplan_0.1.0_arm64.deb`

### 2. Run ARM64 Test

```bash
./scripts/tests/test-arm64-emulated.sh --verbose
```

### 3. Inspect Test Results

The test script validates:

#### File Structure
- `/opt/escapeplan/api/` - API application
- `/opt/escapeplan/web/` - Web frontend
- `/opt/escapeplan/scripts/` - Utility scripts
- `/etc/escapeplan/` - Configuration files
- `/var/lib/escapeplan/` - Database directory
- `/var/log/escapeplan/` - Log directory

#### Native Modules
- `better-sqlite3.node` - ARM64 architecture
- Located in: `/opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/`

#### Services
- `escapeplan-api.service` - Enabled and running
- `escapeplan-web.service` - Enabled and running
- `escapeplan-backup.timer` - Enabled

#### API Endpoints
- `GET /api/health` - Returns 200 OK
- `GET /api/auth/session` - Responds (auth required)

### 4. Manual Container Inspection

```bash
# Keep container for manual testing
./scripts/tests/test-arm64-emulated.sh --keep-container

# In another terminal, find container ID
docker ps | grep escapeplan-arm64-test

# Connect to container
docker exec -it <container-id> bash

# Inside container, inspect installation
ls -la /opt/escapeplan/
systemctl status escapeplan-api
journalctl -u escapeplan-api -n 50
curl http://localhost:4000/api/health

# Check native module architecture
SQLITE_MODULE=$(find /opt/escapeplan/api/node_modules/.pnpm -name "better_sqlite3.node" | head -n1)
file "$SQLITE_MODULE"
# Should show: ELF 64-bit LSB shared object, ARM aarch64
```

## GitHub Actions Integration

### Automatic Testing on Pull Requests

The workflow `.github/workflows/test-arm64.yml` automatically runs when:

- Pull requests targeting `main` or `develop`
- Changes to `.deb` build scripts
- Changes to application code
- Manual trigger via GitHub UI

### View Test Results

1. Open pull request on GitHub
2. Scroll to "Checks" section
3. Click "ARM64 .deb Package Test"
4. View detailed logs

### Download Test Artifacts

If tests pass on `main` branch:

1. Go to GitHub Actions tab
2. Click on successful workflow run
3. Download "escapeplan-arm64-deb" artifact
4. Contains validated .deb package

### Manual Workflow Trigger

```bash
# Via GitHub CLI
gh workflow run test-arm64.yml

# Or via GitHub web UI:
# Actions → ARM64 .deb Package Test → Run workflow
```

## Troubleshooting

### Problem: ARM64 emulation not available

**Error:**
```
[✗] Docker ARM64 emulation not available
```

**Solution:**
```bash
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
```

### Problem: Container fails to start

**Error:**
```
Error response from daemon: No such container
```

**Solution:**
```bash
# Check Docker is running
docker info

# Clean up orphaned containers
docker system prune -f
```

### Problem: Native module rebuild fails

**Error:**
```
ERROR: npm rebuild failed
```

**Debugging:**
```bash
# Run test in interactive mode
./scripts/tests/test-arm64-emulated.sh --interactive --verbose

# Inside container, check build dependencies
which gcc g++ make python3
npm rebuild better-sqlite3 --verbose
```

**Common causes:**
- Missing `build-essential` package
- Missing `python3` package
- Insufficient memory (increase Docker memory limit)

### Problem: Health check fails

**Error:**
```
[✗] Health check reported issues
```

**Debugging:**
```bash
# Keep container for inspection
./scripts/tests/test-arm64-emulated.sh --keep-container

# In another terminal
docker exec -it <container-id> bash

# Check service status
systemctl status escapeplan-api
systemctl status escapeplan-web

# Check logs
journalctl -u escapeplan-api --no-pager -n 100
journalctl -u escapeplan-web --no-pager -n 100

# Check environment
cat /etc/escapeplan/api.env

# Test database
sqlite3 /var/lib/escapeplan/escapeplan.db ".tables"

# Test API manually
curl -v http://localhost:4000/api/health
```

### Problem: Services won't start

**Error:**
```
[✗] API service is not running
```

**Possible causes:**

1. **Database not initialized**
   ```bash
   ls -la /var/lib/escapeplan/
   chmod 644 /var/lib/escapeplan/escapeplan.db
   ```

2. **Environment file missing**
   ```bash
   ls -la /etc/escapeplan/
   cat /etc/escapeplan/api.env
   ```

3. **Port already in use**
   ```bash
   netstat -tlnp | grep :4000
   ```

4. **Permissions incorrect**
   ```bash
   chown -R escapeplan:escapeplan /opt/escapeplan /var/lib/escapeplan
   ```

## Test Coverage

### What is Tested

✅ **Package Build**
- Contracts compilation
- API build with tsup
- Web build with SvelteKit
- .deb package creation
- Package metadata validation

✅ **Installation**
- File extraction to correct paths
- User/group creation
- Directory permissions
- Systemd service installation
- Environment file templates

✅ **Native Modules**
- ARM64 architecture verification
- better-sqlite3 rebuild
- Module loading validation

✅ **Runtime**
- Service startup
- Database initialization
- Health check endpoints
- API response validation

### What is NOT Tested

❌ **Hardware-specific features**
- Wi-Fi hotspot configuration
- RTSP camera streams
- GPIO/hardware interfaces
- Performance benchmarks

❌ **Integration scenarios**
- Multi-room deployments
- Network configuration
- Nginx reverse proxy
- TLS certificate setup

❌ **Long-running operations**
- Database migrations over time
- Backup/restore procedures
- Log rotation
- System updates

For comprehensive testing, deploy to actual Raspberry Pi hardware.

## Advanced Usage

### Custom Test Scenarios

```bash
# Test with specific Node.js version
docker run --rm --platform linux/arm64 \
  -v "$(pwd):/workspace" \
  node:20-bookworm \
  bash -c "cd /workspace && apt-get update && apt-get install -y dpkg && dpkg -i dist/escapeplan_*.deb"

# Test on different Debian version
docker run --rm --platform linux/arm64 \
  -v "$(pwd):/workspace" \
  debian:11 \
  bash -c "cd /workspace && dpkg -i dist/escapeplan_*.deb"
```

### Continuous Testing

```bash
# Watch for changes and auto-test
while inotifywait -r -e modify scripts/ apps/ packages/; do
  ./scripts/tests/test-arm64-emulated.sh --skip-build
done
```

### Performance Profiling

```bash
# Time test execution
time ./scripts/tests/test-arm64-emulated.sh

# Monitor resource usage
docker stats <container-id>
```

## Integration with Development Workflow

### Pre-commit Hook

Add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
echo "Running ARM64 tests before push..."
./scripts/tests/test-arm64-emulated.sh --skip-build
```

### VS Code Task

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Test ARM64 Package",
      "type": "shell",
      "command": "./scripts/tests/test-arm64-emulated.sh",
      "problemMatcher": [],
      "group": {
        "kind": "test",
        "isDefault": true
      }
    }
  ]
}
```

Run with: `Ctrl+Shift+B` → "Test ARM64 Package"

## Best Practices

1. **Test early and often**
   - Run ARM64 tests before every release
   - Include in PR review process

2. **Keep containers clean**
   - Don't use `--keep-container` in CI
   - Clean up manually stopped containers

3. **Version control test data**
   - Document expected test outputs
   - Track test failure patterns

4. **Monitor test duration**
   - ARM64 emulation is slow (~3-5x native)
   - Optimize build steps where possible

5. **Validate on real hardware**
   - Final acceptance testing on Raspberry Pi
   - ARM64 emulation is not perfect

## Related Documentation

- [DEB Package Fixes](./DEB-PACKAGE-FIXES.md) - Packaging implementation details
- [ARM64 Native Module Implementation](./ARM64_NATIVE_MODULE_IMPLEMENTATION.md) - Native module rebuild strategy
- [Test Validation Report](./TEST_VALIDATION_REPORT.md) - Comprehensive test results

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review GitHub Actions logs
3. Inspect container logs with `--interactive --verbose`
4. File issue with test output attached
