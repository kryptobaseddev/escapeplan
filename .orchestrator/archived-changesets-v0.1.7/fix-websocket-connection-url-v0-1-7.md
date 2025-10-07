---
"escapeplan-web": patch
---

**Fix WebSocket connection URL for relative API paths (v0.1.7 emergency fix)**

## Problem
The room display page and real-time features (timer updates, hints, media playback) were not working in production because the WebSocket connection failed to establish.

**Symptoms:**
- Room display shows "Room display unavailable" error
- Timer doesn't update in real-time
- Hints don't appear on room display
- No real-time updates on dashboard

## Root Cause
The `resolveBaseUrl()` function in `socket.ts` didn't handle relative API paths correctly.

When `apiBase` was changed to `/api` (relative path for browser requests), the socket URL resolution logic broke:

```typescript
// Before fix:
const base = '/api';
if (base.endsWith('/api')) {
  return base.slice(0, -4);  // Returns empty string "" instead of "/"!
}
```

**Issue:**
- `/api`.slice(0, -4) = empty string
- Socket.IO tried to connect to `` (empty), failing silently
- No WebSocket connection = no real-time updates

## Emergency Fix Applied

**File:** `apps/escapeplan-web/src/lib/realtime/socket.ts`

```diff
function resolveBaseUrl(): string {
  if (dev) {
    return 'http://localhost:4000';
  }

- // In production, strip /api from apiBase to get the base URL
  const base = apiBase.replace(/\/$/, '');
+
+ // If apiBase is just '/api' (relative path), socket connects to root
+ if (base === '/api') {
+   return browser ? window.location.origin : '/';
+ }
+
+ // Otherwise strip /api from absolute URLs
  if (base.endsWith('/api')) {
    return base.slice(0, -4);
  }
  return base;
}
```

**Logic:**
- If `apiBase` is `/api` (relative path in browser)
  - Return `window.location.origin` (e.g., `http://escapeplan.local`)
  - Socket.IO connects to `http://escapeplan.local` → goes through nginx to API on port 4000
- If `apiBase` is absolute URL like `http://localhost:4000/api` (SSR)
  - Strip `/api` to get `http://localhost:4000`
  - Direct connection to API server

## Production Deployment

```bash
# Rebuild with fix
cd apps/escapeplan-web
pnpm build

# Deploy
sudo systemctl stop escapeplan-web
sudo rm -rf /opt/escapeplan/web/.svelte-kit/output
sudo cp -r .svelte-kit/output /opt/escapeplan/web/.svelte-kit/
sudo chown -R escapeplan:escapeplan /opt/escapeplan/web/.svelte-kit
sudo systemctl start escapeplan-web
```

## Verification

**Room Display Test:**
1. Create a session for Pirate Mutiny game
2. Navigate to room display: `http://escapeplan.local/room/pirate-mutiny`
3. **Expected:** Timer displays and updates in real-time
4. **Expected:** Hints appear when sent from game runner
5. **Expected:** Browser console shows: `[Socket.IO] Connected to http://escapeplan.local`

**Dashboard Real-time Test:**
1. Open dashboard on one device
2. Start a session from another device
3. **Expected:** Dashboard updates immediately with new active session
4. **Expected:** Timer counts down in real-time

**Browser Console Verification:**
```javascript
// Should see in console:
[Socket.IO] Connected to http://escapeplan.local
```

## Important Note: Room URL

The correct room display URL for Pirate Mutiny is:
```
http://escapeplan.local/room/pirate-mutiny
```

**NOT:**
- `http://escapeplan.local/room/pirate-mutany` ❌ (typo: "mutany" vs "mutiny")
- `http://localhost:3000/room/pirate-mutiny` ❌ (development URL)

## Impact
- **Severity:** CRITICAL - Blocked all real-time features
- **Affected Features:**
  - Room display timer updates
  - Hint delivery to room displays
  - Media playback on room displays
  - Dashboard real-time session updates
  - Real-time booking updates
  - WebSocket-based communication
- **Affected Versions:** v0.1.7 (after API client fix, before this fix)
- **Production Status:** Fixed and deployed

## Testing Checklist
- [x] Room display connects to WebSocket
- [x] Timer updates in real-time on room display
- [x] Dashboard shows real-time session updates
- [x] Browser console shows successful Socket.IO connection
- [x] No connection errors in logs
- [x] SSR (server-side) still works correctly

## Related Fixes
This fix completes the production API communication stack:
1. API client fix (relative path for HTTP requests)
2. WebSocket fix (correct URL for Socket.IO connection)

Both were needed to restore full functionality in production with nginx reverse proxy.
