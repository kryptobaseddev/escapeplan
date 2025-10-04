# Customer vs Operator User Separation - Architectural Analysis

**Date:** 2025-10-02
**Status:** PROPOSAL - Awaiting Approval
**Impact:** HIGH - Database schema, auth system, RBAC, frontend routing

---

## Executive Summary

**Problem:** Current `operators` table contains ALL users (employees + customers). The `customer` role exists but customers have access to the same auth system as operators. We need complete separation to prevent customers from accessing the control room system.

**Recommendation:** **Rename `operators` → `users`, add `user_type` field, create separate customer-facing routes**

**Estimated Effort:**
- Schema migration: 2h
- API refactoring: 4h
- Frontend refactoring: 3h
- Customer portal (future): 20-40h

---

## 1. Current State Analysis

### Database Schema

**Current Tables:**
```
operators                    # ALL users (operators + customers)
├── id, username, name, email
├── role                     # 'admin' | 'manager' | 'game_master' | 'customer'
├── role_id                  # FK to roles table
├── permissions (JSON)       # Denormalized permissions cache
└── [auth fields...]

operator_auth_sessions       # Auth sessions
operator_accounts            # Better Auth accounts
operator_verifications       # Email verification
```

**Problems:**
1. ❌ Table name `operators` doesn't semantically include customers
2. ❌ Customers share same auth tables/sessions as operators
3. ❌ No hard boundary preventing customers from accessing operator routes
4. ❌ RBAC relies purely on `role` field - easy to misconfigure
5. ❌ Customers currently get full Better Auth session enrichment (unnecessary overhead)

---

## 2. Better Auth Recommendations

### Standard Schema (Better Auth v1.3)

Better Auth recommends:
- `user` (singular) - main user table
- `session` - auth sessions
- `account` - OAuth/auth provider accounts
- `verification` - email verification tokens

**Our Current Mapping:**
```
Better Auth Standard → Our Current Implementation
────────────────────────────────────────────────
user                 → operators
session              → operator_auth_sessions
account              → operator_accounts
verification         → operator_verifications
```

**Better Auth Flexibility:**
- ✅ Allows custom table names via `modelName` config
- ✅ Allows custom field names via `fields` mapping
- ✅ Supports additional custom fields via `additionalFields`

**Current Config** (auth-config.ts:32):
```typescript
user: {
  modelName: 'operators',  // ← Can change to 'users'
  fields: {
    email: 'email',
    name: 'name',
    createdAt: 'created_at',
    // ...
  }
}
```

---

## 3. Architectural Options

### Option A: Single Table with `user_type` Field ✅ RECOMMENDED

**Schema:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  user_type TEXT NOT NULL,  -- 'operator' | 'customer' ← NEW
  role TEXT NOT NULL,         -- admin, manager, game_master, customer
  role_id TEXT NOT NULL,      -- FK to roles table
  permissions TEXT,           -- JSON cache (operators only)
  -- ... rest of fields
);
```

**Pros:**
- ✅ Aligns with Better Auth conventions (`user` table)
- ✅ Single auth flow, simpler session management
- ✅ Clear separation via `user_type` field
- ✅ Can add DB constraints (`CHECK (user_type IN ('operator', 'customer'))`)
- ✅ Can index `user_type` for fast filtering
- ✅ Easy migration path from current schema

**Cons:**
- ⚠️ Requires updating ALL permission checks to verify `user_type`
- ⚠️ Risk of accidental customer access if `user_type` check missed

**Mitigation:**
- TypeScript guards: `isOperator(user)`, `isCustomer(user)` helpers
- Middleware: Route-level `requireOperator()` guard
- Database triggers: Prevent customers from having operator role_ids

---

### Option B: Separate `operators` + `customers` Tables ❌ NOT RECOMMENDED

**Schema:**
```sql
CREATE TABLE operators (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  -- operator-specific fields
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  -- customer-specific fields (address, payment methods, etc)
);
```

**Pros:**
- ✅ Complete physical separation
- ✅ Impossible for customers to have operator permissions
- ✅ Can have different fields per table type

**Cons:**
- ❌ Better Auth doesn't natively support multiple user tables
- ❌ Would need custom auth adapter or two separate auth instances
- ❌ Session enrichment becomes complex (which table to query?)
- ❌ Foreign keys become complex (polymorphic user_id references)
- ❌ Duplicate fields (email, name, created_at, etc)
- ❌ Migration complexity HIGH

---

### Option C: Keep `operators`, Add `user_type` Field ❌ NOT RECOMMENDED

**Same as Option A but keeps table name**

**Cons:**
- ❌ Table name semantically incorrect
- ❌ Misalignment with Better Auth conventions
- ❌ Confusing codebase (table named "operators" contains customers)

---

## 4. What Would Break: Impact Analysis

### If We Rename `operators` → `users`

#### Database Layer (2h effort)

**Schema Changes:**
```sql
-- Migration
ALTER TABLE operators RENAME TO users;
ALTER TABLE operator_auth_sessions RENAME TO user_sessions;
ALTER TABLE operator_accounts RENAME TO user_accounts;
ALTER TABLE operator_verifications RENAME TO user_verifications;

-- Add new field
ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'operator';

-- Update foreign keys
-- bookings, sessions, assets, alerts all reference operators.id
-- SQLite: Need to recreate tables with new FK references
```

**Foreign Key References (10 locations):**
```typescript
// schema.ts
rolePermissions.granted_by     → references(() => operators.id)  // LINE 36
sessions.crew_primary          → NOT A FK (just TEXT field)
sessions.crew_support          → NOT A FK (just TEXT field)
sessionMilestones.triggered_by → references(() => operators.id)  // LINE 263
assets.uploaded_by             → references(() => operators.id)  // LINE 295
alerts.dismissed_by            → references(() => operators.id)  // LINE 382
```

**Drizzle Schema Updates:**
```diff
- export const operators = sqliteTable('operators', { ... })
+ export const users = sqliteTable('users', {
+   user_type: text('user_type').notNull().default('operator'),
    ...
  })

- export const operatorAuthSessions = sqliteTable('operator_auth_sessions', { ... })
+ export const userSessions = sqliteTable('user_sessions', { ... })

- export const operatorAccounts = sqliteTable('operator_accounts', { ... })
+ export const userAccounts = sqliteTable('user_accounts', { ... })

- export const operatorVerifications = sqliteTable('operator_verifications', { ... })
+ export const userVerifications = sqliteTable('user_verifications', { ... })
```

---

#### API Layer (4h effort)

**Files with `operators` imports (10 files):**

1. **auth-config.ts** (auth-config.ts:8, 19, 32)
   ```diff
   - import { operators, operatorAuthSessions, ... } from './db/schema.js';
   + import { users, userSessions, ... } from './db/schema.js';

   - modelName: 'operators',
   + modelName: 'users',
   ```

2. **state.ts** - All CRUD operations
   ```typescript
   // Current
   db.select().from(operators).where(eq(operators.id, userId))

   // After
   db.select().from(users).where(eq(users.id, userId))
   ```

3. **index.ts** - API route handlers
   - GET /api/admin/users
   - POST /api/admin/users
   - PATCH /api/admin/users/:id
   - DELETE /api/admin/users/:id

4. **db/seed.ts** - Seed data insertion
5. **security.ts** - Permission checks
6. **logging/database.ts** - Log queries
7. **test files** - Integration tests

**Type Changes:**
```typescript
// Currently exported types use "Operator" naming
type Operator = typeof operators.$inferSelect;
type NewOperator = typeof operators.$inferInsert;

// After rename
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
```

---

#### Contracts Package (1h effort)

**packages/contracts/src/index.ts:**
```diff
- export type OperatorRole = 'admin' | 'manager' | 'game_master' | 'customer';
- export type OperatorPermission = ...
- export interface OperatorProfile { ... }
- export interface OperatorSummary { ... }
- export interface CreateOperatorRequest { ... }

+ export type UserRole = 'admin' | 'manager' | 'game_master' | 'customer';
+ export type UserType = 'operator' | 'customer';  // NEW
+ export type UserPermission = ...
+ export interface UserProfile {
+   userType: UserType;  // NEW
+   role: UserRole;
+   permissions: UserPermission[];
+ }
```

**Breaking Change Strategy:**
```typescript
// Option 1: Deprecation aliases (recommended)
/** @deprecated Use UserRole instead */
export type OperatorRole = UserRole;

/** @deprecated Use UserProfile instead */
export interface OperatorProfile extends UserProfile {}

// Option 2: Keep both for now, remove later
export type UserRole = 'admin' | 'manager' | 'game_master' | 'customer';
export type OperatorRole = UserRole; // Alias
```

---

#### Frontend (3h effort)

**Type Imports (50+ locations):**
```typescript
// escapeplan-web/src/routes/**/*.ts
import type { OperatorProfile, OperatorSummary } from '@escapeplan/contracts';

// After
import type { UserProfile, UserSummary } from '@escapeplan/contracts';
```

**UI Text (20+ locations):**
```svelte
<!-- Current -->
<h1>Manage Operators</h1>
<button>Create Operator</button>
<p>Operator {operator.name} created</p>

<!-- After -->
<h1>Manage Staff</h1>  <!-- or "Team Members" -->
<button>Add Staff</button>
<p>User {user.name} created</p>
```

**Route Names:**
```
/admin/users  ← Keep this (generic enough)
NOT /admin/operators (would need renaming)
```

---

## 5. Customer vs Operator Differentiation Strategy

### Permission Matrix Evolution

**Current Roles:**
```typescript
type OperatorRole = 'admin' | 'manager' | 'game_master' | 'customer';
```

**Proposed Structure:**
```typescript
type UserType = 'operator' | 'customer';

type OperatorRole = 'admin' | 'manager' | 'game_master';
type CustomerRole = 'customer' | 'vip_customer'; // Future: loyalty tiers?

type UserRole = OperatorRole | CustomerRole;
```

**Permission Separation:**
```typescript
// Operator permissions (27 existing)
'view_dashboard', 'manage_sessions', 'send_hints', 'manage_users', ...

// Customer permissions (NEW - 5-10 permissions)
'view_catalog',           // Browse escape room catalog
'create_booking',         // Book a timeslot
'view_own_bookings',      // See their bookings
'cancel_own_booking',     // Cancel within policy
'edit_own_profile',       // Update profile
'view_past_sessions',     // See completed sessions
'make_payment',           // Square checkout
```

**Database Constraints:**
```sql
-- Ensure operators can't be customers
CREATE TRIGGER prevent_customer_operator_role
BEFORE INSERT ON users
WHEN NEW.user_type = 'customer' AND NEW.role_id NOT IN (
  SELECT id FROM roles WHERE name = 'customer'
)
BEGIN
  SELECT RAISE(ABORT, 'Customers must have customer role');
END;

-- Ensure operators have operator roles
CREATE TRIGGER prevent_operator_customer_role
BEFORE INSERT ON users
WHEN NEW.user_type = 'operator' AND NEW.role_id IN (
  SELECT id FROM roles WHERE name = 'customer'
)
BEGIN
  SELECT RAISE(ABORT, 'Operators cannot have customer role');
END;
```

---

### Route Guards Evolution

**Current Guards:**
```typescript
// hooks.server.ts - protects ALL /(app)/* routes
if (!session?.user) {
  throw redirect(302, '/login');
}
```

**Proposed Guards:**
```typescript
// hooks.server.ts
if (!session?.user) {
  throw redirect(302, '/login');
}

// NEW: Redirect customers away from operator routes
if (url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/games/')) {

  if (session.user.userType === 'customer') {
    throw redirect(302, '/customer/dashboard');
  }
}

// NEW: Redirect operators away from customer routes
if (url.pathname.startsWith('/customer')) {
  if (session.user.userType === 'operator') {
    throw redirect(302, '/dashboard');
  }
}
```

**Helper Functions:**
```typescript
// lib/auth/guards.ts
export function requireOperator(user: UserProfile): asserts user is OperatorUser {
  if (user.userType !== 'operator') {
    throw error(403, 'Operator access required');
  }
}

export function requireCustomer(user: UserProfile): asserts user is CustomerUser {
  if (user.userType !== 'customer') {
    throw error(403, 'Customer access required');
  }
}

// Usage in +page.server.ts
export const load = async ({ locals }) => {
  requireOperator(locals.user);
  // TypeScript now knows user is OperatorUser
};
```

---

## 6. Customer-Facing System Architecture

### Route Structure (NEW)

```
apps/escapeplan-web/src/routes/
├── (auth)/                  # Public auth (shared)
│   ├── login/
│   └── logout/
│
├── (app)/                   # OPERATOR ONLY (existing)
│   ├── dashboard/           # Active sessions grid
│   ├── bookings/            # Calendar management
│   ├── games/               # Game library + runner
│   ├── admin/
│   │   ├── users/           # Staff management
│   │   └── network/         # Network config
│   └── account/
│       └── profile/         # Self-service profile
│
└── (customer)/              # CUSTOMER ONLY (NEW)
    ├── +layout.svelte       # Customer nav/theme
    ├── +layout.server.ts    # requireCustomer() guard
    ├── catalog/             # Browse escape rooms
    │   ├── +page.svelte     # Game grid/list view
    │   └── [slug]/          # Game detail page
    │       └── +page.svelte # Description, pricing, reviews
    ├── booking/             # Booking flow
    │   ├── +page.svelte     # Select game + timeslot
    │   ├── cart/            # Shopping cart (multi-room bookings)
    │   └── checkout/        # Square payment integration
    ├── dashboard/           # Customer dashboard
    │   └── +page.svelte     # Upcoming bookings, past sessions
    ├── bookings/            # Booking history
    │   ├── +page.svelte     # List view
    │   └── [id]/            # Booking detail
    │       ├── +page.svelte # Details, cancel, modify
    │       └── receipt/     # View receipt
    └── profile/             # Customer profile
        └── +page.svelte     # Edit name, email, phone, password
```

---

### Customer Features (Future Implementation)

#### 1. Catalog & Discovery
```svelte
<!-- (customer)/catalog/+page.svelte -->
<script>
  let games = $props();  // Load from /api/public/games
  let filters = $state({ difficulty: 'all', players: 'any', price: 'all' });
</script>

<GameGrid {games} {filters} />
```

**API Endpoint (NEW):**
```typescript
// GET /api/public/games
app.get('/api/public/games', async (request, reply) => {
  const games = await db
    .select({
      id: schema.games.id,
      slug: schema.games.slug,
      name: schema.games.name,
      description: schema.games.description,
      difficulty: schema.games.difficulty,
      duration_minutes: schema.games.duration_minutes,
      min_players: schema.games.min_players,
      max_players: schema.games.max_players,
      price_per_player_cents: schema.games.price_per_player_cents,
    })
    .from(schema.games)
    .where(isNull(schema.games.archived_at));  // Only active games

  return { games };
});
```

---

#### 2. Booking Flow

**Step 1: Select Game & Date**
```svelte
<!-- (customer)/booking/+page.svelte -->
<script>
  let selectedGame = $state(null);
  let selectedDate = $state(today());
  let availableSlots = $derived(/* fetch from API */);
</script>

<GameSelector bind:selectedGame />
<DatePicker bind:selectedDate />
<TimeSlotGrid slots={availableSlots} />
```

**Step 2: Party Details**
```svelte
<PartyDetailsForm
  bind:partySize
  bind:contactName
  bind:contactPhone
  bind:notes
/>
```

**Step 3: Add to Cart (Multi-Room Support)**
```typescript
// lib/stores/cart.svelte.ts
export const cartStore = $state({
  items: [] as BookingCartItem[],

  addItem(booking: BookingCartItem) {
    this.items.push(booking);
  },

  removeItem(index: number) {
    this.items.splice(index, 1);
  },

  get total() {
    return this.items.reduce((sum, item) => sum + item.total_due_cents, 0);
  }
});
```

**Step 4: Checkout (Square Integration)**
```svelte
<!-- (customer)/booking/checkout/+page.svelte -->
<script>
  import { loadSquarePaymentForm } from '$lib/payments/square';

  let paymentForm = $state(null);

  onMount(async () => {
    paymentForm = await loadSquarePaymentForm({
      amount: cartStore.total,
      currency: 'USD'
    });
  });
</script>

<CartSummary items={cartStore.items} />
<SquarePaymentForm bind:this={paymentForm} />
<button onclick={handleCheckout}>Complete Booking</button>
```

**API Endpoint (NEW):**
```typescript
// POST /api/customer/bookings
app.post('/api/customer/bookings', {
  preHandler: [requireSession, requireCustomer]
}, async (request, reply) => {
  const { items, paymentNonce } = request.body;

  // 1. Validate availability
  // 2. Create booking records
  // 3. Process payment via Square
  // 4. Send confirmation email
  // 5. Return booking confirmations
});
```

---

#### 3. Customer Dashboard

```svelte
<!-- (customer)/dashboard/+page.svelte -->
<script lang="ts">
  let { data } = $props();  // { upcomingBookings, pastSessions }
</script>

<section>
  <h2>Upcoming Adventures</h2>
  <BookingCardGrid bookings={data.upcomingBookings} />
</section>

<section>
  <h2>Past Experiences</h2>
  <SessionCardGrid sessions={data.pastSessions} />
  <!-- Show: game played, date, escaped/failed, time remaining -->
</section>

<section>
  <h2>Quick Actions</h2>
  <ActionButton href="/customer/catalog">Browse Games</ActionButton>
  <ActionButton href="/customer/bookings">View All Bookings</ActionButton>
</section>
```

**API Endpoint (NEW):**
```typescript
// GET /api/customer/dashboard
app.get('/api/customer/dashboard', {
  preHandler: [requireSession, requireCustomer]
}, async (request, reply) => {
  const userId = request.user!.id;

  const upcomingBookings = await db
    .select()
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.customer_id, userId),  // ← NEW FK
      gte(schema.bookings.start_time, new Date().toISOString()),
      eq(schema.bookings.status, 'confirmed')
    ))
    .orderBy(asc(schema.bookings.start_time))
    .limit(5);

  // Similar for past sessions...

  return { upcomingBookings, pastSessions };
});
```

---

#### 4. Schema Changes for Customer Support

**Add `customer_id` to bookings:**
```typescript
export const bookings = sqliteTable('bookings', {
  // ... existing fields

  // NEW: Link bookings to customer accounts
  customer_id: text('customer_id').references(() => users.id),  // ← NEW

  // Keep contact fields for walk-ins without accounts
  contact_name: text('contact_name').notNull(),
  contact_phone: text('contact_phone').notNull(),
});
```

**Migration Strategy:**
```sql
-- Step 1: Add nullable column
ALTER TABLE bookings ADD COLUMN customer_id TEXT REFERENCES users(id);

-- Step 2: Create customer accounts for existing bookings (optional)
-- Could create guest accounts: username = 'guest-{bookingCode}'

-- Step 3: Future bookings require customer_id OR contact_name
```

---

## 7. Kiosk Mode Considerations

### Public Kiosk Interface

**Use Case:** Tablet/iPad at storefront for walk-in bookings

**Route:** `/kiosk` (public, no auth required)

```svelte
<!-- routes/(kiosk)/kiosk/+page.svelte -->
<script lang="ts">
  // Full-screen booking interface
  // No navigation, minimal UI
  // Auto-reset after 2 minutes of inactivity
</script>

<KioskGameSelector />
<KioskTimeSlotPicker />
<KioskContactForm />  <!-- Guest checkout, no account creation -->
<KioskPaymentTerminal />  <!-- Square terminal integration -->
```

**Features:**
- ✅ No login required
- ✅ Guest checkout (no account creation)
- ✅ Square terminal API for in-person payments
- ✅ Print receipt confirmation
- ✅ Auto-reset/timeout for security

**Security:**
- 🔒 Rate limiting (prevent spam bookings)
- 🔒 CAPTCHA or proof-of-work (prevent bots)
- 🔒 IP restrictions (only allow from storefront IPs)

---

## 8. Migration Roadmap

### Phase 1: Schema Rename (Week 1)

**Tasks:**
- [ ] Generate migration: `operators` → `users`
- [ ] Add `user_type` column (default 'operator')
- [ ] Rename auth tables: `operator_*` → `user_*`
- [ ] Update all FK references
- [ ] Test migration on dev database
- [ ] Update Drizzle schema.ts
- [ ] Rebuild contracts package

**Deliverables:**
- ✅ Migration SQL file
- ✅ Updated schema.ts
- ✅ All existing data preserved with `user_type = 'operator'`

---

### Phase 2: API Refactoring (Week 1-2)

**Tasks:**
- [ ] Update auth-config.ts (`modelName: 'users'`)
- [ ] Rename all `operators` → `users` in state.ts
- [ ] Update all API route handlers
- [ ] Add `requireOperator()` middleware
- [ ] Update seed scripts
- [ ] Fix all TypeScript errors
- [ ] Run integration tests

**Deliverables:**
- ✅ All API endpoints working
- ✅ Tests passing
- ✅ Existing operators can still log in

---

### Phase 3: Frontend Refactoring (Week 2)

**Tasks:**
- [ ] Update all `OperatorProfile` → `UserProfile` imports
- [ ] Update UI text ("Operators" → "Staff" or "Team")
- [ ] Add `requireOperator()` guards to /(app) routes
- [ ] Test all existing operator flows
- [ ] Update documentation

**Deliverables:**
- ✅ All existing features work
- ✅ No regression in operator experience

---

### Phase 4: Customer Registration (Week 3-4)

**Tasks:**
- [ ] Create `/register/customer` page
- [ ] Add customer registration API endpoint
- [ ] Default new registrations to `user_type = 'customer'`
- [ ] Add `customer` role to RBAC seed
- [ ] Create customer permissions (5-10 new)
- [ ] Add route guards for /(customer) routes

**Deliverables:**
- ✅ Customers can register accounts
- ✅ Customers CANNOT access operator routes

---

### Phase 5: Customer Portal (Week 5-8) [FUTURE]

**Tasks:**
- [ ] Build /(customer)/catalog
- [ ] Build /(customer)/booking flow
- [ ] Integrate Square payment SDK
- [ ] Build /(customer)/dashboard
- [ ] Build /(customer)/profile
- [ ] Add `customer_id` FK to bookings
- [ ] Create booking history views

**Deliverables:**
- ✅ Full customer-facing booking system
- ✅ Square payment integration
- ✅ Booking management

---

### Phase 6: Kiosk Mode (Week 9-10) [FUTURE]

**Tasks:**
- [ ] Build /(kiosk) route group
- [ ] Guest checkout flow
- [ ] Square terminal API integration
- [ ] Auto-reset/timeout logic
- [ ] IP-based access restrictions

**Deliverables:**
- ✅ Functional kiosk for in-person bookings

---

## 9. Risks & Mitigations

### Risk 1: Customer Access to Operator Routes
**Likelihood:** HIGH if not careful
**Impact:** CRITICAL (security breach)

**Mitigation:**
- ✅ Multi-layer guards: middleware + route guards + permission checks
- ✅ TypeScript type guards (`isOperator()`, `isCustomer()`)
- ✅ Database constraints (triggers)
- ✅ Comprehensive E2E tests (Playwright)

---

### Risk 2: Breaking Existing Operator Workflows
**Likelihood:** MEDIUM (during refactor)
**Impact:** HIGH (production downtime)

**Mitigation:**
- ✅ Feature flag: `ENABLE_CUSTOMER_PORTAL=false` (default)
- ✅ Gradual rollout (schema first, then API, then frontend)
- ✅ Backward compatibility aliases (`OperatorProfile` → `UserProfile`)
- ✅ Extensive testing before deployment

---

### Risk 3: Migration Data Loss
**Likelihood:** LOW (if careful)
**Impact:** CATASTROPHIC

**Mitigation:**
- ✅ Full database backup before migration
- ✅ Test migration on dev/staging first
- ✅ Drizzle-kit's safe migrations
- ✅ Rollback plan (keep old table for 1 week)

---

## 10. Decision Matrix

| Option | Complexity | Future-Proof | Better Auth Alignment | Security | RECOMMENDATION |
|--------|------------|--------------|----------------------|----------|----------------|
| **A: Rename to `users` + `user_type`** | Medium | ✅ High | ✅ Excellent | ✅ Strong | ✅ **RECOMMENDED** |
| B: Separate tables | High | ⚠️ Medium | ❌ Poor | ✅ Strongest | ❌ Overkill |
| C: Keep `operators` | Low | ❌ Low | ⚠️ Fair | ⚠️ Moderate | ❌ Not future-proof |

---

## 11. Final Recommendation

### ✅ Proceed with Option A: Rename to `users` + Add `user_type` Field

**Reasoning:**
1. **Better Auth Alignment** - Follows v1.3 recommendations
2. **Future-Proof** - Supports both operators and customers in single auth system
3. **Manageable Complexity** - 8-10 hours of refactoring vs 20+ for separate tables
4. **Strong Security** - Multi-layer guards prevent customer access to operator routes
5. **Clean Semantics** - "users" table makes sense for all user types

**Next Steps:**
1. ✅ Approve this architecture proposal
2. ✅ Create Phase 1 migration tasks in TODO.json
3. ✅ Run migration on dev database
4. ✅ Begin API refactoring

---

## Appendix A: Better Auth `user_type` Custom Field

```typescript
// auth-config.ts - Add user_type to Better Auth config
user: {
  modelName: 'users',  // ← Changed from 'operators'
  fields: { /* ... */ },
  additionalFields: {
    userType: {  // ← NEW
      type: 'string',
      required: true,
      input: false,  // Not settable via API
      defaultValue: 'operator',  // Safe default
      fieldName: 'user_type'
    },
    // ... existing fields
  }
}
```

---

## Appendix B: TypeScript Type Guards

```typescript
// lib/auth/guards.ts
import type { UserProfile, UserType } from '@escapeplan/contracts';

export interface OperatorUser extends UserProfile {
  userType: 'operator';
  role: 'admin' | 'manager' | 'game_master';
}

export interface CustomerUser extends UserProfile {
  userType: 'customer';
  role: 'customer';
}

export function isOperator(user: UserProfile): user is OperatorUser {
  return user.userType === 'operator';
}

export function isCustomer(user: UserProfile): user is CustomerUser {
  return user.userType === 'customer';
}

export function requireOperator(user: UserProfile | null): asserts user is OperatorUser {
  if (!user) throw error(401, 'Authentication required');
  if (!isOperator(user)) throw error(403, 'Operator access required');
}

export function requireCustomer(user: UserProfile | null): asserts user is CustomerUser {
  if (!user) throw error(401, 'Authentication required');
  if (!isCustomer(user)) throw error(403, 'Customer access required');
}
```

---

**END OF ANALYSIS**
