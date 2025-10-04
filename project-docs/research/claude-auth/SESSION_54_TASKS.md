# Session 54 Task List: Hybrid A Implementation + Critical Bug Fixes

**Document Purpose:** Comprehensive atomic task breakdown for implementing Hybrid A architecture decision AND fixing all critical bugs reported by user.

**Created:** 2025-10-03

**Status:** Ready for Execution

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Context](#2-architecture-context)
3. [Track 1: Hybrid A Implementation](#3-track-1-hybrid-a-implementation)
4. [Track 2: Critical Bug Fixes](#4-track-2-critical-bug-fixes)
5. [Track 3: Testing & Validation](#5-track-3-testing--validation)
6. [Execution Order](#6-execution-order)
7. [Atomic Task Templates](#7-atomic-task-templates)
8. [Dependencies Map](#8-dependencies-map)
9. [Success Criteria](#9-success-criteria)

---

## 1. Executive Summary

### 1.1 Session 54 Objectives

**Primary Goals:**
1. ✅ Implement Hybrid A architecture decision (cloud-ready schema changes)
2. ✅ Fix 4 critical bugs blocking production use
3. ✅ Validate all changes with comprehensive testing
4. ✅ Maintain 100% backward compatibility

**Architecture Decision Reference:** ADR-001 (Hybrid A - Schema NOW, Features LATER)

### 1.2 Work Breakdown

| Track | Tasks | Effort | Priority |
|-------|-------|--------|----------|
| **Track 1: Hybrid A** | 6 tasks | 12-16 hours | HIGH |
| **Track 2: Bug Fixes** | 8 tasks | 8-12 hours | CRITICAL |
| **Track 3: Testing** | 4 tasks | 8-10 hours | HIGH |
| **Total** | 18 tasks | 28-38 hours | - |

**Timeline:** 4-5 days with 1 developer, 2-3 days with 2 developers (parallelization)

### 1.3 Critical Bugs to Fix

| Bug | Endpoint | Impact | Priority |
|-----|----------|--------|----------|
| **Bug 1** | PUT `/admin/games/:id` | Cannot save game settings | CRITICAL |
| **Bug 2** | POST `/admin/roles` | Cannot create roles with null description | HIGH |
| **Bug 3** | PATCH `/admin/alert-rules/:id` | 404 on alert toggle (double `/api/api/`) | MEDIUM |
| **Bug 4** | POST `/admin/backups` | Backups missing from UI, no restore | HIGH |

---

## 2. Architecture Context

### 2.1 System Architecture

**Techstack:**
- Better Auth v1.3.24+ (authentication & RBAC)
- Drizzle ORM (database layer)
- SQLite WAL (data persistence)
- Fastify 5 (API server)
- SvelteKit 2 (PWA frontend)

**Current State:**
- Offline-first Pi appliance
- Single-tenant architecture (1 Pi = 1 business)
- Database-driven RBAC system
- 100% local operations (no cloud dependency)

**Target State (Phase 0 - MVP with Cloud-Ready Schema):**
- Add 16 cloud metadata columns (all nullable, unused)
- Create `hub_config` table for future cloud linking
- Maintain single-tenant MVP functionality
- Zero breaking changes to existing features

### 2.2 Hybrid A Decision (ADR-001)

**What We're Adding NOW (Phase 0):**
- ✅ `cloud_id` TEXT (nullable) to 8 core tables
- ✅ `cloud_hub_id` TEXT (nullable) to 8 core tables
- ✅ Single-column index on `cloud_id` for each table
- ✅ `hub_config` table with cloud registration placeholders

**What We're DEFERRING to Cloud Phase (6-12 months):**
- ❌ Full sync metadata (7 additional fields per table)
- ❌ Organization tables (`organizations`, `organization_members`)
- ❌ Better Auth organization plugin
- ❌ Cloud sync engine implementation

**Rationale:**
- Best ROI: 37.6% vs -71.1% for full defer
- No migration pain: Schema correct from day 1
- Minimal MVP delay: 2 weeks vs 13-14 weeks for full multi-tenant
- Future-proof: Cloud features build on stable foundation

### 2.3 Hard Rules (ZERO EXCEPTIONS)

**Rule 1: ONE_TASK_ONE_PURPOSE**
- Each task = 2-4 hours max
- Single responsibility, clear boundaries
- If task >4 hours → decompose further

**Rule 2: ZERO_PLACEHOLDERS**
- ❌ NO TODO, FIXME, pass, NotImplementedError, stubs
- ❌ NO "This will be implemented later"
- ✅ ONLY production-ready code

**Rule 3: FULL_CONTEXT_REQUIRED**
- Every task receives complete context
- Techstack, architecture, requirements explicit
- Zero ambiguity in instructions

**Rule 4: VALIDATE_EVERYTHING**
- Implementation → QA (8 checks) → Fix (max 3 attempts) → Escalate
- ALL 8 checks must pass

**Rule 5: NO_ASSUMPTIONS**
- If unclear → Ask human
- If conflicting → Escalate
- Follow instructions EXACTLY as written

---

## 3. Track 1: Hybrid A Implementation

### Task 1.1: Schema Design - Cloud Metadata Fields

**Task ID:** S54-T1.1

**Title:** Design cloud-ready schema additions (16 columns)

**Context:**
- **Techstack:** Drizzle ORM, SQLite WAL, TypeScript
- **Architecture:** Offline-first single-tenant MVP, future cloud sync
- **Project:** EscapePlan escape room management system
- **Current State:** Schema at `packages/contracts/src/schema.ts` has 8 core tables without cloud fields
- **Decision:** ADR-001 Hybrid A - add minimal cloud fields NOW, defer full sync to Phase 2

**Instruction:**
Design cloud metadata field additions for 8 core tables following ADR-001 specifications. Update Drizzle schema with cloud-ready fields that are nullable and unused in MVP.

**Requirements:**
1. Add 2 fields to each of 8 tables: `bookings`, `sessions`, `games`, `user`, `discountCodes`, `assets`, `systemHealth`, `backups`
   - `cloud_id: text('cloud_id')` (nullable, no default)
   - `cloud_hub_id: text('cloud_hub_id')` (nullable, no default)
2. Add single-column index `idx_{table}_cloud_id` for each table
3. All fields must be nullable (accept NULL values)
4. Add inline comments: `// Cloud sync readiness - Phase 0 placeholder (unused until cloud phase)`

**Constraints:**
- NO stubs or placeholders beyond schema definitions
- Use Drizzle ORM schema patterns from existing tables
- All cloud fields default to NULL (not populated in MVP)
- Must be backward compatible (existing queries work unchanged)
- Follow naming convention: snake_case for columns, camelCase for TypeScript

**Acceptance Criteria:**
- [ ] 16 columns added (2 × 8 tables) with correct Drizzle types
- [ ] 8 indexes added (1 per table) using `index()` helper
- [ ] All cloud fields nullable and documented
- [ ] Schema compiles without TypeScript errors
- [ ] Existing table definitions unchanged (no breaking changes)
- [ ] All 8 QA checks pass (see Section 9)

**Deliverables:**
- **File:** `packages/contracts/src/schema.ts` (updated with cloud fields)
- **Format:** TypeScript Drizzle schema

**Dependencies:**
- **Read:** Current schema at `packages/contracts/src/schema.ts`
- **Reference:** ADR-001 Section 2.2 (MVP Phase implementation)
- **Reference:** ADR-001 Section 10.1 (Schema updates example)

**Estimated Effort:** 2-3 hours

---

### Task 1.2: Hub Config Table Creation

**Task ID:** S54-T1.2

**Title:** Create `hub_config` table for cloud registration metadata

**Context:**
- **Techstack:** Drizzle ORM, SQLite WAL, TypeScript
- **Architecture:** Offline-first single-tenant MVP, future cloud sync
- **Project:** EscapePlan escape room management system
- **Current State:** No hub configuration table exists
- **Decision:** ADR-001 requires `hub_config` table for cloud org linking

**Instruction:**
Create new `hub_config` table in Drizzle schema for storing hub-level configuration and cloud linking metadata. Table will have single row with id='default'.

**Requirements:**
1. Create `hub_config` table with following fields:
   - `id: text('id').primaryKey()` (single row with id='default')
   - `cloud_organization_id: text('cloud_organization_id')` (NULL in Phase 0)
   - `cloud_hub_id: text('cloud_hub_id')` (NULL in Phase 0)
   - `sync_enabled: integer('sync_enabled', { mode: 'boolean' }).default(false)`
   - `last_sync_at: text('last_sync_at')` (ISO timestamp, nullable)
   - `created_at: text('created_at').notNull().default(sql\`CURRENT_TIMESTAMP\`)`
   - `updated_at: text('updated_at').notNull().default(sql\`CURRENT_TIMESTAMP\`)`
2. Add table to schema exports
3. Document purpose with inline comments

**Constraints:**
- Table name must be `hub_config` (singular, not plural)
- All cloud fields nullable (not populated in MVP)
- Use existing timestamp pattern (TEXT with ISO 8601)
- Follow Drizzle schema patterns from other tables
- NO additional fields beyond specified (defer license key to Phase 1)

**Acceptance Criteria:**
- [ ] `hub_config` table created with 7 fields
- [ ] Table exported from schema.ts
- [ ] Inline comments explain Phase 0 placeholder purpose
- [ ] Schema compiles without errors
- [ ] Table follows naming conventions (snake_case)
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `packages/contracts/src/schema.ts` (updated with hub_config table)
- **Format:** TypeScript Drizzle schema

**Dependencies:**
- **Builds on:** Task 1.1 (schema design)
- **Reference:** ADR-001 Section 10.1 (hub_config schema example)
- **Reference:** CLOUD_GROWTH_ROADMAP.md Section 3.2.2 (hub_config specification)

**Estimated Effort:** 1-2 hours

---

### Task 1.3: Database Migration - Apply Schema Changes

**Task ID:** S54-T1.3

**Title:** Apply cloud-ready schema changes via Drizzle push

**Context:**
- **Techstack:** Drizzle ORM, SQLite WAL, Drizzle Kit
- **Architecture:** Offline-first single-tenant MVP
- **Project:** EscapePlan escape room management system
- **Current State:** Schema updated in Task 1.1-1.2, not yet applied to database
- **Migration Strategy:** Push-only workflow (no migrations directory)

**Instruction:**
Apply cloud-ready schema changes to SQLite database using `drizzle-kit push`. Verify migration succeeds and all new columns/indexes are created correctly.

**Requirements:**
1. Rebuild contracts package: `pnpm --filter @escapeplan/contracts build`
2. Apply schema: `cd apps/escapeplan-api && npx drizzle-kit push`
3. Verify migration success via SQLite inspection:
   - Check `bookings` table has `cloud_id` and `cloud_hub_id` columns
   - Check `hub_config` table exists with 7 columns
   - Verify indexes created: `idx_bookings_cloud_id`, etc.
4. Test backward compatibility: existing queries work unchanged

**Constraints:**
- Use Drizzle push-only workflow (NO manual SQL migrations)
- NO data loss (migration is additive only)
- All existing data preserved (no schema changes to existing columns)
- Migration must be idempotent (safe to re-run)
- NO breaking changes to existing API queries

**Acceptance Criteria:**
- [ ] Contracts package rebuilds successfully
- [ ] `drizzle-kit push` completes without errors
- [ ] 16 new columns added (verified via `PRAGMA table_info(bookings)`)
- [ ] 8 new indexes created (verified via `PRAGMA index_list(bookings)`)
- [ ] `hub_config` table exists with 7 columns
- [ ] Existing test data intact (no data loss)
- [ ] All 8 QA checks pass

**Deliverables:**
- **Artifact:** Updated SQLite database at `apps/escapeplan-api/data/escapeplan.db`
- **Log:** Migration output from `drizzle-kit push`
- **Verification:** SQLite schema dump showing new columns/indexes

**Dependencies:**
- **Requires:** Task 1.1 (schema design complete)
- **Requires:** Task 1.2 (hub_config table defined)
- **Reference:** CLAUDE.md (Database Management section)

**Estimated Effort:** 1-2 hours

---

### Task 1.4: Hub Config Initialization

**Task ID:** S54-T1.4

**Title:** Initialize hub_config table with default row

**Context:**
- **Techstack:** Drizzle ORM, SQLite, TypeScript
- **Architecture:** Offline-first single-tenant MVP
- **Project:** EscapePlan escape room management system
- **Current State:** `hub_config` table exists but empty
- **Requirement:** Single row with id='default' must exist for API queries

**Instruction:**
Add seed logic to initialize `hub_config` table with default row. Ensure row exists on fresh installs and existing deployments.

**Requirements:**
1. Update seed script at `apps/escapeplan-api/src/db/seed.ts`
2. Add hub_config initialization:
   ```typescript
   await db.insert(hub_config).values({
     id: 'default',
     sync_enabled: false
   }).onConflictDoNothing();
   ```
3. Ensure idempotent (safe to re-run on existing database)
4. All cloud fields default to NULL (Phase 0 behavior)

**Constraints:**
- Use Drizzle `onConflictDoNothing()` for idempotency
- NO hardcoded cloud IDs (all NULL in Phase 0)
- Follow existing seed script patterns
- Must work on fresh install AND existing database upgrade

**Acceptance Criteria:**
- [ ] Seed script updated with hub_config initialization
- [ ] Default row created with id='default'
- [ ] All cloud fields NULL as expected
- [ ] Idempotent execution (no errors on re-run)
- [ ] Works on fresh database (tested via `pnpm db:seed`)
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `apps/escapeplan-api/src/db/seed.ts` (updated)
- **Test:** Run `pnpm --filter escapeplan-api db:seed` successfully

**Dependencies:**
- **Requires:** Task 1.3 (migration applied)
- **Reference:** Existing seed patterns in `seed.ts`

**Estimated Effort:** 1 hour

---

### Task 1.5: API Stub Endpoints - Cloud Status

**Task ID:** S54-T1.5

**Title:** Create stub API endpoints for cloud sync status

**Context:**
- **Techstack:** Fastify 5, TypeScript, Drizzle ORM
- **Architecture:** Offline-first single-tenant MVP
- **Project:** EscapePlan escape room management system
- **Current State:** No cloud sync endpoints exist
- **Requirement:** Stub endpoints return "disabled" state for Phase 0

**Instruction:**
Create stub API endpoints for cloud sync status and hub config. Endpoints return default/disabled state in Phase 0, ready for Phase 2 implementation.

**Requirements:**
1. Add to `apps/escapeplan-api/src/index.ts`:
   ```typescript
   // GET /api/sync/status - Cloud sync status (stub for Phase 0)
   api.get('/sync/status', async (request, reply) => {
     const session = await ensureAuth(request, reply);
     if (!session) return;

     const config = await db.select().from(hub_config).where(eq(hub_config.id, 'default')).limit(1);

     return {
       sync_enabled: config[0]?.sync_enabled ?? false,
       cloud_hub_id: config[0]?.cloud_hub_id ?? null,
       cloud_org_id: config[0]?.cloud_organization_id ?? null,
       last_sync_at: config[0]?.last_sync_at ?? null,
       pending_sync_counts: {} // Empty in Phase 0
     };
   });

   // GET /api/admin/hub/config - Hub configuration (stub for Phase 0)
   api.get('/admin/hub/config', async (request, reply) => {
     const session = await ensureAuth(request, reply);
     if (!session) return;
     if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_system')) return;

     const config = await db.select().from(hub_config).where(eq(hub_config.id, 'default')).limit(1);

     return config[0] ?? { id: 'default', sync_enabled: false };
   });
   ```

2. Import `hub_config` table from contracts
3. Add inline comments documenting Phase 0 stub behavior

**Constraints:**
- NO actual sync logic (stubs only)
- Return types must match future Phase 2 implementation
- All endpoints require authentication
- Follow existing API patterns (ensureAuth, error handling)
- NO mock data beyond default NULL/false values

**Acceptance Criteria:**
- [ ] 2 stub endpoints added to index.ts
- [ ] GET `/api/sync/status` returns disabled state
- [ ] GET `/api/admin/hub/config` returns default config
- [ ] Endpoints require authentication
- [ ] Inline comments document stub purpose
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `apps/escapeplan-api/src/index.ts` (updated with stub endpoints)
- **Test:** Manual curl test confirms 200 response with disabled state

**Dependencies:**
- **Requires:** Task 1.4 (hub_config row exists)
- **Reference:** Existing API patterns in index.ts

**Estimated Effort:** 2 hours

---

### Task 1.6: Documentation - Cloud Readiness

**Task ID:** S54-T1.6

**Title:** Document cloud-ready schema changes

**Context:**
- **Techstack:** Markdown documentation
- **Architecture:** Offline-first single-tenant MVP with cloud-ready schema
- **Project:** EscapePlan escape room management system
- **Current State:** Schema changes complete, documentation needed
- **Audience:** Future developers, cloud phase implementers

**Instruction:**
Document cloud-ready schema changes in project documentation. Explain Phase 0 placeholders and Phase 2 activation plan.

**Requirements:**
1. Update `project-docs/DATABASE_SYSTEM.md`:
   - Add "Cloud-Ready Schema (Phase 0)" section
   - List all 16 cloud columns added
   - Document `hub_config` table purpose
   - Explain why fields are NULL/unused in MVP
   - Reference ADR-001 for Phase 2 activation plan

2. Update `project-docs/API_CONTRACTS_SCHEMA_MANAGEMENT.md`:
   - Add cloud field descriptions to table schemas
   - Document stub endpoints (`/api/sync/status`, `/api/admin/hub/config`)
   - Note Phase 0 behavior (always disabled/null)

3. Create `project-docs/cloud-sync-plan.md`:
   - Link to ADR-001 and CLOUD_GROWTH_ROADMAP.md
   - Document Phase 0 → Phase 2 migration path
   - List deferred features (sync engine, org tables)

**Constraints:**
- NO speculation about Phase 2 implementation details
- Reference ADR-001 and roadmap, don't duplicate
- Keep documentation concise (1-2 pages per file)
- Use markdown formatting (headers, lists, code blocks)

**Acceptance Criteria:**
- [ ] DATABASE_SYSTEM.md updated with cloud schema section
- [ ] API_CONTRACTS_SCHEMA_MANAGEMENT.md updated with cloud fields
- [ ] cloud-sync-plan.md created with Phase 0→2 roadmap
- [ ] All file paths and references valid
- [ ] Documentation clear and concise
- [ ] All 8 QA checks pass

**Deliverables:**
- **Files:**
  - `project-docs/DATABASE_SYSTEM.md` (updated)
  - `project-docs/API_CONTRACTS_SCHEMA_MANAGEMENT.md` (updated)
  - `project-docs/cloud-sync-plan.md` (new)
- **Format:** Markdown

**Dependencies:**
- **Requires:** Tasks 1.1-1.5 complete
- **Reference:** ADR-001, CLOUD_GROWTH_ROADMAP.md

**Estimated Effort:** 2-3 hours

---

## 4. Track 2: Critical Bug Fixes

### Task 2.1: Bug Analysis - Game Update Payload Error

**Task ID:** S54-T2.1

**Title:** Analyze and reproduce game update "Missing payload" error

**Context:**
- **Techstack:** Fastify 5, Zod validation, Drizzle ORM
- **Bug Report:** PUT `/admin/games/:id` returns "Missing payload" despite valid JSON
- **Impact:** CRITICAL - Cannot save game settings/puzzles
- **Current Implementation:** Route at `src/index.ts:646`, uses `saveGameSchema` validation

**Instruction:**
Reproduce game update bug, identify root cause, and document fix strategy. Analyze route implementation and validation logic.

**Requirements:**
1. Review route implementation at `src/index.ts:646-663`
2. Check `saveGameSchema` validation at `packages/contracts/src/validation.ts:147-174`
3. Test with sample payload:
   ```json
   {
     "slug": "test-game",
     "name": "Test Game",
     "description": "Test",
     "durationMinutes": 60,
     "difficulty": "Medium",
     "gameType": "storefront",
     "minPlayers": 2,
     "maxPlayers": 6,
     "resourcesRequired": 1,
     "defaultVolume": 80,
     "cameraIds": [],
     "puzzles": [],
     "milestones": [],
     "media": { "introVideo": null, "backgroundMusic": null, "successVideo": null },
     "pricing": { "basePrice": 50, "perPlayerPrice": 10, "groupDiscount": [] },
     "bookingRules": { "advanceBookingDays": 30, "minNoticeHours": 24 }
   }
   ```
4. Identify if issue is:
   - Request body parsing (Fastify multipart config)
   - Zod validation failure (schema mismatch)
   - Route path mismatch (PUT vs POST)
   - Content-Type header issue

**Constraints:**
- Reproduce locally on development environment
- Use actual API endpoint (not mocks)
- Document exact error response and request headers
- NO assumptions - test thoroughly

**Acceptance Criteria:**
- [ ] Bug reproduced successfully
- [ ] Root cause identified with evidence
- [ ] Fix strategy documented (what needs to change)
- [ ] Test payload that triggers error saved
- [ ] Expected vs actual behavior documented
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `project-docs/research/claude-auth/BUG_ANALYSIS_GAME_UPDATE.md`
- **Contents:** Reproduction steps, root cause, fix strategy, test data
- **Format:** Markdown

**Dependencies:**
- **Read:** `apps/escapeplan-api/src/index.ts` (lines 646-663)
- **Read:** `packages/contracts/src/validation.ts` (saveGameSchema)
- **Read:** Bug report from user (Task context)

**Estimated Effort:** 1-2 hours

---

### Task 2.2: Fix - Game Update Payload Error

**Task ID:** S54-T2.2

**Title:** Fix game update endpoint to handle payload correctly

**Context:**
- **Techstack:** Fastify 5, Zod validation, TypeScript
- **Bug:** Game update returns "Missing payload" error
- **Root Cause:** [From Task 2.1 analysis]
- **Fix Strategy:** [From Task 2.1 documentation]

**Instruction:**
Implement fix for game update payload error based on root cause analysis. Ensure route handles JSON payload correctly and validation passes.

**Requirements:**
1. Apply fix identified in Task 2.1 (possible fixes):
   - If body parsing issue: Add `Content-Type: application/json` handling
   - If validation issue: Fix schema mismatch (add missing optional fields)
   - If route issue: Correct HTTP method or path
2. Ensure `request.body` is properly parsed before validation
3. Add error logging for debugging future issues
4. Test with sample payload from Task 2.1

**Constraints:**
- Fix ONLY the identified issue (no scope creep)
- Maintain backward compatibility with existing game updates
- NO changes to unrelated routes
- Follow existing error handling patterns
- Must work with both storefront and mobile game types

**Acceptance Criteria:**
- [ ] Game update endpoint accepts valid payload
- [ ] Validation passes for complete game objects
- [ ] Error logging added for debugging
- [ ] Manual test with sample payload succeeds
- [ ] Existing game update functionality preserved
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `apps/escapeplan-api/src/index.ts` (bug fix applied)
- **Test:** Manual curl test confirms fix works

**Dependencies:**
- **Requires:** Task 2.1 (root cause analysis)
- **Reference:** Existing route patterns in index.ts

**Estimated Effort:** 1-2 hours

---

### Task 2.3: Bug Analysis - Role Creation Validation Error

**Task ID:** S54-T2.3

**Title:** Analyze role creation "Expected string, received null" error

**Context:**
- **Techstack:** Fastify 5, Zod validation, Drizzle ORM
- **Bug Report:** POST `/admin/roles` returns 400 "Expected string, received null" for description field
- **Payload:** `{name: "testrole", description: null, permissionIds: ["perm-view_bookings"]}`
- **Impact:** HIGH - Cannot create roles with null description (should be optional)
- **Current Implementation:** Route at `src/index.ts:461`, uses `createRoleSchema` validation

**Instruction:**
Analyze role creation validation error. Identify why `description: null` fails when schema defines it as optional.

**Requirements:**
1. Review `createRoleSchema` at `packages/contracts/src/validation.ts:266-271`:
   ```typescript
   export const createRoleSchema = z.object({
     name: z.string().min(1),
     description: z.string().optional(),  // Should allow null?
     isSystem: z.boolean().default(false),
     permissionIds: z.array(z.string()).default([])
   });
   ```
2. Identify issue:
   - Zod `optional()` means field can be OMITTED, not set to `null`
   - Need `.optional().nullable()` or `.nullish()` to accept null
3. Check if database column accepts NULL (roles table schema)
4. Document correct fix

**Constraints:**
- Analyze Zod validation behavior (optional vs nullable vs nullish)
- Check database schema compatibility
- NO assumptions about Zod semantics - verify documentation
- Consider backward compatibility (existing roles with description)

**Acceptance Criteria:**
- [ ] Root cause identified (Zod optional vs nullable)
- [ ] Database column nullability verified
- [ ] Fix strategy documented (change to `.optional().nullable()`)
- [ ] Backward compatibility considered
- [ ] Test payload documented
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `project-docs/research/claude-auth/BUG_ANALYSIS_ROLE_CREATION.md`
- **Contents:** Root cause, fix strategy, Zod semantics explanation
- **Format:** Markdown

**Dependencies:**
- **Read:** `packages/contracts/src/validation.ts` (createRoleSchema)
- **Read:** `packages/contracts/src/schema.ts` (roles table)
- **Reference:** Zod documentation on optional/nullable/nullish

**Estimated Effort:** 1 hour

---

### Task 2.4: Fix - Role Creation Validation Error

**Task ID:** S54-T2.4

**Title:** Fix role creation to accept null description

**Context:**
- **Techstack:** Zod validation, TypeScript
- **Bug:** Role creation rejects `description: null`
- **Root Cause:** Zod `.optional()` doesn't accept explicit null
- **Fix:** Change to `.optional().nullable()` or `.nullish()`

**Instruction:**
Fix `createRoleSchema` to accept null description. Apply same fix to `updateRoleSchema` for consistency.

**Requirements:**
1. Update `createRoleSchema` in `packages/contracts/src/validation.ts`:
   ```typescript
   export const createRoleSchema = z.object({
     name: z.string().min(1),
     description: z.string().optional().nullable(),  // Accept null OR omitted
     isSystem: z.boolean().default(false),
     permissionIds: z.array(z.string()).default([])
   });
   ```
2. Update `updateRoleSchema` for consistency:
   ```typescript
   export const updateRoleSchema = z.object({
     name: z.string().min(1).optional(),
     description: z.string().optional().nullable()  // Same fix
   });
   ```
3. Rebuild contracts: `pnpm --filter @escapeplan/contracts build`
4. Test with null description payload

**Constraints:**
- Fix ONLY description field validation
- Apply consistently to both create and update schemas
- NO changes to other validation rules
- Must maintain type safety (TypeScript types still valid)

**Acceptance Criteria:**
- [ ] `createRoleSchema` accepts `description: null`
- [ ] `updateRoleSchema` accepts `description: null`
- [ ] Contracts package rebuilds successfully
- [ ] TypeScript types updated correctly
- [ ] Manual test with null description succeeds
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `packages/contracts/src/validation.ts` (schema updated)
- **Test:** POST `/admin/roles` with null description succeeds

**Dependencies:**
- **Requires:** Task 2.3 (root cause analysis)
- **Reference:** Zod nullable() documentation

**Estimated Effort:** 30 minutes - 1 hour

---

### Task 2.5: Bug Analysis - Alert Rules URL Error

**Task ID:** S54-T2.5

**Title:** Analyze alert rules 404 with double `/api/api/` in URL

**Context:**
- **Techstack:** Fastify 5 routing, SvelteKit frontend
- **Bug Report:** PATCH `/admin/alert-rules/:id` returns 404 "Route PATCH:/api/api/admin/alert-rules/excessive_hints not found"
- **Observed:** URL has `/api/api/` (double prefix)
- **Impact:** MEDIUM - Cannot toggle built-in alert rules
- **Current Implementation:** Route at `src/index.ts:1080`

**Instruction:**
Analyze alert rules 404 error. Identify why URL has double `/api/api/` prefix and where duplication occurs.

**Requirements:**
1. Verify API route registration at `src/index.ts:1080`:
   ```typescript
   api.patch('/admin/alert-rules/:id', async (request, reply) => {
   ```
   (Should be `/api/admin/alert-rules/:id` when served)

2. Check frontend API client configuration:
   - Review `apps/escapeplan-web/src/lib/api/client.ts`
   - Look for baseURL or prefix configuration
   - Check if frontend adds `/api` prefix to all requests

3. Identify duplication source:
   - If API uses `api.register()` with `/api` prefix → remove from routes
   - If frontend baseURL is `/api` → routes should NOT include `/api`
   - If nginx proxy adds `/api` → check proxy config

4. Document correct fix strategy

**Constraints:**
- Check BOTH frontend and backend for URL construction
- Review nginx config if available (production setup)
- NO assumptions - trace full request path
- Consider development vs production differences

**Acceptance Criteria:**
- [ ] Root cause identified (frontend vs backend prefix issue)
- [ ] URL construction traced frontend → backend
- [ ] Fix strategy documented (where to remove duplication)
- [ ] Development and production paths considered
- [ ] Test URL documented
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `project-docs/research/claude-auth/BUG_ANALYSIS_ALERT_RULES_URL.md`
- **Contents:** Root cause, request tracing, fix strategy
- **Format:** Markdown

**Dependencies:**
- **Read:** `apps/escapeplan-api/src/index.ts` (route registration)
- **Read:** `apps/escapeplan-web/src/lib/api/client.ts` (API client)
- **Reference:** CLAUDE.md (API Surface section)

**Estimated Effort:** 1-2 hours

---

### Task 2.6: Fix - Alert Rules URL Error

**Task ID:** S54-T2.6

**Title:** Fix alert rules URL duplication (double `/api/api/`)

**Context:**
- **Techstack:** Fastify 5, SvelteKit, TypeScript
- **Bug:** Alert rules PATCH has double `/api/api/` prefix
- **Root Cause:** [From Task 2.5 analysis]
- **Fix Strategy:** [From Task 2.5 documentation]

**Instruction:**
Fix alert rules URL duplication based on root cause analysis. Remove duplicate `/api` prefix from either frontend or backend.

**Requirements:**
1. Apply fix identified in Task 2.5 (possible fixes):
   - If backend issue: Remove `/api` prefix from route registration
   - If frontend issue: Remove `/api` from baseURL or request path
   - If both: Standardize on single prefix location

2. Ensure fix applies to ALL admin routes (not just alert-rules)

3. Test with alert rule toggle:
   ```bash
   curl -X PATCH http://localhost:4000/api/admin/alert-rules/excessive_hints \
     -H "Content-Type: application/json" \
     -d '{"enabled": false}'
   ```

**Constraints:**
- Fix ONLY URL prefix issue (no route logic changes)
- Maintain consistency across all API routes
- NO breaking changes to other endpoints
- Test both development and production paths

**Acceptance Criteria:**
- [ ] Alert rules PATCH route accessible at `/api/admin/alert-rules/:id`
- [ ] No double `/api/api/` in any request URLs
- [ ] All admin routes follow same pattern
- [ ] Manual test with curl succeeds
- [ ] Frontend alert toggle works correctly
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** [Frontend or Backend file - from Task 2.5 analysis]
- **Test:** PATCH `/admin/alert-rules/:id` returns 200 (not 404)

**Dependencies:**
- **Requires:** Task 2.5 (root cause analysis)
- **Reference:** Existing API route patterns

**Estimated Effort:** 1 hour

---

### Task 2.7: Bug Analysis - Backup Functionality Issues

**Task ID:** S54-T2.7

**Title:** Analyze backup functionality gaps (missing UI, no restore)

**Context:**
- **Techstack:** SQLite backup, Fastify 5, SvelteKit
- **Bug Report:** 3 issues:
  1. Manual backups don't appear in backup management UI
  2. No restore functionality (local or upload)
  3. Unclear if backups contain actual data
- **Impact:** HIGH - Cannot verify backup integrity or restore from backup
- **Current Implementation:** Routes at `src/index.ts:1345-1395`

**Instruction:**
Analyze backup system implementation. Identify gaps between backend functionality and frontend UI. Document restore implementation requirements.

**Requirements:**
1. Review backup routes at `src/index.ts:1345-1395`:
   - POST `/admin/backups` (create backup)
   - GET `/admin/backups` (list backups)
   - DELETE `/admin/backups/:id` (delete backup)

2. Check backup implementation at `src/system/backup.js`:
   - Verify backups are stored in database table
   - Check if backup files are created on filesystem
   - Determine backup storage location

3. Identify missing functionality:
   - Why backups don't appear in UI (data vs display issue?)
   - Where restore endpoint should be added
   - What backup verification is needed

4. Document restore requirements:
   - Restore from backup ID (existing backup)
   - Restore from upload (external backup file)
   - Backup validation before restore
   - Data safety (confirm before overwrite)

**Constraints:**
- Check BOTH backend and frontend for backup UI
- Verify backup files actually contain data (inspect file)
- NO assumptions - test backup creation and listing
- Consider data safety for restore (backup current DB first)

**Acceptance Criteria:**
- [ ] Backup creation flow traced (API → storage)
- [ ] Backup listing issue identified (why UI empty?)
- [ ] Restore requirements documented
- [ ] Backup file contents verified (has data)
- [ ] Safety considerations documented
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `project-docs/research/claude-auth/BUG_ANALYSIS_BACKUP_SYSTEM.md`
- **Contents:** Current state, gaps, restore requirements, safety plan
- **Format:** Markdown

**Dependencies:**
- **Read:** `apps/escapeplan-api/src/index.ts` (backup routes)
- **Read:** `apps/escapeplan-api/src/system/backup.js` (backup implementation)
- **Search:** Frontend backup UI component

**Estimated Effort:** 2-3 hours

---

### Task 2.8: Fix - Backup Functionality Gaps

**Task ID:** S54-T2.8

**Title:** Fix backup system (UI display + restore functionality)

**Context:**
- **Techstack:** Fastify 5, SQLite, SvelteKit
- **Bugs:** Backups missing from UI, no restore functionality
- **Root Cause:** [From Task 2.7 analysis]
- **Requirements:** Display backups in UI, add restore endpoints

**Instruction:**
Fix backup system based on Task 2.7 analysis. Ensure backups appear in UI and implement restore functionality with safety checks.

**Requirements:**
1. Fix backup listing (if issue identified in Task 2.7):
   - Ensure GET `/admin/backups` returns correct data
   - Fix frontend query if needed
   - Verify backup table records are created

2. Implement restore endpoints:
   ```typescript
   // POST /admin/backups/:id/restore - Restore from existing backup
   api.post('/admin/backups/:id/restore', async (request, reply) => {
     const session = await ensureAuth(request, reply);
     if (!session) return;
     if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_backups')) return;

     const { id } = request.params as { id: string };

     // 1. Create safety backup of current DB
     const safetyBackup = await createBackup({ reason: 'Pre-restore safety backup' });

     // 2. Validate backup exists and is readable
     const { restoreBackup } = await import('./system/backup.js');
     const restored = await restoreBackup(id);

     return { success: true, safetyBackupId: safetyBackup.id, restoredFrom: id };
   });

   // POST /admin/backups/upload - Upload and restore from external backup
   api.post('/admin/backups/upload', async (request, reply) => {
     // Handle multipart file upload
     // Validate backup file format
     // Create safety backup
     // Restore from uploaded file
   });
   ```

3. Add backup validation (check file integrity before restore)

4. Create safety backup before each restore

**Constraints:**
- MUST create safety backup before restore (no data loss)
- Validate backup file format before restoration
- Add confirmation step (frontend shows warning)
- NO restore without permission check
- Follow existing backup file format

**Acceptance Criteria:**
- [ ] GET `/admin/backups` returns all backups (displayed in UI)
- [ ] POST `/admin/backups/:id/restore` restores existing backup
- [ ] POST `/admin/backups/upload` handles file upload + restore
- [ ] Safety backup created before every restore
- [ ] Backup validation prevents corrupt file restore
- [ ] All 8 QA checks pass

**Deliverables:**
- **Files:**
  - `apps/escapeplan-api/src/index.ts` (restore routes added)
  - `apps/escapeplan-api/src/system/backup.js` (restore logic)
- **Test:** Manual backup create → restore cycle succeeds

**Dependencies:**
- **Requires:** Task 2.7 (root cause analysis)
- **Reference:** Existing backup routes and implementation

**Estimated Effort:** 3-4 hours

---

## 5. Track 3: Testing & Validation

### Task 3.1: Unit Tests - Cloud Schema

**Task ID:** S54-T3.1

**Title:** Write unit tests for cloud-ready schema fields

**Context:**
- **Techstack:** Vitest, Drizzle ORM, SQLite
- **Testing Scope:** Cloud metadata fields, hub_config table
- **Coverage Target:** ≥80% for new schema additions
- **Test File:** `apps/escapeplan-api/test/cloud-schema.test.ts`

**Instruction:**
Write comprehensive unit tests for cloud-ready schema additions. Verify nullable behavior, default values, and backward compatibility.

**Requirements:**
1. Create test file: `apps/escapeplan-api/test/cloud-schema.test.ts`

2. Test cloud metadata fields (16 columns):
   ```typescript
   describe('Cloud Metadata Fields', () => {
     it('should insert booking without cloud fields (MVP behavior)', async () => {
       const booking = { id: generateId(), booking_code: 'TEST123', /* MVP fields */ };
       await db.insert(bookings).values(booking);
       const result = await db.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1);
       expect(result[0].cloud_id).toBeNull();
       expect(result[0].cloud_hub_id).toBeNull();
     });

     it('should allow cloud_id assignment (future cloud sync)', async () => {
       const booking = { id: generateId(), cloud_id: 'cloud-1', cloud_hub_id: 'hub-1', /* fields */ };
       await db.insert(bookings).values(booking);
       const result = await db.select().from(bookings).where(eq(bookings.cloud_id, 'cloud-1')).limit(1);
       expect(result[0].cloud_id).toBe('cloud-1');
     });
   });
   ```

3. Test hub_config table:
   ```typescript
   describe('Hub Config Table', () => {
     it('should have default row with sync disabled', async () => {
       const config = await db.select().from(hub_config).where(eq(hub_config.id, 'default')).limit(1);
       expect(config[0].sync_enabled).toBe(false);
       expect(config[0].cloud_organization_id).toBeNull();
     });
   });
   ```

4. Test backward compatibility:
   - Existing MVP queries work unchanged
   - No performance degradation on SELECT/INSERT

**Constraints:**
- Use Vitest test framework (existing pattern)
- Test against real SQLite database (not mocks)
- Cover all 8 core tables with cloud fields
- NO placeholders or skipped tests
- All tests must pass before Task 3.1 complete

**Acceptance Criteria:**
- [ ] Test file created with ≥20 test cases
- [ ] All cloud metadata fields tested (nullable, assignable)
- [ ] Hub_config table tests pass
- [ ] Backward compatibility tests pass
- [ ] Test coverage ≥80% for new schema code
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `apps/escapeplan-api/test/cloud-schema.test.ts` (new)
- **Test Run:** `pnpm --filter escapeplan-api test` passes

**Dependencies:**
- **Requires:** Tasks 1.1-1.4 complete (schema applied)
- **Reference:** Existing test patterns in `test/` directory

**Estimated Effort:** 3-4 hours

---

### Task 3.2: Integration Tests - Bug Fixes

**Task ID:** S54-T3.2

**Title:** Write integration tests for all 4 bug fixes

**Context:**
- **Techstack:** Vitest, Fastify testing, curl/fetch
- **Testing Scope:** 4 critical bug fixes from Track 2
- **Coverage Target:** Full request/response cycle for each fix
- **Test File:** `apps/escapeplan-api/test/bug-fixes-session-54.test.ts`

**Instruction:**
Write integration tests verifying all 4 bug fixes work correctly. Test full request/response cycles with real API.

**Requirements:**
1. Create test file: `apps/escapeplan-api/test/bug-fixes-session-54.test.ts`

2. Test Bug 1 (Game Update):
   ```typescript
   describe('Bug Fix: Game Update Payload', () => {
     it('should update game with valid payload', async () => {
       const payload = { slug: 'test', name: 'Test', /* full game object */ };
       const response = await fetch('/api/admin/games/game-123', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
       });
       expect(response.status).toBe(200);
       expect(response.json()).toHaveProperty('id', 'game-123');
     });
   });
   ```

3. Test Bug 2 (Role Creation):
   ```typescript
   describe('Bug Fix: Role Creation with Null Description', () => {
     it('should create role with null description', async () => {
       const payload = { name: 'testrole', description: null, permissionIds: [] };
       const response = await fetch('/api/admin/roles', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
       });
       expect(response.status).toBe(200);
       expect(response.json()).toHaveProperty('description', null);
     });
   });
   ```

4. Test Bug 3 (Alert Rules URL):
   ```typescript
   describe('Bug Fix: Alert Rules URL', () => {
     it('should toggle alert rule without 404', async () => {
       const response = await fetch('/api/admin/alert-rules/excessive_hints', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ enabled: false })
       });
       expect(response.status).toBe(200);
     });
   });
   ```

5. Test Bug 4 (Backup Restore):
   ```typescript
   describe('Bug Fix: Backup Restore', () => {
     it('should list created backups', async () => {
       await fetch('/api/admin/backups', { method: 'POST', body: '{"reason":"test"}' });
       const response = await fetch('/api/admin/backups');
       expect(response.json()).toHaveLength(1);
     });

     it('should restore from backup', async () => {
       const backups = await fetch('/api/admin/backups').then(r => r.json());
       const response = await fetch(`/api/admin/backups/${backups[0].id}/restore`, {
         method: 'POST'
       });
       expect(response.status).toBe(200);
       expect(response.json()).toHaveProperty('success', true);
     });
   });
   ```

**Constraints:**
- Use real API endpoints (not mocks)
- Authenticate requests (use test session)
- Test BOTH success and error cases
- Clean up test data after each test
- NO skipped or pending tests

**Acceptance Criteria:**
- [ ] Test file created with ≥8 integration tests
- [ ] All 4 bug fixes tested end-to-end
- [ ] Success and error cases covered
- [ ] All tests pass on first run
- [ ] Test data cleaned up properly
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `apps/escapeplan-api/test/bug-fixes-session-54.test.ts` (new)
- **Test Run:** `pnpm --filter escapeplan-api test` includes new tests

**Dependencies:**
- **Requires:** All Track 2 tasks complete (bug fixes applied)
- **Reference:** Existing integration test patterns

**Estimated Effort:** 2-3 hours

---

### Task 3.3: Regression Testing - Existing Features

**Task ID:** S54-T3.3

**Title:** Run full regression test suite to verify no breaking changes

**Context:**
- **Techstack:** Vitest, existing test suite
- **Testing Scope:** All existing MVP features
- **Risk:** Schema changes or bug fixes may break existing functionality
- **Success Metric:** 100% existing tests pass unchanged

**Instruction:**
Run full test suite to verify Session 54 changes don't break existing features. Fix any regressions found.

**Requirements:**
1. Run full test suite:
   ```bash
   cd apps/escapeplan-api
   pnpm test
   ```

2. Verify test results:
   - All existing tests pass (no failures)
   - No new warnings or errors
   - Test coverage maintained (≥80%)

3. If regressions found:
   - Document failed test details
   - Identify which Task caused regression
   - Fix issue or rollback change
   - Re-run tests until 100% pass

4. Test critical user flows manually:
   - Booking creation → Session start → Completion
   - Game creation → Edit → Archive
   - User creation → Role assignment → Permission check
   - Alert rule toggle → Alert generation → Dismiss

**Constraints:**
- ALL existing tests must pass (no exceptions)
- NO skipping tests to force pass
- Fix regressions immediately (don't defer)
- Manual testing required for critical flows
- Document any test updates needed

**Acceptance Criteria:**
- [ ] Full test suite runs successfully
- [ ] All existing tests pass (100%)
- [ ] No new test failures introduced
- [ ] Test coverage ≥80% maintained
- [ ] Critical user flows work manually
- [ ] All 8 QA checks pass

**Deliverables:**
- **Artifact:** Test run output showing 100% pass
- **Document:** Regression test report (if issues found)
- **Fixes:** Any code changes to resolve regressions

**Dependencies:**
- **Requires:** All Track 1 and Track 2 tasks complete
- **Reference:** Existing test suite at `apps/escapeplan-api/test/`

**Estimated Effort:** 2-3 hours

---

### Task 3.4: Performance Testing - Schema Impact

**Task ID:** S54-T3.4

**Title:** Benchmark database performance with cloud schema additions

**Context:**
- **Techstack:** SQLite, Drizzle ORM, performance monitoring
- **Testing Scope:** Query performance impact of 16 new columns
- **Success Metric:** <10% performance degradation (per ADR-001)
- **Reference:** ADR-001 Section 7.1 (Performance Benchmarks)

**Instruction:**
Benchmark database performance before/after cloud schema additions. Verify performance degradation is within acceptable limits.

**Requirements:**
1. Create benchmark script: `apps/escapeplan-api/scripts/benchmark-cloud-schema.ts`

2. Benchmark critical queries:
   ```typescript
   // INSERT performance
   console.time('INSERT 100 bookings');
   for (let i = 0; i < 100; i++) {
     await db.insert(bookings).values({ /* booking data */ });
   }
   console.timeEnd('INSERT 100 bookings');

   // SELECT performance (dashboard query)
   console.time('SELECT dashboard data');
   const dashboard = await db.select().from(bookings)
     .where(eq(bookings.status, 'PENDING'))
     .limit(50);
   console.timeEnd('SELECT dashboard data');

   // JOIN performance (sessions with bookings)
   console.time('JOIN sessions + bookings');
   const sessions = await db.select().from(sessions)
     .leftJoin(bookings, eq(sessions.bookingId, bookings.id))
     .limit(50);
   console.timeEnd('JOIN sessions + bookings');
   ```

3. Measure database size:
   ```bash
   du -h apps/escapeplan-api/data/escapeplan.db
   ```

4. Compare against baselines:
   - INSERT performance: Target <10% slower
   - SELECT performance: Target <15% slower
   - Database size: Target <2% increase

5. Document results with pass/fail per ADR-001 criteria

**Constraints:**
- Use production-like dataset (1000+ bookings, 100+ sessions)
- Run benchmarks 3 times, average results
- Compare against pre-cloud-schema baseline
- NO mocking - use real SQLite database
- Document hardware specs (affects results)

**Acceptance Criteria:**
- [ ] Benchmark script created and runs successfully
- [ ] INSERT performance degradation <10%
- [ ] SELECT performance degradation <15%
- [ ] Database size increase <2%
- [ ] Results documented with evidence
- [ ] All 8 QA checks pass

**Deliverables:**
- **File:** `apps/escapeplan-api/scripts/benchmark-cloud-schema.ts` (new)
- **Report:** Performance benchmark results (markdown)
- **Verdict:** Pass/Fail per ADR-001 criteria

**Dependencies:**
- **Requires:** Task 1.3 complete (schema applied)
- **Reference:** ADR-001 Section 7.1 (Performance Benchmarks)

**Estimated Effort:** 2-3 hours

---

## 6. Execution Order

### 6.1 Phase 1: Hybrid A Implementation (Parallel)

**Launch in parallel (single message):**
- Task 1.1: Schema Design - Cloud Metadata Fields
- Task 1.2: Hub Config Table Creation

**Sequential (after 1.1-1.2 complete):**
- Task 1.3: Database Migration - Apply Schema Changes

**Sequential (after 1.3 complete):**
- Task 1.4: Hub Config Initialization
- Task 1.5: API Stub Endpoints - Cloud Status

**Sequential (after 1.4-1.5 complete):**
- Task 1.6: Documentation - Cloud Readiness

**Total Time:** 8-12 hours

---

### 6.2 Phase 2: Critical Bug Fixes (Parallel)

**Launch in parallel (single message):**
- Task 2.1: Bug Analysis - Game Update Payload Error
- Task 2.3: Bug Analysis - Role Creation Validation Error
- Task 2.5: Bug Analysis - Alert Rules URL Error
- Task 2.7: Bug Analysis - Backup Functionality Issues

**Sequential (after analysis complete):**
- Task 2.2: Fix - Game Update Payload Error
- Task 2.4: Fix - Role Creation Validation Error
- Task 2.6: Fix - Alert Rules URL Error
- Task 2.8: Fix - Backup Functionality Gaps

**Total Time:** 8-12 hours

---

### 6.3 Phase 3: Testing & Validation (Sequential)

**Sequential execution:**
1. Task 3.1: Unit Tests - Cloud Schema (after Track 1 complete)
2. Task 3.2: Integration Tests - Bug Fixes (after Track 2 complete)
3. Task 3.3: Regression Testing - Existing Features (after 3.1-3.2 complete)
4. Task 3.4: Performance Testing - Schema Impact (after 3.3 passes)

**Total Time:** 8-10 hours

---

### 6.4 Overall Execution Timeline

```
┌─────────────────────────────────────────────────────────────┐
│                    SESSION 54 EXECUTION                     │
└─────────────────────────────────────────────────────────────┘

Phase 1: Hybrid A (8-12h)
├── Parallel: Tasks 1.1, 1.2 (2-3h)
├── Sequential: Task 1.3 (1-2h)
├── Sequential: Tasks 1.4, 1.5 (2-3h)
└── Sequential: Task 1.6 (2-3h)

Phase 2: Bug Fixes (8-12h)
├── Parallel: Tasks 2.1, 2.3, 2.5, 2.7 (2-4h)
└── Sequential: Tasks 2.2, 2.4, 2.6, 2.8 (6-8h)

Phase 3: Testing (8-10h)
├── Sequential: Task 3.1 (3-4h)
├── Sequential: Task 3.2 (2-3h)
├── Sequential: Task 3.3 (2-3h)
└── Sequential: Task 3.4 (2-3h)

Total: 28-38 hours (4-5 days @ 8h/day)
```

**Parallelization Opportunities:**
- With 2 developers: 18-24 hours (2-3 days)
- Track 1 and Track 2 can run concurrently after initial analysis

---

## 7. Atomic Task Templates

### 7.1 Standard Task Template

Every task follows this structure:

```markdown
### Task X.Y: [Task Title]

**Task ID:** S54-TX.Y

**Title:** [5-10 word description]

**Context:**
- **Techstack:** Better Auth v1.3.24+, Drizzle ORM, SQLite WAL, Fastify 5, SvelteKit 2
- **Architecture:** Offline-first Pi appliance, single-tenant MVP, future cloud sync
- **Project:** EscapePlan escape room management system
- **Current State:** [what exists now]
- **Requirement:** [what needs to change]

**Instruction:**
[Single, explicit instruction with zero ambiguity]

**Requirements:**
1. [Specific, measurable requirement]
2. [Specific, measurable requirement]
3. [...]

**Constraints:**
- NO stubs, mocks, or placeholders
- Use [specific library/pattern]
- Follow [exact pattern from project]
- Must be compatible with [dependency]

**Acceptance Criteria:**
- [ ] [Objectively testable criterion]
- [ ] [Objectively testable criterion]
- [ ] All 8 QA checks pass (see Section 9)

**Deliverables:**
- **File:** path/to/output.ext (complete, production-ready)
- **Format:** [TypeScript/Markdown/JSON]

**Dependencies:**
- **Read:** path/to/dependency.ts (for context)
- **Requires:** Task X.Y complete
- **Reference:** [External documentation]

**Estimated Effort:** X-Y hours
```

### 7.2 QA Validation Task Template

```markdown
### QA Task: Validate Phase N Outputs

**Task ID:** S54-QA-N

**Title:** QA validation for Phase N deliverables

**Context:**
- **Phase:** Phase N ([Track 1/2/3])
- **Deliverables:** [List of files/artifacts to validate]

**Instruction:**
Validate all Phase N deliverables against 8 required QA checks. Document issues with specific fix recommendations.

**8 Required QA Checks:**
1. ✅ No placeholders: `grep -r "TODO|FIXME|STUB|NotImplementedError" [files]`
2. ✅ Error handling: All I/O operations in try/catch with specific exceptions
3. ✅ Type hints: All functions have TypeScript types, no `any`
4. ✅ Tests: ≥80% coverage for new code, all tests passing
5. ✅ Architecture: Matches offline-first, single-tenant patterns
6. ✅ Techstack: Uses Better Auth, Drizzle, Fastify, SvelteKit correctly
7. ✅ Code quality: No code smells, functions <50 lines, clear naming
8. ✅ Documentation: All public APIs documented, inline comments present

**Output Format (REQUIRED):**
```json
{
  "status": "pass" | "fail",
  "checks": {
    "no_placeholders": {"pass": true/false, "issues": []},
    "error_handling": {"pass": true/false, "issues": []},
    "type_hints": {"pass": true/false, "issues": []},
    "tests": {"pass": true/false, "issues": []},
    "architecture": {"pass": true/false, "issues": []},
    "techstack": {"pass": true/false, "issues": []},
    "code_quality": {"pass": true/false, "issues": []},
    "documentation": {"pass": true/false, "issues": []}
  },
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "check": "error_handling",
      "description": "Specific issue description",
      "fix": "Recommended fix"
    }
  ]
}
```

**ALL 8 CHECKS MUST PASS - NO EXCEPTIONS**
```

---

## 8. Dependencies Map

### 8.1 Task Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    TASK DEPENDENCIES                         │
└─────────────────────────────────────────────────────────────┘

Track 1: Hybrid A Implementation
┌──────┐  ┌──────┐
│ 1.1  │  │ 1.2  │  (Parallel)
└───┬──┘  └───┬──┘
    └────┬────┘
         ▼
      ┌──────┐
      │ 1.3  │  (Sequential - Migration)
      └───┬──┘
          ▼
      ┌──────┐  ┌──────┐
      │ 1.4  │  │ 1.5  │  (Parallel)
      └───┬──┘  └───┬──┘
          └────┬────┘
               ▼
            ┌──────┐
            │ 1.6  │  (Documentation)
            └──────┘

Track 2: Bug Fixes
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│ 2.1  │  │ 2.3  │  │ 2.5  │  │ 2.7  │  (Parallel - Analysis)
└───┬──┘  └───┬──┘  └───┬──┘  └───┬──┘
    ▼         ▼         ▼         ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│ 2.2  │  │ 2.4  │  │ 2.6  │  │ 2.8  │  (Sequential - Fixes)
└──────┘  └──────┘  └──────┘  └──────┘

Track 3: Testing & Validation (Sequential)
      ┌──────┐
      │ 3.1  │  (After Track 1)
      └───┬──┘
          ▼
      ┌──────┐
      │ 3.2  │  (After Track 2)
      └───┬──┘
          ▼
      ┌──────┐
      │ 3.3  │  (Regression)
      └───┬──┘
          ▼
      ┌──────┐
      │ 3.4  │  (Performance)
      └──────┘
```

### 8.2 File Dependencies

| Task | Reads | Writes | Depends On |
|------|-------|--------|------------|
| 1.1 | `schema.ts` | `schema.ts` | ADR-001 |
| 1.2 | `schema.ts` | `schema.ts` | 1.1 |
| 1.3 | `schema.ts` | `escapeplan.db` | 1.1, 1.2 |
| 1.4 | `seed.ts` | `seed.ts` | 1.3 |
| 1.5 | `index.ts`, `schema.ts` | `index.ts` | 1.4 |
| 1.6 | All Track 1 outputs | 3 doc files | 1.1-1.5 |
| 2.1 | `index.ts`, `validation.ts` | Analysis doc | - |
| 2.2 | Analysis doc | `index.ts` | 2.1 |
| 2.3 | `validation.ts` | Analysis doc | - |
| 2.4 | Analysis doc | `validation.ts` | 2.3 |
| 2.5 | `index.ts`, API client | Analysis doc | - |
| 2.6 | Analysis doc | `index.ts` or client | 2.5 |
| 2.7 | `backup.js`, routes | Analysis doc | - |
| 2.8 | Analysis doc | `backup.js`, routes | 2.7 |
| 3.1 | Schema, tests | `cloud-schema.test.ts` | 1.1-1.4 |
| 3.2 | Bug fixes, tests | `bug-fixes.test.ts` | 2.2,2.4,2.6,2.8 |
| 3.3 | All test suite | Test report | 3.1, 3.2 |
| 3.4 | Database | Benchmark script | 1.3 |

---

## 9. Success Criteria

### 9.1 Track 1: Hybrid A Implementation

**Schema Changes:**
- ✅ 16 columns added to 8 core tables (cloud_id, cloud_hub_id)
- ✅ 8 indexes created (idx_{table}_cloud_id)
- ✅ hub_config table created with 7 fields
- ✅ All cloud fields nullable and default to NULL
- ✅ Drizzle migration applied successfully

**API Endpoints:**
- ✅ GET `/api/sync/status` returns disabled state
- ✅ GET `/api/admin/hub/config` returns default config
- ✅ Endpoints require authentication

**Documentation:**
- ✅ DATABASE_SYSTEM.md updated with cloud schema section
- ✅ API_CONTRACTS_SCHEMA_MANAGEMENT.md updated
- ✅ cloud-sync-plan.md created with roadmap

**Validation:**
- ✅ Zero breaking changes to existing queries
- ✅ All existing tests pass unchanged
- ✅ Performance degradation <10% INSERT, <15% SELECT
- ✅ Database size increase <2%

---

### 9.2 Track 2: Bug Fixes

**Bug 1: Game Update Payload**
- ✅ PUT `/admin/games/:id` accepts valid JSON payload
- ✅ Game settings and puzzles save successfully
- ✅ No "Missing payload" error

**Bug 2: Role Creation Validation**
- ✅ POST `/admin/roles` accepts `description: null`
- ✅ Roles create successfully with null description
- ✅ Schema updated to `.optional().nullable()`

**Bug 3: Alert Rules URL**
- ✅ PATCH `/admin/alert-rules/:id` accessible without 404
- ✅ No double `/api/api/` in URLs
- ✅ Alert toggle works in UI

**Bug 4: Backup Functionality**
- ✅ Manual backups appear in backup management UI
- ✅ POST `/admin/backups/:id/restore` restores backup
- ✅ POST `/admin/backups/upload` handles external backups
- ✅ Safety backup created before restore

---

### 9.3 Track 3: Testing & Validation

**Unit Tests:**
- ✅ ≥20 tests for cloud schema fields
- ✅ All tests pass on first run
- ✅ Coverage ≥80% for new code

**Integration Tests:**
- ✅ ≥8 tests for bug fixes
- ✅ Full request/response cycles tested
- ✅ Success and error cases covered

**Regression Tests:**
- ✅ 100% existing tests pass
- ✅ No new test failures
- ✅ Critical user flows work manually

**Performance Tests:**
- ✅ INSERT performance <10% degradation
- ✅ SELECT performance <15% degradation
- ✅ Database size increase <2%

---

### 9.4 Overall Session 54 Success

**All 8 QA Checks Pass for Every Task:**
1. ✅ No placeholders (grep confirms zero TODO/FIXME/STUB)
2. ✅ Error handling (all I/O in try/catch with specific exceptions)
3. ✅ Type hints (all functions typed, no `any`)
4. ✅ Tests (≥80% coverage, all passing)
5. ✅ Architecture (matches offline-first, single-tenant)
6. ✅ Techstack (uses Better Auth, Drizzle, Fastify, SvelteKit)
7. ✅ Code quality (no smells, functions <50 lines)
8. ✅ Documentation (all public APIs documented)

**Deliverables:**
- ✅ 18 tasks completed (6 Hybrid A + 8 Bug Fixes + 4 Testing)
- ✅ Zero breaking changes to existing functionality
- ✅ All critical bugs fixed and tested
- ✅ Cloud-ready schema deployed and documented
- ✅ System ready for MVP launch (Phase 0 complete)

**Timeline:**
- ✅ Completed in 28-38 hours (4-5 days @ 8h/day)
- ✅ No tasks escalated to human (all resolved in 3 attempts)
- ✅ Documentation complete and accessible

---

## 10. Validation Checklist

### 10.1 Pre-Execution Checklist

**Before starting Session 54, verify:**
- [ ] ADR-001 (Hybrid A decision) read and understood
- [ ] CLOUD_GROWTH_ROADMAP.md Phase 0 requirements clear
- [ ] All bug reports documented with reproduction steps
- [ ] Development environment ready (database, API, tests)
- [ ] Backup of current database created (safety)

### 10.2 Per-Task Validation (ALL 8 CHECKS)

**For EVERY task, validate:**
1. [ ] No placeholders: `grep -r "TODO|FIXME|STUB" [modified files]` returns empty
2. [ ] Error handling: All I/O operations in try/catch blocks
3. [ ] Type hints: All functions have explicit TypeScript types
4. [ ] Tests: New code has ≥80% test coverage, all tests pass
5. [ ] Architecture: Follows offline-first, single-tenant patterns
6. [ ] Techstack: Uses Better Auth, Drizzle, Fastify, SvelteKit correctly
7. [ ] Code quality: No code smells, functions <50 lines, clear naming
8. [ ] Documentation: Public APIs documented, inline comments present

### 10.3 Post-Execution Checklist

**After Session 54 complete, verify:**
- [ ] All 18 tasks marked complete
- [ ] All 8 QA checks passed for every task
- [ ] Zero regressions (100% existing tests pass)
- [ ] All 4 bugs fixed and validated
- [ ] Cloud-ready schema deployed (16 columns + hub_config)
- [ ] Documentation updated (3 doc files)
- [ ] Performance benchmarks pass (<10% INSERT, <15% SELECT)
- [ ] SESSION_54_NOTES.md created with full summary

---

## 11. Emergency Procedures

### 11.1 Rollback Plan (If Critical Issues)

**If Session 54 changes break production:**

1. **Immediate Rollback - Schema Changes (Track 1):**
   ```bash
   # Step 1: Backup current database
   sqlite3 apps/escapeplan-api/data/escapeplan.db ".backup escapeplan-rollback-$(date +%s).db"

   # Step 2: Revert schema changes in Git
   git checkout HEAD~1 -- packages/contracts/src/schema.ts

   # Step 3: Rebuild contracts
   pnpm --filter @escapeplan/contracts build

   # Step 4: Apply reverted schema
   cd apps/escapeplan-api && npx drizzle-kit push

   # Step 5: Verify rollback
   sqlite3 data/escapeplan.db "PRAGMA table_info(bookings);"  # Confirm cloud_id removed
   ```

2. **Selective Rollback - Bug Fixes (Track 2):**
   ```bash
   # Revert specific file changes
   git checkout HEAD~1 -- apps/escapeplan-api/src/index.ts
   git checkout HEAD~1 -- packages/contracts/src/validation.ts

   # Rebuild and test
   pnpm build
   pnpm test
   ```

3. **Data Loss on Rollback:**
   - Cloud metadata fields: Lost (acceptable, all NULL in Phase 0)
   - Hub config table: Lost (recreate with default row)
   - Existing data: Preserved (no changes to MVP data)

### 11.2 Escalation Triggers

**Escalate to human if:**
- Any task fails QA validation after 3 fix attempts
- Performance degradation exceeds 20% (ADR-001 failure criteria)
- Regression tests fail with >10% test failures
- Database corruption detected during migration
- Bug fix introduces new critical bug
- Timeline exceeds 50 hours (38h + 12h buffer)

### 11.3 Mitigation Strategy

**If escalation required:**
1. Document exact failure state (logs, test results, error messages)
2. Rollback changes that caused issue
3. Create escalation report:
   - Task ID and phase
   - Issue description with evidence
   - Fix attempts made (up to 3)
   - Recommended next steps
4. Await human decision before proceeding

---

## Document Metadata

**Version:** 1.0.0

**Status:** Ready for Execution

**Date Created:** 2025-10-03

**Last Updated:** 2025-10-03

**Session:** Session 54 - Hybrid A Implementation + Critical Bug Fixes

**Owner:** Architecture Team

**Approvers:** Engineering, Product

**Related Documents:**
- `ARCHITECTURE_DECISION_RECORD.md` (ADR-001 - Hybrid A decision)
- `CLOUD_GROWTH_ROADMAP.md` (Phase 0-3 roadmap)
- `auth-prompt.txt` (Session 53 protocol)
- `CLAUDE.md` (Project overview and constraints)

**Change Log:**
- 2025-10-03: Initial task list created for Session 54

---

**END OF SESSION 54 TASK LIST**
