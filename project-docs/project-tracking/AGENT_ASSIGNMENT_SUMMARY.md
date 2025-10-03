# Agent Assignment Summary - Ready for Execution

**Created:** 2025-10-02
**Session:** 41 (Planning Complete)
**Status:** 🟢 READY FOR AGENT ASSIGNMENT

---

## Quick Start

### Phase 1 Agent (Rooms Removal)

**Give them this file:**
```
@escapeplan-app/project-docs/project-tracking/PHASE1_ROOMS_REMOVAL_AGENT_PROMPT.md
```

**Additional context files:**
- `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt`
- `@escapeplan-app/project-docs/project-tracking/project.yaml`
- `@escapeplan-app/project-docs/project-tracking/ROOMS_TABLE_REMOVAL_PLAN.md`
- `@escapeplan-app/apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md`
- `@escapeplan-app/packages/contracts/src/schema.ts`
- `@escapeplan-app/packages/contracts/src/validation.ts`

**Instructions:**
```
You are the backend refactoring specialist. Your mission is to remove the `rooms` table from the entire codebase by executing ROOMS_TABLE_REMOVAL_PLAN.md with precision. Read PHASE1_ROOMS_REMOVAL_AGENT_PROMPT.md for detailed instructions.

When complete, reply: "Phase 1 complete - ready for validation"
```

---

### Phase 2 Agent (Pricing Tab Rebuild)

**⚠️ DO NOT START UNTIL Phase 1 is validated by claude-gamesettings**

**Give them this file:**
```
@escapeplan-app/project-docs/project-tracking/PHASE2_PRICING_TAB_AGENT_PROMPT.md
```

**Additional context files:**
- `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt`
- `@escapeplan-app/project-docs/project-tracking/project.yaml`
- `@escapeplan-app/project-docs/project-tracking/GAMEMODAL_UI_REFACTORING_PLAN.md`
- `@escapeplan-app/apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md`
- `@escapeplan-app/apps/escapeplan-web/src/lib/components/ui/HelpTooltip.svelte`
- `@escapeplan-app/packages/contracts/src/validation.ts`

**Instructions:**
```
You are the frontend UI specialist. Your mission is to rebuild the GameModal Pricing Tab with modular components supporting all 3 pricing models. Read PHASE2_PRICING_TAB_AGENT_PROMPT.md for detailed instructions.

When complete, reply: "Phase 2 complete - ready for validation"
```

---

## What You (claude-gamesettings) Will Do

### After Phase 1

1. Agent reports completion
2. You review `SESSION_42_ROOMS_REMOVAL_EXECUTION.md`
3. You run validation commands from PHASE1 prompt
4. You check all 21 validation items
5. **If PASS:** Reply "Phase 1 validated ✅ - Phase 2 agent may proceed"
6. **If FAIL:** Reply "Phase 1 issues found ❌" + list issues

### After Phase 2

1. Agent reports completion
2. You review `SESSION_43_PRICING_TAB_REBUILD.md`
3. You manually test all 5 scenarios from PHASE2 prompt
4. You check all 35 validation items
5. **If PASS:** Reply "Phase 2 validated ✅ - Ready for commit"
6. **If FAIL:** Reply "Phase 2 issues found ❌" + list issues

---

## Documents Created This Session

### Planning Documents (Session 41)
1. ✅ `ROOMS_TABLE_REMOVAL_PLAN.md` - Complete execution plan (12 parts, ~500 lines)
2. ✅ `GAMEMODAL_UI_REFACTORING_PLAN.md` - UI rebuild spec (9 parts, ~600 lines)
3. ✅ `SESSION_41_ROOMS_REMOVAL_PLANNING.md` - Session notes

### Agent Prompts (Session 41)
4. ✅ `PHASE1_ROOMS_REMOVAL_AGENT_PROMPT.md` - Backend agent directive prompt
5. ✅ `PHASE2_PRICING_TAB_AGENT_PROMPT.md` - Frontend agent directive prompt
6. ✅ `AGENT_HANDOFF_GUIDE.md` - Quick reference for agent management
7. ✅ `AGENT_ASSIGNMENT_SUMMARY.md` - This file

**Total Documentation:** ~2500 lines across 7 files

---

## File Locations

All files in: `project-docs/project-tracking/`

```
project-docs/project-tracking/
├── prompt-claude.txt                          # Base instructions (existing)
├── project.yaml                                # Tech stack (existing)
├── ROOMS_TABLE_REMOVAL_PLAN.md                 # NEW: Full removal plan
├── GAMEMODAL_UI_REFACTORING_PLAN.md            # NEW: UI rebuild plan
├── PHASE1_ROOMS_REMOVAL_AGENT_PROMPT.md        # NEW: Phase 1 agent prompt ⭐
├── PHASE2_PRICING_TAB_AGENT_PROMPT.md          # NEW: Phase 2 agent prompt ⭐
├── AGENT_HANDOFF_GUIDE.md                      # NEW: Management guide
├── AGENT_ASSIGNMENT_SUMMARY.md                 # NEW: This summary
└── sessions/
    ├── SESSION_40_LOGGING_FIXES.md             # Previous session
    └── SESSION_41_ROOMS_REMOVAL_PLANNING.md    # NEW: This planning session
```

---

## Expected Timeline

| Phase | Task | Agent | Duration | Status |
|-------|------|-------|----------|--------|
| 1 | Rooms Removal | Backend Specialist | 5-7 hours | 🟡 Pending |
| 1a | Validation | claude-gamesettings | 1 hour | 🟡 Pending |
| 2 | Pricing Tab | Frontend Specialist | 6-8 hours | ⏸️ Blocked (needs Phase 1) |
| 2a | Validation | claude-gamesettings | 1 hour | ⏸️ Blocked |
| 3 | Remaining Tabs | Frontend Specialist | 8 hours | ⏸️ Future |
| 3a | Validation | claude-gamesettings | 1 hour | ⏸️ Future |

**Total Estimated Time:** 22-26 hours across 3 phases

---

## Success Metrics

### Phase 1 Success
- ✅ 0 grep results for `rooms.`, `GameRoomDefinition`, `JOIN rooms`
- ✅ Database has no `rooms` table or `bookings.room_id` column
- ✅ Migration applied successfully
- ✅ Seed data runs
- ✅ API starts
- ✅ ~320 lines of code removed

### Phase 2 Success
- ✅ 8 new component files in correct folders
- ✅ 18+ HelpTooltip instances
- ✅ All 3 pricing models work (per_person, per_session, per_hour)
- ✅ All DaisyUI classes standardized
- ✅ Payload matches SaveGameRequest schema
- ✅ GameModal reduced from 2184 → 1900 lines

### Overall Success
- ✅ Cleaner data model (no rooms confusion)
- ✅ Modular UI components (easier to maintain)
- ✅ Enhanced pricing flexibility (3 models + scheduling)
- ✅ Better UX (help tooltips everywhere)
- ✅ Net code reduction: ~500 lines

---

## Key Reminders for Agents

### Phase 1 Agent
1. **BACKUP DATABASE FIRST:** `cp data/escapeplan.db data/escapeplan.db.backup`
2. **Follow plan exactly:** ROOMS_TABLE_REMOVAL_PLAN.md is your bible
3. **Use Drizzle + Zod:** No manual SQL, no manual types
4. **Test incrementally:** Don't wait until end
5. **Validate after each change:** grep + type-check

### Phase 2 Agent
1. **Create folders first:** `tabs/` and `pricing/` subdirectories
2. **Import types from contracts:** `@escapeplan/contracts`
3. **Use HelpTooltip liberally:** 18+ instances required
4. **Follow DaisyUI standards:** See plan Part 3
5. **Test each component:** Standalone before integration

---

## Communication Flow

```
┌──────────────────────┐
│  Phase 1 Agent       │
│  (Backend Specialist)│
└──────────┬───────────┘
           │ "Phase 1 complete"
           ▼
┌──────────────────────┐
│  claude-gamesettings │
│  (Validation)        │
└──────────┬───────────┘
           │ "Phase 1 validated ✅"
           ▼
┌──────────────────────┐
│  Phase 2 Agent       │
│  (Frontend Specialist│
└──────────┬───────────┘
           │ "Phase 2 complete"
           ▼
┌──────────────────────┐
│  claude-gamesettings │
│  (Validation)        │
└──────────┬───────────┘
           │ "Phase 2 validated ✅"
           ▼
┌──────────────────────┐
│  Ready for Commit    │
└──────────────────────┘
```

---

## What's NOT in Scope Yet

**Deferred to Phase 3:**
- Extract GameDetailsTab.svelte
- Extract GameMediaTab.svelte
- Extract GamePuzzlesTab.svelte
- Extract GameBookingTab.svelte
- Extract GameMilestonesTab.svelte
- Full GameModal shell refactor

**Reason:** Want to validate Phases 1-2 first before touching remaining tabs.

---

## Validation Agent Checklist (Your Role)

### When Phase 1 Agent Reports Complete

- [ ] Read their session notes
- [ ] Run grep commands (verify 0 results)
- [ ] Check database schema
- [ ] Run type-check commands
- [ ] Test seed data
- [ ] Test API startup
- [ ] Review migration quality
- [ ] Check all 21 validation items
- [ ] **Decision:** PASS or FAIL (with issues list)

### When Phase 2 Agent Reports Complete

- [ ] Read their session notes
- [ ] Verify folder structure
- [ ] Check all 8 components exist
- [ ] Run type-check
- [ ] Count HelpTooltip usage (18+)
- [ ] Manually test Scenario 1: Per-person tier
- [ ] Manually test Scenario 2: Per-hour tier
- [ ] Manually test Scenario 3: Schedule restrictions
- [ ] Manually test Scenario 4: Deposit config
- [ ] Manually test Scenario 5: Tier reordering
- [ ] Verify DaisyUI consistency
- [ ] Check payload generation
- [ ] Check all 35 validation items
- [ ] **Decision:** PASS or FAIL (with issues list)

---

## Final Notes

- Both agents have **directive prompts** (no ambiguity)
- Both prompts reference **base instructions** (`prompt-claude.txt`, `project.yaml`)
- Both prompts include **comprehensive validation** (21 items for Phase 1, 35 for Phase 2)
- Both prompts include **troubleshooting sections**
- Both prompts require **session notes** creation
- Both prompts **forbid commits** until validation passes

**You (claude-gamesettings) are the quality gatekeeper.** Don't let sloppy work through.

---

**Status:** 🟢 READY TO ASSIGN AGENTS
**Next Action:** Assign Phase 1 agent with PHASE1_ROOMS_REMOVAL_AGENT_PROMPT.md

