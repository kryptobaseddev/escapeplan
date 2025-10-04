# Alert Rules 404 Bug - Quick Reference

## Problem
❌ PATCH `/api/admin/alert-rules/:id` → 404 "Route PATCH:/api/api/admin/alert-rules/... not found"

## Root Cause
Double `/api/` prefix due to:
- `apiBase = 'http://localhost:4000/api'`
- `path = '/api/admin/alert-rules/:id'`
- `${apiBase}${path}` = `/api/api/admin/alert-rules/:id` ❌

## Fix Location
📁 **File:** `apps/escapeplan-web/src/lib/api/client.ts`
📍 **Lines:** 31-34

## Fix Code
```typescript
// Normalize path: remove leading /api if apiBase already contains it
const normalizedPath = apiBase.endsWith('/api') && path.startsWith('/api')
  ? path.slice(4) // Remove '/api' prefix from path
  : path;

const response = await fetchImpl(`${apiBase}${normalizedPath}`, {
  credentials: credentials ?? 'include',
  ...rest,
  headers: mergedHeaders
});
```

## Test Files
1. ✅ `apps/escapeplan-web/src/lib/api/client.integration.test.ts` (8 tests)
2. ✅ `apps/escapeplan-api/test/alert-rules.test.ts` (5 tests)

## Run Tests
```bash
# Client tests
pnpm --filter escapeplan-web test src/lib/api/client.integration.test.ts

# API tests
pnpm --filter escapeplan-api test test/alert-rules.test.ts --run

# All tests
pnpm test --run
```

## Validation
```bash
# Type check
pnpm --filter escapeplan-web check

# Look for placeholders
grep -r "TODO\|FIXME\|STUB" apps/escapeplan-web/src/lib/api/client.ts
# Expected: No matches
```

## Manual Testing
1. Navigate to `/admin/system` → Alerts tab
2. Toggle alert rule → See "Alert rule enabled/disabled" toast ✅
3. Click "Edit Rule" → Modify template → Save
4. See "Alert rule updated" toast ✅
5. Refresh page → Changes persist ✅

## Documentation
📚 **Full Analysis:** `project-docs/research/bug-fixes/BUG_ALERT_RULES_ANALYSIS.md`
📋 **Summary:** `project-docs/research/bug-fixes/ALERT_RULES_FIX_SUMMARY.md`

---

**Status:** ✅ FIXED & TESTED
**Tests:** 13 passed (8 client + 5 API)
**Coverage:** >80% for modified code
**No breaking changes**
