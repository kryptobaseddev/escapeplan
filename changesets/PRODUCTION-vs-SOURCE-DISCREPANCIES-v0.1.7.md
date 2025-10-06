# Production vs Source Code Discrepancies - v0.1.7

**Date:** 2025-10-05
**Server:** 10.0.10.136
**Status:** ⚠️ PRODUCTION PARTIALLY UPDATED

---

## Critical: Changes Applied to Production

### ✅ Applied to Both Production AND Source

1. **nginx WebSocket Proxy** ✅
   - **File (Production):** `/etc/nginx/sites-available/escapeplan.conf`
   - **File (Source):** ❌ NOT IN SOURCE (manual fix only)
   - **Status:** Working in production
   - **Action Required:** Add to package build template

2. **Sudo Permissions for Shutdown** ✅
   - **File (Production):** `/etc/sudoers.d/escapeplan-power`
   - **File (Source):** ❌ NOT IN SOURCE (manual fix only)
   - **Status:** Working in production
   - **Action Required:** Add to package postinst script

3. **API Shutdown/Restart Endpoints** ✅
   - **File (Production):** `/opt/escapeplan/api/index.js` (manually edited)
   - **File (Source):** `apps/escapeplan-api/src/index.ts` (lines 972-1020)
   - **Status:** Working in production
   - **Action Required:** None (already in source)

---

## ❌ Changes ONLY in Source Code (NOT in Production)

### 1. Backup EROFS Retry Logic ❌

**File (Source):** `apps/escapeplan-api/src/system/backup.ts` (lines 219-248)

**Change:** Added retry logic with exponential backoff for EROFS errors

**Status:**
- ❌ NOT in production `/opt/escapeplan/api/index.js`
- ✅ In source code
- Requires package rebuild

**Impact:**
- Production backups may still fail on transient EROFS errors
- Next package build will include retry logic

---

### 2. Auth Cookie Configuration Fix ❌

**File (Source):** `apps/escapeplan-api/src/auth-config.ts` (line 165)

**Change:**
```typescript
// Before:
useSecureCookies: runtime.isProduction

// After:
useSecureCookies: false
```

**Status:**
- ❌ Source change not deployed to production
- ✅ Production `/opt/escapeplan/api/index.js` already has `useSecureCookies: false` (from previous manual fix)
- Both production and source are now correct

**Impact:** None - production already correct

---

### 3. Shutdown/Restart UI Buttons ❌

**File (Source):** `apps/escapeplan-web/src/routes/(app)/admin/system/HealthTab.svelte`

**Changes:**
- Added power management state variables (lines 96-132)
- Added Power Management card with shutdown/restart buttons (lines 226-264)

**Status:**
- ❌ NOT in production (web app not rebuilt)
- ✅ In source code
- ✅ API endpoints ARE working in production
- Requires web app rebuild

**Impact:**
- Operators cannot use shutdown buttons in UI
- Must use SSH: `ssh escapeplan@10.0.10.136` → `sudo poweroff`
- API endpoints `/api/admin/system/shutdown` and `/api/admin/system/restart` DO work via curl

---

## Summary Table

| Change | Production Status | Source Status | Requires Action |
|--------|------------------|---------------|-----------------|
| nginx Socket.IO proxy | ✅ Manual | ❌ Not in source | Add to build |
| Sudo shutdown perms | ✅ Manual | ❌ Not in source | Add to postinst |
| API shutdown endpoints | ✅ Manual edit | ✅ In source | None |
| Backup retry logic | ❌ Not applied | ✅ In source | Rebuild package |
| Auth cookie fix | ✅ Previous manual | ✅ In source | None |
| Shutdown UI buttons | ❌ Not applied | ✅ In source | Rebuild web |

---

## Production Server Current State

### What's Working ✅
- WebSocket real-time features
- Authentication and sessions
- Backup creation (may fail on EROFS, no retry)
- Shutdown/Restart API endpoints (via curl only)
- All network features
- All game/booking features

### What's NOT Working ❌
- Shutdown/Restart UI buttons (no web rebuild)
- Backup EROFS retry (no API rebuild)

### What Requires Manual Intervention ⚠️
- Shutdown: Must use `ssh` → `sudo poweroff` (UI buttons not visible)
- EROFS errors: Backup may fail, retry manually

---

## Files Modified on Production Server (Manual)

### 1. `/etc/nginx/sites-available/escapeplan.conf`
**Backup:** Original not backed up
**Change:** Added Socket.IO location block
**Lines Added:** ~13 lines

### 2. `/etc/sudoers.d/escapeplan-power`
**Backup:** N/A (new file)
**Content:**
```
escapeplan ALL=(ALL) NOPASSWD: /usr/sbin/shutdown, /usr/sbin/reboot, /sbin/shutdown, /sbin/reboot
```
**Permissions:** 0440

### 3. `/opt/escapeplan/api/index.js`
**Backup:** `/opt/escapeplan/api/index.js.backup-before-shutdown`
**Change:** Added shutdown/restart POST endpoints
**Lines Added:** ~36 lines (inserted at line 4804)

---

## Next Package Build Must Include

### 1. nginx Configuration Template
**Add to:** `build-deb.sh` or package files

```nginx
location /socket.io/ {
    proxy_pass http://localhost:4000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
}
```

### 2. Sudo Configuration
**Add to:** `postinst` script or package installation

```bash
# Create sudoers file for shutdown permissions
cat > /etc/sudoers.d/escapeplan-power << 'EOF'
escapeplan ALL=(ALL) NOPASSWD: /usr/sbin/shutdown, /usr/sbin/reboot, /sbin/shutdown, /sbin/reboot
EOF
chmod 0440 /etc/sudoers.d/escapeplan-power
visudo -c  # Validate
```

### 3. Rebuild Both API and Web
- API rebuild: Includes backup retry logic + shutdown endpoints
- Web rebuild: Includes shutdown UI buttons

---

## Temporary Workaround for Shutdown

**Until next package build with UI buttons:**

```bash
# SSH method (safe)
ssh escapeplan@10.0.10.136
sudo poweroff

# OR curl method (if you have auth cookie)
curl -X POST http://escapeplan.local/api/admin/system/shutdown \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

**⚠️ DO NOT just pull power!**
- Corrupts SD card
- Damages database
- Causes boot loops

**If emergency requires power pull:**
- Expect potential database corruption
- May need to restore from backup
- System may not boot cleanly

---

## Safe Shutdown Procedure (Without UI)

1. **SSH into server:**
   ```bash
   ssh escapeplan@10.0.10.136
   # Password: escapeplan
   ```

2. **Initiate shutdown:**
   ```bash
   sudo poweroff
   ```

3. **Wait for LED:**
   - Green LED will blink during shutdown
   - Wait ~15 seconds
   - LED stops completely = safe to unplug

4. **Unplug power**

---

## Verification After Next Boot

When you boot the system again, verify:

```bash
# 1. Check API is running
systemctl status escapeplan-api.service

# 2. Check web is running
systemctl status escapeplan-web.service

# 3. Check nginx config
nginx -t

# 4. Check database integrity
sqlite3 /var/lib/escapeplan/escapeplan.db "PRAGMA integrity_check;"

# 5. Test WebSocket connection
# Navigate to http://escapeplan.local/dashboard
# Should see live updates

# 6. Test shutdown endpoint (via curl)
curl -X POST http://localhost:4000/api/admin/system/shutdown
# Should return: {"success":true,"message":"System shutdown initiated"}
```

---

## Critical Files Reference

### Production Server (10.0.10.136)

**Modified Files:**
- `/etc/nginx/sites-available/escapeplan.conf`
- `/etc/sudoers.d/escapeplan-power`
- `/opt/escapeplan/api/index.js`

**Backups Created:**
- `/opt/escapeplan/api/index.js.backup-before-shutdown`

**NOT Modified:**
- `/opt/escapeplan/web/` (built files - would need full rebuild)

### Source Code

**Modified Files:**
- `apps/escapeplan-api/src/index.ts` (shutdown endpoints)
- `apps/escapeplan-api/src/auth-config.ts` (auth cookies)
- `apps/escapeplan-api/src/system/backup.ts` (EROFS retry)
- `apps/escapeplan-web/src/routes/(app)/admin/system/HealthTab.svelte` (UI buttons)

**NOT in Source:**
- nginx Socket.IO config
- sudo shutdown permissions

---

## Changesets Documenting All Changes

1. `fix-nginx-websocket-proxy-v0.1.7.md`
2. `fix-auth-cookies-http-only-v0.1.7.md`
3. `fix-backup-erofs-retry-logic-v0.1.7.md`
4. `add-system-shutdown-restart-ui-v0.1.7.md`
5. `investigate-alerts-tab-blank-v0.1.7.md`
6. `verify-storage-permissions-v0.1.7.md`
7. `SESSION-SUMMARY-2025-10-05-ALL-FIXES.md`
8. `PRODUCTION-vs-SOURCE-DISCREPANCIES-v0.1.7.md` ← This document

---

## Status Summary

**Production Server:**
- ✅ Mostly functional
- ✅ Critical fixes applied (WebSocket, auth, shutdown API)
- ❌ Missing UI buttons for shutdown
- ❌ Missing backup retry logic

**Source Code:**
- ✅ All fixes committed
- ✅ Ready for next package build
- ⚠️ Missing: nginx config template, sudo config in postinst

**Deployment Status:**
- 🟡 Partial - safe to use but incomplete
- Next build will sync everything

---

**Current Time:** 2025-10-05 19:03 BST
**Safe to pull power?** NO - Use `ssh` → `sudo poweroff` → wait for LED
