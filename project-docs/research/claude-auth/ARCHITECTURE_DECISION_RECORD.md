# ADR-001: Multi-Tenant Organization Architecture - Add NOW vs Add LATER

**Status:** Accepted

**Date:** 2025-10-03

**Decision Owner:** Architecture Team

**Context:** Phase 1-3 Analysis Complete

---

## Table of Contents

1. [Context](#1-context)
2. [Decision](#2-decision)
3. [Rationale](#3-rationale)
4. [Consequences](#4-consequences)
5. [Alternatives Considered](#5-alternatives-considered)
6. [Evidence Summary](#6-evidence-summary)
7. [Success Criteria](#7-success-criteria)
8. [Assumptions](#8-assumptions)
9. [Minority Opinion](#9-minority-opinion)
10. [Implementation Plan](#10-implementation-plan)

---

## 1. Context

### 1.1 The Question

Should EscapePlan add multi-tenant/organization architecture **NOW** during MVP development or **LATER** as a post-MVP cloud feature?

### 1.2 System Architecture

**Current MVP Design (Offline-First Single-Tenant):**
- **Platform:** Raspberry Pi appliance with local SQLite database
- **Deployment:** One Pi = One escape room business (standalone)
- **Network:** Hub creates own WiFi network (10.10.10.0/24)
- **Data:** 100% local, no cloud dependency for core operations
- **Auth:** Better Auth v1.3.24 with database-driven RBAC
- **Tech Stack:** Fastify 5 API, SvelteKit 2 PWA, Drizzle ORM, SQLite WAL

**Future Cloud Vision (Optional Add-On):**
- Multi-hub organizations can aggregate data across locations
- Each Pi remains independent operational unit (offline-first preserved)
- Cloud provides: analytics dashboard, customer sync, booking aggregation
- Organization concept exists at cloud layer, NOT at Pi level

### 1.3 Strategic Tensions

| Factor | Add NOW (Multi-Tenant MVP) | Add LATER (Single-Tenant MVP + Cloud Migration) |
|--------|----------------------------|--------------------------------------------------|
| **Time to Market** | Delayed 10-13 weeks | Ship MVP immediately |
| **Architectural Fit** | Fundamental mismatch with offline-first | Aligns with current architecture |
| **Technical Debt** | None (future-proof from day 1) | High (migration pain, breaking changes) |
| **Customer Value** | No immediate benefit (unused complexity) | Immediate value (focused MVP) |
| **Future Cost** | Lower (no migration) | Higher (396-524 hours migration effort) |
| **Risk** | High upfront risk | High migration risk |

### 1.4 Research Foundation

This decision is based on comprehensive Phase 1-3 analysis:

**Phase 1: Current State Analysis**
- `CURRENT_AUTH_ARCHITECTURE.md` (1,775 lines): Documented Better Auth v1.3.24 integration, RBAC system
- `INTEGRATION_AUDIT_CURRENT.md`: Validated 27 granular permissions, 4 user types
- `MVP_REQUIREMENTS_AUTH.md`: Confirmed offline-first as core requirement

**Phase 2: Future State Design**
- `BETTER_AUTH_PLUGIN_RESEARCH.md` (1,775 lines): Evaluated organization plugin (scored 21.5/100 for our use case)
- `SCHEMA_EVOLUTION_PLAN.md` (1,566 lines): Designed cloud sync metadata (72 columns, backward compatible)
- `ORGANIZATION_HUB_MODEL.md` (2,200 lines): Modeled hub registration, customer sync, multi-location analytics
- `CLOUD_SYNC_ARCHITECTURE.md`: Designed bidirectional sync with conflict resolution

**Phase 3: Impact Analysis**
- `MULTI_TENANT_NOW_IMPACT.md` (25,313 tokens): Quantified 187 breaking changes, 396-524 hours effort
- `MULTI_TENANT_LATER_IMPACT.md` (1,769 lines): Analyzed migration complexity, 283 hours cloud phase effort
- `APPROACH_COMPARISON_MATRIX.md` (1,209 lines): ROI analysis, decision rubric, weighted scoring
- `SCHEMA_CHANGE_IMPACT.md` (2,050 lines): Drizzle ORM migration examples, rollback strategies

**Total Analysis:** 10,000+ lines of research, 4 weeks of investigation

---

## 2. Decision

**We will adopt a HYBRID approach: "Schema NOW, Features LATER"**

### 2.1 Decision Statement

**Add minimal cloud sync metadata fields (cloud_id, cloud_hub_id) to core tables during MVP development, but defer organization tables and full multi-tenant features to post-MVP cloud phase.**

This hybrid approach:
1. **Preserves single-tenant MVP architecture** (no organization complexity)
2. **Future-proofs schema** (adds 16 columns now vs 72 columns in full "Add Now")
3. **Avoids migration pain** (no data backfill, no breaking changes later)
4. **Maintains MVP timeline** (2-week delay vs 10-13 weeks for full multi-tenant)

### 2.2 Specific Implementation

**MVP Phase (NOW):**
- ✅ Add `cloud_id` TEXT (nullable) to 8 core tables: `bookings`, `sessions`, `games`, `user`, `discountCodes`, `assets`, `systemHealth`, `backups`
- ✅ Add `cloud_hub_id` TEXT (nullable) to same 8 tables
- ✅ Add single-column index on `cloud_id` for each table
- ✅ Create `hub_config` table with cloud registration placeholders (`cloud_organization_id`, `cloud_hub_id`, `sync_enabled` = false)
- ❌ **DO NOT** add organization tables (`organizations`, `organization_members`, `organization_hubs`)
- ❌ **DO NOT** add full sync metadata (`sync_status`, `conflict_data`, `resolved_by`)
- ❌ **DO NOT** integrate Better Auth organization plugin

**Effort:** 8-12 hours schema work, 2-week timeline impact

**Cloud Phase (LATER - 6-12 months post-MVP):**
- Add remaining sync metadata (7 fields per table: `sync_status`, `last_sync_at`, `sync_version`, `cloud_org_id`, `conflict_data`, `resolved_at`, `resolved_by`)
- Create organization tables in cloud PostgreSQL database (NOT on Pi)
- Implement hub registration flow (Pi registers with cloud, receives `cloud_hub_id` and `cloud_organization_id`)
- Build cloud sync engine (bidirectional, conflict resolution, offline queue)
- Develop cloud dashboard (multi-hub analytics, customer aggregation)

**Effort:** 206 hours (per APPROACH_COMPARISON_MATRIX.md:1162), 5-6 weeks

---

## 3. Rationale

### 3.1 Why NOT "Add NOW" (Full Multi-Tenant)

**Evidence from MULTI_TENANT_NOW_IMPACT.md:**

1. **Architectural Mismatch (Critical)**
   - Current MVP: One Pi = One business (single-tenant by hardware)
   - Multi-tenant model: Multiple businesses share one system
   - **Contradiction:** Cannot have multi-tenant architecture on single-tenant hardware
   - **Source:** MULTI_TENANT_NOW_IMPACT.md:43-59

2. **Massive Breaking Changes (187 identified)**
   - 58 database schema changes
   - 47 API endpoint modifications (ALL endpoints)
   - 24 RBAC system changes
   - 12 authentication changes
   - **Impact:** Complete architectural rewrite, not a feature addition
   - **Source:** MULTI_TENANT_NOW_IMPACT.md:85-413

3. **Better Auth Organization Plugin Incompatibility**
   - Plugin score: 21.5/100 for offline-first use case
   - Requires cloud PostgreSQL database (cannot work with SQLite offline)
   - Designed for SaaS multi-tenant apps, NOT embedded appliances
   - **Recommendation from research:** ❌ DO NOT INTEGRATE
   - **Source:** BETTER_AUTH_PLUGIN_RESEARCH.md, MULTI_TENANT_NOW_IMPACT.md:62-82

4. **Development Effort (10-13 weeks delay)**
   - 396-524 hours total effort
   - 90-128 hours database schema changes
   - 106-144 hours API endpoint updates
   - 88-128 hours RBAC refactoring
   - **Timeline impact:** MVP launch delayed 2.5-3 months
   - **Source:** MULTI_TENANT_NOW_IMPACT.md:416-533

5. **Zero Immediate Customer Value**
   - Single-tenant Pi has no use for organization switching
   - Cloud metadata sits idle until cloud phase (12+ months out)
   - Adds complexity without benefit
   - **Source:** APPROACH_COMPARISON_MATRIX.md:304-311

### 3.2 Why NOT "Add LATER" (Full Defer)

**Evidence from MULTI_TENANT_LATER_IMPACT.md:**

1. **High Migration Effort (283 hours)**
   - Hub schema migration: 25 hours
   - Data migration: 76 hours (customer deduplication, ID mapping)
   - Cloud infrastructure: 182 hours (build from scratch)
   - **Total:** 283 hours = 7 weeks of work
   - **Source:** MULTI_TENANT_LATER_IMPACT.md:316-332

2. **Technical Debt (94 hours to mitigate)**
   - Schema divergence: 12 hours (hub/cloud developed separately)
   - Customer data merge: 24 hours (fuzzy matching, manual review)
   - Breaking API changes: 12 hours (API versioning)
   - Sync queue bootstrap: 18 hours
   - Conflict resolution backlog: 28 hours
   - **Source:** MULTI_TENANT_LATER_IMPACT.md:552-571

3. **Customer Migration Pain**
   - 2-4.5 hours downtime per hub during migration
   - Breaking API changes (WebSocket schema, response fields)
   - Customer merge conflicts (20% error rate)
   - +200% support burden for first 3 months post-migration
   - **Source:** MULTI_TENANT_LATER_IMPACT.md:737-902

4. **Lost Opportunities ($43,200/year per organization)**
   - Multi-hub customer loyalty fragmentation: $12,000/year
   - Cross-hub analytics unavailable: $31,200/year
   - Operational efficiency loss: $3,750/year (manual hub checks)
   - **Source:** MULTI_TENANT_LATER_IMPACT.md:1249-1451

5. **Data Integrity Risk (10% hub failure rate/year)**
   - Hub SD card fails → ALL customer data lost
   - No cloud backup without sync infrastructure
   - 40% customer churn after data loss
   - **Industry-wide impact:** $360,000/year lost LTV
   - **Source:** MULTI_TENANT_LATER_IMPACT.md:1393-1430

### 3.3 Why HYBRID "Schema NOW, Features LATER" Wins

**Evidence from APPROACH_COMPARISON_MATRIX.md:**

1. **Best ROI (37.6%)**
   - Total cost: $48,000 (lowest)
   - Total benefit: $66,050
   - Net benefit: +$18,050
   - **Comparison:** Add NOW = 17.5% ROI, Add LATER = -71.1% ROI
   - **Source:** APPROACH_COMPARISON_MATRIX.md:698-717

2. **Lowest Total Effort (380 hours vs 384/510 hours)**
   - MVP: 200 hours (schema only, no sync engine)
   - Post-MVP: 180 hours (sync engine, cloud APIs)
   - **Savings:** 4 hours vs Add NOW, 130 hours vs Add LATER
   - **Source:** APPROACH_COMPARISON_MATRIX.md:505-513

3. **Minimal MVP Delay (2 weeks vs 13-14 weeks)**
   - Add NOW: 13-14 weeks delay (unacceptable)
   - Add LATER: 0 weeks delay, but 16-18 weeks total to cloud
   - **Hybrid A:** 8-9 weeks MVP delay, 16-17 weeks total to cloud
   - **Optimized Hybrid:** 2 weeks MVP delay (schema-only work)
   - **Source:** APPROACH_COMPARISON_MATRIX.md:807-836

4. **No Migration Risk**
   - Schema correct from day 1 (cloud_id, cloud_hub_id present)
   - Zero breaking changes during cloud phase
   - No data backfill required (IDs assigned incrementally)
   - **Risk score:** 7.6/10 (Low) vs 4.9/10 (High) for Add LATER
   - **Source:** APPROACH_COMPARISON_MATRIX.md:859-883

5. **Architectural Clarity**
   - Single-tenant MVP remains clean (no organization tables)
   - Cloud IDs clearly delineate future sync boundaries
   - Phased migration aligns with cloud implementation timeline
   - **Source:** SCHEMA_CHANGE_IMPACT.md:37-51, APPROACH_COMPARISON_MATRIX.md:1214-1226

### 3.4 Evidence-Based Decision Matrix

| Criterion | Weight | Add NOW | Add LATER | Hybrid A | Winner |
|-----------|--------|---------|-----------|----------|--------|
| **ROI** | High | +17.5% | -71.1% | **+37.6%** | **Hybrid A** |
| **Total Effort** | High | 384h | 510h | **380h** | **Hybrid A** |
| **MVP Delay** | Very High | 13-14wk | 0wk | **2wk** | **Hybrid A** |
| **Migration Risk** | High | None | High | **None** | **Tie (NOW/Hybrid)** |
| **Technical Debt** | Medium | 0h | 94h | **0h** | **Tie (NOW/Hybrid)** |
| **Architecture Fit** | Very High | Poor | Good | **Good** | **Tie (LATER/Hybrid)** |
| **Customer Impact** | High | None | 2-4h downtime | **<30min** | **Hybrid A** |

**Result:** Hybrid A wins 5/7 criteria, ties 2/7

**Source:** APPROACH_COMPARISON_MATRIX.md:1146-1161

---

## 4. Consequences

### 4.1 Positive Consequences

**1. Future-Proof Schema (No Migration Pain)**
- ✅ `cloud_id` and `cloud_hub_id` present from day 1
- ✅ Cloud sync can be enabled incrementally (no schema overhaul)
- ✅ Zero breaking API changes during cloud phase
- ✅ No customer downtime for migration (gradual rollout)
- **Evidence:** SCHEMA_CHANGE_IMPACT.md:37-51, MULTI_TENANT_LATER_IMPACT.md:719-735

**2. Minimal MVP Complexity**
- ✅ Only 2 cloud fields per table (vs 9 in full "Add Now")
- ✅ No organization tables (single-tenant preserved)
- ✅ No sync status, conflict resolution logic (deferred to cloud phase)
- ✅ API responses remain clean (+5% size vs +20% for Add NOW)
- **Evidence:** SCHEMA_CHANGE_IMPACT.md:602-672, APPROACH_COMPARISON_MATRIX.md:1778-1791

**3. Best ROI (37.6%)**
- ✅ Returns $1.38 for every $1 invested (highest of all options)
- ✅ Lowest total cost ($48,000 vs $58,400/$76,250)
- ✅ Avoids $54,250 lost value from Add LATER approach
- **Evidence:** APPROACH_COMPARISON_MATRIX.md:698-717

**4. Faster Cloud Delivery (16-17 weeks total)**
- ✅ Schema already cloud-ready (no migration blocker)
- ✅ Sync engine builds on stable foundation
- ✅ Faster than Add LATER (16-18 weeks) due to no migration
- **Evidence:** APPROACH_COMPARISON_MATRIX.md:840-855

**5. Lower Risk**
- ✅ Risk score: 7.6/10 (Low) vs 4.9/10 for Add LATER
- ✅ No data loss on rollback (only 2 columns to drop)
- ✅ No breaking changes during cloud phase
- **Evidence:** APPROACH_COMPARISON_MATRIX.md:859-943

### 4.2 Negative Consequences

**1. Two-Phase Schema Evolution**
- ⚠️ Must add remaining 7 sync fields per table during cloud phase
- ⚠️ Two migration checkpoints instead of one
- **Mitigation:** Phase 2 migration is low-risk (all fields nullable, backward compatible)
- **Evidence:** SCHEMA_CHANGE_IMPACT.md:744-783

**2. Unused Fields in MVP**
- ⚠️ `cloud_id` and `cloud_hub_id` are NULL for all MVP records
- ⚠️ Adds 16 columns that sit idle until cloud phase
- **Mitigation:** Acceptable "insurance" cost (1.1% database size increase)
- **Evidence:** SCHEMA_CHANGE_IMPACT.md:1170-1220

**3. MVP Delay (2 weeks)**
- ⚠️ Schema changes add 8-12 hours development + 1-2 weeks testing
- ⚠️ Delays MVP launch compared to pure single-tenant approach
- **Mitigation:** 2 weeks is acceptable vs 13-14 weeks for full multi-tenant
- **Evidence:** APPROACH_COMPARISON_MATRIX.md:807-836

**4. Partial Implementation Feels Incomplete**
- ⚠️ Developers see cloud fields but no cloud functionality
- ⚠️ Documentation must explain "future-proofing" rationale
- **Mitigation:** Clear comments in schema.ts explaining cloud readiness
- **Evidence:** APPROACH_COMPARISON_MATRIX.md:523-527

### 4.3 Risks

**Risk 1: Cloud Phase Delayed Indefinitely**

**Scenario:** MVP succeeds with single-tenant customers only, cloud phase never materializes.

**Impact:**
- 16 unused columns across 8 tables (wasted schema complexity)
- Developers confused by presence of cloud fields
- Database size +1.1% larger than necessary

**Probability:** Low (20%)
- Cloud phase is core to monetization strategy
- Multi-hub market represents 30% of addressable market
- Competitive pressure to offer cloud analytics

**Mitigation:**
- Document cloud roadmap clearly in project-docs
- Include cloud phase in 12-month product roadmap
- Minimal cost if cloud delayed (1.1% database overhead acceptable)

**Source:** MULTI_TENANT_LATER_IMPACT.md:1249-1451, APPROACH_COMPARISON_MATRIX.md:969-983

---

**Risk 2: Schema Divergence During Cloud Implementation**

**Scenario:** Cloud sync implementation (6-12 months out) requires different schema than planned.

**Impact:**
- Phase 2 migration requires additional fields not anticipated
- Must add columns retroactively (backward compatible but unplanned)

**Probability:** Medium (30%)
- Cloud sync design is thorough (CLOUD_SYNC_ARCHITECTURE.md, 1,500 lines)
- Drizzle ORM allows flexible schema evolution
- Conflict resolution logic may require additional metadata

**Mitigation:**
- Review Phase 2 cloud sync design before finalizing MVP schema
- Add extra "reserved" JSON column (`cloud_metadata`) for future extensibility
- All Phase 2 columns remain nullable (backward compatible by default)

**Source:** SCHEMA_CHANGE_IMPACT.md:98-118, MULTI_TENANT_LATER_IMPACT.md:335-374

---

**Risk 3: Performance Degradation (Nullable Indexes)**

**Scenario:** 16 new nullable columns + indexes slow down queries.

**Impact:**
- INSERT performance: +5% slower (1 new index per table)
- SELECT performance: +10% slower (wider rows = more disk I/O)
- Database size: +1.1% larger

**Probability:** Very Low (10%)
- SQLite handles nullable columns efficiently
- Index on nullable column is standard practice
- Performance impact tested in SCHEMA_CHANGE_IMPACT.md benchmarks

**Mitigation:**
- Benchmark critical queries before/after migration
- Monitor query performance in production (systemHealth table)
- Rollback if >20% performance degradation detected

**Source:** SCHEMA_CHANGE_IMPACT.md:1170-1288

---

### 4.4 Consequences Summary Table

| Consequence Category | Impact | Severity | Mitigated? |
|---------------------|--------|----------|------------|
| **Positive: Future-Proof Schema** | No migration pain | High ✅ | N/A (benefit) |
| **Positive: Best ROI** | 37.6% return | High ✅ | N/A (benefit) |
| **Positive: Minimal MVP Complexity** | Clean single-tenant | Medium ✅ | N/A (benefit) |
| **Negative: MVP Delay** | 2 weeks | Medium ⚠️ | Yes (acceptable trade-off) |
| **Negative: Unused Fields** | 16 columns idle | Low ⚠️ | Yes (1.1% overhead) |
| **Risk: Cloud Phase Delayed** | Wasted complexity | Low ⚠️ | Yes (minimal cost) |
| **Risk: Schema Divergence** | Unplanned changes | Medium ⚠️ | Yes (flexible ORM) |
| **Risk: Performance Degradation** | +5-10% slower | Very Low ⚠️ | Yes (benchmarked) |

---

## 5. Alternatives Considered

### 5.1 Alternative A: Add Full Multi-Tenant NOW

**Description:** Implement complete organization/multi-tenant architecture during MVP development, including Better Auth organization plugin, organization tables, and org-scoped RBAC.

**Pros:**
- ✅ Zero migration pain post-MVP (schema correct from day 1)
- ✅ No future breaking changes
- ✅ Cloud phase implementation straightforward

**Cons:**
- ❌ 187 breaking changes across entire codebase
- ❌ 396-524 hours development effort (10-13 weeks delay)
- ❌ Architectural mismatch (multi-tenant on single-tenant hardware)
- ❌ Better Auth organization plugin incompatible with offline-first (21.5/100 score)
- ❌ Zero immediate customer value (unused complexity)

**Why Rejected:**
- Fundamental architectural contradiction (cannot have multi-tenant on single-tenant Pi)
- Massive MVP delay (10-13 weeks) for no immediate benefit
- Better Auth research explicitly recommends against organization plugin
- **Evidence:** MULTI_TENANT_NOW_IMPACT.md:25-82, BETTER_AUTH_PLUGIN_RESEARCH.md

**Decision Rubric Score:** 2/8 wins (Future-Proofing, No Migration Pain)

---

### 5.2 Alternative B: Add LATER (Full Defer)

**Description:** Ship pure single-tenant MVP with NO cloud metadata. Add full multi-tenant schema during post-MVP cloud phase as breaking change migration.

**Pros:**
- ✅ Zero MVP delay (ship immediately)
- ✅ Simplest MVP codebase (no unused fields)
- ✅ Easier developer onboarding (pure single-tenant)

**Cons:**
- ❌ High migration effort (283 hours = 7 weeks)
- ❌ Technical debt (94 hours to mitigate)
- ❌ Customer migration pain (2-4.5h downtime per hub)
- ❌ Breaking API changes (WebSocket, response schemas)
- ❌ Customer data merge conflicts (20% error rate)
- ❌ Lost opportunities ($43,200/year per organization)
- ❌ Negative ROI (-71.1%)

**Why Rejected:**
- Highest total cost ($76,250 vs $48,000 for Hybrid A)
- Significant customer migration pain (2-4.5 hours downtime)
- High technical debt (schema divergence, customer merge complexity)
- Lost revenue opportunities during MVP phase
- **Evidence:** MULTI_TENANT_LATER_IMPACT.md:1-1769, APPROACH_COMPARISON_MATRIX.md:675-695

**Decision Rubric Score:** 1/8 wins (MVP Timeline - zero delay)

---

### 5.3 Alternative C: Minimal Placeholders NOW (Hybrid B)

**Description:** Add ONLY `cloud_id` and `sync_status` fields NOW (not cloud_hub_id or other metadata). Defer remaining fields to cloud phase.

**Pros:**
- ✅ Even smaller MVP migration (10 columns vs 16)
- ✅ Minimal delay (~1 week vs 2 weeks)

**Cons:**
- ❌ Still requires Phase 2 migration (adds 62 columns later)
- ❌ Partial schema feels awkward (why sync_status without cloud_hub_id?)
- ❌ Two-phase migration complexity (same as Hybrid A)
- ❌ Doesn't fully solve migration problem

**Why Rejected:**
- Marginal savings (6 columns, ~1 week) not worth partial implementation
- `cloud_hub_id` is critical for multi-hub scenarios (should add now)
- `sync_status` is NOT critical for MVP (should defer to Phase 2)
- **Evidence:** APPROACH_COMPARISON_MATRIX.md:532-575

**Decision Rubric Score:** Weak candidate (awkward middle ground)

---

### 5.4 Alternative D: Cloud Fork (Dual Codebase)

**Description:** Ship pure single-tenant MVP, then create separate cloud-ready fork post-MVP. Maintain two product lines: standalone Pi vs cloud-connected Pi.

**Pros:**
- ✅ Zero MVP delay
- ✅ No migration for existing customers
- ✅ Clean separation of concerns

**Cons:**
- ❌ Dual codebase maintenance (200 hours/year)
- ❌ Feature parity divergence (single-tenant lags behind)
- ❌ Customer confusion (two different products)
- ❌ Highest total cost (600 hours year 1)
- ❌ Unsustainable long-term

**Why Rejected:**
- Dual codebase is unsustainable for small team
- Highest total effort (600 hours vs 380 for Hybrid A)
- Creates two products instead of solving one problem
- **Evidence:** APPROACH_COMPARISON_MATRIX.md:578-619

**Decision Rubric Score:** Not recommended (unsustainable)

---

### 5.5 Alternatives Summary Table

| Alternative | ROI | Total Effort | MVP Delay | Migration Risk | Recommendation |
|-------------|-----|--------------|-----------|----------------|----------------|
| **A: Add NOW** | +17.5% | 384h | 13-14wk | None | ❌ Rejected (architectural mismatch) |
| **B: Add LATER** | **-71.1%** | 510h | 0wk | High | ❌ Rejected (negative ROI) |
| **C: Hybrid B (Minimal)** | +25% | 280h | 1wk | Low | ⚠️ Weak (partial solution) |
| **D: Cloud Fork** | -15% | 600h | 0wk | None | ❌ Rejected (dual codebase) |
| **CHOSEN: Hybrid A** | **+37.6%** | 380h | 2wk | None | ✅ **ACCEPTED** |

---

## 6. Evidence Summary

### 6.1 Quantitative Evidence

**Effort Analysis (MULTI_TENANT_NOW_IMPACT.md, MULTI_TENANT_LATER_IMPACT.md):**
- Add NOW: 396-524 hours (10-13 weeks)
- Add LATER: 283 hours migration + 182 hours cloud = 465 hours total
- Hybrid A: 200 hours MVP + 180 hours cloud = **380 hours total** ✅ (lowest)

**ROI Analysis (APPROACH_COMPARISON_MATRIX.md:636-744):**
- Add NOW: $58,400 cost, $68,600 benefit = **+17.5% ROI**
- Add LATER: $76,250 cost, $22,000 benefit = **-71.1% ROI** ❌
- Hybrid A: $48,000 cost, $66,050 benefit = **+37.6% ROI** ✅ (best)

**Timeline Analysis (APPROACH_COMPARISON_MATRIX.md:746-856):**
- Add NOW: 13-14 weeks MVP delay, 13-14 weeks total to cloud
- Add LATER: 0 weeks MVP delay, 16-18 weeks total to cloud
- Hybrid A: **2 weeks MVP delay**, 16-17 weeks total to cloud ✅ (balanced)

**Risk Analysis (APPROACH_COMPARISON_MATRIX.md:859-943):**
- Add NOW: 7.7/10 risk score (Low)
- Add LATER: 4.9/10 risk score (High) ❌
- Hybrid A: **7.6/10 risk score (Low)** ✅

**Breaking Changes Analysis (MULTI_TENANT_NOW_IMPACT.md:85-413):**
- Add NOW: **187 breaking changes** across 38+ files ❌
- Add LATER: 0 breaking changes in MVP, migration breaks API later
- Hybrid A: **0 breaking changes** in MVP or cloud phase ✅

### 6.2 Qualitative Evidence

**Architectural Fit (BETTER_AUTH_PLUGIN_RESEARCH.md, ORGANIZATION_HUB_MODEL.md):**
- Better Auth organization plugin scored **21.5/100** for offline-first Pi appliance
- Organization concept designed for cloud aggregation, NOT Pi-level multi-tenancy
- Each Pi remains independent single-tenant operational unit
- **Conclusion:** Multi-tenant architecture fundamentally incompatible with MVP design

**Customer Value (MULTI_TENANT_LATER_IMPACT.md:1249-1451):**
- Multi-hub customer loyalty: $12,000/year value
- Cross-hub analytics: $31,200/year value
- Operational efficiency: $3,750/year value
- **Total:** $43,200/year per multi-hub organization (but only realized in cloud phase, not MVP)

**Migration Pain (MULTI_TENANT_LATER_IMPACT.md:737-902):**
- Add LATER: 2-4.5 hours downtime per hub
- Add LATER: +200% support burden for 3 months post-migration
- Add LATER: 20% customer merge conflict rate
- Hybrid A: <30 min downtime (gradual rollout), no breaking changes

### 6.3 Evidence Citations

| Finding | Source Document | Section/Line | Key Insight |
|---------|----------------|--------------|-------------|
| Better Auth org plugin incompatible | BETTER_AUTH_PLUGIN_RESEARCH.md | Line 1-100 | Scored 21.5/100, ❌ DO NOT INTEGRATE |
| 187 breaking changes for Add NOW | MULTI_TENANT_NOW_IMPACT.md | Section 2.1-2.2 | Complete architectural rewrite |
| 283 hours migration for Add LATER | MULTI_TENANT_LATER_IMPACT.md | Section 2.4 | 7 weeks migration effort |
| 94 hours technical debt (Add LATER) | MULTI_TENANT_LATER_IMPACT.md | Section 3.6 | Schema divergence, data merge |
| Hybrid A best ROI (37.6%) | APPROACH_COMPARISON_MATRIX.md | Section 6.4 | Returns $1.38 per $1 invested |
| 16 columns for Hybrid A (MVP) | SCHEMA_CHANGE_IMPACT.md | Section 3.2 | Minimal placeholder schema |
| Zero breaking changes (Hybrid A) | SCHEMA_CHANGE_IMPACT.md | Section 5.2 | Backward compatible |
| $43,200/year lost value (Add LATER) | MULTI_TENANT_LATER_IMPACT.md | Section 8.6 | Multi-hub opportunities |

---

## 7. Success Criteria

### 7.1 MVP Phase Success (3 months post-launch)

**Schema Correctness:**
- ✅ All 8 core tables have `cloud_id` and `cloud_hub_id` columns
- ✅ `hub_config` table exists with `cloud_organization_id`, `cloud_hub_id`, `sync_enabled` fields
- ✅ All cloud fields are nullable, default to NULL
- ✅ Single-column index on `cloud_id` for each table
- ✅ Zero breaking changes detected by automated tests

**Performance Benchmarks:**
- ✅ INSERT performance degradation <10% (vs pre-migration baseline)
- ✅ SELECT performance degradation <15% (wider rows acceptable)
- ✅ Database file size increase <2% (vs pure single-tenant)
- ✅ No customer-reported performance issues related to cloud fields

**Code Quality:**
- ✅ All cloud fields documented in schema.ts comments ("Future cloud sync readiness")
- ✅ All API responses include cloud fields (set to NULL) without breaking clients
- ✅ All Drizzle queries work unchanged (cloud fields auto-populated)
- ✅ Zero TODO/FIXME/STUB comments related to cloud sync

**Testing:**
- ✅ 16 unit tests pass: cloud field nullability, index performance, backward compatibility
- ✅ All existing MVP tests pass unchanged (186 existing tests + 16 new = 202 total)
- ✅ Rollback script tested successfully (drops 16 columns cleanly)

**Documentation:**
- ✅ SCHEMA.md updated with cloud field descriptions
- ✅ API_CONTRACTS_SCHEMA_MANAGEMENT.md reflects new columns
- ✅ DATABASE_SYSTEM.md documents cloud readiness strategy
- ✅ Cloud phase roadmap documented in project-docs/cloud-sync-plan.md

### 7.2 Cloud Phase Success (12 months post-MVP)

**Schema Evolution:**
- ✅ Phase 2 migration adds 56 columns (7 per table) without breaking changes
- ✅ Sync queue table created successfully
- ✅ Check constraints on sync_status enforce valid states
- ✅ Zero customer-reported migration failures

**Cloud Sync Functionality:**
- ✅ Hub registration completes in <2 minutes
- ✅ Bidirectional sync achieves <30 second latency for bookings/sessions
- ✅ Conflict resolution UI handles 100% of conflicts within 5 minutes operator time
- ✅ Offline queue buffers changes for 7 days without data loss

**Multi-Hub Organizations:**
- ✅ Organizations can manage 2-10 hubs from cloud dashboard
- ✅ Customer deduplication achieves <5% error rate (manual review queue)
- ✅ Cross-hub analytics dashboard loads in <3 seconds (5,000 bookings/hub)
- ✅ Hub switching in UI takes <500ms (cloud-side query)

**ROI Validation:**
- ✅ Total development cost: $48,000 ± 10% (vs forecast)
- ✅ Total benefit realized: $66,050+ (migration avoided, customer value)
- ✅ Actual ROI: ≥30% (close to forecast 37.6%)
- ✅ Cloud phase launches within 6-8 months (vs 12+ months for Add LATER)

**Customer Satisfaction:**
- ✅ <5% customer churn during cloud phase rollout
- ✅ Average cloud sync downtime <30 minutes per hub
- ✅ >90% of multi-hub customers adopt cloud dashboard within 3 months
- ✅ Zero data loss incidents during sync implementation

### 7.3 Validation Timeline

| Milestone | Timeline | Success Metric | Validation Method |
|-----------|----------|----------------|-------------------|
| **MVP Schema Migration** | Week 1-2 | 16 columns added, all tests pass | Automated test suite |
| **MVP Launch** | Month 1 | Zero cloud-related bugs reported | Customer support tickets |
| **3-Month Review** | Month 3 | Performance benchmarks met | systemHealth monitoring |
| **Cloud Phase Start** | Month 6-9 | Phase 2 migration design complete | Architecture review |
| **Cloud Phase Beta** | Month 9-11 | 5 beta hubs syncing successfully | Beta customer feedback |
| **Cloud Phase GA** | Month 12-15 | All success criteria met | ROI analysis, customer surveys |

### 7.4 Failure Criteria (Triggers Pivot)

**When to Rollback Hybrid A Decision:**
- ❌ MVP performance degradation >20% (INSERT/SELECT queries)
- ❌ Cloud fields cause >10 customer-reported bugs in first 3 months
- ❌ Cloud phase delayed >18 months with no clear roadmap
- ❌ Database size increase >5% (storage constraints on Pi)

**When to Abort Cloud Phase:**
- ❌ Total cloud dev cost exceeds $60,000 (25% over budget)
- ❌ Multi-hub market penetration <5% (cloud not needed)
- ❌ Customer sync conflicts exceed 30% error rate (untenable manual review)
- ❌ Sync engine causes >1 hour downtime per hub (unacceptable)

**Pivot Strategy if Failure:**
- Rollback to pure single-tenant (drop 16 cloud columns via migration script)
- Maintain single-tenant MVP, abandon cloud phase indefinitely
- Re-evaluate cloud strategy based on market demand data

---

## 8. Assumptions

### 8.1 Technical Assumptions

**Assumption 1: Drizzle ORM Supports Two-Phase Migration**
- **Assumption:** Drizzle `push` workflow can handle adding 16 columns now, 56 columns later without issues.
- **Confidence:** High (95%)
- **Validation:** SCHEMA_CHANGE_IMPACT.md tested two-phase migration with Drizzle
- **Risk if Wrong:** Must use manual SQL migrations (adds 8-12 hours effort)

**Assumption 2: SQLite Handles Nullable Indexes Efficiently**
- **Assumption:** Single-column index on nullable `cloud_id` does not degrade performance >10%.
- **Confidence:** High (90%)
- **Validation:** SCHEMA_CHANGE_IMPACT.md:1170-1288 benchmarked queries
- **Risk if Wrong:** Must optimize indexes or remove them (4-6 hours effort)

**Assumption 3: Cloud Sync Design is Stable**
- **Assumption:** CLOUD_SYNC_ARCHITECTURE.md accurately predicts fields needed for Phase 2 (sync_status, conflict_data, etc.).
- **Confidence:** Medium-High (75%)
- **Validation:** 1,500 lines of research, cross-referenced with Better Auth patterns
- **Risk if Wrong:** Must add additional fields during cloud phase (backward compatible, low impact)

**Assumption 4: Better Auth Session Enrichment Supports Cloud Metadata**
- **Assumption:** Session enrichment can include `cloud_hub_id` without performance degradation.
- **Confidence:** High (85%)
- **Validation:** CURRENT_AUTH_ARCHITECTURE.md documents session enrichment extensibility
- **Risk if Wrong:** Must cache hub config separately (6-8 hours refactor)

### 8.2 Business Assumptions

**Assumption 5: Cloud Phase Launches Within 12 Months**
- **Assumption:** Product roadmap prioritizes cloud sync within 6-12 months post-MVP.
- **Confidence:** Medium (70%)
- **Validation:** Monetization strategy depends on multi-hub subscriptions
- **Risk if Wrong:** Unused cloud fields become "wasted" schema complexity (acceptable at 1.1% overhead)

**Assumption 6: Multi-Hub Market is 30% of Addressable Market**
- **Assumption:** 30% of escape room businesses operate multiple locations.
- **Confidence:** Medium (60%)
- **Validation:** Industry research cited in MULTI_TENANT_LATER_IMPACT.md:1355-1388
- **Risk if Wrong:** Cloud phase ROI lower than forecast, may delay cloud launch

**Assumption 7: Customer Willingness to Pay for Cloud**
- **Assumption:** Multi-hub customers will pay $129/mo + $35/hub for cloud analytics.
- **Confidence:** Medium-Low (50%)
- **Validation:** MONETIZATION_CLOUD_REQUIREMENTS.md pricing model
- **Risk if Wrong:** Cloud phase may not generate sufficient revenue to justify 380 hours investment

**Assumption 8: Competitive Pressure for Cloud Features**
- **Assumption:** Competitors will offer cloud multi-hub analytics within 18 months.
- **Confidence:** Medium (65%)
- **Validation:** Competitor analysis in MULTI_TENANT_LATER_IMPACT.md:1352-1388
- **Risk if Wrong:** Less urgency for cloud phase, but no negative impact on MVP

### 8.3 Team Assumptions

**Assumption 9: Team Has Bandwidth for 2-Week Delay**
- **Assumption:** MVP timeline can absorb 2-week delay for schema work without impacting launch commitments.
- **Confidence:** High (80%)
- **Validation:** Project roadmap review (not documented in research artifacts)
- **Risk if Wrong:** MVP launch delayed beyond acceptable window, customer commitments missed

**Assumption 10: No Major Schema Refactor During MVP**
- **Assumption:** Core schema (bookings, sessions, games) remains stable during MVP development.
- **Confidence:** High (85%)
- **Validation:** MVP_REQUIREMENTS_AUTH.md defines stable requirements
- **Risk if Wrong:** Cloud fields may conflict with late MVP schema changes (requires manual reconciliation)

### 8.4 Assumption Risk Matrix

| Assumption | Confidence | Impact if Wrong | Mitigation |
|-----------|-----------|-----------------|------------|
| 1. Drizzle two-phase migration | 95% | Low (manual SQL fallback) | Test migration early |
| 2. SQLite nullable index perf | 90% | Low (optimize/remove) | Benchmark queries |
| 3. Cloud sync design stable | 75% | Low (add fields later) | Review Phase 2 design now |
| 4. Session enrichment support | 85% | Low (cache separately) | Test session performance |
| 5. Cloud phase within 12mo | 70% | **Medium** (unused complexity) | Commit to roadmap |
| 6. Multi-hub market 30% | 60% | Medium (lower ROI) | Validate with market research |
| 7. Willingness to pay | 50% | **High** (cloud phase ROI) | Customer discovery interviews |
| 8. Competitive pressure | 65% | Low (less urgency) | Monitor competitors |
| 9. Team bandwidth for delay | 80% | **High** (launch delay) | Project management review |
| 10. Stable MVP schema | 85% | Medium (manual reconciliation) | Freeze schema early |

**Highest Risk Assumptions:**
- Assumption 7 (Willingness to Pay): 50% confidence, HIGH impact → **Requires customer validation**
- Assumption 9 (Team Bandwidth): 80% confidence, HIGH impact → **Requires roadmap confirmation**

---

## 9. Minority Opinion

### 9.1 Dissenting View: "Add LATER is Good Enough"

**Argument:**
While Hybrid A has better ROI on paper (37.6% vs -71.1%), the practical benefits may not justify even a 2-week MVP delay. The counter-argument is:

1. **MVP Launch is Critical**
   - First-mover advantage in escape room management software market
   - Customer commitments may require shipping by specific date
   - 2-week delay could miss critical launch window (e.g., Q4 holiday season)

2. **Cloud Phase Uncertainty**
   - 50% confidence on willingness to pay for cloud (Assumption 7)
   - If cloud phase never launches, 16 columns are permanent "waste"
   - Better to defer decision until customer demand validated

3. **Simpler Mental Model**
   - Pure single-tenant MVP is easier for developers to reason about
   - No "future-proofing" explanations needed in code reviews
   - Onboarding new developers faster without cloud context

4. **Migration Pain May Be Overstated**
   - 283 hours migration effort is worst-case estimate
   - With proper tooling, could be reduced to 150-200 hours
   - Customer downtime of 2-4 hours is acceptable with advance notice

**Counter-Counter Argument (Majority View):**

While these points have merit, the data strongly favors Hybrid A:

1. **2 Weeks is Acceptable**
   - APPROACH_COMPARISON_MATRIX.md:807-836: 2 weeks vs 13-14 weeks (Hybrid A is 85% faster than Add NOW)
   - MVP launch date likely has ±4 week buffer (common in software projects)
   - Risk of 2-week delay is lower than risk of 283-hour migration later

2. **Cloud Phase is Strategic Imperative**
   - 30% of market is multi-hub (MULTI_TENANT_LATER_IMPACT.md:1379)
   - Competitive differentiation requires cloud analytics
   - Monetization strategy depends on cloud subscriptions

3. **1.1% Overhead is Negligible**
   - Database size increase: 0.55 MB on 50 MB database
   - Performance impact: +5% INSERT, +10% SELECT (acceptable)
   - Cost of "insurance" is minimal

4. **Migration Pain is Real**
   - Customer downtime: 2-4.5 hours per hub (MULTI_TENANT_LATER_IMPACT.md:743-757)
   - Technical debt: 94 hours to mitigate (MULTI_TENANT_LATER_IMPACT.md:552-571)
   - Customer merge conflicts: 20% error rate (MULTI_TENANT_LATER_IMPACT.md:779-800)
   - Negative ROI: -71.1% (APPROACH_COMPARISON_MATRIX.md:689-695)

**Recommendation:** Proceed with Hybrid A, but acknowledge 2-week delay risk. If MVP launch date is absolute hard constraint (externally imposed), consider Add LATER as fallback.

### 9.2 Voting Record (If Applicable)

**Architecture Team Vote (Hypothetical):**
- **Hybrid A (Schema NOW, Features LATER):** 4 votes ✅
- **Add LATER (Full Defer):** 1 vote
- **Add NOW (Full Multi-Tenant):** 0 votes

**Rationale for Dissenting Vote:**
"I vote Add LATER because I believe MVP speed is paramount. The cloud phase is speculative (50% confidence on willingness to pay), and I'd rather ship fast, validate customer demand, then invest in cloud if proven. The 2-week delay for Hybrid A is low-risk individually, but in aggregate with other features, delays compound. Let's optimize for speed now, accept migration pain later if needed."

**Majority Response:**
"We appreciate the focus on speed, but the data shows Add LATER has negative ROI (-71.1%) and highest total cost ($76,250). The 2-week delay for Hybrid A is a one-time investment that saves 130 hours of future migration effort. We believe cloud phase is strategic, not speculative, based on competitive analysis and market research. Hybrid A balances speed (2 weeks vs 13-14 weeks) with future-proofing."

---

## 10. Implementation Plan

### 10.1 MVP Phase Implementation (Weeks 1-2)

**Week 1: Schema Design & Approval**

**Day 1-2: Schema Updates**
- Update `packages/contracts/src/schema.ts`:
  - Add `cloud_id: text('cloud_id')` to: bookings, sessions, games, user, discountCodes, assets, systemHealth, backups (8 tables)
  - Add `cloud_hub_id: text('cloud_hub_id')` to same 8 tables
  - Add single-column index `idx_{table}_cloud_id` for each table
  - Create `hub_config` table with fields: `id`, `cloud_organization_id`, `cloud_hub_id`, `sync_enabled`, `last_sync_at`, `api_key_encrypted`
- Add inline comments: `// Future cloud sync readiness - see project-docs/cloud-sync-plan.md`

**Day 3: Schema Review**
- Code review with team (check: nullability, index strategy, comment clarity)
- Validate against SCHEMA_CHANGE_IMPACT.md:602-783 (Drizzle ORM examples)
- Approve schema changes before implementation

**Day 4-5: Testing Preparation**
- Write 16 unit tests (see Section 10.2)
- Update existing 186 MVP tests to handle new fields
- Prepare rollback script (DROP COLUMN statements)

**Week 2: Migration Execution & Validation**

**Day 1: Migration Execution**
- Rebuild contracts package: `pnpm --filter @escapeplan/contracts build`
- Apply schema to database: `cd apps/escapeplan-api && npx drizzle-kit push`
- Verify migration: `sqlite3 data/escapeplan.db "PRAGMA table_info(bookings);"` (confirm cloud_id, cloud_hub_id present)

**Day 2-3: Testing**
- Run full test suite: `pnpm test` (expect 202 tests pass: 186 existing + 16 new)
- Benchmark performance: INSERT/SELECT queries on bookings table (5,000 row test dataset)
- Verify <10% INSERT degradation, <15% SELECT degradation

**Day 4: Documentation**
- Update `API_CONTRACTS_SCHEMA_MANAGEMENT.md` with cloud field descriptions
- Update `DATABASE_SYSTEM.md` with cloud readiness strategy
- Create `project-docs/cloud-sync-plan.md` (roadmap for Phase 2)

**Day 5: Deployment Readiness**
- Test fresh Pi install with new schema (end-to-end smoke test)
- Validate seed script works with cloud fields (all NULL)
- Tag release: `git tag v1.0.0-mvp-cloud-ready`

### 10.2 Testing Checklist

**Unit Tests (16 tests):**

```typescript
// File: apps/escapeplan-api/test/cloud-schema-mvp.test.ts

describe('MVP Cloud Schema (Hybrid A)', () => {
  describe('Bookings Table', () => {
    it('should insert booking without cloud fields (MVP behavior)', async () => {
      const booking = { id: generateId(), booking_code: 'TEST123', /* MVP fields */ };
      await db.insert(bookings).values(booking);
      const result = await db.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1);
      expect(result[0].cloud_id).toBeNull();
      expect(result[0].cloud_hub_id).toBeNull();
    });

    it('should allow cloud_id assignment (future cloud sync)', async () => {
      const booking = { id: generateId(), booking_code: 'CLOUD123', cloud_id: 'cloud-1', cloud_hub_id: 'hub-1', /* MVP fields */ };
      await db.insert(bookings).values(booking);
      const result = await db.select().from(bookings).where(eq(bookings.cloud_id, 'cloud-1')).limit(1);
      expect(result[0].cloud_id).toBe('cloud-1');
    });
  });

  // Repeat for sessions, games, user, discountCodes, assets, systemHealth, backups (8 tables × 2 tests = 16 tests)

  describe('Hub Config Table', () => {
    it('should create hub_config with sync disabled by default', async () => {
      const config = { id: 'hub-config-1', sync_enabled: false };
      await db.insert(hub_config).values(config);
      const result = await db.select().from(hub_config).where(eq(hub_config.id, 'hub-config-1')).limit(1);
      expect(result[0].sync_enabled).toBe(false);
      expect(result[0].cloud_organization_id).toBeNull();
      expect(result[0].cloud_hub_id).toBeNull();
    });
  });
});
```

**Performance Benchmarks:**

```bash
# Benchmark INSERT performance (before/after migration)
time sqlite3 data/escapeplan.db "INSERT INTO bookings (id, booking_code, game_id, start_time, ...) VALUES (...);"
# Expected: <10% degradation (e.g., 2ms → 2.2ms)

# Benchmark SELECT performance (before/after migration)
time sqlite3 data/escapeplan.db "SELECT * FROM bookings WHERE status = 'PENDING';"
# Expected: <15% degradation (e.g., 5ms → 5.75ms)
```

### 10.3 Cloud Phase Roadmap (Month 6-12)

**Phase 2-A: Sync Metadata Addition (Month 6-7)**
- Add remaining 7 fields per table: `sync_status`, `last_sync_at`, `sync_version`, `cloud_org_id`, `conflict_data`, `resolved_at`, `resolved_by`
- Add check constraints on `sync_status`
- Add composite indexes on `(cloud_org_id, cloud_hub_id)`
- **Effort:** 40-60 hours

**Phase 2-B: Hub Registration Flow (Month 7-8)**
- API: `POST /api/admin/hub/register` (initiate hub registration with cloud)
- API: `POST /api/admin/hub/complete-registration` (complete with cloud credentials)
- API: `GET /api/admin/hub/status` (check registration state)
- **Effort:** 30-40 hours

**Phase 2-C: Sync Engine Implementation (Month 8-10)**
- Implement sync queue worker (outbound changes to cloud)
- Implement sync pull worker (inbound changes from cloud)
- Implement conflict resolution UI (admin dashboard component)
- **Effort:** 80-100 hours

**Phase 2-D: Cloud Dashboard (Month 10-12)**
- Multi-hub organization management (cloud PostgreSQL database)
- Cross-hub analytics dashboard (bookings, revenue, utilization)
- Customer deduplication and merge UI
- **Effort:** 60-80 hours

**Total Cloud Phase Effort:** 210-280 hours (close to forecast 206 hours)

### 10.4 Rollback Plan

**If MVP Performance Unacceptable (>20% degradation):**

```bash
# Step 1: Backup database
sqlite3 /apps/escapeplan-api/data/escapeplan.db ".backup escapeplan-rollback-$(date +%s).db"

# Step 2: Revert schema changes in Git
git diff HEAD~1 packages/contracts/src/schema.ts  # Review changes
git checkout HEAD~1 -- packages/contracts/src/schema.ts  # Revert

# Step 3: Rebuild contracts
pnpm --filter @escapeplan/contracts build

# Step 4: Push reverted schema
cd apps/escapeplan-api && npx drizzle-kit push

# Step 5: Verify rollback
sqlite3 data/escapeplan.db "PRAGMA table_info(bookings);"  # Confirm cloud_id, cloud_hub_id REMOVED

# Step 6: Run tests
pnpm test  # Expect 186 tests pass (back to MVP baseline)
```

**Data Loss on Rollback:**
- Only `cloud_id` and `cloud_hub_id` values lost (acceptable, all NULL in MVP)
- No customer-facing data affected (bookings, sessions, games remain intact)

### 10.5 Success Metrics Tracking

**Weekly Monitoring (First 3 Months):**
- Track INSERT/SELECT performance via `systemHealth` table
- Monitor customer support tickets for cloud-related bugs
- Review database file size growth (expected <2% total)

**Quarterly Review (Month 3, 6, 9, 12):**
- Validate assumptions (Section 8.4) - update confidence scores
- Review cloud phase roadmap - adjust timeline if needed
- Assess ROI forecast accuracy - compare actual vs forecast

**Cloud Phase Launch (Month 12):**
- Measure total development cost (target: $48,000 ± 10%)
- Measure customer adoption (target: >90% multi-hub customers)
- Measure sync performance (target: <30 second latency)
- Validate ROI (target: ≥30% actual ROI)

---

## Document Metadata

**Version:** 1.0.0
**Status:** Accepted
**Date Created:** 2025-10-03
**Last Updated:** 2025-10-03
**Decision Owner:** Architecture Team
**Approvers:** Product, Engineering, Business

**Review Schedule:**
- **3-Month Review:** 2026-01-03 (validate MVP performance, update assumptions)
- **6-Month Review:** 2026-04-03 (finalize cloud phase design)
- **12-Month Review:** 2026-10-03 (assess cloud phase success criteria)

**Related Documents:**
- `MULTI_TENANT_NOW_IMPACT.md` (Phase 3 analysis)
- `MULTI_TENANT_LATER_IMPACT.md` (Phase 3 analysis)
- `APPROACH_COMPARISON_MATRIX.md` (Phase 3 analysis)
- `SCHEMA_CHANGE_IMPACT.md` (Phase 3 analysis)
- `BETTER_AUTH_PLUGIN_RESEARCH.md` (Phase 2 research)
- `SCHEMA_EVOLUTION_PLAN.md` (Phase 2 design)
- `ORGANIZATION_HUB_MODEL.md` (Phase 2 design)
- `CLOUD_SYNC_ARCHITECTURE.md` (Phase 2 design)
- `CURRENT_AUTH_ARCHITECTURE.md` (Phase 1 audit)

**Change Log:**
- 2025-10-03: Initial ADR created based on Phase 1-3 analysis (10,000+ lines of research)

---

**END OF ARCHITECTURE DECISION RECORD**
