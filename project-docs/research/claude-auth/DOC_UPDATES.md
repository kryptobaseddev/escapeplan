# Documentation Updates Required - Auth System Refactor

**Created:** 2025-10-03
**Session:** 50 (Auth Refactor Completion)
**Status:** Ready for implementation
**Estimated Effort:** 3-4 hours

---

## Overview

Session 50 completed a major auth system refactor, but documentation was only partially updated (CLAUDE.md only). All developer documentation needs comprehensive updates to reflect the new architecture and serve as the **source of truth** for the system.

---

## 🎯 Goals

1. **Update all references** from old table names to new schema
2. **Document new architecture** (user_type separation, triggers, Better Auth alignment)
3. **Ensure consistency** across all documentation
4. **Serve as source of truth** for current AND planned features
5. **Help future developers** understand the system

---

## 📋 Files to Update (Priority Order)

### **CRITICAL PRIORITY** (Must update - core system docs)

#### 1. `apps/DOCS/DATABASE_SYSTEM.md`
**Current Issues:**
- References `operators` table (should be `user`)
- References `operator_auth_sessions` (should be `session`)
- References `operator_accounts` (should be `account`)
- Missing `user_type` field documentation
- Missing `user_type_scope` documentation
- Missing security triggers documentation

**Required Updates:**

**Section: Core Tables (around line 70-71)**
```markdown
# BEFORE:
│  operators, operator_auth_sessions,                         │
│  operator_accounts, operator_verifications                  │

# AFTER:
│  user, session, account, verification                       │
│  (Better Auth v1.3.24+ aligned naming)                     │
```

**Section: Foreign Key Relationships (around line 219-220)**
```markdown
# BEFORE:
  ├─→ operator_auth_sessions (user_id) [CASCADE]
  ├─→ operator_accounts (user_id) [CASCADE]

# AFTER:
  ├─→ session (userId) [CASCADE]
  ├─→ account (userId) [CASCADE]
```

**Section: Cascade Delete Behavior (around line 235)**
```markdown
# BEFORE:
| `operators` | `operator_auth_sessions`, `operator_accounts` | User auth data must be removed |

# AFTER:
| `user` | `session`, `account` | User auth data must be removed |
```

**NEW SECTION TO ADD: Auth & User Tables**
```markdown
## Auth & Users

### user (Unified operator and customer table)
**Purpose:** Stores all system users (operators and customers) with type separation.

**Fields:**
- `id` (TEXT, PK) - UUID v4
- `username` (TEXT, UNIQUE, NOT NULL)
- `name` (TEXT, NOT NULL)
- `email` (TEXT, UNIQUE)
- `emailVerified` (BOOLEAN, NOT NULL, default false) - Better Auth camelCase
- `image` (TEXT) - Better Auth field for avatar JSON
- `createdAt` (TEXT, NOT NULL) - Better Auth camelCase
- `updatedAt` (TEXT, NOT NULL) - Better Auth camelCase
- `user_type` (TEXT, NOT NULL, default 'operator') - **'operator' | 'customer'**
- `role_id` (TEXT, FK roles.id, NOT NULL)
- `bio` (TEXT)
- `avatar_config` (JSON) - DiceBear config
- `must_reset_password` (BOOLEAN, default false)
- `loyalty_points` (INTEGER, default 0) - Customer only
- `preferred_difficulty` (TEXT) - Customer only
- `marketing_opted_in` (BOOLEAN, default false) - Customer only
- `password_hash` (TEXT)
- `last_login_at` (TEXT)
- `banned` (BOOLEAN, default false)
- `ban_reason` (TEXT)
- `ban_expires` (TEXT)
- Soft delete: `archived_at`, `archived_by`, `archived_reason`

**Indexes:**
- `idx_user_type` on `user_type`
- `idx_user_email` on `email`
- `idx_user_username` on `username`

**Triggers:** See Security Triggers section below.

### session (Better Auth sessions)
**Purpose:** Better Auth session tokens.

**Fields:**
- `id` (TEXT, PK)
- `token` (TEXT, UNIQUE, NOT NULL)
- `userId` (TEXT, FK user.id, NOT NULL, CASCADE)
- `expiresAt` (TEXT, NOT NULL)
- `ipAddress`, `userAgent` (TEXT)
- `impersonatedBy` (TEXT, FK user.id)
- `createdAt`, `updatedAt` (TEXT, timestamps)

### account (Better Auth OAuth)
**Purpose:** OAuth accounts (future social login).

**Fields:**
- `id` (TEXT, PK)
- `accountId`, `providerId` (TEXT, NOT NULL)
- `userId` (TEXT, FK user.id, NOT NULL, CASCADE)
- `accessToken`, `refreshToken`, `idToken` (TEXT)
- Token expiry fields
- `createdAt`, `updatedAt` (TEXT, timestamps)

### verification (Email verification)
**Purpose:** Email verification tokens.

**Fields:**
- `id` (TEXT, PK)
- `identifier` (TEXT, NOT NULL) - Email address
- `value` (TEXT, NOT NULL) - Verification code
- `expiresAt` (TEXT, NOT NULL)
- `createdAt`, `updatedAt` (TEXT, timestamps)
```

**NEW SECTION TO ADD: Security Triggers**
```markdown
## Security Triggers

The system uses 5 database triggers to enforce user_type and role boundaries automatically:

### 1. `prevent_customer_operator_role`
**Trigger:** BEFORE INSERT ON user
**Purpose:** Prevents customers from being assigned operator-only roles
**Logic:** Blocks if `user_type = 'customer'` AND `role_id` has `user_type_scope = 'operator'`

### 2. `prevent_operator_customer_role`
**Trigger:** BEFORE INSERT ON user
**Purpose:** Prevents operators from being assigned customer-only roles
**Logic:** Blocks if `user_type = 'operator'` AND `role_id` has `user_type_scope = 'customer'`

### 3. `prevent_user_type_change`
**Trigger:** BEFORE UPDATE OF user_type ON user
**Purpose:** Makes user_type immutable after creation
**Logic:** Blocks any attempt to change user_type after initial INSERT

### 4. `enforce_role_user_type_scope` (INSERT)
**Trigger:** BEFORE INSERT ON user
**Purpose:** Validates role matches user_type scope
**Logic:** Blocks if `role_id.user_type_scope` NOT IN (`user_type`, 'both')

### 5. `enforce_role_user_type_scope_update` (UPDATE)
**Trigger:** BEFORE UPDATE OF role_id ON user
**Purpose:** Validates role updates match user_type scope
**Logic:** Blocks if new `role_id.user_type_scope` NOT IN (`user_type`, 'both')

**Location:** `apps/escapeplan-api/drizzle/triggers.sql`
**Applied:** Automatically when database is seeded
```

---

#### 2. `apps/DOCS/RBAC_SYSTEM.md`
**Current Issues:**
- References `operators table` (line 730)
- Missing `user_type_scope` documentation
- Missing operator vs customer role separation
- Architecture diagrams outdated

**Required Updates:**

**Section: Overview (around line 25-30)**
```markdown
# ADD to Key Features:
✅ User type scoping (operator vs customer roles)
✅ Database triggers enforce role/user_type boundaries
✅ Future-ready for customer portal implementation
```

**Section: Architecture (around line 45-50)**
```markdown
# UPDATE diagram to show:
┌─────────────────────────────────────────────────────────────┐
│                     Better Auth Session                     │
│  (HttpOnly cookie: better-auth.session_token)              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Custom Session Plugin                       │
│  - Enriches session with role and permissions               │
│  - Queries: user → roles → role_permissions → permissions   │
│  - Validates user_type matches role scope                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Session Object                            │
│  {                                                           │
│    user: {                                                   │
│      id, username, name, email,                             │
│      user_type: 'operator' | 'customer',                    │
│      role: 'admin' | 'manager' | 'game_master' | 'customer',│
│      role_id: 'role-admin',                                 │
│      permissions: ['view_dashboard', 'manage_games', ...]   │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

**NEW SECTION: Database Schema**
```markdown
## Database Schema

### roles
**Purpose:** Define available roles with user type scoping.

**Fields:**
- `id` (TEXT, PK)
- `name` (TEXT, UNIQUE, NOT NULL)
- `description` (TEXT)
- `user_type_scope` (TEXT, NOT NULL, default 'operator') - **NEW FIELD**
  - `'operator'` - Only operators can have this role
  - `'customer'` - Only customers can have this role
  - `'both'` - Either user type can have this role
- `is_system` (BOOLEAN, default false)
- `created_at`, `updated_at` (TEXT, timestamps)

### permissions
**Purpose:** Define granular permissions with user type scoping.

**Fields:**
- `id` (TEXT, PK)
- `name` (TEXT, UNIQUE, NOT NULL)
- `label` (TEXT, NOT NULL)
- `category` (TEXT, NOT NULL)
- `user_type_scope` (TEXT, NOT NULL, default 'operator') - **NEW FIELD**
  - `'operator'` - Operator-only permission
  - `'customer'` - Customer-only permission
  - `'both'` - Shared permission
- `description` (TEXT)
- `created_at` (TEXT, timestamp)

### role_permissions
**Purpose:** Junction table mapping roles to permissions.

**Fields:**
- `id` (TEXT, PK)
- `role_id` (TEXT, FK roles.id, CASCADE)
- `permission_id` (TEXT, FK permissions.id, CASCADE)
- `granted_at` (TEXT, timestamp)
- `granted_by` (TEXT, FK user.id)

**Index:** Unique on (role_id, permission_id)
```

**Section: System Roles (around line 730)**
```markdown
# UPDATE:
1. `role_id` is set in user table (was: operators table)
2. User type must match role's `user_type_scope`
3. Database triggers automatically enforce this validation
```

**NEW SECTION: User Type Scoping**
```markdown
## User Type Scoping

The RBAC system supports two user types with automatic role/permission scoping:

### Operator Users (`user_type: 'operator'`)
**Allowed Roles:**
- Roles with `user_type_scope = 'operator'`
- Roles with `user_type_scope = 'both'`

**System Roles:**
- `admin` (user_type_scope: 'operator')
- `manager` (user_type_scope: 'operator')
- `game_master` (user_type_scope: 'operator')

**Permissions:** All 27 current permissions (all scoped to 'operator')

### Customer Users (`user_type: 'customer'`)
**Allowed Roles:**
- Roles with `user_type_scope = 'customer'`
- Roles with `user_type_scope = 'both'`

**System Roles:**
- `customer` (user_type_scope: 'customer')

**Planned Permissions:**
- `view_catalog` - Browse games
- `create_booking` - Self-service booking
- `view_own_bookings` - Booking history
- `cancel_booking` - Cancel own bookings
- `view_profile`, `edit_profile` - Account management

### Enforcement Mechanism
**Database Triggers:** 5 triggers (see DATABASE_SYSTEM.md) automatically block:
- Cross-type role assignments (customer with operator role)
- user_type changes after creation
- Invalid role scope for user type
```

---

#### 3. `apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md`
**Current Issues:**
- May contain outdated schema examples
- Likely references old table names in migration examples

**Required Updates:**

**Section: Schema Change Examples**
```markdown
# UPDATE example to use new table:
## Example: Adding a new field to user table

1. **Update Schema** (`packages/contracts/src/schema.ts`)
   ```typescript
   export const user = sqliteTable('user', {
     // ...existing fields...
     new_field: text('new_field'), // ADD THIS
   });
   ```

2. **Push Schema Changes**
   ```bash
   cd apps/escapeplan-api
   npx drizzle-kit push
   ```

3. **Apply Security Triggers** (if not auto-applied)
   ```bash
   sqlite3 data/escapeplan.db < drizzle/triggers.sql
   ```

4. **Rebuild Contracts**
   ```bash
   pnpm --filter @escapeplan/contracts build
   ```
```

**ADD Section: Working with Better Auth Tables**
```markdown
## Working with Better Auth Tables

### Native Table Names
Better Auth v1.3.24+ expects these exact singular table names:
- `user` - Main user table
- `session` - Session tokens
- `account` - OAuth accounts
- `verification` - Email verification

**DO NOT** use `modelName` or `fields` overrides in auth config - let Better Auth use native names.

### Custom Fields on user Table
Use `additionalFields` in auth-config.ts:

```typescript
user: {
  additionalFields: {
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
    }
  }
}
```

### Field Naming Convention
- **Better Auth core fields:** camelCase (`emailVerified`, `createdAt`, `updatedAt`)
- **Custom application fields:** snake_case (`user_type`, `role_id`)
- **Drizzle schema:** Match database column names exactly
```

---

### **HIGH PRIORITY** (Referenced in multiple places)

#### 4. `apps/DOCS/ASSET_STORAGE_ARCHITECTURE.md`
**Update Required:**
- Find/replace `operators` → `user` (in context of uploaded_by references)
- Update any FK references to show `user.id`

#### 5. `apps/DOCS/DASHBOARD_SYSTEM.md`
**Update Required:**
- Find/replace `operators` → `user`
- Update session structure examples to show `user_type` field

#### 6. `apps/DOCS/LOGGING_ALERTING_SYSTEM.md`
**Update Required:**
- Find/replace `operators` → `user` (in context of dismissed_by, created_by)
- Update FK references

---

### **MEDIUM PRIORITY** (Minimal references)

#### 7. `apps/DOCS/NETWORK_WIFI_SYSTEM.md`
**Update Required:**
- Find/replace `operators` → `user` (in context of admin users)

#### 8. `apps/DOCS/RUNTIME_CONFIGURATION_SYSTEM.md`
**Update Required:**
- Find/replace `operators` → `user` (in context of config updates)

---

### **PROJECT OVERVIEW** (Source of truth for entire system)

#### 9. `project-docs/project-overview.md`
**Current Issues:**
- Entire auth section likely outdated
- Missing Session 50 refactor details
- No mention of user_type separation

**Required Updates:**

**Section: Authentication & Authorization**
```markdown
## Authentication & Authorization

### Architecture Overview
EscapePlan uses **Better Auth v1.3.24+** for authentication with a **custom database-driven RBAC system** for authorization.

**Key Components:**
- **Better Auth:** Session management, login/logout, token handling
- **Custom RBAC:** Roles, permissions, user type scoping
- **Database Triggers:** Automatic security enforcement
- **Session Enrichment:** Permissions derived from database on each request

### Database Schema

#### Auth Tables (Better Auth)
- `user` - Unified table for operators and customers
- `session` - Session tokens (HttpOnly cookies)
- `account` - OAuth accounts (future social login)
- `verification` - Email verification tokens

#### RBAC Tables (Custom)
- `roles` - System and custom roles with `user_type_scope`
- `permissions` - Granular permissions with `user_type_scope`
- `role_permissions` - Junction table mapping roles to permissions

### User Types
The system supports two user types with automatic role scoping:

1. **Operators** (`user_type: 'operator'`)
   - Staff members who run the escape room
   - Roles: admin, manager, game_master
   - Permissions: All 27 system permissions
   - Routes: `/admin/*`

2. **Customers** (`user_type: 'customer'`)
   - Players who book and play games
   - Roles: customer
   - Permissions: Catalog, bookings, profile
   - Routes: `/customer/*` (planned)

### Security Features

#### Database Triggers (5 total)
1. Prevent customers from having operator roles
2. Prevent operators from having customer-only roles
3. Prevent user_type changes after creation
4. Enforce role scope on INSERT
5. Enforce role scope on UPDATE

**Location:** `apps/escapeplan-api/drizzle/triggers.sql`

#### Permission Checking
```typescript
// Backend (API)
await requirePermission(userId, 'manage_games');

// Frontend (Planned)
{#if $session.user.permissions.includes('manage_games')}
  <button>Edit Game</button>
{/if}
```

### Session Structure
```typescript
{
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
    user_type: 'operator' | 'customer';
    role: 'admin' | 'manager' | 'game_master' | 'customer';
    role_id: string;
    permissions: string[]; // Derived from role_permissions
    avatarConfig?: object;
  },
  session: {
    token: string;
    expiresAt: string;
  }
}
```

### Better Auth Configuration
**Location:** `apps/escapeplan-api/src/auth-config.ts`

**Key Config:**
- Native singular table names (no `modelName` overrides)
- `additionalFields` for custom user fields
- `customSession` plugin for permission enrichment
- Server-managed fields (`user_type`, `role_id`) have `input: false`

### System Roles

| Role | user_type_scope | Permissions | Use Case |
|------|----------------|-------------|----------|
| admin | operator | All (27) | Full system access |
| manager | operator | 17 permissions | Manage bookings, sessions, users |
| game_master | operator | 7 permissions | Run sessions, view games |
| customer | customer | 2 permissions (planned) | Self-service booking |

### Permission Categories
1. dashboard (1)
2. bookings (2)
3. sessions (2)
4. games (2)
5. network (2)
6. users (6)
7. assets (4)
8. storage (2)
9. cameras (2)
10. system (4)

**Total:** 27 operator permissions + future customer permissions
```

**ADD Section: Future Enhancements**
```markdown
## Future Auth Enhancements

### Customer Portal (Planned)
- Public registration with `user_type: 'customer'`
- Email verification flow
- Self-service booking interface
- Customer dashboard with booking history
- Profile management

### Better Auth Client SDK (Optional)
- Install `@better-auth/svelte`
- Client-side reactive session stores
- Automatic session refresh
- Optimistic UI updates

### Enhanced Auth Flows (Optional)
- Password reset via email
- Social auth providers (Google, GitHub)
- Two-factor authentication
- Account linking
```

---

## 🔧 Implementation Instructions

### Step 1: Create Session Notes
```bash
cd project-docs/project-tracking/sessions
cp SESSION_TEMPLATE.md SESSION_52_NOTES.md
# Update header with session info
```

### Step 2: Update Documents in Order

**Phase 1: Critical Docs (2 hours)**
1. DATABASE_SYSTEM.md
   - Update all table references
   - Add user table documentation
   - Add triggers section
   - Update FK references

2. RBAC_SYSTEM.md
   - Update architecture diagram
   - Add user_type_scope documentation
   - Add scoping rules section
   - Update examples

3. API_CONTRACTS_SCHEMA_MANAGEMENT.md
   - Update schema examples
   - Add Better Auth section
   - Update migration workflow

**Phase 2: Supporting Docs (1 hour)**
4-8. Other DOCS/*.md files
   - Find/replace `operators` → `user`
   - Update FK references where applicable
   - Verify context is correct

**Phase 3: Project Overview (1 hour)**
9. project-overview.md
   - Replace entire auth section
   - Add Session 50 summary
   - Add future enhancements section

### Step 3: Validation
```bash
# Check for remaining references to old tables
grep -r "operators table\|operator_auth_sessions\|operator_accounts" apps/DOCS/
grep -r "operators table" project-docs/

# Should return ZERO results (or only in historical context)
```

### Step 4: Update Session Notes
Document all changes in SESSION_52_NOTES.md:
- Files modified
- Sections updated
- Validation results

---

## ✅ Completion Checklist

### Critical Docs
- [ ] DATABASE_SYSTEM.md - All table names updated
- [ ] DATABASE_SYSTEM.md - user table documented
- [ ] DATABASE_SYSTEM.md - Triggers section added
- [ ] RBAC_SYSTEM.md - Architecture updated
- [ ] RBAC_SYSTEM.md - user_type_scope documented
- [ ] API_CONTRACTS_SCHEMA_MANAGEMENT.md - Examples updated

### Supporting Docs
- [ ] ASSET_STORAGE_ARCHITECTURE.md - References updated
- [ ] DASHBOARD_SYSTEM.md - References updated
- [ ] LOGGING_ALERTING_SYSTEM.md - References updated
- [ ] NETWORK_WIFI_SYSTEM.md - References updated
- [ ] RUNTIME_CONFIGURATION_SYSTEM.md - References updated

### Project Overview
- [ ] project-overview.md - Auth section rewritten
- [ ] project-overview.md - Session 50 summary added
- [ ] project-overview.md - Future enhancements added

### Validation
- [ ] No references to old table names remain
- [ ] All examples use new schema
- [ ] Diagrams updated
- [ ] Session notes complete

---

## 📊 Success Criteria

1. **Accuracy:** All documentation reflects current implementation
2. **Completeness:** New features (user_type, triggers) fully documented
3. **Consistency:** Same terminology used across all docs
4. **Future-ready:** Documents both current state and planned enhancements
5. **Validation:** Zero references to deprecated table names

---

## 🔗 Related Documents

- Session 50 Notes: `project-docs/project-tracking/sessions/SESSION_50_NOTES.md`
- Auth Optimization Plan: `project-docs/research/claude-auth/AUTH-OPTIMIZATION-PLAN.md`
- Better Auth Analysis: `project-docs/research/claude-auth/BETTER_AUTH_RBAC_ANALYSIS.md`
- Integration Audit: `project-docs/research/claude-auth/BETTER_AUTH_INTEGRATION_AUDIT.md`

---

**Created for:** Session 52 (Documentation Update Agent)
**Estimated Duration:** 3-4 hours
**Priority:** High (documentation is source of truth for development)
