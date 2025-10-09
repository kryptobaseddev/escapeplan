# Handoff: SvelteKit Adapter-Node and CSRF Configuration

**Agent:** Agent 4 (App Layer)
**Date:** 2025-10-07
**Status:** ✅ COMPLETE - Ready for Agent 3 Handoff
**Related:** SVELTEKIT_DEPLOYMENT_STRATEGY_REPORT.md

---

## Mission Accomplished

Switched SvelteKit from `adapter-auto` to `adapter-node` with explicit configuration and set up CSRF protection using forwarded headers for reverse proxy deployment.

**Scope:** App layer ONLY (no nginx/OS changes)

---

## Changes Completed by Agent 4

### 1. Package Installation ✅

**File:** `apps/escapeplan-web/package.json`

```json
"@sveltejs/adapter-node": "^5.3.3"
```

**Command:**
```bash
cd apps/escapeplan-web && pnpm add -D @sveltejs/adapter-node
```

### 2. SvelteKit Configuration ✅

**File:** `apps/escapeplan-web/svelte.config.js`

**Changes:**
- Switched from `@sveltejs/adapter-auto` to `@sveltejs/adapter-node`
- Configured adapter with:
  - `out: 'build'` - Explicit build directory
  - `precompress: true` - Generate .gz and .br files for nginx
  - `envPrefix: ''` - Standard environment variable names
- Added explicit CSRF configuration: `csrf.checkOrigin: true`

**Key Lines:**
```javascript
import adapter from '@sveltejs/adapter-node';  // Line 1

kit: {
  adapter: adapter({
    out: 'build',
    precompress: true,
    envPrefix: ''
  }),
  csrf: {
    checkOrigin: true
  }
}
```

### 3. Environment Configuration ✅

**File:** `build/deb/etc/escapeplan/web.env.example`

**Changes:**
- Removed: `ORIGIN=http://localhost:3000`
- Added: `PROTOCOL_HEADER=x-forwarded-proto`
- Added: `HOST_HEADER=x-forwarded-host`
- Added: `PUBLIC_API_BASE_URL=/api`
- Added: `PUBLIC_SOCKET_URL=`
- Added: Comprehensive documentation for all variables

**Key Variables:**
```bash
# CSRF Protection (forwarded headers)
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host

# Public variables (sent to browser)
PUBLIC_API_BASE_URL=/api
PUBLIC_SOCKET_URL=

# Server-only variables
API_URL=http://localhost:4000
```

### 4. Startup Script ✅

**File:** `apps/escapeplan-web/systemd/start.sh`

**Changes:**
- Removed: `export ORIGIN=${ORIGIN:-http://localhost:${PORT}}`
- Added: `export PROTOCOL_HEADER=${PROTOCOL_HEADER:-x-forwarded-proto}`
- Added: `export HOST_HEADER=${HOST_HEADER:-x-forwarded-host}`
- Added: `export PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL:-/api}`
- Added: `export API_URL=${API_URL:-http://localhost:4000}`
- Changed: `exec node "${APP_DIR}/server.js"` → `exec node build/index.js`

**Critical Change:**
```bash
# OLD (adapter-auto):
exec node "${APP_DIR}/server.js"

# NEW (adapter-node):
exec node build/index.js
```

### 5. Build Verification ✅

**Command:** `pnpm build`

**Results:**
- ✅ Build succeeded (no errors)
- ✅ `build/index.js` created (9.4K)
- ✅ Pre-compressed files generated:
  - `.gz` files (gzip)
  - `.br` files (brotli)

**Build Output:**
```
✓ 822 modules transformed
✓ built in 9.76s (client)
✓ built in 16.31s (server)

> Using @sveltejs/adapter-node
  ✔ done
```

---

## HANDOFF TO AGENT 3 (OS/nginx Layer)

### Required nginx Configuration

Agent 3 must configure nginx to forward the required headers for CSRF protection to work.

#### nginx Configuration Required

**File:** `/etc/nginx/sites-available/escapeplan-web` (or equivalent)

**Required Headers:**
```nginx
server {
    listen 443 ssl;
    server_name escapeplan.local 10.10.10.1;

    ssl_certificate /etc/ssl/certs/escapeplan.crt;
    ssl_certificate_key /etc/ssl/private/escapeplan.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # REQUIRED: Forward headers for SvelteKit CSRF protection
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # WebSocket support (for Socket.IO)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;

        # REQUIRED: Forward headers for API requests
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### Optional: Enable Pre-compressed Assets

Since adapter-node generates `.gz` and `.br` files, nginx can serve them directly:

```nginx
server {
    # ... other config ...

    # Serve pre-compressed gzip files if available
    gzip_static on;

    # Serve pre-compressed brotli files if available (requires ngx_brotli module)
    # brotli_static on;
}
```

**Benefits:**
- Reduces CPU usage on Raspberry Pi (compression done at build time)
- Faster response times
- Better resource utilization

#### Firewall Configuration Required

**Ensure port 3000 is firewalled:**
```bash
# Only nginx should access port 3000
sudo ufw deny 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

**Why:** Prevents bypassing nginx and setting malicious `X-Forwarded-*` headers directly.

#### SSL Certificate Requirements

**Certificate must include both access methods:**
```bash
# Subject Alternative Names (SANs)
DNS:escapeplan.local
IP:10.10.10.1
```

**Example certificate generation:**
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/escapeplan.key \
  -out /etc/ssl/certs/escapeplan.crt \
  -subj "/CN=escapeplan.local" \
  -addext "subjectAltName=DNS:escapeplan.local,IP:10.10.10.1"
```

---

## Testing Requirements (Agent 3)

After nginx configuration, Agent 3 must verify:

### 1. Test Header Forwarding
```bash
# Test that nginx forwards headers correctly
curl -I https://escapeplan.local
# Should show X-Forwarded-Proto: https in SvelteKit logs
```

### 2. Test CSRF Protection Works
- Access `https://escapeplan.local/login` in browser
- Submit login form
- **Should NOT see:** "Cross-site POST form submissions are forbidden"
- **Should see:** Normal form processing

### 3. Test Multiple Access Methods
```bash
# Test mDNS hostname
curl -I https://escapeplan.local
# Should return 200 OK

# Test IP address
curl -I https://10.10.10.1
# Should return 200 OK
```

### 4. Test Pre-compressed Assets (Optional)
```bash
# Check if nginx serves .gz files
curl -I -H "Accept-Encoding: gzip" https://escapeplan.local/_app/immutable/chunks/index.js
# Should show: Content-Encoding: gzip
```

### 5. Verify Service Startup
```bash
sudo systemctl restart escapeplan-web
sudo systemctl status escapeplan-web
# Should show: Active: active (running)

sudo journalctl -u escapeplan-web -n 50
# Should NOT show CSRF errors or header-related errors
```

---

## Architecture Overview

### CSRF Protection Strategy

**Problem:**
- Users access EscapePlan via multiple URLs:
  - mDNS: `https://escapeplan.local`
  - IP: `https://10.10.10.1`
- SvelteKit CSRF protection needs to validate `Origin` header
- Behind reverse proxy, SvelteKit doesn't know the public-facing URL

**Solution:**
- nginx forwards `X-Forwarded-Proto` and `X-Forwarded-Host` headers
- SvelteKit reads these headers to determine origin
- CSRF validation works for ANY hostname/IP user accesses

**Security:**
- Port 3000 firewalled (only nginx can access)
- Only nginx can set `X-Forwarded-*` headers
- SvelteKit validates `Origin` matches forwarded headers
- CSRF protection remains enabled (`checkOrigin: true`)

### Build Output Change

**adapter-auto (OLD):**
```
.svelte-kit/output/
├── server/
│   └── index.js
└── server.js  ← Entry point
```

**adapter-node (NEW):**
```
build/
├── index.js      ← Entry point (CHANGED)
├── handler.js
├── env.js
├── client/       ← Static assets
└── server/       ← Server-side code
```

**Critical:** Start script must use `build/index.js`, not `server.js`

---

## Files Modified (Agent 4)

### Modified Files:
- `apps/escapeplan-web/package.json` - Added adapter-node dependency
- `apps/escapeplan-web/svelte.config.js` - Switched to adapter-node
- `apps/escapeplan-web/systemd/start.sh` - Updated environment & executable
- `build/deb/etc/escapeplan/web.env.example` - New environment template

### Files NOT Modified:
- ❌ No nginx configuration files
- ❌ No systemd service files
- ❌ No route or component files
- ❌ No vite.config.ts

---

## Verification Checklist (Agent 4 Complete)

- ✅ adapter-node package installed (v5.3.3)
- ✅ svelte.config.js uses adapter-node
- ✅ svelte.config.js has `precompress: true`
- ✅ svelte.config.js has `csrf.checkOrigin: true`
- ✅ web.env.example has `PROTOCOL_HEADER` and `HOST_HEADER`
- ✅ web.env.example has `PUBLIC_API_BASE_URL` documented
- ✅ start.sh exports `PROTOCOL_HEADER` and `HOST_HEADER`
- ✅ start.sh uses `build/index.js` (not `server.js`)
- ✅ `pnpm build` succeeds
- ✅ `build/index.js` exists
- ✅ Pre-compressed .gz and .br files generated
- ✅ No nginx files modified

---

## Deployment Checklist (Agent 3 TODO)

- [ ] Update nginx configuration with forwarded headers
- [ ] Add `X-Forwarded-Proto` and `X-Forwarded-Host` headers
- [ ] Add WebSocket upgrade headers (if not already present)
- [ ] Enable `gzip_static on` (optional, for pre-compressed assets)
- [ ] Verify SSL certificate includes both mDNS and IP as SANs
- [ ] Ensure port 3000 is firewalled (internal only)
- [ ] Test nginx configuration: `sudo nginx -t`
- [ ] Reload nginx: `sudo systemctl reload nginx`
- [ ] Restart web service: `sudo systemctl restart escapeplan-web`
- [ ] Verify service status: `sudo systemctl status escapeplan-web`
- [ ] Test mDNS access: `https://escapeplan.local`
- [ ] Test IP access: `https://10.10.10.1`
- [ ] Submit test form (verify no CSRF errors)
- [ ] Check browser console (verify `PUBLIC_API_BASE_URL` accessible)
- [ ] Check service logs: `sudo journalctl -u escapeplan-web -n 50`

---

## Known Issues / Warnings

### Deprecation Warning (Non-Blocking)
```
`config.kit.csrf.checkOrigin` has been deprecated in favour of `csrf.trustedOrigins`
```

**Status:** ⚠️ Warning only, build succeeds
**Impact:** None for current deployment
**Future Action:** Update to use `csrf.trustedOrigins` in future SvelteKit version

### CSS Warning (Non-Blocking)
```
Unknown at rule: @property
```

**Status:** ⚠️ Warning from DaisyUI CSS
**Impact:** None (CSS works correctly)
**Action:** None required

---

## References

- **Deployment Strategy Report:** `/SVELTEKIT_DEPLOYMENT_STRATEGY_REPORT.md`
- **SvelteKit adapter-node Docs:** https://github.com/sveltejs/kit/tree/main/packages/adapter-node
- **SvelteKit CSRF Docs:** https://svelte.dev/docs/kit/configuration#csrf
- **nginx Reverse Proxy Docs:** https://nginx.org/en/docs/http/ngx_http_proxy_module.html

---

## Agent 3 Contact Points

If Agent 3 needs clarification on:
- **CSRF configuration:** See deployment strategy report section 3
- **Forwarded headers:** See deployment strategy report section 3
- **nginx configuration:** See "Required nginx Configuration" above
- **Testing:** See "Testing Requirements" above

---

**Status:** ✅ READY FOR AGENT 3 HANDOFF
**Next Agent:** Agent 3 (OS/nginx Layer)
**Blocking:** None - Agent 3 can proceed immediately
