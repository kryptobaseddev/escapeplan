# Implementation Plan - Step-by-Step Execution Guide

**Research Date:** 2025-10-02
**Implementation Scope:** Phase 1 - Core Migration Only
**Estimated Effort:** 13-20 hours
**Target Completion:** 2-3 days

---

## Executive Summary

**This document provides a checklist-based implementation plan** for migrating from `operators` table to `user` table with Better Auth alignment.

**Scope:** Phase 1 only (schema migration + API/frontend updates)
- ✅ Table renaming (operators → user)
- ✅ Remove redundant fields (role, permissions)
- ✅ Add user_type field
- ✅ Update Better Auth configuration
- ✅ Fix all breaking changes

**Out of Scope (Future Phases):**
- ❌ Customer registration UI
- ❌ Customer portal routes
- ❌ Payment integration
- ❌ Loyalty program

---

## Pre-Flight Checklist

### Environment Setup

- [ ] **Backup Production Database**
  ```bash
  cd apps/escapeplan-api
  cp data/escapeplan.db data/escapeplan.db.backup-$(date +%Y%m%d-%H%M%S)
  sqlite3 data/escapeplan.db .dump > data/escapeplan-backup-$(date +%Y%m%d-%H%M%S).sql
  ```

- [ ] **Create Feature Branch**
  ```bash
  git checkout -b feat/user-table-migration
  ```

- [ ] **Verify All Tests Pass (Baseline)**
  ```bash
  pnpm --filter escapeplan-api test
  pnpm --filter escapeplan-web test
  ```

- [ ] **Document Current Row Counts**
  ```bash
  sqlite3 data/escapeplan.db <<EOF > docs/pre-migration-counts.txt
  SELECT 'operators: ' || COUNT(*) FROM operators;
  SELECT 'operator_auth_sessions: ' || COUNT(*) FROM operator_auth_sessions;
  SELECT 'roles: ' || COUNT(*) FROM roles;
  SELECT 'permissions: ' || COUNT(*) FROM permissions;
  EOF
  ```

- [ ] **Create Rollback Script**
  ```bash
  cat > scripts/rollback-user-migration.sh <<'EOF'
  #!/bin/bash
  set -e
  BACKUP=$(ls -t data/escapeplan.db.backup-* | head -1)
  echo "Rolling back to: $BACKUP"
  cp "$BACKUP" data/escapeplan.db
  echo "Rollback complete"
  EOF
  chmod +x scripts/rollback-user-migration.sh
  ```

---

## Phase 1: Schema Preparation (2 hours)

### Step 1.1: Add user_type Field

- [ ] **Update Schema** (`packages/contracts/src/schema.ts`)
  ```typescript
  export const operators = sqliteTable('operators', {
    id: text('id').primaryKey(),
    user_type: text('user_type').notNull().default('operator'), // ADD THIS
    username: text('username').notNull().unique(),
    name: text('name').notNull(),
    // ... rest of fields
  });
  ```

- [ ] **Generate Migration**
  ```bash
  cd apps/escapeplan-api
  npx drizzle-kit generate
  ```

- [ ] **Verify Migration SQL**
  ```bash
  cat drizzle/$(ls -t drizzle/*.sql | head -1)
  # Should contain: ALTER TABLE operators ADD COLUMN user_type TEXT NOT NULL DEFAULT 'operator';
  ```

- [ ] **Apply Migration**
  ```bash
  npx drizzle-kit migrate
  ```

- [ ] **Verify Column Added**
  ```bash
  sqlite3 data/escapeplan.db "PRAGMA table_info(operators);" | grep user_type
  # Should output: user_type column info
  ```

---

### Step 1.2: Create Database Triggers

- [ ] **Create Trigger SQL File** (`apps/escapeplan-api/drizzle/triggers.sql`)
  ```sql
  -- Prevent customers from having operator roles
  CREATE TRIGGER IF NOT EXISTS prevent_customer_operator_role
  BEFORE INSERT ON operators
  WHEN NEW.user_type = 'customer'
    AND NEW.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'manager', 'game_master'))
  BEGIN
    SELECT RAISE(ABORT, 'Customers cannot have operator roles');
  END;

  -- Prevent user_type changes
  CREATE TRIGGER IF NOT EXISTS prevent_user_type_change
  BEFORE UPDATE OF user_type ON operators
  WHEN OLD.user_type != NEW.user_type
  BEGIN
    SELECT RAISE(ABORT, 'User type cannot be changed');
  END;
  ```

- [ ] **Apply Triggers**
  ```bash
  sqlite3 data/escapeplan.db < drizzle/triggers.sql
  ```

- [ ] **Test Trigger (Should Fail)**
  ```bash
  sqlite3 data/escapeplan.db <<EOF
  INSERT INTO operators (id, user_type, role_id, username, name, email_verified, created_at, updated_at)
  VALUES ('test-trigger', 'customer', (SELECT id FROM roles WHERE name = 'admin'), 'test', 'Test', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  EOF
  # Expected: Error: Customers cannot have operator roles
  ```

---

### Step 1.3: Remove role String Field

- [ ] **Update Schema** (`packages/contracts/src/schema.ts`)
  ```typescript
  export const operators = sqliteTable('operators', {
    // REMOVE: role: text('role').notNull(),
    role_id: text('role_id').notNull().references(() => roles.id, { onDelete: 'restrict' }),
    // ... other fields
  });
  ```

- [ ] **Generate Migration**
  ```bash
  npx drizzle-kit generate
  ```

- [ ] **Review Migration SQL**
  ```bash
  # SQLite doesn't support DROP COLUMN, so this will recreate the table
  cat drizzle/$(ls -t drizzle/*.sql | head -1)
  ```

- [ ] **Apply Migration**
  ```bash
  npx drizzle-kit migrate
  ```

- [ ] **Verify Column Removed**
  ```bash
  sqlite3 data/escapeplan.db "PRAGMA table_info(operators);" | grep -c "^.*|role|"
  # Should output: 0 (only role_id remains)
  ```

---

### Step 1.4: Remove permissions JSON Field

- [ ] **Update Schema** (`packages/contracts/src/schema.ts`)
  ```typescript
  export const operators = sqliteTable('operators', {
    // REMOVE: permissions: text('permissions', { mode: 'json' }).notNull().default(sql`'[]'`),
    // ... other fields
  });
  ```

- [ ] **Generate Migration**
  ```bash
  npx drizzle-kit generate
  ```

- [ ] **Apply Migration**
  ```bash
  npx drizzle-kit migrate
  ```

- [ ] **Rebuild Contracts**
  ```bash
  pnpm --filter @escapeplan/contracts build
  ```

---

## Phase 2: Table Renaming (2 hours)

### Step 2.1: Rename Schema Tables

- [ ] **Update Table Definitions** (`packages/contracts/src/schema.ts`)
  ```typescript
  // BEFORE:
  export const operators = sqliteTable('operators', { ... });
  export const operatorAuthSessions = sqliteTable('operator_auth_sessions', { ... });
  export const operatorAccounts = sqliteTable('operator_accounts', { ... });
  export const operatorVerifications = sqliteTable('operator_verifications', { ... });

  // AFTER:
  export const user = sqliteTable('user', { ... });
  export const session = sqliteTable('session', { ... });
  export const account = sqliteTable('account', { ... });
  export const verification = sqliteTable('verification', { ... });
  ```

- [ ] **Update Foreign Key References**

  Find all references:
  ```bash
  grep -n "operators.id" packages/contracts/src/schema.ts
  ```

  Update each reference:
  ```typescript
  // BEFORE:
  uploaded_by: text('uploaded_by').notNull().references(() => operators.id)

  // AFTER:
  uploaded_by: text('uploaded_by').notNull().references(() => user.id)
  ```

  **Files to Update:**
  - [ ] `assets.uploaded_by`
  - [ ] `alerts.dismissed_by`
  - [ ] `backups.created_by`
  - [ ] `discount_codes.created_by`
  - [ ] `games.archived_by`
  - [ ] `user.archived_by` (self-reference)
  - [ ] `role_permissions.granted_by`
  - [ ] `session_milestones.triggered_by`
  - [ ] `system_settings.updated_by`
  - [ ] `session.user_id`
  - [ ] `account.user_id`

---

### Step 2.2: Update Schema Exports

- [ ] **Update Exports** (`packages/contracts/src/schema.ts`)
  ```typescript
  export const schema = {
    user,                     // was: operators
    session,                  // was: operatorAuthSessions
    account,                  // was: operatorAccounts
    verification,             // was: operatorVerifications
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

  // TEMPORARY: Backward compatibility aliases (remove after migration)
  export const operators = user;
  export const operatorAuthSessions = session;
  export const operatorAccounts = account;
  export const operatorVerifications = verification;
  ```

---

### Step 2.3: Generate & Apply Rename Migration

- [ ] **Generate Migration**
  ```bash
  cd apps/escapeplan-api
  npx drizzle-kit generate
  ```

- [ ] **Review Migration SQL**
  ```bash
  cat drizzle/$(ls -t drizzle/*.sql | head -1)
  # Should show: ALTER TABLE operators RENAME TO user; etc.
  ```

- [ ] **Apply Migration**
  ```bash
  npx drizzle-kit migrate
  ```

- [ ] **Verify Tables Renamed**
  ```bash
  sqlite3 data/escapeplan.db ".tables"
  # Should include: user, session, account, verification
  # Should NOT include: operators, operator_auth_sessions, etc.
  ```

- [ ] **Re-apply Triggers (Update Table Names)**
  ```sql
  -- Update triggers.sql to use 'user' instead of 'operators'
  DROP TRIGGER IF EXISTS prevent_customer_operator_role;
  DROP TRIGGER IF EXISTS prevent_user_type_change;

  CREATE TRIGGER IF NOT EXISTS prevent_customer_operator_role
  BEFORE INSERT ON user  -- CHANGED
  WHEN NEW.user_type = 'customer'
    AND NEW.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'manager', 'game_master'))
  BEGIN
    SELECT RAISE(ABORT, 'Customers cannot have operator roles');
  END;

  CREATE TRIGGER IF NOT EXISTS prevent_user_type_change
  BEFORE UPDATE OF user_type ON user  -- CHANGED
  WHEN OLD.user_type != NEW.user_type
  BEGIN
    SELECT RAISE(ABORT, 'User type cannot be changed');
  END;
  ```

- [ ] **Apply Updated Triggers**
  ```bash
  sqlite3 data/escapeplan.db < drizzle/triggers.sql
  ```

---

### Step 2.4: Rebuild Contracts

- [ ] **Build Contracts Package**
  ```bash
  pnpm --filter @escapeplan/contracts build
  ```

- [ ] **Verify No Build Errors**
  ```bash
  # Should output: ✓ Built in XXXms, 0 errors
  ```

---

## Phase 3: API Layer Updates (4 hours)

### Step 3.1: Update State Functions

- [ ] **Rename Functions** (`apps/escapeplan-api/src/state.ts`)

  **Find & Replace:**
  ```typescript
  // BEFORE → AFTER
  getOperatorById → getUserById
  listOperators → listUsers
  createOperator → createUser
  updateOperator → updateUser
  deleteOperator → deleteUser
  ```

- [ ] **Update Query References**
  ```typescript
  // BEFORE:
  db.query.operators.findFirst({ where: eq(operators.id, id) })

  // AFTER:
  db.query.user.findFirst({ where: eq(user.id, id) })
  ```

- [ ] **Update Insert/Update Statements**
  ```typescript
  // BEFORE:
  db.insert(operators).values({ ... })

  // AFTER:
  db.insert(user).values({ ... })
  ```

- [ ] **Create Backward Compatibility Aliases**
  ```typescript
  // Add at end of state.ts
  export const getOperatorById = getUserById;
  export const listOperators = listUsers;
  export const createOperator = createUser;
  export const updateOperator = updateUser;
  export const deleteOperator = deleteUser;
  ```

---

### Step 3.2: Create Permission Helper Functions

- [ ] **Add Permission Helpers** (`apps/escapeplan-api/src/state.ts`)
  ```typescript
  export async function getUserPermissions(userId: string) {
    const user = await db.query.user.findFirst({
      where: eq(user.id, userId),
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

    return user?.role.rolePermissions.map(rp => rp.permission) || [];
  }

  export async function userHasPermission(
    userId: string,
    permissionName: string
  ): Promise<boolean> {
    const permissions = await getUserPermissions(userId);
    return permissions.some(p => p.name === permissionName);
  }
  ```

---

### Step 3.3: Update API Endpoints

- [ ] **Update Import Statements** (`apps/escapeplan-api/src/index.ts`)
  ```typescript
  import {
    user,        // was: operators
    session,     // was: operatorAuthSessions
    // ... other tables
  } from '@escapeplan/contracts';
  ```

- [ ] **Rename Endpoints**
  ```typescript
  // BEFORE:
  api.get('/admin/operators', async (request, reply) => { ... });

  // AFTER:
  api.get('/admin/users', async (request, reply) => { ... });
  ```

- [ ] **Add 301 Redirects for Old Endpoints**
  ```typescript
  // Temporary backward compatibility
  api.get('/admin/operators', async (request, reply) => {
    return reply.redirect(301, '/admin/users');
  });
  api.get('/admin/operators/:id', async (request, reply) => {
    return reply.redirect(301, `/admin/users/${request.params.id}`);
  });
  ```

- [ ] **Update Permission Checks**
  ```typescript
  // BEFORE:
  if (!request.user.permissions.includes('create_games')) { ... }

  // AFTER:
  if (!await userHasPermission(request.user.id, 'create_games')) { ... }
  ```

---

### Step 3.4: Update Validation Schemas

- [ ] **Rename Schemas** (`packages/contracts/src/validation.ts`)
  ```typescript
  // BEFORE:
  export const createOperatorSchema = z.object({ ... });
  export type CreateOperatorRequest = z.infer<typeof createOperatorSchema>;

  // AFTER:
  export const createUserSchema = z.object({
    username: z.string().min(3),
    name: z.string().min(1),
    email: z.string().email().optional(),
    user_type: z.enum(['operator', 'customer']).default('operator'),
    role_id: z.string().uuid(),
    bio: z.string().optional(),
    avatar_config: z.object({}).optional()
  });
  export type CreateUserRequest = z.infer<typeof createUserSchema>;

  // Backward compatibility
  export const createOperatorSchema = createUserSchema;
  export type CreateOperatorRequest = CreateUserRequest;
  ```

- [ ] **Rebuild Contracts**
  ```bash
  pnpm --filter @escapeplan/contracts build
  ```

---

### Step 3.5: Update Better Auth Configuration

- [ ] **Update Auth Config** (`apps/escapeplan-api/src/auth.ts` or `db/client.ts`)
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
          input: false,
          required: true
        },
        role_id: {
          type: "string",
          fieldName: "role_id",
          returned: true,
          input: false,
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
          type: "string",
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
        // Email logic (existing)
      }
    }
  });
  ```

---

## Phase 4: Frontend Updates (6 hours)

### Step 4.1: Update Type Imports

- [ ] **Find All Type Imports**
  ```bash
  grep -r "import.*Operator" apps/escapeplan-web/src/
  ```

- [ ] **Update Imports** (across all files)
  ```typescript
  // BEFORE:
  import type { OperatorProfile, CreateOperatorRequest } from '@escapeplan/contracts';

  // AFTER (Option 1 - use new names):
  import type { UserProfile, CreateUserRequest } from '@escapeplan/contracts';

  // AFTER (Option 2 - use aliases during transition):
  import type { CreateOperatorRequest, OperatorProfile } from '@escapeplan/contracts';
  // These are now aliases for CreateUserRequest, UserProfile
  ```

---

### Step 4.2: Update API Client Functions

- [ ] **Update API Functions** (`apps/escapeplan-web/src/lib/api/operators.ts`)
  ```typescript
  // Rename file to: users.ts

  export async function fetchUsers() {
    const response = await fetch('/api/admin/users');
    return response.json();
  }

  export async function fetchCurrentUser() {
    const response = await fetch('/api/admin/users/me');
    return response.json();
  }

  export async function createUser(data: CreateUserRequest) {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Backward compatibility exports
  export const fetchOperators = fetchUsers;
  export const fetchCurrentOperator = fetchCurrentUser;
  export const createOperator = createUser;
  ```

---

### Step 4.3: Update Route Guards

- [ ] **Update Hooks** (`apps/escapeplan-web/src/hooks.server.ts`)
  ```typescript
  import { auth } from '$lib/server/auth';
  import { redirect } from '@sveltejs/kit';

  export async function handle({ event, resolve }) {
    const session = await auth.api.getSession({
      headers: event.request.headers
    });

    // Operator routes
    if (event.url.pathname.startsWith('/admin')) {
      if (!session?.user) {
        throw redirect(302, '/auth/sign-in');
      }

      // NEW: Check user_type
      if (session.user.user_type !== 'operator') {
        throw redirect(302, '/customer/dashboard');
      }
    }

    event.locals.user = session?.user || null;
    event.locals.session = session || null;

    return resolve(event);
  }
  ```

- [ ] **Update Locals Type** (`apps/escapeplan-web/src/app.d.ts`)
  ```typescript
  declare global {
    namespace App {
      interface Locals {
        user: User | null;  // was: Operator | null
        session: Session | null;
      }
    }
  }
  ```

---

### Step 4.4: Update Components

- [ ] **Find All Components Using Operator Types**
  ```bash
  find apps/escapeplan-web/src/lib/components -type f -name "*.svelte" -exec grep -l "operator" {} \;
  ```

- [ ] **Update Each Component**

  **Example:** `OperatorCard.svelte` → `UserCard.svelte`
  ```svelte
  <script lang="ts">
    import type { UserProfile } from '@escapeplan/contracts';  // was: OperatorProfile
    export let user: UserProfile;                              // was: operator
  </script>

  <div class="user-card">
    <h3>{user.name}</h3>
    <p>{user.email}</p>
    <span class="badge">{user.user_type}</span>                <!-- NEW -->
  </div>
  ```

---

### Step 4.5: Update Routes/Pages

- [ ] **Update Page Components**

  **Example:** `/admin/operators/+page.svelte` → `/admin/users/+page.svelte`

  1. Rename file/folder
  2. Update component logic
  3. Update API calls

- [ ] **Update Route Params**
  ```typescript
  // BEFORE: /admin/operators/[id]/+page.svelte
  // AFTER:  /admin/users/[id]/+page.svelte
  ```

---

## Phase 5: Testing (3 hours)

### Step 5.1: Unit Tests

- [ ] **Update Test Mocks**
  ```typescript
  // tests/fixtures/users.ts (was: operators.ts)
  export const mockUser = {
    id: 'user-123',
    username: 'testuser',
    name: 'Test User',
    user_type: 'operator',
    role_id: 'role-admin',
    // ... other fields
  };
  ```

- [ ] **Run Unit Tests**
  ```bash
  pnpm --filter escapeplan-api test
  # Fix any failures
  ```

---

### Step 5.2: Integration Tests

- [ ] **Test User CRUD Operations**
  ```bash
  # Create user
  curl -X POST http://localhost:4000/api/admin/users \
    -H "Content-Type: application/json" \
    -H "Cookie: better-auth.session_token=..." \
    -d '{
      "username": "testuser",
      "name": "Test User",
      "email": "test@example.com",
      "user_type": "operator",
      "role_id": "role-game-master"
    }'

  # Fetch users
  curl http://localhost:4000/api/admin/users \
    -H "Cookie: better-auth.session_token=..."

  # Update user
  curl -X PUT http://localhost:4000/api/admin/users/{id} \
    -H "Content-Type: application/json" \
    -H "Cookie: better-auth.session_token=..." \
    -d '{ "bio": "Updated bio" }'

  # Delete user
  curl -X DELETE http://localhost:4000/api/admin/users/{id} \
    -H "Cookie: better-auth.session_token=..."
  ```

- [ ] **Test Authentication**
  ```bash
  # Sign in
  curl -X POST http://localhost:4000/api/auth/sign-in/email \
    -H "Content-Type: application/json" \
    -d '{ "email": "admin@example.com", "password": "..." }'

  # Get session (verify custom fields)
  curl http://localhost:4000/api/auth/get-session \
    -H "Cookie: better-auth.session_token=..."
  # Verify response includes: user_type, role_id, bio, avatar_config
  ```

- [ ] **Test Permission System**
  ```bash
  # Fetch user permissions
  curl http://localhost:4000/api/admin/users/{id}/permissions \
    -H "Cookie: better-auth.session_token=..."
  # Should return permissions derived from role
  ```

- [ ] **Test User Type Enforcement**
  ```bash
  # Try to create customer with operator role (should fail)
  curl -X POST http://localhost:4000/api/admin/users \
    -H "Content-Type: application/json" \
    -d '{
      "username": "baduser",
      "user_type": "customer",
      "role_id": "role-admin"
    }'
  # Expected: 400 error
  ```

---

### Step 5.3: Manual UI Testing

- [ ] **Login as Admin**
- [ ] **Navigate to /admin/users** (was /admin/operators)
- [ ] **Create New User**
  - Verify user_type field appears
  - Verify role selection works
  - Verify user is created successfully
- [ ] **Edit User**
  - Update bio
  - Change role
  - Verify changes saved
- [ ] **Delete User**
  - Verify soft delete works
  - Verify archived users don't appear in list
- [ ] **Test Permissions**
  - Login as non-admin
  - Verify permission checks work
  - Verify restricted actions are blocked

---

### Step 5.4: Database Integrity

- [ ] **Check for Orphaned Records**
  ```bash
  sqlite3 data/escapeplan.db <<EOF
  SELECT 'Orphaned assets.uploaded_by' AS issue, COUNT(*) AS count
  FROM assets WHERE uploaded_by NOT IN (SELECT id FROM user);

  SELECT 'Orphaned games.archived_by' AS issue, COUNT(*) AS count
  FROM games WHERE archived_by IS NOT NULL AND archived_by NOT IN (SELECT id FROM user);

  SELECT 'Orphaned session.user_id' AS issue, COUNT(*) AS count
  FROM session WHERE user_id NOT IN (SELECT id FROM user);

  -- Should all return 0
  EOF
  ```

- [ ] **Verify Row Counts Match**
  ```bash
  sqlite3 data/escapeplan.db <<EOF
  SELECT 'user: ' || COUNT(*) FROM user;
  SELECT 'session: ' || COUNT(*) FROM session;
  SELECT 'roles: ' || COUNT(*) FROM roles;
  SELECT 'permissions: ' || COUNT(*) FROM permissions;
  EOF
  # Compare to pre-migration-counts.txt
  ```

- [ ] **Verify Triggers Work**
  ```bash
  sqlite3 data/escapeplan.db <<EOF
  -- Test 1: Customer with operator role (should fail)
  INSERT INTO user (id, user_type, role_id, username, name, email_verified, created_at, updated_at)
  VALUES ('test-1', 'customer', (SELECT id FROM roles WHERE name = 'admin'), 'test1', 'Test', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  -- Test 2: User type change (should fail)
  UPDATE user SET user_type = 'customer' WHERE id = (SELECT id FROM user LIMIT 1);
  EOF
  # Both should fail with appropriate error messages
  ```

---

## Phase 6: Cleanup & Finalization (2 hours)

### Step 6.1: Remove Backward Compatibility Aliases

**After 1 week of stable operation:**

- [ ] **Remove Schema Aliases** (`packages/contracts/src/schema.ts`)
  ```typescript
  // DELETE these lines:
  export const operators = user;
  export const operatorAuthSessions = session;
  export const operatorAccounts = account;
  export const operatorVerifications = verification;
  ```

- [ ] **Remove Validation Aliases** (`packages/contracts/src/validation.ts`)
  ```typescript
  // DELETE these lines:
  export const createOperatorSchema = createUserSchema;
  export type CreateOperatorRequest = CreateUserRequest;
  ```

- [ ] **Remove API Redirects** (`apps/escapeplan-api/src/index.ts`)
  ```typescript
  // DELETE these routes:
  api.get('/admin/operators', ...);
  api.get('/admin/operators/:id', ...);
  ```

- [ ] **Remove State Function Aliases** (`apps/escapeplan-api/src/state.ts`)
  ```typescript
  // DELETE these lines:
  export const getOperatorById = getUserById;
  export const listOperators = listUsers;
  ```

- [ ] **Rebuild All Packages**
  ```bash
  pnpm --filter @escapeplan/contracts build
  pnpm --filter escapeplan-api build
  pnpm --filter escapeplan-web build
  ```

---

### Step 6.2: Update Documentation

- [ ] **Update API Documentation**
  - Change all references from "operators" to "users"
  - Update endpoint paths
  - Update request/response examples

- [ ] **Update README**
  - Update setup instructions
  - Update database schema docs
  - Update API endpoint list

- [ ] **Update DATABASE_SYSTEM.md**
  - Replace "operators" with "user"
  - Update schema diagrams
  - Update relationship maps

---

### Step 6.3: Git Housekeeping

- [ ] **Stage All Changes**
  ```bash
  git add .
  ```

- [ ] **Commit Migration**
  ```bash
  git commit -m "feat: migrate operators table to user table

  - Rename operators → user (align with Better Auth)
  - Rename operator_auth_sessions → session
  - Rename operator_accounts → account
  - Rename operator_verifications → verification
  - Add user_type field for operator/customer differentiation
  - Remove redundant role string field (use only role_id FK)
  - Remove redundant permissions JSON field (use only role permissions)
  - Add database triggers for user_type enforcement
  - Update all API endpoints and frontend components
  - Configure Better Auth additionalFields for custom columns

  BREAKING CHANGES:
  - API endpoints moved from /admin/operators to /admin/users
  - Operator types renamed to User types
  - Permission checking now uses database-derived permissions

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

- [ ] **Push to Remote**
  ```bash
  git push origin feat/user-table-migration
  ```

- [ ] **Create Pull Request**
  ```bash
  gh pr create --title "feat: migrate operators to user table" \
    --body "$(cat <<'EOF'
  ## Summary
  - Migrated operators table to user table (Better Auth alignment)
  - Added user_type field for operator/customer separation
  - Removed redundant role/permissions fields
  - Updated all API/frontend references
  - Configured Better Auth with custom fields

  ## Breaking Changes
  - `/admin/operators` → `/admin/users`
  - `OperatorProfile` → `UserProfile`
  - Permission checks now use database-driven RBAC

  ## Testing
  - [x] All unit tests pass
  - [x] Integration tests pass
  - [x] Manual UI testing complete
  - [x] Database triggers validated
  - [x] No orphaned records

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```

---

## Deployment Checklist

### Pre-Deployment

- [ ] **All tests passing in CI/CD**
- [ ] **PR approved by stakeholders**
- [ ] **Database backup created**
- [ ] **Rollback plan tested**
- [ ] **Maintenance window scheduled**

### Deployment Steps

1. [ ] **Announce Maintenance**
   - Email users
   - Set status page to "maintenance"

2. [ ] **Stop API Server**
   ```bash
   systemctl stop escapeplan-api
   ```

3. [ ] **Backup Production Database**
   ```bash
   cp /var/lib/escapeplan/escapeplan.db /var/lib/escapeplan/escapeplan.db.backup-$(date +%Y%m%d-%H%M%S)
   ```

4. [ ] **Deploy New Code**
   ```bash
   git pull origin main
   pnpm install
   pnpm build
   ```

5. [ ] **Run Migrations**
   ```bash
   cd apps/escapeplan-api
   npx drizzle-kit migrate
   sqlite3 /var/lib/escapeplan/escapeplan.db < drizzle/triggers.sql
   ```

6. [ ] **Start API Server**
   ```bash
   systemctl start escapeplan-api
   ```

7. [ ] **Run Smoke Tests**
   ```bash
   curl http://localhost:4000/api/health
   curl http://localhost:4000/api/admin/users
   ```

8. [ ] **Monitor Logs**
   ```bash
   journalctl -u escapeplan-api -f
   ```

9. [ ] **Announce Completion**
   - Update status page
   - Email users

---

### Post-Deployment Monitoring

- [ ] **Monitor Error Logs** (first 24 hours)
  ```bash
  tail -f /var/log/escapeplan/error.log
  ```

- [ ] **Check Database Growth**
  ```bash
  watch -n 60 'ls -lh /var/lib/escapeplan/escapeplan.db'
  ```

- [ ] **Monitor API Response Times**
  ```bash
  # Use APM tool or:
  curl -w "@curl-format.txt" -o /dev/null -s http://localhost:4000/api/admin/users
  ```

- [ ] **User Feedback Collection**
  - Check support tickets
  - Monitor Sentry/error tracking
  - Review analytics

---

## Rollback Procedure

**If Critical Issues Arise:**

1. [ ] **Stop API Server**
   ```bash
   systemctl stop escapeplan-api
   ```

2. [ ] **Restore Database Backup**
   ```bash
   BACKUP=$(ls -t /var/lib/escapeplan/escapeplan.db.backup-* | head -1)
   cp "$BACKUP" /var/lib/escapeplan/escapeplan.db
   ```

3. [ ] **Revert Code**
   ```bash
   git revert HEAD~5..HEAD
   pnpm install
   pnpm build
   ```

4. [ ] **Restart API Server**
   ```bash
   systemctl start escapeplan-api
   ```

5. [ ] **Verify Rollback**
   ```bash
   curl http://localhost:4000/api/admin/operators  # Old endpoint should work
   sqlite3 /var/lib/escapeplan/escapeplan.db "SELECT COUNT(*) FROM operators;"
   ```

6. [ ] **Notify Stakeholders**
   - Email team
   - Update status page
   - Plan retry

---

## Success Criteria

✅ **Database:**
- [ ] Tables renamed successfully
- [ ] No orphaned foreign keys
- [ ] Triggers functioning
- [ ] Row counts match pre-migration

✅ **API:**
- [ ] All endpoints return correct data
- [ ] Permission checks work
- [ ] Better Auth session includes custom fields
- [ ] No 500 errors in logs

✅ **Frontend:**
- [ ] No TypeScript errors
- [ ] All components render
- [ ] User type differentiation visible
- [ ] Route guards working

✅ **Tests:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing complete
- [ ] Performance unchanged

---

## Timeline

**Development:** 2-3 days (16-20 hours)

**Day 1 (8 hours):**
- Morning: Phase 1 (schema prep)
- Afternoon: Phase 2 (table renaming)

**Day 2 (8 hours):**
- Morning: Phase 3 (API updates)
- Afternoon: Phase 4 (frontend updates)

**Day 3 (4 hours):**
- Morning: Phase 5 (testing)
- Afternoon: Phase 6 (cleanup)

**Deployment:** 30 minutes (during low-traffic window)

**Monitoring:** 1 week post-deployment

---

## Conclusion

**This implementation plan provides a complete, step-by-step guide** to migrating from `operators` to `user` table with full Better Auth alignment.

**Follow this checklist carefully** to ensure a smooth, error-free migration.

**Next Steps:**
1. Review all 5 research documents
2. Get stakeholder approval
3. Schedule migration window
4. Execute Phase 1

---

**Document Version:** 1.0
**Author:** Claude Research Agent
**Status:** ✅ Implementation Plan Complete
**Total Research Documents:** 5/5 ✅
