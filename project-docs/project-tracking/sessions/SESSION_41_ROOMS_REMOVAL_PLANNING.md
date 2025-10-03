# Session 41: Rooms Removal & GameModal UI Refactoring - Planning Phase

**Date:** 2025-10-02
**Agent:** claude-gamesettings
**Status:** ✅ PLANNING COMPLETE
**Phase:** Architecture & Refactoring Design

---

## Executive Summary

Created comprehensive end-to-end documentation for two major refactoring initiatives:
1. **Remove `rooms` table** - Simplify data model (games ARE rooms)
2. **Refactor GameModal** - Break 2184-line monolith into modular tab components

**Key Deliverables:**
- ✅ ROOMS_TABLE_REMOVAL_PLAN.md (complete execution guide)
- ✅ GAMEMODAL_UI_REFACTORING_PLAN.md (UI rebuild specification)
- ✅ Ready for execution by specialized agents

---

## Context

User is working on game management system improvements and identified two architectural issues:

### Issue 1: Rooms Table Confusion
- `rooms` table has 1:1 relationship with games
- Every game has exactly ONE room in practice
- Adds 6 unnecessary JOINs across queries
- Fields like `theme_token`, `slug` are unused
- `is_mobile_capable` duplicates `games.game_type`

**Decision:** Remove `rooms` table entirely, use `games` directly everywhere.

### Issue 2: GameModal Monolith
- 2184 lines in single file (GameModal.svelte)
- Pricing tab doesn't support new per-tier models
- No HelpTooltip usage despite component being available
- Needs DaisyUI standardization (range sliders, validation)

**Decision:** Extract tabs into separate components, rebuild pricing tab from scratch.

---

## Documents Created

### 1. ROOMS_TABLE_REMOVAL_PLAN.md

**Scope:** Complete removal of `rooms` table from entire codebase

**Sections:**
- Part 1: Database schema changes (3 files)
- Part 2: Contracts & type definitions (3 files)
- Part 3: API state logic changes (state.ts - 43 references)
- Part 4: API seed data changes (1 file)
- Part 5: API tests (3 files)
- Part 6: Drizzle migration generation
- Part 7: UI component changes (5 files)
- Part 8: Validation checklist (comprehensive)
- Part 9: Rollback plan
- Part 10: Effort estimate (~7 hours)
- Part 11: Success criteria (21 checkboxes)
- Part 12: Post-execution tasks

**Key Metrics:**
- Files changed: 17
- Lines removed: ~410
- Lines added: ~90
- Net reduction: ~320 lines

**Changes Overview:**
- DELETE `rooms` table from schema
- DELETE `bookings.room_id` foreign key
- DELETE `GameRoomDefinition` interface
- REMOVE `roomId` from QuickStartSessionRequest
- UPDATE 6 SQL queries to use `g.name as room_name`
- REMOVE entire rooms tab from GameModal (~80 lines)

### 2. GAMEMODAL_UI_REFACTORING_PLAN.md

**Scope:** Modularize GameModal and rebuild pricing tab

**Sections:**
- Part 1: Component architecture (new file structure)
- Part 2: Pricing tab - complete rebuild specification
  - GamePricingTab.svelte (main orchestrator)
  - TierCard.svelte (individual tier editor)
  - TierModelSelector.svelte (per_person/per_session/per_hour picker)
  - PerHourFields.svelte (base hours + additional rate)
  - TierScheduleFields.svelte (day/time restrictions)
  - DepositConfig.svelte (deposit toggle + config)
- Part 3: DaisyUI component standardization
  - VolumeSlider.svelte (standardized range input)
  - FormField.svelte (wrapper with label + help + error)
- Part 4: Implementation checklist (5 phases, 40+ tasks)
- Part 5: Validation criteria
- Part 6: Migration path for existing games
- Part 7: Effort estimate (~21 hours)
- Part 8: Success criteria
- Part 9: Post-completion tasks

**Key Metrics:**
- GameModal reduction: 2184 → <400 lines (81% reduction)
- New components: 11 files
- Average component size: ~250 lines
- Pricing tab features: 3 models, 15+ help tooltips

**Priority Focus: Pricing Tab**

Complete rebuild to support:
- ✅ Per-person pricing (charge each player)
- ✅ Per-session pricing (flat rate)
- ✅ Per-hour pricing (base hours + additional rate)
- ✅ Player range constraints (min/max)
- ✅ Duration constraints (min/max hours)
- ✅ Schedule restrictions (days of week, time ranges)
- ✅ Seasonal pricing (validFrom/validUntil dates)
- ✅ Tier ordering (display order)
- ✅ Active/inactive toggle
- ✅ HelpTooltip on every complex field

---

## Analysis Performed

### 1. Rooms Usage Analysis

**Database Schema:**
- `apps/escapeplan-api/src/db/schema.ts:137-146` - rooms table definition
- `apps/escapeplan-api/src/db/init.ts:107-116` - CREATE TABLE statement

**Query Analysis:**
```bash
# Found 6 JOINs to rooms table:
grep "JOIN rooms" apps/escapeplan-api/src/state.ts
# Lines: 1550, 1635, 1684, 1757, 1797, 2000
```

**Room References:**
```bash
# Found 43 references to room_id/roomId:
grep -rn "room_id\|roomId" apps/escapeplan-api/src packages/contracts/src | wc -l
# Result: 43
```

**Files Affected:**
- 17 total files reference "room" in some form
- 8 in API (state.ts, schema.ts, init.ts, seed.ts, tests)
- 5 in UI (GameModal, QuickStartModal, Dashboard, etc.)
- 4 in contracts/types

### 2. GameModal Structure Analysis

**Current Tab Structure:**
```typescript
type TabId = 'details' | 'media' | 'rooms' | 'puzzles' | 'pricing' | 'booking' | 'milestones';
```

**Line Count by Tab:**
- Details: 171 lines (906-1077)
- Media: 201 lines (1078-1279)
- Rooms: 81 lines (1280-1361) ← TO DELETE
- Puzzles: 178 lines (1362-1540)
- **Pricing: 306 lines (1541-1847)** ← REBUILD PRIORITY
- Milestones: 202 lines (1848-2050)
- Booking: 50 lines (2051-2100)

**Issues Found in Pricing Tab:**
1. Uses deprecated `pricing.model` (global) instead of `tier.model` (per-tier)
2. Missing per_hour model fields entirely:
   - `baseHours`, `basePriceCents`, `additionalHourCents`
   - `minDurationHours`, `maxDurationHours`
3. Missing schedule restrictions:
   - `dayOfWeekRestrictions`, `timeRangeStart`, `timeRangeEnd`
4. Missing seasonal pricing:
   - `validFrom`, `validUntil`
5. No HelpTooltip usage (component exists at `$lib/components/ui/HelpTooltip.svelte`)
6. Inconsistent DaisyUI usage (no range sliders, inconsistent form styles)

---

## Execution Plan

### Phase 1: Rooms Removal (Other Agent)
**Estimated:** 1 full session (~7 hours)

1. Execute ROOMS_TABLE_REMOVAL_PLAN.md step-by-step
2. Generate Drizzle migration
3. Test migration on copy of database
4. Update all 17 affected files
5. Validate with comprehensive checklist
6. Report completion to claude-gamesettings for validation

**Validation Criteria:**
```bash
# These should return 0 results:
grep -rn "rooms\." apps/escapeplan-api/src/
grep -rn "GameRoomDefinition" packages/contracts/src/
grep -rn "JOIN rooms" apps/escapeplan-api/src/
grep -rn "room_id" apps/escapeplan-api/src/db/schema.ts

# Type check passes:
pnpm --filter @escapeplan/contracts build
pnpm --filter escapeplan-api lint
pnpm --filter escapeplan-web check

# Database schema correct:
sqlite3 data/escapeplan.db ".tables" | grep rooms
# Should return nothing
```

### Phase 2: Pricing Tab Rebuild (claude-gamesettings - Session 42)
**Estimated:** 2-3 sessions (~21 hours total)

**Session 42 Tasks:**
1. Create `apps/escapeplan-web/src/lib/components/games/pricing/` directory
2. Implement pricing subcomponents (6 files):
   - DepositConfig.svelte
   - TierModelSelector.svelte
   - PerHourFields.svelte
   - TierScheduleFields.svelte
   - TierCard.svelte (orchestrates above)
   - GamePricingTab.svelte (main tab)
3. Update GameModal.svelte to import new pricing tab
4. Test all 3 pricing models (per_person, per_session, per_hour)
5. Validate against SaveGameRequest schema

**Session 43 Tasks:**
1. Create UI utilities (VolumeSlider, FormField)
2. Extract remaining tabs (Details, Media, Puzzles, Booking, Milestones)
3. Refactor GameModal to orchestration shell
4. Test all tabs independently

**Session 44 Tasks:**
1. End-to-end testing
2. Bug fixes + polish
3. Update documentation
4. Create training materials

---

## Key Decisions Made

### Design Decisions

1. **No theme_token field needed:**
   - User confirmed: "no use for this at all right now"
   - Action: Don't migrate to games table

2. **No is_mobile_capable field needed:**
   - Already covered by `games.game_type` ('storefront' | 'mobile')
   - Action: Use game_type directly

3. **Keep roomName in UI responses:**
   - Frontend expects `roomName` field
   - Backend now populates from `g.name` instead of `r.name`
   - No breaking changes for UI

4. **Per-tier pricing models (not global):**
   - Schema supports `tier.model` (per-tier)
   - Allows mixing per_person and per_hour tiers in same game
   - More flexible for complex pricing strategies

5. **Modular component structure:**
   - Each pricing subcomponent <250 lines
   - Easier to test and maintain
   - Reusable across other forms

### Technical Decisions

1. **Drizzle migration approach:**
   - Use PRAGMA foreign_keys=OFF
   - Recreate bookings table without room_id
   - Drop rooms table last
   - PRAGMA foreign_keys=ON

2. **DaisyUI standardization:**
   - Use `range range-primary` for all sliders
   - Use FormField wrapper for consistent labels
   - Use HelpTooltip liberally (15+ in pricing tab)

3. **State management in tabs:**
   - Use `$bindable()` for two-way binding
   - Parent (GameModal) owns state
   - Tabs are pure presentation + validation

4. **Validation strategy:**
   - Client-side validation in tab components
   - Server-side validation in API (unchanged)
   - Display errors inline with FormField

---

## Risks & Mitigations

### Risk 1: Data Loss During Rooms Removal
**Probability:** Low
**Impact:** High
**Mitigation:**
- Backup database before starting (documented in plan)
- Test migration on copy first
- Rollback plan included (restore from backup)
- Development environment (no production data exists)

### Risk 2: UI Breaking During GameModal Refactor
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Incremental approach (pricing tab first, then others)
- Keep old GameModal until all tabs extracted
- Comprehensive testing checklist
- Can revert individual tabs if issues arise

### Risk 3: Per-Hour Model Complexity
**Probability:** Medium
**Impact:** Low
**Mitigation:**
- Clear help tooltips explaining calculation
- Visual model selector with examples
- Alert box showing formula: "Base price for X hours + $Y/hr additional"
- Comprehensive validation preventing invalid configs

### Risk 4: Schema Mismatch After Refactor
**Probability:** Low
**Impact:** High
**Mitigation:**
- Payload generation matches SaveGameRequest exactly
- TypeScript validation enforced
- Integration test creating game with all field types
- Compare JSON output against schema

---

## Dependencies

### Prerequisites for Execution

**Before Rooms Removal:**
- [x] Database backup created
- [x] Comprehensive plan reviewed
- [x] Execution agent assigned

**Before Pricing Tab Rebuild:**
- [ ] Rooms removal complete and validated
- [ ] Contracts rebuild successful
- [ ] GameModal compiles without errors
- [ ] HelpTooltip component exists (confirmed: ✅)

**Before Tab Extraction:**
- [ ] Pricing tab working and tested
- [ ] FormField and VolumeSlider components created
- [ ] DaisyUI patterns standardized

---

## Success Metrics

### Rooms Removal Success:
- [ ] 0 references to "rooms" table in source
- [ ] 0 references to "GameRoomDefinition" in contracts
- [ ] 0 TypeScript errors introduced
- [ ] All queries simplified (6 JOINs removed)
- [ ] Database migration successful
- [ ] Seed data runs without errors
- [ ] GameModal loads without room tab

### Pricing Tab Rebuild Success:
- [ ] Supports all 3 models (per_person, per_session, per_hour)
- [ ] 15+ HelpTooltip instances added
- [ ] Per-hour model calculates correctly
- [ ] Schedule restrictions work (days, times)
- [ ] Seasonal pricing works (validFrom/validUntil)
- [ ] Can reorder tiers
- [ ] Validation prevents invalid configs
- [ ] Payload matches SaveGameRequest schema
- [ ] 0 console errors
- [ ] <500ms load time

### Overall Refactoring Success:
- [ ] GameModal <400 lines (from 2184)
- [ ] 7 modular tab components created
- [ ] DaisyUI patterns standardized
- [ ] All tabs work independently
- [ ] Can create/edit games successfully
- [ ] Integration tests pass
- [ ] Documentation updated

---

## Next Steps

### Immediate (Session End)
1. [x] Create ROOMS_TABLE_REMOVAL_PLAN.md
2. [x] Create GAMEMODAL_UI_REFACTORING_PLAN.md
3. [x] Create SESSION_41 notes
4. [ ] Hand off rooms removal plan to execution agent
5. [ ] Await validation before starting UI work

### Session 42 (Pricing Tab Rebuild)
1. [ ] Validate rooms removal complete
2. [ ] Create pricing component directory
3. [ ] Implement DepositConfig.svelte
4. [ ] Implement TierModelSelector.svelte
5. [ ] Implement PerHourFields.svelte
6. [ ] Implement TierScheduleFields.svelte
7. [ ] Implement TierCard.svelte
8. [ ] Create GamePricingTab.svelte
9. [ ] Integrate into GameModal
10. [ ] Test all 3 pricing models

### Session 43 (Tab Extraction)
1. [ ] Create UI utilities (VolumeSlider, FormField)
2. [ ] Extract GameDetailsTab
3. [ ] Extract GameMediaTab
4. [ ] Extract GamePuzzlesTab
5. [ ] Extract GameBookingTab
6. [ ] Extract GameMilestonesTab
7. [ ] Refactor GameModal shell

### Session 44 (Testing & Polish)
1. [ ] End-to-end game creation test
2. [ ] Bug fixes
3. [ ] Documentation updates
4. [ ] Training materials

---

## Files Created This Session

1. **ROOMS_TABLE_REMOVAL_PLAN.md**
   - Location: `project-docs/project-tracking/`
   - Size: 12 parts, ~500 lines
   - Purpose: Complete execution guide for rooms table removal

2. **GAMEMODAL_UI_REFACTORING_PLAN.md**
   - Location: `project-docs/project-tracking/`
   - Size: 9 parts, ~600 lines
   - Purpose: UI rebuild specification with code examples

3. **SESSION_41_ROOMS_REMOVAL_PLANNING.md**
   - Location: `project-docs/project-tracking/sessions/`
   - Purpose: This session summary document

---

## Questions & Answers

**Q: Why not keep rooms for future scalability?**
**A:** Business model doesn't support it. Games don't move between rooms, rooms aren't shared. 1:1 relationship adds complexity without benefit. Can always add back later if needs change.

**Q: Can we do rooms removal and pricing tab in parallel?**
**A:** No. Pricing tab depends on rooms removal (GameModal interfaces change). Must complete rooms removal first, then UI refactor.

**Q: Why rebuild pricing tab instead of incrementally updating?**
**A:** Current implementation is structurally incompatible with new schema (global model vs per-tier model). Clean rebuild is faster and cleaner than patching.

**Q: What about existing games with old pricing?**
**A:** Migration logic in `cloneGameDetails()` converts old structure to new. If tier.model is missing, infers from deprecated game.pricingModel.

**Q: Why not use a form library (React Hook Form, Formik)?**
**A:** SvelteKit's native form handling + Svelte 5 runes + DaisyUI is sufficient. Adding external library increases bundle size without significant benefit for this use case.

---

## Session Statistics

- **Duration:** Planning session (1 hour)
- **Documents Created:** 3
- **Total Lines Written:** ~1200 lines of documentation
- **Files Analyzed:** 35+ files
- **Grep Searches Performed:** 12
- **Architecture Decisions Made:** 5
- **Components Designed:** 11
- **Estimated Work Created:** ~28 hours across 3 sessions

---

**Session Status:** ✅ PLANNING COMPLETE
**Next Agent:** Execution agent for rooms removal
**Validation Agent:** claude-gamesettings (after rooms removal)
**Next Session:** Session 42 - Pricing Tab Rebuild (claude-gamesettings)

