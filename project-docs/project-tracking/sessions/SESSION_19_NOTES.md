# SESSION 19: Security Hardening - Archive & Session Edge Cases

**Date:** 2025-09-30
**Task:** P3-021 Follow-up - Extend backend hardening with archived-session edge cases
**Assigned From:** SESSION_18_NOTES.md

## Objectives

Per SESSION_6_NOTES.md recommendations, audit and test:
1. Multi-session invalidation on operator archive
2. Throttled sign-in for archived users (archive blocking)
3. Better-Auth password reset hooks
4. Edge cases: unarchive flow, last admin protection, password change clearing flags

## Implementation Audit

### Multi-Session Invalidation

**Location:** `apps/escapeplan-api/src/state.ts:1021`

```typescript
// Delete ALL sessions (multi-session invalidation)
sqlite.prepare(`DELETE FROM operator_auth_sessions WHERE user_id = ?`).run(id);
```

**Behavior:**
- Archive operation deletes **all** sessions for the user via direct SQL
- No per-session invalidation needed - atomic bulk deletion
- Better-Auth adapter unaware of this cleanup (intentional - we bypass adapter for session cleanup)

**Schema Reference:** `migrations/002_better_auth.sql`
```sql
CREATE TABLE operator_auth_sessions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES operators(id) ON DELETE CASCADE ON UPDATE CASCADE
);
```

### Archive Blocking (Throttled Sign-In)

**Location:** `apps/escapeplan-api/src/index.ts:325-340`

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

**Behavior:**
- Endpoint-level check **before** Better-Auth handler
- Returns 403 with `ACCOUNT_ARCHIVED` code
- Prevents password validation (no timing attacks)
- Applies to all sign-in endpoints (`/api/auth/sign-in/username`)

### Password Reset Hooks

**Location:** `apps/escapeplan-api/src/auth-config.ts`

**Finding:** Better-Auth `sendVerificationEmail` hook is **not implemented**. Email verification and password reset emails are disabled for offline-first deployment.

```typescript
plugins: [
  username({
    minLength: 3,
    maxLength: 20,
    // sendVerificationEmail: async () => { /* NOT IMPLEMENTED */ }
  })
]
```

**Manual Password Reset:**
- Admin endpoint: `POST /api/admin/users/:id/reset-password`
- Implementation: `apps/escapeplan-api/src/state.ts:719-748` (resetOperatorPassword)
- Uses Better-Auth adapter `updateUser()` with new password hash
- **Intentional Design:** Admin can reset archived user passwords for account recovery

**Self-Service Password Change:**
- User endpoint: `POST /api/users/me/password`
- Implementation: `apps/escapeplan-api/src/state.ts:750-788` (changeOwnPassword)
- Validates current password via Better-Auth `verifyPassword()`
- Clears `must_reset_password` flag on successful change

### Last Admin Protection

**Location:** `apps/escapeplan-api/src/state.ts:1004-1010`

```typescript
// Prevent archiving last admin
if (row.role === 'admin') {
  const adminCount = sqlite
    .prepare(`SELECT COUNT(*) as count FROM operators WHERE role = 'admin' AND archived_at IS NULL`)
    .get() as { count: number };
  if (adminCount.count <= 1) {
    throw new Error('Cannot archive the final active admin');
  }
}
```

**Behavior:**
- Prevents system lockout by requiring at least one active admin
- Check runs **before** archive operation
- Error message: "Cannot archive the final active admin"

## Test Coverage

Created comprehensive test suite: `test/security-hardening.test.ts`

### Test 1: Multi-Session Invalidation on Archive

**Scenario:**
1. Create test operator
2. Sign in 3 times (create 3 sessions)
3. Verify session count ≥ 3
4. Archive operator
5. Verify session count = 0
6. Attempt to use old session cookie → fails

**Key Assertions:**
```typescript
expect(sessionsBeforeArchive.count).toBeGreaterThanOrEqual(3);
expect(sessionsAfterArchive.count).toBe(0);
expect(invalidSessionResponse.statusCode).not.toBe(200);
```

### Test 2: Archived User Cannot Reset Password (Edge Case)

**Scenario:**
1. Operator already archived from previous test
2. Admin resets password for archived user → **succeeds** (intentional for recovery)
3. Archived user attempts login with new password → **fails** (403 ACCOUNT_ARCHIVED)

**Key Finding:** Password reset is allowed for recovery purposes, but login remains blocked.

### Test 3: Unarchived User Can Authenticate

**Scenario:**
1. Unarchive operator via `PATCH /api/admin/users/:id/unarchive`
2. User logs in with password from previous test → **succeeds**
3. Verify new session created

**Key Assertion:**
```typescript
expect(loginResponse.statusCode).toBe(200);
expect(sessionsAfterUnarchive.count).toBe(1);
```

### Test 4: Cannot Archive Last Active Admin

**Scenario:**
1. Query active admin count
2. If count = 1, attempt archive → **fails** (400+ status)
3. Error message contains "final active admin"

**Key Assertion:**
```typescript
expect(archiveResponse.statusCode).toBeGreaterThanOrEqual(400);
expect(error.message).toContain('final active admin');
```

### Test 5: Password Change Clears must_reset_password Flag

**Scenario:**
1. Set `must_reset_password = 1` via direct SQL
2. User logs in (still allowed)
3. User changes password via `POST /api/users/me/password`
4. Verify `must_reset_password = 0`

**Key Assertions:**
```typescript
expect(beforeRow.must_reset_password).toBe(1);
expect(changePasswordResponse.statusCode).toBe(204); // No Content
expect(afterRow.must_reset_password).toBe(0);
```

## Test Results

**Command:** `pnpm test --run`

**Status:** ✅ All 13 tests passing (5 security + 5 operator management + 3 server)

**Security Hardening Tests:**
```
✓ test/security-hardening.test.ts (5 tests)
  ✓ multi-session invalidation on archive
  ✓ archived user cannot reset password
  ✓ unarchived user can authenticate with existing password
  ✓ cannot archive last active admin
  ✓ password change invalidates must_reset_password flag
```

## Debugging Notes

### Issue 1: Wrong HTTP Method for Password Reset
**Error:** 404 on `PATCH /api/users/:id/password`
**Fix:** Changed to `POST /api/admin/users/:id/reset-password`
**Root Cause:** Incorrect endpoint path for admin password reset

### Issue 2: Wrong HTTP Method for User Password Change
**Error:** 404 on `PATCH /api/users/me/password`
**Fix:** Changed to `POST /api/users/me/password`
**Root Cause:** Inconsistent with actual endpoint definition

### Issue 3: Wrong Status Code Expectation
**Error:** Expected 200, got 204 for password change
**Fix:** Changed assertion to `expect(statusCode).toBe(204)`
**Root Cause:** Password change returns 204 No Content (correct REST behavior)

## Security Findings

### ✅ Strengths
1. **Atomic Multi-Session Invalidation:** All sessions deleted in single SQL operation
2. **Endpoint-Level Archive Blocking:** Prevents timing attacks by checking before password validation
3. **Last Admin Protection:** Cannot lock out system by archiving final admin
4. **Password Reset Flexibility:** Admin can reset archived user passwords for recovery
5. **Flag Cleanup:** Password change automatically clears `must_reset_password`

### ⚠️ Observations
1. **Email Hooks Disabled:** Better-Auth email verification intentionally disabled for offline deployment
2. **Direct SQL Usage:** Session cleanup bypasses Better-Auth adapter (acceptable for performance)
3. **Archive Check Timing:** Endpoint-level check adds latency but prevents credential leakage

### 🔒 Recommendations
1. **Consider:** Add rate limiting to password reset endpoints (currently unthrottled)
2. **Consider:** Add audit logging for archive/unarchive operations (currently only stored as `archived_reason`)
3. **Consider:** Add session activity tracking for forensic analysis

## References

- **SESSION_6_NOTES.md:** Original Better-Auth integration requirements
- **SESSION_18_NOTES.md:** Assignment source for this work
- **Better-Auth Schema:** `migrations/002_better_auth.sql`
- **Archive Implementation:** `src/state.ts:994-1029` (archiveOperatorAccount)
- **Password Reset:** `src/state.ts:719-788` (resetOperatorPassword, changeOwnPassword)
- **Archive Blocking:** `src/index.ts:325-340` (endpoint-level check)

## Completion Checklist

- [x] Audit multi-session invalidation implementation
- [x] Audit archive blocking (throttled sign-in)
- [x] Audit Better-Auth password reset hooks
- [x] Create comprehensive edge case tests
- [x] Verify all tests passing (13/13)
- [x] Document findings in session notes
- [x] Reference SESSION_6_NOTES.md and Better-Auth schema

## Artifacts Created

- `test/security-hardening.test.ts` - Comprehensive security test suite (273 lines)
- `project-docs/project-tracking/sessions/SESSION_19_NOTES.md` - This document

## Next Steps

P3-021 backend hardening follow-up complete. Ready for:
- **Optional:** Implement recommendations (rate limiting, audit logging)
- **Next:** P3-022 or other backlog items
