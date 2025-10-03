# Customer-Operator Architecture Design

**Research Date:** 2025-10-02
**Target:** Production-ready multi-user-type system
**Better Auth Version:** v1.3.24+
**Database:** SQLite with Drizzle ORM

---

## Executive Summary

**Architecture Goal:** Support operators and customers in a single, secure, database-driven system

**Key Design Decisions:**
1. ✅ Single `user` table with `user_type` field ('operator' | 'customer')
2. ✅ Database-driven RBAC via `roles` → `permissions` junction table
3. ✅ Multi-layer security (DB triggers + middleware + route guards + API checks)
4. ✅ Separate route groups: `/(app)` for operators, `/(customer)` for customers
5. ✅ Better Auth `additionalFields` for type-safe custom columns

**Security Model:** Defense in depth (4 layers)

**Estimated Effort:** 20-25 hours to full customer portal

---

## Target Schema Architecture

### Core User Table

**Location:** `packages/contracts/src/schema.ts`

```typescript
export const user = sqliteTable('user', {
  // Primary Key
  id: text('id').primaryKey(),  // UUID v4

  // Better Auth Core Fields
  name: text('name').notNull(),
  email: text('email').unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),

  // EscapePlan Custom Fields
  username: text('username').notNull().unique(),
  user_type: text('user_type').notNull().default('operator'), // 'operator' | 'customer'

  // Operator-Specific Fields (NULL for customers)
  role_id: text('role_id').references(() => roles.id, { onDelete: 'restrict' }),
  bio: text('bio'),
  avatar_config: text('avatar_config', { mode: 'json' }),
  must_reset_password: integer('must_reset_password', { mode: 'boolean' }).notNull().default(false),
  password_hash: text('password_hash'),

  // Customer-Specific Fields (NULL for operators)
  loyalty_points: integer('loyalty_points').default(0),
  preferred_difficulty: text('preferred_difficulty'),
  marketing_opted_in: integer('marketing_opted_in', { mode: 'boolean' }).default(false),

  // Shared Security Fields
  last_login_at: text('last_login_at'),
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  ban_reason: text('ban_reason'),
  ban_expires: text('ban_expires'),

  // Soft Delete
  archived_at: text('archived_at'),
  archived_by: text('archived_by').references(() => user.id),  // Self-reference
  archived_reason: text('archived_reason')
});
```

**Constraints:**
- `email` UNIQUE (optional for walk-in customers)
- `username` UNIQUE (required for all)
- `user_type` NOT NULL (default 'operator')

**Indexes:**
```sql
CREATE INDEX idx_user_type ON user(user_type);
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_user_username ON user(username);
```

---

### Database Triggers

**Security Enforcement Layer**

```sql
-- Trigger 1: Prevent customers from having operator roles
CREATE TRIGGER IF NOT EXISTS prevent_customer_operator_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'customer'
  AND NEW.role_id IN (
    SELECT id FROM roles WHERE name IN ('admin', 'manager', 'game_master')
  )
BEGIN
  SELECT RAISE(ABORT, 'Customers cannot have operator roles');
END;

-- Trigger 2: Prevent user_type changes (immutable)
CREATE TRIGGER IF NOT EXISTS prevent_user_type_change
BEFORE UPDATE OF user_type ON user
WHEN OLD.user_type != NEW.user_type
BEGIN
  SELECT RAISE(ABORT, 'User type cannot be changed after creation');
END;

-- Trigger 3: Ensure customers have customer role
CREATE TRIGGER IF NOT EXISTS ensure_customer_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'customer'
  AND (NEW.role_id IS NULL OR NEW.role_id != (SELECT id FROM roles WHERE name = 'customer'))
BEGIN
  SELECT RAISE(ABORT, 'Customers must have customer role');
END;

-- Trigger 4: Ensure operators have non-customer role
CREATE TRIGGER IF NOT EXISTS ensure_operator_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'operator'
  AND NEW.role_id = (SELECT id FROM roles WHERE name = 'customer')
BEGIN
  SELECT RAISE(ABORT, 'Operators cannot have customer role');
END;
```

**Benefit:** Database-level enforcement (cannot bypass via raw SQL)

---

### Roles Table (Enhanced)

```typescript
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  user_type_scope: text('user_type_scope').notNull(), // 'operator' | 'customer' | 'both'
  is_system: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});
```

**Seed Data:**

```sql
INSERT INTO roles (id, name, description, user_type_scope, is_system) VALUES
  -- Operator Roles
  ('role-admin', 'admin', 'Full system access', 'operator', 1),
  ('role-manager', 'manager', 'Manage bookings and sessions', 'operator', 1),
  ('role-game-master', 'game_master', 'Run and monitor game sessions', 'operator', 1),

  -- Customer Role
  ('role-customer', 'customer', 'Book and play games', 'customer', 1),

  -- Future: Custom roles
  ('role-vip-customer', 'vip_customer', 'VIP customer perks', 'customer', 0);
```

**Query Helper:**

```typescript
export async function getOperatorRoles() {
  return db.query.roles.findMany({
    where: inArray(roles.user_type_scope, ['operator', 'both'])
  });
}

export async function getCustomerRoles() {
  return db.query.roles.findMany({
    where: inArray(roles.user_type_scope, ['customer', 'both'])
  });
}
```

---

### Permissions Table (Enhanced)

```typescript
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  label: text('label').notNull(),
  category: text('category').notNull(),
  user_type_scope: text('user_type_scope').notNull(), // 'operator' | 'customer' | 'both'
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});
```

**Seed Data:**

```sql
-- Operator Permissions
INSERT INTO permissions (id, name, label, category, user_type_scope) VALUES
  ('perm-view-dashboard', 'view_dashboard', 'View Dashboard', 'dashboard', 'operator'),
  ('perm-manage-games', 'manage_games', 'Manage Games', 'games', 'operator'),
  ('perm-manage-sessions', 'manage_sessions', 'Manage Sessions', 'sessions', 'operator'),
  ('perm-manage-users', 'manage_users', 'Manage Users', 'users', 'operator'),

-- Customer Permissions
  ('perm-view-catalog', 'view_catalog', 'View Game Catalog', 'catalog', 'customer'),
  ('perm-create-booking', 'create_booking', 'Create Booking', 'bookings', 'customer'),
  ('perm-view-my-bookings', 'view_my_bookings', 'View My Bookings', 'bookings', 'customer'),
  ('perm-cancel-booking', 'cancel_booking', 'Cancel Booking', 'bookings', 'customer'),

-- Shared Permissions
  ('perm-view-profile', 'view_profile', 'View Profile', 'profile', 'both'),
  ('perm-edit-profile', 'edit_profile', 'Edit Profile', 'profile', 'both');
```

---

### Bookings Table (Enhanced)

```typescript
export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  booking_code: text('booking_code').notNull().unique(),
  game_id: text('game_id').notNull().references(() => games.id),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  status: text('status').notNull(),
  party_size: integer('party_size').notNull(),

  // Customer Association
  customer_id: text('customer_id').references(() => user.id), // NEW: NULL for walk-ins

  // Walk-In Customer Info (legacy fields, still needed for non-authenticated bookings)
  contact_name: text('contact_name').notNull(),
  contact_phone: text('contact_phone').notNull(),

  // Pricing
  deposit_due_cents: integer('deposit_due_cents').notNull().default(0),
  total_due_cents: integer('total_due_cents').notNull().default(0),
  price_tier: text('price_tier').notNull(),
  discount_code: text('discount_code'),

  // Metadata
  is_mobile: integer('is_mobile', { mode: 'boolean' }).notNull().default(false),
  is_adhoc: integer('is_adhoc', { mode: 'boolean' }).notNull().default(false),
  location_note: text('location_note'),
  notes: text('notes'),

  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});
```

**Key Change:** `customer_id` field links authenticated bookings to customer accounts

**Query Patterns:**

```typescript
// Get all bookings for a customer
export async function getCustomerBookings(customerId: string) {
  return db.query.bookings.findMany({
    where: eq(bookings.customer_id, customerId),
    orderBy: desc(bookings.start_time)
  });
}

// Check if email has bookings (for customer account creation)
export async function hasBookingsForEmail(email: string) {
  const count = await db.select({ count: sql`COUNT(*)` })
    .from(bookings)
    .where(sql`LOWER(contact_email) = LOWER(${email})`);
  return count[0].count > 0;
}
```

---

## Multi-Layer Security Architecture

### Layer 1: Database Triggers

**Purpose:** Hard constraint enforcement

**Validation:**
- ✅ Customer cannot have operator role
- ✅ Operator cannot have customer role
- ✅ `user_type` is immutable
- ✅ Role/user_type consistency enforced

**Cannot Bypass:** Even raw SQL fails

---

### Layer 2: Better Auth Hooks

**Purpose:** API middleware validation

**Implementation:**

```typescript
// apps/escapeplan-api/src/auth.ts

import { betterAuth } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification }
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
      }
    }
  },
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path.startsWith('/admin'),
        handler: createAuthMiddleware(async (ctx) => {
          const session = await getSessionFromCtx(ctx);

          if (!session?.user) {
            throw ctx.redirect('/auth/sign-in');
          }

          // Enforce operator-only access
          if (session.user.user_type !== 'operator') {
            throw ctx.redirect('/customer/dashboard');
          }

          return { context: ctx };
        })
      },
      {
        matcher: (ctx) => ctx.path.startsWith('/customer'),
        handler: createAuthMiddleware(async (ctx) => {
          const session = await getSessionFromCtx(ctx);

          if (!session?.user) {
            throw ctx.redirect('/auth/sign-in');
          }

          // Enforce customer-only access (or allow operators for support)
          if (session.user.user_type !== 'customer' && session.user.user_type !== 'operator') {
            throw ctx.redirect('/');
          }

          return { context: ctx };
        })
      }
    ]
  }
});
```

**Benefit:** API-level enforcement before any business logic runs

---

### Layer 3: SvelteKit Route Guards

**Purpose:** Frontend route protection

**Implementation:**

```typescript
// apps/escapeplan-web/src/hooks.server.ts

import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({
    headers: event.request.headers
  });

  // Operator Routes
  if (event.url.pathname.startsWith('/admin')) {
    if (!session?.user) {
      throw redirect(302, '/auth/sign-in?redirect=/admin');
    }

    if (session.user.user_type !== 'operator') {
      throw redirect(302, '/customer/dashboard');
    }
  }

  // Customer Routes
  if (event.url.pathname.startsWith('/customer')) {
    if (!session?.user) {
      throw redirect(302, '/auth/sign-in?redirect=/customer');
    }

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

**Benefit:** Prevents unauthorized page loads

---

### Layer 4: API Permission Checks

**Purpose:** Granular action authorization

**Implementation:**

```typescript
// apps/escapeplan-api/src/middleware/permissions.ts

export async function requirePermission(userId: string, permissionName: string) {
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

  const hasPermission = user?.role.rolePermissions.some(
    rp => rp.permission.name === permissionName
  );

  if (!hasPermission) {
    throw new Error(`Permission denied: ${permissionName}`);
  }
}

// Usage in API routes
api.post('/admin/games', async (request, reply) => {
  await requirePermission(request.user.id, 'manage_games');

  // ... create game logic
});
```

**Benefit:** Fine-grained control over specific actions

---

## Route Architecture

### Operator Routes (/(app) layout)

**Routes:**
```
/(app)/admin/
  ├─ dashboard/              # Analytics overview
  ├─ bookings/               # Booking management
  ├─ sessions/               # Live session control
  ├─ games/                  # Game content management
  ├─ users/                  # User management (operators + customers)
  ├─ roles/                  # RBAC management
  ├─ network/                # Network configuration
  ├─ storage/                # Asset management
  ├─ cameras/                # Camera feeds
  ├─ system/                 # System health, logs, backups
  └─ settings/               # System settings
```

**Layout Features:**
- Dark sidebar navigation
- Real-time alerts badge
- User menu with impersonation
- System health indicator

---

### Customer Routes (/(customer) layout)

**Routes:**
```
/(customer)/
  ├─ catalog/                # Browse escape rooms
  │   ├─ [slug]/            # Game detail page
  │   └─ [slug]/book/       # Booking flow
  ├─ cart/                   # Shopping cart (future)
  ├─ checkout/               # Payment (future: Square integration)
  ├─ dashboard/              # Customer dashboard
  │   ├─ upcoming/          # Upcoming bookings
  │   ├─ history/           # Past sessions
  │   └─ profile/           # Customer profile
  └─ booking/[code]/         # Booking confirmation/details
```

**Layout Features:**
- Clean, customer-facing design
- Game preview cards
- Booking summary sidebar
- Mobile-first responsive

---

### Public Routes (/(public) layout)

**Routes:**
```
/(public)/
  ├─ /                       # Landing page
  ├─ auth/
  │   ├─ sign-in/           # Login (detects user_type, redirects accordingly)
  │   ├─ sign-up/           # Registration (customer-only by default)
  │   ├─ forgot-password/   # Password reset
  │   └─ verify-email/      # Email verification
  └─ session/[slug]/         # Public session page (for players during game)
```

**Smart Sign-In Logic:**

```typescript
// After successful sign-in
export const actions = {
  signIn: async ({ request, cookies }) => {
    const formData = await request.formData();
    const { data, error } = await auth.api.signIn.email({
      email: formData.get('email'),
      password: formData.get('password')
    });

    if (error) return fail(401, { error: error.message });

    // Redirect based on user_type
    const redirectUrl = data.user.user_type === 'operator'
      ? '/admin/dashboard'
      : '/customer/dashboard';

    throw redirect(302, redirectUrl);
  }
};
```

---

## Better Auth Configuration

### Complete Auth Config

```typescript
// apps/escapeplan-api/src/auth.ts

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/client";
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
        type: "string",
        fieldName: "avatar_config",
        returned: true,
        input: true,
        required: false
      },
      loyalty_points: {
        type: "number",
        fieldName: "loyalty_points",
        returned: true,
        input: false,  // Server manages points
        required: false
      }
    }
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword(url, user) {
      // Send password reset email
      await sendEmail({
        to: user.email,
        subject: 'Reset Your Password',
        html: `<a href="${url}">Reset Password</a>`
      });
    },
    async sendVerificationEmail(url, user) {
      // Send verification email
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email',
        html: `<a href="${url}">Verify Email</a>`
      });
    }
  },
  socialProviders: {
    // Future: Google, Facebook OAuth
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24       // Update every 24 hours
  },
  hooks: {
    // (See Layer 2 security above)
  }
});
```

---

## User Creation Flows

### Operator Creation (Admin UI)

```typescript
// apps/escapeplan-api/src/state.ts

export async function createOperator(data: {
  username: string;
  name: string;
  email: string;
  role_id: string;
  must_reset_password?: boolean;
}) {
  const userId = randomUUID();
  const temporaryPassword = generateSecurePassword();

  // Insert user
  await db.insert(user).values({
    id: userId,
    username: data.username,
    name: data.name,
    email: data.email,
    emailVerified: false,
    user_type: 'operator',
    role_id: data.role_id,
    must_reset_password: data.must_reset_password ?? true,
    password_hash: await hashPassword(temporaryPassword),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Send welcome email with temporary password
  await sendEmail({
    to: data.email,
    subject: 'Welcome to EscapePlan',
    html: `
      <p>Your account has been created.</p>
      <p>Username: ${data.username}</p>
      <p>Temporary Password: ${temporaryPassword}</p>
      <p>You will be required to reset your password on first login.</p>
    `
  });

  return getUserById(userId);
}
```

---

### Customer Registration (Public)

```typescript
// apps/escapeplan-web/src/routes/(public)/auth/sign-up/+page.server.ts

export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();

    const { data, error } = await auth.api.signUp.email({
      email: formData.get('email'),
      password: formData.get('password'),
      name: formData.get('name'),
      username: formData.get('username'),
      callbackURL: '/customer/dashboard'
    });

    if (error) return fail(400, { error: error.message });

    // Server-side hook sets user_type = 'customer' and role_id = 'role-customer'
    throw redirect(302, '/customer/dashboard');
  }
};
```

**Server Hook for Customer Creation:**

```typescript
// In auth config
hooks: {
  after: [
    {
      matcher: (ctx) => ctx.path === '/sign-up/email',
      handler: createAuthMiddleware(async (ctx) => {
        const userId = ctx.context.returnValue.user.id;

        // Set customer-specific fields
        await db.update(user)
          .set({
            user_type: 'customer',
            role_id: (await db.query.roles.findFirst({
              where: eq(roles.name, 'customer')
            })).id,
            loyalty_points: 0
          })
          .where(eq(user.id, userId));

        return { context: ctx };
      })
    }
  ]
}
```

---

## Permission Management UI

### Operator Role Management

**Route:** `/admin/roles`

**Features:**
- List all roles
- Create custom roles (non-system)
- Assign permissions to roles
- View role members
- Cannot delete system roles

**Component Example:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let roles = [];
  let permissions = [];

  onMount(async () => {
    roles = await fetchRoles();
    permissions = await fetchPermissions();
  });

  async function assignPermission(roleId, permissionId) {
    await fetch('/api/admin/roles/' + roleId + '/permissions', {
      method: 'POST',
      body: JSON.stringify({ permission_id: permissionId })
    });
    // Refresh
  }
</script>

<h1>Role Management</h1>

{#each roles as role}
  <div class="role-card">
    <h3>{role.name}</h3>
    <p>{role.description}</p>
    <p>Scope: {role.user_type_scope}</p>

    <h4>Permissions</h4>
    {#each permissions.filter(p => p.user_type_scope === role.user_type_scope || p.user_type_scope === 'both') as perm}
      <label>
        <input type="checkbox"
               checked={role.permissions.includes(perm.id)}
               on:change={() => assignPermission(role.id, perm.id)} />
        {perm.label}
      </label>
    {/each}
  </div>
{/each}
```

---

## Customer Portal Features (Future)

### Phase 1: Basic Booking (Week 1-2)

**Features:**
- Browse game catalog
- View game details
- Create booking (date/time selection)
- View booking confirmation

**Routes:**
- `/customer/catalog`
- `/customer/catalog/[slug]`
- `/customer/catalog/[slug]/book`
- `/customer/booking/[code]`

---

### Phase 2: Account Management (Week 3-4)

**Features:**
- View upcoming bookings
- View booking history
- Edit profile
- Change password

**Routes:**
- `/customer/dashboard`
- `/customer/dashboard/upcoming`
- `/customer/dashboard/history`
- `/customer/dashboard/profile`

---

### Phase 3: Payments (Week 5-6)

**Features:**
- Square payment integration
- Deposit collection
- Receipt generation
- Refund processing

**API Endpoints:**
- `POST /api/customer/bookings/:id/pay`
- `GET /api/customer/bookings/:id/receipt`
- `POST /api/customer/bookings/:id/refund`

---

### Phase 4: Loyalty & Rewards (Week 7-8)

**Features:**
- Loyalty points tracking
- Rewards catalog
- Discount code application
- Referral program

**Schema:**
```typescript
export const customerRewards = sqliteTable('customer_rewards', {
  id: text('id').primaryKey(),
  customer_id: text('customer_id').notNull().references(() => user.id),
  reward_type: text('reward_type').notNull(), // 'points' | 'discount' | 'free_booking'
  amount: integer('amount').notNull(),
  expires_at: text('expires_at'),
  redeemed_at: text('redeemed_at')
});
```

---

## Type Definitions

### Extended User Types

```typescript
// packages/contracts/src/validation.ts

export type UserType = 'operator' | 'customer';

export interface BaseUser {
  id: string;
  username: string;
  name: string;
  email: string;
  emailVerified: boolean;
  user_type: UserType;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorUser extends BaseUser {
  user_type: 'operator';
  role_id: string;
  bio: string | null;
  avatar_config: object | null;
  must_reset_password: boolean;
}

export interface CustomerUser extends BaseUser {
  user_type: 'customer';
  loyalty_points: number;
  preferred_difficulty: string | null;
  marketing_opted_in: boolean;
}

export type User = OperatorUser | CustomerUser;
```

---

## Migration Phases

### Phase 1: Core Migration (2 weeks)
- Rename tables
- Add user_type field
- Implement triggers
- Update API/Frontend
- Test thoroughly

### Phase 2: Customer Registration (1 week)
- Enable customer sign-up
- Create customer dashboard
- Link existing bookings to accounts

### Phase 3: Customer Portal (4-6 weeks)
- Booking system
- Payment integration
- Loyalty program

**Total Timeline:** 7-9 weeks to full customer portal

---

## Conclusion

**Target Architecture:** Single `user` table with multi-layer security

**Key Features:**
- ✅ Database-driven RBAC
- ✅ Multi-user-type support (operator/customer)
- ✅ Better Auth integration with custom fields
- ✅ Defense-in-depth security (4 layers)
- ✅ Scalable for future customer features

**Next Steps:**
- Review implementation plan (Document 05)
- Get stakeholder approval
- Begin Phase 1 migration

---

**Document Version:** 1.0
**Author:** Claude Research Agent
**Status:** ✅ Architecture Design Complete
**Next Document:** `05-IMPLEMENTATION_PLAN.md`
