# Migration Strategy - Operators to Users

**Research Date:** 2025-10-02
**Migration Goal:** Align with Better Auth v1.3.24+ best practices
**Database:** SQLite with Drizzle ORM
**Estimated Effort:** 13-20 hours
**Risk Level:** Medium (schema rename + breaking changes)

---

## Executive Summary

**Migration Approach:** Phased, low-risk, reversible

**Phase 1 (2 hours):** Schema cleanup (remove redundant fields)
**Phase 2 (4 hours):** Table renaming (operators → user)
**Phase 3 (6 hours):** API/Frontend updates
**Phase 4 (2 hours):** Better Auth reconfiguration
**Phase 5 (3 hours):** Testing & validation

**Total:** 17 hours (mid-range estimate)

**Strategy:** Test each phase in development before proceeding

---

## Pre-Migration Checklist

### 1. Backup Current Database

```bash
# Full database backup
cd apps/escapeplan-api
cp data/escapeplan.db data/escapeplan.db.backup-$(date +%Y%m%d-%H%M%S)
cp data/escapeplan.db-shm data/escapeplan.db-shm.backup 2>/dev/null || true
cp data/escapeplan.db-wal data/escapeplan.db-wal.backup 2>/dev/null || true

# Export as SQL
sqlite3 data/escapeplan.db .dump > data/escapeplan-backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
sqlite3 data/escapeplan.db.backup-* "SELECT COUNT(*) FROM operators;"
```

**Critical:** Verify backup before proceeding

---

### 2. Document Current State

```bash
# Export current schema
sqlite3 data/escapeplan.db .schema > docs/schema-before-migration.sql

# Export row counts
sqlite3 data/escapeplan.db <<EOF > docs/row-counts-before-migration.txt
SELECT 'operators: ' || COUNT(*) FROM operators;
SELECT 'operator_auth_sessions: ' || COUNT(*) FROM operator_auth_sessions;
SELECT 'operator_accounts: ' || COUNT(*) FROM operator_accounts;
SELECT 'roles: ' || COUNT(*) FROM roles;
SELECT 'permissions: ' || COUNT(*) FROM permissions;
SELECT 'role_permissions: ' || COUNT(*) FROM role_permissions;
EOF

# Export sample data
sqlite3 data/escapeplan.db <<EOF > docs/sample-data-before-migration.json
.mode json
SELECT * FROM operators LIMIT 5;
EOF
```

---

### 3. Create Rollback Plan

```bash
# Rollback script
cat > scripts/rollback-migration.sh <<'EOF'
#!/bin/bash
set -e

echo "⚠️  ROLLING BACK MIGRATION"
BACKUP_FILE=$(ls -t data/escapeplan.db.backup-* | head -1)

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ No backup file found!"
  exit 1
fi

echo "📁 Restoring from: $BACKUP_FILE"
cp "$BACKUP_FILE" data/escapeplan.db

echo "✅ Rollback complete"
sqlite3 data/escapeplan.db "SELECT COUNT(*) FROM operators;" && echo "✅ Operators table restored"
EOF

chmod +x scripts/rollback-migration.sh
```

---

## Phase 1: Schema Cleanup (2 hours)

**Goal:** Remove redundant fields before renaming

**Risk:** Low (fields are unused in production logic)

### Step 1.1: Remove `role` String Field

**Current State:**
```typescript
export const operators = sqliteTable('operators', {
  role: text('role').notNull(),        // ← REMOVE (redundant with role_id)
  role_id: text('role_id').notNull().references(() => roles.id)
});
```

**Target State:**
```typescript
export const operators = sqliteTable('operators', {
  // role field removed
  role_id: text('role_id').notNull().references(() => roles.id)
});
```

**Migration Steps:**

1. **Update Schema** (`packages/contracts/src/schema.ts`):
   ```typescript
   export const operators = sqliteTable('operators', {
     id: text('id').primaryKey(),
     username: text('username').notNull().unique(),
     name: text('name').notNull(),
     email: text('email').unique(),
     email_verified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),

     // REMOVED: role: text('role').notNull(),
     role_id: text('role_id').notNull().references(() => roles.id),

     permissions: text('permissions', { mode: 'json' }).notNull().default(sql`'[]'`),
     // ... rest of fields
   });
   ```

2. **Generate Migration:**
   ```bash
   cd apps/escapeplan-api
   npx drizzle-kit generate
   # Creates: drizzle/0001_remove_role_field.sql
   ```

3. **Expected SQL:**
   ```sql
   -- SQLite doesn't support DROP COLUMN
   -- Must recreate table

   CREATE TABLE operators_new (
     id TEXT PRIMARY KEY,
     username TEXT NOT NULL UNIQUE,
     -- ... all fields except role
     role_id TEXT NOT NULL REFERENCES roles(id)
   );

   INSERT INTO operators_new SELECT
     id, username, name, email, email_verified, role_id,
     permissions, avatar_config, bio, must_reset_password,
     password_hash, last_login_at, created_at, updated_at,
     banned, ban_reason, ban_expires, archived_at, archived_by, archived_reason
   FROM operators;

   DROP TABLE operators;
   ALTER TABLE operators_new RENAME TO operators;
   ```

4. **Apply Migration:**
   ```bash
   npx drizzle-kit migrate
   ```

5. **Verify:**
   ```bash
   sqlite3 data/escapeplan.db "PRAGMA table_info(operators);" | grep -q "role" && echo "❌ Failed" || echo "✅ Success"
   ```

**Breaking Changes:**
- Any code referencing `operator.role` will break
- Search codebase: `grep -r "\.role" apps/ packages/` (exclude `role_id`)

**Fix:**
```typescript
// Before
if (operator.role === 'admin') { ... }

// After
const role = await db.query.roles.findFirst({ where: eq(roles.id, operator.role_id) });
if (role.name === 'admin') { ... }

// Better: Create helper function
function getOperatorRole(operator) {
  return db.query.roles.findFirst({ where: eq(roles.id, operator.role_id) });
}
```

---

### Step 1.2: Remove `permissions` JSON Field

**Current State:**
```typescript
permissions: text('permissions', { mode: 'json' }).notNull().default(sql`'[]'`)
```

**Target State:**
```typescript
// Field removed - derive from role_id → rolePermissions → permissions
```

**Migration Steps:**

1. **Update Schema:**
   ```typescript
   export const operators = sqliteTable('operators', {
     // ... other fields
     // REMOVED: permissions: text('permissions', { mode: 'json' }).notNull().default(sql`'[]'`),
   });
   ```

2. **Generate Migration:**
   ```bash
   npx drizzle-kit generate
   # Creates: drizzle/0002_remove_permissions_field.sql
   ```

3. **Create Permission Lookup Helper:**
   ```typescript
   // apps/escapeplan-api/src/state.ts

   export async function getOperatorPermissions(operatorId: string) {
     const operator = await db.query.operators.findFirst({
       where: eq(operators.id, operatorId),
       with: {
         role: {
           with: {
             rolePermissions: {
               with: {
                 permission: true
               }
             }
           }
         }
       }
     });

     return operator?.role.rolePermissions.map(rp => rp.permission) || [];
   }

   export async function operatorHasPermission(
     operatorId: string,
     permissionName: string
   ): Promise<boolean> {
     const permissions = await getOperatorPermissions(operatorId);
     return permissions.some(p => p.name === permissionName);
   }
   ```

4. **Update Permission Checks:**
   ```typescript
   // Before
   if (request.user.permissions.includes('create_games')) { ... }

   // After
   if (await operatorHasPermission(request.user.id, 'create_games')) { ... }
   ```

**Breaking Changes:**
- All `operator.permissions` references break
- All `permissions.includes()` checks break

**Find All Usages:**
```bash
grep -r "\.permissions" apps/ packages/ | grep -v "node_modules"
grep -r "permissions\.includes" apps/ packages/
```

**Estimated Changes:** 20-30 files

---

### Step 1.3: Add `user_type` Field

**Goal:** Prepare for customer support

**Migration:**

1. **Update Schema:**
   ```typescript
   export const operators = sqliteTable('operators', {
     id: text('id').primaryKey(),
     user_type: text('user_type').notNull().default('operator'), // NEW
     username: text('username').notNull().unique(),
     // ... rest
   });
   ```

2. **Generate Migration:**
   ```bash
   npx drizzle-kit generate
   # Creates: drizzle/0003_add_user_type.sql
   ```

3. **Expected SQL:**
   ```sql
   ALTER TABLE operators ADD COLUMN user_type TEXT NOT NULL DEFAULT 'operator';
   ```

4. **Create Database Trigger:**
   ```sql
   -- Prevent customers from having operator roles
   CREATE TRIGGER IF NOT EXISTS prevent_customer_operator_role
   BEFORE INSERT ON operators
   WHEN NEW.user_type = 'customer'
     AND NEW.role_id IN (
       SELECT id FROM roles WHERE name IN ('admin', 'manager', 'game_master')
     )
   BEGIN
     SELECT RAISE(ABORT, 'Customers cannot have operator roles');
   END;

   -- Prevent user_type changes
   CREATE TRIGGER IF NOT EXISTS prevent_user_type_change
   BEFORE UPDATE OF user_type ON operators
   WHEN OLD.user_type != NEW.user_type
   BEGIN
     SELECT RAISE(ABORT, 'User type cannot be changed after creation');
   END;
   ```

5. **Add Trigger to Migration:**
   ```bash
   # Manually edit migration file
   echo "
   -- Security triggers
   CREATE TRIGGER IF NOT EXISTS prevent_customer_operator_role ...
   CREATE TRIGGER IF NOT EXISTS prevent_user_type_change ...
   " >> drizzle/0003_add_user_type.sql
   ```

6. **Verify:**
   ```bash
   sqlite3 data/escapeplan.db <<EOF
   -- Test trigger
   INSERT INTO operators (id, user_type, role_id, username, name, email_verified)
   VALUES ('test-id', 'customer', (SELECT id FROM roles WHERE name = 'admin'), 'test', 'Test', 0);
   EOF
   # Should fail with: "Customers cannot have operator roles"
   ```

---

## Phase 2: Table Renaming (4 hours)

**Goal:** Align with Better Auth naming conventions

**Risk:** Medium (breaks all imports)

### Step 2.1: Rename Database Tables

**Renames:**
1. `operators` → `user`
2. `operator_auth_sessions` → `session`
3. `operator_accounts` → `account`
4. `operator_verifications` → `verification`

**Migration:**

1. **Update Schema** (`packages/contracts/src/schema.ts`):
   ```typescript
   // Before
   export const operators = sqliteTable('operators', { ... });
   export const operatorAuthSessions = sqliteTable('operator_auth_sessions', { ... });
   export const operatorAccounts = sqliteTable('operator_accounts', { ... });
   export const operatorVerifications = sqliteTable('operator_verifications', { ... });

   // After
   export const user = sqliteTable('user', { ... });
   export const session = sqliteTable('session', { ... });
   export const account = sqliteTable('account', { ... });
   export const verification = sqliteTable('verification', { ... });
   ```

2. **Update Foreign Key References:**
   ```typescript
   // Example: assets table
   export const assets = sqliteTable('assets', {
     uploaded_by: text('uploaded_by').notNull().references(() => user.id), // was: operators.id
   });

   // Example: games table
   export const games = sqliteTable('games', {
     archived_by: text('archived_by').references(() => user.id), // was: operators.id
   });

   // ... update all 11 tables with FK to operators.id
   ```

3. **Find All FK References:**
   ```bash
   grep -n "operators.id" packages/contracts/src/schema.ts
   ```

   **Expected Results:**
   - `assets.uploaded_by`
   - `alerts.dismissed_by`
   - `backups.created_by`
   - `discount_codes.created_by`
   - `games.archived_by`
   - `operators.archived_by` (self-reference)
   - `role_permissions.granted_by`
   - `session_milestones.triggered_by`
   - `system_settings.updated_by`
   - `session.user_id`
   - `account.user_id`

4. **Generate Migration:**
   ```bash
   npx drizzle-kit generate
   # Creates: drizzle/0004_rename_tables.sql
   ```

5. **Expected SQL:**
   ```sql
   -- Rename tables
   ALTER TABLE operators RENAME TO user;
   ALTER TABLE operator_auth_sessions RENAME TO session;
   ALTER TABLE operator_accounts RENAME TO account;
   ALTER TABLE operator_verifications RENAME TO verification;

   -- Note: Drizzle-kit should handle FK updates automatically
   -- If not, manually add FK recreation
   ```

6. **Apply Migration:**
   ```bash
   npx drizzle-kit migrate
   ```

7. **Verify:**
   ```bash
   sqlite3 data/escapeplan.db <<EOF
   .tables
   EOF
   # Should show: user, session, account, verification
   # Should NOT show: operators, operator_auth_sessions, etc.
   ```

---

### Step 2.2: Update Schema Exports

**File:** `packages/contracts/src/schema.ts`

```typescript
// Before
export const schema = {
  operators,
  operatorAuthSessions,
  operatorAccounts,
  operatorVerifications,
  // ...
};

export const authTables = {
  operators,
  operatorAuthSessions,
  operatorAccounts,
  operatorVerifications
};

// After
export const schema = {
  user,
  session,
  account,
  verification,
  roles,
  permissions,
  rolePermissions,
  // ... all other tables
};

export const authTables = {
  user,
  session,
  account,
  verification
};

// Backward compatibility aliases (TEMPORARY - remove in Phase 3)
export const operators = user;
export const operatorAuthSessions = session;
export const operatorAccounts = account;
export const operatorVerifications = verification;
```

**Benefit:** Backward compatibility during migration

---

### Step 2.3: Rebuild Contracts

```bash
pnpm --filter @escapeplan/contracts build
```

**Expected Output:**
```
✓ Built in XXXms
✓ 0 errors, 0 warnings
```

**If Errors:** Check for circular dependencies or missing imports

---

## Phase 3: API/Frontend Updates (6 hours)

**Goal:** Update all imports and references

**Risk:** Medium (many files to change)

### Step 3.1: Update API State Functions

**File:** `apps/escapeplan-api/src/state.ts`

```typescript
// Before
import { operators, games, ... } from '@escapeplan/contracts';

export function getOperatorById(id: string) {
  return db.query.operators.findFirst({ where: eq(operators.id, id) });
}

// After
import { user, games, ... } from '@escapeplan/contracts';

export function getUserById(id: string) {
  return db.query.user.findFirst({ where: eq(user.id, id) });
}

// Create alias for backward compatibility
export const getOperatorById = getUserById;
```

**Changes Needed:**
- Rename all `getOperator*` → `getUser*` functions
- Update all `db.query.operators` → `db.query.user`
- Update all `db.insert(operators)` → `db.insert(user)`
- Update all `eq(operators.id, ...)` → `eq(user.id, ...)`

**Estimated Files:** 5-8 files

---

### Step 3.2: Update API Endpoints

**File:** `apps/escapeplan-api/src/index.ts`

```typescript
// Before
api.get('/admin/operators', async (request, reply) => {
  const operators = listOperators();
  return operators;
});

api.get('/admin/operators/me', async (request, reply) => {
  const operator = getOperatorById(request.user.id);
  return operator;
});

// After
api.get('/admin/users', async (request, reply) => {
  const users = listUsers();
  return users;
});

api.get('/admin/users/me', async (request, reply) => {
  const user = getUserById(request.user.id);
  return user;
});

// Keep old endpoints for backward compatibility (TEMPORARY)
api.get('/admin/operators', async (request, reply) => {
  return reply.redirect(301, '/admin/users');
});
```

**Changes Needed:**
- Rename `/admin/operators` → `/admin/users`
- Update request handlers
- Add 301 redirects for old endpoints

**Estimated Files:** 3-5 files

---

### Step 3.3: Update Validation Schemas

**File:** `packages/contracts/src/validation.ts`

```typescript
// Before
export const createOperatorSchema = z.object({ ... });
export const updateOperatorSchema = z.object({ ... });
export type CreateOperatorRequest = z.infer<typeof createOperatorSchema>;
export type UpdateOperatorRequest = z.infer<typeof updateOperatorSchema>;

// After
export const createUserSchema = z.object({
  username: z.string().min(3),
  name: z.string().min(1),
  email: z.string().email().optional(),
  user_type: z.enum(['operator', 'customer']).default('operator'),
  role_id: z.string().uuid(),
  // ... other fields
});

export const updateUserSchema = z.object({ ... });

export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

// Backward compatibility aliases
export const createOperatorSchema = createUserSchema;
export const updateOperatorSchema = updateUserSchema;
export type CreateOperatorRequest = CreateUserRequest;
export type UpdateOperatorRequest = UpdateUserRequest;
```

**Rebuild:**
```bash
pnpm --filter @escapeplan/contracts build
```

---

### Step 3.4: Update Frontend Types

**Files:** All Svelte components importing operator types

```bash
# Find all imports
grep -r "import.*Operator" apps/escapeplan-web/src/
```

**Before:**
```typescript
import type { CreateOperatorRequest, OperatorProfile } from '@escapeplan/contracts';
```

**After:**
```typescript
import type { CreateUserRequest, UserProfile } from '@escapeplan/contracts';

// Or use aliases during migration
import type {
  CreateOperatorRequest,  // alias for CreateUserRequest
  OperatorProfile         // alias for UserProfile
} from '@escapeplan/contracts';
```

**Estimated Files:** 20-30 components

---

### Step 3.5: Update API Calls

**Example:** `apps/escapeplan-web/src/lib/api/operators.ts`

```typescript
// Before
export async function fetchOperators() {
  const response = await fetch('/api/admin/operators');
  return response.json();
}

export async function fetchCurrentOperator() {
  const response = await fetch('/api/admin/operators/me');
  return response.json();
}

// After
export async function fetchUsers() {
  const response = await fetch('/api/admin/users');
  return response.json();
}

export async function fetchCurrentUser() {
  const response = await fetch('/api/admin/users/me');
  return response.json();
}

// Aliases
export const fetchOperators = fetchUsers;
export const fetchCurrentOperator = fetchCurrentUser;
```

---

## Phase 4: Better Auth Reconfiguration (2 hours)

**Goal:** Configure Better Auth with new table names and custom fields

### Step 4.1: Update Better Auth Config

**File:** `apps/escapeplan-api/src/db/client.ts` (or auth config file)

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./client";
import * as schema from "@escapeplan/contracts";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification
    }
  }),
  user: {
    additionalFields: {
      username: {
        type: "string",
        fieldName: "username",
        returned: true,
        input: true,
        required: true
      },
      user_type: {
        type: "string",
        fieldName: "user_type",
        returned: true,
        input: false,  // Server sets this
        required: true
      },
      role_id: {
        type: "string",
        fieldName: "role_id",
        returned: true,
        input: false,  // Server sets this
        required: true
      },
      bio: {
        type: "string",
        fieldName: "bio",
        returned: true,
        input: true,
        required: false
      },
      avatar_config: {
        type: "string",  // JSON stringified
        fieldName: "avatar_config",
        returned: true,
        input: true,
        required: false
      }
    }
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword(url, user) {
      // Email sending logic (existing)
    }
  }
});
```

**Key Changes:**
- Map Better Auth's expected tables to new names
- Configure `additionalFields` for custom columns
- Set `input: false` for server-only fields (user_type, role_id)

---

### Step 4.2: Update Session Handling

**File:** `apps/escapeplan-web/src/hooks.server.ts`

```typescript
import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({
    headers: event.request.headers
  });

  if (event.url.pathname.startsWith('/admin')) {
    if (!session?.user) {
      throw redirect(302, '/auth/sign-in');
    }

    // NEW: Check user_type
    if (session.user.user_type !== 'operator') {
      throw redirect(302, '/customer/dashboard');
    }
  }

  // Attach to locals
  event.locals.user = session?.user || null;
  event.locals.session = session || null;

  return resolve(event);
}
```

**Key Changes:**
- Access `session.user.user_type` (from additionalFields)
- Access `session.user.role_id` (from additionalFields)
- Enforce operator-only routes

---

## Phase 5: Testing & Validation (3 hours)

**Goal:** Ensure no regressions

### Step 5.1: Unit Tests

```bash
# API tests
pnpm --filter escapeplan-api test

# Expected: All tests pass
```

**Update Test Fixtures:**
```typescript
// Before
const mockOperator = {
  id: 'op-123',
  username: 'admin',
  role: 'admin',
  permissions: ['create_games']
};

// After
const mockUser = {
  id: 'user-123',
  username: 'admin',
  user_type: 'operator',
  role_id: 'role-admin'
};
```

---

### Step 5.2: Integration Tests

**Test Scenarios:**

1. **User CRUD:**
   ```bash
   # Create user
   curl -X POST http://localhost:4000/api/admin/users \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testuser",
       "name": "Test User",
       "email": "test@example.com",
       "user_type": "operator",
       "role_id": "role-game-master"
     }'

   # Fetch user
   curl http://localhost:4000/api/admin/users/me \
     -H "Cookie: better-auth.session_token=..."

   # Update user
   curl -X PUT http://localhost:4000/api/admin/users/{id} \
     -d '{ "bio": "Updated bio" }'

   # Delete user
   curl -X DELETE http://localhost:4000/api/admin/users/{id}
   ```

2. **Authentication:**
   ```bash
   # Sign in
   curl -X POST http://localhost:4000/api/auth/sign-in/email \
     -d '{ "email": "admin@example.com", "password": "..." }'

   # Verify session includes custom fields
   curl http://localhost:4000/api/auth/get-session \
     -H "Cookie: better-auth.session_token=..."
   # Should return: { user: { user_type, role_id, bio, avatar_config } }
   ```

3. **Permission Checks:**
   ```bash
   # Test permission derivation
   curl http://localhost:4000/api/admin/users/{id}/permissions
   # Should return permissions from role → rolePermissions → permissions
   ```

4. **User Type Validation:**
   ```bash
   # Try to create customer with operator role (should fail)
   curl -X POST http://localhost:4000/api/admin/users \
     -d '{
       "username": "baduser",
       "user_type": "customer",
       "role_id": "role-admin"
     }'
   # Expected: 400 error "Customers cannot have operator roles"
   ```

---

### Step 5.3: Manual UI Testing

**Checklist:**

- [ ] Login as admin
- [ ] Navigate to /admin/users
- [ ] Create new user
- [ ] Edit user profile
- [ ] Change user role
- [ ] Ban user
- [ ] Delete user
- [ ] Check user type appears in UI
- [ ] Verify customer cannot access /admin routes

---

### Step 5.4: Database Integrity Checks

```bash
sqlite3 data/escapeplan.db <<EOF
-- Check for orphaned foreign keys
SELECT 'Orphaned assets.uploaded_by' AS issue, COUNT(*) AS count
FROM assets WHERE uploaded_by NOT IN (SELECT id FROM user);

SELECT 'Orphaned games.archived_by' AS issue, COUNT(*) AS count
FROM games WHERE archived_by IS NOT NULL AND archived_by NOT IN (SELECT id FROM user);

-- Check user_type distribution
SELECT user_type, COUNT(*) FROM user GROUP BY user_type;

-- Check role distribution
SELECT r.name, COUNT(*) FROM user u JOIN roles r ON u.role_id = r.id GROUP BY r.name;
EOF
```

**Expected:** 0 orphaned rows

---

## Rollback Procedures

### Scenario 1: Migration Fails Midway

**Action:**
```bash
# Stop API server
pnpm --filter escapeplan-api stop

# Restore backup
./scripts/rollback-migration.sh

# Verify restoration
sqlite3 data/escapeplan.db "SELECT COUNT(*) FROM operators;"

# Restart API
pnpm --filter escapeplan-api dev
```

---

### Scenario 2: Production Issues After Deploy

**Action:**
```bash
# Git revert
git revert HEAD~5..HEAD  # Revert last 5 commits

# Restore database backup
cp /path/to/production/backup.db data/escapeplan.db

# Redeploy
./scripts/deploy.sh
```

---

## Post-Migration Cleanup

### Remove Backward Compatibility Aliases

**After 1-2 weeks of stable operation:**

```typescript
// Remove from schema.ts
// DELETE these lines:
export const operators = user;
export const operatorAuthSessions = session;

// Remove from validation.ts
// DELETE these lines:
export const createOperatorSchema = createUserSchema;
export type CreateOperatorRequest = CreateUserRequest;

// Remove old API endpoints
// DELETE from index.ts:
api.get('/admin/operators', ...);  // Keep only /admin/users
```

---

## Migration Timeline

### Development Environment

**Day 1 (8 hours):**
- Morning: Phase 1 (schema cleanup)
- Afternoon: Phase 2 (table renaming)

**Day 2 (8 hours):**
- Morning: Phase 3 (API/Frontend updates)
- Afternoon: Phase 4 (Better Auth config) + Phase 5 (testing)

**Total:** 2 days (16 hours)

### Production Deployment

**Prerequisites:**
- All tests passing
- Staging environment validated
- Database backup created
- Rollback plan tested

**Deployment Window:**
- Estimated downtime: 5-10 minutes (during migration)
- Best time: Low-traffic period (e.g., 2 AM)

**Steps:**
1. Announce maintenance window
2. Stop API server
3. Backup database
4. Run migrations
5. Deploy new code
6. Restart API server
7. Run smoke tests
8. Monitor logs for errors

---

## Risk Mitigation

### High-Risk Areas

1. **Foreign Key Constraints**
   - **Risk:** Migration fails due to FK violations
   - **Mitigation:** Test migration on copy of production DB first

2. **Session Invalidation**
   - **Risk:** All users logged out after migration
   - **Mitigation:** Session table rename preserves tokens

3. **Type Mismatches**
   - **Risk:** TypeScript errors in production
   - **Mitigation:** Run `pnpm build` on all packages before deploy

4. **Permission Checks Fail**
   - **Risk:** Users can't access features
   - **Mitigation:** Test permission derivation thoroughly

---

## Success Criteria

✅ **Database:**
- Tables renamed successfully
- No orphaned foreign keys
- Triggers functioning correctly

✅ **API:**
- All endpoints return correct data
- Permission checks work
- Better Auth session includes custom fields

✅ **Frontend:**
- No TypeScript errors
- All components render
- User type differentiation works

✅ **Tests:**
- All unit tests pass
- All integration tests pass
- Manual UI testing complete

---

## Conclusion

**Migration Strategy:** Phased, tested, reversible

**Total Effort:** 13-20 hours (over 2-3 days)

**Risk Level:** Medium (manageable with backups and testing)

**Next Steps:**
- Review final architecture design (Document 04)
- Plan detailed implementation (Document 05)
- Get stakeholder approval before proceeding

---

**Document Version:** 1.0
**Author:** Claude Research Agent
**Status:** ✅ Migration Strategy Complete
**Next Document:** `04-CUSTOMER_OPERATOR_ARCHITECTURE.md`
