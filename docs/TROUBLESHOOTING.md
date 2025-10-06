# EscapePlan Troubleshooting Guide

Common issues and solutions for EscapePlan escape room management system.

---

## Table of Contents

1. [Initial Setup Issues](#initial-setup-issues)
2. [Network and Connectivity](#network-and-connectivity)
3. [Web Interface Problems](#web-interface-problems)
4. [Application Issues](#application-issues)
5. [Database Problems](#database-problems)
6. [Camera Feed Issues](#camera-feed-issues)
7. [Performance Issues](#performance-issues)
8. [Backup and Recovery](#backup-and-recovery)
9. [System Administration](#system-administration)
10. [Getting More Help](#getting-more-help)

---

## Initial Setup Issues

### WiFi Access Point Not Appearing

**Symptoms**: After powering on Raspberry Pi, the `EscapePlan` WiFi network doesn't appear.

**Solutions**:

1. **Wait Longer** (Most Common)
   - First boot takes 3-5 minutes
   - Services need time to start
   - Wait up to 10 minutes before troubleshooting

2. **Check Power Supply**
   - Ensure using official Raspberry Pi PSU or 5V/3A equivalent
   - Insufficient power causes instability
   - Look for rainbow square icon (under-voltage warning)

3. **Verify LED Activity**
   - Red LED: Power (should be solid)
   - Green LED: Disk activity (should blink)
   - No LEDs: Check power supply and connections

4. **Try Ethernet Connection**
   ```bash
   # Connect Ethernet cable to router
   # Find IP from router DHCP table
   # SSH to device
   ssh escapeplan@<ip-address>
   # Password: escapeplan

   # Check NetworkManager status
   sudo systemctl status NetworkManager
   sudo nmcli connection show
   ```

5. **Restart Access Point**
   ```bash
   sudo nmcli connection down EscapePlan-AP
   sudo nmcli connection up EscapePlan-AP
   ```

6. **Check WiFi Hardware**
   ```bash
   # Verify WiFi interface exists
   ip link show wlan0

   # Check rfkill
   sudo rfkill list
   # If blocked, unblock:
   sudo rfkill unblock wifi
   ```

7. **Rebuild Access Point** (Last Resort)
   ```bash
   sudo nmcli connection delete EscapePlan-AP
   sudo /opt/escapeplan/scripts/setup-ap.sh
   ```

### microSD Card Won't Flash

**Symptoms**: Image flashing fails or verification errors.

**Solutions**:

1. **Verify Download**
   ```bash
   sha256sum -c escapeplan-base-vX.Y.Z.img.xz.sha256
   ```

2. **Try Different Tool**
   - Raspberry Pi Imager (recommended)
   - Balena Etcher
   - `dd` command (Linux/macOS)

3. **Check microSD Card**
   - Try different card
   - Verify card is not write-protected
   - Use Class 10 or better
   - Ensure sufficient capacity (16GB+)

4. **Format Before Flashing**
   ```bash
   # Linux
   sudo fdisk /dev/sdX  # Replace X
   # Delete all partitions (d), write (w)

   # Then flash image
   ```

### First Boot Fails

**Symptoms**: Raspberry Pi won't boot or shows errors on screen.

**Solutions**:

1. **Check Image Integrity**
   - Re-verify checksum
   - Re-flash if corrupted

2. **Verify microSD Card**
   - Test with different card
   - Check for physical damage
   - Ensure proper seating in slot

3. **Connect Monitor and Keyboard**
   - Watch boot process
   - Look for error messages
   - Note where boot stops

4. **Check Boot Partition**
   ```bash
   # Mount boot partition on another computer
   ls -la /media/boot/
   # Verify cmdline.txt and config.txt exist
   ```

---

## Network and Connectivity

### Cannot Connect to EscapePlan WiFi

**Symptoms**: Can see network but cannot connect.

**Solutions**:

1. **Verify Password**
   - Default: `escapeplan2024`
   - Case-sensitive
   - No spaces

2. **Forget and Reconnect**
   - Remove saved network from device
   - Scan and connect fresh

3. **Check WiFi Band**
   - Raspberry Pi 4B: 2.4GHz and 5GHz
   - Raspberry Pi 3B+: 2.4GHz only
   - Try different band if available

4. **Verify DHCP**
   ```bash
   ssh escapeplan@10.10.10.1  # If you can connect
   sudo systemctl status dnsmasq
   ```

5. **Check Connection Limits**
   - Default: 10 clients max
   - Disconnect unused devices

### Lost Connection to Web Interface

**Symptoms**: Was working, now can't connect.

**Solutions**:

1. **Check WiFi Connection**
   - Verify still connected to `EscapePlan` network
   - Look for IP address: should be `10.10.10.x`

2. **Ping Gateway**
   ```bash
   ping 10.10.10.1
   # Should receive replies
   ```

3. **Restart Raspberry Pi**
   ```bash
   ssh escapeplan@10.10.10.1
   sudo reboot
   ```

4. **Check Services**
   ```bash
   sudo systemctl status nginx
   sudo systemctl status escapeplan-api
   ```

### Slow Network Performance

**Symptoms**: Web interface loads slowly or times out.

**Solutions**:

1. **Reduce WiFi Distance**
   - Move closer to Raspberry Pi
   - Remove physical obstacles
   - Check for interference

2. **Check WiFi Channel**
   ```bash
   # Scan for congested channels
   sudo nmcli device wifi list

   # Change channel if needed
   sudo nmcli connection modify EscapePlan-AP wifi.channel 6
   sudo nmcli connection down EscapePlan-AP
   sudo nmcli connection up EscapePlan-AP
   ```

3. **Reduce Connected Devices**
   - Disconnect unused clients
   - Limit camera streams

4. **Check System Load**
   ```bash
   top
   # Look for high CPU/memory usage
   ```

---

## Web Interface Problems

### Certificate Warning Appears Every Time

**Symptoms**: Browser shows security warning on every visit.

**Solutions**:

1. **Accept Certificate Permanently**
   - Click "Advanced" → "Accept Risk and Continue"
   - Browser should remember (except incognito)

2. **Install Certificate** (Advanced)
   ```bash
   # Export certificate
   ssh escapeplan@10.10.10.1
   sudo cp /etc/ssl/certs/escapeplan.crt ~/
   # Copy to client device and install in system trust store
   ```

3. **Use Custom TLS Certificate**
   - See [SECURITY.md](SECURITY.md) for custom cert setup

### Page Won't Load

**Symptoms**: Blank page, timeout, or connection refused.

**Solutions**:

1. **Check URL**
   - Correct: `https://10.10.10.1`
   - Not: `http://10.10.10.1` (will redirect)

2. **Clear Browser Cache**
   - Chrome: Ctrl+Shift+Delete
   - Firefox: Ctrl+Shift+Delete
   - Safari: Cmd+Option+E

3. **Try Incognito/Private Mode**
   - Rules out extension conflicts
   - Bypasses cache issues

4. **Check nginx Status**
   ```bash
   sudo systemctl status nginx
   sudo nginx -t  # Test configuration
   ```

5. **View nginx Logs**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

### Login Fails

**Symptoms**: "Invalid credentials" or authentication errors.

**Solutions**:

1. **Verify Credentials**
   - Check username (case-sensitive)
   - Verify password
   - Try password manager if used

2. **Check API Status**
   ```bash
   sudo systemctl status escapeplan-api
   sudo journalctl -u escapeplan-api -n 50
   ```

3. **Verify Database Connection**
   ```bash
   sudo -u postgres psql escapeplan -c "SELECT username FROM users;"
   ```

4. **Reset Password**
   ```bash
   sudo /opt/escapeplan/scripts/reset-password.sh username
   ```

### UI Not Updating

**Symptoms**: Changes don't appear, data is stale.

**Solutions**:

1. **Hard Refresh Browser**
   - Chrome/Firefox: Ctrl+Shift+R
   - Safari: Cmd+Shift+R

2. **Clear Service Worker**
   - Chrome DevTools: Application → Service Workers → Unregister
   - Then refresh page

3. **Check API Connectivity**
   - Open browser console (F12)
   - Look for API errors
   - Check Network tab for failed requests

4. **Restart API Service**
   ```bash
   sudo systemctl restart escapeplan-api
   ```

---

## Application Issues

### API Service Won't Start

**Symptoms**: `sudo systemctl status escapeplan-api` shows failed.

**Solutions**:

1. **Check Logs**
   ```bash
   sudo journalctl -u escapeplan-api -n 100
   sudo tail -f /opt/escapeplan/logs/api.log
   ```

2. **Verify Configuration**
   ```bash
   cat /opt/escapeplan/api/.env
   # Check DATABASE_URL, JWT_SECRET, etc.
   ```

3. **Test Database Connection**
   ```bash
   sudo -u postgres psql escapeplan -c "SELECT 1;"
   ```

4. **Check Port Conflicts**
   ```bash
   sudo lsof -i :3000
   # Port 3000 should be free or used by escapeplan-api only
   ```

5. **Reinstall Application**
   ```bash
   sudo apt reinstall escapeplan-app
   ```

### Database Migrations Failed

**Symptoms**: Error messages about database schema.

**Solutions**:

1. **Check Migration Status**
   ```bash
   sudo -u escapeplan /opt/escapeplan/api/node_modules/.bin/drizzle-kit status
   ```

2. **Run Migrations Manually**
   ```bash
   cd /opt/escapeplan/api
   sudo -u escapeplan npm run db:migrate
   ```

3. **View Migration Logs**
   ```bash
   sudo tail -f /opt/escapeplan/logs/migrations.log
   ```

4. **Restore from Backup** (If Broken)
   ```bash
   # Stop API
   sudo systemctl stop escapeplan-api

   # Restore database
   sudo -u postgres psql escapeplan < /var/backups/escapeplan/backup-YYYYMMDD.sql

   # Restart API
   sudo systemctl start escapeplan-api
   ```

### File Upload Fails

**Symptoms**: Cannot upload images or documents.

**Solutions**:

1. **Check File Size**
   - Default limit: 10MB
   - Reduce image size if needed

2. **Verify Permissions**
   ```bash
   ls -la /opt/escapeplan/uploads/
   # Should be owned by escapeplan:escapeplan
   sudo chown -R escapeplan:escapeplan /opt/escapeplan/uploads/
   sudo chmod -R 755 /opt/escapeplan/uploads/
   ```

3. **Check Disk Space**
   ```bash
   df -h
   # Ensure sufficient space on /opt
   ```

4. **View Upload Errors**
   ```bash
   sudo tail -f /opt/escapeplan/logs/api.log | grep -i upload
   ```

---

## Database Problems

### Cannot Connect to Database

**Symptoms**: API can't reach PostgreSQL.

**Solutions**:

1. **Check PostgreSQL Status**
   ```bash
   sudo systemctl status postgresql
   ```

2. **Start PostgreSQL**
   ```bash
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

3. **Verify Database Exists**
   ```bash
   sudo -u postgres psql -l | grep escapeplan
   ```

4. **Test Connection**
   ```bash
   sudo -u postgres psql escapeplan -c "SELECT NOW();"
   ```

5. **Check pg_hba.conf**
   ```bash
   sudo cat /etc/postgresql/15/main/pg_hba.conf
   # Should have: local all escapeplan peer
   ```

### Database Performance Issues

**Symptoms**: Slow queries, timeouts.

**Solutions**:

1. **Vacuum Database**
   ```bash
   sudo -u postgres vacuumdb escapeplan --analyze
   ```

2. **Check Connections**
   ```bash
   sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
   ```

3. **View Slow Queries**
   ```bash
   sudo -u postgres psql escapeplan -c "SELECT query, state, query_start FROM pg_stat_activity WHERE state != 'idle';"
   ```

4. **Restart PostgreSQL**
   ```bash
   sudo systemctl restart postgresql
   ```

---

## Camera Feed Issues

### Camera Not Showing

**Symptoms**: Camera feed shows "Offline" or doesn't load.

**Solutions**:

1. **Test Camera URL**
   ```bash
   # For RTSP
   ffprobe rtsp://camera-ip:554/stream

   # For MJPEG
   curl -I http://camera-ip/mjpeg
   ```

2. **Check Network Access**
   ```bash
   ping camera-ip
   # Camera must be on same network or accessible
   ```

3. **Verify Camera Credentials**
   - Username and password correct
   - URL format: `rtsp://user:pass@camera-ip:554/stream`

4. **Check Firewall**
   ```bash
   sudo iptables -L -n
   # Ensure RTSP (554) and HTTP (80) allowed
   ```

5. **Test from Browser**
   - Navigate to camera's web interface
   - Verify stream is working there

### Camera Feed Stuttering

**Symptoms**: Video feed lags or freezes.

**Solutions**:

1. **Reduce Stream Quality**
   - Lower resolution in camera settings
   - Reduce bitrate/fps

2. **Check Network Bandwidth**
   ```bash
   # Monitor network usage
   sudo iftop
   ```

3. **Limit Concurrent Streams**
   - Close unused camera views
   - Reduce number of simultaneous viewers

4. **Use Wired Connection**
   - Connect camera via Ethernet
   - More reliable than WiFi

---

## Performance Issues

### High CPU Usage

**Symptoms**: System slow, high temperature.

**Solutions**:

1. **Check Running Processes**
   ```bash
   top
   # Press 'P' to sort by CPU
   ```

2. **Restart Services**
   ```bash
   sudo systemctl restart escapeplan-api
   sudo systemctl restart escapeplan-web
   ```

3. **Disable Camera Streams**
   - Temporarily disable cameras
   - Check if CPU usage drops

4. **Add Cooling**
   - Install heatsink
   - Add fan
   - Improve airflow

### Low Memory

**Symptoms**: Out of memory errors, crashes.

**Solutions**:

1. **Check Memory Usage**
   ```bash
   free -h
   htop
   ```

2. **Restart Services**
   ```bash
   sudo systemctl restart escapeplan-api nginx postgresql
   ```

3. **Increase Swap** (If <4GB RAM)
   ```bash
   sudo dphys-swapfile swapoff
   sudo nano /etc/dphys-swapfile
   # Set CONF_SWAPSIZE=1024
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

4. **Upgrade Hardware**
   - Consider Raspberry Pi 4B 8GB
   - Or Raspberry Pi 5

### Disk Space Full

**Symptoms**: Cannot save data, application errors.

**Solutions**:

1. **Check Disk Usage**
   ```bash
   df -h
   du -sh /opt/escapeplan/* | sort -h
   ```

2. **Clean Old Logs**
   ```bash
   sudo journalctl --vacuum-time=7d
   sudo find /opt/escapeplan/logs -name "*.log" -mtime +30 -delete
   ```

3. **Archive Old Backups**
   ```bash
   # Move to external storage
   sudo mv /var/backups/escapeplan/*.sql /media/external/
   ```

4. **Delete Old Camera Recordings**
   ```bash
   sudo find /opt/escapeplan/recordings -mtime +30 -delete
   ```

5. **Use External Storage**
   ```bash
   # Mount USB drive
   sudo mkdir /media/external
   sudo mount /dev/sda1 /media/external

   # Move uploads
   sudo mv /opt/escapeplan/uploads /media/external/
   sudo ln -s /media/external/uploads /opt/escapeplan/uploads
   ```

---

## Backup and Recovery

### Backup Fails

**Symptoms**: Backup script errors.

**Solutions**:

1. **Check Disk Space**
   ```bash
   df -h /var/backups
   ```

2. **Run Manual Backup**
   ```bash
   sudo /opt/escapeplan/scripts/backup.sh
   ```

3. **Check Permissions**
   ```bash
   ls -la /var/backups/escapeplan/
   sudo chmod 755 /var/backups/escapeplan
   ```

4. **View Backup Logs**
   ```bash
   sudo journalctl -u escapeplan-backup -n 50
   ```

### Restore from Backup

**Symptoms**: Need to recover data.

**Solutions**:

1. **List Available Backups**
   ```bash
   ls -lh /var/backups/escapeplan/
   ```

2. **Stop Services**
   ```bash
   sudo systemctl stop escapeplan-api escapeplan-web
   ```

3. **Restore Database**
   ```bash
   # Drop existing database
   sudo -u postgres dropdb escapeplan

   # Create new database
   sudo -u postgres createdb escapeplan

   # Restore from backup
   sudo -u postgres psql escapeplan < /var/backups/escapeplan/backup-YYYYMMDD.sql
   ```

4. **Restart Services**
   ```bash
   sudo systemctl start escapeplan-api escapeplan-web
   ```

5. **Verify Restoration**
   ```bash
   sudo -u postgres psql escapeplan -c "SELECT count(*) FROM users;"
   ```

---

## System Administration

### SSH Connection Refused

**Symptoms**: Cannot SSH to device.

**Solutions**:

1. **Verify SSH Service**
   ```bash
   # From console or via serial
   sudo systemctl status ssh
   sudo systemctl start ssh
   ```

2. **Check Firewall**
   ```bash
   sudo iptables -L INPUT -n | grep 22
   ```

3. **Verify IP Address**
   ```bash
   ip addr show
   # Use correct IP for SSH
   ```

4. **Try Different Client**
   - PuTTY (Windows)
   - Terminal (macOS/Linux)
   - Mobile SSH app

### System Won't Update

**Symptoms**: `apt update` or `apt upgrade` fails.

**Solutions**:

1. **Check Internet Connection**
   ```bash
   ping -c 4 8.8.8.8
   ping -c 4 google.com
   ```

2. **Verify DNS**
   ```bash
   cat /etc/resolv.conf
   # Should have nameserver entries
   ```

3. **Update Package Lists**
   ```bash
   sudo apt clean
   sudo apt update
   ```

4. **Fix Broken Packages**
   ```bash
   sudo apt --fix-broken install
   sudo dpkg --configure -a
   ```

### Timezone Wrong

**Symptoms**: Times displayed incorrectly.

**Solutions**:

1. **Check Current Timezone**
   ```bash
   timedatectl
   ```

2. **Set Correct Timezone**
   ```bash
   sudo timedatectl set-timezone America/New_York
   # Or your timezone
   ```

3. **List Available Timezones**
   ```bash
   timedatectl list-timezones
   ```

4. **Restart Services**
   ```bash
   sudo systemctl restart escapeplan-api
   ```

---

## Getting More Help

### Collect Diagnostic Information

Before asking for help, collect this information:

```bash
# System info
uname -a
cat /etc/os-release

# Service status
sudo systemctl status escapeplan-api escapeplan-web nginx postgresql

# Recent logs
sudo journalctl -u escapeplan-api -n 100 > ~/api-logs.txt
sudo journalctl -u escapeplan-web -n 100 > ~/web-logs.txt
sudo tail -n 200 /var/log/nginx/error.log > ~/nginx-logs.txt

# Disk and memory
df -h > ~/disk-usage.txt
free -h > ~/memory-usage.txt

# Network
ip addr show > ~/network-info.txt
sudo nmcli connection show > ~/connections.txt
```

### Community Support

- **Discussions**: [github.com/kryptobaseddev/escapeplan/discussions](https://github.com/kryptobaseddev/escapeplan/discussions)
- **Issues**: [github.com/kryptobaseddev/escapeplan/issues](https://github.com/kryptobaseddev/escapeplan/issues)

### Additional Documentation

- [Installation Guide](INSTALLATION.md)
- [Security Guide](SECURITY.md)
- [Upgrade Guide](UPGRADE.md)
- [Quick Start](QUICKSTART.md)

---

**Still Stuck?** Post in [GitHub Discussions](https://github.com/kryptobaseddev/escapeplan/discussions) with:
1. Problem description
2. Steps to reproduce
3. Error messages
4. Diagnostic information (see above)
