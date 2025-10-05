# EscapePlan Installation Guide

**Quick Install:** 4 simple steps to get your escape room system running on Raspberry Pi.

---

## Prerequisites

Before you begin, make sure you have:

The system uses two WiFi interfaces:
- **wlan0** (built-in WiFi) - Internal broadcast AP (SSID: "EscapePlan") - Auto-configured in Step 3
- **wlan1** (USB WiFi dongle) - External WiFi client for internet access - Optional, managed via web UI after installation

### Hardware Requirements

**Required:**
- Raspberry Pi 4 or 5 (4GB+ RAM recommended)
- 32GB+ microSD card or SSD
- Built-in WiFi adapter (wlan0) - for internal network
- Power supply (official 5V/3A USB-C adapter recommended)

**Optional (for internet access):**
- USB WiFi dongle (AC600M or compatible) - for external WiFi connectivity
- Appears as wlan1 when plugged in
- Used to connect to home/office WiFi for OTA updates

### Software
- **Raspberry Pi OS 64-bit Bookworm** (already installed and running)
- **SSH access** or physical keyboard/monitor connected
- **Internet connection** (Ethernet or temporary WiFi for downloading the package during initial setup)

### Verify Your System

Check that you're running the correct OS:

```bash
cat /etc/os-release
```

**Expected output:**
```
PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
```

Check architecture:

```bash
uname -m
```

**Expected output:**
```
aarch64
```

If these don't match, you need to install Raspberry Pi OS 64-bit Bookworm first.

---

## Step 1: Get the Package

### Option A: Download from GitHub Releases (Recommended)

```bash
# Download the latest release
wget https://github.com/YOUR-ORG/escapeplan/releases/latest/download/escapeplan_0.1.0_arm64.deb

# Verify the download
ls -lh escapeplan_*.deb
```

### Option B: Copy from Another Computer

If you built the package on a development machine:

```bash
# On your computer, copy to the Pi
scp escapeplan_0.1.0_arm64.deb pi@raspberrypi.local:~/

# On the Pi, verify it arrived
ls -lh ~/escapeplan_*.deb
```

---

## Step 2: Install the Package

Run the installation command:

```bash
sudo dpkg -i escapeplan_*.deb
```

### What Happens Automatically

The installer will:
1. Create a system user (`escapeplan`) with restricted permissions
2. Install the application to `/opt/escapeplan/`
3. Set up the SQLite database at `/var/lib/escapeplan/escapeplan.db`
4. Create the default admin account with username `admin`
5. Configure systemd services (API and Web) but **not start them yet**
6. Generate security keys for session management

**Expected output:**
```
[postinst] Creating escapeplan system user...
[postinst] Creating directories...
[postinst] Repairing pnpm symlinks...
[postinst] Initializing database...
[postinst] Generating Better Auth secret...
[postinst] Enabling systemd services...
[postinst] ✓ Installation complete!
```

**Note:** If you see warnings about missing dependencies, proceed to Step 3 which will resolve them.

---

## Step 3: Run Setup

Run the post-install script to complete configuration:

```bash
sudo /opt/escapeplan/scripts/pi-post-install.sh
```

### What Happens Automatically

This script will:
1. **Install missing dependencies** (build-essential, nodejs, nginx, etc.)
2. **Rebuild native modules** for ARM64 architecture (better-sqlite3, argon2)
3. **Validate the installation** with health checks
4. **Prepare services** for first startup

**Expected output:**
```
========================================
EscapePlan Post-Install Master Orchestration
========================================

[pi-post-install] Install root: /opt/escapeplan
[pi-post-install] Log file: /tmp/escapeplan-post-install.log

========================================
STEP: Validating Dependencies
========================================
[validate-dependencies] Checking system dependencies...
[validate-dependencies] Installing missing packages...
[validate-dependencies] ✓ All dependencies satisfied

========================================
STEP: Rebuilding Native Modules
========================================
[pi-post-install] System architecture: aarch64
[pi-post-install] Found better-sqlite3 at: node_modules/.pnpm/...
[pi-post-install] Running: npm rebuild better-sqlite3
[pi-post-install] ✓ Native module rebuild successful and validated

========================================
STEP: Running Health Check
========================================
[health-check] Checking file permissions...
[health-check] Checking database integrity...
[health-check] ✓ Health check passed

========================================
Post-Install Summary
========================================
[pi-post-install] ✓ All post-install steps completed successfully

EscapePlan is ready to use!
  - Start API:  systemctl start escapeplan-api
  - Start Web:  systemctl start escapeplan-web
  - Check logs: /tmp/escapeplan-post-install.log
```

**This step takes 3-5 minutes** on a Raspberry Pi 4 due to native module compilation.

### If You See Errors

Check the detailed log:
```bash
cat /tmp/escapeplan-post-install.log
```

Common issues are covered in the Troubleshooting section below.

---

## Understanding the Network Setup

EscapePlan uses a **dual-WiFi architecture**:

### Internal WiFi Network (wlan0) - Automatic
- **Interface:** Built-in WiFi adapter (wlan0)
- **SSID:** "EscapePlan"
- **Purpose:** Operators and devices connect here to access the system
- **Configuration:** Auto-configured in Step 3 above
- **IP Address:** 10.10.10.1
- **DHCP Range:** 10.10.10.50 - 10.10.10.150
- **Password:** Displayed after Step 3 (also in `/etc/escapeplan/wifi-password.txt`)

### External WiFi Connection (wlan1) - Optional
- **Interface:** USB WiFi dongle (wlan1) - if plugged in
- **Purpose:** Connect to home/office WiFi for internet access (OTA updates, etc.)
- **Configuration:** Managed through web UI after installation
  1. Log in to admin panel
  2. Navigate to Settings → Network
  3. Scan and connect to external WiFi networks
- **Not required:** System works offline without wlan1

**Diagram:**
```
Raspberry Pi
├─ wlan0 (Internal AP) → Operator tablets connect here
└─ wlan1 (External Client) → Connects to your home WiFi (optional)
```

---

## Step 4: Access & Use

### Start the Services

```bash
# Start the API backend
sudo systemctl start escapeplan-api

# Start the web interface
sudo systemctl start escapeplan-web

# Verify they're running
sudo systemctl status escapeplan-api
sudo systemctl status escapeplan-web
```

**Expected output:**
```
● escapeplan-api.service - EscapePlan API Server
   Loaded: loaded (/etc/systemd/system/escapeplan-api.service; enabled)
   Active: active (running) since ...
```

### Check WiFi Password

View the auto-generated WiFi password:
```bash
sudo cat /etc/escapeplan/wifi-password.txt
```

Connect your tablet/phone to the "EscapePlan" WiFi network using this password.

### Access the Web Interface

Open your browser and navigate to one of these URLs:

- **Via hostname:** `http://escapeplan.local:3000`
- **Via IP address:** `http://10.10.10.1:3000` (if using default network config)
- **Via Pi hostname:** `http://raspberrypi.local:3000`

### Default Login Credentials

```
Email:    admin@escapeplan.local
Password: escapeplan
```

**IMPORTANT:** You will be prompted to change the password on first login. Choose a strong password and save it securely.

### First Steps After Login

1. **Change the admin password** (required on first login)
2. **Configure network settings** (WiFi SSID, password)
3. **Add your first game** (Games > Add Game)
4. **Set up rooms** (if you have physical escape rooms)
5. **Configure cameras** (optional, for live monitoring)

### Enable Auto-Start on Boot

Make the services start automatically when the Pi boots:

```bash
sudo systemctl enable escapeplan-api
sudo systemctl enable escapeplan-web
```

---

## Troubleshooting

### Installation Fails: "Missing Dependencies"

**Symptom:** `dpkg -i` reports unmet dependencies

**Solution:**
```bash
# Install missing packages automatically
sudo apt-get install -f

# Retry the installation
sudo dpkg -i escapeplan_*.deb
```

---

### Post-Install Script Fails: "npm: command not found"

**Symptom:** Step 3 fails with "npm not found"

**Solution:**
```bash
# Install Node.js
sudo apt-get update
sudo apt-get install -y nodejs npm

# Retry the post-install
sudo /opt/escapeplan/scripts/pi-post-install.sh
```

---

### Native Module Build Fails: "gcc: command not found"

**Symptom:** Step 3 fails during native module rebuild

**Solution:**
```bash
# Install build tools
sudo apt-get update
sudo apt-get install -y build-essential python3

# Retry the post-install
sudo /opt/escapeplan/scripts/pi-post-install.sh
```

---

### Service Won't Start: "Failed to start escapeplan-api.service"

**Symptom:** `systemctl start` fails or service crashes immediately

**Solution:**

Check the service logs:
```bash
sudo journalctl -u escapeplan-api -n 50 --no-pager
```

Common causes:
- **Port already in use:** Another service is using port 4000
  ```bash
  sudo lsof -i :4000
  sudo systemctl stop <conflicting-service>
  ```

- **Database corruption:** Remove and re-initialize
  ```bash
  sudo systemctl stop escapeplan-api
  sudo rm /var/lib/escapeplan/escapeplan.db
  sudo /opt/escapeplan/scripts/pi-post-install.sh
  ```

- **Permission errors:** Fix ownership
  ```bash
  sudo chown -R escapeplan:escapeplan /opt/escapeplan
  sudo chown -R escapeplan:escapeplan /var/lib/escapeplan
  ```

---

### Web Interface Not Accessible: "Connection Refused"

**Symptom:** Browser can't connect to the web interface

**Solution:**

1. **Check service status:**
   ```bash
   sudo systemctl status escapeplan-web
   ```

2. **Verify network connectivity:**
   ```bash
   # From your computer, ping the Pi
   ping raspberrypi.local

   # From the Pi, check if the port is listening
   sudo ss -tlnp | grep 3000
   ```

3. **Check firewall:**
   ```bash
   # Allow traffic on port 3000
   sudo ufw allow 3000/tcp
   ```

4. **Try the IP address directly:**
   ```bash
   # Find the Pi's IP address
   hostname -I

   # Use it in your browser
   http://<ip-address>:3000
   ```

---

### Login Fails: "Invalid email or password"

**Symptom:** Default credentials don't work

**Solution:**

Reset the admin password:
```bash
# Stop the API service
sudo systemctl stop escapeplan-api

# Re-run the database seed (resets admin password)
cd /opt/escapeplan/api
sudo -u escapeplan node src/db/seed.ts

# Restart the service
sudo systemctl start escapeplan-api
```

The password will be reset to `escapeplan`.

---

### "ARM Architecture Validation Failed"

**Symptom:** Post-install warns native modules are wrong architecture

**Solution:**

This usually happens if you're testing on x86_64. The system will warn but continue. On actual ARM hardware:

```bash
# Force rebuild of native modules
sudo /opt/escapeplan/scripts/pi-post-install.sh --rebuild-only --force
```

---

### Cannot Access After Changing Network Settings

**Symptom:** Changed WiFi SSID/password and lost access

**Solution:**

1. **Connect via Ethernet** or physical keyboard/monitor

2. **Check the network configuration:**
   ```bash
   # View current WiFi settings
   nmcli device wifi list

   # Reconnect to a known network
   sudo nmcli device wifi connect "YourNetwork" password "YourPassword"
   ```

3. **Reset to defaults:**
   ```bash
   # Restore default network config
   sudo rm /etc/escapeplan/network-config.json
   sudo systemctl restart escapeplan-api
   ```

---

### Complete System Reset

If everything fails and you want to start fresh:

```bash
# Stop all services
sudo systemctl stop escapeplan-api escapeplan-web

# Remove the package
sudo dpkg -r escapeplan

# Clean up data (CAUTION: This deletes all your data!)
sudo rm -rf /opt/escapeplan
sudo rm -rf /var/lib/escapeplan
sudo rm -rf /etc/escapeplan
sudo userdel -r escapeplan

# Start over from Step 2
sudo dpkg -i escapeplan_*.deb
```

---

## Getting Help

### View System Logs

```bash
# API service logs
sudo journalctl -u escapeplan-api -f

# Web service logs
sudo journalctl -u escapeplan-web -f

# Installation logs
cat /tmp/escapeplan-post-install.log

# System health check
sudo /opt/escapeplan/scripts/health-check.sh
```

### Check System Status

```bash
# Quick status overview
systemctl status escapeplan-api escapeplan-web

# Disk space
df -h /var/lib/escapeplan

# Memory usage
free -h

# CPU temperature (Raspberry Pi)
vcgencmd measure_temp
```

### Useful File Locations

| Path | Purpose |
|------|---------|
| `/opt/escapeplan/` | Application installation directory |
| `/var/lib/escapeplan/escapeplan.db` | SQLite database |
| `/etc/systemd/system/escapeplan-*.service` | Service configuration |
| `/tmp/escapeplan-post-install.log` | Installation log |
| `/etc/escapeplan/` | Configuration files |

---

## Next Steps

Once you're logged in and the system is running:

1. **User Management**
   - Create accounts for staff (Admin > Users)
   - Assign roles: Admin, Manager, or Game Master

2. **Game Configuration**
   - Add your escape room games (Games > Add Game)
   - Set pricing, duration, and difficulty

3. **Room Setup**
   - Define physical rooms or mobile kits
   - Assign games to rooms

4. **Camera Integration** (Optional)
   - Add RTSP cameras for live monitoring
   - Test camera feeds before running sessions

5. **Network Configuration**
   - Set up WiFi access point for customers
   - Configure SSID and password (Admin > Network)

6. **Test a Booking**
   - Create a test booking (Bookings > New Booking)
   - Start a session (Dashboard > Start Session)
   - Test timer controls and hint delivery

---

## Updates

To update to a new version:

```bash
# Download the new .deb package
wget https://github.com/YOUR-ORG/escapeplan/releases/latest/download/escapeplan_X.X.X_arm64.deb

# Stop services
sudo systemctl stop escapeplan-api escapeplan-web

# Install the update
sudo dpkg -i escapeplan_X.X.X_arm64.deb

# Run post-install (to rebuild modules if needed)
sudo /opt/escapeplan/scripts/pi-post-install.sh

# Start services
sudo systemctl start escapeplan-api escapeplan-web
```

**Note:** Updates preserve your database and configuration files.

---

**Installation complete!** You're ready to manage escape room sessions with EscapePlan.
