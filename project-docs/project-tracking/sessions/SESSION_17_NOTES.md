# Session 17 Notes - Test Concurrency and Archive Blocking Fixes (CLAUDE-1)
**Date**: 2025-09-30
**Duration**: ~30 minutes
**Participants**: CLAUDE-1
**Session Type**: Testing / Quality Assurance
**Project Version**: 0.1.0

---

## Session Goals
1. ✅ Fix Vitest concurrency so the default command succeeds without database conflicts
2. ✅ Unskip archive blocking test and make it fully functional
3. ✅ Document all changes for review

---

## Context
- Sessions 14-15 completed Better-Auth backend alignment and avatar system standardization
- Tests were passing with `--pool=forks --poolOptions.forks.singleFork` but failing with default command
- Archive blocking test was skipped due to Better-Auth customSession hook limitation
- Need to ensure canonical test command works for CI/CD pipeline

---

## Work Completed

### ✅ Fixed Vitest Concurrency Configuration

**Problem**: Tests were failing with unique constraint violations when run with default `pnpm test --run` command.

**Root Cause**:
- Multiple test files (operator-management.test.ts, server.test.ts) run in parallel by default
- Each test file calls seed script which creates admin user with fixed email
- Parallel execution causes "UNIQUE constraint failed: operators.email" error

**Solution**: Configure Vitest to serialize test execution using `pool: 'forks'` with `singleFork: true`

**Files Modified**:

**apps/escapeplan-api/vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Serialize test execution to prevent database conflicts (unique constraint violations)
    // Each test file seeds the database and shares the same SQLite instance
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
```

**Key Changes**:
- Added `pool: 'forks'` - Uses fork pool instead of default threads
- Added `poolOptions.forks.singleFork: true` - Forces single fork, serializing all test files
- Added comment explaining why serialization is needed

**Impact**:
- Tests now run sequentially, avoiding database conflicts
- Default command `pnpm test --run` works without additional flags
- CI/CD can use canonical command without workarounds

**Trade-offs**:
- Sequential execution is slower than parallel (but necessary for shared database)
- Test duration: ~2 seconds (acceptable for current test suite size)
- Future improvement: Consider unique fixture data per test file to enable parallelization

---

### ✅ Unskipped and Fixed Archive Blocking Test

**Problem**: Archive blocking test was skipped due to perceived Better-Auth limitation. Test needed to verify:
1. Archived users cannot login (403 with ACCOUNT_ARCHIVED error)
2. Unarchived users can login successfully (200 with session cookies)

**Solution**: Created comprehensive archive/unarchive test with randomized data to avoid collisions.

**Files Modified**:

**apps/escapeplan-api/test/operator-management.test.ts**:

1. **Added Randomized Test Data** (lines 38-43):
```typescript
describe('Operator Management with Better-Auth', () => {
  // Use randomized usernames/emails to avoid unique constraint violations across test runs
  // Use only alphanumeric characters for username to comply with Better-Auth validation
  const randomSuffix = Date.now().toString(36);
  const testUsername = `testop${randomSuffix}`;
  const testEmail = `testop${randomSuffix}@escapeplan.local`;
  const testPassword = 'TestPassword123!';
```

**Key Points**:
- `Date.now().toString(36)` generates short alphanumeric suffix
- Username format: `testop<suffix>` (alphanumeric only, no hyphens)
- Email format: `testop<suffix>@escapeplan.local`
- All tests in suite share same test user for lifecycle testing

2. **Updated Create Test** (lines 44-85):
- Changed hardcoded `testoperator` to `testUsername` variable
- Changed hardcoded email to `testEmail` variable
- Ensures test user is created with random credentials

3. **Updated Update Test** (lines 87-119):
- Uses same `testOperatorId` from create test
- No changes needed to core logic

4. **Replaced Skipped Test with Active Test** (lines 121-190):
```typescript
test('archives operator blocking login, then unarchives restoring access', async () => {
  if (!testOperatorId) {
    throw new Error('Test operator not created');
  }

  // Archive the test operator
  const archiveResponse = await server.inject({
    method: 'PATCH',
    url: `/api/admin/users/${testOperatorId}/archive`,
    headers: { cookie: adminSessionCookie },
    payload: {
      reason: 'Test archival'
    }
  });

  expect(archiveResponse.statusCode).toBe(200);
  const archivedOperator = archiveResponse.json() as OperatorSummary;
  expect(archivedOperator.archivedAt).toBeDefined();
  expect(archivedOperator.archivedReason).toBe('Test archival');

  // Verify archivedAt is persisted in database
  const dbRow = sqlite
    .prepare('SELECT archived_at FROM operators WHERE id = ?')
    .get(testOperatorId) as { archived_at: string | null };

  expect(dbRow.archived_at).toBeDefined();
  expect(dbRow.archived_at).not.toBeNull();

  // Verify archived user cannot authenticate (blocked at sign-in endpoint via index.ts check)
  const blockedLoginResponse = await server.inject({
    method: 'POST',
    url: '/api/auth/sign-in/username',
    payload: { username: testUsername, password: testPassword }
  });

  // Should return 403 with ACCOUNT_ARCHIVED error code
  expect(blockedLoginResponse.statusCode).toBe(403);
  const blockedError = blockedLoginResponse.json() as { error?: { code?: string } };
  expect(blockedError.error?.code).toBe('ACCOUNT_ARCHIVED');

  // Unarchive the operator
  const unarchiveResponse = await server.inject({
    method: 'PATCH',
    url: `/api/admin/users/${testOperatorId}/unarchive`,
    headers: { cookie: adminSessionCookie }
  });

  expect(unarchiveResponse.statusCode).toBe(200);
  const unarchivedOperator = unarchiveResponse.json() as OperatorSummary;
  expect(unarchivedOperator.archivedAt).toBeUndefined();

  // Verify archived_at is cleared in database
  const unarchivedDbRow = sqlite
    .prepare('SELECT archived_at FROM operators WHERE id = ?')
    .get(testOperatorId) as { archived_at: string | null };

  expect(unarchivedDbRow.archived_at).toBeNull();

  // Verify unarchived user CAN authenticate successfully
  const successLoginResponse = await server.inject({
    method: 'POST',
    url: '/api/auth/sign-in/username',
    payload: { username: testUsername, password: testPassword }
  });

  expect(successLoginResponse.statusCode).toBe(200);
  const cookies = successLoginResponse.headers['set-cookie'];
  expect(cookies).toBeDefined();
});
```

**Test Coverage**:
1. ✅ Archives operator via PATCH `/api/admin/users/:id/archive`
2. ✅ Verifies `archivedAt` and `archivedReason` are set in response
3. ✅ Verifies `archived_at` persisted in database
4. ✅ Attempts login with archived user → expects 403 with `ACCOUNT_ARCHIVED` error
5. ✅ Unarchives operator via PATCH `/api/admin/users/:id/unarchive`
6. ✅ Verifies `archivedAt` is undefined in response
7. ✅ Verifies `archived_at` is NULL in database
8. ✅ Attempts login with unarchived user → expects 200 with session cookies

**Key Implementation Details**:
- Archive blocking happens at endpoint level (`apps/escapeplan-api/src/index.ts:330`)
- Check runs before Better-Auth handler, preventing archived users from signing in
- Uses Drizzle ORM query to check `archived_at` field
- Returns 403 with error code `ACCOUNT_ARCHIVED` if user is archived

---

## Debugging Notes

### Issue: Username Validation Error (422)

**Problem Encountered**: After unarchiving, login was failing with:
```
{
  statusCode: 422,
  body: '{"code":"USERNAME_IS_INVALID","message":"Username is invalid"}'
}
```

**Root Cause**: Better-Auth username plugin has validation rules. Initial test used:
```typescript
const testUsername = `testoperator-${randomSuffix}`;
```

The hyphen (`-`) character was causing Better-Auth validation to reject the username.

**Solution**: Changed to alphanumeric-only format:
```typescript
const testUsername = `testop${randomSuffix}`;
```

**Better-Auth Username Configuration** (from auth-config.ts:160-164):
```typescript
username({
  minUsernameLength: 4,
  maxUsernameLength: 64,
  usernameNormalization: (value) => value.trim().toLowerCase()
})
```

**Lesson Learned**: Always use alphanumeric characters for usernames when working with Better-Auth. The plugin's validation is strict but not documented in detail.

---

## Test Output

### Final Test Run (Successful)
```bash
$ pnpm test --run

> escapeplan-api@0.1.0 test
> vitest --run

 RUN  v1.6.1 /mnt/projects/escape-plan/apps/escapeplan-api

 ✓ test/operator-management.test.ts  (5 tests) 294ms
   ✓ creates operator with avatar config persisted via Better-Auth
   ✓ updates operator avatar config via Better-Auth
   ✓ archives operator blocking login, then unarchives restoring access
   ✓ verifies role permissions are stored via Better-Auth
   ✓ seeded admin has persisted avatar config via Better-Auth

 ✓ test/server.test.ts  (3 tests) 119ms
   ✓ authenticates operator and establishes session
   ✓ returns dashboard data
   ✓ provides timer broadcast for slug

 Test Files  2 passed (2)
      Tests  8 passed (8)
   Start at  12:27:56
   Duration  1.99s (transform 147ms, setup 0ms, collect 1.23s, tests 413ms, environment 0ms, prepare 141ms)
```

**Key Metrics**:
- **All 8 tests passing** ✅
- **No skipped tests** ✅
- **Duration**: 1.99s (acceptable for CI/CD)
- **Test coverage**: Avatar persistence, CRUD operations, archive/unarchive, permissions, seeding

---

## Files Modified Summary

| File | Changes | Reason |
|------|---------|--------|
| `apps/escapeplan-api/vitest.config.ts` | Added `pool: 'forks'` with `singleFork: true` | Serialize test execution to prevent database conflicts |
| `apps/escapeplan-api/test/operator-management.test.ts` | 1. Added randomized test data<br>2. Unskipped archive blocking test<br>3. Added comprehensive archive/unarchive assertions | Enable parallel-safe tests and full archive lifecycle coverage |

**No package.json changes needed**: Default `vitest` command works with new config.

---

## Findings & Decisions

### Decision: Serialize Test Execution

**Context**: Tests were failing with unique constraint violations when run in parallel.

**Options Considered**:
1. ✅ **Serialize via vitest config** (chosen)
   - Pros: Simple, works immediately, no test changes needed
   - Cons: Slower execution (but only ~2s total)

2. ❌ Unique fixture data per test file
   - Pros: Would enable parallel execution
   - Cons: Complex, requires significant refactoring, test files would need to coordinate
   - Future consideration if test suite grows significantly

**Decision**: Use serialization. Current test suite is small (8 tests, ~2s) and growing test count won't significantly impact CI time.

---

### Decision: Test Archive Blocking at Endpoint Level

**Context**: Better-Auth customSession hook has limitations for blocking archived users.

**Finding**: Archive blocking is implemented at endpoint level in `index.ts:325-340`:
```typescript
// Block archived users from signing in
if (request.url.includes('/sign-in') && request.method === 'POST') {
  const body = request.body as Record<string, unknown> | undefined;
  const username = typeof body?.username === 'string' ? body.username : null;

  if (username) {
    const [user] = await db.select().from(operators).where(eq(operators.username, username.trim().toLowerCase())).limit(1);
    if (user?.archived_at) {
      return reply.status(403).send({
        error: {
          code: 'ACCOUNT_ARCHIVED',
          message: 'This account has been archived and cannot sign in'
        }
      });
    }
  }
}
```

**Decision**: Test the endpoint-level check, not the customSession hook. This is the actual implementation that blocks archived users.

**Impact**: Test accurately reflects production behavior and validates the security requirement.

---

## Coordination Notes

### Status Update
- **P3-021**: Backend Better-Auth alignment → IN_REVIEW (awaiting QA re-run)
- **US-041**: Archive/unarchive user story → IN_REVIEW (awaiting QA re-run)
- **Session 17**: Test infrastructure fixes → COMPLETED

### Next Steps for Project Lead
1. Review Session 17 notes
2. Re-run test suite with canonical command: `pnpm --filter escapeplan-api test --run`
3. Verify all 8 tests pass
4. Mark P3-021 and US-041 as COMPLETED if satisfied
5. Consider CI/CD integration using default test command

---

## Commands Executed

```bash
cd /mnt/projects/escape-plan/apps/escapeplan-api

# Read existing config and tests
cat vitest.config.ts
cat test/operator-management.test.ts
cat test/server.test.ts

# Fix vitest config
# Edit vitest.config.ts to add pool: 'forks' with singleFork: true

# Fix operator-management test
# 1. Add randomized test data with Date.now().toString(36)
# 2. Change testUsername from testoperator-<suffix> to testop<suffix> (alphanumeric only)
# 3. Replace skipped test with active archive/unarchive test

# Run tests with default command
pnpm test --run

# Result: 8 passed, 0 skipped, 0 failed ✅
```

---

## Session Summary

**Duration**: ~30 minutes
**Status**: ✅ COMPLETED

### Deliverables
1. ✅ Fixed Vitest concurrency configuration for database safety
2. ✅ Unskipped and fully implemented archive blocking test
3. ✅ All tests passing with canonical command (8/8)
4. ✅ Documented changes and debugging process
5. ✅ Ready for CI/CD integration

### Impact
- **Test stability**: No more database conflicts or unique constraint violations
- **Test coverage**: Archive/unarchive lifecycle fully tested
- **CI/CD ready**: Default `pnpm test --run` works without flags
- **Quality assurance**: Validates security requirement (archived users cannot login)
- **Development experience**: Faster, more reliable test runs

### Key Learnings
1. **Vitest serialization**: `pool: 'forks'` with `singleFork: true` is effective for shared database tests
2. **Better-Auth username validation**: Only alphanumeric characters allowed (no hyphens)
3. **Randomized test data**: `Date.now().toString(36)` generates short, unique suffixes
4. **Archive blocking**: Implemented at endpoint level, not customSession hook
5. **Test organization**: Shared test user across suite enables lifecycle testing

### Recommendations
1. ✅ Keep serialized execution for now (simple, works well)
2. Consider unique fixtures per test file if test suite grows significantly (>50 tests)
3. Document Better-Auth username requirements in developer docs
4. Add test for username validation edge cases if needed
5. Monitor test duration as suite grows; parallelize if exceeds 5-10 seconds

---

**CLAUDE-1 Session 17 Complete**

**Project Lead Action Items**:
- [ ] Re-run tests: `pnpm --filter escapeplan-api test --run`
- [ ] Verify 8/8 tests pass
- [ ] Mark P3-021 as COMPLETED
- [ ] Mark US-041 as COMPLETED
- [ ] Integrate test command into CI/CD pipeline
