# Better Auth Best Practices (2025)

**Research Date:** 2025-10-02
**Better Auth Version:** v1.3.24+
**Source:** Context7 Documentation Analysis
**Focus:** User schema, custom fields, RBAC, multi-user types

---

## Executive Summary

Better Auth v1.3.24+ (2025) provides **comprehensive guidance** for:
- ✅ Singular `user` table naming convention
- ✅ Custom fields via `additionalFields` configuration
- ✅ Role-based access control patterns
- ✅ Multi-tenant/multi-user-type patterns via organization plugin
- ✅ Drizzle adapter best practices for SQLite

**Key Takeaway:** Better Auth is **flexible** and supports custom fields, but has **strong conventions** for table naming and session management.

---

## 1. User Table Naming Convention

### Recommendation: Singular `user` (Not Plural)

**Evidence from Better Auth Documentation:**

```typescript
// ✅ RECOMMENDED (2025)
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: "boolean" }).notNull(),
  // ... other fields
});
```

**Source:** `better-auth-drizzle` examples (Context7)
- GitHub: leamsigc/nuxt-better-auth-drizzle
- Shows: `export const user = sqliteTable("user", ...)` (singular)

### Why Singular?

1. **ORM Convention:** Most ORMs map singular model names to plural table names
   - Better Auth works with singular `user` out of the box
   - No need for `modelName` overrides

2. **Better Auth Internal Expectations:**
   ```typescript
   // Better Auth looks for these table names by default:
   - user (not users)
   - session (not sessions)
   - account (not accounts)
   - verification (not verifications)
   ```

3. **Custom modelName Required for Plural:**
   ```typescript
   // If you use plural tables, you MUST override:
   export const auth = betterAuth({
     database: drizzleAdapter(db, {
       schema: {
         user: users,           // Map 'user' → 'users' table
         session: sessions,
         account: accounts,
         verification: verifications
       }
     })
   });
   ```

**Recommendation for EscapePlan:**
- Rename `operators` → `user` (singular)
- Rename `operator_auth_sessions` → `session`
- Rename `operator_accounts` → `account`
- Rename `operator_verifications` → `verification`

**Benefits:**
- Native Better Auth compatibility
- No `modelName` overrides needed
- Cleaner migration path

---

## 2. Custom Fields Pattern

### additionalFields Configuration

Better Auth v1.3.24+ recommends defining custom fields via `additionalFields` in the auth config, NOT just in the database schema.

**Pattern from Documentation:**

```typescript
// Step 1: Define schema with custom fields
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  // Better Auth core fields
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: "boolean" }).notNull(),
  image: text('image'),
  createdAt: integer('createdAt', { mode: "timestamp" }).notNull(),
  updatedAt: integer('updatedAt', { mode: "timestamp" }).notNull(),

  // CUSTOM FIELDS
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  role_id: text('role_id').notNull(),
  user_type: text('user_type').notNull().default('operator'),
  bio: text('bio'),
  avatar_config: text('avatar_config', { mode: 'json' })
});

// Step 2: Register custom fields with Better Auth
export const auth = betterAuth({
  database: drizzleAdapter(useDrizzle(), {
    provider: "sqlite",
    schema: { user, session, account, verification }
  }),
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        fieldName: "firstName",  // Must match schema column name
        returned: true,          // Include in session/user objects
        input: true,             // Allow in sign-up/update requests
        required: true           // Validate on sign-up
      },
      lastName: {
        type: "string",
        fieldName: "lastName",
        returned: true,
        input: true,
        required: true
      },
      role_id: {
        type: "string",
        fieldName: "role_id",
        returned: true,
        input: false,            // Don't allow direct input (server sets)
        required: true
      },
      user_type: {
        type: "string",
        fieldName: "user_type",
        returned: true,
        input: false,            // Server-only field
        required: true
      },
      bio: {
        type: "string",
        fieldName: "bio",
        returned: true,
        input: true,
        required: false
      }
    }
  }
});
```

**Source:** `nuxt-better-auth-drizzle` example (Context7)

### Benefits of additionalFields

1. **Type Inference:** Better Auth client SDK knows about custom fields
   ```typescript
   // Client-side types automatically include custom fields
   const { data, error } = await authClient.signUp.email({
     email: "user@example.com",
     password: "...",
     firstName: "John",  // ✅ TypeScript knows this is valid
     lastName: "Doe"
   });
   ```

2. **API Validation:** Better Auth validates custom fields on sign-up/update
   ```typescript
   // Automatic validation if field is required
   if (!request.firstName || !request.lastName) {
     throw new Error("First and last name are required");
   }
   ```

3. **Session Serialization:** Fields marked `returned: true` appear in session
   ```typescript
   const session = await auth.api.getSession({ headers });
   console.log(session.user.firstName);  // ✅ Available
   console.log(session.user.role_id);    // ✅ Available
   console.log(session.user.user_type);  // ✅ Available
   ```

4. **Security:** Fields with `input: false` cannot be set by users
   ```typescript
   // ❌ User cannot set role_id or user_type via sign-up
   await authClient.signUp.email({
     email: "hacker@example.com",
     role_id: "role-admin",    // Ignored (input: false)
     user_type: "operator"     // Ignored (input: false)
   });
   ```

**Recommendation for EscapePlan:**
- Configure `additionalFields` for all custom fields
- Set `input: false` for `role_id`, `user_type` (server-only)
- Set `returned: true` for fields needed in session (role_id, user_type, bio, avatar_config)

---

## 3. Role-Based Access Control (RBAC)

### Better Auth Admin Plugin Pattern

Better Auth provides a **built-in admin plugin** with RBAC support.

**Pattern from Documentation:**

```typescript
import { createAccessControl } from "better-auth/plugins/access";

// Step 1: Define permission statements
export const statement = {
  project: ["create", "share", "update", "delete"],
  user: ["create", "list", "set-role", "ban", "impersonate", "delete"],
  session: ["list", "revoke", "delete"]
} as const;

// Step 2: Create access control instance
const ac = createAccessControl(statement);

// Step 3: Define roles with permissions
export const user = ac.newRole({
  project: ["create"]  // User can only create projects
});

export const admin = ac.newRole({
  project: ["create", "update", "delete"],
  user: ["ban", "set-role"],
  session: ["revoke"]
});

// Step 4: Use in Better Auth config
export const auth = betterAuth({
  plugins: [
    admin({
      roles: { user, admin }
    })
  ]
});
```

**Source:** Better Auth Admin Plugin docs (Context7)

### Permission Checking

```typescript
// Check if user has permission
await auth.api.userHasPermission({
  body: {
    role: "admin",
    permissions: {
      project: ["create"],
      user: ["ban"]
    }
  }
});
```

### Limitations of Built-in Admin Plugin

❌ **Not Database-Driven:** Permissions are hardcoded in auth config
❌ **No Dynamic Roles:** Cannot create roles via admin UI
❌ **No Per-User Permissions:** Only role-based, no user-specific overrides

**For EscapePlan:** Built-in plugin is **NOT suitable** because:
- We need database-driven roles (already implemented)
- We need dynamic role creation
- We need granular permission management

**Recommendation:** Keep custom database-driven RBAC, integrate with Better Auth via hooks

---

## 4. Multi-User Type Patterns

### Organization Plugin Pattern

Better Auth's **organization plugin** provides a pattern for multi-tenant/multi-user-type systems.

**Schema from Documentation:**

```typescript
// Organization table
export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logo: text('logo'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull()
});

// Member table (users in organizations)
export const member = sqliteTable('member', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organizationId').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),  // 'owner' | 'admin' | 'member'
  teamId: text('teamId').references(() => team.id),
  createdAt: text('createdAt').notNull()
});

// Session enhancement
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  userId: text('userId').notNull().references(() => user.id),
  activeOrganizationId: text('activeOrganizationId').references(() => organization.id),
  // ... other fields
});
```

**Source:** SurrealDB Better Auth adapter examples (Context7)

### Pattern Application to EscapePlan

**Insight:** We can adapt the organization pattern for operator/customer separation:

```typescript
// Instead of organizations, we have "user types"
// Instead of member roles, we have "operator roles"

// USER TABLE
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  user_type: text('user_type').notNull().default('operator'), // 'operator' | 'customer'
  // ... other fields
});

// OPERATOR-SPECIFIC DATA (like organization membership)
// Only exists for user_type = 'operator'
export const operator_profile = sqliteTable('operator_profile', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role_id: text('role_id').notNull().references(() => roles.id),
  bio: text('bio'),
  avatar_config: text('avatar_config', { mode: 'json' }),
  // ... operator-specific fields
});

// CUSTOMER-SPECIFIC DATA
export const customer_profile = sqliteTable('customer_profile', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  loyalty_points: integer('loyalty_points').default(0),
  preferred_difficulty: text('preferred_difficulty'),
  // ... customer-specific fields
});
```

**Benefits:**
- ✅ Clean separation of operator vs customer data
- ✅ `user` table contains only shared fields
- ✅ Profile tables contain type-specific fields
- ✅ Easier to query (no null fields for unused user types)

**Alternative:** Single `user` table with all fields (simpler but messier)

```typescript
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  user_type: text('user_type').notNull().default('operator'),

  // Operator-only fields (NULL for customers)
  role_id: text('role_id').references(() => roles.id),
  bio: text('bio'),
  avatar_config: text('avatar_config', { mode: 'json' }),

  // Customer-only fields (NULL for operators)
  loyalty_points: integer('loyalty_points'),
  preferred_difficulty: text('preferred_difficulty')
});
```

**Recommendation:** Use **profile table pattern** for cleaner separation

---

## 5. Session Management Best Practices

### Session Middleware Pattern

**Pattern from Documentation:**

```typescript
import { sessionMiddleware } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/plugins";

// Protect endpoint with session check
const myPlugin = () => {
  return {
    id: "my-plugin",
    endpoints: {
      getProtectedData: createAuthEndpoint("/protected", {
        method: "GET",
        use: [sessionMiddleware],  // ✅ Require valid session
      }, async (ctx) => {
        const session = ctx.context.session;  // ✅ Guaranteed to exist
        return ctx.json({ user: session.user });
      })
    }
  };
};
```

**Source:** Better Auth Plugins documentation (Context7)

### Accessing Session in Hooks

```typescript
import { getSessionFromCtx } from "better-auth/plugins";

export const myPlugin = {
  id: "my-plugin",
  hooks: {
    before: [{
      matcher: (context) => context.path.startsWith('/admin'),
      handler: createAuthMiddleware(async (ctx) => {
        const session = await getSessionFromCtx(ctx);

        if (!session?.user) {
          throw ctx.redirect("/auth/sign-in");
        }

        // Custom validation
        if (session.user.user_type !== 'operator') {
          throw ctx.redirect("/customer/dashboard");
        }

        return { context: ctx };
      })
    }]
  }
};
```

**Recommendation for EscapePlan:**
- Use `sessionMiddleware` for API routes
- Use `getSessionFromCtx` in custom hooks for route guards
- Add `user_type` check to prevent customers accessing operator routes

---

## 6. Database Triggers for Validation

### SQLite Trigger Pattern

Better Auth doesn't provide built-in trigger support, but SQLite triggers can enforce business rules.

**Pattern for EscapePlan:**

```sql
-- Prevent customers from having operator roles
CREATE TRIGGER IF NOT EXISTS prevent_customer_operator_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'customer'
  AND NEW.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'manager', 'game_master'))
BEGIN
  SELECT RAISE(ABORT, 'Customers cannot be assigned operator roles');
END;

-- Prevent role_id changes for existing users (immutable after creation)
CREATE TRIGGER IF NOT EXISTS prevent_role_id_update
BEFORE UPDATE OF role_id ON user
WHEN OLD.role_id != NEW.role_id
BEGIN
  SELECT RAISE(ABORT, 'Role ID cannot be changed after user creation');
END;

-- Ensure user_type matches role
CREATE TRIGGER IF NOT EXISTS ensure_user_type_role_match
BEFORE INSERT ON user
WHEN NEW.user_type = 'operator' AND NEW.role_id = (SELECT id FROM roles WHERE name = 'customer')
BEGIN
  SELECT RAISE(ABORT, 'Operators cannot have customer role');
END;
```

**Recommendation:** Implement triggers for critical security constraints

---

## 7. Drizzle Adapter Configuration

### Recommended Pattern for SQLite

**Pattern from Documentation:**

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

// Step 1: Create SQLite connection
const sqlite = new Database("./data/escapeplan.db");

// Step 2: Create Drizzle instance
const db = drizzle(sqlite, { schema });

// Step 3: Configure Better Auth
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification
      // Include custom tables if needed
    }
  }),
  user: {
    additionalFields: {
      // ... custom fields
    }
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword(url, user) {
      // Send email logic
    }
  }
});
```

**Source:** nuxt-better-auth-drizzle (Context7)

**Key Points:**
- ✅ Use `better-sqlite3` driver (not libsql, bun:sqlite)
- ✅ Pass all schema tables to drizzleAdapter
- ✅ Set `provider: "sqlite"` explicitly
- ✅ Configure `additionalFields` for custom columns

---

## 8. Type Safety Best Practices

### Infer Types from Better Auth

```typescript
// Server-side
import type { Session, User } from "better-auth";

export type AppUser = User & {
  role_id: string;
  user_type: 'operator' | 'customer';
  bio: string | null;
};

// Client-side (auto-inferred from additionalFields)
import { authClient } from "./auth-client";

const { data } = await authClient.getSession();
// data.user.role_id is typed ✅
// data.user.user_type is typed ✅
```

### Custom Session Context

```typescript
// Extend locals for SvelteKit
declare global {
  namespace App {
    interface Locals {
      user: AppUser | null;
      session: Session | null;
    }
  }
}
```

**Recommendation:** Use TypeScript augmentation for custom session data

---

## 9. Migration Strategy Insights

### Schema Generation

Better Auth CLI can generate schema:

```bash
npx @better-auth/cli@latest generate
```

**What it generates:**
- Core tables (user, session, account, verification)
- SQL migration files
- TypeScript types

**For EscapePlan:** Don't use CLI (we have custom schema)
- We already have Drizzle schema
- We need custom fields not in Better Auth defaults
- Better to manually align schema with Better Auth conventions

### Table Renaming Migration

**Drizzle Kit Approach:**

```typescript
// Step 1: Rename tables in schema.ts
export const user = sqliteTable('user', { ... });           // was: operators
export const session = sqliteTable('session', { ... });     // was: operator_auth_sessions
export const account = sqliteTable('account', { ... });     // was: operator_accounts
export const verification = sqliteTable('verification', { ... }); // was: operator_verifications

// Step 2: Generate migration
// $ npx drizzle-kit generate

// Generated SQL:
ALTER TABLE operators RENAME TO user;
ALTER TABLE operator_auth_sessions RENAME TO session;
ALTER TABLE operator_accounts RENAME TO account;
ALTER TABLE operator_verifications RENAME TO verification;

// Step 3: Update foreign key references
// Drizzle-kit handles this automatically ✅
```

**Recommendation:** Use Drizzle Kit for schema migrations (safe, tested)

---

## 10. Security Best Practices

### Multi-Layer Defense

**Pattern from Analysis:**

```typescript
// Layer 1: Database trigger (SQLite)
CREATE TRIGGER prevent_customer_operator_role ...

// Layer 2: Better Auth hook (API middleware)
export const auth = betterAuth({
  hooks: {
    before: [{
      matcher: (ctx) => ctx.path.startsWith('/admin'),
      handler: createAuthMiddleware(async (ctx) => {
        const session = await getSessionFromCtx(ctx);
        if (session.user.user_type !== 'operator') {
          throw ctx.redirect('/customer/dashboard');
        }
      })
    }]
  }
});

// Layer 3: SvelteKit hooks (Route guard)
export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({ headers: event.request.headers });

  if (event.url.pathname.startsWith('/admin')) {
    if (session?.user.user_type !== 'operator') {
      throw redirect(302, '/customer/dashboard');
    }
  }
}

// Layer 4: API endpoint checks (Fastify)
api.post('/admin/games', async (request, reply) => {
  if (request.user.user_type !== 'operator') {
    return reply.status(403).send({ error: 'Forbidden' });
  }
});
```

**Recommendation:** Implement all 4 layers for defense in depth

---

## 11. Key Decisions & Trade-offs

### Decision 1: Single `user` Table vs Separate `operators`/`customers`

**Option A: Single Table** (✅ Better Auth Recommended)
```typescript
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  user_type: text('user_type').notNull(), // 'operator' | 'customer'
  role_id: text('role_id').references(() => roles.id),
  // ... all fields
});
```

**Pros:**
- ✅ Better Auth native support
- ✅ Single session table
- ✅ Simpler authentication flow

**Cons:**
- ❌ Nullable fields for type-specific data
- ❌ Larger table (more columns)

**Option B: Separate Tables**
```typescript
export const operator = sqliteTable('operator', { ... });
export const customer = sqliteTable('customer', { ... });
```

**Pros:**
- ✅ Clean separation
- ✅ No nullable fields

**Cons:**
- ❌ Better Auth doesn't support multiple user tables natively
- ❌ Complex custom adapter required
- ❌ Duplicate session/account tables

**Recommendation:** Use single `user` table with `user_type` field

---

### Decision 2: Keep Database-Driven RBAC vs Use Better Auth Admin Plugin

**Option A: Keep Current RBAC** (✅ Recommended)
- Database tables: `roles`, `permissions`, `role_permissions`
- Dynamic role creation
- Granular permission management

**Option B: Switch to Better Auth Admin Plugin**
- Hardcoded roles in auth config
- No UI for role management
- Limited flexibility

**Recommendation:** Keep database-driven RBAC, integrate via hooks

---

### Decision 3: Profile Tables vs Single User Table

**Option A: Profile Tables**
```typescript
user (shared fields)
  ├─→ operator_profile (operator-only fields)
  └─→ customer_profile (customer-only fields)
```

**Option B: Single Table**
```typescript
user (all fields, some nullable based on user_type)
```

**Recommendation:** Single table for Phase 1, profile tables for Phase 2 (future optimization)

---

## Conclusion

**Better Auth v1.3.24+ Best Practices Summary:**

1. ✅ Use singular `user` table (not `operators`)
2. ✅ Configure `additionalFields` for custom columns
3. ✅ Use `sessionMiddleware` for protected routes
4. ✅ Implement multi-layer security (DB triggers + hooks + route guards)
5. ✅ Keep database-driven RBAC (Better Auth admin plugin too limited)
6. ✅ Use Drizzle adapter with explicit schema mapping
7. ✅ Add `user_type` field for operator/customer differentiation
8. ✅ Remove redundant `role` string and `permissions` JSON fields

**Next Steps:**
- Review migration strategy (Document 03)
- Design final architecture (Document 04)
- Plan implementation (Document 05)

---

**Document Version:** 1.0
**Author:** Claude Research Agent
**Status:** ✅ Best Practices Documented
**Next Document:** `03-MIGRATION_STRATEGY.md`
