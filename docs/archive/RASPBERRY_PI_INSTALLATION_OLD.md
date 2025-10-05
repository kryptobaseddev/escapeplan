# EscapePlan Raspberry Pi Installation Guide

**Version:** 0.1.0
**Last Updated:** 2025-10-04
**Platform:** Raspberry Pi 4/5 (ARM64)

## Table of Contents

- [System Requirements](#system-requirements)
- [Pre-Installation Steps](#pre-installation-steps)
- [Installation](#installation)
- [Post-Installation Verification](#post-installation-verification)
- [Accessing the Web UI](#accessing-the-web-ui)
- [Default Credentials](#default-credentials)
- [Manual Installation](#manual-installation)
- [Upgrading from Previous Version](#upgrading-from-previous-version)
- [Uninstallation](#uninstallation)
- [Backup and Restore](#backup-and-restore)
- [Security Hardening](#security-hardening)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

---

## System Requirements

### Hardware Requirements

- **Raspberry Pi Model:** Raspberry Pi 4 or Raspberry Pi 5
- **RAM:** Minimum 4GB (8GB recommended for optimal performance)
- **Storage:** Minimum 16GB microSD card (32GB+ recommended)
- **Network:** Built-in WiFi or Ethernet port

### Software Requirements

- **Operating System:** Raspberry Pi OS (64-bit) - Bookworm or later
- **Architecture:** ARM64 (aarch64)
- **Required Packages:**
  - Node.js >= 20
  - nginx
  - sqlite3
- **Recommended Packages:**
  - build-essential (for native module compilation)
  - python3 (for native module compilation)

### Compatibility Notes

- **32-bit Raspberry Pi OS:** Not supported - must use 64-bit ARM64 version
- **Older Pi Models:** Pi 3 and earlier models are not recommended due to limited RAM
- **Internet Connection:** Not required for operation, but needed for initial package installation

---

## Pre-Installation Steps

### 1. Update System Packages

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 2. Install Required Dependencies

```bash
# Install core dependencies
sudo apt-get install -y nodejs nginx sqlite3

# Verify Node.js version (must be >= 20)
node --version
```

### 3. Install Build Tools (Recommended)

Build tools are needed to compile native modules for ARM64 architecture:

```bash
sudo apt-get install -y build-essential python3
```

**Note:** If build tools are not installed, the package will still install but native modules may not function correctly.

### 4. Verify System Architecture

Confirm you're running 64-bit ARM:

```bash
uname -m
# Expected output: aarch64
```

If the output is `armv7l` or `armhf`, you're running 32-bit OS which is not supported.

---

## Installation

### Option 1: Install from .deb Package (Recommended)

1. **Download the .deb Package**

   Download the latest release from GitHub:
   ```bash
   wget https://github.com/kryptobaseddev/escapeplan-app/releases/download/v0.1.0/escapeplan_0.1.0_arm64.deb
   ```

2. **Install the Package**

   ```bash
   sudo dpkg -i escapeplan_0.1.0_arm64.deb
   ```

   If you encounter dependency errors, run:
   ```bash
   sudo apt-get install -f
   ```

3. **Wait for Post-Installation**

   The installation process will:
   - Create the `escapeplan` system user
   - Set up required directories
   - Deploy application files to `/opt/escapeplan`
   - Install systemd service files
   - Rebuild native modules for ARM64
   - Run health checks

   This process typically takes 3-5 minutes on Raspberry Pi 4.

### Option 2: Install from Local File

If you've built the package locally:

```bash
sudo dpkg -i /path/to/escapeplan_0.1.0_arm64.deb
sudo apt-get install -f
```

---

## Post-Installation Verification

### 1. Check Installation Status

```bash
# Verify package installation
dpkg -l | grep escapeplan

# Check installed files
dpkg -L escapeplan
```

### 2. Verify Directory Structure

```bash
# Application files
ls -la /opt/escapeplan/
# Should show: api/, web/, scripts/

# Data directory
ls -la /var/lib/escapeplan/

# Configuration directory
ls -la /etc/escapeplan/
```

### 3. Configure Environment Variables

The package includes example configuration files:

```bash
# Copy and edit API environment file
sudo cp /etc/escapeplan/api.env.example /etc/escapeplan/api.env
sudo nano /etc/escapeplan/api.env
```

**Important:** Generate secure secrets before starting services:

```bash
# Generate Better Auth secret
openssl rand -base64 32

# Add to /etc/escapeplan/api.env
sudo nano /etc/escapeplan/api.env
```

Update these values in `/etc/escapeplan/api.env`:
```bash
BETTER_AUTH_SECRET=<paste generated secret here>
BETTER_AUTH_URL=http://10.10.10.1:4000  # Update if using different IP
```

### 4. Initialize Database

The database must be initialized before first use:

```bash
# Navigate to API directory
cd /opt/escapeplan/api

# Run database seed script
sudo -u escapeplan node src/db/seed.ts
```

This will create:
- Database schema and tables
- RBAC permissions and roles
- Default admin user account
- System default settings

### 5. Start Services

```bash
# Start the API backend
sudo systemctl start escapeplan-api

# Start the web frontend
sudo systemctl start escapeplan-web

# Enable automatic startup on boot
sudo systemctl enable escapeplan-api
sudo systemctl enable escapeplan-web
```

### 6. Enable Automated Backups (Optional)

```bash
# Enable and start the backup timer
sudo systemctl enable escapeplan-backup.timer
sudo systemctl start escapeplan-backup.timer

# Verify timer is scheduled
sudo systemctl list-timers escapeplan-backup.timer
```

Backups will run daily at 03:00 AM and be stored in `/var/backups/escapeplan/`.

### 7. Verify Services Are Running

```bash
# Check service status
sudo systemctl status escapeplan-api
sudo systemctl status escapeplan-web

# Check service logs
sudo journalctl -u escapeplan-api -n 50
sudo journalctl -u escapeplan-web -n 50

# Test API health endpoint
curl http://localhost:4000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

---

## Accessing the Web UI

### Local Access (on the Raspberry Pi)

Open a web browser on the Pi and navigate to:
```
http://localhost:3000
```

### Network Access (from other devices)

If the Raspberry Pi is configured with a static IP (e.g., `10.10.10.1`):

```
http://10.10.10.1:3000
```

### mDNS Access (if configured)

If Avahi/mDNS is set up:
```
http://escapeplan.local:3000
```

### Nginx Reverse Proxy (Production)

For production deployments, configure nginx to proxy requests:

1. **Create nginx configuration:**

   ```bash
   sudo nano /etc/nginx/sites-available/escapeplan
   ```

   Add the following configuration:
   ```nginx
   server {
       listen 80;
       server_name escapeplan.local 10.10.10.1;

       # Web frontend
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # API backend
       location /api {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # WebSocket support
       location /socket.io {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
       }
   }
   ```

2. **Enable the site:**

   ```bash
   sudo ln -s /etc/nginx/sites-available/escapeplan /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default  # Remove default site
   sudo nginx -t  # Test configuration
   sudo systemctl reload nginx
   ```

3. **Access via nginx:**

   ```
   http://escapeplan.local
   http://10.10.10.1
   ```

---

## Default Credentials

After database initialization, you can log in with the default administrator account:

- **Email:** `admin@escapeplan.local`
- **Password:** `escapeplan`

**IMPORTANT SECURITY WARNING:**

You MUST change the default password immediately after first login!

1. Log in with default credentials
2. Navigate to Account Settings or Profile
3. Change password to a strong, unique password
4. Consider creating additional operator accounts and disabling the default admin

---

## Manual Installation

If the `.deb` package installation fails or you need to manually install:

### 1. Extract Package Contents

```bash
# Create a temporary directory
mkdir /tmp/escapeplan-manual
cd /tmp/escapeplan-manual

# Extract the .deb package
dpkg-deb -x escapeplan_0.1.0_arm64.deb .
```

### 2. Copy Files Manually

```bash
# Copy application files
sudo cp -r opt/escapeplan /opt/

# Copy systemd service files
sudo cp -r etc/systemd/system/escapeplan-*.service /etc/systemd/system/
sudo cp -r etc/systemd/system/escapeplan-*.timer /etc/systemd/system/

# Copy environment templates
sudo mkdir -p /etc/escapeplan
sudo cp etc/escapeplan/*.example /etc/escapeplan/
```

### 3. Create System User

```bash
sudo useradd -r -s /bin/false escapeplan
```

### 4. Create Required Directories

```bash
sudo mkdir -p /var/lib/escapeplan
sudo mkdir -p /var/log/escapeplan
sudo mkdir -p /var/backups/escapeplan

# Set ownership
sudo chown -R escapeplan:escapeplan /opt/escapeplan
sudo chown -R escapeplan:escapeplan /var/lib/escapeplan
sudo chown -R escapeplan:escapeplan /var/log/escapeplan
sudo chown -R escapeplan:escapeplan /var/backups/escapeplan
```

### 5. Rebuild Native Modules

```bash
cd /opt/escapeplan/api
sudo -u escapeplan npm rebuild better-sqlite3
```

### 6. Repair Package Dependencies

```bash
# Run the post-install script
sudo /opt/escapeplan/scripts/pi-post-install.sh /opt/escapeplan
```

### 7. Configure and Start Services

Follow steps from [Post-Installation Verification](#post-installation-verification) section.

---

## Upgrading from Previous Version

### Automated Upgrade (Recommended)

1. **Stop Running Services**

   ```bash
   sudo systemctl stop escapeplan-web
   sudo systemctl stop escapeplan-api
   ```

2. **Backup Database (IMPORTANT)**

   ```bash
   # Manual backup before upgrade
   sudo -u escapeplan /opt/escapeplan/scripts/backup.sh manual

   # Verify backup exists
   ls -lh /var/backups/escapeplan/
   ```

3. **Install New Package**

   ```bash
   sudo dpkg -i escapeplan_0.2.0_arm64.deb
   sudo apt-get install -f
   ```

4. **Verify Services Restarted**

   ```bash
   sudo systemctl status escapeplan-api
   sudo systemctl status escapeplan-web
   ```

### Manual Upgrade

If you need more control over the upgrade process:

1. **Backup everything:**

   ```bash
   sudo /opt/escapeplan/scripts/backup.sh manual
   sudo cp -r /etc/escapeplan /etc/escapeplan.backup
   ```

2. **Remove old package (keep configuration):**

   ```bash
   sudo systemctl stop escapeplan-web escapeplan-api
   sudo dpkg -r --force-depends escapeplan
   ```

3. **Install new package:**

   ```bash
   sudo dpkg -i escapeplan_0.2.0_arm64.deb
   ```

4. **Restore configuration if needed:**

   ```bash
   sudo cp /etc/escapeplan.backup/* /etc/escapeplan/
   ```

5. **Start services:**

   ```bash
   sudo systemctl start escapeplan-api escapeplan-web
   ```

### Downgrading

To downgrade to a previous version:

1. **Backup current state**
2. **Stop services**
3. **Remove current package:** `sudo dpkg -r escapeplan`
4. **Install old package:** `sudo dpkg -i escapeplan_0.1.0_arm64.deb`
5. **Restore database backup if needed**

---

## Uninstallation

### Complete Removal (Delete All Data)

**WARNING:** This will permanently delete all data including database, backups, and configuration!

```bash
# Stop services
sudo systemctl stop escapeplan-web escapeplan-api escapeplan-backup.timer

# Disable services
sudo systemctl disable escapeplan-web escapeplan-api escapeplan-backup.timer

# Remove package
sudo dpkg -r escapeplan

# Remove data directories (CAUTION: This deletes everything!)
sudo rm -rf /opt/escapeplan
sudo rm -rf /var/lib/escapeplan
sudo rm -rf /var/log/escapeplan
sudo rm -rf /var/backups/escapeplan
sudo rm -rf /etc/escapeplan

# Remove system user
sudo userdel escapeplan

# Remove nginx configuration (if created)
sudo rm /etc/nginx/sites-enabled/escapeplan
sudo rm /etc/nginx/sites-available/escapeplan
sudo systemctl reload nginx
```

### Package Removal (Keep Data)

To remove the package but preserve data for reinstallation:

```bash
# Stop services
sudo systemctl stop escapeplan-web escapeplan-api

# Remove package only
sudo dpkg -r escapeplan

# Data remains in:
# /var/lib/escapeplan/escapeplan.db
# /var/backups/escapeplan/
# /etc/escapeplan/
```

---

## Backup and Restore

### Automated Backups

EscapePlan includes a systemd timer for automated daily backups:

```bash
# Enable automated backups
sudo systemctl enable escapeplan-backup.timer
sudo systemctl start escapeplan-backup.timer

# Check backup schedule
sudo systemctl list-timers escapeplan-backup.timer

# View backup logs
sudo journalctl -u escapeplan-backup.service -n 50
```

Backups are stored in `/var/backups/escapeplan/` and include:
- Database file
- Configuration files
- Application logs
- Checksums for integrity verification

### Manual Backup

```bash
# Create manual backup
sudo -u escapeplan /opt/escapeplan/scripts/backup.sh manual

# Backups are saved to /var/backups/escapeplan/
ls -lh /var/backups/escapeplan/
```

### Backup to USB Drive

For external backups:

1. **Mount USB drive:**

   ```bash
   sudo mkdir -p /mnt/escapeplan-backup
   sudo mount /dev/sda1 /mnt/escapeplan-backup
   ```

2. **Copy backups:**

   ```bash
   sudo cp /var/backups/escapeplan/*.tar.gz /mnt/escapeplan-backup/
   ```

3. **Unmount:**

   ```bash
   sudo umount /mnt/escapeplan-backup
   ```

### Restore from Backup

1. **Stop services:**

   ```bash
   sudo systemctl stop escapeplan-web escapeplan-api
   ```

2. **Extract backup:**

   ```bash
   cd /tmp
   sudo tar -xzf /var/backups/escapeplan/auto-2025-10-04-030000.tar.gz
   ```

3. **Restore database:**

   ```bash
   sudo cp /tmp/escapeplan-backup/escapeplan.db /var/lib/escapeplan/
   sudo chown escapeplan:escapeplan /var/lib/escapeplan/escapeplan.db
   ```

4. **Restore configuration (if needed):**

   ```bash
   sudo cp /tmp/escapeplan-backup/api.env /etc/escapeplan/
   sudo chown escapeplan:escapeplan /etc/escapeplan/api.env
   ```

5. **Start services:**

   ```bash
   sudo systemctl start escapeplan-api escapeplan-web
   ```

---

## Security Hardening

### 1. Change Default Credentials

**CRITICAL:** Change the default admin password immediately after installation:

```
Email: admin@escapeplan.local
Default Password: escapeplan
```

### 2. Generate Strong Secrets

Update `/etc/escapeplan/api.env` with cryptographically secure secrets:

```bash
# Generate new secret
openssl rand -base64 32

# Update /etc/escapeplan/api.env
BETTER_AUTH_SECRET=<paste_generated_secret_here>
```

### 3. Restrict File Permissions

```bash
# Ensure configuration files are not world-readable
sudo chmod 600 /etc/escapeplan/api.env
sudo chown escapeplan:escapeplan /etc/escapeplan/api.env

# Restrict data directory
sudo chmod 750 /var/lib/escapeplan
sudo chmod 640 /var/lib/escapeplan/escapeplan.db
```

### 4. Enable Firewall

```bash
# Install ufw if not present
sudo apt-get install -y ufw

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow 22

# Allow HTTP
sudo ufw allow 80

# Allow HTTPS (if using TLS)
sudo ufw allow 443

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 5. Configure HTTPS with SSL/TLS

For production deployments, use HTTPS:

```bash
# Generate self-signed certificate (for testing)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/escapeplan.key \
  -out /etc/ssl/certs/escapeplan.crt

# Update nginx configuration
sudo nano /etc/nginx/sites-available/escapeplan
```

Add SSL configuration:
```nginx
server {
    listen 443 ssl;
    server_name escapeplan.local;

    ssl_certificate /etc/ssl/certs/escapeplan.crt;
    ssl_certificate_key /etc/ssl/private/escapeplan.key;

    # ... rest of configuration
}
```

### 6. Limit User Accounts

- Only create operator accounts for authorized personnel
- Use least-privilege principle (Game Master role for operators who only run games)
- Regularly audit user accounts via Admin panel
- Disable or archive unused accounts

### 7. Enable Audit Logging

System logs are automatically captured by journald:

```bash
# View API audit logs
sudo journalctl -u escapeplan-api -f

# View authentication events
sudo journalctl -u escapeplan-api | grep -i auth

# Check for errors
sudo journalctl -u escapeplan-api -p err
```

### 8. Regular Updates

Keep the system updated:

```bash
# Update Raspberry Pi OS
sudo apt-get update
sudo apt-get upgrade -y

# Update EscapePlan (when new releases are available)
sudo dpkg -i escapeplan_<new_version>_arm64.deb
```

### 9. Network Isolation

For maximum security, run EscapePlan on an isolated network:
- Configure Pi as WiFi access point (see platform automation docs)
- No internet connectivity during operation
- Physical access controls for the Pi

---

## Troubleshooting

### Installation Issues

#### Dependency Errors During Installation

**Problem:** `dpkg: dependency problems prevent configuration`

**Solution:**
```bash
sudo apt-get install -f
```

#### Build Tools Not Available

**Problem:** Native module rebuild fails due to missing build tools

**Solution:**
```bash
sudo apt-get install -y build-essential python3
sudo /opt/escapeplan/scripts/pi-post-install.sh /opt/escapeplan --rebuild-only
```

#### Wrong Architecture

**Problem:** `Package architecture (arm64) does not match system (armhf)`

**Solution:** You're running 32-bit Raspberry Pi OS. You must reinstall with 64-bit version:
1. Download Raspberry Pi OS (64-bit) from raspberrypi.com
2. Flash to SD card using Raspberry Pi Imager
3. Boot and retry installation

### Service Issues

#### Services Won't Start

**Problem:** `systemctl start escapeplan-api` fails

**Diagnosis:**
```bash
# Check service status
sudo systemctl status escapeplan-api

# View detailed logs
sudo journalctl -u escapeplan-api -n 100 --no-pager

# Check for port conflicts
sudo lsof -i :4000
```

**Common Solutions:**

1. **Port already in use:**
   ```bash
   sudo lsof -ti:4000 | xargs sudo kill -9
   sudo systemctl restart escapeplan-api
   ```

2. **Database not initialized:**
   ```bash
   cd /opt/escapeplan/api
   sudo -u escapeplan node src/db/seed.ts
   ```

3. **Missing environment variables:**
   ```bash
   sudo cp /etc/escapeplan/api.env.example /etc/escapeplan/api.env
   sudo nano /etc/escapeplan/api.env
   # Configure required variables
   ```

#### Native Module Errors

**Problem:** `Error: cannot open shared object file: No such file or directory`

**Solution:** Native modules are compiled for wrong architecture:
```bash
cd /opt/escapeplan/api
sudo -u escapeplan npm rebuild better-sqlite3
sudo systemctl restart escapeplan-api
```

#### Permission Errors

**Problem:** `EACCES: permission denied, open '/var/lib/escapeplan/escapeplan.db'`

**Solution:** Fix file ownership:
```bash
sudo chown -R escapeplan:escapeplan /var/lib/escapeplan
sudo chown -R escapeplan:escapeplan /opt/escapeplan
sudo chmod 750 /var/lib/escapeplan
sudo chmod 640 /var/lib/escapeplan/escapeplan.db
sudo systemctl restart escapeplan-api
```

### Database Issues

#### Database Missing or Corrupted

**Problem:** `no such table: users`

**Solution:** Reinitialize database:
```bash
# Backup existing database (if any)
sudo cp /var/lib/escapeplan/escapeplan.db /var/lib/escapeplan/escapeplan.db.backup

# Reinitialize
cd /opt/escapeplan/api
sudo -u escapeplan node src/db/seed.ts

# Restart service
sudo systemctl restart escapeplan-api
```

#### Can't Log In

**Problem:** "Invalid email or password" with default credentials

**Solution:** Reset admin password:
```bash
cd /opt/escapeplan/api

# Use Better Auth CLI to reset password (if available)
# Or recreate admin user via direct database access:
sudo sqlite3 /var/lib/escapeplan/escapeplan.db

# In sqlite shell:
# DELETE FROM user WHERE email='admin@escapeplan.local';
# .quit

# Re-run seed
sudo -u escapeplan node src/db/seed.ts
```

### Network Issues

#### Can't Access Web UI from Other Devices

**Problem:** Web UI accessible on Pi but not from other devices

**Diagnosis:**
```bash
# Check if services are listening on all interfaces
sudo ss -tlnp | grep -E '(3000|4000)'
```

**Solutions:**

1. **Update ORIGIN environment variable:**
   ```bash
   sudo nano /etc/escapeplan/web.env
   # Change: ORIGIN=http://10.10.10.1:3000
   sudo systemctl restart escapeplan-web
   ```

2. **Check firewall rules:**
   ```bash
   sudo ufw status
   # Allow ports if needed:
   sudo ufw allow 3000
   sudo ufw allow 4000
   ```

3. **Verify network connectivity:**
   ```bash
   # From another device, ping the Pi:
   ping 10.10.10.1
   ```

#### WebSocket Connection Fails

**Problem:** Real-time updates not working

**Solution:** Ensure WebSocket support in nginx:
```nginx
location /socket.io {
    proxy_pass http://localhost:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
}
```

### Performance Issues

#### Slow Response Times

**Solutions:**

1. **Check system resources:**
   ```bash
   # CPU and memory usage
   top

   # Disk I/O
   iostat -x 1
   ```

2. **Optimize database:**
   ```bash
   sqlite3 /var/lib/escapeplan/escapeplan.db "VACUUM;"
   sqlite3 /var/lib/escapeplan/escapeplan.db "ANALYZE;"
   ```

3. **Check for runaway processes:**
   ```bash
   sudo systemctl status escapeplan-api
   sudo systemctl status escapeplan-web
   ```

#### High Memory Usage

**Solutions:**

1. **Restart services periodically:**
   ```bash
   sudo systemctl restart escapeplan-api escapeplan-web
   ```

2. **Monitor for memory leaks:**
   ```bash
   # Add to crontab for daily restart at 2 AM:
   0 2 * * * systemctl restart escapeplan-api escapeplan-web
   ```

### Backup Issues

#### Backup Timer Not Running

**Problem:** No backups being created

**Diagnosis:**
```bash
sudo systemctl status escapeplan-backup.timer
sudo systemctl list-timers escapeplan-backup.timer
```

**Solution:**
```bash
sudo systemctl enable escapeplan-backup.timer
sudo systemctl start escapeplan-backup.timer

# Test manual backup
sudo systemctl start escapeplan-backup.service
sudo journalctl -u escapeplan-backup.service -n 20
```

#### Disk Space Full

**Problem:** Backups filling up disk

**Solution:**
```bash
# Check disk usage
df -h

# Remove old backups (keep last 7 days)
sudo find /var/backups/escapeplan -name "auto-*.tar.gz" -mtime +7 -delete

# Configure backup retention in service file
sudo nano /etc/systemd/system/escapeplan-backup.service
# Add/modify: Environment=BACKUP_RETENTION_DAYS=7
```

### Health Check Issues

#### Health Check Fails

**Problem:** `/opt/escapeplan/scripts/health-check.sh` reports errors

**Solution:** Review specific errors reported:

```bash
# Run health check with verbose output
sudo /opt/escapeplan/scripts/health-check.sh

# Address each reported issue:
# - Missing files: Reinstall package
# - Permission errors: Fix with chown/chmod
# - Service not running: Check systemctl status
# - Database issues: Reinitialize database
```

### Getting Logs

For debugging, collect comprehensive logs:

```bash
# Create log bundle
mkdir ~/escapeplan-logs
sudo journalctl -u escapeplan-api -n 500 > ~/escapeplan-logs/api.log
sudo journalctl -u escapeplan-web -n 500 > ~/escapeplan-logs/web.log
sudo journalctl -u escapeplan-backup.service -n 100 > ~/escapeplan-logs/backup.log
sudo /opt/escapeplan/scripts/health-check.sh > ~/escapeplan-logs/health-check.log 2>&1
sudo cp /tmp/escapeplan-post-install.log ~/escapeplan-logs/ 2>/dev/null || true

# Create tarball
cd ~
tar -czf escapeplan-logs-$(date +%Y%m%d).tar.gz escapeplan-logs/
```

---

## Support

### Documentation

- **Main README:** `/opt/escapeplan/README.md`
- **API Documentation:** See `CLAUDE.md` in project repository
- **Systemd Backup Guide:** `/opt/escapeplan/scripts/systemd/README.md`
- **Known Issues:** See `DEB-PACKAGE-FIXES.md` in project repository

### Health Check Script

Run comprehensive validation:

```bash
sudo /opt/escapeplan/scripts/health-check.sh
```

This will check:
- Package installation status
- Directory structure and permissions
- Native module architecture
- Systemd service status
- Database integrity
- Configuration files
- Network connectivity

### Log Files

- **Installation log:** `/tmp/escapeplan-post-install.log`
- **API logs:** `sudo journalctl -u escapeplan-api`
- **Web logs:** `sudo journalctl -u escapeplan-web`
- **Backup logs:** `sudo journalctl -u escapeplan-backup.service`
- **Application logs:** `/var/log/escapeplan/`

### Community Support

- **GitHub Issues:** https://github.com/kryptobaseddev/escapeplan-app/issues
- **Discussions:** https://github.com/kryptobaseddev/escapeplan-app/discussions

### Reporting Issues

When reporting issues, please include:

1. **System information:**
   ```bash
   uname -a
   cat /etc/os-release
   ```

2. **Package version:**
   ```bash
   dpkg -l | grep escapeplan
   ```

3. **Service status:**
   ```bash
   sudo systemctl status escapeplan-api escapeplan-web
   ```

4. **Recent logs:**
   ```bash
   sudo journalctl -u escapeplan-api -n 100 --no-pager
   ```

5. **Health check output:**
   ```bash
   sudo /opt/escapeplan/scripts/health-check.sh
   ```

---

## Quick Reference

### Common Commands

```bash
# Service Management
sudo systemctl start escapeplan-api
sudo systemctl stop escapeplan-api
sudo systemctl restart escapeplan-api
sudo systemctl status escapeplan-api

# View Logs
sudo journalctl -u escapeplan-api -f        # Follow API logs
sudo journalctl -u escapeplan-web -f         # Follow web logs
sudo journalctl -u escapeplan-api -n 100     # Last 100 API log lines

# Database Management
cd /opt/escapeplan/api
sudo -u escapeplan node src/db/seed.ts       # Initialize database
sudo sqlite3 /var/lib/escapeplan/escapeplan.db  # Open database

# Backup Management
sudo systemctl start escapeplan-backup.service     # Manual backup
sudo systemctl list-timers escapeplan-backup.timer # Check schedule
ls -lh /var/backups/escapeplan/                    # List backups

# Health Checks
sudo /opt/escapeplan/scripts/health-check.sh       # Run diagnostics
curl http://localhost:4000/api/health              # API health check

# Native Module Rebuild
cd /opt/escapeplan/api
sudo -u escapeplan npm rebuild better-sqlite3
```

### Important File Locations

```
/opt/escapeplan/              # Application installation directory
/opt/escapeplan/api/          # API backend
/opt/escapeplan/web/          # Web frontend
/opt/escapeplan/scripts/      # Utility scripts

/etc/escapeplan/              # Configuration files
/etc/escapeplan/api.env       # API environment variables
/etc/escapeplan/web.env       # Web environment variables

/var/lib/escapeplan/          # Data directory
/var/lib/escapeplan/escapeplan.db  # SQLite database

/var/log/escapeplan/          # Application logs
/var/backups/escapeplan/      # Backup storage

/etc/systemd/system/escapeplan-*.service  # Systemd service files
/etc/systemd/system/escapeplan-*.timer    # Systemd timer files
```

### Default Ports

- **API:** 4000
- **Web:** 3000
- **nginx (if configured):** 80/443

---

**End of Installation Guide**

For additional help, see the main project documentation or open an issue on GitHub.
