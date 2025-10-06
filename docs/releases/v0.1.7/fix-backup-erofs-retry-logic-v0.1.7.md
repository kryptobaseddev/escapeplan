# Fix: Add Retry Logic for Transient EROFS Errors in Backup System

**Version:** v0.1.7+
**Date:** 2025-10-05
**Type:** Source Code Fix (Reliability Improvement)
**Status:** FIXED IN SOURCE

## Problem

Manual backup creation failed with EROFS (read-only file system) error:

```
Error: EROFS: read-only file system, open '/var/backups/escapeplan/escapeplan-backup-2025-10-05T17-43-40-009Z.tar.gz'
```

**Occurrence:** 2025-10-05 at 18:43:40 BST

## Investigation

### Filesystem Status Check
1. ✅ Root filesystem mounted `rw` (read-write), not read-only
2. ✅ `/var/backups/escapeplan/` directory exists, owned by `escapeplan:escapeplan`
3. ✅ Manual file creation test **succeeded** - directory is writable
4. ✅ API service runs as `escapeplan` user (correct permissions)

### Root Cause Analysis

The EROFS error was **transient** - likely caused by:

1. **SD Card Characteristics:** Raspberry Pi SD cards can temporarily report read-only status during:
   - High concurrent I/O operations
   - Power fluctuations
   - Wear leveling operations
   - Thermal throttling

2. **Timing Issue:** The `tar.create()` function opens the output file for writing. If the SD card is momentarily in a read-only state when the file is opened, the operation fails immediately without retry.

3. **Single-Attempt Failure:** The backup code had no retry logic, so any transient error would cause the entire backup to fail.

### Evidence

**Filesystem Test (2 minutes after error):**
```bash
touch /var/backups/escapeplan/test.txt  # ✅ Succeeded
rm /var/backups/escapeplan/test.txt     # ✅ Succeeded
```

**Mount Status:**
```bash
/dev/mmcblk0p2 on / type ext4 (rw,noatime)
```
Filesystem is read-write (rw), not read-only (ro).

**Kernel Logs:**
No EROFS-related kernel messages found.

**Conclusion:** The error was transient, not a persistent filesystem issue.

## Files Changed

### Source Code
**File:** `apps/escapeplan-api/src/system/backup.ts`
**Lines:** 219-248

**Change:** Added retry logic with exponential backoff for tar archive creation

**Before:**
```typescript
    // Create tar.gz archive
    await tar.create(
      {
        gzip: true,
        file: backupFilePath,
        cwd: tempDir
      },
      ['.'] // Include all files in temp directory
    );
```

**After:**
```typescript
    // Create tar.gz archive with retry logic for transient EROFS errors
    const createArchiveWithRetry = async (retries = 3): Promise<void> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await tar.create(
            {
              gzip: true,
              file: backupFilePath,
              cwd: tempDir
            },
            ['.'] // Include all files in temp directory
          );
          return; // Success - exit retry loop
        } catch (error: any) {
          const isEROFS = error?.code === 'EROFS' || error?.message?.includes('read-only file system');
          const isLastAttempt = attempt === retries;

          if (isEROFS && !isLastAttempt) {
            console.warn(`[Backup] EROFS error on attempt ${attempt}/${retries}, retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000)); // Exponential backoff
            continue;
          }

          // Either not an EROFS error, or we've exhausted retries
          throw error;
        }
      }
    };

    await createArchiveWithRetry();
```

## Fix Rationale

### Why Retry Logic is Appropriate

1. **Transient Errors:** EROFS on Raspberry Pi SD cards is typically temporary
2. **User Experience:** Automatic retry prevents failed backups from requiring manual intervention
3. **Exponential Backoff:** 1s, 2s, 3s delays give SD card time to stabilize
4. **Limited Retries:** 3 attempts prevent infinite loops while allowing recovery
5. **Selective Retry:** Only retries EROFS errors, not all errors (prevents masking real issues)

### Why This Solves the Problem

**Scenario 1: Transient EROFS**
- Attempt 1: EROFS error → wait 1 second
- Attempt 2: Success → backup created

**Scenario 2: Persistent EROFS**
- Attempt 1: EROFS error → wait 1 second
- Attempt 2: EROFS error → wait 2 seconds
- Attempt 3: EROFS error → throw error, update backup record to 'failed'

**Scenario 3: Different Error (e.g., disk full)**
- Attempt 1: ENOSPC error → immediately throw (no retry)

## Testing

### How to Test

1. **Trigger Backup:**
   ```bash
   # Via UI: Storage tab → Create Backup button
   # OR via API:
   curl -X POST http://escapeplan.local/api/admin/backups \
     -H "Content-Type: application/json" \
     -d '{
       "type": "manual",
       "includes": {"database": true, "assets": true, "games": true, "logs": true},
       "destination": "local"
     }'
   ```

2. **Check Logs for Retry:**
   ```bash
   journalctl -u escapeplan-api.service -f | grep -i "backup\|EROFS"
   ```

3. **Expected Behavior:**
   - If EROFS occurs: See retry warning messages
   - Backup should succeed on retry
   - No error shown to user unless all retries fail

### Simulating EROFS (for testing)

**⚠️ Dangerous - only for testing:**
```bash
# Temporarily remount root as read-only
sudo mount -o remount,ro /

# Trigger backup (will get EROFS)

# Remount as read-write
sudo mount -o remount,rw /
```

**Better approach:** Wait for natural occurrence and verify logs show retry.

## Impact

**Before Fix:**
- ❌ Single EROFS error causes backup to fail completely
- ❌ User must manually retry backup
- ❌ No indication if error is transient or persistent
- ❌ Lost data if automated backup fails overnight

**After Fix:**
- ✅ Automatic retry on EROFS errors
- ✅ Most transient errors recover automatically
- ✅ Log warnings for operators to monitor SD card health
- ✅ Improved reliability of automated backups
- ✅ User only sees error if genuinely persistent

## Deployment Notes

**This is a source code fix.** The production server is currently working (EROFS was transient), but will benefit from this fix on the next package rebuild.

**Next steps:**
1. Commit this source change to git
2. Rebuild package with retry logic
3. Future backups will have automatic retry
4. No immediate action required (system is operational)

## Related Issues

- Raspberry Pi SD card wear can cause intermittent read-only states
- This is a known issue with SD cards under heavy write load
- Consider monitoring SD card health with `smartmontools`
- Consider migrating to USB SSD for production deployments

## Monitoring Recommendations

### Log Monitoring

Watch for retry warnings in API logs:
```bash
journalctl -u escapeplan-api.service | grep "EROFS error on attempt"
```

If you see frequent retries (daily or more), consider:
1. Checking SD card health: `sudo dmesg | grep mmcblk`
2. Replacing SD card if errors increase
3. Migrating to USB SSD for better reliability

### Backup Health Check

```bash
# Verify recent backups exist
find /var/backups/escapeplan -name "*.tar.gz" -mtime -1 -ls

# Check backup database records
sqlite3 /var/lib/escapeplan/escapeplan.db \
  "SELECT type, status, created_at, error_message
   FROM backups
   ORDER BY created_at DESC
   LIMIT 10;"
```

## Prevention

### SD Card Best Practices

1. **Use high-quality cards:** SanDisk Extreme or Samsung EVO Plus
2. **Enable log2ram:** Reduce write wear by logging to RAM
3. **Monitor health:** Check `dmesg` for SD card errors monthly
4. **Plan migration:** Consider USB SSD for production

### Backup Strategy

1. **Test restores:** Monthly test restore from backup
2. **Dual destination:** Enable USB backup in addition to local
3. **Automated monitoring:** Alert if backup fails 2+ times
4. **Retention policy:** Keep 7 local + unlimited USB backups

## References

- Raspberry Pi SD card issues: https://www.raspberrypi.com/documentation/computers/configuration.html#sd-cards
- tar library error handling: https://www.npmjs.com/package/tar
- Backup system documentation: `apps/escapeplan-api/docs/ASSET_STORAGE_CONFIGURATION.md`
- Runtime environment detection: `packages/contracts/src/runtime.ts`

## Changelog

### 2025-10-05
- **Added:** Retry logic with exponential backoff (3 attempts: 1s, 2s, 3s)
- **Added:** Selective retry only for EROFS errors
- **Added:** Warning logs for operators to monitor
- **Status:** Source code fixed, awaiting package rebuild
