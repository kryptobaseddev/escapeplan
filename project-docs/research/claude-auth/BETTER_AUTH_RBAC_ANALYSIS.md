# Better Auth RBAC Analysis - Technical Comparison

**Date:** 2025-10-03
**Author:** Claude Code (Session 51)
**Status:** COMPLETE ✅

---

## Executive Summary

**Finding:** Our current database-driven RBAC system is **already aligned** with Better Auth v1.3.24+ best practices. Better Auth **does not have a built-in database-driven RBAC system** that stores roles and permissions in database tables. Instead, it uses **code-defined access control** via the `createAccessControl()` utility.

**Recommendation:** **Keep our current implementation.** Our database-driven RBAC system is more powerful, flexible, and production-ready than Better Auth's code-based approach.

---

## What Better Auth Actually Provides

### 1. Access Control Plugin (NOT Database-Driven)

Better Auth provides `better-auth/plugins/access` with `createAccessControl()`:

```typescript
import { createAccessControl } from "better-auth/plugins/access";

const statement = {
    project: ["create", "share", "update", "delete"],
} as const;

const ac = createAccessControl(statement);

const admin = ac.newRole({
    project: ["create", "update"],
});
```

**Key Points:**
- ✅ Roles are **defined in TypeScript code**, not database tables
- ✅ Permissions are **hardcoded as TypeScript constants**
- ✅ Used with `admin` plugin or `organization` plugin
- ❌ **No database tables** for `roles` or `permissions`
- ❌ **No runtime role/permission creation** via API
- ❌ **No dynamic permission management**

### 2. Admin Plugin

The `admin` plugin uses `createAccessControl()`:

```typescript
import { admin as adminPlugin } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [
        adminPlugin({
            ac,  // Access controller instance
            roles: {
                admin,
                user,
                myCustomRole
            },
            adminRoles: ["admin", "superadmin"],  // Hardcoded list
            defaultRole: "user"  // Default for new users
        }),
    ],
});
```

**What it stores in database:**
- `user.role` field (string or string[]) - **NOT a foreign key**
- No `roles` table
- No `permissions` table
- No `role_permissions` junction table

**API Endpoints:**
- `POST /admin/set-role` - Assigns role string to user
- `POST /admin/has-permission` - Checks if user/role has permission

### 3. Organization Plugin (Multi-tenant RBAC)

Better Auth's `organization` plugin adds **dynamic roles per organization**:

```typescript
import { organization } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [
        organization({
            ac,
            roles: {
                owner,
                admin,
                member
            },
            dynamicAccessControl: {
                maximumRolesPerOrganization: 10
            }
        }),
    ],
});
```

**Database Tables Created:**
- `organization` - Organization metadata
- `member` - Junction table (userId, organizationId, **role string**)
- `invitation` - Organization invites with role strings

**Important:**
- Roles stored as **strings** in `member.role` field
- **NOT foreign keys to a roles table**
- Dynamic roles created via API endpoints
- Roles scoped to organizations (multi-tenant)

**API Endpoints:**
- `POST /organization/create-role` - Create role for organization
- `GET /organization/list-roles` - List organization roles
- `POST /organization/update-role` - Update role permissions
- `POST /organization/delete-role` - Delete organization role

### 4. Better Auth's Dynamic Role Storage

When using `dynamicAccessControl` in the organization plugin, Better Auth **does** create two tables:

```typescript
// Tables created by organization plugin with dynamic roles
organizationRole {
    id: string
    name: string
    organizationId: string
    permissions: Record<string, string[]>  // JSON field!
}
```

**Critical Difference:**
- Permissions stored as **JSON blob**, not junction table
- Scoped to **organizations only** (multi-tenant)
- **Not suitable** for single-tenant app-wide RBAC

---

## Our Current Implementation

### Database Tables

```sql
-- Roles table
CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    user_type_scope TEXT NOT NULL DEFAULT 'operator', -- 'operator' | 'customer' | 'both'
    is_system BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Permissions table
CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    user_type_scope TEXT NOT NULL DEFAULT 'operator',
    description TEXT,
    created_at TEXT NOT NULL
);

-- Junction table (normalized)
CREATE TABLE role_permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TEXT NOT NULL,
    granted_by TEXT REFERENCES user(id),
    UNIQUE(role_id, permission_id)
);

-- User table with FK to roles
CREATE TABLE user (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    user_type TEXT NOT NULL DEFAULT 'operator',
    -- ... other fields
);

-- Database triggers enforcing security
CREATE TRIGGER prevent_customer_operator_role ...
CREATE TRIGGER prevent_user_type_change ...
CREATE TRIGGER enforce_role_user_type_scope ...
```

### Features We Have That Better Auth Doesn't

1. ✅ **Database-normalized RBAC** - Roles and permissions in proper tables with FKs
2. ✅ **Runtime role/permission creation** via API endpoints
3. ✅ **Junction table** - No JSON blobs, proper relational design
4. ✅ **Database triggers** - Enforce user_type/role boundaries automatically
5. ✅ **Permission categories** - Organized into logical groups
6. ✅ **User type scoping** - Operator vs customer permission separation
7. ✅ **Audit trail** - `granted_by` and `granted_at` fields
8. ✅ **Permission labels** - Human-readable names for UI
9. ✅ **System role protection** - `is_system` flag prevents deletion
10. ✅ **Single-tenant app-wide RBAC** - Not organization-scoped

---

## Feature Comparison Matrix

| Feature | Better Auth Admin Plugin | Better Auth Org Plugin | EscapePlan Current |
|---------|--------------------------|------------------------|-------------------|
| **Storage Model** | Code-defined | DB (JSON permissions) | DB (normalized) |
| **Roles in Database** | ❌ (string field only) | ✅ (per organization) | ✅ (app-wide) |
| **Permissions in Database** | ❌ (hardcoded) | ✅ (JSON blob) | ✅ (table with FKs) |
| **Junction Table** | ❌ | ❌ (JSON field) | ✅ (normalized) |
| **Runtime Role Creation** | ❌ | ✅ (org-scoped) | ✅ (app-wide) |
| **Runtime Permission Creation** | ❌ | ❌ | ✅ |
| **User Type Separation** | ❌ | ❌ | ✅ (operator/customer) |
| **Database Triggers** | ❌ | ❌ | ✅ (5 triggers) |
| **Permission Categories** | ❌ | ❌ | ✅ |
| **Audit Trail** | ❌ | ❌ | ✅ (granted_by/at) |
| **Multi-tenant** | ❌ | ✅ | ❌ (not needed) |
| **Single-tenant App-wide RBAC** | ✅ (limited) | ❌ | ✅ (full-featured) |
| **Type Safety** | ✅ (TypeScript) | ✅ (TypeScript) | ✅ (Drizzle ORM) |
| **API Endpoints** | `/admin/*` | `/organization/*` | `/admin/*` |
| **Permission Check** | `userHasPermission()` | `hasPermission()` | `requirePermission()` |

---

## Better Auth Organization Plugin Use Case

The `organization` plugin is designed for **multi-tenant SaaS applications** where:

- Multiple organizations exist
- Each organization has its own roles
- Each organization can create custom roles
- Roles are scoped to organization context
- Users can be members of multiple organizations with different roles

**Example:** Slack, GitHub, Notion - where users have different roles in different workspaces.

**EscapePlan Use Case:** Single-tenant escape room management system where:
- One installation per escape room business
- App-wide roles (admin, manager, game_master, customer)
- Roles apply to the entire system, not specific organizations
- No multi-tenancy needed

---

## Comparison: Better Auth Org Plugin vs Our System

### Better Auth Organization Approach

```typescript
// Organization-scoped roles (multi-tenant)
const org1Member = {
    userId: "user-1",
    organizationId: "org-1",
    role: "admin"  // Admin in Org 1
};

const org2Member = {
    userId: "user-1",
    organizationId: "org-2",
    role: "member"  // Member in Org 2
};

// Permissions checked with organization context
await auth.api.hasPermission({
    headers: await headers(),
    body: {
        permissions: {
            project: ["create"]
        }
    }
});
```

### Our Single-Tenant Approach

```typescript
// App-wide roles (single-tenant)
const user = {
    id: "user-1",
    role_id: "role-admin",  // FK to roles table
    user_type: "operator"   // Operator vs customer
};

// Permissions derived from role_id via junction table
const permissions = await getUserPermissions(user.id);
// Returns: ["view_dashboard", "manage_games", "create_users", ...]

// Permission check
await requirePermission(user.id, "manage_games");
```

**Key Difference:**
- Better Auth: **Per-organization roles** for multi-tenant SaaS
- EscapePlan: **App-wide roles** for single-tenant system

---

## Migration Path Analysis

### Option A: Keep Our Current System ✅ RECOMMENDED

**Pros:**
- ✅ Already implemented and working
- ✅ More powerful than Better Auth's admin plugin
- ✅ Proper database normalization (no JSON blobs)
- ✅ Runtime role/permission management
- ✅ Database triggers for automatic security enforcement
- ✅ User type separation (operator/customer)
- ✅ Audit trail built-in
- ✅ No migration effort required

**Cons:**
- ❌ More code to maintain vs using Better Auth plugin
- ❌ Not using Better Auth's native API endpoints

**Effort:** 0 hours (no change needed)

### Option B: Migrate to Better Auth Admin Plugin ❌ NOT RECOMMENDED

**Pros:**
- ✅ Less custom code to maintain
- ✅ Uses Better Auth's native API endpoints
- ✅ TypeScript type safety for roles

**Cons:**
- ❌ **LOSE database-driven RBAC** (roles become hardcoded)
- ❌ **LOSE runtime role/permission creation**
- ❌ **LOSE database triggers** (security enforcement)
- ❌ **LOSE user type separation**
- ❌ **LOSE permission categories and labels**
- ❌ **LOSE audit trail** (granted_by/granted_at)
- ❌ Cannot create custom roles via admin UI
- ❌ Requires code changes to add/modify roles

**Effort:** 40+ hours of refactoring, significant feature loss

### Option C: Migrate to Better Auth Organization Plugin ❌ NOT RECOMMENDED

**Pros:**
- ✅ Dynamic role creation via API
- ✅ TypeScript type safety

**Cons:**
- ❌ **Requires multi-tenancy** (organizations)
- ❌ **Permissions stored as JSON** (not normalized)
- ❌ **Wrong architecture** for single-tenant system
- ❌ **Overhead** of organization context everywhere
- ❌ **LOSE user type separation**
- ❌ **LOSE database triggers**
- ❌ **LOSE audit trail**

**Effort:** 60+ hours of refactoring, adds unnecessary complexity

### Option D: Hybrid Approach ❌ NOT RECOMMENDED

Use Better Auth's `createAccessControl()` for **type definitions** but keep our database system:

```typescript
import { createAccessControl } from "better-auth/plugins/access";

// Define permissions in code for TypeScript types
const statement = {
    dashboard: ["view"],
    games: ["create", "update", "delete"],
    users: ["create", "update", "delete"],
    // ... all 27 permissions
} as const;

const ac = createAccessControl(statement);

// BUT: Still use our database for storage and runtime management
```

**Pros:**
- ✅ TypeScript type safety from Better Auth
- ✅ Keep all database-driven features

**Cons:**
- ❌ Dual source of truth (code + database)
- ❌ Permissions defined in two places
- ❌ Increased complexity
- ❌ Type drift risk (code vs database)

**Effort:** 20 hours to integrate and maintain

---

## Recommendation

### ✅ Keep Our Current Database-Driven RBAC System

**Reasoning:**

1. **Better Auth Does NOT Have Native Database-Driven RBAC**
   - The `admin` plugin uses **code-defined roles**
   - The `organization` plugin is for **multi-tenant SaaS**, not our use case
   - Neither approach matches our architecture

2. **Our System is More Powerful**
   - Runtime role/permission management via API
   - Proper database normalization (junction tables, not JSON)
   - Database triggers for automatic security enforcement
   - User type separation (operator/customer)
   - Audit trail and permission categories

3. **Migration Would Lose Features**
   - No way to create custom roles via UI in Better Auth admin plugin
   - Organization plugin adds unnecessary multi-tenant complexity
   - Would require significant refactoring for less functionality

4. **Our Implementation is Sound**
   - Follows database normalization best practices
   - Proper foreign key constraints
   - Security enforced at database level
   - Session 50 aligned it perfectly with Better Auth's auth tables

5. **Better Auth Integration Already Complete**
   - Session 50 aligned our `user` table with Better Auth v1.3.24+
   - We use Better Auth for **authentication** (sessions, tokens)
   - We use our custom system for **authorization** (roles, permissions)
   - This is a valid and common pattern

---

## Better Auth's Actual Use Cases

### Use Better Auth Admin Plugin When:
- ✅ You have **3-5 fixed roles** that never change
- ✅ Roles are **hardcoded** in your application
- ✅ No need for **runtime role creation**
- ✅ Simple permission model

**Example:** Blog with `admin`, `editor`, `author` roles

### Use Better Auth Organization Plugin When:
- ✅ **Multi-tenant SaaS** application
- ✅ Users belong to **multiple organizations**
- ✅ Each organization needs **custom roles**
- ✅ Roles scoped to **organization context**

**Example:** Slack, GitHub, Trello

### Use Custom Database RBAC (Like Ours) When:
- ✅ **Single-tenant** application
- ✅ **App-wide roles** (not organization-scoped)
- ✅ Need **runtime role/permission management**
- ✅ Complex permission model with **categories**
- ✅ Need **audit trail**
- ✅ Need **user type separation** (operator/customer)
- ✅ Database-level **security enforcement**

**Example:** EscapePlan ✅

---

## Implementation Validation

Our current implementation from Session 50:

### ✅ Aligned with Better Auth Tables
- `user`, `session`, `account`, `verification` (singular, native)
- No `modelName` overrides in `auth-config.ts`
- `additionalFields` for custom fields (`user_type`, `role_id`)

### ✅ Custom RBAC on Top
- `roles`, `permissions`, `role_permissions` tables
- Foreign key `user.role_id -> roles.id`
- Session enrichment derives permissions from database
- Permission helpers: `getUserPermissions()`, `requirePermission()`

### ✅ Security Enforcement
- 5 database triggers enforce user_type/role boundaries
- `user_type` is immutable after creation
- Roles validated against `user_type_scope`

### ✅ API Endpoints
- `/api/admin/users` - User CRUD
- `/api/admin/roles` - Role CRUD
- `/api/admin/roles/:id/permissions` - Manage role permissions
- `/api/admin/permissions` - List all permissions

---

## Conclusion

**Our database-driven RBAC system is the correct architecture for EscapePlan.**

Better Auth provides:
1. **Authentication** (sessions, tokens, login/logout) ✅ We use this
2. **Code-based RBAC** (admin plugin) ❌ Too limited for our needs
3. **Multi-tenant RBAC** (organization plugin) ❌ Wrong architecture for single-tenant

**Final Answer:** Keep our current implementation. It is more powerful, flexible, and production-ready than anything Better Auth provides for single-tenant RBAC.

---

## Files Referenced

- Better Auth Documentation: `/better-auth/better-auth` (Context7)
- Our Implementation: `apps/escapeplan-api/src/auth-config.ts`
- Our Schema: `packages/contracts/src/schema.ts`
- Session 50 Notes: `project-docs/project-tracking/sessions/SESSION_50_NOTES.md`
- Auth Plan: `project-docs/research/claude-auth/AUTH-OPTIMIZATION-PLAN.md`

---

**Status:** Analysis complete. Recommendation: Keep current system. ✅
