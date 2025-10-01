# QA Testing Plan - EscapePlan Authentication & Operator Management

**Created:** 2025-09-30
**Session:** 20
**Status:** READY FOR EXECUTION

## Testing Scope

This plan covers comprehensive validation of:
- **US-041:** Backend Better-Auth alignment (P3-021) - CLAUDE-1
- **US-042:** Admin console Better-Auth integration (P3-022) - CLAUDE-2
- **US-035:** Archive inactive operators (P3-013)
- **US-011:** Secure authentication and RBAC (P3-004)

## Test Environment Setup

### Prerequisites
- [ ] API server running: `cd apps/escapeplan-api && pnpm dev` (port 4000)
- [ ] Web app running: `cd apps/escapeplan-web && pnpm dev` (port 5173)
- [ ] Fresh database seeded: `cd apps/escapeplan-api && pnpm db:seed`
- [ ] Browser with network inspector open (for cookie validation)

### Default Test Credentials
```
Admin User:
  Username: admin
  Password: escapeplan
```

---

## Test Suite 1: Backend Authentication (US-041)

**Priority:** CRITICAL
**Estimated Time:** 20 minutes
**Status:** ✅ Automated tests passing (16/16)

### 1.1 Avatar JSON Persistence
**Acceptance:** avatar_config stored as structured JSON matching DiceBear Bottts

- [ ] **Test 1.1.1:** Create operator with avatar via API
  - Open terminal, run:
    ```bash
    curl -X POST http://localhost:4000/api/admin/users \
      -H "Cookie: better-auth.session_token=<SESSION_COOKIE>" \
      -H "Content-Type: application/json" \
      -d '{
        "username": "testuser1",
        "name": "Test User",
        "password": "TestPassword123!",
        "role": "game_master",
        "avatarConfig": {
          "seed": "testuser1",
          "eyes": ["happy"],
          "mouth": ["smile01"]
        }
      }'
    ```
  - **Expected:** 200 OK, response includes `avatarConfig` object
  - **Verify in DB:**
    ```bash
    sqlite3 apps/escapeplan-api/data/escapeplan.db \
      "SELECT avatar_config FROM operators WHERE username='testuser1';"
    ```
  - **Expected:** JSON string with seed, eyes, mouth fields

- [ ] **Test 1.1.2:** Update operator avatar via API
  - Update the user created above with new avatar
  - **Expected:** Stored avatar_config changes, API returns updated config

### 1.2 Better-Auth Adapter Integration
**Acceptance:** APIs use Better-Auth adapters exclusively, no direct SQL

- [ ] **Test 1.2.1:** Review code for adapter usage
  - Check `apps/escapeplan-api/src/state.ts:createOperatorAccount`
  - **Expected:** Uses `adapter.createUser()`, no direct `db.insert(operators)`

- [ ] **Test 1.2.2:** Session creation via Better-Auth
  - Login via UI or API
  - **Expected:** Session cookie `better-auth.session_token` set
  - Check DB: `SELECT * FROM operator_auth_sessions LIMIT 1;`
  - **Expected:** Session record with token, user_id, expires_at

### 1.3 Archive Flow & Session Revocation
**Acceptance:** Archive invalidates all sessions, blocks login

- [ ] **Test 1.3.1:** Multi-session invalidation
  - Login as test user from 2 different browsers
  - Archive the user via admin panel
  - **Expected:** Both sessions invalidated (401 on protected routes)

- [ ] **Test 1.3.2:** Archived user cannot login
  - Attempt login with archived user credentials
  - **Expected:** 403 with error code `ACCOUNT_ARCHIVED`

- [ ] **Test 1.3.3:** Unarchive restores access
  - Unarchive the user
  - Login with same credentials
  - **Expected:** 200 OK, new session created

---

## Test Suite 2: Admin Console Integration (US-042)

**Priority:** HIGH
**Estimated Time:** 30 minutes
**Status:** 🟡 Needs Manual QA

### 2.1 Operator Profile Persistence
**Acceptance:** Editing user shows persisted avatar/role data without reseeding

- [ ] **Test 2.1.1:** Create operator via UI with avatar
  1. Login to admin console (http://localhost:5173/login)
  2. Navigate to Admin → Users
  3. Click "+ Add User" button
  4. Fill form:
     - Username: `qatest1`
     - Name: `QA Test User`
     - Email: (leave blank to test optional email)
     - Password: `QAPassword123!`
     - Role: `game_master`
     - Bio: `Testing avatar persistence`
  5. Click "Customize Avatar" → Randomize a few times → Save
  6. Submit form

  **Expected Results:**
  - ✅ Success message appears
  - ✅ User appears in list with custom avatar
  - ✅ Avatar image matches the one you selected

- [ ] **Test 2.1.2:** Edit operator and verify persisted avatar
  1. Click on `qatest1` user card to edit
  2. **Expected:** Modal opens showing:
     - ✅ Avatar matches what you saved
     - ✅ Bio shows "Testing avatar persistence"
     - ✅ Email field is empty (optional email working)
  3. Change name to `QA Test User Updated`
  4. Save
  5. **Expected:** Name updates, avatar unchanged

- [ ] **Test 2.1.3:** Randomize avatar and verify update
  1. Edit `qatest1` again
  2. Click "Randomize Avatar" 3 times to get new avatar
  3. Save
  4. Refresh page
  5. **Expected:** New avatar persists after refresh

### 2.2 Email Optional Validation (SESSION_20)
**Acceptance:** Email field truly optional, accepts blank or valid email

- [ ] **Test 2.2.1:** Create user without email
  1. Add new user: `qatest2`
  2. Leave email field completely blank
  3. Fill other required fields
  4. **Expected:** ✅ Form accepts, user created successfully

- [ ] **Test 2.2.2:** Create user with valid email
  1. Add new user: `qatest3`
  2. Email: `qatest3@escapeplan.local`
  3. **Expected:** ✅ Email saved correctly

- [ ] **Test 2.2.3:** Edit user to remove email
  1. Edit `qatest3`
  2. Clear the email field (delete all text)
  3. Save
  4. **Expected:** ✅ Email removed, user updated

- [ ] **Test 2.2.4:** Edit user to add email
  1. Edit `qatest2` (the one without email)
  2. Add email: `qatest2@escapeplan.local`
  3. Save
  4. **Expected:** ✅ Email added successfully

- [ ] **Test 2.2.5:** Duplicate email validation
  1. Try to create new user with email `qatest2@escapeplan.local`
  2. **Expected:** ❌ Error: "Email already exists"

- [ ] **Test 2.2.6:** Invalid email format
  1. Try to create user with email: `not-an-email`
  2. **Expected:** ❌ Validation error: "Invalid email format"

### 2.3 Archive Workflow UI
**Acceptance:** Archive/unarchive via UI, confirmation dialogs work

- [ ] **Test 2.3.1:** Archive operator via UI
  1. Click action menu (⋮) on `qatest1` card
  2. Click "Archive"
  3. **Expected:** Confirmation modal appears
  4. Enter reason: "No longer with company"
  5. Confirm
  6. **Expected:**
     - ✅ User shows "Archived" badge
     - ✅ User grayed out or hidden (depends on "Show archived" toggle)

- [ ] **Test 2.3.2:** Archived user login blocked
  1. Open incognito/private window
  2. Try to login as `qatest1` with password `QAPassword123!`
  3. **Expected:** ❌ Error: "This account has been archived and cannot sign in"

- [ ] **Test 2.3.3:** Unarchive restores access
  1. Back in admin console, enable "Show archived" toggle
  2. Find `qatest1`, click action menu → "Unarchive"
  3. **Expected:** "Archived" badge removed
  4. In incognito window, login as `qatest1`
  5. **Expected:** ✅ Login succeeds

---

## Test Suite 3: Role-Based Access Control (US-011)

**Priority:** CRITICAL
**Estimated Time:** 25 minutes

### 3.1 Role Permission Boundaries
**Acceptance:** RBAC guards protect admin settings across roles

- [ ] **Test 3.1.1:** Admin can access all panels
  1. Login as `admin`
  2. Navigate to each admin section:
     - ✅ Admin → Users (accessible)
     - ✅ Admin → Games (accessible)
     - ✅ Admin → Network (accessible)
  3. **Expected:** All accessible

- [ ] **Test 3.1.2:** Game Master limited access
  1. Create game_master user: `qatest_gm`
  2. Logout admin, login as `qatest_gm`
  3. Try to access:
     - Admin → Users
     - Admin → Network
  4. **Expected:** ❌ Redirected or 403 error (only game masters can't manage users/network)

- [ ] **Test 3.1.3:** Manager can manage users but not network
  1. Create manager user: `qatest_mgr` with role=`manager`
  2. Login as `qatest_mgr`
  3. **Expected:**
     - ✅ Can access Admin → Users
     - ❌ Cannot access Admin → Network

### 3.2 Session Security
**Acceptance:** Session cookies expire appropriately with secure flags

- [ ] **Test 3.2.1:** Session cookie attributes
  1. Login as any user
  2. Open browser DevTools → Application/Storage → Cookies
  3. Find cookie: `better-auth.session_token`
  4. **Expected attributes:**
     - ✅ `HttpOnly: true` (prevents XSS access)
     - ✅ `SameSite: Lax` or `Strict`
     - ✅ `Path: /`
     - ⚠️ `Secure: false` (expected in dev, should be true in production)

- [ ] **Test 3.2.2:** Session expiration
  1. Check cookie expiration time (should be future date)
  2. **Expected:** Expires in ~7 days (Better-Auth default)

---

## Test Suite 4: Profile Self-Service (US-011)

**Priority:** HIGH
**Estimated Time:** 15 minutes

### 4.1 Self-Service Profile Editing
**Acceptance:** Operators can update own profile (name, email, bio, avatar)

- [ ] **Test 4.1.1:** Update own profile
  1. Login as `qatest1`
  2. Navigate to Account → Profile
  3. Update:
     - Name: `QA Updated Name`
     - Bio: `Updated bio text`
     - Email: `qa.updated@escapeplan.local`
  4. Save
  5. **Expected:** ✅ Success message, changes persist after refresh

- [ ] **Test 4.1.2:** Change own avatar
  1. Still logged in as `qatest1`
  2. In profile page, click "Customize Avatar"
  3. Randomize to get new avatar
  4. Save
  5. **Expected:** ✅ Avatar updates in header/nav

- [ ] **Test 4.1.3:** Self-service limitations
  1. Still as `qatest1` (game_master)
  2. Check profile page
  3. **Expected:**
     - ❌ Cannot change own role
     - ❌ Cannot change own permissions
     - ❌ Cannot archive own account

---

## Test Suite 5: Security Hardening (SESSION_19)

**Priority:** CRITICAL
**Estimated Time:** 15 minutes
**Status:** ✅ Automated tests passing (5/5)

### 5.1 Last Admin Protection
**Acceptance:** Cannot archive final active admin

- [ ] **Test 5.1.1:** Try to archive last admin
  1. Verify only one admin exists: `admin`
  2. Try to archive `admin` user
  3. **Expected:** ❌ Error: "Cannot archive the final active admin"

- [ ] **Test 5.1.2:** Can archive admin when multiple exist
  1. Create second admin: `admin2`
  2. Archive `admin` user
  3. **Expected:** ✅ Archive succeeds (admin2 still active)

### 5.2 Password Management
**Acceptance:** Password reset works, must_reset_password flag clears on change

- [ ] **Test 5.2.1:** Admin resets user password
  1. As admin, go to Users
  2. Edit `qatest1`, click "Reset Password"
  3. Set new password: `NewPassword123!`
  4. Enable "Force password reset on next login"
  5. Save
  6. **Expected:** ✅ Password reset successful

- [ ] **Test 5.2.2:** User must reset password on login
  1. Logout, login as `qatest1` with `NewPassword123!`
  2. **Expected:** UI shows "must reset password" message

- [ ] **Test 5.2.3:** Password change clears flag
  1. Navigate to Account → Security
  2. Change password to `FinalPassword123!`
  3. Logout and login again
  4. **Expected:** ✅ No "must reset" message, normal access

---

## Summary Checklist

### Automated Tests Status
- [x] Security hardening suite (5/5 tests)
- [x] Operator management suite (5/5 tests)
- [x] Server endpoints (3/3 tests)
- [x] Email validation suite (3/3 tests)
- **Total: 16/16 passing**

### Manual QA Status (To be completed)
- [ ] Suite 1: Backend Authentication (8 tests)
- [ ] Suite 2: Admin Console Integration (15 tests)
- [ ] Suite 3: Role-Based Access Control (6 tests)
- [ ] Suite 4: Profile Self-Service (3 tests)
- [ ] Suite 5: Security Hardening (3 tests)
- **Total: 35 manual tests**

---

## Test Execution Notes

**Instructions for tester:**
1. Start from Suite 1 and work sequentially
2. Check each box `[ ]` as you complete tests
3. Note any failures or unexpected behavior inline
4. Take screenshots for visual confirmation tests
5. After completion, update user story statuses in USER_STORIES.json

**Failure Protocol:**
- Mark failed test with ❌
- Document actual vs expected behavior
- Screenshot error messages
- Log to SESSION_20_NOTES.md under "QA Findings" section

**Success Criteria:**
- All 35 manual tests pass
- No regression in automated test suite
- US-041 status → COMPLETED
- US-042 status → COMPLETED
