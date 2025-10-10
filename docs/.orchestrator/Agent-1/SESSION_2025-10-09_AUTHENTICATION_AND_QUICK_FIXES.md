# Session Summary: Authentication & Quick Bug Fixes - 2025-10-09

**Session Goal**: Quick bug fixes for MVP push - focus on getting features working, no breaking changes
**Status**: ✅ Fixed 3 bugs | ⚠️ Auth session issue identified but not fixed | 🔴 Additional issues not yet addressed
**Next Session**: Fix Better Auth session persistence OR implement dev-mode auth bypass

---

## What We Fixed This Session

### 1. ✅ Room Display 500 Error - RESOLVED
**Problem**: Browser showing 500 errors when loading room display (`/room/pirate-mutiny`)
**Root Cause**: Dev servers weren't running when user tested
**Fix**: Restarted both API (port 4000) and Web (port 5173) servers
**Files**: N/A (was an operational issue, not code)
**Status**: ✅ Room display now loads correctly with timer or idle state

---

### 2. ✅ Sessions Not Showing in "All Sessions" - RESOLVED
**File**: `apps/escapeplan-web/src/routes/(app)/games/+page.svelte` (displays sessions)
**API File**: `apps/escapeplan-api/src/index.ts:1184-1192` (endpoint handler)

**Problem**: When selecting "All sessions" in Game Runner, no completed sessions appeared
**Root Cause**: API endpoint wasn't passing the `status` filter to `listSessions()`

**Before (broken):**
```typescript
api.get('/sessions', async (request, reply) => {
  const auth = await ensureAuth(request, reply);
  if (!auth) return;
  const { status = 'active' } = request.query as { status?: 'active' | 'all' };
  if (status === 'active') {
    return { sessions: listActiveSessions() };
  }
  return { sessions: listSessions() };  // ❌ No filter passed!
});
```

**After (fixed):**
```typescript
api.get('/sessions', async (request, reply) => {
  const auth = await ensureAuth(request, reply);
  if (!auth) return;
  const { status = 'active' } = request.query as { status?: 'active' | 'all' };
  if (status === 'active') {
    return listActiveSessions();
  }
  return listSessions({ status });  // ✅ Filter passed
});
```

**Database Info**:
- 8 completed sessions exist in the database
- All have `status='completed'` and `timer_status='completed'`
- Now visible when "All sessions" is selected

**Status**: ✅ Complete

---

### 3. ✅ Restart Button Missing on Completed Games - RESOLVED
**File**: `apps/escapeplan-web/src/lib/components/sessions/SessionCard.svelte:292-334`

**Problem**: When a game was completed, both Reset and Stop buttons disappeared
**User Requirement**: "we should be able to see the 'restart' button on games when they have completely ended"

**Root Cause**: Both buttons wrapped in `{#if session.timer.status !== 'completed'}` condition

**Fix Applied**:
- ✅ Moved Reset/Restart button outside the condition (always visible)
- ✅ Added contextual labeling: "Restart game" for completed, "Reset timer" for active
- ✅ Kept Stop button inside condition (only shows for non-completed games)

**Button Visibility Matrix**:
```
┌─────────────┬───────┬───────┬────────┬──────────┬──────┐
│ Timer State │ Start │ Pause │ Resume │ Restart  │ Stop │
├─────────────┼───────┼───────┼────────┼──────────┼──────┤
│ idle        │  ✓    │       │        │    ✓     │  ✓   │
│ running     │       │  ✓    │        │    ✓     │  ✓   │
│ paused      │       │       │   ✓    │    ✓     │  ✓   │
│ completed   │       │       │        │    ✓     │      │
└─────────────┴───────┴───────┴────────┴──────────┴──────┘
```

**Where SessionCard is Used**:
- ✅ Dashboard (`/dashboard`) via `DashboardSessions.svelte`
- ✅ Game Runner list (`/games`)
- ✅ Game Runner details (`/games/[sessionId]`)

**Status**: ✅ Complete

---

## 🔴 CRITICAL ISSUE: Better Auth Session Persistence

### Problem
When clicking Restart button (or any timer command), getting:
```
POST http://localhost:5173/api/sessions/{sessionId}/commands 401 (Unauthorized)
ApiError: API request to /sessions/{sessionId}/commands failed with 401
```

### Root Cause Analysis

**API Side** (`apps/escapeplan-api/src/index.ts:189-228`):
```typescript
async function ensureAuth(request: FastifyRequest, reply: FastifyReply) {
  // 1. Try Better Auth session from cookies
  try {
    const session = await auth.api.getSession({
      headers: request.headers as any
    });
    if (session?.user && session?.session) {
      return { token: session.session.token, user: {...} };
    }
  } catch (error) {
    // Better Auth failed, continue...
  }

  // 2. Fallback to Bearer token (for tests/legacy)
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ statusCode: 401, message: 'Missing Authorization header' });
    return null;  // ❌ Returns 401 here
  }
  // ...
}
```

**Client Side** (`apps/escapeplan-web/src/lib/api/client.ts:29-47`):
```typescript
export async function apiFetch<T>(fetchImpl: FetchLike, path: string, options: ApiFetchOptions = {}): Promise<T> {
  const mergedHeaders = new Headers(headers ?? {});
  mergedHeaders.set('Accept', 'application/json');

  const response = await fetchImpl(`${apiBase}${normalizedPath}`, {
    credentials: credentials ?? 'include',  // ✅ Should send cookies
    ...rest,
    headers: mergedHeaders
  });
  // ...
}
```

**Frontend Call** (`apps/escapeplan-web/src/routes/(app)/games/+page.svelte:97-107`):
```typescript
async function dispatchTimerCommand(sessionId: string, command: ...) {
  try {
    await apiFetch<CommandResponse>(fetch, `/sessions/${sessionId}/commands`, {
      method: 'POST',
      body: JSON.stringify({ command, payload: {} })
    });
  } catch (error) {
    console.error('Timer command failed', error);
    setToast('Failed to update timer.', 'error');
  }
}
```

**What's Happening**:
1. Client makes POST request with `credentials: 'include'` ✅
2. Browser should send `better-auth.session_token` cookie ✅
3. API receives request but Better Auth session is invalid/expired ❌
4. API falls back to Bearer token check ❌
5. No Bearer token exists → Returns 401 ❌

### Why Session Might Be Invalid

**Server Restarts**:
- When we restarted dev servers multiple times, Better Auth sessions may have been invalidated
- Sessions are stored in SQLite database but have expiration times
- Hot reloading might break session continuity

**Database Table**: `session` (Better Auth v1.3+ uses singular table names)
- Schema: `id`, `user_id`, `token`, `created_at`, `updated_at`, `ip_address`, `user_agent`
- Better Auth manages expiration internally (not visible as a column)

### Current Workaround
**User must log out and back in** to get a fresh session:
1. Visit `/logout`
2. Visit `/login`
3. Log in with operator credentials
4. Fresh session cookie will be set
5. Timer commands will work

### Potential Solutions for Next Session

#### Option 1: Dev-Mode Auth Bypass (Quick Fix)
**Create hardcoded dev token** in environment config:

**File**: `apps/escapeplan-api/src/env.ts` (add):
```typescript
export const env = {
  // ... existing fields
  devAuthBypass: process.env.DEV_AUTH_BYPASS === 'true',
  devAuthUserId: process.env.DEV_AUTH_USER_ID || null
};
```

**File**: `.env.local` (create if not exists):
```bash
DEV_AUTH_BYPASS=true
DEV_AUTH_USER_ID=<insert-admin-user-id-from-database>
```

**File**: `apps/escapeplan-api/src/index.ts:189` (modify `ensureAuth`):
```typescript
async function ensureAuth(request: FastifyRequest, reply: FastifyReply) {
  // DEV ONLY: Bypass auth if enabled
  if (env.devAuthBypass && env.devAuthUserId) {
    const user = findOperatorById(env.devAuthUserId);
    if (user) {
      return {
        token: 'dev-bypass-token',
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          mustResetPassword: false
        }
      };
    }
  }

  // ... existing Better Auth and Bearer token logic
}
```

**Pros**:
- ✅ Fast to implement
- ✅ No login required during dev
- ✅ Works across server restarts

**Cons**:
- ❌ Dev-only (must remove for production)
- ❌ Bypasses security testing
- ❌ Could accidentally ship to production

---

#### Option 2: Fix Better Auth Session Persistence (Proper Fix)
**Investigate why sessions are invalidating:**

1. **Check Better Auth configuration** (`apps/escapeplan-api/src/auth.ts`):
   - Session duration settings
   - Cookie settings (secure, sameSite, httpOnly)
   - Database adapter configuration

2. **Verify session table schema**:
   ```bash
   sqlite3 apps/escapeplan-api/data/escapeplan.db ".schema session"
   ```

3. **Check for session cleanup on restart**:
   - Better Auth might be purging sessions on initialization
   - Look for migration/cleanup scripts

4. **Cookie domain/path issues**:
   - Ensure cookie is set for the right domain
   - Check if Vite proxy is stripping cookies

**Files to Check**:
- `apps/escapeplan-api/src/auth.ts` - Better Auth configuration
- `apps/escapeplan-api/src/db/client.ts` - Database adapter
- `packages/contracts/src/schema.ts` - Session table schema
- `apps/escapeplan-web/vite.config.ts` - Proxy configuration

**Pros**:
- ✅ Proper production-ready solution
- ✅ Tests the real auth flow
- ✅ No security shortcuts

**Cons**:
- ❌ More time to debug
- ❌ Might require Better Auth upgrade
- ❌ Could be complex (cookies, CORS, proxy issues)

---

#### Option 3: Client-Side Bearer Token Fallback
**Store auth token in localStorage** and send as Bearer token:

**On login success**, save token:
```typescript
// apps/escapeplan-web/src/routes/(auth)/login/+page.svelte
localStorage.setItem('auth_token', response.session.token);
```

**In API client**, check for token:
```typescript
// apps/escapeplan-web/src/lib/api/client.ts
export async function apiFetch<T>(...) {
  const mergedHeaders = new Headers(headers ?? {});

  // Add Bearer token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token && !mergedHeaders.has('Authorization')) {
    mergedHeaders.set('Authorization', `Bearer ${token}`);
  }

  // ... rest of function
}
```

**Pros**:
- ✅ Works across server restarts
- ✅ Fallback if cookies fail
- ✅ Standard pattern for SPAs

**Cons**:
- ❌ localStorage not as secure as httpOnly cookies
- ❌ XSS vulnerability if not careful
- ❌ Dual auth mechanism complexity

---

## Recommendation for Next Session

**Start with Option 1 (Dev-Mode Auth Bypass)** because:
1. ✅ Unblocks development immediately
2. ✅ Takes ~5 minutes to implement
3. ✅ User can continue testing other features
4. ✅ Can implement proper fix (Option 2) later

**Then investigate Option 2** for production readiness.

---

## File Locations Reference

### Authentication Files
```
apps/escapeplan-api/src/
├── auth.ts                          # Better Auth configuration
├── env.ts                           # Environment config (ADD DEV_AUTH_BYPASS here)
└── index.ts
    ├── Line 189-228: ensureAuth()   # MODIFY for dev bypass
    └── Line 1184-1192: /sessions    # Fixed in this session

apps/escapeplan-web/src/
├── hooks.server.ts                  # Server-side auth check
├── lib/api/
│   ├── client.ts                    # apiFetch() - sends credentials
│   └── server.ts                    # makeServerFetcher() - adds cookies
└── routes/(auth)/
    ├── login/+page.server.ts        # Login handler
    └── logout/+page.server.ts       # Logout handler
```

### Session Management Files
```
apps/escapeplan-api/src/
├── state/sessions/index.svelte.ts   # listSessions(), listActiveSessions()
└── index.ts:1184-1192               # GET /sessions endpoint (FIXED)

apps/escapeplan-web/src/
├── routes/(app)/games/
│   ├── +page.svelte                 # Game Runner UI
│   │   └── Line 97-107: dispatchTimerCommand() (FAILS with 401)
│   └── +page.server.ts              # Loads sessions data
└── lib/components/sessions/
    └── SessionCard.svelte           # Session card with timer controls
        └── Line 292-334: Timer buttons (FIXED)
```

### Database
```
apps/escapeplan-api/data/escapeplan.db
├── session (Better Auth sessions)   # Check for expired sessions
├── sessions (game sessions)         # 8 completed sessions exist
└── user (operators)                 # Get user ID for dev bypass
```

---

## Known Issues Still Pending

**User mentioned**: "we still have issues we are working on and some I have not told you about"

**Action Required**: At start of next session, ask user to list all remaining issues

**Suspected Issues**:
- Timer commands failing (401 Unauthorized) ⚠️ Identified but not fixed
- Possibly other features broken by server restarts
- Possibly issues with real-time updates (Socket.IO)
- Unknown issues user hasn't disclosed yet

---

## Testing Checklist (For Next Session)

### Before Starting New Work
1. **Start dev servers**:
   ```bash
   cd /mnt/projects/escape-plan/escapeplan-app
   pnpm run dev
   ```

2. **Verify TypeScript compilation**:
   ```bash
   pnpm --filter escapeplan-api lint    # Should be 0 errors
   pnpm --filter escapeplan-web check   # Should be 0 errors
   ```

3. **Check database**:
   ```bash
   cd apps/escapeplan-api
   sqlite3 data/escapeplan.db "SELECT COUNT(*) FROM sessions WHERE status='completed';"
   # Should return 8
   ```

4. **Test authentication**:
   - Visit http://localhost:5173/login
   - Log in with admin credentials
   - Verify session cookie is set in browser DevTools

### After Implementing Auth Fix
1. **Test timer commands**:
   - Visit http://localhost:5173/games
   - Select "All sessions"
   - Click Restart on a completed game
   - Should NOT get 401 error

2. **Test other authenticated endpoints**:
   - Dashboard (`/dashboard`)
   - Game runner details (`/games/[sessionId]`)
   - Quick start modal
   - Settings (`/admin/system`)

3. **Test across server restarts**:
   - Restart dev servers
   - Refresh browser
   - Timer commands should still work (if dev bypass is implemented)

---

## Commands Reference

### Development
```bash
cd /mnt/projects/escape-plan/escapeplan-app

# Start both servers
pnpm run dev

# Start individual servers
pnpm --filter escapeplan-api dev    # API on port 4000
pnpm --filter escapeplan-web dev    # Web on port 5173

# Kill servers
pkill -f "pnpm run dev"
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Type Checking
```bash
pnpm --filter escapeplan-api lint
pnpm --filter escapeplan-web check
```

### Database Queries
```bash
cd apps/escapeplan-api

# Count completed sessions
sqlite3 data/escapeplan.db "SELECT COUNT(*) FROM sessions WHERE status='completed';"

# Check Better Auth sessions
sqlite3 data/escapeplan.db "SELECT COUNT(*) FROM session;"

# Get admin user ID for dev bypass
sqlite3 data/escapeplan.db "SELECT id, username, role FROM user WHERE role='admin' LIMIT 1;"
```

### API Testing
```bash
# Test session endpoint (should return sessions)
curl -s http://localhost:4000/api/sessions?status=all -H "Cookie: better-auth.session_token=XXX" | jq '.sessions | length'

# Test timer command (currently fails with 401)
curl -X POST http://localhost:4000/api/sessions/{sessionId}/commands \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=XXX" \
  -d '{"command":"reset_timer","payload":{}}'
```

---

## Git Status

**Uncommitted Changes** (from this session):
```
modified:   apps/escapeplan-api/src/index.ts              (Line 1191: Fixed sessions endpoint)
modified:   apps/escapeplan-web/src/lib/components/sessions/SessionCard.svelte  (Lines 292-334: Fixed Restart button)
```

**Previous Uncommitted Changes** (from last session):
```
modified:   apps/escapeplan-api/src/index.ts              (Many fixes)
modified:   apps/escapeplan-api/src/state/games/index.svelte.ts  (getGameBySlug)
modified:   apps/escapeplan-api/src/state/index.ts        (exports)
modified:   apps/escapeplan-web/src/lib/components/CameraViewer.svelte
modified:   apps/escapeplan-web/src/lib/components/assets/AssetBrowser.svelte
modified:   apps/escapeplan-web/src/lib/components/assets/AssetUpload.svelte
modified:   apps/escapeplan-web/src/routes/(app)/admin/system/SettingsTab.svelte
modified:   apps/escapeplan-web/src/routes/(app)/admin/system/StorageTab.svelte
modified:   apps/escapeplan-web/src/routes/(public)/room/[slug]/+page.svelte
```

**Recommendation**: Commit these fixes before starting next session:
```bash
git add .
git commit -m "Fix: Sessions list endpoint, Restart button visibility, and room display

- Fix /api/sessions endpoint to pass status filter to listSessions()
- Show Restart button on completed games (SessionCard)
- Room display endpoint working (server restart fixed 500 errors)

Known issue: Better Auth session persistence causing 401 on timer commands
Next: Implement dev-mode auth bypass or fix session management"
```

---

## Session Statistics

**Duration**: ~2 hours
**Bugs Fixed**: 3 major bugs
**Bugs Identified**: 1 critical auth issue
**Files Modified**: 2
**Lines Changed**: ~40
**Server Restarts**: Multiple (caused auth session issue)

---

## Next Session Immediate Actions

### 1. Ask User for Full Issue List
```
User, what are all the issues you're experiencing right now?
Please include:
- Features not working
- Error messages you're seeing
- Workflows that are broken
- Anything mentioned but not yet fixed
```

### 2. Implement Dev Auth Bypass (5 minutes)
- Add `DEV_AUTH_BYPASS` to `env.ts`
- Create `.env.local` with admin user ID
- Modify `ensureAuth()` to check bypass flag
- Test timer commands work

### 3. Verify Previous Fixes Still Work
- Room display loads (`/room/pirate-mutiny`)
- Sessions list shows completed sessions
- Restart button visible on completed games

### 4. Continue Bug Fixing
- Work through user's full issue list
- Prioritize MVP-blocking issues
- Keep changes small and focused

---

## Key Context for Next Session

**User's Development Style**:
- ✅ Focus on quick fixes, not breaking changes
- ✅ MVP push - get features working first
- ✅ Pragmatic solutions over perfect architecture
- ⚠️ Multiple issues in parallel - track carefully

**Project State**:
- ✅ TypeScript compilation: 0 errors in both API and Web
- ✅ Database: 8 completed sessions exist
- ⚠️ Authentication: Sessions not persisting across server restarts
- ⚠️ Unknown issues: User has more to disclose

**Critical Files**:
- `apps/escapeplan-api/src/index.ts` - Main API routes, auth logic
- `apps/escapeplan-api/src/env.ts` - Add dev auth bypass here
- `apps/escapeplan-web/src/lib/components/sessions/SessionCard.svelte` - Session UI
- `apps/escapeplan-api/src/auth.ts` - Better Auth config

---

**END OF SESSION**

**Resume with**:
1. Ask user for full issue list
2. Implement dev auth bypass (Option 1 above)
3. Test timer commands work
4. Continue through remaining issues
