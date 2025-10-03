# Phase 1: Rooms Table Removal - Agent Execution Prompt

**Agent Role:** Backend Refactoring Specialist
**Session:** Room Table Removal Execution
**Validation By:** claude-gamesettings (will review your work)

---

## YOUR MISSION

Remove the `rooms` table entirely from the EscapePlan database schema. Games ARE rooms - there is no need for a separate entity. You will execute the comprehensive plan in **ROOMS_TABLE_REMOVAL_PLAN.md** with precision and validation.

**Critical Success Factors:**
1. ✅ Follow the plan EXACTLY - no creative deviations
2. ✅ Backup database BEFORE starting
3. ✅ Test incrementally - don't wait until the end
4. ✅ Validate after EACH major change
5. ✅ Use grep to confirm no legacy references remain

---

## REQUIRED READING (Read these files FIRST)

**Base Instructions & Tech Stack:**
1. `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt` - Base project instructions
2. `@escapeplan-app/project-docs/project-tracking/project.yaml` - Tech stack & commands
3. `@escapeplan-app/apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md` - Schema/validation patterns

**Execution Plan:**
4. `@escapeplan-app/project-docs/project-tracking/ROOMS_TABLE_REMOVAL_PLAN.md` - YOUR PRIMARY GUIDE

**Schema Reference:**
5. `@escapeplan-app/packages/contracts/src/schema.ts` - Drizzle database schema
6. `@escapeplan-app/packages/contracts/src/validation.ts` - Zod validation schemas
7. `@escapeplan-app/packages/contracts/src/index.ts` - Type exports

---

## CRITICAL RULES

### DO:
- ✅ Backup database: `cp apps/escapeplan-api/data/escapeplan.db apps/escapeplan-api/data/escapeplan.db.backup`
- ✅ Follow ROOMS_TABLE_REMOVAL_PLAN.md part-by-part (Parts 1-12)
- ✅ Use Drizzle ORM patterns (see API_CONTRACTS_SCHEMA_MANAGEMENT.md)
- ✅ Use Zod schemas for validation (packages/contracts/src/validation.ts)
- ✅ Test after each file change (rebuild contracts, check types)
- ✅ Use grep to validate no `rooms` references remain
- ✅ Generate Drizzle migration with `npx drizzle-kit generate`
- ✅ Document every change you make in your session notes

### DO NOT:
- ❌ Skip the database backup
- ❌ Make changes not in the plan
- ❌ Use raw SQL strings (use Drizzle ORM queries)
- ❌ Create new interfaces manually (use Zod inference: `z.infer<typeof schema>`)
- ❌ Touch files not mentioned in the plan
- ❌ Push changes to remote (local only)
- ❌ Skip validation steps

---

## TECH STACK REQUIREMENTS

**Database Layer:**
- Use **Drizzle ORM v0.44.5+** for all schema changes
- Use **Drizzle-kit v0.31.5+** for migrations
- Schema location: `packages/contracts/src/schema.ts`
- SQLite WAL mode with foreign keys ENABLED

**Validation Layer:**
- Use **Zod** for all API request validation
- Location: `packages/contracts/src/validation.ts`
- Pattern: Define Zod schema → infer TypeScript type
- Example: `export type SaveGameRequest = z.infer<typeof saveGameSchema>;`

**Contract Rebuild:**
```bash
# After EVERY contracts change:
cd packages/contracts
pnpm build

# Verify types in consuming packages:
cd ../../apps/escapeplan-api
pnpm lint
```

---

## EXECUTION WORKFLOW

### Phase 1: Pre-Flight Checks (5 min)

```bash
# 1. Backup database
cp apps/escapeplan-api/data/escapeplan.db apps/escapeplan-api/data/escapeplan.db.backup

# 2. Verify backup exists
ls -lh apps/escapeplan-api/data/escapeplan.db.backup

# 3. Baseline validation
cd project-docs/project-tracking
./project-tracker validate

# 4. Count room references (baseline)
grep -rn "room_id\|roomId" apps/escapeplan-api/src packages/contracts/src | wc -l
# Expected: 43
```

### Phase 2: Database Schema Changes (30 min)

**Follow ROOMS_TABLE_REMOVAL_PLAN.md Part 1:**

1. **Remove `rooms` table from Drizzle schema**
   - File: `packages/contracts/src/schema.ts`
   - Lines: 137-146 (DELETE entire rooms table definition)
   - Update schema export (line ~538, remove `rooms,`)

2. **Remove `bookings.room_id` foreign key**
   - File: `packages/contracts/src/schema.ts`
   - Line: 193 (DELETE `room_id: text('room_id').notNull().references(() => rooms.id),`)

3. **Update init.ts**
   - File: `apps/escapeplan-api/src/db/init.ts`
   - Lines: 107-116 (DELETE CREATE TABLE rooms block)
   - Line: ~175 (DELETE room_id from bookings table)

**VALIDATE:**
```bash
# Rebuild contracts
cd packages/contracts
pnpm build

# Should succeed with 0 errors
```

### Phase 3: Validation Schema Changes (20 min)

**Follow ROOMS_TABLE_REMOVAL_PLAN.md Part 2:**

1. **Remove roomSchema from validation.ts**
   - File: `packages/contracts/src/validation.ts`
   - Lines: 30-39 (DELETE entire roomSchema)

2. **Update saveGameSchema**
   - File: `packages/contracts/src/validation.ts`
   - Find: `rooms: z.array(roomSchema)`
   - Action: DELETE the rooms field

3. **Update quickStartSessionSchema**
   - File: `packages/contracts/src/validation.ts`
   - Find: `roomId: z.string()`
   - Action: DELETE the roomId field

4. **Remove GameRoomDefinition export from index.ts**
   - File: `packages/contracts/src/index.ts`
   - Search for `GameRoomDefinition`
   - DELETE the interface and export

**VALIDATE:**
```bash
cd packages/contracts
pnpm build

# Check for type errors
cd ../../apps/escapeplan-api
pnpm lint
```

### Phase 4: API State Logic (2 hours)

**Follow ROOMS_TABLE_REMOVAL_PLAN.md Part 3:**

This is the MOST COMPLEX part. Work carefully.

1. **Remove room type import (state.ts:29)**
   ```typescript
   // DELETE: GameRoomDefinition,
   ```

2. **Remove room query logic (~lines 600-615)**
   - Find: `SELECT * FROM rooms WHERE game_id = ?`
   - DELETE entire query and mapping block

3. **Remove normalizeRoomInput function (~lines 760-770)**
   - DELETE entire function

4. **Update persistGameRelations function (~lines 843-905)**
   - BEFORE: `function persistGameRelations(gameId: string, rooms: GameRoomDefinition[], puzzles: GamePuzzleDefinition[])`
   - AFTER: `function persistGameRelations(gameId: string, puzzles: GamePuzzleDefinition[])`
   - DELETE all room INSERT/UPDATE/DELETE logic (~60 lines)
   - KEEP puzzle logic unchanged

5. **Update ALL queries with room JOINs (6 locations)**
   - Search: `JOIN rooms r ON r.id = b.room_id`
   - For EACH occurrence:
     - DELETE the JOIN line
     - CHANGE `r.name as room_name` to `g.name as room_name`

   **Locations (use grep to find exact lines):**
   - getDashboard() query
   - getActiveSessionDetails() query
   - executeSessionCommand() - start timer
   - executeSessionCommand() - pause/resume
   - executeSessionCommand() - reset timer
   - getBookingCalendar() query

6. **Update createGameSession function (~lines 1537-1570)**
   - DELETE room validation logic
   - DELETE roomId from booking INSERT statement
   - REMOVE roomId parameter usage

**VALIDATE AFTER EACH CHANGE:**
```bash
pnpm lint
# Fix errors immediately before proceeding
```

### Phase 5: Seed Data & Tests (30 min)

**Follow ROOMS_TABLE_REMOVAL_PLAN.md Parts 4 & 5:**

1. **Update seed.ts**
   - File: `apps/escapeplan-api/src/db/seed.ts`
   - DELETE pirateRooms array definition
   - DELETE room INSERT statement
   - UPDATE booking seed data (remove room_id)

2. **Update tests**
   - `apps/escapeplan-api/src/test-integration.ts` - Remove roomId references
   - `apps/escapeplan-api/test/server.test.ts` - Remove room INSERT, update booking INSERT
   - `apps/escapeplan-api/src/test-logging.ts` - Update mock data

**VALIDATE:**
```bash
cd apps/escapeplan-api
pnpm db:seed
# Should complete without errors
```

### Phase 6: Generate Migration (45 min)

**Follow ROOMS_TABLE_REMOVAL_PLAN.md Part 6:**

```bash
cd apps/escapeplan-api
npx drizzle-kit generate
```

**Expected output:** `drizzle/0006_remove_rooms_table.sql`

**Review migration file:**
- Should drop `bookings.room_id` column
- Should drop `rooms` table
- Should preserve all other data

**Test migration on backup:**
```bash
# Copy backup to test database
cp data/escapeplan.db.backup data/test-escapeplan.db

# Apply migration to test DB
sqlite3 data/test-escapeplan.db < drizzle/0006_remove_rooms_table.sql

# Verify schema
sqlite3 data/test-escapeplan.db ".schema bookings"
# Should NOT have room_id column

sqlite3 data/test-escapeplan.db ".tables"
# Should NOT have rooms table

# If successful, apply to real database
sqlite3 data/escapeplan.db < drizzle/0006_remove_rooms_table.sql
```

### Phase 7: Final Validation (1 hour)

**Follow ROOMS_TABLE_REMOVAL_PLAN.md Part 8:**

```bash
# 1. Code search validation
grep -rn "rooms\." apps/escapeplan-api/src/
# Expected: 0 results

grep -rn "GameRoomDefinition" packages/contracts/src/
# Expected: 0 results

grep -rn "JOIN rooms" apps/escapeplan-api/src/
# Expected: 0 results

grep -rn "room_id" apps/escapeplan-api/src/db/schema.ts
# Expected: 0 results

# 2. Type checking
cd packages/contracts
pnpm build

cd ../../apps/escapeplan-api
pnpm lint

cd ../escapeplan-web
pnpm check

# 3. Database validation
sqlite3 apps/escapeplan-api/data/escapeplan.db ".schema bookings" | grep room_id
# Expected: no output

sqlite3 apps/escapeplan-api/data/escapeplan.db ".tables" | grep rooms
# Expected: no output

# 4. Re-seed database
cd apps/escapeplan-api
pnpm db:seed

# 5. Test API startup
pnpm dev
# Should start without errors (Ctrl+C to stop)
```

---

## VALIDATION CHECKLIST

Before marking complete, verify ALL of these:

### Database Schema
- [ ] `rooms` table does not exist in schema.ts
- [ ] `rooms` table does not exist in database
- [ ] `bookings.room_id` column removed from schema.ts
- [ ] `bookings.room_id` column removed from database
- [ ] Migration file generated (0006_*.sql)
- [ ] Migration applied successfully

### Contracts & Types
- [ ] `GameRoomDefinition` interface removed from all files
- [ ] `roomSchema` removed from validation.ts
- [ ] `SaveGameRequest` no longer has `rooms` field
- [ ] `QuickStartSessionRequest` no longer has `roomId` field
- [ ] Contracts build succeeds: `pnpm --filter @escapeplan/contracts build`

### API State Logic
- [ ] All 6 room JOINs removed from queries
- [ ] All JOINs replaced with `g.name as room_name`
- [ ] `persistGameRelations()` signature updated (no rooms parameter)
- [ ] Room INSERT/UPDATE/DELETE logic removed
- [ ] `createGameSession()` no longer validates/uses roomId
- [ ] API type-checks successfully: `pnpm --filter escapeplan-api lint`

### Seed Data & Tests
- [ ] Room seed data removed
- [ ] Booking seed data updated (no room_id)
- [ ] Test fixtures updated
- [ ] Seed runs successfully: `pnpm run db:seed`

### Code Quality
- [ ] 0 grep results for `rooms\.`
- [ ] 0 grep results for `GameRoomDefinition`
- [ ] 0 grep results for `JOIN rooms`
- [ ] 0 TypeScript errors in affected packages
- [ ] API starts without errors

---

## COMPLETION REQUIREMENTS

### 1. Create Session Notes

Create `project-docs/project-tracking/sessions/SESSION_42_ROOMS_REMOVAL_EXECUTION.md` with:

```markdown
# Session 42: Rooms Table Removal - Execution

**Date:** [DATE]
**Status:** ✅ COMPLETE
**Validation:** Pending (claude-gamesettings)

## Summary
Executed ROOMS_TABLE_REMOVAL_PLAN.md completely. Removed rooms table from entire codebase.

## Changes Made
- Files modified: [LIST ALL 17 FILES]
- Lines removed: ~[COUNT]
- Migration generated: drizzle/0006_remove_rooms_table.sql

## Validation Results
[PASTE ALL VALIDATION COMMAND OUTPUTS]

## Issues Encountered
[LIST ANY PROBLEMS AND HOW YOU SOLVED THEM]

## Checklist Status
[COPY THE VALIDATION CHECKLIST ABOVE WITH CHECKMARKS]
```

### 2. DO NOT Commit Yet

- ❌ Do NOT commit changes
- ❌ Do NOT push to remote
- ✅ Leave changes staged for validation by claude-gamesettings

### 3. Report Completion

Reply with:
```
✅ ROOMS TABLE REMOVAL COMPLETE

Files modified: [COUNT]
Lines removed: [COUNT]
Migration: drizzle/0006_remove_rooms_table.sql

Validation commands run:
- [x] grep validation (0 results)
- [x] Type checking (0 errors)
- [x] Database schema verification
- [x] Seed test successful
- [x] API startup successful

Session notes: SESSION_42_ROOMS_REMOVAL_EXECUTION.md
Ready for validation by claude-gamesettings
```

---

## TROUBLESHOOTING

### Issue: Type errors after removing GameRoomDefinition

**Solution:**
```bash
# Rebuild contracts first
cd packages/contracts
pnpm build

# Then check API
cd ../../apps/escapeplan-api
pnpm lint
```

### Issue: Migration fails with foreign key constraint

**Solution:**
```sql
-- Add to migration file BEFORE recreating bookings:
PRAGMA foreign_keys=OFF;

-- ... table operations ...

-- Add at END of migration:
PRAGMA foreign_keys=ON;
```

### Issue: Seed fails with "column room_id not found"

**Solution:**
- You forgot to update booking INSERT in seed.ts
- Check Part 4 of ROOMS_TABLE_REMOVAL_PLAN.md
- Remove room_id from both columns list and values list

### Issue: Query still references r.name

**Solution:**
- You missed a JOIN rooms query
- Search entire state.ts for `JOIN rooms`
- Update ALL 6 occurrences to use `g.name as room_name`

---

## EMERGENCY ROLLBACK

If you break something critical:

```bash
# Restore database
cp apps/escapeplan-api/data/escapeplan.db.backup apps/escapeplan-api/data/escapeplan.db

# Revert code changes
git checkout .

# Report issue to claude-gamesettings
```

---

## SUCCESS CRITERIA

You are DONE when:
1. ✅ All 21 validation checklist items pass
2. ✅ `pnpm --filter @escapeplan/contracts build` succeeds
3. ✅ `pnpm --filter escapeplan-api lint` succeeds
4. ✅ `pnpm --filter escapeplan-api db:seed` succeeds
5. ✅ `pnpm --filter escapeplan-api dev` starts without errors
6. ✅ Session notes created
7. ✅ Completion report posted

**Estimated Time:** 5-7 hours
**Your Priority:** Precision over speed
**When Stuck:** Re-read ROOMS_TABLE_REMOVAL_PLAN.md section carefully

Good luck! Execute with precision. 🎯
