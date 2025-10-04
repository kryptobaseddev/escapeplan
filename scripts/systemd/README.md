# EscapePlan Systemd Backup Services

This directory contains systemd unit files for automated daily backups of the EscapePlan system.

## Overview

The backup system consists of three systemd units:

1. **escapeplan-backup.service** - One-shot service that executes the backup script
2. **escapeplan-backup.timer** - Timer that triggers the backup service daily at 03:00 AM
3. **escapeplan-backup-notify@.service** - Notification service triggered on backup failures

## Architecture

```
escapeplan-backup.timer (daily @ 03:00)
         |
         v
escapeplan-backup.service
         |
         +--[success]--> logs to journal
         |
         +--[failure]--> escapeplan-backup-notify@failure.service
                              |
                              v
                         alert logged to journal
```

## Installation

### Prerequisites

- EscapePlan must be installed at `/opt/escapeplan/`
- User `escapeplan` must exist with proper permissions
- Backup script must exist at `/opt/escapeplan/scripts/backup.sh`
- Directories must exist:
  - `/var/lib/escapeplan/` (data directory)
  - `/var/backups/escapeplan/` (backup storage)
  - `/mnt/escapeplan-backup/` (optional USB backup mount)

### Step 1: Copy Unit Files

```bash
sudo cp escapeplan-backup.service /etc/systemd/system/
sudo cp escapeplan-backup.timer /etc/systemd/system/
sudo cp escapeplan-backup-notify@.service /etc/systemd/system/
```

### Step 2: Set Correct Permissions

```bash
sudo chmod 644 /etc/systemd/system/escapeplan-backup.service
sudo chmod 644 /etc/systemd/system/escapeplan-backup.timer
sudo chmod 644 /etc/systemd/system/escapeplan-backup-notify@.service
```

### Step 3: Create Required Directories

```bash
# Create backup directory with proper ownership
sudo mkdir -p /var/backups/escapeplan
sudo chown escapeplan:escapeplan /var/backups/escapeplan
sudo chmod 750 /var/backups/escapeplan

# Optionally create USB backup mount point
sudo mkdir -p /mnt/escapeplan-backup
```

### Step 4: Reload Systemd

```bash
sudo systemctl daemon-reload
```

### Step 5: Enable and Start Timer

```bash
# Enable timer to start on boot
sudo systemctl enable escapeplan-backup.timer

# Start timer immediately
sudo systemctl start escapeplan-backup.timer
```

## Verification

### Check Timer Status

```bash
# View timer status and next scheduled run
sudo systemctl status escapeplan-backup.timer

# List all active timers
sudo systemctl list-timers escapeplan-backup.timer
```

Expected output should show:
- Timer is **active (waiting)**
- Next trigger time is shown
- Last trigger time (after first run)

### Check Service Status

```bash
# View last backup service execution
sudo systemctl status escapeplan-backup.service

# View backup service logs
sudo journalctl -u escapeplan-backup.service -n 50

# Follow backup logs in real-time
sudo journalctl -u escapeplan-backup.service -f
```

### Manual Backup Trigger

```bash
# Manually trigger a backup (for testing)
sudo systemctl start escapeplan-backup.service

# Check the result
sudo systemctl status escapeplan-backup.service
```

## Configuration

### Modify Backup Schedule

To change the backup time, edit `/etc/systemd/system/escapeplan-backup.timer`:

```ini
[Timer]
# Change to 02:00 AM
OnCalendar=*-*-* 02:00:00
```

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart escapeplan-backup.timer
```

### Modify Backup Retention

Edit `/etc/systemd/system/escapeplan-backup.service` to change retention days:

```ini
[Service]
Environment=BACKUP_RETENTION_DAYS=14
```

Then reload systemd:
```bash
sudo systemctl daemon-reload
```

### Adjust Randomized Delay

The timer includes a 5-minute randomized delay to prevent resource contention. To adjust:

```ini
[Timer]
# Change to 10 minutes (600 seconds)
RandomizedDelaySec=600
```

## Monitoring

### View All Backup-Related Logs

```bash
# All backup system logs
sudo journalctl -u escapeplan-backup.* -n 100

# Backup failures only
sudo journalctl -u escapeplan-backup-notify@failure.service

# Logs from today
sudo journalctl -u escapeplan-backup.service --since today

# Logs with priority error or higher
sudo journalctl -u escapeplan-backup.service -p err
```

### Check Backup Files

```bash
# List backup archives
ls -lh /var/backups/escapeplan/

# Check backup sizes
du -sh /var/backups/escapeplan/*

# Verify latest backup integrity
sha256sum -c /var/backups/escapeplan/*.sha256 | tail -1
```

### Monitor Disk Space

```bash
# Check backup directory disk usage
df -h /var/backups/escapeplan/

# Check data directory disk usage
df -h /var/lib/escapeplan/
```

## Troubleshooting

### Timer Not Running

```bash
# Check if timer is enabled
sudo systemctl is-enabled escapeplan-backup.timer

# Enable if disabled
sudo systemctl enable escapeplan-backup.timer

# Check timer unit for errors
systemd-analyze verify /etc/systemd/system/escapeplan-backup.timer
```

### Backup Service Fails

```bash
# Check detailed error logs
sudo journalctl -u escapeplan-backup.service -n 50 --no-pager

# Verify backup script exists and is executable
ls -l /opt/escapeplan/scripts/backup.sh

# Check permissions
sudo -u escapeplan /opt/escapeplan/scripts/backup.sh daily
```

### Permission Errors

```bash
# Verify escapeplan user exists
id escapeplan

# Check directory ownership
ls -ld /var/lib/escapeplan /var/backups/escapeplan

# Fix ownership if needed
sudo chown -R escapeplan:escapeplan /var/lib/escapeplan
sudo chown -R escapeplan:escapeplan /var/backups/escapeplan
```

### Disk Space Issues

```bash
# Clean up old backups manually
sudo find /var/backups/escapeplan -name "auto-*.tar.gz" -mtime +30 -delete

# Check database size
du -h /var/lib/escapeplan/escapeplan.db
```

## Security

### File Permissions

All systemd unit files should have restrictive permissions:
```bash
-rw-r--r-- 1 root root escapeplan-backup.service
-rw-r--r-- 1 root root escapeplan-backup.timer
-rw-r--r-- 1 root root escapeplan-backup-notify@.service
```

### Service Hardening

The backup service includes several security features:
- Runs as non-root user (`escapeplan`)
- Private `/tmp` directory
- No new privileges can be acquired
- Read-only system directories
- Limited memory and CPU usage
- Restricted network access (only Unix sockets and local network)

### Backup Encryption

Current backups are stored unencrypted. For encrypted backups, modify the backup script or add:

```bash
# Example: GPG encryption (requires key setup)
gpg --encrypt --recipient backup@escapeplan.local backup.tar.gz
```

## Offline Operation

The backup system works completely offline:
- No internet connection required
- Backups stored locally on the device
- Optional USB drive support for external backups
- Timer runs based on system clock (ensure chrony is configured)

## USB Backup Drive

To enable automatic backups to USB drive:

1. **Mount USB drive** at `/mnt/escapeplan-backup/`
2. **Update service file** to include USB path in `ReadWritePaths`
3. **Modify backup script** to copy backups to USB location

```bash
# Add to backup script
if [ -d "/mnt/escapeplan-backup" ]; then
    cp "$BACKUP_NAME.tar.gz" /mnt/escapeplan-backup/
fi
```

## Integration with Update System

The backup service is automatically triggered before system updates via the update mechanism. No additional configuration is needed.

When an update is initiated, the update system will:
1. Trigger `escapeplan-backup.service` manually
2. Wait for backup completion
3. Proceed with update if backup succeeds
4. Abort update if backup fails

## Maintenance

### Weekly Tasks

- Check backup logs: `sudo journalctl -u escapeplan-backup.service --since "7 days ago"`
- Verify latest backup: Check `/var/backups/escapeplan/` directory
- Monitor disk space: `df -h /var/backups/escapeplan/`

### Monthly Tasks

- Test backup restoration procedure
- Verify backup checksums
- Review backup retention policy
- Check for systemd unit file updates

### Quarterly Tasks

- Full backup verification (restore to test system)
- Review security hardening settings
- Update documentation if processes change

## Support

For issues or questions:
- Check logs: `sudo journalctl -u escapeplan-backup.service -n 100`
- Review this README
- Check EscapePlan documentation
- Raise issue on GitHub: https://github.com/kryptobaseddev/escapeplan-app/issues

## Technical Details

### Timer Schedule Format

The timer uses systemd calendar expressions:
- `OnCalendar=daily` - Shorthand for daily execution
- `OnCalendar=*-*-* 03:00:00` - Every day at 03:00:00
- `Persistent=true` - Catch up missed runs after system restart
- `RandomizedDelaySec=300` - Add 0-5 minute random delay

### Service Type

- `Type=oneshot` - Service runs once and exits
- Perfect for backup scripts that complete and terminate
- systemd tracks success/failure via exit code

### Failure Handling

The notification service uses template units:
- `@` in filename indicates a template unit
- `%i` is replaced with instance name (e.g., "failure")
- Can be instantiated with different parameters
- Logs to journal with high priority (error level)

## File Permissions Guide

Recommended permissions for production:

```bash
# Systemd unit files (installed)
/etc/systemd/system/escapeplan-backup.service       644 root:root
/etc/systemd/system/escapeplan-backup.timer         644 root:root
/etc/systemd/system/escapeplan-backup-notify@.service  644 root:root

# Backup script
/opt/escapeplan/scripts/backup.sh                   755 root:root

# Data directories
/var/lib/escapeplan/                                750 escapeplan:escapeplan
/var/backups/escapeplan/                            750 escapeplan:escapeplan
/mnt/escapeplan-backup/                             750 escapeplan:escapeplan

# Backup files
/var/backups/escapeplan/*.tar.gz                    640 escapeplan:escapeplan
/var/backups/escapeplan/*.sha256                    640 escapeplan:escapeplan
```

## Raspberry Pi Specific Notes

### Performance Considerations

- Backups run at 03:00 AM when system load is typically low
- CPU quota set to 50% to prevent backup from blocking other services
- Memory limited to 512M to prevent OOM on Raspberry Pi
- RandomizedDelay spreads load if multiple timers are configured

### SD Card Longevity

- Backups use tar compression to minimize writes
- Retention policy (7 days default) limits SD card wear
- Consider USB drive for long-term backup storage

### Clock Synchronization

Ensure `chrony` or `systemd-timesyncd` is configured for accurate timer execution:

```bash
# Check time sync status
timedatectl status

# Enable time sync if needed
sudo timedatectl set-ntp true
```

## Version History

- **v1.0** (2025-10-04) - Initial systemd backup timer implementation
  - Daily backups at 03:00 AM
  - Failure notification system
  - Security hardening
  - Persistent timer (catch up missed runs)
  - 5-minute randomized delay
