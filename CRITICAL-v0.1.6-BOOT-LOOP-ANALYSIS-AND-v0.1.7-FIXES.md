# CRITICAL: v0.1.6 Boot Loop Analysis & v0.1.7 Fix Plan

**Date:** October 5, 2025
**Status:** 🔴 EMERGENCY - v0.1.6 causes boot loop on Raspberry Pi
**Priority:** CRITICAL - Must fix before deployment

---

## Executive Summary

**ISSUE:** v0.1.6 deployment caused complete Raspberry Pi boot loop failure. Device crashes during boot and cannot start systemd services.

**ROOT CAUSE ANALYSIS:**
1. **better-sqlite3 ARM64 rebuild FAILED silently** during postinst
2. **escapeplan-api.service set to auto-start** and crashes immediately due to broken better-sqlite3
3. **systemd service crash causes boot loop** - service restarts too quickly, exhausting system resources
4. **Postinst script may be blocking boot** if it hangs or fails

**IMPACT:** Complete system failure - device unbootable, requires SD card reflash to recover

**SOLUTION PATH FOR v0.1.7:**
- Fix better-sqlite3 build process to ENSURE ARM64 binary works
- Change services to NOT auto-start on first boot
- Add comprehensive health checks before enabling services
- Implement fail-safe boot recovery mode

---

## Timeline of Events (v0.1.4 → v0.1.5 → v0.1.6)

### v0.1.4 (Working Baseline)
- ✅ **Status:** Working on Pi, services running
- ✅ **better-sqlite3:** v9.6.0 (wrong version but somehow working)
- ✅ **WiFi AP:** Broadcasting with password "Canuescape3" (WRONG - missing 'e')
- ✅ **UI:** Loading and accessible
- ⚠️ **Issue:** User couldn't login (slow/hanging)

### v0.1.5 (Attempted Fixes)
**Changes Made:**
1. ✅ Fixed WiFi password: "Canuescape3" → "Canuescap3" (corrected)
2. ✅ Fixed contracts deployment: Real directories instead of symlinks
3. ✅ Added server.js for SvelteKit standalone deployment
4. ✅ Added /packages/contracts for on-device development
5. ✅ Fixed build-deb.sh contracts verification
6. ✅ Added HTTPS/SSL self-signed certificates
7. ✅ Configured nginx for HTTPS

**Build Output:**
- ✅ Package built successfully: `escapeplan_0.1.5_arm64.deb` (524MB)
- ✅ All verification checks passed during build
- ⚠️ **NOT FULLY DEPLOYED** - Stopped at deployment step

**Issues:**
- ⚠️ better-sqlite3 still at v9.6.0 (should have been upgraded to v12+)
- ⚠️ Deployment incomplete - agents couldn't SSH to Pi

### v0.1.6 (CRITICAL FAILURE - Boot Loop)
**Changes Made:**
1. ✅ Upgraded better-sqlite3: v9.6.0 → v12.4.1
2. ✅ Added ARM64 rebuild logic in pi-post-install.sh
3. ✅ Added database seeding to postinst
4. ✅ Applied changesets and generated CHANGELOG.md
5. ✅ All build verification passed

**Build Output:**
- ✅ Package built successfully: `escapeplan_0.1.6_arm64.deb` (513MB)
- ✅ Contracts verified as real directories
- ✅ server.js created and verified
- ✅ better-sqlite3@12.4.1 in package

**Deployment:**
- ✅ Package copied to Pi via SCP
- ✅ Installation started with dpkg -i
- ⚠️ **Postinst executed** (3 seconds completion time)
- ⚠️ **better-sqlite3 rebuild attempted** but may have failed
- ❌ **Services enabled for auto-start**
- ❌ **Reboot caused immediate boot loop**

**Crash Symptoms:**
- Pi boots to Raspberry Pi logo
- Shows Debian boot screen
- **Crashes before login prompt**
- Too fast to read error messages
- Continuous reboot loop

**Recovery Attempted:**
1. ❌ Added `systemd.unit=emergency.target` to cmdline.txt - Still crashed
2. ❌ Disabled escapeplan-api.service - Still crashed
3. ❌ Disabled escapeplan-web.service - Still crashed
4. ❌ Disabled escapeplan-platform-init.service - Still crashed
5. ❌ Disabled escapeplan-certgen.service - Still crashed
6. ✅ **ONLY SOLUTION:** Reflash entire SD card with base image

---

## Root Cause Deep Dive

### Issue #1: better-sqlite3 ARM64 Rebuild Failure

**The Problem:**
```bash
# pi-post-install.sh lines 220-229
npm rebuild better-sqlite3
```

**What Went Wrong:**
1. **Build environment missing:** `build-essential` may not be installed when rebuild runs
2. **Compilation errors:** better-sqlite3@12.4.1 may fail to compile on ARM64
3. **Silent failure:** If rebuild fails, script continues anyway
4. **Service starts anyway:** escapeplan-api.service tries to load broken better-sqlite3

**Evidence from Deployment Logs:**
```
[STEP 2] Native Module Rebuild (0m 2s)
- Status: ✅ Completed
- Note: Initial build had x86-64 architecture issue (fixed later)

Later manual rebuild:
Action: npm run build-release
Result: ELF 64-bit LSB shared object, ARM aarch64
Status: Operational
```

**Analysis:** The automated rebuild in postinst may have **failed silently**, but manual rebuild later succeeded. This suggests:
- Timing issue (build-essential not installed yet?)
- Missing dependencies during automated rebuild
- Working directory or permissions issue

### Issue #2: Service Auto-Start Causing Boot Loop

**The Problem:**
```bash
# postinst-orchestrator.sh lines 258-289
systemctl enable escapeplan-api.service
systemctl enable escapeplan-web.service
```

**What Went Wrong:**
1. Services are **enabled immediately** after installation
2. On reboot, systemd tries to start escapeplan-api
3. API fails to load better-sqlite3 (x86-64 binary or broken ARM64 build)
4. Service crashes with `ERR_DLOPEN_FAILED`
5. systemd **restarts too quickly** (RestartSec=10)
6. Crash loop exhausts system resources
7. **Boot hangs or fails completely**

**Evidence:**
```
Error: Module did not self-register: better_sqlite3.node
code: 'ERR_DLOPEN_FAILED'
Service has restarted 28+ times
```

**systemd Configuration:**
```ini
[Service]
Restart=always
RestartSec=10
```

**Analysis:** The service is configured to **restart forever**, which is correct for production but **deadly during first boot** if the binary is broken.

### Issue #3: Postinst May Block Boot

**The Problem:**
```bash
# postinst-orchestrator.sh
run_step_with_retry "rebuild_native_modules" 3 || exit 1
run_step_with_retry "initialize_database" 3 || exit 1
```

**What Could Go Wrong:**
1. If any step hangs (timeout not working), dpkg blocks indefinitely
2. If postinst exits with error, package is in "half-configured" state
3. Next boot, dpkg may try to **re-run postinst**, causing delays or hangs
4. Systemd may wait for dpkg before continuing boot

**Analysis:** Postinst showed "3 seconds completion" in logs, so it likely **succeeded** during installation. Boot loop happened **after reboot**, not during install.

### Issue #4: Multiple Services Crashing Simultaneously

**Disabled Services (recovered from SD card):**
```
escapeplan-api.service.disabled
escapeplan-web.service.disabled
escapeplan-platform-init.service.disabled
escapeplan-certgen.service.disabled
```

**Analysis:** Even with **ALL** escapeplan services disabled, Pi still crashed. This suggests:
1. **Filesystem corruption** from failed installation
2. **Kernel panic** from other system service
3. **Init system damage** from rapid service crashes before we could disable them
4. **Memory corruption** from crash loops

---

## What Worked in v0.1.5 vs What Broke in v0.1.6

### ✅ What Worked (v0.1.5 Features)
1. **WiFi AP Password Fix** - "Canuescap3" is correct and working
2. **Contracts Deployment Fix** - Real directories instead of symlinks ✅
3. **server.js Creation** - Standalone SvelteKit server ✅
4. **HTTPS/SSL Configuration** - Self-signed certs working ✅
5. **Build Script Verification** - All checks passing ✅

### ❌ What Broke (v0.1.6 Changes)
1. **better-sqlite3 v9→v12 Upgrade** - Good intent, but ARM64 rebuild FAILED
2. **Automated ARM64 Rebuild** - Script logic exists but doesn't work reliably
3. **Service Auto-Enable** - Services crash on boot before system is ready
4. **No Safety Checks** - System enables services without verifying they work

---

## Critical Fixes Required for v0.1.7

### FIX #1: Better-SQLite3 ARM64 Build (CRITICAL)

**Current Approach (BROKEN):**
```bash
# pi-post-install.sh lines 220-229
npm rebuild better-sqlite3
```

**Why It Fails:**
- Runs too early (build-essential may not be installed)
- No verification that rebuild actually worked
- Silent failure allows broken binary to be used

**NEW APPROACH for v0.1.7:**

**Option A: Pre-build ARM64 Binary in .deb Package (RECOMMENDED)**
```bash
# In build-deb.sh, BEFORE creating .deb:
echo "Pre-compiling better-sqlite3 for ARM64..."

# Use Docker cross-compilation
docker run --rm -v $(pwd):/workspace \
  --platform linux/arm64 \
  node:22-alpine \
  sh -c "cd /workspace/build/deb/opt/escapeplan/api && npm rebuild better-sqlite3"

# Verify ARM64 binary
file build/deb/opt/escapeplan/api/node_modules/.pnpm/better-sqlite3*/node_modules/better-sqlite3/build/Release/better_sqlite3.node | grep -q "ARM aarch64"
```

**Option B: Download Pre-built ARM64 Binary (FASTER)**
```bash
# In build-deb.sh
echo "Downloading pre-built better-sqlite3 ARM64 binary..."
SQLITE_VERSION="12.4.1"
SQLITE_URL="https://github.com/WiseLibs/better-sqlite3/releases/download/v${SQLITE_VERSION}/better-sqlite3-v${SQLITE_VERSION}-node.napi-v3-linux-arm64.tar.gz"

curl -L "${SQLITE_URL}" -o /tmp/better-sqlite3-arm64.tar.gz
tar -xzf /tmp/better-sqlite3-arm64.tar.gz -C "${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@${SQLITE_VERSION}/node_modules/better-sqlite3/"
```

**Option C: Keep ARM64 Rebuild but FIX It (FALLBACK)**
```bash
# In pi-post-install.sh - IMPROVED rebuild logic

rebuild_native_modules() {
    log "=========================================="
    log "STEP: Rebuild Native Modules for ARM64"
    log "=========================================="

    # 1. FIRST ensure build-essential is installed
    if ! command -v gcc &>/dev/null; then
        log "ERROR: gcc not found - installing build-essential first..."
        apt-get update -qq
        apt-get install -y build-essential python3
    fi

    # 2. Verify build tools are available
    command -v gcc &>/dev/null || { log "ERROR: gcc still missing"; return 1; }
    command -v make &>/dev/null || { log "ERROR: make missing"; return 1; }
    command -v python3 &>/dev/null || { log "ERROR: python3 missing"; return 1; }

    # 3. Check if binary is already ARM64 (skip rebuild if so)
    local sqlite_module="${INSTALL_ROOT}/api/node_modules/.pnpm/better-sqlite3@12.4.1/node_modules/better-sqlite3/build/Release/better_sqlite3.node"

    if [ -f "${sqlite_module}" ]; then
        local arch_info=$(file "${sqlite_module}")
        if echo "${arch_info}" | grep -q "ARM aarch64"; then
            log "✓ better-sqlite3 is already ARM64, skipping rebuild"
            return 0
        fi
        log "⚠ better-sqlite3 is NOT ARM64 (${arch_info}), rebuilding..."
    fi

    # 4. Perform rebuild with verbose output
    cd "${INSTALL_ROOT}/api"
    log "Running: npm rebuild better-sqlite3 (may take 2-3 minutes)..."

    if npm rebuild better-sqlite3 --verbose 2>&1 | tee -a "${LOG_FILE}"; then
        log "✓ Rebuild command completed"
    else
        log "ERROR: npm rebuild failed with exit code $?"
        return 1
    fi

    # 5. CRITICAL: Verify the rebuilt binary is ARM64
    if [ ! -f "${sqlite_module}" ]; then
        log "ERROR: better_sqlite3.node not found after rebuild!"
        return 1
    fi

    arch_info=$(file "${sqlite_module}")
    if echo "${arch_info}" | grep -q "ARM aarch64"; then
        log "✓ VERIFIED: better-sqlite3 is ARM64"
        log "  Binary: ${sqlite_module}"
        log "  Arch: ${arch_info}"

        # 6. FINAL TEST: Try to load the module
        if node -e "require('better-sqlite3')" 2>&1; then
            log "✓ VERIFIED: better-sqlite3 loads successfully"
            return 0
        else
            log "ERROR: better-sqlite3 built but won't load!"
            return 1
        fi
    else
        log "ERROR: Rebuild produced wrong architecture: ${arch_info}"
        return 1
    fi
}
```

**RECOMMENDATION:** Use **Option A (Docker cross-compile)** or **Option B (pre-built binary)** to avoid runtime compilation issues entirely.

### FIX #2: Prevent Service Auto-Start on First Boot (CRITICAL)

**Current Approach (DANGEROUS):**
```bash
# postinst-orchestrator.sh lines 258-289
systemctl enable escapeplan-api.service
systemctl enable escapeplan-web.service
```

**Why It's Dangerous:**
- Services start immediately on reboot
- If they crash, boot loop occurs
- No health check before enable

**NEW APPROACH for v0.1.7:**

**DO NOT enable services in postinst. Instead:**

```bash
# In postinst-orchestrator.sh - REPLACE lines 258-289

configure_services() {
    log_step "6" "Service Configuration"

    # DO NOT ENABLE SERVICES YET
    # Just reload systemd to register them
    log "Reloading systemd daemon..."
    systemctl daemon-reload

    # Create a "first-boot" setup script instead
    cat > /opt/escapeplan/scripts/first-boot-setup.sh <<'EOF'
#!/bin/bash
# First Boot Setup - Only run this after verifying system health

set -e

echo "=========================================="
echo "EscapePlan First Boot Setup"
echo "=========================================="

# 1. Verify better-sqlite3 works
echo "Testing better-sqlite3..."
cd /opt/escapeplan/api
if ! node -e "require('better-sqlite3')"; then
    echo "ERROR: better-sqlite3 is broken!"
    echo "Run: npm rebuild better-sqlite3"
    exit 1
fi

# 2. Test database connection
echo "Testing database connection..."
if ! node -e "const db = require('better-sqlite3')('/var/lib/escapeplan/escapeplan.db'); db.close();"; then
    echo "ERROR: Cannot connect to database!"
    exit 1
fi

# 3. Enable and start services
echo "Enabling services..."
systemctl enable escapeplan-api.service
systemctl enable escapeplan-web.service

echo "Starting services..."
systemctl start escapeplan-api.service
systemctl start escapeplan-web.service

# 4. Wait and verify they stay running
echo "Waiting 30 seconds to verify stability..."
sleep 30

if systemctl is-active --quiet escapeplan-api.service; then
    echo "✓ API service is running"
else
    echo "✗ API service crashed"
    journalctl -u escapeplan-api -n 50
    exit 1
fi

if systemctl is-active --quiet escapeplan-web.service; then
    echo "✓ Web service is running"
else
    echo "✗ Web service crashed"
    journalctl -u escapeplan-web -n 50
    exit 1
fi

echo "=========================================="
echo "✓ All services started successfully!"
echo "=========================================="
EOF

    chmod +x /opt/escapeplan/scripts/first-boot-setup.sh

    log_success "Services registered but NOT enabled"
    log_success "Run '/opt/escapeplan/scripts/first-boot-setup.sh' after first boot to enable"
}
```

**Post-Install Instructions:**
```bash
# AFTER flashing and booting Pi:
ssh pi@escapeplan.local

# Run first-boot setup manually
sudo /opt/escapeplan/scripts/first-boot-setup.sh

# This will:
# - Verify better-sqlite3 works
# - Test database connection
# - Enable services
# - Start services
# - Verify they stay running
```

### FIX #3: Add Fail-Safe Boot Recovery (CRITICAL)

**Create a systemd rescue service that ALWAYS starts:**

```bash
# In build-deb.sh, create rescue service

cat > "${BUILD_DIR}/etc/systemd/system/escapeplan-rescue.service" <<'EOF'
[Unit]
Description=EscapePlan Boot Rescue Service
DefaultDependencies=no
After=local-fs.target
Before=escapeplan-api.service escapeplan-web.service

[Service]
Type=oneshot
ExecStart=/opt/escapeplan/scripts/boot-rescue.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# Create rescue script
cat > "${BUILD_DIR}/opt/escapeplan/scripts/boot-rescue.sh" <<'EOF'
#!/bin/bash
# Boot Rescue - Runs before escapeplan services

BOOT_COUNT_FILE="/var/lib/escapeplan/.boot-count"
RESCUE_MODE_FILE="/var/lib/escapeplan/.rescue-mode"

# Increment boot counter
if [ -f "${BOOT_COUNT_FILE}" ]; then
    BOOT_COUNT=$(($(cat ${BOOT_COUNT_FILE}) + 1))
else
    BOOT_COUNT=1
fi
echo "${BOOT_COUNT}" > "${BOOT_COUNT_FILE}"

# If we've crashed 3+ times, enter rescue mode
if [ ${BOOT_COUNT} -ge 3 ]; then
    echo "Boot count: ${BOOT_COUNT} - ENTERING RESCUE MODE"
    touch "${RESCUE_MODE_FILE}"

    # Disable crashing services
    systemctl disable escapeplan-api.service 2>/dev/null || true
    systemctl disable escapeplan-web.service 2>/dev/null || true
    systemctl stop escapeplan-api.service 2>/dev/null || true
    systemctl stop escapeplan-web.service 2>/dev/null || true

    echo "=========================================="
    echo "RESCUE MODE ACTIVATED"
    echo "Escapeplan services have been disabled"
    echo "SSH to the device to investigate"
    echo "Reset with: rm ${RESCUE_MODE_FILE} ${BOOT_COUNT_FILE}"
    echo "=========================================="
else
    echo "Boot count: ${BOOT_COUNT} - normal boot"
    # Reset counter after successful boot (after 5 minutes uptime)
    (sleep 300 && echo "0" > "${BOOT_COUNT_FILE}") &
fi
EOF

chmod +x "${BUILD_DIR}/opt/escapeplan/scripts/boot-rescue.sh"

# Enable rescue service
ln -sf /etc/systemd/system/escapeplan-rescue.service \
    "${BUILD_DIR}/etc/systemd/system/multi-user.target.wants/escapeplan-rescue.service"
```

### FIX #4: Better Postinst Error Handling (HIGH PRIORITY)

**Current Issues:**
- If postinst fails, package is half-configured
- No rollback mechanism
- Errors may not be visible

**NEW APPROACH:**

```bash
# In build-deb.sh postinst section - ADD comprehensive logging

# POSTINST HEADER
cat >> "${BUILD_DIR}/DEBIAN/postinst" <<'POSTINST_HEADER'
#!/bin/bash
set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

# Comprehensive logging
LOG_FILE="/var/log/escapeplan-install.log"
exec 1> >(tee -a "${LOG_FILE}")
exec 2>&1

echo "=========================================="
echo "EscapePlan v0.1.7 Installation"
echo "Started: $(date)"
echo "=========================================="

# Error trap
cleanup_on_error() {
    local exit_code=$?
    echo "=========================================="
    echo "ERROR: Installation failed with exit code ${exit_code}"
    echo "Check logs: ${LOG_FILE}"
    echo "=========================================="

    # Disable services to prevent boot loop
    systemctl disable escapeplan-api.service 2>/dev/null || true
    systemctl disable escapeplan-web.service 2>/dev/null || true

    exit ${exit_code}
}

trap cleanup_on_error ERR

POSTINST_HEADER

# ... rest of postinst ...

# POSTINST FOOTER
cat >> "${BUILD_DIR}/DEBIAN/postinst" <<'POSTINST_FOOTER'
echo "=========================================="
echo "✓ Installation completed successfully"
echo "Completed: $(date)"
echo "=========================================="
echo ""
echo "IMPORTANT: Services are NOT auto-enabled"
echo "After first boot, run:"
echo "  sudo /opt/escapeplan/scripts/first-boot-setup.sh"
echo ""
echo "Log file: ${LOG_FILE}"
echo "=========================================="

exit 0
POSTINST_FOOTER
```

### FIX #5: Add Pre-Flight Health Checks (MEDIUM PRIORITY)

**Create health check script that runs BEFORE enabling services:**

```bash
# /opt/escapeplan/scripts/health-check.sh

#!/bin/bash
set -e

echo "Running EscapePlan Health Checks..."

# Check 1: better-sqlite3 module loads
echo -n "Checking better-sqlite3... "
cd /opt/escapeplan/api
if node -e "require('better-sqlite3')" 2>/dev/null; then
    echo "✓"
else
    echo "✗ FAILED"
    echo "Error: better-sqlite3 module won't load"
    exit 1
fi

# Check 2: Database exists and is accessible
echo -n "Checking database... "
if [ -f "/var/lib/escapeplan/escapeplan.db" ]; then
    if node -e "const db = require('better-sqlite3')('/var/lib/escapeplan/escapeplan.db'); db.close();" 2>/dev/null; then
        echo "✓"
    else
        echo "✗ FAILED"
        echo "Error: Cannot open database"
        exit 1
    fi
else
    echo "✗ FAILED"
    echo "Error: Database file not found"
    exit 1
fi

# Check 3: API can start (dry run)
echo -n "Checking API startup... "
cd /opt/escapeplan/api
timeout 10 node dist/index.js &
API_PID=$!
sleep 3
if kill -0 ${API_PID} 2>/dev/null; then
    kill ${API_PID}
    wait ${API_PID} 2>/dev/null || true
    echo "✓"
else
    echo "✗ FAILED"
    echo "Error: API crashed during startup test"
    exit 1
fi

# Check 4: Web can start (dry run)
echo -n "Checking Web startup... "
cd /opt/escapeplan/web
timeout 10 node server.js &
WEB_PID=$!
sleep 3
if kill -0 ${WEB_PID} 2>/dev/null; then
    kill ${WEB_PID}
    wait ${WEB_PID} 2>/dev/null || true
    echo "✓"
else
    echo "✗ FAILED"
    echo "Error: Web crashed during startup test"
    exit 1
fi

# Check 5: Network configuration
echo -n "Checking network... "
if ip addr show wlan0 | grep -q "10.10.10.1"; then
    echo "✓"
else
    echo "⚠ WARNING: wlan0 not configured (may be intentional)"
fi

echo ""
echo "✓ All critical health checks passed"
echo "System is ready for service activation"
exit 0
```

---

## v0.1.7 Implementation Checklist

### Phase 1: Fix better-sqlite3 (DO FIRST)
- [ ] Choose approach: Docker cross-compile, pre-built binary, or improved rebuild
- [ ] Implement chosen approach in build-deb.sh
- [ ] Test on clean ARM64 environment
- [ ] Verify `file better_sqlite3.node` shows "ARM aarch64"
- [ ] Test that module loads: `node -e "require('better-sqlite3')"`

### Phase 2: Fix Service Auto-Start (DO SECOND)
- [ ] Remove `systemctl enable` from postinst
- [ ] Create first-boot-setup.sh script
- [ ] Add health checks to first-boot-setup.sh
- [ ] Create boot-rescue.sh with boot counter
- [ ] Create escapeplan-rescue.service
- [ ] Test rescue mode activates after 3 crashes

### Phase 3: Improve Installation Safety (DO THIRD)
- [ ] Add comprehensive logging to postinst
- [ ] Add error trap that disables services on failure
- [ ] Create health-check.sh script
- [ ] Test installation on clean SD card
- [ ] Verify postinst log is readable

### Phase 4: Testing (DO FOURTH)
- [ ] Flash clean base image
- [ ] Install v0.1.7 package
- [ ] Verify services are NOT enabled
- [ ] Run health-check.sh - should pass
- [ ] Run first-boot-setup.sh - should enable and start services
- [ ] Verify API responds to curl http://localhost:4000/api/health
- [ ] Verify Web responds to curl http://localhost:3000
- [ ] Test login with admin@escapeplan.local / escapeplan
- [ ] Reboot Pi - verify services start automatically
- [ ] Kill API service 3 times - verify rescue mode activates

### Phase 5: Recovery Testing (DO FIFTH)
- [ ] Intentionally break better-sqlite3 binary
- [ ] Try to run first-boot-setup.sh - should fail with clear error
- [ ] Verify services NOT enabled (no boot loop)
- [ ] Fix better-sqlite3 manually
- [ ] Re-run first-boot-setup.sh - should succeed

---

## Deployment Procedure for v0.1.7

### Step 1: Build Package
```bash
cd /mnt/projects/escape-plan/escapeplan-app

# Apply changesets for v0.1.7
pnpm changeset version

# Build contracts
pnpm --filter @escapeplan/contracts build

# Build .deb package
pnpm run build:deb

# Verify package
ls -lh dist/escapeplan_0.1.7_arm64.deb
```

### Step 2: Flash Base Image
```bash
# Use Raspberry Pi Imager or dd
sudo dd if=/mnt/projects/escape-plan/escapeplan-base/artifacts/2025-09-30-escapeplan-os-lite.img \
    of=/dev/sdX bs=4M status=progress conv=fsync
```

### Step 3: First Boot
```bash
# Put SD card in Pi
# Power on
# Wait for boot (should work - base image is stable)
# Connect to WiFi or Ethernet
```

### Step 4: Install v0.1.7
```bash
# Copy package to Pi
scp dist/escapeplan_0.1.7_arm64.deb pi@escapeplan.local:/tmp/

# SSH to Pi
ssh pi@escapeplan.local

# Install package
sudo dpkg -i /tmp/escapeplan_0.1.7_arm64.deb

# Check installation log
tail -100 /var/log/escapeplan-install.log

# IMPORTANT: Installation should complete WITHOUT enabling services
```

### Step 5: Health Check & Service Activation
```bash
# Run health checks
sudo /opt/escapeplan/scripts/health-check.sh

# If health checks pass, activate services
sudo /opt/escapeplan/scripts/first-boot-setup.sh

# Monitor for crashes (should stay running)
sudo journalctl -u escapeplan-api -f
```

### Step 6: Verify System
```bash
# Test API
curl http://localhost:4000/api/health

# Test Web
curl http://localhost:3000

# Test HTTPS
curl -k https://escapeplan.local/api/health

# Test login
# Open browser: https://escapeplan.local
# Login: admin@escapeplan.local / escapeplan
```

---

## Rollback Plan

If v0.1.7 fails:

```bash
# 1. Disable services immediately
sudo systemctl disable escapeplan-api escapeplan-web
sudo systemctl stop escapeplan-api escapeplan-web

# 2. Check what failed
sudo /opt/escapeplan/scripts/health-check.sh

# 3. If better-sqlite3 is broken, rebuild manually
cd /opt/escapeplan/api
sudo npm rebuild better-sqlite3

# 4. If still broken, reflash base image
# (Use same process as before)
```

---

## Success Criteria for v0.1.7

### ✅ Build Phase
- [ ] Package builds successfully
- [ ] better-sqlite3 is ARM64 (verify with `file` command)
- [ ] Contracts are real directories (not symlinks)
- [ ] server.js exists and is executable
- [ ] All verification checks pass

### ✅ Installation Phase
- [ ] dpkg -i completes successfully
- [ ] Postinst log shows no errors
- [ ] Services are registered but NOT enabled
- [ ] health-check.sh script exists
- [ ] first-boot-setup.sh script exists
- [ ] Pi boots normally after installation

### ✅ Activation Phase
- [ ] health-check.sh passes all tests
- [ ] first-boot-setup.sh enables services
- [ ] first-boot-setup.sh starts services
- [ ] API service stays running for 30 seconds
- [ ] Web service stays running for 30 seconds
- [ ] No crash loops

### ✅ Runtime Phase
- [ ] API responds to /api/health
- [ ] Web serves login page
- [ ] Login works with admin/escapeplan
- [ ] Dashboard loads
- [ ] Database queries work
- [ ] Services survive reboot
- [ ] No errors in logs

### ✅ Recovery Phase
- [ ] If services crash 3 times, rescue mode activates
- [ ] Rescue mode disables services (no boot loop)
- [ ] User can SSH in during rescue mode
- [ ] Manual fix and re-enable works

---

## Known Issues & Workarounds

### Issue: better-sqlite3 May Still Fail on Some Pi Models
**Workaround:** Pre-built binary approach is most reliable

### Issue: First Boot Takes Longer (Manual Setup Required)
**Workaround:** This is intentional for safety - automated later after v0.1.7 proves stable

### Issue: Rescue Mode May Trigger on Slow Pi
**Workaround:** Adjust boot counter threshold from 3 to 5 in boot-rescue.sh

---

## Questions to Answer Before Implementing v0.1.7

1. **Which better-sqlite3 approach?**
   - Docker cross-compile (cleanest)
   - Pre-built binary download (fastest)
   - Improved rebuild logic (most flexible)

2. **Should first-boot-setup.sh be automated eventually?**
   - Yes, after v0.1.7 proves stable
   - Could add to web UI as "Initial Setup" page
   - Or run automatically on first web access

3. **What should rescue mode do?**
   - Just disable services (current plan)
   - Also send email/notification? (needs internet)
   - Flash LED pattern on Pi? (hardware dependent)

---

## Additional Notes

**Why v0.1.6 Boot Loop Was So Severe:**

The combination of:
1. Broken better-sqlite3 binary
2. Service auto-start on boot
3. Fast restart interval (10 seconds)
4. No rescue mechanism

Created a **perfect storm** where:
- Service crashes immediately on load
- systemd restarts it 10 seconds later
- Crashes again, restarts again
- Exhausts CPU/memory trying to restart
- System becomes unresponsive
- Even disabling ALL services couldn't recover (filesystem may have been corrupted by crash loops)

**Why Reflash Was the Only Solution:**

- Filesystem likely corrupted by rapid crash/restart cycles
- systemd journal may have filled disk
- Init system may have been damaged
- Safest path was clean slate with working base image

**Why v0.1.7 Will Be Different:**

- Services DON'T auto-start (no immediate crash on boot)
- Health checks BEFORE enabling (catch problems early)
- Rescue mode if problems detected (no boot loop possible)
- Better logging (can diagnose issues remotely)
- Manual activation (human verification step)

---

## IMMEDIATE ACTION ITEMS FOR AGENT

1. **READ THIS ENTIRE DOCUMENT** to understand what went wrong
2. **CHOOSE** better-sqlite3 build approach (recommend pre-built binary for speed)
3. **IMPLEMENT** all FIX #1-#5 in build-deb.sh
4. **CREATE** changeset for v0.1.7
5. **BUILD** package with all fixes
6. **TEST** on clean base image
7. **DOCUMENT** any issues encountered
8. **REPORT** back when ready for deployment

---

**END OF DOCUMENT**
