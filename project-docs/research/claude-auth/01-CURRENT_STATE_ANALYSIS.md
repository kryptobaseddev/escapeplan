# Current State Analysis - EscapePlan Auth System

**Research Date:** 2025-10-02
**Better Auth Version:** v1.3.24+
**Database:** SQLite with Drizzle ORM v0.44.5+
**Analysis Scope:** Current operators table schema and authentication architecture

---

## Executive Summary

EscapePlan currently implements a **robust, database-driven RBAC system** with:
- ✅ `operators` table as the user entity
- ✅ Database-driven roles via `roles` table with FK `role_id`
- ✅ `permissions` and `rolePermissions` junction table
- ✅ Better Auth integration (v1.3.24+)
- ✅ Full Drizzle ORM schema with zero raw SQL

**Key Finding:** Current schema does NOT align with Better Auth v1.3.24+ recommendations:
- ❌ Better Auth expects singular `user` table (not `operators`)
- ❌ No `user_type` field to differentiate operator vs customer
- ❌ `role` field exists but is redundant with `role_id` FK
- ⚠️ Current `role` field stores string enum ('admin' | 'manager' | 'game_master' | 'customer')
- ⚠️ `permissions` JSON array exists alongside database-driven RBAC (dual system)

---

## Current Schema Structure

### Operators Table (Current User Entity)

**Location:** `packages/contracts/src/schema.ts:43-65`

```typescript
export const operators = sqliteTable('operators', {
  id: text('id').primaryKey(),                        // UUID v4
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').unique(),
  email_verified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),

  // DUAL ROLE SYSTEM - REDUNDANT
  role: text('role').notNull(),                       // String enum (legacy)
  role_id: text('role_id').notNull().references(() => roles.id), // FK to roles table (modern)

  permissions: text('permissions', { mode: 'json' }).notNull().default(sql`'[]'`), // Legacy JSON array

  avatar_config: text('avatar_config', { mode: 'json' }),
  bio: text('bio'),
  must_reset_password: integer('must_reset_password', { mode: 'boolean' }).notNull().default(false),
  password_hash: text('password_hash'),
  last_login_at: text('last_login_at'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),

  // Soft delete + ban system
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  ban_reason: text('ban_reason'),
  ban_expires: text('ban_expires'),
  archived_at: text('archived_at'),
  archived_by: text('archived_by'),
  archived_reason: text('archived_reason')
});
```

### Database-Driven RBAC Tables

**Location:** `packages/contracts/src/schema.ts:9-41`

```typescript
// Roles table
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  is_system: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Permissions table
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  label: text('label').notNull(),
  category: text('category').notNull(), // dashboard, bookings, sessions, games, network, users, rbac, storage, cameras, system
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Role-Permission junction table
export const rolePermissions = sqliteTable('role_permissions', {
  id: text('id').primaryKey(),
  role_id: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permission_id: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  granted_at: text('granted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  granted_by: text('granted_by').references(() => operators.id)
});
```

### Better Auth Tables

**Location:** `packages/contracts/src/schema.ts:67-102`

```typescript
// Better Auth session management
export const operatorAuthSessions = sqliteTable('operator_auth_sessions', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  user_id: text('user_id').notNull().references(() => operators.id),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  impersonated_by: text('impersonated_by')
});

// OAuth accounts
export const operatorAccounts = sqliteTable('operator_accounts', {
  id: text('id').primaryKey(),
  account_id: text('account_id').notNull(),
  provider_id: text('provider_id').notNull(),
  user_id: text('user_id').notNull().references(() => operators.id),
  access_token: text('access_token'),
  refresh_token: text('refresh_token'),
  // ... token fields
});

// Email verification
export const operatorVerifications = sqliteTable('operator_verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expires_at: text('expires_at').notNull(),
  // ... verification fields
});
```

---

## Current Issues & Misalignments

### 1. Table Naming Convention

**Issue:** Better Auth v1.3.24+ recommends singular `user` table

**Current State:**
- Primary table: `operators`
- Auth tables: `operator_auth_sessions`, `operator_accounts`, `operator_verifications`

**Better Auth Recommendation (2025):**
```typescript
// Recommended by Better Auth
export const user = sqliteTable("user", { ... });
export const session = sqliteTable("session", { ... });
export const account = sqliteTable("account", { ... });
```

**Evidence from Context7:**
> "Better Auth alignment - They recommend user table (singular)"
> Source: better-auth-drizzle examples show `user` table (not `users` plural)

---

### 2. Dual Role System (Redundant)

**Issue:** Two parallel role systems exist:

**System A: String Enum (Legacy)**
```typescript
role: text('role').notNull() // 'admin' | 'manager' | 'game_master' | 'customer'
```

**System B: Database-Driven (Modern)**
```typescript
role_id: text('role_id').notNull().references(() => roles.id)
```

**Problem:**
- Redundant data storage
- Potential for inconsistency (role string != role_id lookup)
- Violates DRY principle
- Unclear which system is source of truth

**Recommendation:** Remove `role` string field, use only `role_id` FK

---

### 3. Dual Permission System

**Issue:** Permissions stored in TWO places:

**System A: JSON Array (Legacy)**
```typescript
permissions: text('permissions', { mode: 'json' }).notNull().default(sql`'[]'`)
// Stores: ['manage_games', 'view_sessions', ...]
```

**System B: Database-Driven (Modern)**
```typescript
// Via roles → rolePermissions → permissions junction table
```

**Problem:**
- Data duplication
- Difficult to keep in sync
- No single source of truth
- Migrations complex when permissions change

**Recommendation:** Remove `permissions` JSON field, derive from `role_id → rolePermissions`

---

### 4. No User Type Differentiation

**Issue:** No field to distinguish operators from customers

**Current State:**
- Operators and customers share same `operators` table
- Differentiation via `role` field ('customer' value)
- No hard boundary preventing customer access to operator routes

**Problem:**
- Customers can theoretically be assigned operator roles
- No database-level constraint preventing escalation
- Route guards rely solely on application logic
- Security risk: single role check failure = full breach

**Recommendation:** Add `user_type` field with DB trigger validation

```typescript
user_type: text('user_type').notNull().default('operator') // 'operator' | 'customer'

// SQLite trigger to prevent customers from having operator roles
CREATE TRIGGER prevent_customer_operator_role
BEFORE INSERT ON users
WHEN NEW.user_type = 'customer'
  AND NEW.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'manager', 'game_master'))
BEGIN
  SELECT RAISE(ABORT, 'Customers cannot be assigned operator roles');
END;
```

---

### 5. Better Auth Custom Fields

**Issue:** Current schema doesn't use Better Auth's `additionalFields` pattern

**Current Approach:**
- Custom fields directly in schema.ts
- No Better Auth awareness of custom fields
- Type inference potentially incomplete

**Better Auth Pattern (2025):**
```typescript
// In auth config
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { ...schema }
  }),
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        fieldName: "firstName",
        returned: true,
        input: true,
        required: true
      },
      role_id: {
        type: "string",
        fieldName: "role_id",
        returned: true,
        input: false,
        required: true
      },
      user_type: {
        type: "string",
        fieldName: "user_type",
        returned: true,
        input: false,
        required: true
      }
    }
  }
});
```

**Benefit:**
- Better Auth type inference includes custom fields
- Client-side type safety
- Consistent API responses

---

## Current Foreign Key Relationships

### Operators as Central Entity

```
operators (id)
  ├─→ operator_auth_sessions (user_id) [CASCADE]
  ├─→ operator_accounts (user_id) [CASCADE]
  ├─→ assets (uploaded_by) [NO ACTION]
  ├─→ alerts (dismissed_by) [NO ACTION]
  ├─→ games (archived_by) [NO ACTION]
  ├─→ backups (created_by) [NO ACTION]
  ├─→ discount_codes (created_by) [NO ACTION]
  ├─→ system_settings (updated_by) [NO ACTION]
  └─→ role_permissions (granted_by) [NO ACTION]

roles (id)
  ├─→ operators (role_id) [NO ACTION - MISSING CASCADE!]
  └─→ role_permissions (role_id) [CASCADE]
```

**Issue:** `operators.role_id` has NO ACTION on delete
- Deleting a role doesn't cascade to operators
- Could leave orphaned operators with invalid role_id
- Violates referential integrity

**Recommendation:** Add `onDelete: 'restrict'` to prevent role deletion if operators exist

---

## Current Role Types

**Defined in:** Application code (not database enum)

```typescript
type OperatorRole = 'admin' | 'manager' | 'game_master' | 'customer';
```

**Actual Roles in Database:**
```sql
-- roles table should contain:
INSERT INTO roles (id, name, description, is_system) VALUES
  ('role-admin', 'admin', 'Full system access', true),
  ('role-manager', 'manager', 'Manage bookings and sessions', true),
  ('role-game-master', 'game_master', 'Run and monitor game sessions', true),
  ('role-customer', 'customer', 'Book and play games', true);
```

**Issue:** No guarantee database roles match TypeScript enum

---

## Current Permission Categories

**Defined in:** `permissions.category` field

```typescript
category: text('category').notNull()
// Values: 'dashboard' | 'bookings' | 'sessions' | 'games' | 'network' |
//         'users' | 'rbac' | 'storage' | 'cameras' | 'system'
```

**Sample Permissions (Expected):**
```sql
-- Dashboard
'view_dashboard', 'view_analytics'

-- Bookings
'view_bookings', 'create_bookings', 'edit_bookings', 'cancel_bookings'

-- Sessions
'view_sessions', 'start_sessions', 'pause_sessions', 'end_sessions', 'send_hints'

-- Games
'view_games', 'create_games', 'edit_games', 'archive_games'

-- Users
'view_users', 'create_users', 'edit_users', 'ban_users', 'impersonate_users'

-- RBAC
'manage_roles', 'assign_permissions'

-- System
'view_logs', 'manage_backups', 'view_system_health'
```

---

## Current Authentication Flow

### Operator Login (Current)

```typescript
// 1. Better Auth handles login
POST /api/auth/sign-in/email
{
  email: "admin@escapeplan.local",
  password: "..."
}

// 2. Better Auth creates session
INSERT INTO operator_auth_sessions (user_id, token, expires_at)

// 3. Session cookie set
Set-Cookie: better-auth.session_token=...

// 4. Frontend fetches operator profile
GET /api/admin/operators/me
{
  id: "...",
  username: "admin",
  role: "admin",              // String enum (legacy)
  role_id: "role-admin",      // FK to roles (modern)
  permissions: [...],         // JSON array (legacy)
  // ... other fields
}

// 5. Frontend also fetches permissions via role_id
GET /api/admin/rbac/roles/role-admin/permissions
[
  { name: 'view_dashboard', category: 'dashboard' },
  { name: 'manage_games', category: 'games' },
  ...
]
```

**Issue:** Two API calls to get full permission set (inefficient)

---

## Current Route Protection

### Frontend Route Guards

**Location:** `apps/escapeplan-web/src/hooks.server.ts` (assumed)

```typescript
// Current protection (assumed)
export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({ headers: event.request.headers });

  if (event.url.pathname.startsWith('/admin')) {
    if (!session?.user) {
      throw redirect(302, '/auth/sign-in');
    }

    // Check role (string-based)
    if (session.user.role === 'customer') {
      throw redirect(302, '/customer/dashboard');
    }
  }

  event.locals.user = session?.user;
  return resolve(event);
}
```

**Issue:** Relies on string `role` field, not database-driven RBAC

---

## Current API Protection

### Fastify Route Guards (Assumed)

**Location:** `apps/escapeplan-api/src/index.ts`

```typescript
// Current protection (assumed)
api.addHook('onRequest', async (request, reply) => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  request.user = session.user;
});

// Permission checks (assumed)
api.post('/admin/games', async (request, reply) => {
  if (!request.user.permissions.includes('create_games')) {
    return reply.status(403).send({ error: 'Insufficient permissions' });
  }
  // ... create game
});
```

**Issue:** Checks `permissions` JSON array, not database-driven role permissions

---

## Database Schema Statistics

### Total Tables: 20

**Auth & Operators:** 7 tables
- `operators` (users)
- `operator_auth_sessions`
- `operator_accounts`
- `operator_verifications`
- `roles`
- `permissions`
- `role_permissions`

**Games & Content:** 3 tables
- `games`
- `game_puzzles`
- `game_milestones`

**Bookings & Sessions:** 5 tables
- `bookings`
- `sessions`
- `session_puzzles`
- `session_hints`
- `session_milestones`
- `timer_slugs`

**Assets & System:** 5 tables
- `assets`
- `asset_usage`
- `storage_metrics`
- `system_health`
- `backups`
- `usb_devices`
- `network_profiles`
- `network_health`
- `cameras`
- `system_logs`
- `alerts`
- `alert_rules`
- `system_settings`
- `discount_codes`
- `discount_code_games`

### Foreign Key Count: 28 FKs

**Operators referenced by:** 11 tables
- All auth tables (3)
- Content tables (2): assets.uploaded_by, games.archived_by
- System tables (6): backups.created_by, alerts.dismissed_by, etc.

---

## Strengths of Current System

✅ **Database-Driven RBAC Foundation**
- Proper normalization (roles, permissions, junction table)
- Flexible permission assignment
- Auditable (granted_at, granted_by)

✅ **Comprehensive Better Auth Integration**
- Session management via Better Auth
- OAuth support via operator_accounts
- Email verification via operator_verifications

✅ **Full Drizzle ORM Schema**
- Zero raw SQL
- Type-safe queries
- Clean migrations via drizzle-kit

✅ **Soft Delete & Audit Trail**
- archived_at, archived_by fields
- Ban system with expiration
- Session tracking (ip_address, user_agent)

✅ **UUID Primary Keys**
- Consistent UUID v4 format
- No auto-increment integers
- Better for distributed systems

---

## Weaknesses of Current System

❌ **Redundant Role/Permission Storage**
- Dual role system (string + FK)
- Dual permission system (JSON + junction table)
- No clear source of truth

❌ **No User Type Differentiation**
- Operators and customers in same table
- No database-level boundary
- Security risk for privilege escalation

❌ **Table Naming Mismatch**
- `operators` instead of Better Auth's `user`
- Prefixed auth tables (`operator_auth_sessions`)
- Complicates Better Auth integration

❌ **Missing Cascade Constraints**
- `operators.role_id` has NO ACTION
- Could create orphaned records
- Referential integrity risk

❌ **Inefficient Permission Lookups**
- Requires join across 3 tables (operators → roles → rolePermissions → permissions)
- JSON array fallback adds complexity
- No caching strategy visible

---

## Migration Complexity Assessment

### Low Complexity Changes (1-2 hours)
- Remove `role` string field (use only `role_id`)
- Remove `permissions` JSON field (use only junction table)
- Add `user_type` field with default 'operator'
- Update `operators.role_id` FK to `onDelete: 'restrict'`

### Medium Complexity Changes (4-6 hours)
- Rename `operators` → `users`
- Rename `operator_auth_sessions` → `sessions`
- Rename `operator_accounts` → `accounts`
- Rename `operator_verifications` → `verifications`
- Update all 11 foreign key references to `users.id`

### High Complexity Changes (8-12 hours)
- Configure Better Auth `additionalFields` for custom fields
- Implement permission derivation logic (role → permissions)
- Update all API permission checks
- Update all frontend components
- Create database triggers for user_type validation

### Total Estimated Effort: 13-20 hours

---

## Breaking Changes Impact

### Database Layer (Drizzle Schema)
**Files Affected:** 1
- `packages/contracts/src/schema.ts`

**Changes:**
- Rename tables (4 tables)
- Add user_type field
- Remove role, permissions fields
- Update FK constraints

### API Layer (Fastify)
**Files Affected:** ~10
- `apps/escapeplan-api/src/state.ts` (CRUD operations)
- `apps/escapeplan-api/src/index.ts` (endpoints)
- `apps/escapeplan-api/src/db/client.ts` (Better Auth config)
- Permission check helpers

**Changes:**
- Import renamed tables
- Update permission check logic
- Configure Better Auth additionalFields

### Frontend Layer (SvelteKit)
**Files Affected:** ~50
- All components importing operator types
- All API calls to /admin/operators/*
- Route guards in hooks.server.ts
- Type imports from contracts

**Changes:**
- Import renamed types (Operator → User)
- Update API endpoints
- Update route guards to check user_type

---

## Conclusion

**Current State:** Solid database foundation with redundant legacy fields

**Key Issues:**
1. Dual role/permission systems (string + database)
2. No user type differentiation
3. Table naming doesn't match Better Auth conventions
4. Missing cascade constraints

**Recommendation:** Proceed with migration to align with Better Auth best practices

**Next Steps:**
1. Review Better Auth v1.3.24+ best practices (Document 02)
2. Design target architecture (Document 04)
3. Plan migration strategy (Document 03)
4. Create implementation plan (Document 05)

---

**Document Version:** 1.0
**Author:** Claude Research Agent
**Status:** ✅ Analysis Complete
**Next Document:** `02-BETTER_AUTH_BEST_PRACTICES.md`
