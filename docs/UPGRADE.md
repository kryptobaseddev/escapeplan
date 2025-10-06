# EscapePlan Upgrade Guide

How to upgrade your EscapePlan installation to the latest version.

---

## Table of Contents

1. [Before You Upgrade](#before-you-upgrade)
2. [Upgrade Types](#upgrade-types)
3. [Application Upgrade](#application-upgrade)
4. [Base OS Upgrade](#base-os-upgrade)
5. [Rollback Procedure](#rollback-procedure)
6. [Troubleshooting Upgrades](#troubleshooting-upgrades)

---

## Before You Upgrade

### Pre-Upgrade Checklist

- [ ] **Read Release Notes**: Check [CHANGELOG.md](../CHANGELOG.md) for breaking changes
- [ ] **Backup Database**: Critical - always backup before upgrading
- [ ] **Check Disk Space**: Ensure at least 1GB free
- [ ] **Note Current Version**: Record in case rollback needed
- [ ] **Schedule Downtime**: Notify users if applicable
- [ ] **Test in Staging**: If you have a test environment

### Backup Your System

**Database Backup** (Required)
```bash
# Automatic backup script
sudo /opt/escapeplan/scripts/backup.sh

# Manual backup
sudo -u postgres pg_dump escapeplan > ~/escapeplan-backup-$(date +%Y%m%d).sql

# Verify backup
ls -lh ~/escapeplan-backup-*.sql
```

**Configuration Backup** (Recommended)
```bash
# Backup configuration files
sudo tar -czf ~/escapeplan-config-backup-$(date +%Y%m%d).tar.gz \
  /opt/escapeplan/api/.env \
  /etc/nginx/sites-available/escapeplan \
  /etc/NetworkManager/system-connections/
```

**Full System Backup** (Optional but Recommended)
```bash
# Backup entire escapeplan directory
sudo tar -czf ~/escapeplan-full-backup-$(date +%Y%m%d).tar.gz /opt/escapeplan/

# Or create microSD image backup using another computer
```

---

## Upgrade Types

EscapePlan has two components that can be upgraded:

### Application Upgrade (Common)
- **What**: API and Web application
- **When**: New features, bug fixes, security patches
- **Downtime**: 2-5 minutes
- **Method**: Install new `.deb` package
- **Risk**: Low (database migrations are tested)

### Base OS Upgrade (Rare)
- **What**: Entire Raspberry Pi OS image
- **When**: Major OS updates, system-level changes
- **Downtime**: 30-60 minutes (re-flash required)
- **Method**: Flash new `.img` file
- **Risk**: Medium (requires data migration)

---

## Application Upgrade

Use this for most updates (new versions of EscapePlan app).

### Step 1: Check Current Version

```bash
# Check installed version
dpkg -l | grep escapeplan-app

# Or via web interface
# Go to Settings > About
```

### Step 2: Download New Version

**Online Method**:
```bash
cd ~
wget https://github.com/kryptobaseddev/escapeplan/releases/download/vX.Y.Z/escapeplan-app-vX.Y.Z.deb
wget https://github.com/kryptobaseddev/escapeplan/releases/download/vX.Y.Z/escapeplan-app-vX.Y.Z.deb.sha256

# Verify checksum
sha256sum -c escapeplan-app-vX.Y.Z.deb.sha256
```

**Offline Method**:
```bash
# Copy .deb file to USB drive
# Insert USB into Raspberry Pi
# Copy file
cp /media/escapeplan/*/escapeplan-app-vX.Y.Z.deb ~/
```

### Step 3: Backup Database

```bash
# CRITICAL: Always backup before upgrading
sudo /opt/escapeplan/scripts/backup.sh

# Verify backup exists
ls -lh /var/backups/escapeplan/
```

### Step 4: Stop Services

```bash
# Stop application services
sudo systemctl stop escapeplan-api
sudo systemctl stop escapeplan-web

# Leave nginx and postgresql running
```

### Step 5: Install Upgrade

```bash
# Install new version
sudo dpkg -i ~/escapeplan-app-vX.Y.Z.deb

# If there are dependency issues
sudo apt --fix-broken install
```

### Step 6: Run Database Migrations

```bash
# Migrations usually run automatically during package install
# Check migration status
cd /opt/escapeplan/api
sudo -u escapeplan npm run db:migrate

# View migration logs
sudo tail -f /opt/escapeplan/logs/migrations.log
```

### Step 7: Start Services

```bash
# Start services
sudo systemctl start escapeplan-api
sudo systemctl start escapeplan-web

# Check status
sudo systemctl status escapeplan-api
sudo systemctl status escapeplan-web
```

### Step 8: Verify Upgrade

```bash
# Check version
dpkg -l | grep escapeplan-app

# Test API
curl -k https://localhost/api/health

# Check logs for errors
sudo journalctl -u escapeplan-api -n 50
sudo tail -f /opt/escapeplan/logs/api.log
```

### Step 9: Test Web Interface

1. Open browser to `https://10.10.10.1`
2. Login with your credentials
3. Verify all features work
4. Check dashboard, bookings, games
5. Test critical workflows

### Step 10: Monitor for Issues

```bash
# Monitor logs for 10-15 minutes
sudo journalctl -u escapeplan-api -f

# Check for errors
sudo grep -i error /opt/escapeplan/logs/api.log
```

---

## Base OS Upgrade

Use this for major system updates (requires re-flashing).

### Step 1: Full Backup

**Database Backup**:
```bash
# Export database
sudo -u postgres pg_dump escapeplan > ~/escapeplan-db-export-$(date +%Y%m%d).sql

# Copy to USB or another computer
```

**Media Backup**:
```bash
# Backup uploads (images, documents)
sudo tar -czf ~/escapeplan-uploads-$(date +%Y%m%d).tar.gz /opt/escapeplan/uploads/

# Backup camera recordings (if applicable)
sudo tar -czf ~/escapeplan-recordings-$(date +%Y%m%d).tar.gz /opt/escapeplan/recordings/
```

**Configuration Backup**:
```bash
# Export configuration
sudo cp /opt/escapeplan/api/.env ~/escapeplan-env-backup
sudo cp /etc/nginx/sites-available/escapeplan ~/nginx-config-backup

# Save WiFi password and settings
sudo nmcli connection show EscapePlan-AP | grep -i psk
```

**Copy Backups Off Device**:
```bash
# Copy to USB drive
cp ~/*backup* /media/escapeplan/USB_DRIVE/

# Or SCP to another computer
scp ~/*backup* user@computer:/backup/location/
```

### Step 2: Download New Base OS Image

```bash
# On another computer
wget https://github.com/kryptobaseddev/escapeplan/releases/download/vX.Y.Z/escapeplan-base-vX.Y.Z.img.xz
wget https://github.com/kryptobaseddev/escapeplan/releases/download/vX.Y.Z/escapeplan-base-vX.Y.Z.img.xz.sha256

# Verify checksum
sha256sum -c escapeplan-base-vX.Y.Z.img.xz.sha256
```

### Step 3: Flash New Image

```bash
# Power off Raspberry Pi
# Remove microSD card
# Flash new image using Raspberry Pi Imager or dd
xzcat escapeplan-base-vX.Y.Z.img.xz | sudo dd of=/dev/sdX bs=4M status=progress oflag=sync
```

### Step 4: First Boot

1. Insert microSD card into Raspberry Pi
2. Power on
3. Wait 3-5 minutes for first boot
4. Connect to `EscapePlan` WiFi (default password)

### Step 5: Restore Database

```bash
# Copy backup to new system
scp ~/escapeplan-db-export-*.sql escapeplan@10.10.10.1:~/

# SSH to device
ssh escapeplan@10.10.10.1

# Stop services
sudo systemctl stop escapeplan-api

# Restore database
sudo -u postgres psql escapeplan < ~/escapeplan-db-export-*.sql

# Start services
sudo systemctl start escapeplan-api
```

### Step 6: Restore Media

```bash
# Restore uploads
sudo tar -xzf ~/escapeplan-uploads-*.tar.gz -C /

# Restore recordings (if applicable)
sudo tar -xzf ~/escapeplan-recordings-*.tar.gz -C /

# Fix permissions
sudo chown -R escapeplan:escapeplan /opt/escapeplan/uploads/
sudo chown -R escapeplan:escapeplan /opt/escapeplan/recordings/
```

### Step 7: Restore Configuration

```bash
# Restore environment variables
sudo cp ~/escapeplan-env-backup /opt/escapeplan/api/.env
sudo chown escapeplan:escapeplan /opt/escapeplan/api/.env

# Restart services
sudo systemctl restart escapeplan-api escapeplan-web
```

### Step 8: Reconfigure Network (If Needed)

```bash
# Change WiFi password to your custom one
sudo nmcli connection modify EscapePlan-AP wifi-sec.psk "YourPassword"
sudo nmcli connection down EscapePlan-AP
sudo nmcli connection up EscapePlan-AP
```

### Step 9: Verify System

1. Test web interface
2. Login and verify data
3. Check all bookings and games
4. Test camera feeds
5. Run test booking/session

---

## Rollback Procedure

If upgrade fails, rollback to previous version.

### Rollback Application Upgrade

```bash
# Stop services
sudo systemctl stop escapeplan-api escapeplan-web

# Restore database backup
sudo -u postgres dropdb escapeplan
sudo -u postgres createdb escapeplan
sudo -u postgres psql escapeplan < /var/backups/escapeplan/backup-YYYYMMDD.sql

# Reinstall old version (if you kept the .deb)
sudo dpkg -i ~/escapeplan-app-vOLD.deb

# Or downgrade via apt (if available)
sudo apt install escapeplan-app=OLD_VERSION

# Start services
sudo systemctl start escapeplan-api escapeplan-web

# Verify
curl -k https://localhost/api/health
```

### Rollback Base OS Upgrade

```bash
# Re-flash old base OS image
# Follow same process as base OS upgrade
# Use old image file
# Restore database from backup
```

---

## Troubleshooting Upgrades

### Upgrade Package Won't Install

**Symptoms**: `dpkg -i` fails with errors.

**Solutions**:
```bash
# Check dependencies
sudo apt update
sudo apt --fix-broken install

# Force reinstall
sudo dpkg -i --force-overwrite escapeplan-app-vX.Y.Z.deb

# Check available disk space
df -h
```

### Database Migration Fails

**Symptoms**: Errors during migration, services won't start.

**Solutions**:
```bash
# Check migration logs
sudo tail -f /opt/escapeplan/logs/migrations.log

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Rollback to backup
sudo systemctl stop escapeplan-api
sudo -u postgres dropdb escapeplan
sudo -u postgres createdb escapeplan
sudo -u postgres psql escapeplan < /var/backups/escapeplan/backup-YYYYMMDD.sql
```

### Services Won't Start After Upgrade

**Symptoms**: API or web service fails to start.

**Solutions**:
```bash
# Check service status
sudo systemctl status escapeplan-api
sudo journalctl -u escapeplan-api -n 100

# Verify configuration
cat /opt/escapeplan/api/.env

# Check file permissions
sudo chown -R escapeplan:escapeplan /opt/escapeplan/

# Restart all services
sudo systemctl restart escapeplan-api escapeplan-web nginx postgresql
```

### Web Interface Shows Old Version

**Symptoms**: Version number doesn't change, old UI appears.

**Solutions**:
```bash
# Clear browser cache
# Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)

# Clear service worker
# Chrome DevTools: Application → Service Workers → Unregister

# Verify web files updated
ls -la /opt/escapeplan/web/

# Restart nginx
sudo systemctl restart nginx
```

### Data Loss After Upgrade

**Symptoms**: Bookings, games, or settings missing.

**Solutions**:
```bash
# Restore from backup immediately
sudo systemctl stop escapeplan-api

sudo -u postgres dropdb escapeplan
sudo -u postgres createdb escapeplan
sudo -u postgres psql escapeplan < /var/backups/escapeplan/backup-YYYYMMDD.sql

sudo systemctl start escapeplan-api

# If recent backup not available, check automatic backups
ls -lh /var/backups/escapeplan/
```

---

## Upgrade Best Practices

### Before Every Upgrade
1. Read release notes for breaking changes
2. Backup database (automated script)
3. Test in staging if available
4. Schedule during low-traffic period
5. Notify users of downtime

### During Upgrade
1. Follow steps in order
2. Don't skip database backup
3. Monitor logs for errors
4. Don't interrupt migrations
5. Keep old .deb file for rollback

### After Upgrade
1. Verify all services running
2. Test critical workflows
3. Monitor logs for 24 hours
4. Keep backup for 1 week
5. Document any issues

### Maintenance Schedule

**Minor Updates** (vX.Y.Z where Z changes):
- Apply monthly or as needed
- Low risk, mainly bug fixes
- Minimal testing required

**Feature Updates** (vX.Y.0 where Y changes):
- Review carefully before applying
- May include new features
- Test thoroughly in staging

**Major Updates** (vX.0.0 where X changes):
- Plan carefully, may have breaking changes
- Full backup and testing required
- Schedule extended maintenance window

---

## Automated Upgrades

### Enable Unattended Upgrades (Security Only)

```bash
# Install unattended-upgrades
sudo apt install unattended-upgrades

# Configure for security updates only
sudo dpkg-reconfigure unattended-upgrades

# Edit configuration
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades

# Enable automatic reboot if needed (optional)
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
```

**Warning**: Automatic upgrades for EscapePlan application not recommended. Always backup and test manually.

---

## Version Support

- **Current Version**: Full support, regular updates
- **Previous Minor Version**: Security updates only
- **Older Versions**: Unsupported, upgrade recommended

Check [Releases Page](https://github.com/kryptobaseddev/escapeplan/releases) for current supported versions.

---

## Getting Help

### Upgrade Issues

If you encounter problems during upgrade:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Search [GitHub Issues](https://github.com/kryptobaseddev/escapeplan/issues)
3. Post in [GitHub Discussions](https://github.com/kryptobaseddev/escapeplan/discussions)
4. Include:
   - Current version
   - Target version
   - Error messages
   - Upgrade steps attempted

### Additional Documentation

- [Installation Guide](INSTALLATION.md)
- [Quick Start](QUICKSTART.md)
- [Security Guide](SECURITY.md)
- [Troubleshooting](TROUBLESHOOTING.md)

---

**Always Backup Before Upgrading!**
