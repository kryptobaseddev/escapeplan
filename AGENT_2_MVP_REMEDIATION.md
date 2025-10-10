# Agent-2 MVP Remediation Instructions

**Date:** 2025-10-09
**Target Agent:** Agent-2 (Code Remediation Specialist)
**Mission:** Final pre-launch verification and optional enhancements

---

## CRITICAL: NO MVP BLOCKERS EXIST ✅

After comprehensive analysis by 5 specialized subagents and build verification:

**STATUS: ✅ PRODUCTION READY - NO BLOCKING ISSUES**

All previously identified critical issues were resolved in the frontend audit (see `FRONTEND_AUDIT_REPORT.md`). The application builds successfully, core features work, and hostname configuration is correct.

---

## Tech Stack Reference (2025)

### Backend Stack
- **Fastify 5.x** - API server (port 4000)
- **Better Auth v1.3.24+** - Authentication with Drizzle adapter
- **Drizzle ORM** - Type-safe SQLite operations (NO migrations, push-only)
- **Zod** - Runtime validation schemas
- **Socket.IO** - Real-time WebSocket server
- **SQLite with WAL mode** - Offline-first database

### Frontend Stack
- **SvelteKit 2.x** - SSR framework with adapter-node
- **Svelte 5.37.0** - **RUNES MODE** (`$state`, `$derived`, `$effect`, `$props`)
- **Tailwind CSS 4** + DaisyUI - UI framework
- **Workbox** - PWA service worker (auto-update enabled)
- **Socket.IO Client** - Real-time event subscriptions

---

## Svelte 5 Runes Patterns (REQUIRED)

### ✅ Correct Patterns (Use These)

#### 1. Reactive State
```svelte
<script>
  // ✅ CORRECT: Use $state for reactive variables
  let count = $state(0);
  let user = $state({ name: 'John', age: 30 });

  // ✅ For deep reactivity, mutate properties directly
  function increment() {
    count++;  // Triggers reactivity
    user.age++;  // Also triggers reactivity
  }

  // ❌ WRONG: Destructuring breaks reactivity
  // let { name, age } = user;  // Don't do this!
</script>

<button onclick={() => count++}>{count}</button>
```

#### 2. Derived/Computed Values
```svelte
<script>
  let count = $state(0);

  // ✅ CORRECT: Use $derived for computed values
  let doubled = $derived(count * 2);
  let isEven = $derived(count % 2 === 0);

  // ❌ WRONG: Don't use $: reactive statements
  // $: doubled = count * 2;  // This is Svelte 4 syntax!
</script>
```

#### 3. Component Props
```svelte
<script>
  // ✅ CORRECT: Use $props() for component props
  let { data, form } = $props();

  // With defaults
  let { count = 0, message = 'hello' } = $props();

  // ❌ WRONG: export let is Svelte 4 syntax
  // export let data;
</script>
```

#### 4. Side Effects
```svelte
<script>
  let count = $state(0);

  // ✅ CORRECT: Use $effect for side effects
  $effect(() => {
    console.log('Count changed:', count);

    // Cleanup function (optional)
    return () => {
      console.log('Cleanup before next run');
    };
  });

  // ❌ WRONG: Don't use onMount for reactive side effects
  // onMount(() => { ... });  // Only for non-reactive init
</script>
```

#### 5. Two-Way Binding
```svelte
<script>
  // ✅ CORRECT: Use $bindable for parent-child binding
  let { value = $bindable('') } = $props();
</script>

<input bind:value />
```

### ❌ Forbidden Patterns (DON'T USE)

```svelte
<script>
  // ❌ NO $: reactive statements (Svelte 4 syntax)
  // $: doubled = count * 2;

  // ❌ NO export let (Svelte 4 syntax)
  // export let data;

  // ❌ NO on:click (Svelte 4 syntax)
  // <button on:click={handler}>

  // ✅ Use onclick instead
  // <button onclick={handler}>
</script>
```

---

## Hostname Configuration ✅ VERIFIED CORRECT

### Production Environment
- **Access URLs:** `https://escapeplan.local` OR `http://10.10.10.1:3000`
- **API Base:** `/api` (relative path, proxied by nginx)
- **WebSocket:** Auto-detects from current hostname
- **No hardcoded localhost** in production code paths

### How It Works
```typescript
// API auto-detects production (apps/escapeplan-api/src/env.ts:68-69)
if (runtime.isProduction) {
  return `https://${PRODUCTION_DOMAIN}`;  // https://escapeplan.local
}

// Web uses relative paths (apps/escapeplan-web/src/lib/env.ts:33)
if (!dev) {
  return API_BASE_PATH;  // '/api' - works with ANY hostname
}
```

**Verified:** Works with both `escapeplan.local` and `10.10.10.1` ✅

---

## Required Actions: NONE ❌

**There are NO blocking issues to fix before MVP launch.**

All critical functionality is working:
- ✅ Authentication & RBAC
- ✅ Game management (CRUD)
- ✅ Session management with timer
- ✅ Real-time WebSocket updates
- ✅ Booking calendar (read operations)
- ✅ Hint delivery system
- ✅ Dashboard monitoring
- ✅ PWA offline support

---

## Optional Enhancements (NOT REQUIRED FOR MVP)

These can be implemented post-launch if needed:

### 1. Security Hardening (Post-MVP)
**Priority:** Medium
**Impact:** Defense-in-depth

```bash
# Add rate limiting to auth endpoints
pnpm add @fastify/rate-limit

# Add security headers
pnpm add @fastify/helmet

# Add CSRF protection
pnpm add @fastify/csrf-protection
```

**Implementation:**
```typescript
// apps/escapeplan-api/src/index.ts
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';

await app.register(rateLimit, {
  max: 5,
  timeWindow: '5 minutes',
  routes: ['/api/auth/login']
});

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Required for Tailwind
      connectSrc: ["'self'", "wss://escapeplan.local"]
    }
  }
});
```

### 2. Fix Deprecation Warning (Low Priority)
**File:** `apps/escapeplan-web/svelte.config.js:30`

```javascript
// ❌ Current (deprecated)
csrf: {
  checkOrigin: true
}

// ✅ New syntax
csrf: {
  trustedOrigins: [
    'https://escapeplan.local',
    'http://10.10.10.1:3000'
  ]
}
```

### 3. Fix Test Environment (Development Only)
**Issue:** 8 integration tests fail due to missing `BETTER_AUTH_SECRET`

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      BETTER_AUTH_SECRET: 'test-secret-min-32-chars-long-for-testing-only'
    }
  }
});
```

### 4. Camera Streaming Implementation (If Needed)
**Current State:** Endpoints return `{ cameras: [] }` (stubbed)
**Location:** `apps/escapeplan-api/src/index.ts:1180`

**Only implement if camera viewing is required for MVP:**
1. Wire up camera CRUD operations
2. Configure FFmpeg transcoding service
3. Implement HLS streaming endpoints
4. Test RTSP → HLS pipeline

**Estimated Effort:** 12-16 hours

---

## Development Workflow Reminders

### Making Changes

1. **Schema Changes:**
   ```bash
   # Edit schema
   vim packages/contracts/src/schema.ts

   # Rebuild contracts (REQUIRED before API/web can import)
   pnpm --filter @escapeplan/contracts build

   # Apply to database (NO migrations, push only)
   cd apps/escapeplan-api && npx drizzle-kit push
   ```

2. **API Changes:**
   ```bash
   # Edit state management
   vim apps/escapeplan-api/src/state/*.svelte.ts

   # Edit routes
   vim apps/escapeplan-api/src/index.ts

   # Test
   pnpm --filter escapeplan-api test
   ```

3. **Frontend Changes:**
   ```bash
   # Edit components (use Svelte 5 runes!)
   vim apps/escapeplan-web/src/lib/components/*.svelte

   # Edit routes
   vim apps/escapeplan-web/src/routes/**/*.svelte

   # Type-check
   pnpm --filter escapeplan-web check
   ```

### Testing Real-time Flow
```bash
# Terminal 1: API
pnpm --filter escapeplan-api dev

# Terminal 2: Web
pnpm --filter escapeplan-web dev

# Browser: Check WebSocket in console
# Should see: [ENV] Client environment: { apiBaseUrl: 'http://localhost:4000/api' }
# Should see: Socket.IO connection logs
```

---

## Important Constraints ⚠️

### Database Operations
- ✅ **ALWAYS use Drizzle ORM** - Never raw SQL queries
- ✅ **NO migrations** - Use `drizzle-kit push` only
- ✅ Reference `@API_CONTRACTS_SCHEMA_MANAGEMENT.md` for schema changes
- ✅ Reference `@DATABASE_SYSTEM.md` for database operations

### Authentication
- ✅ Never bypass permission checks
- ✅ Use `requirePermission()` helper functions
- ✅ Session cookies only (no localStorage)
- ✅ HttpOnly cookies required for security

### Svelte 5 Patterns
- ✅ **MUST use runes mode** - No Svelte 4 syntax
- ✅ Enable runes: `<svelte:options runes={true} />`
- ✅ Use `$state`, `$derived`, `$effect`, `$props`
- ✅ Never use `$:` reactive statements
- ✅ Never use `export let` for props
- ✅ Never use `on:click` - use `onclick`

### Offline-First
- ✅ All features must work without internet
- ✅ WebSocket reconnection must be automatic
- ✅ Commands queued when offline, replayed on reconnect

---

## Final Verification Checklist

Before ANY code changes:
- [ ] Read this entire document
- [ ] Verify Svelte 5 runes patterns
- [ ] Check Drizzle ORM usage (no raw SQL)
- [ ] Test builds: `pnpm build`
- [ ] Run type checks: `pnpm lint`
- [ ] Test WebSocket reconnection
- [ ] Verify hostname works with both `escapeplan.local` and `10.10.10.1`

---

## Context7 Documentation References

When implementing features, use these library docs:

```bash
# Svelte 5 (latest patterns)
/sveltejs/svelte/svelte@5.37.0

# Fastify (API patterns)
/fastify/fastify

# Drizzle ORM (database)
/drizzle-team/drizzle-orm

# Better Auth (authentication)
/better-auth/better-auth
```

**Example Query:**
```typescript
// When stuck on Svelte 5 reactivity:
// Ask Context7: "How to use $state with objects in Svelte 5.37"

// When stuck on Drizzle:
// Ask Context7: "How to do SQLite transactions with Drizzle ORM"
```

---

## Summary for Agent-2

### What You Need to Know:
1. **NO MVP BLOCKERS** - Application is production-ready
2. **Hostname config is correct** - Works with `escapeplan.local` and `10.10.10.1`
3. **Use Svelte 5 runes** - No Svelte 4 syntax allowed
4. **Use Drizzle ORM** - No raw SQL queries
5. **All critical issues were already fixed** - See `FRONTEND_AUDIT_REPORT.md`

### What You Should Do:
1. ✅ Review this document thoroughly
2. ✅ Understand the tech stack (Svelte 5 runes especially)
3. ✅ Only implement optional enhancements if specifically requested
4. ✅ **DO NOT break existing functionality**
5. ✅ Use Context7 for up-to-date documentation (your knowledge is from Jan 2025)

### What You Should NOT Do:
1. ❌ Do NOT create new "fixes" for non-existent problems
2. ❌ Do NOT use Svelte 4 patterns (`$:`, `export let`, `on:click`)
3. ❌ Do NOT write raw SQL queries (use Drizzle)
4. ❌ Do NOT change hostname detection logic (it's correct)
5. ❌ Do NOT add dependencies without explicit approval

---

**Mission Status:** ✅ COMPLETE - MVP APPROVED FOR LAUNCH

If you have questions, reference:
- `CLAUDE.md` - Project overview and commands
- `FRONTEND_AUDIT_REPORT.md` - What was already fixed
- `MVP_PRODUCTION_STATUS.md` - Current production status
- `@API_CONTRACTS_SCHEMA_MANAGEMENT.md` - Schema change procedures
- `@DATABASE_SYSTEM.md` - Database operations guide

**Last Updated:** 2025-10-09
**Next Review:** Post-launch (30 days)
