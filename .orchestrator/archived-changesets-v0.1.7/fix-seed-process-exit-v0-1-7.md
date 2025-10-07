---
"escapeplan-api": patch
---

**CRITICAL: Fix seed script process.exit() blocking server startup (v0.1.7 emergency fix)**

## Problem
The `seedSystemSettings()` function includes a CLI entry point that calls `process.exit(0)` after seeding. When the code is bundled by tsup into a single `index.js` file, the `import.meta.url` check always evaluates to true, causing the server to exit immediately after seeding instead of starting the Fastify server. This resulted in a boot loop on production devices.

## Root Cause
```typescript
// src/db/seed-settings.ts (lines 256-266)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSystemSettings()
    .then(() => {
      console.log('[Seed] Done!');
      process.exit(0);  // ← KILLS THE SERVER
    })
}
```

When bundled, this check incorrectly evaluates to `true` during normal server startup.

## Emergency Fix (Applied in Production)
**File:** `/opt/escapeplan/api/index.js` (bundled production file)
**Action:** Deleted lines 3194-3202 (the entire CLI entry point block)

```bash
# Applied on device:
sudo sed -i '3194,3202d' /opt/escapeplan/api/index.js
sudo systemctl restart escapeplan-api
```

## Proper Source Code Fix
Remove the auto-seed call from server startup since seeding is already handled by postinst:

```typescript
// src/index.ts (around line 2091)
if (!skipAutostart && !isTestEnv) {
  (async () => {
    const server = await buildServer();
    try {
      // REMOVE THIS LINE - seed is run during package installation
      // await seedSystemSettings();

      await initializeSettings();
      await server.listen({ port: DEFAULT_PORT, host: '0.0.0.0' });
      // ...
    }
  })();
}
```

## Alternative Fix Options
1. **Fix the CLI check** to work correctly with bundled code:
   ```typescript
   const isMainModule = process.argv[1]?.endsWith('seed-settings.js') ||
                        process.argv[1]?.includes('db:seed');
   ```

2. **Separate CLI logic** into dedicated file:
   - Move CLI entry point to `src/db/seeds/cli.ts`
   - Keep `seedSystemSettings()` as pure function export
   - Update package.json script: `"db:seed": "tsx src/db/seeds/cli.ts"`

## Files Modified
- **Production:** `/opt/escapeplan/api/index.js` (direct edit to fix boot loop)
- **Source (pending):** `apps/escapeplan-api/src/index.ts`
- **Source (pending):** `apps/escapeplan-api/src/db/seed-settings.ts`

## Testing
- ✅ API service starts successfully after fix
- ✅ Database seeding still works via postinst script
- ✅ No boot loops on Pi after reboot
- ✅ Settings initialization completes normally

## Impact
- **Severity:** CRITICAL - Prevented server startup entirely
- **Affected Versions:** v0.1.6, v0.1.7 (before this fix)
- **Production Status:** Fixed on device, source code changes pending
