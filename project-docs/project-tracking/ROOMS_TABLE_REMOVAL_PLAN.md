# ROOMS Table Removal - Comprehensive Refactoring Plan

**Status:** 🔵 Planning Document
**Created:** 2025-10-02
**Assigned To:** Execution Agent (to be assigned)
**Validation By:** claude-gamesettings

---

## Executive Summary

Remove the `rooms` table entirely from the EscapePlan database schema. Games ARE rooms - there is no need for a separate entity. This simplifies the data model, removes 6 unnecessary JOINs, and eliminates ~300 lines of code.

**Key Principle:** `bookings.room_id` → DELETE (use `bookings.game_id` directly)

**Data Loss:** ✅ ACCEPTABLE - We are in active development, no production data exists.

---

## Why Remove Rooms?

1. **1:1 Relationship**: Every game has exactly ONE room in practice
2. **Semantic Confusion**: "Room" and "Game" mean the same thing in our business model
3. **Unused Fields**: `theme_token`, `slug`, `capacity` are all NULL/unused
4. **Query Complexity**: 6 JOINs across queries just to get `room_name` (which = `game_name`)
5. **Mobile Flag Redundancy**: `rooms.is_mobile_capable` duplicates `games.game_type`

**Result:** Remove entire `rooms` table, use `games` directly everywhere.

---

## Changes Overview

| Category | Files Changed | LOC Removed | LOC Added |
|----------|---------------|-------------|-----------|
| Database Schema | 3 | ~50 | 0 |
| Contracts/Types | 3 | ~30 | 0 |
| API State Logic | 1 | ~180 | ~20 |
| API Seed Data | 1 | ~40 | 0 |
| API Tests | 3 | ~30 | 0 |
| UI Components | 5 | ~80 | ~40 |
| Drizzle Migration | 1 | 0 | ~30 |
| **TOTAL** | **17** | **~410** | **~90** |

**Net Reduction:** ~320 lines of code

---

## Part 1: Database Schema Changes

### 1.1 Remove `rooms` Table Definition

**File:** `apps/escapeplan-api/src/db/schema.ts`

**Lines to DELETE:** 137-146

```typescript
// DELETE ENTIRE BLOCK:
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  is_mobile_capable: integer('is_mobile_capable', { mode: 'boolean' }).notNull().default(false),
  theme_token: text('theme_token'),
  description: text('description'),
  slug: text('slug'),
  capacity: integer('capacity')
});
```

**Lines to UPDATE:** 530-571 (schema export)

```typescript
// BEFORE:
export const schema = {
  // ...
  games,
  rooms,  // ← DELETE THIS LINE
  gamePuzzles,
  // ...
};

// AFTER:
export const schema = {
  // ...
  games,
  gamePuzzles,
  // ...
};
```

### 1.2 Remove `bookings.room_id` Foreign Key

**File:** `apps/escapeplan-api/src/db/schema.ts`

**Lines to UPDATE:** 189-208 (bookings table)

```typescript
// BEFORE (line 193):
  room_id: text('room_id').notNull().references(() => rooms.id),

// AFTER:
  // DELETED - use game_id directly
```

**IMPORTANT:** Keep `bookings.game_id` - this is the only reference we need.

### 1.3 Update Database Init Script

**File:** `apps/escapeplan-api/src/db/init.ts`

**Lines to DELETE:** 107-116 (entire rooms table creation)

```sql
-- DELETE THIS ENTIRE BLOCK:
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_mobile_capable INTEGER NOT NULL DEFAULT 0,
  theme_token TEXT,
  description TEXT,
  slug TEXT,
  capacity INTEGER
);
```

**Lines to UPDATE:** ~175 (bookings table)

```sql
-- BEFORE:
  room_id TEXT NOT NULL REFERENCES rooms(id),

-- AFTER:
  -- DELETED (use game_id)
```

---

## Part 2: Contracts & Type Definitions

### 2.1 Remove `GameRoomDefinition` Interface

**File:** `packages/contracts/src/index.ts`

**Lines to DELETE:** 337-345

```typescript
// DELETE ENTIRE INTERFACE:
export interface GameRoomDefinition {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  isMobileCapable: boolean;
  themeToken?: string;
  capacity?: number;
}
```

### 2.2 Update `GameDetails` Interface

**File:** `packages/contracts/src/index.ts`

**Lines to UPDATE:** 418-447 (GameDetails interface)

```typescript
// BEFORE (line 446):
  puzzles: GamePuzzleDefinition[];
  rooms: GameRoomDefinition[];  // ← DELETE THIS LINE
}

// AFTER:
  puzzles: GamePuzzleDefinition[];
  // rooms removed - game IS the room
}
```

### 2.3 Update `SaveGameRequest` Interface

**File:** `packages/contracts/src/index.ts`

**Lines to UPDATE:** 449-470 (SaveGameRequest interface)

```typescript
// BEFORE (line 465):
  puzzles: GamePuzzleDefinition[];
  rooms: GameRoomDefinition[];  // ← DELETE THIS LINE
  media?: GameMediaConfig;

// AFTER:
  puzzles: GamePuzzleDefinition[];
  // rooms removed
  media?: GameMediaConfig;
```

### 2.4 Update `QuickStartSessionRequest` Interface

**File:** `packages/contracts/src/index.ts`

**Lines to UPDATE:** 111-118 (QuickStartSessionRequest)

```typescript
// BEFORE:
export interface QuickStartSessionRequest {
  gameId: string;
  roomId: string;  // ← DELETE THIS LINE
  partySize: number;
  durationMinutes?: number | null;
  notes?: string | null;
  autoStartTimer?: boolean;
}

// AFTER:
export interface QuickStartSessionRequest {
  gameId: string;
  // roomId removed - not needed
  partySize: number;
  durationMinutes?: number | null;
  notes?: string | null;
  autoStartTimer?: boolean;
}
```

### 2.5 Update Response Interfaces (roomName)

**File:** `packages/contracts/src/index.ts`

**Lines to UPDATE:**
- Line 144: `ActiveSessionSummary.roomName` → Keep (comes from game_name now)
- Line 162: `BookingSummary.roomName` → Keep (comes from game_name now)

**NO CHANGES NEEDED** - These fields stay, but their source changes in the backend.

---

## Part 3: API State Logic Changes

**File:** `apps/escapeplan-api/src/state.ts`

This is the MOST COMPLEX file with 43 room references.

### 3.1 Remove Room Type Import

**Lines to UPDATE:** 29

```typescript
// BEFORE:
import type {
  // ...
  GameRoomDefinition,  // ← DELETE
  // ...
} from '@escapeplan/contracts';

// AFTER:
import type {
  // ...
  // GameRoomDefinition removed
  // ...
} from '@escapeplan/contracts';
```

### 3.2 Remove Room Query Functions

**Lines to DELETE:** ~600-615 (entire room mapping block)

```typescript
// DELETE THIS ENTIRE FUNCTION/BLOCK:
const rooms: GameRoomDefinition[] = roomRows.map((room) => ({
  id: room.id,
  name: room.name,
  isMobileCapable: Boolean(room.is_mobile_capable),
  themeToken: room.theme_token ?? undefined,
  description: room.description ?? undefined,
  slug: room.slug ?? undefined,
  capacity: room.capacity ?? undefined
}));
```

**Find:** Search for `SELECT * FROM rooms WHERE game_id = ?`
**Action:** DELETE entire query and mapping logic

### 3.3 Remove Room Normalization Function

**Lines to DELETE:** ~760-770

```typescript
// DELETE ENTIRE FUNCTION:
function normalizeRoomInput(room: GameRoomDefinition, index: number): GameRoomDefinition {
  const id = room.id && room.id.trim().length > 0 ? room.id : randomUUID();
  return {
    id,
    name: room.name,
    isMobileCapable: room.isMobileCapable,
    themeToken: room.themeToken,
    description: room.description,
    slug: room.slug,
    capacity: room.capacity,
  };
}
```

### 3.4 Update `persistGameRelations` Function

**Lines to UPDATE:** ~843-905

```typescript
// BEFORE:
function persistGameRelations(gameId: string, rooms: GameRoomDefinition[], puzzles: GamePuzzleDefinition[]) {
  // Delete rooms
  const existingRoomIds = sqlite.prepare(`SELECT id FROM rooms WHERE game_id = ?`).all(gameId).map((r: any) => r.id);
  const newRoomIds = rooms.map(r => r.id);
  const roomsToDelete = existingRoomIds.filter((id: string) => !newRoomIds.includes(id));

  if (roomsToDelete.length > 0) {
    const placeholders = roomsToDelete.map(() => '?').join(',');
    sqlite.prepare(`DELETE FROM rooms WHERE id IN (${placeholders})`).run(...roomsToDelete);
  }

  // Insert/update rooms
  const roomStmt = sqlite.prepare(
    `INSERT INTO rooms (id, game_id, name, is_mobile_capable, theme_token, description, slug, capacity)
     VALUES (@id, @game_id, @name, @is_mobile_capable, @theme_token, @description, @slug, @capacity)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       is_mobile_capable = excluded.is_mobile_capable,
       theme_token = excluded.theme_token,
       description = excluded.description,
       slug = excluded.slug,
       capacity = excluded.capacity`
  );

  for (const room of rooms) {
    roomStmt.run({
      id: room.id,
      game_id: gameId,
      name: room.name,
      is_mobile_capable: room.isMobileCapable ? 1 : 0,
      theme_token: room.themeToken ?? null,
      description: room.description ?? null,
      slug: room.slug ?? null,
      capacity: room.capacity ?? null
    });
  }

  // ... puzzle logic ...
}

// AFTER:
function persistGameRelations(gameId: string, puzzles: GamePuzzleDefinition[]) {
  // Room logic DELETED - games don't have separate rooms

  // ... puzzle logic stays the same ...
}
```

**Function signature change:**
```typescript
// BEFORE:
persistGameRelations(gameId: string, rooms: GameRoomDefinition[], puzzles: GamePuzzleDefinition[])

// AFTER:
persistGameRelations(gameId: string, puzzles: GamePuzzleDefinition[])
```

### 3.5 Update All JOINs to Use Game Name Directly

**Search Pattern:** `JOIN rooms r ON r.id = b.room_id`
**Occurrences:** 6 times in state.ts

**Replace ALL instances like this:**

```sql
-- BEFORE:
SELECT
  s.id,
  g.name as game_name,
  r.name as room_name,  -- ← WRONG
  -- ...
FROM sessions s
  JOIN bookings b ON b.id = s.booking_id
  JOIN games g ON g.id = b.game_id
  JOIN rooms r ON r.id = b.room_id  -- ← DELETE THIS JOIN
WHERE ...

-- AFTER:
SELECT
  s.id,
  g.name as game_name,
  g.name as room_name,  -- ← Use game name as room name
  -- ...
FROM sessions s
  JOIN bookings b ON b.id = s.booking_id
  JOIN games g ON g.id = b.game_id
  -- rooms JOIN deleted
WHERE ...
```

**Files/Lines to Update:**
1. Line ~1550: `getDashboard()` query
2. Line ~1635: `getActiveSessionDetails()` query
3. Line ~1684: `executeSessionCommand()` - start timer query
4. Line ~1757: `executeSessionCommand()` - pause/resume queries
5. Line ~1797: `executeSessionCommand()` - reset timer query
6. Line ~2000: `getBookingCalendar()` query

**CRITICAL:** For each query:
1. DELETE the `JOIN rooms r ON r.id = b.room_id` line
2. KEEP `r.name as room_name` BUT change to `g.name as room_name`

### 3.6 Update `createGameSession` Function

**Line:** ~1537-1570

```typescript
// BEFORE:
export function createGameSession(req: QuickStartSessionRequest, operatorId: string): GameSessionDetails {
  // Validate game exists
  const game = sqlite.prepare('SELECT id, name, duration_minutes, default_volume FROM games WHERE id = ?').get(req.gameId) as any;
  if (!game) throw new Error('Game not found');

  // Validate room exists and belongs to game  // ← DELETE VALIDATION
  const room = sqlite.prepare('SELECT id, name FROM rooms WHERE id = ? AND game_id = ?').get(req.roomId, req.gameId) as any;
  if (!room) throw new Error('Room not found or does not belong to this game');
  // ...
}

// AFTER:
export function createGameSession(req: QuickStartSessionRequest, operatorId: string): GameSessionDetails {
  // Validate game exists
  const game = sqlite.prepare('SELECT id, name, duration_minutes, default_volume FROM games WHERE id = ?').get(req.gameId) as any;
  if (!game) throw new Error('Game not found');

  // Room validation DELETED - game IS the room
  // ...
}
```

**Also Update Booking Creation:**

```typescript
// BEFORE (line ~1543):
const bookingCode = `QS-${Date.now().toString(36).toUpperCase()}`;
const bookingId = randomUUID();

sqlite.prepare(`
  INSERT INTO bookings (id, booking_code, game_id, room_id, start_time, end_time, status, party_size, ...)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ...)
`).run(bookingId, bookingCode, req.gameId, req.roomId, ...);  // ← roomId parameter

// AFTER:
const bookingCode = `QS-${Date.now().toString(36).toUpperCase()}`;
const bookingId = randomUUID();

sqlite.prepare(`
  INSERT INTO bookings (id, booking_code, game_id, start_time, end_time, status, party_size, ...)
  VALUES (?, ?, ?, ?, ?, ?, ...)
`).run(bookingId, bookingCode, req.gameId, ...);  // ← roomId removed from VALUES
```

### 3.7 Update Alert Templates (roomName context)

**Search:** `roomName:` in alert context objects

**Lines to UPDATE:** ~2040-2300 (alert creation calls)

```typescript
// These are FINE - roomName still exists, just comes from game.name now:
createAlert({
  // ...
  context: {
    gameName: session.gameName,
    roomName: session.roomName  // ← This field stays, source changes
  }
});
```

**NO CHANGES NEEDED** - `roomName` field persists in responses, just populated from `g.name` instead of `r.name`.

---

## Part 4: API Seed Data Changes

**File:** `apps/escapeplan-api/src/db/seed.ts`

### 4.1 Remove Room Seed Data

**Lines to DELETE:** ~200-220 (room seed data)

```typescript
// DELETE:
const pirateRooms = [
  {
    id: roomMainId,
    game_id: pirateGameId,
    name: 'Pirate Mutiny - Main Room',
    is_mobile_capable: 0,
    theme_token: null,
    description: null,
    slug: null,
    capacity: 5
  }
];
```

### 4.2 Remove Room INSERT Statement

**Lines to DELETE:** ~300-310

```typescript
// DELETE:
const roomStmt = db.prepare(`
  INSERT INTO rooms (id, game_id, name, is_mobile_capable, theme_token, description, slug, capacity)
  VALUES (@id, @game_id, @name, @is_mobile_capable, @theme_token, @description, @slug, @capacity)
  ON CONFLICT(id) DO NOTHING
`);

for (const room of pirateRooms) {
  roomStmt.run(room);
}
```

### 4.3 Update Booking Seed Data

**Lines to UPDATE:** ~350-400 (booking creation)

```typescript
// BEFORE:
const booking = {
  id: 'booking-001',
  booking_code: 'TEST-001',
  game_id: pirateGameId,
  room_id: roomMainId,  // ← DELETE THIS
  // ...
};

// AFTER:
const booking = {
  id: 'booking-001',
  booking_code: 'TEST-001',
  game_id: pirateGameId,
  // room_id removed
  // ...
};
```

**UPDATE INSERT statement:**

```sql
-- BEFORE:
INSERT INTO bookings (id, booking_code, game_id, room_id, ...)
VALUES (@id, @booking_code, @game_id, @room_id, ...)

-- AFTER:
INSERT INTO bookings (id, booking_code, game_id, ...)
VALUES (@id, @booking_code, @game_id, ...)
```

### 4.4 Update Alert Rule Templates

**Line:** ~546 (alert template)

```typescript
// BEFORE:
message_template: '{{gameName}} ({{roomName}}) paused at {{time}}',

// AFTER:
message_template: '{{gameName}} paused at {{time}}',
// OR keep roomName - it will just equal gameName
```

**DECISION:** Keep `{{roomName}}` in template since backend still provides it (from game name).

---

## Part 5: API Tests

### 5.1 Update Integration Test

**File:** `apps/escapeplan-api/src/test-integration.ts`

**Lines to UPDATE:** ~46 (booking creation)

```typescript
// BEFORE:
const bookingId = quickStart.session.id;
// ... test logic referencing roomId

// AFTER:
// Remove any roomId references in test assertions
```

### 5.2 Update Server Test

**File:** `apps/escapeplan-api/test/server.test.ts`

**Lines to UPDATE:** ~79 (seed INSERT)

```sql
-- BEFORE:
INSERT INTO bookings (id, booking_code, game_id, room_id, ...)
VALUES ('booking-test', 'TEST-001', 'game-test', 'room-test', ...);

-- AFTER:
INSERT INTO bookings (id, booking_code, game_id, ...)
VALUES ('booking-test', 'TEST-001', 'game-test', ...);
```

**Also DELETE:**

```sql
-- DELETE:
INSERT INTO rooms (id, game_id, name, is_mobile_capable)
VALUES ('room-test', 'game-test', 'Test Room', 0);
```

### 5.3 Update Logging Test

**File:** `apps/escapeplan-api/src/test-logging.ts`

**Lines to UPDATE:** ~30, 40 (mock data)

```typescript
// BEFORE:
context: { gameName: 'Test Game', roomName: 'Test Room' }

// AFTER:
context: { gameName: 'Test Game', roomName: 'Test Game' }  // roomName = gameName
```

---

## Part 6: Generate Drizzle Migration

After making schema changes, generate the migration:

```bash
cd apps/escapeplan-api
npx drizzle-kit generate
```

**Expected Migration File:** `drizzle/0006_remove_rooms_table.sql`

**Expected Contents:**

```sql
-- Drop bookings.room_id foreign key constraint
PRAGMA foreign_keys=OFF;

-- Recreate bookings table without room_id
CREATE TABLE bookings_new (
  id TEXT PRIMARY KEY,
  booking_code TEXT NOT NULL UNIQUE,
  game_id TEXT NOT NULL REFERENCES games(id),
  -- room_id removed
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  deposit_due_cents INTEGER NOT NULL DEFAULT 0,
  total_due_cents INTEGER NOT NULL DEFAULT 0,
  price_tier TEXT NOT NULL,
  discount_code TEXT,
  is_mobile INTEGER NOT NULL DEFAULT 0,
  is_adhoc INTEGER NOT NULL DEFAULT 0,
  location_note TEXT,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  notes TEXT
);

-- Copy data (room_id omitted)
INSERT INTO bookings_new SELECT
  id, booking_code, game_id,
  start_time, end_time, status, party_size,
  deposit_due_cents, total_due_cents, price_tier,
  discount_code, is_mobile, is_adhoc,
  location_note, contact_name, contact_phone, notes
FROM bookings;

-- Drop old table
DROP TABLE bookings;

-- Rename new table
ALTER TABLE bookings_new RENAME TO bookings;

-- Drop rooms table entirely
DROP TABLE IF EXISTS rooms;

PRAGMA foreign_keys=ON;
```

**IMPORTANT:** Test migration on a copy of the database first!

---

## Part 7: UI Component Changes

### 7.1 GameModal Component

**File:** `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`

**Lines to UPDATE:** Search for `rooms` array operations

```typescript
// BEFORE:
function createEmptyGame(): GameDetails {
  return {
    // ...
    rooms: [{
      id: randomUUID(),
      name: '',
      isMobileCapable: false,
      description: '',
      slug: '',
      capacity: undefined
    }],
    puzzles: []
  };
}

// AFTER:
function createEmptyGame(): GameDetails {
  return {
    // ...
    // rooms removed
    puzzles: []
  };
}
```

**DELETE:** Entire "Rooms" tab/section in modal (estimated ~100 lines)

**UPDATE:** Validation logic to remove room checks

```typescript
// BEFORE:
if (!data.rooms || data.rooms.length === 0) {
  errors.rooms = 'At least one room is required';
}

// AFTER:
// Room validation deleted
```

### 7.2 GameDetailsModal Component

**File:** `apps/escapeplan-web/src/lib/components/games/GameDetailsModal.svelte`

**Lines to UPDATE:** Remove room display section

```svelte
<!-- BEFORE: -->
<section>
  <h3>Rooms</h3>
  {#each game.rooms as room}
    <div class="room-card">
      <h4>{room.name}</h4>
      <p>{room.description || 'No description'}</p>
    </div>
  {/each}
</section>

<!-- AFTER: -->
<!-- Room display section deleted -->
```

### 7.3 QuickStartModal Component

**File:** `apps/escapeplan-web/src/lib/components/sessions/QuickStartModal.svelte`

**Lines to UPDATE:** Remove room selector dropdown

```svelte
<!-- BEFORE: -->
<label class="form-control">
  <span class="label-text">Room</span>
  <select bind:value={selectedRoomId} class="select select-bordered">
    <option value="">Select room...</option>
    {#each selectedGame.rooms as room}
      <option value={room.id}>{room.name}</option>
    {/each}
  </select>
</label>

<!-- AFTER: -->
<!-- Room selector deleted - not needed -->
```

**UPDATE:** Form submission to remove roomId

```typescript
// BEFORE:
const payload: QuickStartSessionRequest = {
  gameId: selectedGameId,
  roomId: selectedRoomId,
  partySize,
  durationMinutes,
  notes,
  autoStartTimer
};

// AFTER:
const payload: QuickStartSessionRequest = {
  gameId: selectedGameId,
  // roomId removed
  partySize,
  durationMinutes,
  notes,
  autoStartTimer
};
```

### 7.4 Dashboard Component

**File:** `apps/escapeplan-web/src/routes/(app)/dashboard/+page.svelte`

**Lines to UPDATE:** Display logic (roomName field STAYS)

```svelte
<!-- BEFORE: -->
<div class="session-card">
  <h3>{session.gameName}</h3>
  <p class="text-sm">{session.roomName}</p>  <!-- roomName comes from game now -->
</div>

<!-- AFTER: -->
<!-- NO CHANGE - roomName still exists in response -->
<div class="session-card">
  <h3>{session.gameName}</h3>
  <p class="text-sm">{session.roomName}</p>  <!-- Now equals gameName -->
</div>
```

**OPTIONAL:** Hide roomName if it's identical to gameName:

```svelte
{#if session.roomName !== session.gameName}
  <p class="text-sm">{session.roomName}</p>
{/if}
```

### 7.5 Bookings Page

**File:** `apps/escapeplan-web/src/routes/(app)/bookings/+page.svelte`

**Lines to UPDATE:** Similar to dashboard - roomName field stays but comes from game

```svelte
<!-- Display logic unchanged - roomName still in BookingSummary -->
<td>{booking.gameName}</td>
<td>{booking.roomName}</td>  <!-- Now equals gameName -->
```

---

## Part 8: Validation Checklist

After executing all changes, validate with this checklist:

### 8.1 Code Search Validation

```bash
# Should return 0 results:
grep -rn "rooms\." apps/escapeplan-api/src/
grep -rn "GameRoomDefinition" packages/contracts/src/
grep -rn "JOIN rooms" apps/escapeplan-api/src/
grep -rn "room_id" apps/escapeplan-api/src/db/schema.ts
grep -rn "selectedRoomId" apps/escapeplan-web/src/

# Should still find results (roomName in responses):
grep -rn "roomName" apps/escapeplan-api/src/state.ts  # ✅ OK - response field
grep -rn "roomName" apps/escapeplan-web/src/  # ✅ OK - display field
```

### 8.2 Type Check Validation

```bash
# Rebuild contracts
cd packages/contracts
pnpm build

# Type-check API
cd ../../apps/escapeplan-api
pnpm lint

# Type-check Web
cd ../escapeplan-web
pnpm check
```

**Expected:** 0 new TypeScript errors related to rooms.

### 8.3 Database Validation

```bash
# Apply migration
cd apps/escapeplan-api
npx drizzle-kit migrate

# Verify schema
sqlite3 data/escapeplan.db ".schema bookings"
# Should NOT contain room_id column

sqlite3 data/escapeplan.db ".tables"
# Should NOT contain rooms table

# Re-seed database
pnpm run db:seed

# Verify bookings work
sqlite3 data/escapeplan.db "SELECT id, game_id FROM bookings LIMIT 1;"
# Should have game_id, no room_id
```

### 8.4 Runtime Validation

```bash
# Start API
cd apps/escapeplan-api
pnpm dev

# Test quick-start endpoint
curl -X POST http://localhost:4000/api/sessions/quick-start \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=..." \
  -d '{
    "gameId": "game-uuid-here",
    "partySize": 4,
    "autoStartTimer": true
  }'

# Should succeed without roomId parameter
```

### 8.5 UI Validation

```bash
# Start web app
cd apps/escapeplan-web
pnpm dev

# Manual testing checklist:
# [ ] Game Modal opens without errors
# [ ] Can create new game without room tab
# [ ] Can edit existing game
# [ ] QuickStart modal works without room selector
# [ ] Dashboard shows sessions with game names
# [ ] Bookings page displays correctly
```

---

## Part 9: Rollback Plan

If issues arise, rollback with:

```bash
# Restore previous migration
cd apps/escapeplan-api
sqlite3 data/escapeplan.db < drizzle/0005_*.sql

# Restore database from backup
cp data/escapeplan.db.backup data/escapeplan.db

# Git revert
git revert HEAD~1
```

**Backup Command (run BEFORE starting):**

```bash
cp apps/escapeplan-api/data/escapeplan.db apps/escapeplan-api/data/escapeplan.db.backup
```

---

## Part 10: Estimated Effort

| Task | Time Estimate |
|------|---------------|
| Database schema changes | 30 min |
| Contract updates | 20 min |
| API state.ts refactoring | 2 hours |
| API seed data updates | 30 min |
| Test updates | 30 min |
| Migration generation & testing | 45 min |
| UI component updates | 1.5 hours |
| Validation & testing | 1 hour |
| **TOTAL** | **~7 hours** |

---

## Part 11: Success Criteria

- [ ] `rooms` table does not exist in schema.ts
- [ ] `rooms` table does not exist in database
- [ ] `bookings.room_id` column removed
- [ ] `GameRoomDefinition` interface removed from contracts
- [ ] `QuickStartSessionRequest.roomId` removed
- [ ] All 6 room JOINs removed from state.ts
- [ ] `persistGameRelations()` no longer accepts rooms parameter
- [ ] GameModal has no rooms tab
- [ ] QuickStartModal has no room selector
- [ ] All queries use `g.name as room_name` instead of `r.name as room_name`
- [ ] Seed data runs without errors
- [ ] API starts without errors
- [ ] UI starts without errors
- [ ] Quick-start creates sessions successfully
- [ ] Dashboard displays sessions correctly
- [ ] 0 TypeScript errors in affected files
- [ ] All tests pass

---

## Part 12: Post-Execution Tasks

After successful removal:

1. **Update Documentation:**
   - Mark DATABASE_SYSTEM.md "Games & Rooms (2 tables)" → "Games (1 table)"
   - Update ER diagram if it exists
   - Update project-overview.md schema section

2. **Update TODO.json:**
   - Mark room removal task complete
   - Add UI refactoring tasks for GameModal tabs

3. **Commit Message Template:**
   ```
   refactor: remove rooms table - games ARE rooms

   BREAKING CHANGE: Removed rooms table and room_id FK

   - Delete rooms table from schema (db/schema.ts, db/init.ts)
   - Remove GameRoomDefinition interface from contracts
   - Update QuickStartSessionRequest to remove roomId
   - Refactor state.ts to remove 6 room JOINs
   - Update UI components (GameModal, QuickStartModal)
   - Remove room seed data and test fixtures
   - Generate Drizzle migration 0006

   Net reduction: ~320 lines of code

   Session: Rooms Removal (Execution Agent)
   Validation: claude-gamesettings
   ```

4. **Handoff to UI Refactoring:**
   - Document GameModal tab structure needed
   - Identify DaisyUI component standardization tasks
   - Create GameModal refactoring plan

---

## Notes for Execution Agent

- **CRITICAL:** Backup database before starting
- **ORDER MATTERS:** Do schema changes before contract changes
- **REBUILD CONTRACTS:** Run `pnpm --filter @escapeplan/contracts build` after contract changes
- **TEST INCREMENTALLY:** Don't wait until the end to test
- **USE GREP:** Validate no room references remain after each step
- **CHECK LOGS:** Watch for runtime errors during API restart
- **ASK IF STUCK:** This is complex - validate assumptions

---

**Document Version:** 1.0
**Ready for Execution:** ✅ YES
**Estimated Completion Time:** 1 full development session (~7 hours)

---

## Validation Sign-Off

**Execution Agent:** _______________ (Date: ______)
**Validation Agent (claude-gamesettings):** _______________ (Date: ______)

