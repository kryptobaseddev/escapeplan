# Phase 1: Rooms Table Removal - FINAL CLEANUP - Agent Execution Prompt

**Agent Role:** Backend Refactoring Specialist
**Session:** Rooms Table Final Cleanup (Post-Partial Implementation)
**Validation By:** claude-gamesettings (will review your work)
**Status:** ⚠️ PARTIALLY COMPLETE - Requires cleanup and completion

---

## 🔴 CRITICAL CONTEXT

**Previous agent claimed completion but LEFT CRITICAL BUGS:**
- ✅ Database schema cleaned (rooms table removed from schema.ts and live DB)
- ✅ Contracts cleaned (no GameRoomDefinition interface)
- ❌ **GameModal.svelte:725 has `rooms: cleanRooms` - UNDEFINED VARIABLE (will crash)**
- ❌ UI components still reference rooms in comments/descriptions
- ⚠️ Some backend queries may still have legacy room references

**YOUR MISSION:** Find and eliminate ALL remaining room references. Leave ZERO traces.

---

## REQUIRED READING (Read these files FIRST)

**Base Instructions & Tech Stack:**
1. `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt` - Base project instructions
2. `@escapeplan-app/project-docs/project-tracking/project.yaml` - Tech stack & commands
3. `@escapeplan-app/apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md` - Schema/validation patterns

**Execution Plan:**
4. `@escapeplan-app/project-docs/project-tracking/ROOMS_TABLE_REMOVAL_PLAN.md` - YOUR PRIMARY REFERENCE
5. **THIS FILE** - Specific cleanup tasks

**Schema Reference:**
6. `@escapeplan-app/packages/contracts/src/schema.ts` - Drizzle database schema
7. `@escapeplan-app/packages/contracts/src/validation.ts` - Zod validation schemas

---

## CRITICAL RULES

### DO:
- ✅ Start with comprehensive grep audit (find ALL room references)
- ✅ Fix the critical `cleanRooms` bug in GameModal.svelte FIRST
- ✅ Use Drizzle ORM patterns (NO raw SQL)
- ✅ Use Zod schemas for validation
- ✅ Test after EACH fix
- ✅ Document every change in session notes
- ✅ Verify with multiple grep patterns before declaring done

### DO NOT:
- ❌ Skip the comprehensive grep audit
- ❌ Make assumptions about what's fixed
- ❌ Trust previous agent's work without verification
- ❌ Use raw SQL strings
- ❌ Create new interfaces manually (use Zod inference)
- ❌ Touch pricing logic (separate phase)
- ❌ Commit until validation passes

---

## EXECUTION WORKFLOW

### Phase 1: Comprehensive Audit (30 min)

**Run ALL these grep searches and document results:**

```bash
# Search 1: Direct room references
grep -rn "\brooms\b" apps/escapeplan-web/src apps/escapeplan-api/src packages/contracts/src --include="*.ts" --include="*.svelte" --include="*.js" > audit-rooms.txt

# Search 2: roomId references
grep -rn "roomId\|room_id" apps/escapeplan-web/src apps/escapeplan-api/src packages/contracts/src --include="*.ts" --include="*.svelte" --include="*.js" > audit-roomid.txt

# Search 3: Room type references
grep -rn "GameRoomDefinition\|RoomDefinition" apps/escapeplan-web/src apps/escapeplan-api/src packages/contracts/src --include="*.ts" --include="*.svelte" > audit-room-types.txt

# Search 4: SQL JOINs with rooms
grep -rn "JOIN rooms\|FROM rooms" apps/escapeplan-api/src --include="*.ts" --include="*.sql" > audit-room-queries.txt

# Search 5: cleanRooms variable
grep -rn "cleanRooms\|normalizeRoom\|roomData" apps/escapeplan-web/src --include="*.ts" --include="*.svelte" > audit-room-vars.txt

# Search 6: Room comments/documentation
grep -rn "room" apps/escapeplan-web/src/lib/components/games/GameModal.svelte > audit-room-comments.txt

# Review all audit files
cat audit-*.txt
```

**Expected findings:**
- GameModal.svelte:725 - `rooms: cleanRooms` (CRITICAL BUG)
- GameModal.svelte:804 - Comment mentioning "rooms"
- Possibly more in state.ts, QuickStartModal.svelte, etc.

**Action:** Create a prioritized fix list based on audit results.

---

### Phase 2: Fix Critical Bug - GameModal.svelte (15 min)

**File:** `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`

**Location 1 - Line ~725 (CRITICAL):**

```typescript
// ❌ BEFORE (CRASHES - cleanRooms undefined):
const payload: SaveGameRequest = {
  slug: workingGame.slug.trim(),
  name: workingGame.name.trim(),
  // ... other fields ...
  rooms: cleanRooms,  // ← DELETE THIS LINE
  puzzles: cleanPuzzles,
  // ...
};

// ✅ AFTER:
const payload: SaveGameRequest = {
  slug: workingGame.slug.trim(),
  name: workingGame.name.trim(),
  // ... other fields ...
  // rooms removed - games ARE rooms
  puzzles: cleanPuzzles,
  // ...
};
```

**Location 2 - Line ~804 (Comment cleanup):**

```svelte
<!-- ❌ BEFORE: -->
<div class="modal-description">
  Configure game metadata, media assets, rooms, puzzles, pricing, and booking rules. All fields map directly to the EscapePlan API schema.
</div>

<!-- ✅ AFTER: -->
<div class="modal-description">
  Configure game metadata, media assets, puzzles, pricing, and booking rules. All fields map directly to the EscapePlan API schema.
</div>
```

**VALIDATE IMMEDIATELY:**
```bash
cd apps/escapeplan-web
pnpm check
# Should show FEWER errors than before
```

---

### Phase 3: UI Components Cleanup (1 hour)

**Search for ALL .svelte files with room references:**

```bash
find apps/escapeplan-web/src -name "*.svelte" -exec grep -l "room" {} \;
```

**For EACH file found, check:**

1. **GameDetailsModal.svelte** - Verify no rooms tab/section
2. **QuickStartModal.svelte** - Verify no room selector dropdown
3. **Dashboard pages** - Check if roomName display is needed (it's populated from game.name now)
4. **Booking pages** - Same check for roomName field

**Pattern for fixes:**

```svelte
<!-- If roomName equals gameName, optionally hide it: -->
{#if session.roomName !== session.gameName}
  <p class="text-sm">{session.roomName}</p>
{/if}

<!-- OR just keep it - roomName now always equals gameName -->
<p class="text-sm">{session.roomName}</p>
```

**VALIDATE after each file:**
```bash
pnpm check
```

---

### Phase 4: Backend Cleanup (1 hour)

**File:** `apps/escapeplan-api/src/state.ts`

**Tasks:**

1. **Search for ALL room-related comments:**
   ```bash
   grep -n "room" apps/escapeplan-api/src/state.ts
   ```

2. **Verify these items are removed:**
   - [ ] `GameRoomDefinition` import (line ~29)
   - [ ] Room query logic (~600-615)
   - [ ] `normalizeRoomInput()` function (~760-770)
   - [ ] Room parameters in `persistGameRelations()` (~843-905)
   - [ ] ALL `JOIN rooms` queries (6 locations - see ROOMS_TABLE_REMOVAL_PLAN.md Part 3.5)

3. **Verify all JOINs updated to:**
   ```sql
   -- ✅ CORRECT:
   SELECT
     g.name as game_name,
     g.name as room_name,  -- Use game name as room name
     -- ...
   FROM sessions s
     JOIN bookings b ON b.id = s.booking_id
     JOIN games g ON g.id = b.game_id
     -- NO rooms JOIN
   ```

4. **Check createGameSession() function:**
   ```typescript
   // ✅ Should NOT have room validation:
   export function createGameSession(req: QuickStartSessionRequest, operatorId: string) {
     const game = sqlite.prepare('SELECT id, name FROM games WHERE id = ?').get(req.gameId);
     if (!game) throw new Error('Game not found');

     // ❌ Should NOT exist:
     // const room = sqlite.prepare('SELECT id FROM rooms WHERE id = ?').get(req.roomId);

     // ✅ Booking INSERT should NOT have room_id:
     sqlite.prepare(`
       INSERT INTO bookings (id, booking_code, game_id, start_time, ...)
       VALUES (?, ?, ?, ?, ...)
     `).run(bookingId, bookingCode, req.gameId, ...);
   }
   ```

**VALIDATE:**
```bash
cd apps/escapeplan-api
pnpm lint
# Should succeed with 0 errors
```

---

### Phase 5: Seed Data & Tests Verification (30 min)

**File:** `apps/escapeplan-api/src/db/seed.ts`

**Verify these are removed:**
- [ ] Room seed data arrays (pirateRooms, etc.)
- [ ] Room INSERT statements
- [ ] room_id from booking seed data

**Files:** Test files

**Check these files:**
1. `apps/escapeplan-api/src/test-integration.ts` - No roomId in quick-start tests
2. `apps/escapeplan-api/test/server.test.ts` - No room INSERT, no room_id in bookings
3. `apps/escapeplan-api/src/test-logging.ts` - roomName = gameName in mock data

**VALIDATE:**
```bash
cd apps/escapeplan-api
pnpm db:seed
# Should complete without errors

pnpm test
# All tests should pass
```

---

### Phase 6: Database Schema Final Verification (15 min)

```bash
# Check live database
sqlite3 apps/escapeplan-api/data/escapeplan.db ".schema" | grep -i room
# Expected: No output (except roomName in comments is OK)

# Check tables list
sqlite3 apps/escapeplan-api/data/escapeplan.db ".tables" | grep -i room
# Expected: No output

# Check bookings table
sqlite3 apps/escapeplan-api/data/escapeplan.db ".schema bookings"
# Expected: No room_id column

# Check for any room_id data
sqlite3 apps/escapeplan-api/data/escapeplan.db "PRAGMA table_info(bookings);" | grep room
# Expected: No output
```

---

### Phase 7: Contracts Verification (15 min)

**Check packages/contracts/src/schema.ts:**
```bash
grep -n "rooms" packages/contracts/src/schema.ts
# Expected: Only comment "GAMES & ROOMS" on line 105 (section header - acceptable)
```

**Check packages/contracts/src/validation.ts:**
```bash
grep -n "room" packages/contracts/src/validation.ts
# Expected: 0 results
```

**Check packages/contracts/src/index.ts:**
```bash
grep -n "Room" packages/contracts/src/index.ts
# Expected: 0 results for GameRoomDefinition
```

**VALIDATE:**
```bash
cd packages/contracts
pnpm build
# Should succeed with 0 errors
```

---

### Phase 8: Final Comprehensive Validation (30 min)

**Run ALL validation commands from ROOMS_TABLE_REMOVAL_PLAN.md Part 8:**

```bash
# 1. Code search validation (MUST be 0 for all)
grep -rn "rooms\." apps/escapeplan-api/src/ | wc -l
# Expected: 0

grep -rn "GameRoomDefinition" packages/contracts/src/ | wc -l
# Expected: 0

grep -rn "JOIN rooms" apps/escapeplan-api/src/ | wc -l
# Expected: 0

grep -rn "room_id" packages/contracts/src/schema.ts | wc -l
# Expected: 0

grep -rn "cleanRooms" apps/escapeplan-web/src/ | wc -l
# Expected: 0

# 2. Type checking (ALL must pass)
cd packages/contracts && pnpm build
cd ../../apps/escapeplan-api && pnpm lint
cd ../escapeplan-web && pnpm check

# 3. Runtime validation
cd apps/escapeplan-api
pnpm db:seed
pnpm dev
# Should start without errors - test quick-start endpoint manually
```

---

## VALIDATION CHECKLIST

Mark each item as you complete it:

### Database Schema
- [ ] `rooms` table does not exist in schema.ts
- [ ] `rooms` table does not exist in live database
- [ ] `bookings.room_id` column removed from schema.ts
- [ ] `bookings.room_id` column removed from database
- [ ] No room-related columns in any table

### Contracts & Types
- [ ] `GameRoomDefinition` interface removed (grep returns 0)
- [ ] `roomSchema` removed from validation.ts
- [ ] `SaveGameRequest` has NO `rooms` field
- [ ] `QuickStartSessionRequest` has NO `roomId` field
- [ ] Contracts build succeeds with 0 errors

### API State Logic
- [ ] All 6 room JOINs removed from state.ts queries
- [ ] All JOINs replaced with `g.name as room_name`
- [ ] `persistGameRelations()` has NO rooms parameter
- [ ] Room INSERT/UPDATE/DELETE logic removed
- [ ] `createGameSession()` has NO room validation or roomId usage
- [ ] API lints successfully with 0 errors

### UI Components
- [ ] GameModal.svelte line 725 - `rooms: cleanRooms` REMOVED
- [ ] GameModal.svelte line 804 - comment updated (no "rooms")
- [ ] GameDetailsModal.svelte - no rooms tab/display
- [ ] QuickStartModal.svelte - no room selector
- [ ] Web app type-checks successfully with 0 errors

### Seed Data & Tests
- [ ] Room seed data removed from seed.ts
- [ ] Booking seed data has NO room_id
- [ ] Test fixtures updated (no room references)
- [ ] Seed runs successfully
- [ ] All tests pass

### Code Quality (CRITICAL)
- [ ] `grep -rn "cleanRooms"` returns 0 results
- [ ] `grep -rn "rooms\."` returns 0 results
- [ ] `grep -rn "GameRoomDefinition"` returns 0 results
- [ ] `grep -rn "JOIN rooms"` returns 0 results
- [ ] `grep -rn "room_id" schema.ts` returns 0 results
- [ ] API starts without errors
- [ ] Quick-start session creation works (manual test)

---

## MANUAL TESTING SCENARIOS

After ALL automated checks pass, test these manually:

### Test 1: Create New Game
```bash
# 1. Start API
cd apps/escapeplan-api && pnpm dev

# 2. Start Web (separate terminal)
cd apps/escapeplan-web && pnpm dev

# 3. Navigate to http://localhost:5173/admin/games
# 4. Click "Add Game"
# 5. Fill in game details (name, slug, etc.)
# 6. Add at least 1 puzzle
# 7. Add at least 1 pricing tier
# 8. Click Save
# 9. VERIFY: No console errors, game saves successfully
```

### Test 2: Quick-Start Session
```bash
# 1. Navigate to http://localhost:5173/dashboard
# 2. Click "Quick Start"
# 3. Select a game
# 4. Set party size: 4
# 5. Click "Start Session"
# 6. VERIFY: Session starts, no room selector visible, no errors
```

### Test 3: View Existing Bookings
```bash
# 1. Navigate to http://localhost:5173/bookings
# 2. VERIFY: Bookings display with game names
# 3. VERIFY: roomName field shows game name (if visible)
# 4. VERIFY: No console errors
```

---

## COMPLETION REQUIREMENTS

### 1. Create Session Notes

Create `project-docs/project-tracking/sessions/SESSION_50_ROOMS_FINAL_CLEANUP.md`:

```markdown
# Session 50: Rooms Table Removal - Final Cleanup

**Date:** [DATE]
**Status:** ✅ COMPLETE
**Agent:** [YOUR NAME]
**Validation:** Pending (claude-gamesettings)

## Summary
Completed final cleanup of rooms table removal. Eliminated all remaining references including critical bug in GameModal.svelte.

## Audit Results

### Initial Grep Audit
[PASTE OUTPUT FROM audit-*.txt files]

### Total Room References Found
- Direct room references: X
- roomId references: X
- Type references: X
- SQL JOINs: X
- Variable references: X

## Changes Made

### Critical Fixes
1. **GameModal.svelte:725** - Removed `rooms: cleanRooms` from payload
2. **GameModal.svelte:804** - Updated comment to remove "rooms"
3. [LIST ANY OTHER CRITICAL FIXES]

### Files Modified
[LIST ALL FILES CHANGED WITH LINE NUMBERS]

### Lines Removed
Total: ~[COUNT] lines

## Validation Results

### Grep Validation (ALL must be 0)
```bash
grep -rn "cleanRooms" apps/: 0 results ✅
grep -rn "rooms\." apps/: 0 results ✅
grep -rn "GameRoomDefinition" packages/: 0 results ✅
grep -rn "JOIN rooms" apps/: 0 results ✅
grep -rn "room_id" schema.ts: 0 results ✅
```

### Type Checking
```bash
pnpm --filter @escapeplan/contracts build: ✅ SUCCESS
pnpm --filter escapeplan-api lint: ✅ SUCCESS (0 errors)
pnpm --filter escapeplan-web check: ✅ SUCCESS (0 errors)
```

### Runtime Testing
```bash
pnpm run db:seed: ✅ SUCCESS
pnpm --filter escapeplan-api dev: ✅ Started without errors
```

### Manual Testing Results
- [x] Create new game: ✅ SUCCESS
- [x] Quick-start session: ✅ SUCCESS (no room selector)
- [x] View bookings: ✅ SUCCESS (roomName = gameName)

## Issues Encountered
[LIST ANY PROBLEMS AND HOW YOU SOLVED THEM]

## Checklist Status
[COPY THE VALIDATION CHECKLIST ABOVE WITH ALL CHECKMARKS]

## Post-Cleanup Verification
- Total room references remaining: **0** ✅
- Critical bugs fixed: **1** (cleanRooms undefined)
- Tests passing: **ALL** ✅
- Manual testing: **ALL PASS** ✅

## Notes for Next Phase
Rooms removal is now 100% complete. Ready for Phase 2: Pricing System Rebuild.
```

### 2. DO NOT Commit Yet

- ❌ Do NOT commit changes
- ❌ Do NOT push to remote
- ✅ Leave changes staged for validation by claude-gamesettings

### 3. Report Completion

Reply with:
```
✅ ROOMS TABLE FINAL CLEANUP COMPLETE

Initial audit found: X room references
Files modified: X
Lines removed: X
Critical bugs fixed: 1 (cleanRooms undefined in GameModal.svelte)

Validation commands run:
- [x] Grep validation (ALL 0 results) ✅
- [x] Type checking (ALL pass) ✅
- [x] Database schema verification ✅
- [x] Seed test successful ✅
- [x] API startup successful ✅
- [x] Manual testing (3 scenarios) ✅

Session notes: SESSION_50_ROOMS_FINAL_CLEANUP.md
Ready for validation by claude-gamesettings

ZERO room references remain in codebase ✅
```

---

## TROUBLESHOOTING

### Issue: GameModal.svelte still has type errors after removing cleanRooms

**Solution:**
```bash
# Check if SaveGameRequest type still has rooms field
grep -A 20 "export const saveGameSchema" packages/contracts/src/validation.ts

# If rooms field exists, remove it and rebuild
cd packages/contracts
pnpm build

# Then recheck web
cd ../../apps/escapeplan-web
pnpm check
```

### Issue: Quick-start fails with "roomId required"

**Solution:**
```typescript
// Check QuickStartModal.svelte - should NOT have:
const payload = {
  gameId: selectedGameId,
  roomId: selectedRoomId,  // ← DELETE THIS
  partySize
};

// Should have:
const payload = {
  gameId: selectedGameId,
  partySize
};
```

### Issue: Backend query still references room

**Solution:**
```bash
# Find the offending query
grep -n "JOIN rooms\|FROM rooms" apps/escapeplan-api/src/state.ts

# Update to:
# DELETE: JOIN rooms r ON r.id = b.room_id
# CHANGE: r.name as room_name → g.name as room_name
```

---

## SUCCESS CRITERIA

You are DONE when:

1. ✅ ALL 31 validation checklist items have checkmarks
2. ✅ ALL 5 grep searches return 0 results
3. ✅ ALL 3 type-check commands succeed
4. ✅ Seed runs successfully
5. ✅ API starts without errors
6. ✅ ALL 3 manual test scenarios pass
7. ✅ Session notes created with complete audit results
8. ✅ Completion report posted

**Estimated Time:** 3-4 hours
**Your Priority:** ZERO TOLERANCE for remaining room references
**When Stuck:** Re-run grep audit, check ROOMS_TABLE_REMOVAL_PLAN.md

**Remember:** Previous agent claimed completion but left critical bugs. Your job is to be thorough and leave ABSOLUTELY NO TRACES of rooms anywhere in the codebase.

Good luck! Execute with precision and verify EVERYTHING. 🎯
