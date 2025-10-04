# EscapePlan Database System - Technical Specification

**Version:** 2.0
**Last Updated:** 2025-10-01
**Status:** ✅ Production-Ready
**Session:** 35 (Complete Drizzle Migration)

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

EscapePlan uses a **single SQLite database** with **23 interconnected tables** managing:
- Operator authentication & authorization (Better Auth)
- Game definitions with rooms and puzzles
- Booking and session tracking
- Asset storage metadata
- Network configuration
- System logging and alerting

**Database File:** `apps/escapeplan-api/data/escapeplan.db`
**Schema Definition:** `apps/escapeplan-api/src/db/schema.ts` (Drizzle ORM)
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

**Total Tables:** 23
**Total Indexes:** 15 (plus SQLite auto-indexes)

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
apps/escapeplan-api/src/db/
├── schema.ts       # Drizzle schema definitions (360 lines)
├── client.ts       # Database connection (24 lines)
├── init.ts         # Schema initialization script
└── seed.ts         # Seed data
```

**NO Legacy Code:**
- ❌ No raw SQL CREATE statements in client.ts
- ❌ No migration scripts
- ❌ No ensureColumn() helpers
- ❌ No schema version tracking
- ✅ Clean Drizzle-only implementation

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
1. Edit `apps/escapeplan-api/src/db/schema.ts`
2. Edit `apps/escapeplan-api/src/db/init.ts` (keep in sync)
3. Delete database: `rm -f data/escapeplan.db*`
4. Reseed: `pnpm db:seed`

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

**Document Version:** 2.0
**Maintained By:** Claude-DB
**Last Audit:** Session 35 (2025-10-01)
**Next Review:** After any schema changes

---

## Appendix: Full Table List

1. user
2. session
3. account
4. verification
5. roles
6. permissions
7. role_permissions
8. games
9. rooms
10. game_puzzles
11. bookings
12. sessions
13. session_puzzles
14. session_hints
15. timer_slugs (internal table name; exposed publicly via /room routes)
16. assets
17. asset_usage
18. storage_metrics
19. network_profiles
20. network_health
21. system_logs
22. alerts
23. alert_rules

**Total:** 23 tables, 15 custom indexes, 100% Drizzle ORM coverage

---

## Related Documentation

- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Environment detection, path resolution, system settings
- **[API Contracts & Schema Management](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)** - Schema workflow, Drizzle + Zod patterns
- **[Asset Storage Architecture](./ASSET_STORAGE_ARCHITECTURE.md)** - Asset tables, file storage integration
- **[RBAC System](./RBAC_SYSTEM.md)** - Operators, roles, permissions tables
- **[Logging & Alerting System](./LOGGING_ALERTING_SYSTEM.md)** - System logs, alerts, alert rules tables
