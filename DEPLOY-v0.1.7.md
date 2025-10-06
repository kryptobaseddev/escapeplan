# EscapePlan v0.1.7 Deployment Guide

**Version:** 0.1.7
**Release Date:** October 5, 2025
**Status:** EMERGENCY RELEASE - Critical Boot Loop Fixes
**Architecture:** ARM64 (Raspberry Pi)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [BREAKING CHANGES](#breaking-changes)
3. [Prerequisites](#prerequisites)
4. [Pre-Deployment Checklist](#pre-deployment-checklist)
5. [Installation Procedure](#installation-procedure)
6. [First Boot Setup](#first-boot-setup)
7. [Service Verification](#service-verification)
8. [Post-Deployment Testing](#post-deployment-testing)
9. [Troubleshooting](#troubleshooting)
10. [Rollback Procedure](#rollback-procedure)
11. [Migration from v0.1.6](#migration-from-v016-bricked-systems)
12. [Success Criteria](#success-criteria)
13. [Known Issues and Limitations](#known-issues-and-limitations)
14. [Support and Logs](#support-and-logs)

---

## Executive Summary

### What Changed in v0.1.7

v0.1.7 is an **EMERGENCY RELEASE** that fixes a critical boot loop issue discovered in v0.1.6. The previous version caused complete Raspberry Pi system failure due to auto-starting services with broken ARM64 native modules.

**Critical Fixes:**
- Pre-built ARM64 better-sqlite3 binary (eliminates runtime compilation failures)
- Services NO LONGER auto-start on installation (prevents boot loops)
- Boot rescue system with automatic service disabling after 3 consecutive failures
- Comprehensive installation error handling and logging
- Manual first-boot-setup.sh script for safe service activation

**Why This Release is Critical:**
v0.1.6 deployments resulted in unbootable systems requiring complete SD card reflash. v0.1.7 implements multiple layers of protection to prevent this catastrophic failure mode.

---

## BREAKING CHANGES

### Services No Longer Auto-Start

**Previous Behavior (v0.1.6 and earlier):**
- Services enabled and started automatically during package installation
- System automatically starts services on every boot
- **RISK:** If services crash, system becomes unbootable

**New Behavior (v0.1.7+):**
- Services are registered but **NOT enabled** during installation
- Manual activation required after first boot
- Must run `/opt/escapeplan/scripts/first-boot-setup.sh` to enable services
- **BENEFIT:** Health checks run before service activation, preventing boot loops

### Migration Impact

**New Installations:**
- Follow standard deployment procedure in this document
- Includes mandatory health check step before service activation

**Upgrades from v0.1.6:**
- If system is already bricked, see [Migration from v0.1.6](#migration-from-v016-bricked-systems)
- If system is still operational, follow [Installation Procedure](#installation-procedure)

**Upgrades from v0.1.5 or earlier:**
- Standard installation procedure applies
- Services will be disabled during upgrade, must be manually re-enabled

---

## Prerequisites

### Base Image Requirements

**Minimum Base Image:**
- Raspberry Pi OS Lite (Debian Bookworm)
- Date: 2025-09-30 or later
- Architecture: ARM64 (aarch64)
- Base image should include:
  - Network configuration (WiFi AP or Ethernet)
  - SSH enabled
  - User account configured (default: `pi`)

**Recommended Base Image:**
- Custom EscapePlan OS image from `escapeplan-base` repository
- Pre-configured with:
  - WiFi Access Point (SSID: EscapePlan)
  - Network: 10.10.10.0/24, Gateway: 10.10.10.1
  - mDNS hostname: escapeplan.local
  - nginx, hostapd, dnsmasq pre-installed

### System Requirements

**Hardware:**
- Raspberry Pi 4 Model B (4GB+ RAM recommended)
- 32GB+ microSD card (Class 10 or better)
- Reliable power supply (5V 3A minimum)

**Software Dependencies:**
- Node.js 20.x or later
- nginx (web server and reverse proxy)
- sqlite3 (database CLI tools)
- build-essential, python3 (optional, for manual native module rebuilds)

**Network Access:**
- SSH connectivity to Raspberry Pi
- SCP access for file transfer
- mDNS resolution (escapeplan.local) OR direct IP access (10.10.10.1)

---

## Pre-Deployment Checklist

Before proceeding with installation, verify the following:

### Build Verification

- [ ] Package file exists: `dist/escapeplan_0.1.7_arm64.deb`
- [ ] Package size is reasonable (expected: ~500-530MB)
- [ ] Package was built on x86_64 host with cross-compilation for ARM64
- [ ] Build logs show no errors

### Base System Verification

```bash
# SSH into Raspberry Pi
ssh pi@escapeplan.local

# Verify Node.js version
node --version  # Should be v20.x or later

# Verify nginx is installed
nginx -v

# Verify systemd is running
systemctl --version

# Verify available disk space (need at least 2GB free)
df -h /

# Exit SSH session
exit
```

### Backup Existing Installation (if upgrading)

```bash
# If upgrading from previous version, backup database
ssh pi@escapeplan.local
sudo /opt/escapeplan/scripts/backup.sh
exit
```

---

## Installation Procedure

### Step 1: Transfer Package to Raspberry Pi

```bash
# From build machine, copy .deb package to Pi
scp dist/escapeplan_0.1.7_arm64.deb pi@escapeplan.local:/tmp/

# Verify transfer succeeded
ssh pi@escapeplan.local "ls -lh /tmp/escapeplan_0.1.7_arm64.deb"
```

**Expected Output:**
```
-rw-r--r-- 1 pi pi 513M Oct  5 10:00 /tmp/escapeplan_0.1.7_arm64.deb
```

### Step 2: Install Package

```bash
# SSH into Pi
ssh pi@escapeplan.local

# Install package with dpkg
sudo dpkg -i /tmp/escapeplan_0.1.7_arm64.deb

# If dependencies are missing, run:
sudo apt-get install -f
```

**Expected Installation Output:**
```
Selecting previously unselected package escapeplan.
(Reading database ... 123456 files and directories currently installed.)
Preparing to unpack .../escapeplan_0.1.7_arm64.deb ...
Unpacking escapeplan (0.1.7) ...
Setting up escapeplan (0.1.7) ...
[postinst] EscapePlan package installation starting...
[postinst] Creating escapeplan system user...
[postinst] Creating data directories...
[postinst] Setting directory ownership...
[postinst] Verifying and repairing contracts package dependencies...
[postinst] Configuring nginx reverse proxy...
[postinst] Package installation complete. Running orchestrator for system configuration...
[orchestrator] Starting EscapePlan post-installation orchestration...
[orchestrator] Step 1: Environment Setup
[orchestrator] Step 2: Systemd Service Scripts
[orchestrator] Step 3: Database Initialization
[orchestrator] Step 4: File Permissions
[orchestrator] Step 5: Nginx Configuration
[orchestrator] Step 6: Service Configuration
[orchestrator] ✓ Services registered but NOT enabled
[orchestrator] ✓ Run '/opt/escapeplan/scripts/first-boot-setup.sh' after first boot to enable

✓ EscapePlan installation and configuration complete!

⚠️  IMPORTANT: Services are NOT auto-enabled (prevents boot loops)

To enable and start services safely:
  Option 1 (recommended): /opt/escapeplan/scripts/first-boot-setup.sh
  Option 2 (manual):
    systemctl enable escapeplan-api escapeplan-web
    systemctl start escapeplan-api escapeplan-web

Check installation status with:
  /opt/escapeplan/scripts/health-check.sh
```

### Step 3: Verify Installation Log

```bash
# Check installation log for errors
sudo tail -100 /var/log/escapeplan-install.log

# Look for any ERROR or WARNING messages
grep -i error /var/log/escapeplan-install.log
grep -i warning /var/log/escapeplan-install.log
```

**No errors should be present. If errors exist, DO NOT proceed to service activation.**

### Step 4: Reboot System (Optional but Recommended)

```bash
# Reboot to ensure clean state
sudo reboot
```

**IMPORTANT:** After reboot, services will **NOT** start automatically. This is expected behavior in v0.1.7.

---

## First Boot Setup

After installation and optional reboot, you must manually activate services using the first-boot-setup.sh script.

### What first-boot-setup.sh Does

The first-boot-setup.sh script performs the following safety checks:

1. **better-sqlite3 Module Test** - Verifies native module loads correctly
2. **Database Connection Test** - Confirms database is accessible
3. **Service Enablement** - Enables systemd services for auto-start
4. **Service Startup** - Starts API and Web services
5. **Stability Verification** - Waits 30 seconds and confirms services remain running

### Run First Boot Setup

```bash
# SSH into Pi
ssh pi@escapeplan.local

# Run first-boot-setup.sh script
sudo /opt/escapeplan/scripts/first-boot-setup.sh
```

**Expected Output:**

```
==========================================
EscapePlan First Boot Setup
==========================================

Testing better-sqlite3 module loading... OK
Testing database connection... OK

All pre-flight checks passed!

Enabling systemd services...
Created symlink /etc/systemd/system/multi-user.target.wants/escapeplan-api.service → /etc/systemd/system/escapeplan-api.service.
Created symlink /etc/systemd/system/multi-user.target.wants/escapeplan-web.service → /etc/systemd/system/escapeplan-web.service.
Services enabled

Starting services...
Services started

Waiting 30 seconds for services to stabilize...

Verifying services are still running...
  escapeplan-api.service: RUNNING
  escapeplan-web.service: RUNNING

==========================================
SUCCESS! EscapePlan services are running.
==========================================

Access the application at:
  http://escapeplan.local
  http://10.10.10.1

Check service status with:
  systemctl status escapeplan-api.service
  systemctl status escapeplan-web.service

View logs with:
  journalctl -u escapeplan-api.service -f
  journalctl -u escapeplan-web.service -f
```

### If First Boot Setup Fails

If first-boot-setup.sh exits with an error:

1. **Check the error message** - Script will indicate which test failed
2. **Review logs** - Check `/var/log/escapeplan-install.log` and systemd journals
3. **DO NOT manually enable services** - Fix the underlying issue first
4. **Consult [Troubleshooting](#troubleshooting)** section below

**Common Failure Scenarios:**
- better-sqlite3 module won't load → See [Manual better-sqlite3 Rebuild](#manual-better-sqlite3-rebuild)
- Database connection fails → Check database file permissions and initialization
- Services crash on startup → Check service logs with `journalctl -u escapeplan-api -n 50`

---

## Service Verification

### Check Service Status

```bash
# Check if services are enabled
systemctl is-enabled escapeplan-api.service
systemctl is-enabled escapeplan-web.service

# Check if services are running
systemctl is-active escapeplan-api.service
systemctl is-active escapeplan-web.service

# Get detailed service status
systemctl status escapeplan-api.service
systemctl status escapeplan-web.service
```

**Expected Output:**
```
● escapeplan-api.service - EscapePlan Fastify API
     Loaded: loaded (/etc/systemd/system/escapeplan-api.service; enabled; vendor preset: enabled)
     Active: active (running) since Sat 2025-10-05 10:15:00 UTC; 2min 30s ago
   Main PID: 1234 (node)
      Tasks: 11 (limit: 4915)
     Memory: 85.2M
        CPU: 1.234s
     CGroup: /system.slice/escapeplan-api.service
             └─1234 /usr/bin/node /opt/escapeplan/api/dist/index.js

Oct 05 10:15:00 escapeplan systemd[1]: Started EscapePlan Fastify API.
Oct 05 10:15:01 escapeplan escapeplan-api[1234]: API server listening on http://0.0.0.0:4000
```

### Check Service Logs

```bash
# View API logs (last 50 lines)
journalctl -u escapeplan-api.service -n 50

# View Web logs (last 50 lines)
journalctl -u escapeplan-web.service -n 50

# Follow logs in real-time (Ctrl+C to stop)
journalctl -u escapeplan-api.service -f
journalctl -u escapeplan-web.service -f
```

### Run Health Check Script

```bash
# Run comprehensive health checks
sudo /opt/escapeplan/scripts/health-check.sh

# Run with verbose output
sudo /opt/escapeplan/scripts/health-check.sh --verbose
```

**Expected Output:**
```
═══════════════════════════════════════════════════════
  EscapePlan Health Check Validation
═══════════════════════════════════════════════════════

[✓] System user 'escapeplan' exists
[✓] Node.js installed (v20.11.1)
[✓] better-sqlite3 module loads successfully
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
[⚠] wlan0 exists but does not have 10.10.10.1 configured

═══════════════════════════════════════════════════════
  Health Check Summary
═══════════════════════════════════════════════════════

[✓] All 14 checks passed!

[INFO] EscapePlan is healthy and ready for operation
```

---

## Post-Deployment Testing

After services are running, perform end-to-end testing to verify functionality.

### Test 1: API Health Endpoint

```bash
# Test API health endpoint
curl http://localhost:4000/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-10-05T10:15:00.000Z"}
```

### Test 2: Web Application Access

```bash
# Test web application (from Pi)
curl http://localhost:3000/

# Test via nginx (from Pi)
curl -k https://escapeplan.local/

# From external device on same network:
# Open browser to: https://10.10.10.1/ or https://escapeplan.local/
```

**Expected:** Login page should load with EscapePlan branding

### Test 3: Authentication

```bash
# From browser, navigate to https://escapeplan.local/login

# Login with default credentials:
# Email: admin@escapeplan.local
# Password: escapeplan
```

**Expected:** Successful login, redirect to dashboard

### Test 4: Database Operations

```bash
# Connect to database and verify seeded data
sqlite3 /var/lib/escapeplan/escapeplan.db

# Check users table
SELECT email, user_type FROM user LIMIT 5;

# Check roles table
SELECT name, user_type_scope FROM roles;

# Exit sqlite
.quit
```

**Expected:** Database contains seeded admin user, system roles, and initial data

### Test 5: Real-Time WebSocket Connection

1. Open browser to dashboard at `https://escapeplan.local/dashboard`
2. Open browser console (F12)
3. Look for WebSocket connection messages
4. Create a test booking or start a session
5. Verify dashboard updates in real-time

**Expected:** Socket.IO connection established, real-time updates work

### Test 6: Service Persistence After Reboot

```bash
# Reboot system to verify services auto-start
sudo reboot

# Wait for reboot (30-60 seconds)

# SSH back in
ssh pi@escapeplan.local

# Verify services started automatically
systemctl is-active escapeplan-api.service
systemctl is-active escapeplan-web.service
```

**Expected:** Both services show "active" status after reboot

---

## Troubleshooting

### Check if Rescue Mode Activated

If the system boots but EscapePlan services aren't running, check if rescue mode activated:

```bash
# Check for rescue mode flag
ls -la /var/lib/escapeplan/.rescue-mode

# Check boot counter
cat /var/lib/escapeplan/.boot-count

# Check rescue service logs
journalctl -u escapeplan-rescue.service -n 50
```

**If rescue mode is active:**

```
[boot-rescue] ERROR: Boot failure threshold exceeded (3 >= 3)
[boot-rescue] ERROR: Entering rescue mode to prevent boot loop
[boot-rescue] Disabling escapeplan-api.service
[boot-rescue] Disabling escapeplan-web.service
[boot-rescue] ERROR: ==========================================
[boot-rescue] ERROR: RESCUE MODE ACTIVATED
[boot-rescue] ERROR: ==========================================
[boot-rescue] ERROR: EscapePlan services have been disabled to prevent boot loops.
```

### Exit Rescue Mode

```bash
# 1. Fix the underlying issue (see troubleshooting steps below)

# 2. Remove rescue mode flag
sudo rm /var/lib/escapeplan/.rescue-mode

# 3. Reset boot counter
echo 0 | sudo tee /var/lib/escapeplan/.boot-count

# 4. Re-run first-boot-setup.sh
sudo /opt/escapeplan/scripts/first-boot-setup.sh

# 5. Verify services started
systemctl status escapeplan-api escapeplan-web
```

### Manual better-sqlite3 Rebuild

If better-sqlite3 module fails to load (ERR_DLOPEN_FAILED):

```bash
# Check current binary architecture
file /opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node

# If not ARM64, rebuild manually:
cd /opt/escapeplan/api

# Ensure build tools are installed
sudo apt-get update
sudo apt-get install -y build-essential python3

# Rebuild better-sqlite3
sudo -u escapeplan npm rebuild better-sqlite3

# Verify rebuild succeeded
file node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node

# Expected: "ELF 64-bit LSB shared object, ARM aarch64"

# Test module loads
node -e "require('better-sqlite3')"

# If successful, re-run first-boot-setup.sh
sudo /opt/escapeplan/scripts/first-boot-setup.sh
```

### Database Initialization Issues

If database initialization failed or database is corrupt:

```bash
# Check if database file exists
ls -lh /var/lib/escapeplan/escapeplan.db

# Check database initialization marker
ls -la /var/lib/escapeplan/.db-initialized

# If marker missing, database wasn't initialized:
# Re-run orchestrator script
sudo /opt/escapeplan/scripts/postinst-orchestrator.sh /opt/escapeplan

# Or manually initialize database:
cd /opt/escapeplan/api
sudo -u escapeplan node dist/db/seed.js
sudo touch /var/lib/escapeplan/.db-initialized
```

### Service Crash Loop Detection

If services are crashing repeatedly:

```bash
# Check service restart count
systemctl show escapeplan-api.service -p NRestarts

# If restart count is high (>10), investigate crash cause:

# View crash logs
journalctl -u escapeplan-api.service -n 100

# Common crash causes:
# 1. better-sqlite3 module error (ERR_DLOPEN_FAILED)
# 2. Database file locked or corrupt
# 3. Port already in use (4000 or 3000)
# 4. Missing environment variables

# Disable service to prevent more crashes
sudo systemctl disable escapeplan-api.service
sudo systemctl stop escapeplan-api.service

# Fix underlying issue, then re-enable
sudo /opt/escapeplan/scripts/first-boot-setup.sh
```

### Network Configuration Issues

If nginx or WiFi AP isn't working:

```bash
# Check nginx status
systemctl status nginx

# Test nginx configuration
sudo nginx -t

# Check WiFi AP status (if using hostapd)
systemctl status hostapd

# Check network interface
ip addr show wlan0

# Expected: 10.10.10.1/24 on wlan0
```

### Log File Locations

All critical logs for troubleshooting:

```bash
# Installation log
/var/log/escapeplan-install.log

# Postinst orchestrator log
/tmp/escapeplan-postinst.log

# API service logs (systemd)
journalctl -u escapeplan-api.service

# Web service logs (systemd)
journalctl -u escapeplan-web.service

# Rescue service logs
journalctl -u escapeplan-rescue.service

# Nginx access logs
/var/log/nginx/access.log

# Nginx error logs
/var/log/nginx/error.log

# System boot logs
journalctl -b
```

### Permission Issues

If services fail due to permission errors:

```bash
# Reset ownership of all EscapePlan directories
sudo chown -R escapeplan:escapeplan /opt/escapeplan
sudo chown -R escapeplan:escapeplan /var/lib/escapeplan
sudo chown -R escapeplan:escapeplan /var/log/escapeplan
sudo chown -R escapeplan:escapeplan /etc/escapeplan

# Verify database permissions
ls -l /var/lib/escapeplan/escapeplan.db
# Should be: -rw-r--r-- escapeplan escapeplan

# Verify log directory permissions
ls -ld /var/log/escapeplan
# Should be: drwxr-xr-x escapeplan escapeplan
```

---

## Rollback Procedure

If v0.1.7 deployment fails and system needs to be restored:

### Option 1: Rollback to Previous Package (if v0.1.5 or earlier)

```bash
# If you have a backup of previous working .deb:
# 1. Remove v0.1.7
sudo systemctl stop escapeplan-api escapeplan-web
sudo systemctl disable escapeplan-api escapeplan-web
sudo apt-get remove escapeplan

# 2. Restore database backup (if created)
sudo cp /var/backups/escapeplan/escapeplan-YYYYMMDD-HHMMSS.db /var/lib/escapeplan/escapeplan.db

# 3. Install previous version
sudo dpkg -i escapeplan_0.1.5_arm64.deb

# 4. Restart services
sudo systemctl start escapeplan-api escapeplan-web
```

### Option 2: Reflash Base Image (if system is bricked)

If system is completely unbootable or rescue mode cannot be exited:

```bash
# From development machine:

# 1. Flash base image to SD card
sudo dd if=/path/to/escapeplan-base-image.img of=/dev/sdX bs=4M status=progress conv=fsync

# 2. Boot Pi with fresh image

# 3. Install working package version (v0.1.5 or v0.1.7 after fixes)
scp escapeplan_0.1.7_arm64.deb pi@escapeplan.local:/tmp/
ssh pi@escapeplan.local
sudo dpkg -i /tmp/escapeplan_0.1.7_arm64.deb

# 4. Run first-boot-setup.sh
sudo /opt/escapeplan/scripts/first-boot-setup.sh
```

### Option 3: Manual Service Disable (temporary fix)

If services are crashing but system is otherwise functional:

```bash
# Disable services to stop crash loop
sudo systemctl disable escapeplan-api escapeplan-web
sudo systemctl stop escapeplan-api escapeplan-web

# System will remain bootable but EscapePlan won't run

# Investigate root cause, fix issue, then re-enable
sudo /opt/escapeplan/scripts/first-boot-setup.sh
```

---

## Migration from v0.1.6 (Bricked Systems)

If your Raspberry Pi is already bricked from v0.1.6 deployment and stuck in boot loop:

### Recovery Steps

**WARNING:** These steps require physical access to the SD card.

#### Step 1: Extract SD Card from Pi

1. Power off Raspberry Pi
2. Remove SD card
3. Insert SD card into card reader on development machine

#### Step 2: Disable Auto-Start Services

```bash
# Mount SD card partitions
# On Linux:
sudo mkdir -p /mnt/pi-boot
sudo mkdir -p /mnt/pi-root
sudo mount /dev/sdX1 /mnt/pi-boot  # Boot partition
sudo mount /dev/sdX2 /mnt/pi-root  # Root partition

# Disable escapeplan services
cd /mnt/pi-root/etc/systemd/system/multi-user.target.wants/
sudo rm -f escapeplan-api.service
sudo rm -f escapeplan-web.service

# Or rename service files to prevent loading
cd /mnt/pi-root/etc/systemd/system/
sudo mv escapeplan-api.service escapeplan-api.service.disabled
sudo mv escapeplan-web.service escapeplan-web.service.disabled

# Unmount and eject SD card
cd ~
sudo umount /mnt/pi-boot
sudo umount /mnt/pi-root
```

#### Step 3: Boot Pi and Fix Installation

```bash
# 1. Insert SD card back into Pi
# 2. Power on - should boot successfully now (services disabled)

# 3. SSH into Pi
ssh pi@escapeplan.local

# 4. Remove broken package
sudo apt-get remove escapeplan

# 5. Clean up any leftover files
sudo rm -rf /opt/escapeplan
sudo rm -rf /var/lib/escapeplan
sudo rm -rf /etc/escapeplan

# 6. Install v0.1.7
scp dist/escapeplan_0.1.7_arm64.deb pi@escapeplan.local:/tmp/
ssh pi@escapeplan.local
sudo dpkg -i /tmp/escapeplan_0.1.7_arm64.deb

# 7. Run first-boot-setup.sh
sudo /opt/escapeplan/scripts/first-boot-setup.sh
```

#### Step 4: Verify Recovery

```bash
# Check services are running
systemctl status escapeplan-api escapeplan-web

# Run health checks
sudo /opt/escapeplan/scripts/health-check.sh

# Test web access
curl -k https://escapeplan.local/
```

### Alternative: Complete Reflash

If recovery steps don't work or SD card is corrupted:

```bash
# 1. Flash base image to SD card (from development machine)
sudo dd if=/path/to/escapeplan-base-image.img of=/dev/sdX bs=4M status=progress conv=fsync

# 2. Boot Pi with fresh image

# 3. Follow standard installation procedure from this guide
```

---

## Success Criteria

Use this checklist to verify successful deployment:

### Build Phase

- [ ] Package built successfully: `dist/escapeplan_0.1.7_arm64.deb`
- [ ] Package size is ~500-530MB
- [ ] better-sqlite3 binary is ARM64 (verified during build with `file` command)
- [ ] Contracts are real directories, not symlinks
- [ ] server.js exists in web package
- [ ] All build verification checks passed

### Installation Phase

- [ ] dpkg -i completed successfully without errors
- [ ] Postinst log shows no errors: `/var/log/escapeplan-install.log`
- [ ] Services registered but NOT enabled (expected behavior)
- [ ] health-check.sh script exists at `/opt/escapeplan/scripts/health-check.sh`
- [ ] first-boot-setup.sh script exists at `/opt/escapeplan/scripts/first-boot-setup.sh`
- [ ] Rescue service registered: `escapeplan-rescue.service`
- [ ] Pi boots normally after installation (services not running)

### Activation Phase

- [ ] health-check.sh passes all critical tests
- [ ] first-boot-setup.sh completes without errors
- [ ] first-boot-setup.sh enables both services
- [ ] first-boot-setup.sh starts both services
- [ ] API service stays running for 30+ seconds
- [ ] Web service stays running for 30+ seconds
- [ ] No crash loops detected

### Runtime Phase

- [ ] API responds to `/api/health` endpoint
- [ ] Web serves login page at `https://escapeplan.local/`
- [ ] Login works with default credentials (admin@escapeplan.local / escapeplan)
- [ ] Dashboard loads and displays correctly
- [ ] Database queries execute successfully
- [ ] Real-time WebSocket connection established
- [ ] Services survive system reboot
- [ ] No errors in service logs
- [ ] No errors in nginx logs

### Recovery Phase

- [ ] Rescue service exists and is enabled
- [ ] Boot counter file exists: `/var/lib/escapeplan/.boot-count`
- [ ] If services crash 3 times, rescue mode activates
- [ ] Rescue mode disables services (prevents boot loop)
- [ ] User can SSH into system during rescue mode
- [ ] Manual fix and re-enable works via first-boot-setup.sh

---

## Known Issues and Limitations

### Issue 1: Manual Service Activation Required

**Description:** Services do not auto-start after installation. Manual first-boot-setup.sh execution required.

**Impact:** Deployment requires an additional manual step.

**Workaround:** Follow first-boot-setup procedure in this guide.

**Future Fix:** May automate in v0.1.8+ once stability proven.

### Issue 2: Rescue Mode May Trigger on Slow Hardware

**Description:** On older/slower Raspberry Pi models, services may take longer to start, potentially triggering rescue mode.

**Impact:** False-positive rescue mode activation.

**Workaround:** Adjust boot counter threshold in `/opt/escapeplan/scripts/boot-rescue.sh` from 3 to 5.

**Future Fix:** Adaptive threshold based on hardware detection.

### Issue 3: First Boot Takes Longer

**Description:** Manual service activation adds 30-60 seconds to first boot process.

**Impact:** Slightly longer deployment time.

**Workaround:** None needed - this is expected behavior for safety.

**Future Fix:** May reduce wait time in first-boot-setup.sh once proven stable.

### Issue 4: WiFi AP Configuration Not Included

**Description:** WiFi Access Point configuration is part of base image, not application package.

**Impact:** WiFi AP must be configured separately (handled by escapeplan-base image).

**Workaround:** Use base image with pre-configured WiFi AP or configure manually.

**Future Fix:** Document WiFi AP configuration in separate guide.

---

## Support and Logs

### Getting Help

If deployment fails or issues arise:

1. **Collect logs:**
   ```bash
   # Create support bundle
   mkdir -p /tmp/escapeplan-support
   sudo cp /var/log/escapeplan-install.log /tmp/escapeplan-support/
   sudo journalctl -u escapeplan-api.service -n 200 > /tmp/escapeplan-support/api.log
   sudo journalctl -u escapeplan-web.service -n 200 > /tmp/escapeplan-support/web.log
   sudo journalctl -u escapeplan-rescue.service -n 100 > /tmp/escapeplan-support/rescue.log
   sudo /opt/escapeplan/scripts/health-check.sh --verbose > /tmp/escapeplan-support/health-check.log 2>&1 || true
   tar -czf escapeplan-support-$(date +%Y%m%d-%H%M%S).tar.gz /tmp/escapeplan-support/
   ```

2. **Review troubleshooting section** in this document

3. **Check project documentation:**
   - `/mnt/projects/escape-plan/escapeplan-app/CRITICAL-v0.1.6-BOOT-LOOP-ANALYSIS-AND-v0.1.7-FIXES.md`
   - `/mnt/projects/escape-plan/escapeplan-app/project-docs/project-overview.md`

4. **Submit issue** with support bundle and description

### Log Rotation

Logs will grow over time. Configure log rotation:

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/escapeplan > /dev/null <<EOF
/var/log/escapeplan/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 escapeplan escapeplan
}
EOF
```

### Monitoring Recommendations

For production deployments, consider:

- **Health check cron job:** Run health-check.sh hourly and log results
- **Service monitoring:** Use systemd email notifications or external monitoring
- **Disk space monitoring:** Alert when /var/lib/escapeplan exceeds 80% capacity
- **Database backups:** Enable escapeplan-backup.timer for daily backups

```bash
# Enable automatic daily backups
sudo systemctl enable escapeplan-backup.timer
sudo systemctl start escapeplan-backup.timer

# Verify backup timer is active
systemctl status escapeplan-backup.timer
```

---

## Deployment Checklist Summary

Print this checklist and check off each step during deployment:

**Pre-Deployment:**
- [ ] Build package on x86_64 host with ARM64 cross-compilation
- [ ] Verify package file exists and size is correct
- [ ] Backup existing installation (if upgrading)
- [ ] Verify Pi is accessible via SSH
- [ ] Verify base image requirements met

**Installation:**
- [ ] Transfer package to Pi via SCP
- [ ] Install package with dpkg -i
- [ ] Review installation log for errors
- [ ] Verify services NOT enabled (expected)
- [ ] Reboot system (optional)

**Activation:**
- [ ] Run health-check.sh script
- [ ] Verify all health checks pass
- [ ] Run first-boot-setup.sh script
- [ ] Wait for 30-second stability test
- [ ] Verify both services running

**Verification:**
- [ ] Test API health endpoint
- [ ] Test web application access
- [ ] Test login with default credentials
- [ ] Test database operations
- [ ] Test real-time WebSocket connection
- [ ] Reboot and verify services auto-start

**Production:**
- [ ] Change default admin password
- [ ] Configure production secrets (BETTER_AUTH_SECRET)
- [ ] Enable backup timer
- [ ] Configure log rotation
- [ ] Document network configuration
- [ ] Test rescue mode (optional)

---

**END OF DEPLOYMENT GUIDE**

For technical details on fixes implemented in v0.1.7, see:
`CRITICAL-v0.1.6-BOOT-LOOP-ANALYSIS-AND-v0.1.7-FIXES.md`

For changelog and release notes, see:
- `apps/escapeplan-api/CHANGELOG.md`
- `apps/escapeplan-web/CHANGELOG.md`
