## Comprehensive Production Deployment Issues - v0.1.7
**Emergency Fixes Applied: October 5, 2025**

---

## Executive Summary

v0.1.7 deployment revealed **6 critical infrastructure issues** that prevented the application from functioning in production. All issues were related to the **development→production environment transition**, specifically:

1. Bundled code behavior differences (process.exit)
2. Architecture-specific native modules (ARM64 vs x64)
3. HTTP vs HTTPS cookie security
4. Browser API communication paths
5. WebSocket connection URLs
6. **nginx reverse proxy configuration**

**All issues have been fixed** and documented in changesets.

---

## Issue Categories

### 1. Build & Bundling Issues
- **process.exit() in bundled code** - Killed server on startup
- **Native module architectures** - x64 binaries on ARM64 device

### 2. Authentication & Security Issues
- **Secure cookies over HTTP** - Browsers rejected auth cookies
- **Missing BETTER_AUTH_SECRET** - Used insecure default

### 3. Network & Infrastructure Issues
- **NetworkManager + hostapd conflict** - Caused kernel panic
- **nginx proxy_pass trailing slash** - Stripped /api prefix, all endpoints 404'd

### 4. Frontend Communication Issues
- **API client hardcoded localhost** - Browser couldn't reach API
- **WebSocket URL resolution** - No real-time updates

---

## Critical Issues Found

### Issue #1: nginx Strips /api Prefix (CRITICAL - ALL APIS BROKEN)
**File:** `/etc/nginx/sites-available/escapeplan.conf`

**Symptom:**
```
GET /api/assets/list → 404 Not Found
GET /api/admin/settings → 404 Not Found
ALL /api/* endpoints → 404
```

**Root Cause:**
```nginx
location /api/ {
    proxy_pass http://localhost:4000/;  # ← Trailing slash STRIPS prefix!
}
```

When `proxy_pass` has a trailing slash, nginx removes the `/api/` prefix before proxying:
- Browser sends: `GET /api/assets/list`
- nginx strips `/api/` and proxies: `GET /assets/list`
- API expects: `GET /api/assets/list`
- Result: **404 Not Found**

**Fix:**
```nginx
location /api/ {
    proxy_pass http://localhost:4000;  # NO trailing slash = preserves /api
}
```

**How to detect similar issues:**
1. Test API through nginx: `curl http://localhost/api/endpoint`
2. Test API directly: `curl http://localhost:4000/api/endpoint`
3. If direct works but nginx fails → check nginx config
4. Look for trailing slashes in `proxy_pass` directives

**Commands to find nginx proxy issues:**
```bash
# Check nginx config
sudo nginx -t
sudo cat /etc/nginx/sites-available/* | grep -A 3 "location /api"

# Test API endpoints
curl http://localhost/api/dashboard       # Through nginx
curl http://localhost:4000/api/dashboard  # Direct to API

# Watch nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

### Issue #2: API Client Hardcoded localhost:4000
**File:** `apps/escapeplan-web/src/lib/api/client.ts`

**Symptom:**
- Quick-start: "Unable to start session"
- Game creation: "Unable to create game"
- All API calls from browser fail

**Root Cause:**
```typescript
const DEFAULT_API_BASE = 'http://localhost:4000/api';
```

Browser tries to connect to **browser's localhost** (not server's localhost).

**Fix:**
```typescript
const DEFAULT_API_BASE = typeof window !== 'undefined'
  ? '/api'                      // Browser: relative path (goes through nginx)
  : 'http://localhost:4000/api'; // SSR: direct connection
```

**How to detect similar issues:**
1. Open browser DevTools → Network tab
2. Look for failed requests to `localhost:4000`
3. Check if requests should go through nginx instead

**Commands to find API client issues:**
```bash
# Search for hardcoded localhost URLs
grep -r "localhost:4000" apps/escapeplan-web/src/

# Search for API_BASE or apiBase usage
grep -rn "apiBase\|API_BASE" apps/escapeplan-web/src/

# Check environment variable usage
grep -rn "PUBLIC_API_BASE_URL" apps/escapeplan-web/
```

---

### Issue #3: WebSocket Connection URL

**File:** `apps/escapeplan-web/src/lib/realtime/socket.ts`

**Symptom:**
- Room display: "Room display unavailable"
- No real-time updates on dashboard
- Timer doesn't update

**Root Cause:**
WebSocket URL resolver didn't handle relative paths:
```typescript
if (base.endsWith('/api')) {
  return base.slice(0, -4);  // '/api'.slice(0, -4) = '' (empty!)
}
```

**Fix:**
```typescript
if (base === '/api') {
  return browser ? window.location.origin : '/';
}
```

**How to detect similar issues:**
1. Check browser console for `[Socket.IO] Connection error`
2. Look for failed WebSocket connections in Network tab
3. Test room display pages

**Commands to find WebSocket issues:**
```bash
# Search for socket.io usage
grep -rn "socket.io\|getSocket\|Socket" apps/escapeplan-web/src/

# Check WebSocket server setup
grep -rn "socket.io\|SocketServer" apps/escapeplan-api/src/

# Test WebSocket connection
# In browser console:
const socket = io('http://escapeplan.local');
socket.on('connect', () => console.log('Connected!'));
```

---

### Issue #4: process.exit() in Bundled Code

**File:** `apps/escapeplan-api/src/db/seed-settings.ts`

**Symptom:**
- API service starts then immediately exits (clean exit code 0)
- systemd restart loop
- No error messages

**Root Cause:**
CLI entry point in seed file runs when bundled:
```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSystemSettings().then(() => {
    process.exit(0);  // ← Kills server!
  });
}
```

When bundled, `import.meta.url` check always evaluates to true.

**Fix:**
Remove seed call from server startup (already runs in postinst):
```typescript
// Delete this from server startup:
// await seedSystemSettings();
```

**How to detect similar issues:**
1. Check if service exits immediately: `systemctl status escapeplan-api`
2. Look for clean exit (code 0) in logs
3. Search for `process.exit` in bundled code

**Commands to find process.exit issues:**
```bash
# Search for process.exit in source
grep -rn "process.exit" apps/escapeplan-api/src/

# Check if bundled file has process.exit
grep -n "process.exit" /opt/escapeplan/api/index.js

# Watch service logs
sudo journalctl -u escapeplan-api -f

# Check for restart loops
systemctl status escapeplan-api | grep -i "restart\|exited"
```

---

### Issue #5: Native Module Architecture Mismatch

**Files:** better-sqlite3, sharp, argon2

**Symptom:**
```
Error [ERR_DLOPEN_FAILED]: Module did not self-register
Cannot find package 'sharp'
```

**Root Cause:**
.deb package built on x86-64 machine, packaged x64 binaries for ARM64 device.

**Fix:**
Rebuild native modules on device:
```bash
cd /opt/escapeplan/api
sudo rm -rf node_modules
sudo pnpm install --no-frozen-lockfile
```

**How to detect similar issues:**
1. Check module architecture:
   ```bash
   file node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/*.node
   # Should show: ARM aarch64 (not x86-64!)
   ```

2. Look for `ERR_DLOPEN_FAILED` or module load errors

**Commands to find architecture issues:**
```bash
# Check system architecture
uname -m  # Should be: aarch64 (ARM64)

# Find all .node files
find /opt/escapeplan -name "*.node" -exec file {} \;

# Check for x86-64 binaries (shouldn't exist on ARM!)
find /opt/escapeplan -name "*.node" -exec file {} \; | grep x86-64

# Rebuild specific module
cd /opt/escapeplan/api/node_modules/.pnpm/MODULE_NAME@VERSION/node_modules/MODULE_NAME
sudo npm rebuild
```

---

### Issue #6: Better Auth Secure Cookies over HTTP

**File:** `apps/escapeplan-api/src/index.ts`

**Symptom:**
```
Authentication cookie missing
Unable to login
```

**Root Cause:**
Better Auth created `Secure` cookies (HTTPS-only) but system uses HTTP:
```typescript
advanced: {
  useSecureCookies: runtime.isProduction  // Forces Secure flag
}
```

Browsers reject Secure cookies over HTTP.

**Fix:**
```typescript
advanced: {
  useSecureCookies: false  // Allow HTTP cookies on local network
}
```

**How to detect similar issues:**
1. Check Set-Cookie headers for `Secure` flag:
   ```bash
   curl -i http://localhost:4000/api/auth/sign-in/email | grep -i "set-cookie"
   ```

2. Look for cookies with `__Secure-` prefix (require HTTPS)

**Commands to find cookie issues:**
```bash
# Check auth configuration
grep -rn "useSecureCookies\|Secure" apps/escapeplan-api/src/

# Test login and check cookies
curl -X POST http://localhost:4000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@escapeplan.local","password":"escapeplan"}' \
  -c /tmp/cookies.txt -i

cat /tmp/cookies.txt
```

---

## Developer Debugging Commands

### Find All Hardcoded URLs
```bash
# Find localhost references
grep -rn "localhost" apps/escapeplan-web/src/ apps/escapeplan-api/src/

# Find port numbers
grep -rn ":4000\|:3000\|:5173" apps/

# Find protocol specifications
grep -rn "http://\|https://" apps/ --include="*.ts" --include="*.svelte"
```

### Find Environment-Specific Code
```bash
# Find process.env usage
grep -rn "process.env" apps/

# Find runtime environment checks
grep -rn "NODE_ENV\|production\|development" apps/

# Find PUBLIC_ env vars (baked into build)
grep -rn "PUBLIC_" apps/escapeplan-web/
```

### Find Proxy/Network Configuration
```bash
# Check nginx configs
sudo nginx -t
sudo cat /etc/nginx/sites-available/*

# Check API base URL configuration
grep -rn "apiBase\|API_BASE\|proxy_pass" apps/

# Check CORS settings
grep -rn "cors\|origin" apps/escapeplan-api/src/
```

### Find WebSocket/Real-time Issues
```bash
# Find socket.io usage
grep -rn "socket.io\|Socket\|io(" apps/

# Find real-time event emitters
grep -rn "emit(\|on(" apps/

# Check WebSocket server setup
grep -rn "SocketServer\|socket.attach" apps/escapeplan-api/src/
```

### Find Native Module Issues
```bash
# List all native modules
find node_modules -name "*.node"

# Check architecture of native modules
find node_modules -name "*.node" -exec file {} \;

# Find modules with native dependencies
grep -r "\"gypfile\": true" node_modules/

# Check for rebuild scripts
grep -r "install.*node-gyp\|rebuild" package.json
```

### Test API Endpoints
```bash
# Login and save cookies
curl -X POST http://localhost:4000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@escapeplan.local","password":"escapeplan"}' \
  -c /tmp/cookies.txt

# Test endpoints (direct to API)
curl -b /tmp/cookies.txt http://localhost:4000/api/dashboard
curl -b /tmp/cookies.txt http://localhost:4000/api/admin/settings
curl -b /tmp/cookies.txt http://localhost:4000/api/assets/list

# Test endpoints (through nginx)
curl -b /tmp/cookies.txt http://localhost/api/dashboard
curl -b /tmp/cookies.txt http://localhost/api/admin/settings
curl -b /tmp/cookies.txt http://localhost/api/assets/list
```

### Watch Logs in Real-Time
```bash
# API service
sudo journalctl -u escapeplan-api -f

# Web service
sudo journalctl -u escapeplan-web -f

# nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# All services
sudo journalctl -f
```

---

## Prevention Checklist

### Before Building Production Package
- [ ] Verify all PUBLIC_ env vars have correct values
- [ ] Check for hardcoded `localhost` URLs
- [ ] Verify native modules are built for ARM64
- [ ] Test bundled code doesn't have unexpected `process.exit()`
- [ ] Verify nginx config preserves API paths

### Before Deploying
- [ ] Test package on ARM64 device (not x86-64)
- [ ] Verify all /api/* endpoints work through nginx
- [ ] Test WebSocket connections
- [ ] Verify auth cookies work over HTTP
- [ ] Check systemd services don't exit immediately

### After Deploying
- [ ] Test API endpoints: `curl http://localhost/api/dashboard`
- [ ] Test WebSocket: Check room display pages
- [ ] Test auth: Login and verify cookies
- [ ] Check logs: `journalctl -u escapeplan-api -n 100`
- [ ] Verify services stay running: `systemctl status escapeplan-*`

---

## All Changesets Created

1. `fix-seed-process-exit-v0-1-7.md` - process.exit() boot loop fix
2. `fix-native-modules-arm64-v0-1-7.md` - ARM64 binary rebuild instructions
3. `production-deployment-fixes-v0-1-7.md` - Better Auth, NetworkManager, secrets, etc.
4. `fix-api-client-relative-path-v0-1-7.md` - Browser API client fix
5. `fix-websocket-connection-url-v0-1-7.md` - WebSocket URL resolution fix
6. **`fix-nginx-api-prefix-stripping-v0-1-7.md`** - nginx proxy_pass trailing slash fix

---

## Status: ✅ ALL ISSUES RESOLVED

**Production System Status:**
- ✅ API service running
- ✅ Web service running
- ✅ nginx configured correctly
- ✅ EscapePlan WiFi broadcasting
- ✅ All API endpoints accessible
- ✅ WebSocket connections working
- ✅ Authentication working
- ✅ Room display functional
- ✅ Quick-start sessions working
- ✅ Game CRUD operations working

**Next Steps:**
1. Commit all changeset files to repository
2. Update source code with all fixes
3. Update nginx config template in package files
4. Add deployment verification tests
5. Update build scripts for ARM64 cross-compilation
6. Document production deployment checklist
