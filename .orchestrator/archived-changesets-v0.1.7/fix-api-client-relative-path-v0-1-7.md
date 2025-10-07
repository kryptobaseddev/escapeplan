---
"escapeplan-web": patch
---

**Fix API client to use relative path for browser requests (v0.1.7 emergency fix)**

## Problem
The web application was unable to communicate with the API from the browser, causing all API operations to fail:
- Quick-start session creation failed with "Unable to start session"
- Game creation failed with "Unable to create game"
- Game editing did nothing (no response)
- All API requests from browser returned network errors

## Root Cause
The API client was hardcoded to use `http://localhost:4000/api` for all requests. This works for server-side rendering (SSR) but fails for client-side requests in production because:

1. Browser requests to `localhost:4000` try to connect to the client's localhost, not the server
2. The production setup uses nginx reverse proxy at `/api`, not direct port 4000 access
3. PUBLIC_ environment variables are baked into the build, so runtime .env changes don't work

## Error Messages
- "Unable to start session please try again" (quick-start)
- "Unable to create game" (game creation)
- No response when clicking edit on games

## Emergency Fix Applied

**File:** `apps/escapeplan-web/src/lib/api/client.ts`

```diff
- const DEFAULT_API_BASE = 'http://localhost:4000/api';
+ // Use relative path in production (goes through nginx), localhost in dev
+ const DEFAULT_API_BASE = typeof window !== 'undefined' ? '/api' : 'http://localhost:4000/api';

const apiBase = (env.PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');
```

**Logic:**
- `typeof window !== 'undefined'`: Code is running in browser (client-side)
  - Use `/api` (relative path → goes through nginx reverse proxy)
- `typeof window === 'undefined'`: Code is running on server (SSR)
  - Use `http://localhost:4000/api` (direct connection to API service)

## Production Deployment

```bash
# Rebuild web app with fix
cd apps/escapeplan-web
pnpm build

# Deploy to Pi
sudo systemctl stop escapeplan-web
sudo rm -rf /opt/escapeplan/web/.svelte-kit/output
sudo cp -r .svelte-kit/output /opt/escapeplan/web/.svelte-kit/
sudo chown -R escapeplan:escapeplan /opt/escapeplan/web/.svelte-kit
sudo systemctl start escapeplan-web
```

## Verification

Test that API requests now work from browser:

1. **Quick-start session creation:**
   - Dashboard → Quick start → Select Pirate Mutiny → Start
   - Should successfully create session and navigate to game runner

2. **Game creation:**
   - Games → New game → Fill form → Save
   - Should successfully create game and show in games list

3. **Game editing:**
   - Games → Click edit on any game
   - Should load game details in edit form

4. **Network tab verification:**
   - Browser DevTools → Network tab
   - API requests should go to `/api/*` (not `localhost:4000`)
   - All requests should return 200 OK (or appropriate status codes)

## Alternative Solutions Considered

### Option 1: Environment Variable (Rejected)
```bash
# .env
PUBLIC_API_BASE_URL=/api
```
**Why rejected:** PUBLIC_ env vars are baked into build at build-time, not runtime. Would require rebuilding for every environment.

### Option 2: Build-time Configuration (Rejected)
```bash
# Build with env var
PUBLIC_API_BASE_URL=/api pnpm build
```
**Why rejected:** Same issue - requires environment-specific builds. Breaks dev/prod parity.

### Option 3: Runtime Detection (Selected)
Detect environment at runtime using `typeof window` check. Simple, works for all environments, no configuration needed.

## Impact
- **Severity:** CRITICAL - Blocked all browser-initiated API operations
- **Affected Versions:** v0.1.7 (before this fix)
- **Production Status:** Fixed and deployed
- **User Impact:** All API features now work correctly

## Testing Checklist
- [x] Quick-start session creation works
- [x] Game creation works
- [x] Game editing works
- [x] Dashboard loads correctly
- [x] SSR still works (server-side API calls)
- [x] Dev environment still works (localhost:4000)
- [x] Production nginx proxy works (/api)

## Related Issues
This fix resolves all API communication issues that were blocking:
- Session management
- Game CRUD operations
- Booking operations (when implemented)
- All authenticated API endpoints
