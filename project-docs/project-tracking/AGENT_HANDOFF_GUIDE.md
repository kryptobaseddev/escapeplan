# Agent Handoff Guide - Rooms Removal & Pricing Tab Rebuild

**Purpose:** Quick reference for assigning agents to Phase 1 and Phase 2 tasks
**Created:** 2025-10-02
**Owner:** claude-gamesettings (validation agent)

---

## Phase 1: Rooms Table Removal Agent

### Agent Context Files (Pass These)

**Base Instructions:**
1. `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt`
2. `@escapeplan-app/project-docs/project-tracking/project.yaml`

**Execution Prompt (PRIMARY):**
3. `@escapeplan-app/project-docs/project-tracking/PHASE1_ROOMS_REMOVAL_AGENT_PROMPT.md` ⭐

**Supporting Documentation:**
4. `@escapeplan-app/project-docs/project-tracking/ROOMS_TABLE_REMOVAL_PLAN.md`
5. `@escapeplan-app/apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md`

**Schema References (for context):**
6. `@escapeplan-app/packages/contracts/src/schema.ts`
7. `@escapeplan-app/packages/contracts/src/validation.ts`
8. `@escapeplan-app/packages/contracts/src/index.ts`

### Expected Deliverables

- ✅ 17 files modified (database, contracts, API, tests)
- ✅ Migration file: `drizzle/0006_remove_rooms_table.sql`
- ✅ Session notes: `SESSION_42_ROOMS_REMOVAL_EXECUTION.md`
- ✅ All validation checklist items passing (21 items)

### Estimated Time

5-7 hours (1 full session)

### Validation Trigger

Reply in chat when complete:
```
@claude-gamesettings Phase 1 complete - ready for validation
Session: SESSION_42_ROOMS_REMOVAL_EXECUTION.md
```

---

## Phase 2: Pricing Tab Rebuild Agent

### Agent Context Files (Pass These)

**Base Instructions:**
1. `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt`
2. `@escapeplan-app/project-docs/project-tracking/project.yaml`

**Execution Prompt (PRIMARY):**
3. `@escapeplan-app/project-docs/project-tracking/PHASE2_PRICING_TAB_AGENT_PROMPT.md` ⭐

**Supporting Documentation:**
4. `@escapeplan-app/project-docs/project-tracking/GAMEMODAL_UI_REFACTORING_PLAN.md`
5. `@escapeplan-app/apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md`

**Component References (for context):**
6. `@escapeplan-app/apps/escapeplan-web/src/lib/components/ui/HelpTooltip.svelte`
7. `@escapeplan-app/apps/escapeplan-web/src/lib/components/games/GameModal.svelte`

**Schema/Validation (for types):**
8. `@escapeplan-app/packages/contracts/src/validation.ts`
9. `@escapeplan-app/packages/contracts/src/index.ts`

### Expected Deliverables

- ✅ 8 new component files created
- ✅ Clean folder structure: `tabs/` and `pricing/` subdirectories
- ✅ GameModal.svelte updated (pricing tab extracted)
- ✅ Session notes: `SESSION_43_PRICING_TAB_REBUILD.md`
- ✅ All validation checklist items passing (35 items)
- ✅ All 5 testing scenarios passing

### Estimated Time

6-8 hours (1-2 sessions)

### Prerequisites

⚠️ **BLOCKED UNTIL:** Phase 1 complete and validated by claude-gamesettings

### Validation Trigger

Reply in chat when complete:
```
@claude-gamesettings Phase 2 complete - ready for validation
Session: SESSION_43_PRICING_TAB_REBUILD.md
```

---

## Folder Structure Reference

### Phase 1 Creates (Migration)
```
apps/escapeplan-api/
└── drizzle/
    └── 0006_remove_rooms_table.sql  # NEW MIGRATION
```

### Phase 2 Creates (Components)
```
apps/escapeplan-web/src/lib/components/
├── games/
│   ├── tabs/
│   │   └── GamePricingTab.svelte        # NEW
│   └── pricing/
│       ├── DepositConfig.svelte         # NEW
│       ├── TierCard.svelte              # NEW
│       ├── TierModelSelector.svelte     # NEW
│       ├── PerHourFields.svelte         # NEW
│       └── TierScheduleFields.svelte    # NEW
└── ui/
    ├── VolumeSlider.svelte              # NEW
    └── FormField.svelte                 # NEW
```

---

## Validation Agent Tasks (claude-gamesettings)

### After Phase 1 Completion

**Checklist to review:**
1. [ ] Read `SESSION_42_ROOMS_REMOVAL_EXECUTION.md`
2. [ ] Run validation commands:
   ```bash
   grep -rn "rooms\." apps/escapeplan-api/src/
   grep -rn "GameRoomDefinition" packages/contracts/src/
   grep -rn "JOIN rooms" apps/escapeplan-api/src/
   pnpm --filter @escapeplan/contracts build
   pnpm --filter escapeplan-api lint
   ```
3. [ ] Verify database schema:
   ```bash
   sqlite3 apps/escapeplan-api/data/escapeplan.db ".schema bookings" | grep room_id
   sqlite3 apps/escapeplan-api/data/escapeplan.db ".tables" | grep rooms
   ```
4. [ ] Test seed data: `pnpm --filter escapeplan-api db:seed`
5. [ ] Test API startup: `pnpm --filter escapeplan-api dev`
6. [ ] Review migration file quality
7. [ ] Check all 21 validation items in plan

**If PASS:** Approve agent to proceed, unlock Phase 2
**If FAIL:** Document issues, send back to agent for fixes

### After Phase 2 Completion

**Checklist to review:**
1. [ ] Read `SESSION_43_PRICING_TAB_REBUILD.md`
2. [ ] Verify folder structure matches plan
3. [ ] Check all 8 component files exist
4. [ ] Run type-check: `pnpm --filter escapeplan-web check`
5. [ ] Count HelpTooltip usage (should be 18+):
   ```bash
   grep -rn "<HelpTooltip" apps/escapeplan-web/src/lib/components/games/pricing/
   grep -rn "<HelpTooltip" apps/escapeplan-web/src/lib/components/games/tabs/GamePricingTab.svelte
   ```
6. [ ] Manual test all 5 scenarios in prompt
7. [ ] Verify payload generation (create test game)
8. [ ] Check DaisyUI class consistency
9. [ ] Check all 35 validation items in plan

**If PASS:** Approve for commit, plan Phase 3 (remaining tabs)
**If FAIL:** Document issues, send back to agent for fixes

---

## Common Issues & Quick Fixes

### Phase 1 Issues

**Issue:** Type errors after removing GameRoomDefinition
**Fix:** Agent must rebuild contracts first: `pnpm --filter @escapeplan/contracts build`

**Issue:** Migration has foreign key errors
**Fix:** Add `PRAGMA foreign_keys=OFF;` before operations, `PRAGMA foreign_keys=ON;` after

**Issue:** Seed fails with "column room_id not found"
**Fix:** Agent forgot to update booking INSERT in seed.ts (both columns AND values)

### Phase 2 Issues

**Issue:** Can't import GamePricingTier type
**Fix:** Import from contracts: `import type { GamePricingTier } from '@escapeplan/contracts';`

**Issue:** HelpTooltip not found
**Fix:** Check relative import path from component location (use `../../ui/HelpTooltip.svelte`)

**Issue:** $bindable errors
**Fix:** Ensure Svelte 5 syntax, not Svelte 4 (`export let` is old syntax)

---

## Timeline Overview

```
Day 1 Morning:
├─ Phase 1 Agent starts
└─ Estimated completion: EOD

Day 1 Evening:
├─ claude-gamesettings validates Phase 1
├─ If PASS: Unlock Phase 2
└─ If FAIL: Agent fixes overnight

Day 2 Morning:
├─ Phase 2 Agent starts
└─ Estimated completion: EOD or Day 3 morning

Day 2-3:
├─ claude-gamesettings validates Phase 2
├─ If PASS: Plan Phase 3 (remaining tabs)
└─ If FAIL: Agent fixes

Day 3+:
└─ Phase 3: Extract remaining tabs (GameDetailsTab, MediaTab, etc.)
```

---

## Communication Protocol

### Agent Reports to claude-gamesettings

**Start of session:**
```
Starting [Phase 1 | Phase 2]
Session: SESSION_[#]_[NAME].md
Estimated completion: [TIME]
```

**During session (if blocked):**
```
Blocked on: [ISSUE DESCRIPTION]
Attempted fixes: [LIST]
Requesting guidance from claude-gamesettings
```

**End of session:**
```
[Phase 1 | Phase 2] complete
Session notes: SESSION_[#]_[NAME].md
Validation checklist: [X/Y items passing]
Ready for review
```

### claude-gamesettings Reports to User

**After validation:**
```
Phase [1 | 2] validation: [PASS | FAIL]

Summary: [BRIEF DESCRIPTION]

Issues found: [COUNT]
[LIST ISSUES IF ANY]

[If PASS] Approved for [next phase | commit]
[If FAIL] Sent back to agent with fixes needed
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-02
**Next Review:** After Phase 2 completion

