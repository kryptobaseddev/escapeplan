# EscapePlan Database System - Technical Specification

**Version:** 2.1
**Last Updated:** 2025-10-04
**Status:** ✅ Production-Ready
**Session:** Current (Documentation Update - Schema Verification)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Schema Architecture](#schema-architecture)
4. [ID Strategy](#id-strategy)
5. [Foreign Key Relationships](#foreign-key-relationships)
6. [Table Specifications](#table-specifications)
7. [Indexes](#indexes)
8. [JSON Columns](#json-columns)
9. [Schema Management](#schema-management)
10. [Migration History](#migration-history)
11. [Best Practices](#best-practices)

---

## System Overview

EscapePlan uses a **single SQLite database** with **33 interconnected tables** managing:
- Operator authentication & authorization (Better Auth)
- Game definitions with rooms and puzzles
- Booking and session tracking
- Asset storage metadata
- Network configuration
- System logging and alerting

**Database File:** `apps/escapeplan-api/data/escapeplan.db`
**Schema Definition:** `packages/contracts/src/schema.ts` (Drizzle ORM)
**Initialization:** `apps/escapeplan-api/src/db/init.ts`

---

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Database Engine | SQLite | 3.x | Embedded ACID database |
| ORM | Drizzle ORM | 0.44.5 | Type-safe query builder |
| Connection | better-sqlite3 | Latest | Node.js SQLite driver |
| Journal Mode | WAL | - | Write-Ahead Logging for concurrency |
| Foreign Keys | ENABLED | - | Referential integrity enforced |

**Key Features:**
- ✅ WAL mode for better read/write concurrency
- ✅ Foreign keys enforced at database level
- ✅ Full Drizzle ORM type safety
- ✅ Zero raw SQL in application code
- ✅ Automatic JSON parsing with `{ mode: 'json' }`
- ✅ Boolean handling with `{ mode: 'boolean' }`

---

## Schema Architecture

### Table Groups

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTH TABLES (4 tables)                   │
├─────────────────────────────────────────────────────────────┤
│  user, session, account, verification                       │
│  (Better Auth v1.3.24+ aligned naming)                     │
│  + RBAC: roles, role_permissions, permissions              │
│  Purpose: Better Auth user management & sessions            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   GAMES & ROOMS (3 tables)                  │
├─────────────────────────────────────────────────────────────┤
│  games, rooms, game_puzzles                                 │
│  Purpose: Game definitions with rooms and puzzles           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                BOOKINGS & SESSIONS (5 tables)               │
├─────────────────────────────────────────────────────────────┤
│  bookings, sessions, session_puzzles,                       │
│  session_hints, timer_slugs                                 │
│  Purpose: Reservation and live session tracking             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 ASSETS & STORAGE (3 tables)                 │
├─────────────────────────────────────────────────────────────┤
│  assets, asset_usage, storage_metrics                       │
│  Purpose: Uploaded media file metadata                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      NETWORK (2 tables)                     │
├─────────────────────────────────────────────────────────────┤
│  network_profiles, network_health, cameras                  │
│  Purpose: Wi-Fi AP configuration and status                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                LOGGING & ALERTING (3 tables)                │
├─────────────────────────────────────────────────────────────┤
│  system_logs, alerts, alert_rules                           │
│  Purpose: System events and operator notifications          │
└─────────────────────────────────────────────────────────────┘
```

**Total Tables:** 33
**Total Indexes:** 25+ (plus SQLite auto-indexes)

---

## ID Strategy

### Universal UUID Approach

**All entity IDs use TEXT PRIMARY KEY storing UUIDs (v4, random).**

```typescript
// ID Generation (Node.js native)
import { randomUUID } from 'node:crypto';

const gameId = randomUUID(); // "486252a0-f4e2-419c-b1f1-f67ada25dd30"
```

### Schema Pattern

```typescript
export const games = sqliteTable('games', {
  id: text('id').primaryKey(),  // UUID stored as TEXT
  slug: text('slug').notNull().unique(),
  // ...
});
```

### Why TEXT for UUIDs?

SQLite doesn't have a native UUID type. TEXT is optimal because:
- ✅ Preserves hyphenated format (human-readable)
- ✅ Allows string operations (LIKE, GLOB)
- ✅ Works with Better Auth UUID format
- ✅ No conversion overhead

### ID Format Rules

| Entity | Format | Example | Generated By |
|--------|--------|---------|--------------|
| Games | UUID v4 | `486252a0-...` | `randomUUID()` |
| Rooms | UUID v4 | `bbcccc47-...` | `randomUUID()` |
| Puzzles | UUID v4 | `b4e61f1e-...` | `randomUUID()` |
| Bookings | UUID v4 | `a3d4f5e6-...` | `randomUUID()` |
| Sessions | UUID v4 | `c7d8e9f0-...` | `randomUUID()` |
| Users | UUID v4 | `12345678-...` | Better Auth |
| Assets | UUID v4 | `9abcdef0-...` | `randomUUID()` |
| Logs | UUID v4 | `fedcba98-...` | `randomUUID()` |
| Alerts | UUID v4 | `11223344-...` | `randomUUID()` |

### ⚠️ NO Separate UUID Columns

**IMPORTANT:** Rooms and puzzles do NOT have a separate `uuid` column.

**Historical Context (Session 30-33):**
- Session 30: Migrated from prefixed IDs (`game-pirate-mutiny`) to UUIDs
- Session 33: Removed redundant `uuid` columns from rooms/game_puzzles
- Session 35: Complete Drizzle migration with clean schema

**Current State:**
- ✅ `id` column stores UUID directly
- ❌ NO `uuid` column exists
- ✅ All foreign keys reference `id`

**Exception:** Hints use `uuid` field in JSON array (not a database column).

---

## Foreign Key Relationships

### Cascade Rules

All foreign keys enforce referential integrity with **ON DELETE CASCADE** where appropriate:

```typescript
// Example: Rooms cascade delete when game is deleted
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  game_id: text('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  // ...
});
```

### Primary Relationships

```
games (id)
  ├─→ rooms (game_id) [CASCADE]
  ├─→ game_puzzles (game_id) [CASCADE]
  └─→ assets (game_id) [CASCADE]

rooms (id)
  └─→ bookings (room_id) [NO ACTION]

bookings (id)
  └─→ sessions (booking_id) [NO ACTION]

sessions (id)
  ├─→ session_puzzles (session_id) [CASCADE]
  ├─→ session_hints (session_id) [CASCADE]
  ├─→ timer_slugs (session_id) [CASCADE]
  └─→ alerts (session_id) [CASCADE]

user (id)
  ├─→ session (userId) [CASCADE]
  ├─→ account (userId) [CASCADE]
  ├─→ assets (uploaded_by) [NO ACTION]
  ├─→ alerts (dismissed_by) [NO ACTION]
  └─→ games (archived_by) [NO ACTION]

assets (id)
  └─→ asset_usage (asset_id) [CASCADE]
```

### Cascade Deletion Behavior

| Parent Deleted | Children Deleted | Why CASCADE |
|----------------|------------------|-------------|
| `games` | `rooms`, `game_puzzles`, `assets` | Game definitions are tightly coupled |
| `sessions` | `session_puzzles`, `session_hints`, `timer_slugs`, `alerts` | Session data is ephemeral |
| `user` | `session`, `account` | User auth data must be removed |
| `assets` | `asset_usage` | Asset references are metadata |

**NO CASCADE:**
- `bookings` → `sessions` - Sessions can outlive bookings for audit trail
- `rooms` → `bookings` - Bookings must not be deleted if room is removed
- `user` → `assets` - Assets remain if uploader is deleted

---

## Table Specifications

## Auth & Users

### user (Unified operator and customer table)
**Purpose:** Stores all system users (operators and customers) with type separation.

**Fields:**
- `id` (TEXT, PK) - UUID v4
- `username` (TEXT, UNIQUE, NOT NULL) - Custom field (snake_case)
- `name` (TEXT, NOT NULL) - Better Auth field (camelCase)
- `email` (TEXT, UNIQUE) - Better Auth field (camelCase)
- `emailVerified` (BOOLEAN, NOT NULL, default false) - Better Auth field (camelCase)
- `image` (TEXT) - Better Auth field for avatar URL/JSON (camelCase)
- `createdAt` (TEXT, NOT NULL) - Better Auth field (camelCase)
- `updatedAt` (TEXT, NOT NULL) - Better Auth field (camelCase)
- `user_type` (TEXT, NOT NULL, default 'operator') - **'operator' | 'customer'** (custom, snake_case, IMMUTABLE)
- `role_id` (TEXT, FK roles.id, NOT NULL) - Database-driven RBAC (custom, snake_case)
- `bio` (TEXT) - Operator-only field (custom, snake_case)
- `avatar_config` (JSON) - DiceBear configuration (custom, snake_case)
- `must_reset_password` (BOOLEAN, default false) - Security field (custom, snake_case)
- `loyalty_points` (INTEGER, default 0) - Customer-only field (custom, snake_case)
- `preferred_difficulty` (TEXT) - Customer-only field (custom, snake_case)
- `marketing_opted_in` (BOOLEAN, default false) - Customer-only field (custom, snake_case)
- `password_hash` (TEXT) - Security field (custom, snake_case)
- `last_login_at` (TEXT) - Security field (custom, snake_case)
- `banned` (BOOLEAN, default false) - Security field (custom, snake_case)
- `ban_reason` (TEXT) - Security field (custom, snake_case)
- `ban_expires` (TEXT) - Security field (custom, snake_case)
- Soft delete: `archived_at`, `archived_by`, `archived_reason` (custom, snake_case)

**Dual Avatar Architecture:**
- `image` (Better Auth field): Stores avatar URL or DiceBear seed for Better Auth compatibility
- `avatar_config` (Custom JSON field): Stores full DiceBear configuration object for advanced customization

**Naming Convention:**
- Better Auth fields use **camelCase** (name, email, emailVerified, image, createdAt, updatedAt)
- Custom EscapePlan fields use **snake_case** (user_type, role_id, bio, avatar_config, etc.)

**User Type System:**
The `user_type` field distinguishes between operators (staff managing escape rooms) and customers (players):

- **'operator'** - Staff members who manage bookings, run sessions, configure games
  - Can be assigned operator-scoped roles: `admin`, `manager`, `game_master`
  - Has access to operator-specific fields: `bio`, `avatar_config`, `must_reset_password`
  - Operator-scoped permissions control access to system management features

- **'customer'** - Players who book and play escape room games
  - Can be assigned customer-scoped roles (future feature)
  - Has access to customer-specific fields: `loyalty_points`, `preferred_difficulty`, `marketing_opted_in`
  - Customer-scoped permissions control access to booking and gameplay features

**IMPORTANT:** The `user_type` field is **IMMUTABLE** after user creation - enforced by database trigger `prevent_user_type_change`. This prevents accidental or malicious conversion between operator and customer accounts.

**Indexes:**
- `idx_user_type` on `user_type`
- `idx_user_email` on `email`
- `idx_user_username` on `username`

**Triggers:** See Security Triggers section below.

### roles (Database-driven RBAC roles)
**Purpose:** Defines system and custom roles for operators and customers.

**Fields:**
- `id` (TEXT, PK) - UUID v4
- `name` (TEXT, UNIQUE, NOT NULL) - Role name (e.g., 'admin', 'game_master')
- `description` (TEXT) - Human-readable description
- `user_type_scope` (TEXT, NOT NULL, default 'operator') - **'operator' | 'customer' | 'both'**
- `is_system` (BOOLEAN, NOT NULL, default false) - True for built-in roles
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)

**System Roles:**
- `admin` (operator scope) - Full system access
- `manager` (operator scope) - Manage bookings, games, users
- `game_master` (operator scope) - Run sessions, send hints
- `customer` (customer scope) - Default customer role

### permissions (Database-driven RBAC permissions)
**Purpose:** Defines granular permissions for system features.

**Fields:**
- `id` (TEXT, PK) - UUID v4
- `name` (TEXT, UNIQUE, NOT NULL) - Permission name (e.g., 'manage_users')
- `label` (TEXT, NOT NULL) - Human-readable label
- `category` (TEXT, NOT NULL) - Feature category (dashboard, bookings, sessions, games, network, users, rbac, storage, cameras, system)
- `user_type_scope` (TEXT, NOT NULL, default 'operator') - **'operator' | 'customer' | 'both'**
- `description` (TEXT) - Permission description
- `created_at` (TEXT, NOT NULL)

**Permission Categories:**
- `dashboard` - View dashboard and active sessions
- `bookings` - Create, edit, cancel bookings
- `sessions` - Start, pause, end sessions; send hints
- `games` - Create, edit, archive games and puzzles
- `network` - Configure Wi-Fi settings
- `users` - Manage operators and customers
- `rbac` - Manage roles and permissions
- `storage` - Manage assets and backups
- `cameras` - Configure and monitor cameras
- `system` - System health, logs, settings

### role_permissions (RBAC junction table)
**Purpose:** Maps which permissions are granted to which roles.

**Fields:**
- `id` (TEXT, PK) - UUID v4
- `role_id` (TEXT, FK roles.id, NOT NULL, CASCADE)
- `permission_id` (TEXT, FK permissions.id, NOT NULL, CASCADE)
- `granted_at` (TEXT, NOT NULL)
- `granted_by` (TEXT, FK user.id) - Who granted this permission

**Indexes:**
- `idx_role_permission_unique` on (role_id, permission_id) - Prevent duplicate assignments

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

---

### 2. games

**Purpose:** Escape room game definitions with metadata

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // URL-safe identifier
  name: text('name').notNull(),
  description: text('description'),
  story_intro: text('story_intro'),
  duration_minutes: integer('duration_minutes').notNull().default(60),
  difficulty: text('difficulty'), // '1' to '5' (stars)
  pricing_model: text('pricing_model'), // 'per_person' | 'per_session' | 'per_hour'
  category: text('category'), // DEPRECATED - singular
  categories: text('categories', { mode: 'json' }), // JSON array - SOURCE OF TRUTH
  min_players: integer('min_players').notNull().default(1),
  max_players: integer('max_players').notNull().default(1),
  price_per_player_cents: integer('price_per_player_cents').notNull().default(0),
  resources_required: integer('resources_required').notNull().default(1),
  validation_notes: text('validation_notes'),
  media_config: text('media_config', { mode: 'json' }), // GameMediaConfig
  pricing_config: text('pricing_config', { mode: 'json' }), // GamePricingConfig
  booking_rules_config: text('booking_rules_config', { mode: 'json' }), // GameBookingRules
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  archived_at: text('archived_at'),
  archived_by: text('archived_by'),
  archived_reason: text('archived_reason')
}
```

**JSON Structures:**

```typescript
// media_config
interface GameMediaConfig {
  thumbnailAssetId?: string;
  roomScreenAssetId?: string;
  galleryAssetIds?: string[];
}

// pricing_config
interface GamePricingConfig {
  tiers: Array<{
    label: string;
    priceCents: number;
    minPlayers?: number;
    maxPlayers?: number;
  }>;
  deposit?: {
    type: 'flat' | 'percent';
    amount: number;
  };
  discounts?: Array<{
    code: string;
    percentOff?: number;
    amountOffCents?: number;
    expiresAt?: string;
    notes?: string;
  }>;
}

// booking_rules_config
interface GameBookingRules {
  isMobile: boolean;
  locationNotesTemplate?: string;
  travelBufferMinutes?: number;
  reservationStyle?: 'public' | 'private';
  cancellationPolicy?: string;
  equipmentChecklist?: string[];
  customBookingFields?: Array<{
    label: string;
    required: boolean;
  }>;
}
```

**Unique Constraints:**
- `slug` UNIQUE - URL paths like `/games/pirate-mutiny`

---

### 3. rooms

**Purpose:** Physical locations or mobile kits where games are played

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  is_mobile_capable: integer('is_mobile_capable', { mode: 'boolean' }).notNull().default(false),
  theme_token: text('theme_token'),
  description: text('description'),
  slug: text('slug'),
  capacity: integer('capacity')
}
```

**Relationships:**
- Many rooms per game
- Referenced by bookings (NO CASCADE)

---

### 4. game_puzzles

**Purpose:** Puzzle definitions within games, with nested hints

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  solution: text('solution'),
  media_asset: text('media_asset'), // Asset ID
  operator_actions: text('operator_actions'),
  display_order: integer('display_order').notNull().default(0),
  hints: text('hints', { mode: 'json' }), // Array of GameHintDefinition
  media_asset_meta: text('media_asset_meta', { mode: 'json' }),
  slug: text('slug')
}
```

**Hint Structure (JSON array in `hints` column):**
```typescript
interface GameHintDefinition {
  uuid: string; // Unique hint ID (NOT a database column!)
  type: 'text' | 'image' | 'audio' | 'video';
  content: string;
  assetUrl?: string;
  order: number;
  countAsHint?: boolean;
}
```

---

### game_milestones (Game event triggers)

**Purpose:** Defines milestone events (intro, escaped, failed, custom) that trigger during gameplay.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'intro' | 'escaped' | 'failed' | 'custom'
  name: text('name').notNull(), // User-friendly name
  media_type: text('media_type'), // 'text' | 'image' | 'audio' | 'video' | null
  content: text('content'), // Text content or description
  asset_id: text('asset_id').references(() => assets.id, { onDelete: 'set null' }),
  volume_level: integer('volume_level').notNull().default(80), // 0-100
  display_order: integer('display_order').notNull().default(0),

  // Trigger configuration
  trigger_type: text('trigger_type').notNull(), // 'manual' | 'timer' | 'condition'
  trigger_config: text('trigger_config', { mode: 'json' }), // { minutes?, interval?, hintsUsed?, etc }
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

  // Display settings
  display_duration_seconds: integer('display_duration_seconds'),
  loop: integer('loop', { mode: 'boolean' }).notNull().default(false),
  loop_count: integer('loop_count'), // null = infinite when loop=true
  auto_dismiss: integer('auto_dismiss', { mode: 'boolean' }).notNull().default(true),

  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
}
```

**Indexes:**
- `idx_game_milestones_game` on game_id
- `idx_game_milestones_type` on type
- `idx_game_milestones_enabled` on enabled

**Use Cases:**
- **Intro** - Welcome message/video when session starts
- **Escaped** - Victory sequence when players complete the game
- **Failed** - Game over message when timer expires
- **Custom** - Timed hints, story beats, ambient effects

---

### 5. bookings

**Purpose:** Customer reservations for game sessions

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  booking_code: text('booking_code').notNull().unique(),
  game_id: text('game_id').notNull().references(() => games.id),
  room_id: text('room_id').notNull().references(() => rooms.id),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  status: text('status').notNull(), // 'PENDING' | 'CONFIRMED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED'
  party_size: integer('party_size').notNull(),
  deposit_due_cents: integer('deposit_due_cents').notNull().default(0),
  total_due_cents: integer('total_due_cents').notNull().default(0),
  price_tier: text('price_tier').notNull(),
  discount_code: text('discount_code'),
  is_mobile: integer('is_mobile', { mode: 'boolean' }).notNull().default(false),
  is_adhoc: integer('is_adhoc', { mode: 'boolean' }).notNull().default(false),
  location_note: text('location_note'),
  contact_name: text('contact_name').notNull(),
  contact_phone: text('contact_phone').notNull(),
  notes: text('notes')
}
```

---

### session_milestones (Triggered milestone tracking)

**Purpose:** Tracks which game milestones were triggered during a session and when.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  milestone_id: text('milestone_id').notNull().references(() => gameMilestones.id),
  milestone_type: text('milestone_type').notNull(), // Copy for quick lookup
  milestone_name: text('milestone_name').notNull(), // Copy for display
  media_type: text('media_type'), // Copy of media_type
  content: text('content'), // Copy of content
  asset_url: text('asset_url'), // Resolved asset URL at trigger time
  volume_level: integer('volume_level'), // Volume level used
  triggered_at: text('triggered_at').notNull(),
  triggered_by: text('triggered_by').references(() => user.id) // NULL for auto-triggers
}
```

**Indexes:**
- `idx_session_milestones_session` on session_id
- `idx_session_milestones_milestone` on milestone_id
- `idx_session_milestones_triggered` on triggered_at
- `idx_session_milestone_unique` on (session_id, milestone_id) - Prevent duplicate triggers

**Relationship:**
- Each session can trigger multiple milestones
- Each milestone can be triggered once per session
- Denormalized copies of milestone data for historical accuracy

---

### discount_codes (Promotional discounts)

**Purpose:** Defines discount codes for promotional pricing.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(), // Promo code (e.g., 'SUMMER2025')
  description: text('description'),
  type: text('type').notNull(), // 'percent' | 'fixed_amount'
  percent_off: integer('percent_off'), // 0-100
  amount_off_cents: integer('amount_off_cents'),
  valid_from: text('valid_from'),
  valid_until: text('valid_until'),
  max_uses: integer('max_uses'), // NULL = unlimited
  current_uses: integer('current_uses').notNull().default(0),
  applies_to: text('applies_to').notNull().default('all'), // 'all' | 'selected'
  minimum_party_size: integer('minimum_party_size'),
  notes: text('notes'),
  created_by: text('created_by').notNull().references(() => user.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  archived_at: text('archived_at')
}
```

**Indexes:**
- `idx_discount_codes_code` on code
- `idx_discount_codes_active` on (archived_at, valid_from, valid_until)

### discount_code_games (Discount game restrictions)

**Purpose:** Maps discount codes to specific games when applies_to='selected'.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  discount_code_id: text('discount_code_id').notNull().references(() => discountCodes.id, { onDelete: 'cascade' }),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  created_at: text('created_at').notNull()
}
```

**Indexes:**
- `idx_discount_game_unique` on (discount_code_id, game_id)
- `idx_discount_game_code` on discount_code_id
- `idx_discount_game_game` on game_id

---

### cameras (RTSP camera configuration)

**Purpose:** Stores IP camera connection details and streaming configuration.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  game_id: text('game_id').references(() => games.id, { onDelete: 'set null' }), // 1-to-1 relationship

  // Brand & Model
  brand: text('brand').notNull().default('generic'), // 'reolink' | 'hikvision' | 'dahua' | etc.
  model: text('model'), // For auto-configuration

  // Connection
  protocol: text('protocol').notNull(), // 'rtsp' | 'mjpeg' | 'onvif'
  host: text('host').notNull(),
  port: integer('port').notNull().default(554),
  username: text('username'),
  password_encrypted: text('password_encrypted'), // Encrypted with libsodium

  // Stream Paths (dual-stream support)
  main_stream_path: text('main_stream_path'), // High-res for recording
  sub_stream_path: text('sub_stream_path'), // Low-res for live viewing
  stream_path: text('stream_path'), // DEPRECATED: Legacy single stream

  // Stream Settings
  resolution: text('resolution').default('720p'), // '480p' | '720p' | '1080p' | 'native'
  frame_rate: integer('frame_rate').default(15),
  transport: text('transport').default('tcp'), // 'tcp' | 'udp' | 'http'

  // Capabilities
  has_ptz: integer('has_ptz', { mode: 'boolean' }).notNull().default(false),
  has_audio: integer('has_audio', { mode: 'boolean' }).notNull().default(false),
  has_ir_control: integer('has_ir_control', { mode: 'boolean' }).notNull().default(false),

  // Feature Settings
  ir_mode: text('ir_mode').default('auto'), // 'auto' | 'on' | 'off'
  audio_volume: integer('audio_volume').default(80), // 0-100
  ptz_pan: integer('ptz_pan').default(0), // -180 to 180 degrees
  ptz_tilt: integer('ptz_tilt').default(0), // -90 to 90 degrees
  ptz_zoom: integer('ptz_zoom').default(0), // 0-100 (percentage)

  // Status & Health
  status: text('status').default('offline'), // 'online' | 'offline' | 'testing' | 'error'
  last_seen: text('last_seen'),
  error_message: text('error_message'),
  hls_streaming: integer('hls_streaming', { mode: 'boolean' }).default(false),

  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
}
```

**Indexes:**
- `idx_cameras_game` on game_id
- `idx_cameras_status` on status
- `idx_cameras_brand` on brand

**Camera-Game Relationship:**
- Each camera can be associated with ONE game (1-to-1)
- Each game can have MULTIPLE cameras (stored in `games.camera_ids` JSON array)
- Cameras stream to HLS endpoints for dashboard viewing

---

### 6. assets

**Purpose:** Uploaded media file metadata (images, videos, audio)

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  original_filename: text('original_filename').notNull(),
  mime_type: text('mime_type').notNull(),
  size_bytes: integer('size_bytes').notNull(),
  asset_type: text('asset_type').notNull(), // 'image' | 'audio' | 'video' | 'document'
  media_type: text('media_type'),
  file_path: text('file_path').notNull(),
  game_id: text('game_id').references(() => games.id, { onDelete: 'cascade' }),
  puzzle_id: text('puzzle_id'),
  hint_order: integer('hint_order'),
  is_reusable: integer('is_reusable', { mode: 'boolean' }).notNull().default(false),
  uploaded_by: text('uploaded_by').notNull().references(() => user.id),
  uploaded_at: text('uploaded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  metadata: text('metadata', { mode: 'json' })
}
```

**Indexed Columns:**
- `game_id` (idx_assets_game_id)
- `asset_type` (idx_assets_type)
- `is_reusable` (idx_assets_reusable)

---

### system_settings (Key-value configuration)

**Purpose:** Stores system-wide configuration settings with type validation.

**Schema:**
```typescript
{
  key: text('key').primaryKey(), // Unique setting identifier
  value: text('value').notNull(), // Serialized value
  type: text('type').notNull(), // 'string' | 'number' | 'boolean' | 'json'
  category: text('category').notNull(), // 'storage' | 'backup' | 'updates' | 'system' | 'general'
  label: text('label').notNull(), // Human-readable label
  description: text('description'),
  is_editable: integer('is_editable', { mode: 'boolean' }).notNull().default(true),
  updated_at: text('updated_at').notNull(),
  updated_by: text('updated_by').references(() => user.id)
}
```

**Use Cases:**
- Storage retention policies
- Backup schedules
- System update preferences
- Feature flags

---

### system_health (Health metrics snapshots)

**Purpose:** Periodic snapshots of system resource usage and service health.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  cpu_usage_percent: integer('cpu_usage_percent').notNull(), // 0-100
  memory_total_mb: integer('memory_total_mb').notNull(),
  memory_used_mb: integer('memory_used_mb').notNull(),
  disk_total_gb: integer('disk_total_gb').notNull(),
  disk_used_gb: integer('disk_used_gb').notNull(),
  uptime_seconds: integer('uptime_seconds').notNull(),
  services_status: text('services_status', { mode: 'json' }).notNull(), // Array<{name, status, uptime, details}>
  recorded_at: text('recorded_at').notNull()
}
```

**Indexes:**
- `idx_system_health_recorded` on recorded_at

**Service Monitoring:**
- API server status
- Database health
- Network connectivity
- Camera streaming services
- HLS transcoding workers

---

### backups (Backup operations tracking)

**Purpose:** Tracks backup operations (database + assets) with detailed status.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'manual' | 'scheduled' | 'pre-update'
  status: text('status').notNull(), // 'in_progress' | 'completed' | 'failed'
  file_path: text('file_path'),
  file_size_bytes: integer('file_size_bytes'),
  includes: text('includes', { mode: 'json' }).notNull(), // { database, games, assets, logs }
  destination: text('destination').notNull(), // 'local' | 'usb'
  usb_device: text('usb_device'),
  checksum_sha256: text('checksum_sha256'),
  error_message: text('error_message'),
  created_by: text('created_by').notNull().references(() => user.id),
  created_at: text('created_at').notNull(),
  completed_at: text('completed_at')
}
```

**Indexes:**
- `idx_backups_created` on created_at
- `idx_backups_status` on status
- `idx_backups_type` on type

---

### usb_devices (Connected USB drives)

**Purpose:** Tracks USB drives detected and available for backups.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  device_path: text('device_path').notNull(), // /dev/sda1
  mount_point: text('mount_point'), // /mnt/escapeplan-backup
  label: text('label'),
  total_space_gb: integer('total_space_gb'),
  available_space_gb: integer('available_space_gb'),
  is_mounted: integer('is_mounted', { mode: 'boolean' }).notNull().default(false),
  last_seen: text('last_seen').notNull()
}
```

**Indexes:**
- `idx_usb_devices_path` on device_path
- `idx_usb_devices_mounted` on is_mounted

---

### backup_history (Backup retention tracking)

**Purpose:** Historical record of backups with retention policy enforcement.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  trigger: text('trigger').notNull(), // 'manual' | 'scheduled' | 'pre-update'
  timestamp: text('timestamp').notNull(), // ISO 8601 timestamp
  backup_path: text('backup_path').notNull(), // Full path to backup file
  size_bytes: integer('size_bytes').notNull(),
  checksum_sha256: text('checksum_sha256').notNull(),
  compressed: integer('compressed', { mode: 'boolean' }).notNull().default(false),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  app_version: text('app_version'), // App version at backup time
  retention_days: integer('retention_days').notNull(),
  deleted_at: text('deleted_at'), // Soft delete timestamp
  created_at: text('created_at').notNull()
}
```

**Indexes:**
- `idx_backup_history_trigger` on trigger
- `idx_backup_history_timestamp` on timestamp
- `idx_backup_history_deleted_at` on deleted_at

---

### backup_metrics (Backup performance tracking)

**Purpose:** Tracks performance and success/failure rates of backup operations.

**Schema:**
```typescript
{
  id: text('id').primaryKey(),
  trigger: text('trigger').notNull(), // 'manual' | 'scheduled' | 'pre-update'
  success: integer('success', { mode: 'boolean' }).notNull(),
  duration_ms: integer('duration_ms').notNull(),
  error_message: text('error_message'),
  created_at: text('created_at').notNull()
}
```

**Indexes:**
- `idx_backup_metrics_trigger` on trigger
- `idx_backup_metrics_created_at` on created_at

**Use Cases:**
- Monitor backup reliability
- Track backup duration trends
- Alert on repeated failures
- Optimize backup schedules

---

## Indexes

### Performance Indexes

| Table | Index Name | Column(s) | Purpose |
|-------|-----------|-----------|---------|
| `assets` | idx_assets_game_id | game_id | Fast game asset lookup |
| `assets` | idx_assets_type | asset_type | Filter by media type |
| `assets` | idx_assets_reusable | is_reusable | Asset browser queries |
| `asset_usage` | idx_asset_usage_asset | asset_id | Usage tracking |
| `asset_usage` | idx_asset_usage_game | used_in_game_id | Per-game usage stats |
| `system_logs` | idx_logs_timestamp | timestamp DESC | Recent logs first |
| `system_logs` | idx_logs_level | level | Filter by severity |
| `system_logs` | idx_logs_category | category | Filter by category |
| `system_logs` | idx_logs_created | created_at DESC | Chronological ordering |
| `alerts` | idx_alerts_session | session_id | Per-session alerts |
| `alerts` | idx_alerts_level | level | Filter by severity |
| `alerts` | idx_alerts_created | created_at DESC | Recent alerts first |
| `alerts` | idx_alerts_active | dismissed_at (partial) | Active alerts only |
| `alert_rules` | idx_alert_rules_enabled | enabled | Active rules only |
| `alert_rules` | idx_alert_rules_category | category | Rules by category |

**Total Custom Indexes:** 15

**SQLite Auto-Indexes:**
- PRIMARY KEY columns
- UNIQUE constraints (slug, booking_code, etc.)

---

## JSON Columns

### Drizzle JSON Mode

All JSON columns use `{ mode: 'json' }` for automatic parsing:

```typescript
categories: text('categories', { mode: 'json' }) // string[] in TypeScript
```

**Behavior:**
- **INSERT/UPDATE:** Drizzle auto-calls `JSON.stringify()`
- **SELECT:** Drizzle auto-calls `JSON.parse()`
- **NULL Handling:** `null` in database → `null` in TypeScript (NOT `undefined`)

### JSON Column Usage

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| user | avatar_config | object | DiceBear config |
| user | permissions | string[] | RBAC permissions |
| games | categories | string[] | Game categories |
| games | media_config | object | Asset references |
| games | pricing_config | object | Pricing tiers/discounts |
| games | booking_rules_config | object | Booking rules |
| game_puzzles | hints | object[] | Hint definitions |
| game_puzzles | media_asset_meta | object | Asset metadata |
| assets | metadata | object | Upload metadata |
| system_logs | context | object | Log context |
| alerts | context | object | Alert context |
| alert_rules | conditions | object | Rule conditions |
| alert_rules | auto_dismiss_on | string[] | Auto-dismiss events |
| storage_metrics | by_type | object | Size by type |
| storage_metrics | by_game | object | Size by game |
| network_profiles | details | object | Network details |

---

## Schema Management

### Current Architecture (Clean, No Legacy)

```
packages/contracts/src/
└── schema.ts       # Drizzle schema definitions (shared across API & web)

apps/escapeplan-api/src/db/
├── client.ts       # Database connection
├── init.ts         # Schema initialization script
└── seed.ts         # Seed data
```

**Architecture Notes:**
- Schema is defined in shared contracts package for type consistency
- API and web both import schema from `@escapeplan/contracts`
- Drizzle-only implementation, no raw SQL
- Push-only workflow (NO migrations): `drizzle-kit push` syncs schema directly

### Schema Initialization

**Command:**
```bash
pnpm tsx src/db/init.ts
```

**What It Does:**
1. Creates all 20 tables with `CREATE TABLE IF NOT EXISTS`
2. Creates 15 custom indexes with `CREATE INDEX IF NOT EXISTS`
3. Idempotent - safe to run multiple times

**Auto-Run:** `seed.ts` calls `initializeSchema()` before seeding

### Schema Changes

**Process:**
1. Edit `packages/contracts/src/schema.ts`
2. Rebuild contracts package: `pnpm --filter @escapeplan/contracts build`
3. Run `drizzle-kit push` to sync schema to database
4. Optional: Reseed if needed: `pnpm db:seed`

**⚠️ SQLite Limitation:** No `DROP COLUMN` support. Schema changes require table recreation.

---

## Migration History

### Session 30 (2025-09-30) - UUID Migration Started
- Migrated from prefixed IDs to UUIDs
- Updated state.ts to use `randomUUID()`
- Created migration script (later deleted)

### Session 33 (2025-10-01) - UUID Migration Completed
- Removed redundant `uuid` columns from rooms/game_puzzles
- Updated frontend to use `id` only
- Fixed asset upload FK constraint bug
- Deleted old database and reseeded

### Session 35 (2025-10-01) - Complete Drizzle Migration
- Added 5 missing tables to schema.ts
- Rewrote client.ts (380 → 24 lines)
- Removed ALL raw SQL
- Full type safety across all 20 tables
- Created clean init.ts script

**Current Status:** ✅ Production-ready, zero legacy code

---

## Best Practices

### 1. Always Use Drizzle ORM

```typescript
// ✅ GOOD - Type-safe Drizzle query
import { db } from './db/client.ts';
import { games } from './db/schema.ts';

const allGames = await db.select().from(games).where(eq(games.archived_at, null));

// ❌ BAD - Raw SQL
const allGames = sqlite.prepare('SELECT * FROM games WHERE archived_at IS NULL').all();
```

### 2. Always Use UUIDs for IDs

```typescript
// ✅ GOOD
import { randomUUID } from 'node:crypto';
const gameId = randomUUID();

// ❌ BAD
const gameId = `game-${slug}`;
const gameId = nanoid();
```

### 3. Respect Foreign Key Cascades

```typescript
// ✅ GOOD - Let cascade handle cleanup
await db.delete(games).where(eq(games.id, gameId));
// Automatically deletes: rooms, game_puzzles, assets

// ❌ BAD - Manual deletion (prone to orphans)
await db.delete(rooms).where(eq(rooms.game_id, gameId));
await db.delete(gamePuzzles).where(eq(gamePuzzles.game_id, gameId));
await db.delete(games).where(eq(games.id, gameId));
```

### 4. Use JSON Mode Correctly

```typescript
// ✅ GOOD - Drizzle handles JSON automatically
await db.insert(games).values({
  id: gameId,
  categories: ['Private', 'Mystery'], // Array → auto-stringified
  media_config: { thumbnailAssetId: 'abc' } // Object → auto-stringified
});

// ❌ BAD - Manual JSON.stringify()
await db.insert(games).values({
  id: gameId,
  categories: JSON.stringify(['Private', 'Mystery']), // Double-stringified!
});
```

### 5. Handle NULL vs Undefined

```typescript
// ✅ GOOD - Check for null (database returns null, not undefined)
const game = await db.select().from(games).where(eq(games.id, id)).get();
if (game.archived_at === null) { ... }

// ❌ BAD - Checking for undefined
if (!game.archived_at) { ... } // Will also match empty string, 0, etc.
```

### 6. Use Boolean Mode

```typescript
// ✅ GOOD - Boolean mode handles conversion
is_mobile: integer('is_mobile', { mode: 'boolean' }).notNull().default(false)
// TypeScript: boolean, SQLite: 0 or 1

// ❌ BAD - Manual conversion
is_mobile: integer('is_mobile').notNull().default(0)
// TypeScript: number, requires manual conversion everywhere
```

---

## Quick Reference

### Common Queries

```typescript
// Get game with relations
const game = await db.query.games.findFirst({
  where: eq(games.id, gameId),
  with: {
    rooms: true,
    puzzles: true
  }
});

// Soft delete
await db.update(games)
  .set({
    archived_at: new Date().toISOString(),
    archived_by: operatorId
  })
  .where(eq(games.id, gameId));

// Find active games
const activeGames = await db.select()
  .from(games)
  .where(isNull(games.archived_at));
```

### Schema Exports

```typescript
// Import full schema
import * as schema from './db/schema.ts';
import { db } from './db/client.ts';

// All tables available
const { games, rooms, gamePuzzles, user, assets } = schema;
```

---

**Document Version:** 2.1
**Maintained By:** Claude Code
**Last Audit:** 2025-10-04 (Schema Verification & Documentation Update)
**Next Review:** After any schema changes

---

## Appendix: Full Table List

### Auth & RBAC (7 tables)
1. user
2. session
3. account
4. verification
5. roles
6. permissions
7. role_permissions

### Games & Rooms (3 tables)
8. games
9. game_puzzles
10. game_milestones

### Bookings & Sessions (6 tables)
11. bookings
12. sessions
13. session_puzzles
14. session_hints
15. session_milestones
16. timer_slugs

### Discount Codes (2 tables)
17. discount_codes
18. discount_code_games

### Assets & Storage (9 tables)
19. assets
20. asset_usage
21. storage_metrics
22. system_health
23. backups
24. usb_devices
25. backup_history
26. backup_metrics

### Network (2 tables)
27. network_profiles
28. network_health

### Logging & Alerting (3 tables)
29. system_logs
30. alerts
31. alert_rules

### System Settings (1 table)
32. system_settings

### Cameras (1 table)
33. cameras

**Total:** 33 tables, 25+ custom indexes, 100% Drizzle ORM coverage

---

## Related Documentation

- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Environment detection, path resolution, system settings
- **[API Contracts & Schema Management](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)** - Schema workflow, Drizzle + Zod patterns
- **[Asset Storage Architecture](./ASSET_STORAGE_ARCHITECTURE.md)** - Asset tables, file storage integration
- **[RBAC System](./RBAC_SYSTEM.md)** - Operators, roles, permissions tables
- **[Logging & Alerting System](./LOGGING_ALERTING_SYSTEM.md)** - System logs, alerts, alert rules tables
