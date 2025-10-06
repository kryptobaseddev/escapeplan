---
"escapeplan-deployment": patch
---

**CRITICAL: Fix nginx stripping /api prefix causing all API endpoints to 404 (v0.1.7 emergency fix)**

## Problem
ALL API endpoints were returning 404 errors when accessed through nginx, even though they worked when accessing the API server directly. This affected:
- `/api/admin/settings` endpoints
- `/api/assets/list` endpoint
- ALL `/api/*` endpoints accessed from the browser

**Errors seen:**
```json
{"message":"Route GET:/assets/list not found","error":"Not Found","statusCode":404}
{"message":"Route GET:/admin/settings/business.game_duration_min_minutes not found","error":"Not Found","statusCode":404}
```

## Root Cause
The nginx reverse proxy configuration had a **trailing slash** in the `proxy_pass` directive:

```nginx
location /api/ {
    proxy_pass http://localhost:4000/;  # ← Trailing slash STRIPS /api prefix!
}
```

**How nginx works with trailing slashes:**
- **With trailing slash:** `proxy_pass http://localhost:4000/`
  - Request: `GET /api/assets/list`
  - nginx strips `/api/` from the path
  - Proxies to backend: `GET /assets/list`
  - Backend expects: `GET /api/assets/list`
  - **Result:** 404 Not Found

- **Without trailing slash:** `proxy_pass http://localhost:4000`
  - Request: `GET /api/assets/list`
  - nginx preserves full path
  - Proxies to backend: `GET /api/assets/list`
  - Backend expects: `GET /api/assets/list`
  - **Result:** ✓ Works

## Impact
**Severity:** CRITICAL - Blocked ALL browser-initiated API requests

**Affected Endpoints (all /api/* routes):**
- ❌ Dashboard: `/api/dashboard`
- ❌ Games: `/api/admin/games`, `/api/admin/games/:id`
- ❌ Settings: `/api/admin/settings`
- ❌ Assets: `/api/assets/list`, `/api/assets/:id`
- ❌ Sessions: `/api/sessions/quick-start`
- ❌ All authenticated endpoints
- ❌ Everything except `/health` and static files

**Why this wasn't caught earlier:**
- Direct API access worked: `curl http://localhost:4000/api/assets/list` ✓
- Only nginx proxy was broken: `curl http://localhost/api/assets/list` ✗
- Issue only manifested when web app called API through nginx (production setup)

## Emergency Fix Applied

**File:** `/etc/nginx/sites-available/escapeplan.conf`

```diff
server {
    listen 80 default_server;
    server_name escapeplan.local 10.10.10.1 _;

    # API backend
    location /api/ {
-       proxy_pass http://localhost:4000/;  # BAD: strips /api prefix
+       proxy_pass http://localhost:4000;   # GOOD: preserves /api prefix
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Web frontend
    location / {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**The change:** Remove trailing slash from `proxy_pass http://localhost:4000/` → `proxy_pass http://localhost:4000`

## Production Deployment

```bash
# Update nginx config
sudo tee /etc/nginx/sites-available/escapeplan.conf > /dev/null << 'EOF'
server {
    listen 80 default_server;
    server_name escapeplan.local 10.10.10.1 _;

    location /api/ {
        proxy_pass http://localhost:4000;  # No trailing slash!
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

```bash
# Test through nginx (should work now)
curl -b cookies.txt "http://localhost/api/dashboard"
curl -b cookies.txt "http://localhost/api/assets/list"
curl -b cookies.txt "http://localhost/api/admin/settings"

# All should return valid JSON, not 404
```

**Browser verification:**
1. Open browser DevTools → Network tab
2. Navigate to any app page (Dashboard, Games, Settings)
3. All API requests should return 200 OK
4. No 404 errors in console

## Technical Details: nginx proxy_pass Behavior

**Rule of thumb:**
- `proxy_pass http://backend/` (with `/`) = **URI replacement** - strips location prefix
- `proxy_pass http://backend` (no `/`) = **URI preservation** - keeps full path

**Examples:**

| nginx config | Request path | Proxied to backend |
|-------------|--------------|-------------------|
| `location /api/ { proxy_pass http://localhost:4000/; }` | `/api/users` | `/users` |
| `location /api/ { proxy_pass http://localhost:4000; }` | `/api/users` | `/api/users` |
| `location /api/ { proxy_pass http://localhost:4000/v1/; }` | `/api/users` | `/v1/users` |

## Why This Matters

Our Fastify API registers routes WITH the `/api` prefix:
```typescript
api.get('/dashboard', ...)        // Full path: /api/dashboard
api.get('/admin/settings', ...)   // Full path: /api/admin/settings
api.get('/assets/list', ...)      // Full path: /api/assets/list
```

nginx **must preserve** the `/api` prefix when proxying, otherwise paths don't match.

## Related Documentation

Include this nginx config template in:
- `files/etc/nginx/sites-available/escapeplan.conf` (package files)
- `scripts/postinst-orchestrator.sh` (auto-install nginx config)
- `docs/deployment.md` (nginx setup instructions)

## Testing Checklist
- [x] Dashboard loads without errors
- [x] Settings page loads
- [x] Assets browser works
- [x] Game creation works
- [x] Session quick-start works
- [x] No 404 errors in browser console
- [x] Direct API access still works (localhost:4000)
- [x] Proxied access works (localhost/api)

## Status
- **Fixed:** ✅ nginx config updated
- **Deployed:** ✅ Config reloaded on production device
- **Verified:** ✅ All API endpoints working
- **Source:** ⏳ Pending - add config to package files
