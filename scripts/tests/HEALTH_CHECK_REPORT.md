# Health Check Validation Script Report

## Overview

The health check validation script (`/mnt/projects/escape-plan/escapeplan-app/scripts/health-check.sh`) provides comprehensive post-installation validation for the EscapePlan deployment.

## Script Location

**Source:** `/mnt/projects/escape-plan/escapeplan-app/scripts/health-check.sh`
**Deployed:** `/opt/escapeplan/scripts/health-check.sh`
**Permissions:** `755 (executable)`

## Implementation Details

### Exit Codes
- **0**: All checks passed successfully
- **1**: One or more checks failed

### Command Line Options
- `./health-check.sh` - Run all checks with standard output
- `./health-check.sh --verbose` or `-v` - Show detailed output for debugging

### Color-Coded Output
- **Green (✓)**: Check passed
- **Red (✗)**: Check failed
- **Yellow (⚠)**: Warning messages
- **Blue (INFO)**: Informational messages

## Validation Checks Performed

### 1. System User Check
**Function:** `check_escapeplan_user()`
**Validates:**
- System user `escapeplan` exists

### 2. Node.js Installation Check
**Function:** `check_node_installation()`
**Validates:**
- Node.js is installed and accessible in PATH
- Reports Node.js version

### 3. Required Directories Check
**Function:** `check_required_directories()`
**Validates:**
- `/opt/escapeplan` exists
- `/opt/escapeplan/api` exists
- `/opt/escapeplan/web` exists
- `/var/lib/escapeplan` exists
- `/var/log/escapeplan` exists
- `/etc/escapeplan` exists

### 4. Directory Permissions Check
**Function:** `check_directory_permissions()`
**Validates:**
- All EscapePlan directories are owned by `escapeplan:escapeplan`
- Reports incorrect ownership if found

### 5. Contracts Package Distribution Check
**Function:** `check_contracts_dist()`
**Validates:**
- `/opt/escapeplan/api/node_modules/@escapeplan/contracts/dist` exists
- `/opt/escapeplan/api/node_modules/@escapeplan/contracts/dist/index.js` exists
- `/opt/escapeplan/web/node_modules/@escapeplan/contracts/dist` exists
- `/opt/escapeplan/web/node_modules/@escapeplan/contracts/dist/index.js` exists

### 6. Environment Configuration Check
**Function:** `check_secrets_file()`
**Validates:**
- `/etc/escapeplan/api.env` exists
- `BETTER_AUTH_SECRET` is not using placeholder value
- `CAMERA_ENCRYPTION_KEY` is not using development default
- File permissions are restrictive (600 or 640)
- Provides instructions for generating production secrets

### 7. Systemd Service Files Check
**Function:** `check_systemd_services_loaded()`
**Validates:**
- `escapeplan-api.service` is loaded in systemd
- `escapeplan-web.service` is loaded in systemd

### 8. API Service Status Check
**Function:** `check_api_service()`
**Validates:**
- API service is enabled (will start on boot)
- API service is currently running
- Shows service status in verbose mode if failed

### 9. Web Service Status Check
**Function:** `check_web_service()`
**Validates:**
- Web service is enabled (will start on boot)
- Web service is currently running
- Shows service status in verbose mode if failed

### 10. Database File Check
**Function:** `check_database_file()`
**Validates:**
- `/var/lib/escapeplan/escapeplan.db` exists
- Database file is readable
- Detects WAL mode (Write-Ahead Logging) if active
- Checks for WAL and SHM companion files

### 11. API HTTP Health Endpoint Check
**Function:** `check_api_http_health()`
**Validates:**
- API responds to HTTP health check at `http://localhost:4000/api/health`
- Retries up to 10 times (10 second timeout)
- Reports number of retry attempts in verbose mode

### 12. Web HTTP Response Check
**Function:** `check_web_http_response()`
**Validates:**
- In production (nginx running):
  - Web app accessible via `https://escapeplan.local/` (with --insecure for self-signed cert)
- In development/standalone mode:
  - SvelteKit server responds at `http://localhost:3000/`

## Integration with Post-Install

The health check is automatically executed at the end of the Debian package installation process:

**Location in postinst:** `/mnt/projects/escape-plan/escapeplan-app/build/deb/DEBIAN/postinst`

```bash
# Run health check validation
if [ -x /opt/escapeplan/scripts/health-check.sh ]; then
    echo "Running post-installation health checks..."
    /opt/escapeplan/scripts/health-check.sh || {
        echo "Health checks failed. Review errors above before starting services."
        exit 0  # Don't fail package installation, just warn
    }
fi
```

### Post-Install Behavior
- Script runs automatically after package installation
- Failures are logged but **do not fail the package installation**
- Exit code 0 ensures dpkg considers the installation successful
- Operators are warned to review errors before starting services

## Test Suite

**Test Script:** `/mnt/projects/escape-plan/escapeplan-app/scripts/tests/test-health-check.sh`

### Test Coverage

1. ✓ Script file existence and permissions
2. ✓ Script syntax validation (bash -n)
3. ✓ Required check functions present (12 functions)
4. ✓ Exit code logic validation (0 and 1)
5. ✓ Output formatting (color codes defined)
6. ✓ Verbose mode flag support (--verbose)
7. ✓ Critical system paths checked
8. ✓ Service status validation (systemctl checks)
9. ✓ HTTP health endpoint checks (curl validation)
10. ✓ Secrets and environment validation
11. ✓ Contracts package distribution validation
12. ✓ File and directory permission validation

**Test Results:** All 12 tests passed ✓

### Running Tests

```bash
cd /mnt/projects/escape-plan/escapeplan-app
./scripts/tests/test-health-check.sh
```

## Usage Examples

### Standard Health Check
```bash
sudo /opt/escapeplan/scripts/health-check.sh
```

**Output:**
```
═══════════════════════════════════════════════════════
  EscapePlan Health Check Validation
═══════════════════════════════════════════════════════

[✓] System user 'escapeplan' exists
[✓] Node.js installed (v20.x.x)
[✓] All required directories exist
[✓] All directories have correct ownership (escapeplan:escapeplan)
[✓] Contracts distribution files present in API and Web packages
[✓] Environment file configured with production secrets
[✓] All systemd service files loaded
[✓] API service is enabled and running
[✓] Web service is enabled and running
[✓] Database file exists and is readable (WAL mode active)
[✓] API responds to health check at http://localhost:4000/api/health
[✓] Web app accessible via nginx at https://escapeplan.local/

═══════════════════════════════════════════════════════
  Health Check Summary
═══════════════════════════════════════════════════════

[✓] All 12 checks passed!

[INFO] EscapePlan is healthy and ready for operation
```

### Verbose Health Check
```bash
sudo /opt/escapeplan/scripts/health-check.sh --verbose
```

Shows additional debugging information for each check.

### Common Failure Scenarios

#### Services Not Started
```
[✗] API service is not running (use 'systemctl start escapeplan-api')
[✗] Web service is not running (use 'systemctl start escapeplan-web')

[INFO] To start services:
  systemctl start escapeplan-api
  systemctl start escapeplan-web
```

#### Missing Environment Configuration
```
[✗] API environment file missing at /etc/escapeplan/api.env
[⚠] Run: cp /opt/escapeplan/api/.env.example /etc/escapeplan/api.env
```

#### Placeholder Secrets
```
[✗] BETTER_AUTH_SECRET not configured in /etc/escapeplan/api.env
[⚠] Generate with: openssl rand -base64 32

[✗] CAMERA_ENCRYPTION_KEY using development default in /etc/escapeplan/api.env
[⚠] Generate with: openssl rand -hex 32
```

## Build Process Integration

The script is included in the Debian package build via `build-deb.sh`:

```bash
# Copy utility scripts
echo "Adding utility scripts to package..."
mkdir -p "${BUILD_DIR}/opt/escapeplan/scripts"
cp scripts/pi-post-install.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/health-check.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/pi-post-install.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/health-check.sh"
```

**Build Script:** `/mnt/projects/escape-plan/escapeplan-app/scripts/build-deb.sh` (lines 150-156)

## Recommendations

### For Operators
1. **Run health check after any system changes:**
   ```bash
   sudo /opt/escapeplan/scripts/health-check.sh
   ```

2. **Use verbose mode for troubleshooting:**
   ```bash
   sudo /opt/escapeplan/scripts/health-check.sh --verbose
   ```

3. **Check after service restarts:**
   ```bash
   sudo systemctl restart escapeplan-api escapeplan-web
   sudo /opt/escapeplan/scripts/health-check.sh
   ```

### For Development
1. The script is environment-aware (detects nginx vs standalone)
2. Can be extended with additional checks as needed
3. Test suite ensures all check functions are present
4. Idempotent - safe to run multiple times

## Summary

### Files Created
1. `/mnt/projects/escape-plan/escapeplan-app/scripts/health-check.sh` - Main health check script
2. `/mnt/projects/escape-plan/escapeplan-app/scripts/tests/test-health-check.sh` - Test suite
3. `/mnt/projects/escape-plan/escapeplan-app/scripts/tests/HEALTH_CHECK_REPORT.md` - This documentation

### Files Modified
1. `/mnt/projects/escape-plan/escapeplan-app/scripts/build-deb.sh` - Added health-check.sh to package
2. `/mnt/projects/escape-plan/escapeplan-app/build/deb/DEBIAN/postinst` - Integrated health check execution

### Checks Implemented (12 Total)
1. ✓ Database file exists and is readable
2. ✓ API service is running (systemctl status)
3. ✓ Web service is running (systemctl status)
4. ✓ API responds to HTTP request (curl http://localhost:4000/api/health)
5. ✓ Web responds to HTTP request (nginx or direct)
6. ✓ All required directories exist
7. ✓ Permissions are correct (escapeplan:escapeplan)
8. ✓ Secrets file exists and is configured
9. ✓ Contracts dist/ files exist (API and Web)
10. ✓ System user 'escapeplan' exists
11. ✓ Node.js is installed
12. ✓ Systemd service files are loaded

### Test Results
- All 12 validation tests passed ✓
- Script syntax is valid ✓
- Integration with postinst confirmed ✓

### Exit Codes
- 0 = Success (all checks passed)
- 1 = Failure (one or more checks failed)

The health check validation script is fully implemented, tested, and integrated into the post-installation process.
