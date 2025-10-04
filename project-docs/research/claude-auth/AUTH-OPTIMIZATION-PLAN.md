# Auth Optimization Plan - EscapePlan System Refactor

**Date:** 2025-10-03
**Status:** 🚀 **ACTIVE - INITIAL DEVELOPMENT**
**Scope:** Complete auth system modernization (no backward compatibility required)
**Supersedes:** All previous migration documents (00-05, user-schema-refactor-plan.md)

---

## 🎯 Executive Summary

**Context:** Initial development phase - no production users, no legacy data to preserve.

**Goal:** Modernize auth system to align with Better Auth v1.3.24+ best practices and prepare for customer portal.

**Approach:** Direct implementation (not migration) - no redirects, no aliases, no transition period.

**Timeline:** 2-3 days of focused development.

---

## 📊 Current State vs Target State

| Aspect | Current (Problematic) | Target (Optimized) |
|--------|----------------------|-------------------|
| **Table Name** | `operators` | `user` (singular) |
| **Session Table** | `operator_auth_sessions` | `session` |
| **Account Table** | `operator_accounts` | `account` |
| **Verification Table** | `operator_verifications` | `verification` |
| **User Segmentation** | None (operators only) | `user_type` field ('operator' \| 'customer') |
| **Role System** | Dual (string `role` + FK `role_id`) | Single (`role_id` FK only) |
| **Permissions** | Dual (JSON array + junction table) | Junction table only (database-driven) |
| **Better Auth Config** | Plural overrides with `modelName` | Native singular tables, proper `additionalFields` |
| **RBAC Source** | Mixed (hardcoded + database) | Pure database-driven |

---

## 🗂️ Phase 1: Schema Refactor (3 hours)

### Step 1.1: Drop Existing Schema (Clean Slate)

**Action:** Since we're in initial dev, completely rebuild the schema.

**File:** `packages/contracts/src/schema.ts`

**Changes:**

```typescript
// ============================================================================
// AUTH & USERS (REFACTORED)
// ============================================================================

// Enhanced RBAC: Roles with user_type scope
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  user_type_scope: text('user_type_scope').notNull().default('operator'), // 'operator' | 'customer' | 'both'
  is_system: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Enhanced RBAC: Permissions with user_type scope
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  label: text('label').notNull(),
  category: text('category').notNull(), // dashboard, bookings, sessions, games, network, users, rbac, storage, cameras, system
  user_type_scope: text('user_type_scope').notNull().default('operator'), // 'operator' | 'customer' | 'both'
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Enhanced RBAC: Role-Permission junction
export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: text('id').primaryKey(),
    role_id: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    permission_id: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
    granted_at: text('granted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    granted_by: text('granted_by').references(() => user.id) // UPDATED: references user.id
  },
  (table) => ({
    uniqueRolePermission: index('idx_role_permission_unique').on(table.role_id, table.permission_id)
  })
);

// REFACTORED: Unified user table
export const user = sqliteTable('user', {
  // Primary Key
  id: text('id').primaryKey(),

  // Better Auth Core Fields (minimal required)
  name: text('name').notNull(),
  email: text('email').unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'), // Better Auth expects this field name
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),

  // EscapePlan Custom Fields
  username: text('username').notNull().unique(),
  user_type: text('user_type').notNull().default('operator'), // 'operator' | 'customer'

  // RBAC (database-driven only, no string role or JSON permissions)
  role_id: text('role_id').notNull().references(() => roles.id, { onDelete: 'restrict' }),

  // Operator-Specific Fields (NULL for customers)
  bio: text('bio'),
  avatar_config: text('avatar_config', { mode: 'json' }),
  must_reset_password: integer('must_reset_password', { mode: 'boolean' }).notNull().default(false),

  // Customer-Specific Fields (NULL for operators)
  loyalty_points: integer('loyalty_points').default(0),
  preferred_difficulty: text('preferred_difficulty'),
  marketing_opted_in: integer('marketing_opted_in', { mode: 'boolean' }).default(false),

  // Security Fields (shared)
  password_hash: text('password_hash'),
  last_login_at: text('last_login_at'),
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  ban_reason: text('ban_reason'),
  ban_expires: text('ban_expires'),

  // Soft Delete
  archived_at: text('archived_at'),
  archived_by: text('archived_by').references(() => user.id), // Self-reference
  archived_reason: text('archived_reason')
}, (table) => ({
  userTypeIdx: index('idx_user_type').on(table.user_type),
  emailIdx: index('idx_user_email').on(table.email),
  usernameIdx: index('idx_user_username').on(table.username)
}));

// Better Auth Tables (renamed to singular)
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: text('expiresAt').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  impersonatedBy: text('impersonatedBy').references(() => user.id)
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: text('accessTokenExpiresAt'),
  refreshTokenExpiresAt: text('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: text('expiresAt').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`)
});
```

---

### Step 1.2: Update All Foreign Key References

**Action:** Find and replace all `operators.id` references with `user.id`.

**Files to Update:**
- `packages/contracts/src/schema.ts` (games, bookings, assets, alerts, backups, etc.)

**Examples:**

```typescript
// Games table
export const games = sqliteTable('games', {
  // ...existing fields...
  archived_by: text('archived_by').references(() => user.id), // UPDATED
});

// Assets table
export const assets = sqliteTable('assets', {
  // ...existing fields...
  uploaded_by: text('uploaded_by').notNull().references(() => user.id), // UPDATED
});

// Alerts table
export const alerts = sqliteTable('alerts', {
  // ...existing fields...
  dismissed_by: text('dismissed_by').references(() => user.id), // UPDATED
});

// Backups table
export const backups = sqliteTable('backups', {
  // ...existing fields...
  created_by: text('created_by').notNull().references(() => user.id), // UPDATED
});

// System Settings table
export const systemSettings = sqliteTable('system_settings', {
  // ...existing fields...
  updated_by: text('updated_by').references(() => user.id), // UPDATED
});

// Session Milestones table
export const sessionMilestones = sqliteTable('session_milestones', {
  // ...existing fields...
  triggered_by: text('triggered_by').references(() => user.id), // UPDATED
});

// Bookings table (prepare for customer accounts)
export const bookings = sqliteTable('bookings', {
  // ...existing fields...
  customer_id: text('customer_id').references(() => user.id), // NEW: nullable for walk-ins
  contact_name: text('contact_name').notNull(),
  contact_phone: text('contact_phone').notNull(),
  // ...rest...
});
```

---

### Step 1.3: Add Database Triggers for Security

**Action:** Create trigger SQL file for automatic enforcement.

**File:** `apps/escapeplan-api/drizzle/triggers.sql`

```sql
-- =============================================================================
-- SECURITY TRIGGERS FOR USER_TYPE ENFORCEMENT
-- =============================================================================

-- Trigger 1: Prevent customers from having operator roles
DROP TRIGGER IF EXISTS prevent_customer_operator_role;
CREATE TRIGGER prevent_customer_operator_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'customer'
  AND NEW.role_id IN (
    SELECT id FROM roles WHERE user_type_scope = 'operator'
  )
BEGIN
  SELECT RAISE(ABORT, 'Customers cannot have operator-only roles');
END;

-- Trigger 2: Prevent operators from having customer-only roles
DROP TRIGGER IF EXISTS prevent_operator_customer_role;
CREATE TRIGGER prevent_operator_customer_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'operator'
  AND NEW.role_id IN (
    SELECT id FROM roles WHERE user_type_scope = 'customer' AND name = 'customer'
  )
BEGIN
  SELECT RAISE(ABORT, 'Operators cannot have customer-only roles');
END;

-- Trigger 3: Prevent user_type changes (immutable after creation)
DROP TRIGGER IF EXISTS prevent_user_type_change;
CREATE TRIGGER prevent_user_type_change
BEFORE UPDATE OF user_type ON user
WHEN OLD.user_type != NEW.user_type
BEGIN
  SELECT RAISE(ABORT, 'User type cannot be changed after creation');
END;

-- Trigger 4: Prevent role assignment outside user_type scope
DROP TRIGGER IF EXISTS enforce_role_user_type_scope;
CREATE TRIGGER enforce_role_user_type_scope
BEFORE INSERT ON user
WHEN NEW.role_id NOT IN (
  SELECT id FROM roles WHERE user_type_scope IN (NEW.user_type, 'both')
)
BEGIN
  SELECT RAISE(ABORT, 'Role not allowed for this user type');
END;

-- Trigger 5: Prevent role updates outside user_type scope
DROP TRIGGER IF EXISTS enforce_role_user_type_scope_update;
CREATE TRIGGER enforce_role_user_type_scope_update
BEFORE UPDATE OF role_id ON user
WHEN NEW.role_id NOT IN (
  SELECT id FROM roles WHERE user_type_scope IN (NEW.user_type, 'both')
)
BEGIN
  SELECT RAISE(ABORT, 'Role not allowed for this user type');
END;
```

---

### Step 1.4: Rebuild Database from Scratch

**Action:** Since we're in dev, drop and recreate the database.

```bash
cd apps/escapeplan-api

# Backup current dev database (just in case)
cp data/escapeplan.db data/escapeplan.db.backup-before-refactor

# Delete database to force clean rebuild
rm -f data/escapeplan.db data/escapeplan.db-shm data/escapeplan.db-wal

# Generate fresh migrations from new schema
pnpm --filter @escapeplan/contracts build
npx drizzle-kit generate

# Apply migrations (creates new database)
npx drizzle-kit migrate

# Apply security triggers
sqlite3 data/escapeplan.db < drizzle/triggers.sql

# Seed with updated data
pnpm db:seed
```

---

## 🔧 Phase 2: Better Auth Configuration (2 hours)

### Step 2.1: Refactor `auth-config.ts`

**File:** `apps/escapeplan-api/src/auth-config.ts`

**Complete replacement:**

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, customSession, username } from 'better-auth/plugins';
import argon2 from 'argon2';
import type { BetterAuthOptions } from 'better-auth';
import type { OperatorPermission, OperatorRole } from '@escapeplan/contracts';
import { db, sqlite } from './db/client.js';
import { user, session, account, verification } from '@escapeplan/contracts';

const DEFAULT_BASE_URL = process.env.AUTH_BASE_URL ?? 'http://localhost:4000/api/auth';
const WEB_ORIGIN = process.env.WEB_APP_ORIGIN ?? 'http://localhost:5173';

export type EscapePlanAuthOptions = BetterAuthOptions;

function buildBaseOptions(): BetterAuthOptions {
  const database = drizzleAdapterWithSerialization(db, {
    schema: {
      user,      // Native singular table (no modelName override needed)
      session,   // Native singular table
      account,   // Native singular table
      verification // Native singular table
    },
    provider: 'sqlite'
  });

  return {
    baseURL: DEFAULT_BASE_URL,
    trustedOrigins: [WEB_ORIGIN],
    database,
    user: {
      // NO modelName override - native singular table names
      additionalFields: {
        username: {
          type: 'string',
          fieldName: 'username',
          required: true,
          returned: true,
          input: true
        },
        user_type: {
          type: 'string',
          fieldName: 'user_type',
          required: true,
          returned: true,
          input: false,  // Server-managed only
          defaultValue: 'operator'
        },
        role_id: {
          type: 'string',
          fieldName: 'role_id',
          required: true,
          returned: true,
          input: false,  // Server-managed only
          defaultValue: 'role-manager'
        },
        bio: {
          type: 'string',
          fieldName: 'bio',
          required: false,
          returned: true,
          input: true
        },
        avatar_config: {
          type: 'string',  // JSON stringified
          fieldName: 'avatar_config',
          required: false,
          returned: true,
          input: true
        },
        must_reset_password: {
          type: 'boolean',
          fieldName: 'must_reset_password',
          required: false,
          returned: true,
          input: false,
          defaultValue: false
        },
        loyalty_points: {
          type: 'number',
          fieldName: 'loyalty_points',
          required: false,
          returned: true,
          input: false  // Server-managed only
        },
        preferred_difficulty: {
          type: 'string',
          fieldName: 'preferred_difficulty',
          required: false,
          returned: true,
          input: true
        },
        marketing_opted_in: {
          type: 'boolean',
          fieldName: 'marketing_opted_in',
          required: false,
          returned: true,
          input: true,
          defaultValue: false
        },
        last_login_at: {
          type: 'string',
          fieldName: 'last_login_at',
          required: false,
          returned: true,
          input: false
        },
        banned: {
          type: 'boolean',
          fieldName: 'banned',
          required: false,
          returned: true,
          input: false,
          defaultValue: false
        },
        ban_reason: {
          type: 'string',
          fieldName: 'ban_reason',
          required: false,
          returned: true,
          input: false
        },
        ban_expires: {
          type: 'string',
          fieldName: 'ban_expires',
          required: false,
          returned: true,
          input: false
        },
        archived_at: {
          type: 'string',
          fieldName: 'archived_at',
          required: false,
          returned: true,
          input: false
        },
        archived_by: {
          type: 'string',
          fieldName: 'archived_by',
          required: false,
          returned: true,
          input: false
        },
        archived_reason: {
          type: 'string',
          fieldName: 'archived_reason',
          required: false,
          returned: true,
          input: false
        }
      }
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 12,
      password: {
        hash: async (password) =>
          argon2.hash(password, { type: argon2.argon2id }),
        verify: async ({ hash, password }) => argon2.verify(hash, password)
      }
    },
    advanced: {
      useSecureCookies: false
    },
    plugins: [
      username({
        minUsernameLength: 4,
        maxUsernameLength: 64,
        usernameNormalization: (value) => value.trim().toLowerCase()
      }),
      admin({
        defaultRole: 'manager',
        adminRoles: ['admin']
      }),
      customSession(async ({ user, session }) => {
        const enrichedUser = user as Record<string, unknown> & {
          id: string;
          user_type?: string;
          role_id?: string;
          archived_at?: string | null;
          image?: unknown;
        };

        // Block archived users
        if (enrichedUser.archived_at) {
          throw new Error('Account is archived');
        }

        // Derive permissions from role_id (database-driven RBAC)
        const permissions = await getUserPermissionsFromDB(enrichedUser.id);

        // Get role details
        const role = await getRoleFromDB(enrichedUser.role_id);

        // Transform Better Auth's 'image' field to 'avatarConfig' for frontend compatibility
        let avatarConfig;
        if (enrichedUser.image) {
          try {
            avatarConfig = typeof enrichedUser.image === 'string'
              ? JSON.parse(enrichedUser.image)
              : enrichedUser.image;
          } catch {
            avatarConfig = undefined;
          }
        }

        const { image, ...userWithoutImage } = enrichedUser;

        return {
          user: {
            ...userWithoutImage,
            role: role?.name || 'unknown',  // Normalized role name for frontend
            permissions,  // Array of permission names
            avatarConfig
          },
          session
        };
      })
    ]
  } satisfies BetterAuthOptions;
}

// Helper: Get permissions from database
async function getUserPermissionsFromDB(userId: string): Promise<string[]> {
  const result = sqlite.prepare(`
    SELECT DISTINCT p.name
    FROM user u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = ?
  `).all(userId) as { name: string }[];

  return result.map(row => row.name);
}

// Helper: Get role from database
async function getRoleFromDB(roleId: string | undefined): Promise<{ id: string; name: string } | null> {
  if (!roleId) return null;

  const result = sqlite.prepare(`
    SELECT id, name FROM roles WHERE id = ? LIMIT 1
  `).get(roleId) as { id: string; name: string } | undefined;

  return result || null;
}

export function createAuth(overrides: Partial<BetterAuthOptions> = {}) {
  const base = buildBaseOptions();
  const mergedPlugins = [
    ...(base.plugins ?? []),
    ...(overrides.plugins ?? [])
  ];

  return betterAuth({
    ...base,
    ...overrides,
    plugins: mergedPlugins
  });
}

export type EscapePlanAuthInstance = ReturnType<typeof createAuth>;
export type { OperatorRole, OperatorPermission };
export { DEFAULT_BASE_URL, WEB_ORIGIN };

function serializeDates(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeDates(entry));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeDates(entry)])
    );
  }
  return value;
}

function drizzleAdapterWithSerialization(...params: Parameters<typeof drizzleAdapter>) {
  const baseFactory = drizzleAdapter(...params);
  return (options: Parameters<ReturnType<typeof drizzleAdapter>>[0]) => {
    const baseAdapter = baseFactory(options);
    return {
      ...baseAdapter,
      create: async (args: Parameters<typeof baseAdapter.create>[0]) => {
        const data = args.data ? (serializeDates(args.data) as typeof args.data) : args.data;
        return baseAdapter.create({ ...args, data });
      },
      update: async (args: Parameters<typeof baseAdapter.update>[0]) => {
        const withTimestamp =
          args.update && typeof args.update === 'object' && !Array.isArray(args.update) && !('updatedAt' in args.update)
            ? ({ ...args.update, updatedAt: new Date() } as typeof args.update)
            : args.update;
        const update = withTimestamp ? (serializeDates(withTimestamp) as typeof withTimestamp) : withTimestamp;
        return baseAdapter.update({ ...args, update });
      },
      updateMany: async (args: Parameters<typeof baseAdapter.updateMany>[0]) => {
        const withTimestamp =
          args.update && typeof args.update === 'object' && !Array.isArray(args.update) && !('updatedAt' in args.update)
            ? ({ ...args.update, updatedAt: new Date() } as typeof args.update)
            : args.update;
        const update = withTimestamp ? (serializeDates(withTimestamp) as typeof withTimestamp) : withTimestamp;
        return baseAdapter.updateMany({ ...args, update });
      }
    };
  };
}
```

---

## 🛠️ Phase 3: API Layer Refactor (4 hours)

### Step 3.1: Update `state.ts` Functions

**File:** `apps/escapeplan-api/src/state.ts`

**Find and replace across entire file:**
- `operators` → `user`
- `operatorAuthSessions` → `session`
- `operatorAccounts` → `account`
- `operatorVerifications` → `verification`
- `getOperatorById` → `getUserById`
- `listOperators` → `listUsers`
- `createOperator` → `createUser`
- `updateOperator` → `updateUser`
- `deleteOperator` → `deleteUser` (or `archiveUser`)

**Add new permission helper functions:**

```typescript
// Permission Helpers (database-driven RBAC)
export async function getUserPermissions(userId: string): Promise<string[]> {
  const result = await db
    .select({ name: permissions.name })
    .from(user)
    .where(eq(user.id, userId))
    .innerJoin(roles, eq(user.role_id, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.role_id))
    .innerJoin(permissions, eq(rolePermissions.permission_id, permissions.id));

  return result.map(row => row.name);
}

export async function userHasPermission(userId: string, permissionName: string): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return userPermissions.includes(permissionName);
}

export async function requirePermission(userId: string, permissionName: string): Promise<void> {
  const hasPermission = await userHasPermission(userId, permissionName);
  if (!hasPermission) {
    throw new Error(`Permission denied: ${permissionName}`);
  }
}

// User Type Guards
export function isOperator(userType: string): boolean {
  return userType === 'operator';
}

export function isCustomer(userType: string): boolean {
  return userType === 'customer';
}

export async function requireOperator(userId: string): Promise<void> {
  const userData = await getUserById(userId);
  if (!userData || !isOperator(userData.user_type)) {
    throw new Error('Operator access required');
  }
}
```

---

### Step 3.2: Update API Endpoints

**File:** `apps/escapeplan-api/src/index.ts`

**Changes:**
1. Update imports from `operators` → `user`
2. Rename endpoints: `/admin/operators` → `/admin/users`
3. Replace permission checks with `requirePermission()` calls

**Example:**

```typescript
// User Management Endpoints (was /admin/operators)
api.get('/admin/users', async (request, reply) => {
  await requirePermission(request.user.id, 'view_users');
  const users = await listUsers();
  return users;
});

api.get('/admin/users/me', async (request, reply) => {
  const user = await getUserById(request.user.id);
  return user;
});

api.post('/admin/users', async (request, reply) => {
  await requirePermission(request.user.id, 'create_users');
  const validated = createUserSchema.parse(request.body);
  const newUser = await createUser(validated);
  return newUser;
});

api.put('/admin/users/:id', async (request, reply) => {
  await requirePermission(request.user.id, 'edit_users');
  const { id } = request.params;
  const validated = updateUserSchema.parse(request.body);
  const updated = await updateUser(id, validated);
  return updated;
});

api.delete('/admin/users/:id', async (request, reply) => {
  await requirePermission(request.user.id, 'delete_users');
  const { id } = request.params;
  await archiveUser(id, request.user.id);
  return { success: true };
});
```

**Update all other endpoints that reference operators:**
- Search entire file for `operators`, `operator`, `getOperator`, etc.
- Replace with `user`, `getUser`, etc.

---

### Step 3.3: Update Validation Schemas

**File:** `packages/contracts/src/validation.ts` (or wherever Zod schemas live)

```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  name: z.string().min(1),
  email: z.string().email().optional(),
  user_type: z.enum(['operator', 'customer']).default('operator'),
  role_id: z.string().uuid(),
  bio: z.string().optional(),
  avatar_config: z.object({}).optional(),
  must_reset_password: z.boolean().default(false)
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  bio: z.string().optional(),
  avatar_config: z.object({}).optional(),
  role_id: z.string().uuid().optional()
});

export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

// Export types
export type UserType = 'operator' | 'customer';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  user_type: UserType;
  role_id: string;
  bio: string | null;
  avatar_config: object | null;
  must_reset_password: boolean;
  loyalty_points: number | null;
  preferred_difficulty: string | null;
  marketing_opted_in: boolean | null;
  last_login_at: string | null;
  banned: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Rebuild contracts:**

```bash
pnpm --filter @escapeplan/contracts build
```

---

### Step 3.4: Update Seed Scripts

**File:** `apps/escapeplan-api/src/db/seeds/*.ts` (all seed files)

**Changes:**
1. Replace `operators` with `user` in all inserts
2. Add `user_type: 'operator'` to all user records
3. Update `role_id` references to use updated role IDs
4. Remove `role` string field and `permissions` JSON field

**Example:**

```typescript
// Create admin user
await db.insert(user).values({
  id: 'user-admin-001',
  username: 'admin',
  name: 'System Administrator',
  email: 'admin@escapeplan.local',
  emailVerified: true,
  user_type: 'operator',  // NEW
  role_id: 'role-admin',
  password_hash: await hashPassword('admin123456789'),
  must_reset_password: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Create manager user
await db.insert(user).values({
  id: 'user-manager-001',
  username: 'manager',
  name: 'Operations Manager',
  email: 'manager@escapeplan.local',
  emailVerified: true,
  user_type: 'operator',  // NEW
  role_id: 'role-manager',
  password_hash: await hashPassword('manager123456789'),
  must_reset_password: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});
```

**Update role seeds to include `user_type_scope`:**

```typescript
await db.insert(roles).values([
  {
    id: 'role-admin',
    name: 'admin',
    description: 'Full system access',
    user_type_scope: 'operator',  // NEW
    is_system: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'role-manager',
    name: 'manager',
    description: 'Manage bookings and sessions',
    user_type_scope: 'operator',  // NEW
    is_system: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'role-game-master',
    name: 'game_master',
    description: 'Run and monitor game sessions',
    user_type_scope: 'operator',  // NEW
    is_system: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'role-customer',
    name: 'customer',
    description: 'Book and play games',
    user_type_scope: 'customer',  // NEW
    is_system: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]);
```

**Update permission seeds to include `user_type_scope`:**

```typescript
await db.insert(permissions).values([
  // Operator-only permissions
  {
    id: 'perm-view-dashboard',
    name: 'view_dashboard',
    label: 'View Dashboard',
    category: 'dashboard',
    user_type_scope: 'operator',  // NEW
    description: 'Access to operator dashboard',
    created_at: new Date().toISOString()
  },
  {
    id: 'perm-manage-games',
    name: 'manage_games',
    label: 'Manage Games',
    category: 'games',
    user_type_scope: 'operator',  // NEW
    description: 'Create, edit, and archive games',
    created_at: new Date().toISOString()
  },
  // ... more operator permissions ...

  // Customer permissions (future)
  {
    id: 'perm-view-catalog',
    name: 'view_catalog',
    label: 'View Game Catalog',
    category: 'catalog',
    user_type_scope: 'customer',  // NEW
    description: 'Browse available games',
    created_at: new Date().toISOString()
  },
  {
    id: 'perm-create-booking',
    name: 'create_booking',
    label: 'Create Booking',
    category: 'bookings',
    user_type_scope: 'customer',  // NEW
    description: 'Book game sessions',
    created_at: new Date().toISOString()
  },

  // Shared permissions
  {
    id: 'perm-view-profile',
    name: 'view_profile',
    label: 'View Profile',
    category: 'profile',
    user_type_scope: 'both',  // NEW
    description: 'View own profile',
    created_at: new Date().toISOString()
  },
  {
    id: 'perm-edit-profile',
    name: 'edit_profile',
    label: 'Edit Profile',
    category: 'profile',
    user_type_scope: 'both',  // NEW
    description: 'Update own profile',
    created_at: new Date().toISOString()
  }
]);
```

---

## 🎨 Phase 4: Frontend Refactor (4 hours)

### Step 4.1: Update Type Imports

**Find all files importing operator types:**

```bash
cd apps/escapeplan-web
rg "import.*Operator" src/
```

**Replace across all files:**

```typescript
// BEFORE:
import type { OperatorProfile, CreateOperatorRequest } from '@escapeplan/contracts';

// AFTER:
import type { UserProfile, CreateUserRequest } from '@escapeplan/contracts';
```

---

### Step 4.2: Update API Client Functions

**File:** `apps/escapeplan-web/src/lib/api/operators.ts`

**Rename file to:** `apps/escapeplan-web/src/lib/api/users.ts`

**Update all functions:**

```typescript
export async function fetchUsers(): Promise<UserProfile[]> {
  const response = await fetch('/api/admin/users');
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const response = await fetch('/api/admin/users/me');
  if (!response.ok) throw new Error('Failed to fetch current user');
  return response.json();
}

export async function createUser(data: CreateUserRequest): Promise<UserProfile> {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to create user');
  return response.json();
}

export async function updateUser(id: string, data: UpdateUserRequest): Promise<UserProfile> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update user');
  return response.json();
}

export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete user');
}
```

**Update imports in files that used the old API:**

```bash
rg "from.*api/operators" src/ --files-with-matches | xargs sed -i "s|from.*api/operators|from '\$lib/api/users'|g"
```

---

### Step 4.3: Update Route Guards

**File:** `apps/escapeplan-web/src/hooks.server.ts`

```typescript
import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({
    headers: event.request.headers
  });

  // Operator Routes - require operator user_type
  if (event.url.pathname.startsWith('/admin')) {
    if (!session?.user) {
      throw redirect(302, '/auth/sign-in?redirect=/admin');
    }

    // NEW: Check user_type field
    if (session.user.user_type !== 'operator') {
      throw redirect(302, '/customer/dashboard');
    }
  }

  // Customer Routes - require customer user_type (future implementation)
  if (event.url.pathname.startsWith('/customer')) {
    if (!session?.user) {
      throw redirect(302, '/auth/sign-in?redirect=/customer');
    }

    // NEW: Check user_type field
    if (session.user.user_type !== 'customer') {
      throw redirect(302, '/admin/dashboard');
    }
  }

  // Attach session to locals
  event.locals.user = session?.user || null;
  event.locals.session = session || null;

  return resolve(event);
}
```

**Update app.d.ts:**

```typescript
// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      user: import('@escapeplan/contracts').UserProfile | null;
      session: import('better-auth').Session | null;
    }
    // interface Error {}
    // interface PageData {}
    // interface Platform {}
  }
}

export {};
```

---

### Step 4.4: Rename Routes and Components

**Routes to rename:**

```bash
cd apps/escapeplan-web/src/routes

# Rename operator routes to user routes
mv '(app)/admin/operators' '(app)/admin/users'

# Update all page files inside
find '(app)/admin/users' -name "*.svelte" -o -name "*.ts"
```

**Component updates:**

```bash
# Find all Svelte components referencing operators
cd apps/escapeplan-web/src/lib/components
rg "operator" -l --type-add 'svelte:*.svelte' --type svelte

# Manually update each component:
# - Replace `operator` variable names with `user`
# - Replace `OperatorProfile` types with `UserProfile`
# - Update prop names
# - Update display labels (if you want "User" instead of "Operator" in UI)
```

**Example component refactor:**

```svelte
<!-- BEFORE: OperatorCard.svelte -->
<script lang="ts">
  import type { OperatorProfile } from '@escapeplan/contracts';
  export let operator: OperatorProfile;
</script>

<div class="operator-card">
  <h3>{operator.name}</h3>
  <p>{operator.email}</p>
  <span class="badge">{operator.role}</span>
</div>

<!-- AFTER: UserCard.svelte -->
<script lang="ts">
  import type { UserProfile } from '@escapeplan/contracts';
  export let user: UserProfile;
</script>

<div class="user-card">
  <h3>{user.name}</h3>
  <p>{user.email}</p>
  <span class="badge badge-{user.user_type}">{user.user_type}</span>
  <span class="badge">{user.role}</span>
</div>
```

---

## 🧪 Phase 5: Testing & Validation (3 hours)

### Step 5.1: Unit Tests

**Update test files:**

```bash
cd apps/escapeplan-api
find src -name "*.test.ts" -exec grep -l "operator" {} \;
```

**Update test fixtures:**

```typescript
// tests/fixtures/users.ts (was: operators.ts)
export const mockUser: UserProfile = {
  id: 'user-test-001',
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  user_type: 'operator',  // NEW
  role_id: 'role-admin',
  bio: null,
  avatar_config: null,
  must_reset_password: false,
  loyalty_points: null,
  preferred_difficulty: null,
  marketing_opted_in: null,
  last_login_at: null,
  banned: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const mockCustomer: UserProfile = {
  id: 'user-customer-001',
  username: 'customer1',
  name: 'Test Customer',
  email: 'customer@example.com',
  emailVerified: true,
  user_type: 'customer',  // NEW
  role_id: 'role-customer',
  bio: null,
  avatar_config: null,
  must_reset_password: false,
  loyalty_points: 0,
  preferred_difficulty: 'medium',
  marketing_opted_in: true,
  last_login_at: null,
  banned: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
```

**Run tests:**

```bash
pnpm --filter escapeplan-api test
```

---

### Step 5.2: Integration Tests

**Test checklist:**

- [ ] **User CRUD Operations**
  ```bash
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
  ```

- [ ] **Authentication Flow**
  ```bash
  curl -X POST http://localhost:4000/api/auth/sign-in/email \
    -H "Content-Type: application/json" \
    -d '{ "email": "admin@escapeplan.local", "password": "admin123456789" }'
  ```

- [ ] **Session Custom Fields**
  ```bash
  curl http://localhost:4000/api/auth/get-session \
    -H "Cookie: better-auth.session_token=..."
  # Verify response includes: user_type, role_id, permissions (derived)
  ```

- [ ] **Permission System**
  ```bash
  # Test permission check
  curl http://localhost:4000/api/admin/games \
    -H "Cookie: better-auth.session_token=..."
  # Should succeed if user has 'manage_games' permission
  ```

- [ ] **Database Triggers**
  ```bash
  # Try to create customer with operator role (should fail)
  sqlite3 data/escapeplan.db <<EOF
  INSERT INTO user (id, user_type, role_id, username, name, emailVerified, createdAt, updatedAt)
  VALUES ('test-trigger', 'customer', 'role-admin', 'baduser', 'Bad User', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  EOF
  # Expected: Error: Customers cannot have operator-only roles
  ```

---

### Step 5.3: Manual UI Testing

**Checklist:**

- [ ] Login as admin (`admin@escapeplan.local`)
- [ ] Navigate to `/admin/users`
- [ ] Verify user list displays with `user_type` badge
- [ ] Create new operator user
  - Verify `user_type` field shows in form
  - Verify role dropdown only shows operator-scoped roles
  - Verify user is created successfully
- [ ] Edit user
  - Update bio
  - Change role
  - Verify changes saved
- [ ] Test permissions
  - Login as non-admin (manager)
  - Verify restricted actions are blocked (e.g., manage users)
  - Verify allowed actions work (e.g., manage bookings)

---

### Step 5.4: Database Integrity Checks

```bash
sqlite3 data/escapeplan.db <<EOF
-- Verify no orphaned records
SELECT 'Orphaned assets.uploaded_by' AS issue, COUNT(*) AS count
FROM assets WHERE uploaded_by NOT IN (SELECT id FROM user);

SELECT 'Orphaned session.userId' AS issue, COUNT(*) AS count
FROM session WHERE userId NOT IN (SELECT id FROM user);

-- Check user_type distribution
SELECT user_type, COUNT(*) FROM user GROUP BY user_type;

-- Check role distribution
SELECT r.name, r.user_type_scope, COUNT(u.id) as user_count
FROM roles r
LEFT JOIN user u ON r.id = u.role_id
GROUP BY r.id;

-- Verify triggers exist
SELECT name FROM sqlite_master WHERE type = 'trigger';
EOF
```

**Expected results:**
- 0 orphaned records
- All users have `user_type = 'operator'` (for now)
- 5 triggers exist (prevent_customer_operator_role, etc.)

---

## 📚 Phase 6: Documentation Updates (1 hour)

### Step 6.1: Update CLAUDE.md

**File:** `CLAUDE.md`

**Changes:**

```markdown
### Authentication & Authorization
- Uses **Better Auth v1.3** with Drizzle SQLite adapter
- Session tokens stored in HttpOnly cookies (`better-auth.session_token`)
- Custom RBAC system with database-driven roles and permissions
- **User Types:** `operator` (staff) and `customer` (players)
- **System Roles:** `admin`, `manager`, `game_master` (operators) and `customer`
- Permissions defined in database via `roles` → `role_permissions` → `permissions` junction
- API routes protected via `requirePermission()` middleware
- SvelteKit enforces auth + user_type in `hooks.server.ts`

### Database Layer
- **SQLite** with WAL mode at `apps/escapeplan-api/data/escapeplan.db`
- **Drizzle ORM** schema in `packages/contracts/src/schema.ts`
- Migrations in `apps/escapeplan-api/drizzle/*.sql`
- **Core Auth Tables:** `user`, `session`, `account`, `verification`
- **RBAC Tables:** `roles`, `permissions`, `role_permissions`
- **Security:** Database triggers enforce user_type/role boundaries
- All tables use TEXT UUID primary keys

### API Surface
- Base URL: `/api` (proxied by nginx in production)
- Auth endpoints: `/api/auth/*` (handled by Better Auth)
- **Users:** `/api/admin/users`, `/api/admin/users/me`
- Games: `/api/admin/games`, `/api/admin/games/:id`
- Bookings: `/api/bookings?date=YYYY-MM-DD&scope=all|mobile`
- Sessions: `/api/sessions`, `/api/sessions/:id/commands`
- Dashboard: `/api/dashboard` (aggregated session/booking status)

### Client-Side Routing
- `(auth)` group: `/login`, `/logout` (public)
- `(app)` group: protected routes requiring `user_type = 'operator'`
  - `/admin/dashboard` - Active sessions grid
  - `/admin/bookings` - Calendar view
  - `/admin/games` - Game library
  - `/admin/users` - User management
  - `/admin/network` - Network configuration
- `(customer)` group: protected routes requiring `user_type = 'customer'` (future)
  - `/customer/catalog` - Browse games
  - `/customer/dashboard` - Customer bookings
```

---

### Step 6.2: Update DATABASE_SYSTEM.md

**File:** `apps/DOCS/DATABASE_SYSTEM.md`

**Replace operator references with user:**

```markdown
## Auth & Users

### user
Primary user table (operators and customers).

**Fields:**
- `id` (TEXT, PK) - UUID v4
- `username` (TEXT, UNIQUE, NOT NULL)
- `name` (TEXT, NOT NULL)
- `email` (TEXT, UNIQUE)
- `emailVerified` (BOOLEAN, NOT NULL, default false)
- `user_type` (TEXT, NOT NULL, default 'operator') - 'operator' | 'customer'
- `role_id` (TEXT, FK roles.id, NOT NULL)
- `bio` (TEXT)
- `avatar_config` (JSON)
- `must_reset_password` (BOOLEAN, default false)
- `loyalty_points` (INTEGER, default 0) - Customer only
- `preferred_difficulty` (TEXT) - Customer only
- `password_hash` (TEXT)
- `last_login_at` (TEXT)
- `banned` (BOOLEAN, default false)
- `createdAt`, `updatedAt` (TEXT, timestamps)
- Soft delete: `archived_at`, `archived_by`, `archived_reason`

**Indexes:**
- `idx_user_type` on `user_type`
- `idx_user_email` on `email`
- `idx_user_username` on `username`

**Triggers:**
- `prevent_customer_operator_role` - Blocks customers from operator roles
- `prevent_operator_customer_role` - Blocks operators from customer-only roles
- `prevent_user_type_change` - user_type is immutable
- `enforce_role_user_type_scope` - Validates role matches user_type

### session
Better Auth session tokens.

**Fields:**
- `id` (TEXT, PK)
- `token` (TEXT, UNIQUE, NOT NULL)
- `userId` (TEXT, FK user.id, NOT NULL)
- `expiresAt` (TEXT, NOT NULL)
- `ipAddress`, `userAgent` (TEXT)
- `impersonatedBy` (TEXT, FK user.id)
- `createdAt`, `updatedAt` (TEXT, timestamps)

### account
OAuth accounts (future social login).

**Fields:**
- `id` (TEXT, PK)
- `accountId`, `providerId` (TEXT, NOT NULL)
- `userId` (TEXT, FK user.id, NOT NULL)
- `accessToken`, `refreshToken`, `idToken` (TEXT)
- Token expiry fields
- `createdAt`, `updatedAt` (TEXT, timestamps)

### verification
Email verification tokens.

**Fields:**
- `id` (TEXT, PK)
- `identifier` (TEXT, NOT NULL) - Email address
- `value` (TEXT, NOT NULL) - Verification code
- `expiresAt` (TEXT, NOT NULL)
- `createdAt`, `updatedAt` (TEXT, timestamps)

## RBAC System

### roles
System and custom roles.

**Fields:**
- `id` (TEXT, PK)
- `name` (TEXT, UNIQUE, NOT NULL)
- `description` (TEXT)
- `user_type_scope` (TEXT, NOT NULL, default 'operator') - 'operator' | 'customer' | 'both'
- `is_system` (BOOLEAN, default false)
- `createdAt`, `updatedAt` (TEXT, timestamps)

**System Roles:**
- `admin` (operator) - Full access
- `manager` (operator) - Bookings, sessions, games
- `game_master` (operator) - Run sessions, send hints
- `customer` (customer) - Book and play games

### permissions
Granular permission definitions.

**Fields:**
- `id` (TEXT, PK)
- `name` (TEXT, UNIQUE, NOT NULL)
- `label` (TEXT, NOT NULL)
- `category` (TEXT, NOT NULL) - dashboard, bookings, sessions, games, users, etc.
- `user_type_scope` (TEXT, NOT NULL, default 'operator') - 'operator' | 'customer' | 'both'
- `description` (TEXT)
- `createdAt` (TEXT, timestamp)

### role_permissions
Many-to-many junction table.

**Fields:**
- `id` (TEXT, PK)
- `role_id` (TEXT, FK roles.id, NOT NULL, cascade delete)
- `permission_id` (TEXT, FK permissions.id, NOT NULL, cascade delete)
- `granted_at` (TEXT, timestamp)
- `granted_by` (TEXT, FK user.id)

**Index:** Unique on (role_id, permission_id)
```

---

### Step 6.3: Update API_CONTRACTS_SCHEMA_MANAGEMENT.md

**File:** `apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md`

**Update schema change examples:**

```markdown
## Making Schema Changes

### Example: Adding a new field to user table

1. **Update Schema** (`packages/contracts/src/schema.ts`)
   ```typescript
   export const user = sqliteTable('user', {
     // ...existing fields...
     new_field: text('new_field'), // ADD THIS
   });
   ```

2. **Generate Migration**
   ```bash
   cd apps/escapeplan-api
   npx drizzle-kit generate
   ```

3. **Review Generated SQL**
   ```bash
   cat drizzle/$(ls -t drizzle/*.sql | head -1)
   ```

4. **Apply Migration**
   ```bash
   npx drizzle-kit migrate
   ```

5. **Update Seed Scripts** (if needed)

6. **Rebuild Contracts**
   ```bash
   pnpm --filter @escapeplan/contracts build
   ```

7. **Update API/Frontend** (if new field exposed)
```

---

## ✅ Completion Checklist

### Phase 1: Schema ✅
- [ ] Updated `packages/contracts/src/schema.ts` with new user table
- [ ] Renamed all auth tables to singular (session, account, verification)
- [ ] Updated all foreign key references to `user.id`
- [ ] Added `user_type` field with indexes
- [ ] Added `user_type_scope` to roles and permissions
- [ ] Created database triggers for security enforcement
- [ ] Dropped old database and regenerated from scratch
- [ ] Applied security triggers
- [ ] Rebuilt contracts package

### Phase 2: Better Auth ✅
- [ ] Refactored `auth-config.ts` to use native singular tables
- [ ] Removed `modelName` overrides
- [ ] Updated `additionalFields` with proper config
- [ ] Added `user_type` to session enrichment
- [ ] Implemented database-driven permission derivation in `customSession`
- [ ] Tested auth flow and session generation

### Phase 3: API Layer ✅
- [ ] Updated `state.ts` with user function names
- [ ] Replaced all `operators` references with `user`
- [ ] Added permission helper functions
- [ ] Updated all API endpoints (`/admin/operators` → `/admin/users`)
- [ ] Replaced permission checks with `requirePermission()` calls
- [ ] Updated validation schemas (createUserSchema, etc.)
- [ ] Updated seed scripts with `user_type` field
- [ ] Updated role/permission seeds with `user_type_scope`
- [ ] Rebuilt contracts package
- [ ] Ran seed scripts successfully

### Phase 4: Frontend ✅
- [ ] Updated all type imports (OperatorProfile → UserProfile)
- [ ] Renamed API client file (operators.ts → users.ts)
- [ ] Updated all API client functions
- [ ] Updated route guards in `hooks.server.ts` with `user_type` check
- [ ] Updated `app.d.ts` with new types
- [ ] Renamed `/admin/operators` route to `/admin/users`
- [ ] Updated all Svelte components referencing operators
- [ ] Tested UI rendering with new types

### Phase 5: Testing ✅
- [ ] Updated unit test fixtures
- [ ] All unit tests passing
- [ ] Tested user CRUD API endpoints
- [ ] Tested authentication flow
- [ ] Verified session includes custom fields (user_type, role_id, permissions)
- [ ] Tested permission enforcement
- [ ] Tested database triggers (customer/operator role boundaries)
- [ ] Manual UI testing complete
- [ ] Database integrity checks passed (no orphaned records)

### Phase 6: Documentation ✅
- [ ] Updated CLAUDE.md with new auth system
- [ ] Updated DATABASE_SYSTEM.md with user table docs
- [ ] Updated API_CONTRACTS_SCHEMA_MANAGEMENT.md with examples
- [ ] Removed or archived old research documents (optional)

---

## 🚀 Deployment (Development)

**Since we're in initial dev, no special deployment needed:**

```bash
# Restart API server
pnpm --filter escapeplan-api dev

# Restart Web server
pnpm --filter escapeplan-web dev

# Test full flow
curl http://localhost:4000/api/admin/users \
  -H "Cookie: better-auth.session_token=..."
```

---

## 🎯 Future: Customer Portal Implementation

**After this refactor is complete, customer portal can be added by:**

1. **Enable customer registration** (public sign-up route)
2. **Create `/(customer)` route group** in SvelteKit
3. **Build customer dashboard** (bookings, profile)
4. **Link bookings to customer accounts** (`bookings.customer_id`)
5. **Implement customer-facing booking flow**

**Estimated effort:** 2-3 weeks for full customer portal.

---

## 📋 Post-Refactor Validation

Run these commands to verify everything works:

```bash
# 1. Verify database schema
sqlite3 data/escapeplan.db ".schema user"
sqlite3 data/escapeplan.db "SELECT name FROM sqlite_master WHERE type='trigger';"

# 2. Verify triggers work
sqlite3 data/escapeplan.db <<EOF
-- This should fail:
INSERT INTO user (id, user_type, role_id, username, name, emailVerified, createdAt, updatedAt)
VALUES ('test-1', 'customer', 'role-admin', 'test', 'Test', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
EOF

# 3. Test API
curl http://localhost:4000/api/admin/users

# 4. Run tests
pnpm --filter escapeplan-api test
pnpm --filter escapeplan-web test

# 5. Check types
pnpm --filter escapeplan-api lint
pnpm --filter escapeplan-web check
```

---

## 📝 Notes

**Key Differences from Migration Docs:**
- ❌ No backward compatibility (no aliases, no redirects)
- ❌ No session preservation concerns (fresh dev database)
- ❌ No phased rollout (all changes at once)
- ✅ Clean slate refactor
- ✅ Faster implementation (no transition period)
- ✅ Simpler testing (no legacy code paths)

**Tech Stack Compatibility:**
- ✅ Better Auth v1.3.24+ native patterns
- ✅ Drizzle ORM v0.44.5+ with proper migrations
- ✅ SQLite WAL mode preserved
- ✅ SvelteKit 2 + Svelte 5 runes compatible
- ✅ Fastify v5.6.1+ with proper hooks
- ✅ Offline-first PWA considerations maintained

**Status:** Ready for immediate implementation.

---

**Last Updated:** 2025-10-03
**Document Version:** 1.0
**Author:** Claude Code + User Collaboration
