# Database ID Field Audit

**Date:** 2025-09-30
**Issue:** Inconsistent use of IDs across tables - mix of text IDs, prefixed slugs, and UUIDs

## Current State

### ID Patterns in Use

1. **Prefixed Slug IDs** - Format: `{type}-{slug}`
   - games: `game-pirate-mutany`
   - rooms: `room-main`
   - puzzles: `gpz-pirate-1`

2. **Nanoid IDs** - Format: `{type}-{nanoid(12)}`
   - alerts: `alert-AbCdEf123456`
   - system_logs: Auto-generated

3. **Auto-incrementing Integer**
   - network_health: `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - storage_metrics: `id INTEGER PRIMARY KEY AUTOINCREMENT`

4. **Mixed: TEXT id + TEXT uuid**
   - rooms: `id TEXT PRIMARY KEY` + `uuid TEXT UNIQUE`
   - game_puzzles: `id TEXT PRIMARY KEY` + `uuid TEXT UNIQUE`

5. **Pure TEXT without UUID**
   - games: `id TEXT PRIMARY KEY` (no uuid field)
   - operators: `id TEXT PRIMARY KEY`
   - sessions: `id TEXT PRIMARY KEY`
   - bookings: `id TEXT PRIMARY KEY`

## Table-by-Table Breakdown

| Table | ID Field | UUID Field | Current Pattern | Notes |
|-------|----------|------------|-----------------|-------|
| operators | `id TEXT PK` | ❌ | Better Auth UUID | Auth library generates UUIDs |
| operator_auth_sessions | `id TEXT PK` | ❌ | Better Auth | Auth library manages |
| operator_accounts | `id TEXT PK` | ❌ | Better Auth | Auth library manages |
| operator_verifications | `id TEXT PK` | ❌ | Better Auth | Auth library manages |
| **games** | `id TEXT PK` | ❌ | **`game-{slug}`** | **Prefixed slug, NOT UUID** |
| **rooms** | `id TEXT PK` | `uuid TEXT UNIQUE` | **Mixed** | Has both, `id` used in FKs |
| **game_puzzles** | `id TEXT PK` | `uuid TEXT UNIQUE` | **Mixed** | Has both, `id` used in FKs |
| **bookings** | `id TEXT PK` | ❌ | **Unknown** | Need to check creation code |
| **sessions** | `id TEXT PK` | ❌ | **Unknown** | Need to check creation code |
| session_puzzles | `id TEXT PK` | ❌ | Unknown | Need to check creation code |
| session_hints | `id TEXT PK` | ❌ | Unknown | Need to check creation code |
| timer_slugs | `slug TEXT PK` | ❌ | Slug as PK | Different approach |
| network_health | `id INTEGER PK` | ❌ | Auto-increment | Valid for singleton |
| **assets** | `id TEXT PK` | ❌ | **UUID from crypto** | `crypto.randomUUID()` |
| asset_usage | `id TEXT PK` | ❌ | Unknown | Need to check creation code |
| storage_metrics | `id INTEGER PK` | ❌ | Auto-increment | Valid for time-series |
| system_logs | `id TEXT PK` | ❌ | Unknown | Need to check creation code |
| **alerts** | `id TEXT PK` | ❌ | **`alert-{nanoid(12)}`** | Nanoid, not UUID |
| alert_rules | `id TEXT PK` | ❌ | Unknown | Need to check creation code |

## Problems Identified

### 1. **Games Table - Slug as ID**
```javascript
// state.ts:604
const gameId = `game-${payload.slug}`;
```
**Problem:** Using slug as ID causes FOREIGN KEY issues when code expects UUID
**Impact:**
- Asset uploads break when passing slug instead of `game-{slug}` format
- Updates to slug would break all foreign key references
- Not following UUID best practices

### 2. **Dual ID Systems (id + uuid)**
Tables with both `id` and `uuid`:
- rooms
- game_puzzles

**Problem:** Unclear which should be used for relationships
**Current behavior:** `id` is used in all FOREIGN KEYs, `uuid` is unused

### 3. **Mixed ID Generation Strategies**
- Auth tables: Better Auth UUIDs
- Games/Rooms/Puzzles: Prefixed slugs
- Assets: `crypto.randomUUID()`
- Alerts: `nanoid(12)`
- Metrics: Auto-increment integers

**Problem:** Inconsistency makes code harder to reason about and maintain

## Recommended Solution

### Option A: Full UUID Migration (Recommended)

Convert all entity tables to use proper UUIDs as primary keys:

```sql
-- Before
CREATE TABLE games (
  id TEXT PRIMARY KEY,  -- Currently "game-pirate-mutany"
  slug TEXT NOT NULL UNIQUE,
  ...
);

-- After
CREATE TABLE games (
  id TEXT PRIMARY KEY,  -- UUID: "550e8400-e29b-41d4-a716-446655440000"
  slug TEXT NOT NULL UNIQUE,  -- Still "pirate-mutany" for URLs
  ...
);
```

**Pros:**
- Consistent with Better Auth tables
- Standard practice for relational databases
- Slug changes don't break foreign keys
- Better for distributed systems
- Matches asset upload expectation

**Cons:**
- Requires migration script
- Need to update all seed data
- Existing references must be migrated

### Option B: Keep Prefixed Slugs, Fix Upload Handler

Keep current system but ensure all code handles both ID formats:

```javascript
// Upload handler already does this correctly:
let game = sqlite.prepare('SELECT id, slug, name FROM games WHERE id = ?').get(gameId);
if (!game) {
  game = sqlite.prepare('SELECT id, slug, name FROM games WHERE slug = ?').get(gameId);
}

// Then use game.id for FOREIGN KEY
game_id: game.id  // "game-pirate-mutany", not "pirate-mutany"
```

**Pros:**
- No migration required
- Slug-based IDs are human-readable in database
- Already implemented in most places

**Cons:**
- Non-standard approach
- Slug changes would still break foreign keys
- API consumers must know to use "game-slug" format
- Frontend must convert slugs to IDs for uploads

### Option C: Remove uuid Fields, Standardize on id

Remove the `uuid` columns from rooms and game_puzzles since they're unused:

```sql
ALTER TABLE rooms DROP COLUMN uuid;
ALTER TABLE game_puzzles DROP COLUMN uuid;
```

**Pros:**
- Removes confusion
- Reduces storage

**Cons:**
- Doesn't solve the core problem
- Still non-standard approach

## Immediate Fix (Already Applied)

**File:** `apps/escapeplan-api/src/assets/upload.ts:157`

```javascript
// Before (WRONG - causes FOREIGN KEY error)
game_id: isReusable ? null : gameId,  // Uses slug "pirate-mutany"

// After (CORRECT - uses database ID)
game_id: isReusable ? null : game.id,  // Uses "game-pirate-mutany"
```

This fix resolves the immediate upload error but doesn't address the architectural inconsistency.

## Recommendation

**Short-term:**
1. ✅ Apply the upload.ts fix (already done)
2. Restart API server to apply fix
3. Test asset upload with existing data

**Long-term:**
1. Migrate to Option A (Full UUID Migration)
2. Create migration script that:
   - Generates UUIDs for all existing games
   - Updates all foreign key references
   - Preserves slugs for URL routing
3. Update state.ts to generate UUIDs:
   ```javascript
   const gameId = crypto.randomUUID();  // Not `game-${slug}`
   ```
4. Remove unused `uuid` columns from rooms/game_puzzles

## Migration Script Outline

```sql
-- Step 1: Add temporary columns
ALTER TABLE games ADD COLUMN new_id TEXT;
UPDATE games SET new_id = lower(hex(randomblob(16)));

-- Step 2: Update foreign keys in dependent tables
UPDATE rooms SET game_id = (SELECT new_id FROM games WHERE games.id = rooms.game_id);
UPDATE game_puzzles SET game_id = (SELECT new_id FROM games WHERE games.id = game_puzzles.game_id);
UPDATE bookings SET game_id = (SELECT new_id FROM games WHERE games.id = bookings.game_id);
UPDATE assets SET game_id = (SELECT new_id FROM games WHERE games.id = assets.game_id);

-- Step 3: Swap id columns
ALTER TABLE games DROP COLUMN id;
ALTER TABLE games RENAME COLUMN new_id TO id;

-- Step 4: Recreate constraints
-- (Similar steps for all other tables)
```

## Files That Need Updates

If migrating to UUIDs:
- `apps/escapeplan-api/src/state.ts` - Game/room/puzzle creation
- `apps/escapeplan-api/src/db/seed.ts` - Seed data
- `apps/escapeplan-api/src/db/client.ts` - Schema definitions
- `apps/escapeplan-api/src/db/schema.ts` - Drizzle schema
- All API endpoints that create entities

## Related Issues

- Asset upload FOREIGN KEY constraint failure ✅ Fixed
- Potential slug change breaking references 🚧 Outstanding
- Database schema inconsistency 🚧 Outstanding
- Missing UUID usage in some tables 🚧 Outstanding
