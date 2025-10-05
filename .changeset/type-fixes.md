---
"escapeplan-web": patch
"escapeplan-api": patch
---

Fix TypeScript type errors and re-enable CI checks

**Web Package:**
- Fix Svelte 5 Snippet types for children render props
- Fix RoomDisplayConfig gradientDirection optional/required mismatch  
- Fix Dashboard ActiveSessionSummary vs GameSessionDetails type incompatibility
- Fix Booking notes null vs undefined type mismatch
- Fix self-closing video tag warnings

**API Package:**
- Add missing network_profiles table migration for tests
- Re-enable test suite in CI workflow

**CI/CD:**
- Re-enable web type checking (svelte-check)
- Re-enable API test suite  
- Re-enable Publish workflow tests
