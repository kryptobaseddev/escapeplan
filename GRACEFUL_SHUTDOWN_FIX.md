# Graceful Shutdown Fix - Deployment Guide

## Issue Summary
**Problem**: Service takes 90+ seconds to stop, requiring SIGKILL
**Root Cause**: Socket.IO connections not closed before Fastify server shutdown
**Fix**: Added Socket.IO close before server.close() in shutdown handler

## Changes Made

### File Modified
- **Source**: `/opt/escapeplan/api/src/index.ts`
- **Built**: `/opt/escapeplan/api/dist/index.js`

### Code Changes

1. **Modified `buildServer()` return value** (line ~2232):
   ```typescript
   return { app, io };  // Previously: return app;
   ```

2. **Modified server initialization** (line ~2257):
   ```typescript
   const { app: server, io } = await buildServer();  // Previously: const server = await buildServer();
   ```

3. **Added Socket.IO close to shutdown handler** (lines ~2278-2289):
   ```typescript
   // Close Socket.IO connections first
   if (io) {
     server.log.info('Closing Socket.IO connections...');
     await new Promise<void>((resolve) => {
       io.close(() => {
         server.log.info('Socket.IO closed');
         resolve();
       });
     });
     // Wait 2 seconds for Socket.IO to fully close
     await new Promise(resolve => setTimeout(resolve, 2000));
   }
   ```

## Deployment Instructions

### Method 1: Install .deb Package (Recommended)

1. **Copy package to production server**:
   ```bash
   scp /mnt/projects/escape-plan/escapeplan-app/dist/escapeplan_1.0.0_amd64.deb escapeplan@10.0.10.138:~/
   ```

2. **SSH to production server**:
   ```bash
   ssh escapeplan@10.0.10.138
   ```

3. **Measure current shutdown time (BEFORE fix)**:
   ```bash
   time sudo systemctl restart escapeplan-api
   ```
   **Expected**: 90+ seconds with "Killing..." message

4. **Install the updated package**:
   ```bash
   sudo dpkg -i ~/escapeplan_1.0.0_amd64.deb
   ```

5. **Restart the service**:
   ```bash
   sudo systemctl restart escapeplan-api
   ```

6. **Measure NEW shutdown time (AFTER fix)**:
   ```bash
   time sudo systemctl restart escapeplan-api
   ```
   **Expected**: <10 seconds, no SIGKILL

### Method 2: Direct File Replacement (Quick Fix)

If .deb installation fails, manually copy the built file:

1. **Backup current file**:
   ```bash
   sudo cp /opt/escapeplan/api/dist/index.js /opt/escapeplan/api/dist/index.js.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Copy new built file**:
   ```bash
   scp /mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api/dist/index.js escapeplan@10.0.10.138:/tmp/
   sudo mv /tmp/index.js /opt/escapeplan/api/dist/index.js
   sudo chown escapeplan:escapeplan /opt/escapeplan/api/dist/index.js
   ```

3. **Restart service**:
   ```bash
   sudo systemctl restart escapeplan-api
   ```

## Verification Steps

### 1. Check Service Restart Time
```bash
time sudo systemctl restart escapeplan-api
```
**Expected**: Real time < 10 seconds

### 2. Check Logs for Graceful Shutdown Messages
```bash
sudo journalctl -u escapeplan-api -n 50 | grep -E "SIGTERM|shutdown|Socket.IO"
```

**Expected output**:
```
Oct 06 18:20:00 escapeplan node[1234]: SIGTERM received, starting graceful shutdown...
Oct 06 18:20:00 escapeplan node[1234]: Closing Socket.IO connections...
Oct 06 18:20:00 escapeplan node[1234]: Socket.IO closed
Oct 06 18:20:02 escapeplan node[1234]: Graceful shutdown complete
```

### 3. Verify No SIGKILL in Logs
```bash
sudo journalctl -u escapeplan-api -n 100 | grep -i "killing\|sigkill"
```
**Expected**: No output (no forced kills)

### 4. Check Service Status
```bash
sudo systemctl status escapeplan-api
```
**Expected**: Active (running), no error messages

### 5. Verify Application Functionality
- Open web interface: `http://10.0.10.1` or `http://escapeplan.local`
- Test WebSocket connection (dashboard should update in real-time)
- Test a few API calls to ensure everything works

## QA Checklist

- [x] Backup created: `/opt/escapeplan/api/src/index.ts.backup.20251006_181300`
- [x] Shutdown handler modified with Socket.IO close
- [x] Project built successfully
- [x] .deb package created: `/mnt/projects/escape-plan/escapeplan-app/dist/escapeplan_1.0.0_amd64.deb`
- [ ] Service restart completes in <10 seconds
- [ ] No SIGKILL in logs
- [ ] "Graceful shutdown complete" message appears
- [ ] Service starts successfully after restart
- [ ] WebSocket connections work correctly
- [ ] API functionality verified

## Rollback Instructions

If issues occur after deployment:

1. **Restore from backup**:
   ```bash
   sudo cp /opt/escapeplan/api/dist/index.js.backup.YYYYMMDD_HHMMSS /opt/escapeplan/api/dist/index.js
   sudo systemctl restart escapeplan-api
   ```

2. **Check service status**:
   ```bash
   sudo systemctl status escapeplan-api
   sudo journalctl -u escapeplan-api -n 50
   ```

## Expected Results

### Before Fix
- Shutdown time: 90+ seconds
- Logs show: "Killing service..." or "SIGKILL sent"
- systemd timeout reached (90s default)

### After Fix
- Shutdown time: <10 seconds (typically 2-5 seconds)
- Logs show:
  - "SIGTERM received"
  - "Closing Socket.IO connections..."
  - "Socket.IO closed"
  - "Graceful shutdown complete"
- No SIGKILL messages
- Clean service restart

## Technical Details

The fix addresses the root cause by ensuring Socket.IO server closes before Fastify server shutdown:

1. **Stop timer interval** - Prevents new timer updates
2. **Close Socket.IO** - Gracefully disconnects all WebSocket clients (2-second timeout)
3. **Close Fastify server** - Stops HTTP server after Socket.IO is closed
4. **Close database** - Closes SQLite connection

This sequence ensures all active connections are properly terminated before the process exits.
