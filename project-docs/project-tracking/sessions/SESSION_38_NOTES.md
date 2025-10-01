# Session 38 Notes - Dashboard System Planning & TODO Updates

**Date:** 2025-10-01
**Session Type:** Planning & Documentation
**Focus:** Dashboard system architecture planning and TODO.json updates per DASHBOARD_SYSTEM.md specification

---

## Session Objectives

1. ✅ Review DASHBOARD_SYSTEM.md specification (1307 lines)
2. ✅ Update TODO.json with corrected statuses and 5 new tasks
3. ✅ Update dashboard-plan.md with architecture clarifications
4. ✅ Review and merge admin-panel-research-audit.md findings

---

## Work Completed

### 1. DASHBOARD_SYSTEM.md Specification Review

**Document Located:** `project-docs/specifications/DASHBOARD_SYSTEM.md`

**Key Findings:**
- **Architecture:** Unified admin panel with tabbed interfaces
- **Permission Expansion:** 12 → 24 granular permissions
- **Database-Driven RBAC:** Move from hardcoded to editable roles/permissions
- **Implementation:** 8 phases, 92 hours total (11.5 days)
- **Breaking Changes:** URL migrations, permission renames

**Target Structure:**
```
/admin/
├── games/          # Keep as-is
├── users/          # Enhanced: Users | Roles | Permissions tabs
├── cameras/        # NEW standalone page
└── system/         # NEW unified: Health | Network | Alerts | Logs | Storage tabs
```

---

### 2. TODO.json Updates

**File:** `project-docs/project-tracking/TODO.json`
**Last Updated:** 2025-10-01

#### Tasks Updated

| Task ID | Old Status | New Status | Notes |
|---------|-----------|-----------|-------|
| P3-017 | NOT_STARTED | **COMPLETED** | ✅ Critical fix! Storage page exists and works |
| P3-016 | NOT_STARTED | **ACTIVE** | Estimate: 18 hours |
| P4-008 | NOT_STARTED | **ACTIVE** | Estimate: 20 hours (enhanced) |
| P3-013 | IN_REVIEW | IN_REVIEW | Added enhancement note for Phase 4 tabs |

#### Tasks Added (5 new tasks = 38 hours)

| Task ID | Title | Phase | Hours | Priority |
|---------|-------|-------|-------|----------|
| **P3-RBAC-001** | Database schema & migrations for RBAC system | Phase 1 | 8h | CRITICAL |
| **P3-RBAC-002** | Update contracts & RBAC logic for database-driven permissions | Phase 2 | 4h | CRITICAL |
| **P3-RBAC-003** | Backend API routes for roles, permissions, and cameras | Phase 3 | 12h | HIGH |
| **P4-NAV-001** | Update navigation sidebar with new admin pages | Phase 7 | 2h | MEDIUM |
| **P6-ADMIN-QA** | Testing & QA for unified admin panel system | Phase 8 | 12h | CRITICAL |

**Task Counts After Updates:**
- Phase 3: 22 → 25 tasks (+3)
- Phase 4: 10 → 11 tasks (+1)
- Phase 6: 7 → 8 tasks (+1)

#### P3-RBAC-001 Details (Database Schema)

**Acceptance Criteria:**
- Create `roles`, `permissions`, `role_permissions` tables
- Create `cameras` table with encrypted credentials
- Add `role_id` FK to `operators` table
- Seed 4 system roles, 24 permissions, default mappings
- Backfill existing operator roles to role_id FKs
- Test migrations on fresh DB and Session 37 state

**Files:**
- `apps/escapeplan-api/migrations/0001_add_rbac_tables.sql`
- `apps/escapeplan-api/migrations/0002_add_cameras_table.sql`
- `apps/escapeplan-api/migrations/0003_add_operator_role_id.sql`

#### P3-RBAC-002 Details (Contracts & Logic)

**Acceptance Criteria:**
- Expand `OperatorPermission` type to 24 permissions
- Add contracts: `RoleWithPermissions`, `PermissionSummary`
- Update `ensurePermission()` to query database
- Add `getRolePermissions(roleId)` helper
- Update Better-Auth session enrichment with `role_id`

**Files:**
- `packages/contracts/src/index.ts`
- `packages/contracts/src/rbac.ts`
- `apps/escapeplan-api/src/security.ts`
- `apps/escapeplan-api/src/auth-config.ts`

#### P3-RBAC-003 Details (Backend API Routes)

**New Endpoints:**
```typescript
// Roles
GET/POST/PATCH/DELETE /api/admin/roles
GET/PATCH /api/admin/roles/:id/permissions

// Permissions
GET /api/admin/permissions
GET /api/admin/permissions/matrix

// Cameras
GET/POST/PATCH/DELETE /api/admin/cameras
POST /api/admin/cameras/:id/test
POST /api/admin/cameras/:id/start
POST /api/admin/cameras/:id/stop
```

**New Directory:** `apps/escapeplan-api/src/cameras/`
- `controller.ts` - Camera CRUD
- `encryption.ts` - Credential encryption (libsodium)
- `connection.ts` - Connection testing
- `streaming.ts` - HLS stream management

---

### 3. dashboard-plan.md Architecture Document

**File:** `project-docs/dashboard-plan.md`
**Version:** 3.0
**Status:** Complete rewrite

**New Sections:**
1. **Current State (Session 37)** - Existing admin pages table, RBAC status, known issues
2. **Target Architecture** - Unified admin panel structure, database-driven RBAC, sidebar navigation
3. **Migration Strategy** - 8 phases with detailed actions, validation steps, testing
4. **Implementation Roadmap** - 92-hour timeline with task IDs
5. **Technical Stack** - Current architecture, no breaking stack changes
6. **Breaking Changes & Redirects** - URL migrations, permission renames

**Key Additions:**
- Current admin pages status table (7 pages documented)
- Permission expansion: 12 → 24 (13 new, 1 removed)
- Database schema for `roles`, `permissions`, `role_permissions`, `cameras`
- Phase-by-phase migration guide with bash validation scripts
- Success metrics (quantitative + qualitative)

**Audit Findings Merged:**
- ✅ Storage page status corrected (COMPLETED, not NOT_STARTED)
- ✅ Navigation gaps identified (3 pages missing from sidebar)
- ✅ Coarse permission issue (`manage_system_settings` too broad)
- ✅ Hardcoded RBAC limitations documented

---

## Key Decisions Documented

### 1. Database-Driven RBAC

**Problem:** Hardcoded permissions require code changes to customize roles.

**Solution:** Store permissions in database, allow admins to create custom roles dynamically.

**Benefits:**
- Flexibility for business-specific roles (e.g., "Senior Operator", "Intern")
- No code deployments needed for permission changes
- Audit trail for permission grants/revokes

### 2. Tabbed Interface Architecture

**Problem:** 6 scattered admin pages, 3 not in sidebar.

**Solution:** Consolidate into 4 unified pages with tabs.

**Benefits:**
- Reduced sidebar clutter (6 links → 4 links)
- Better mobile UX (swipeable tabs)
- Logical grouping of settings

### 3. Standalone Camera Page

**Problem:** Camera management is complex.

**Solution:** Dedicated `/admin/cameras` page instead of tab.

**Benefits:**
- Live preview thumbnails (5s refresh)
- Room drag-drop assignment
- Detailed diagnostics UI

---

## Permission Expansion Details

### Removed (1)
- ❌ `manage_system_settings` (too broad)

### Added (13)

**Camera Management:**
- `view_cameras`
- `manage_cameras`

**Storage Management:**
- `view_storage`
- `manage_storage`

**RBAC Management:**
- `view_roles`
- `manage_roles`
- `view_permissions`
- `manage_permissions`

**System Management:**
- `manage_alert_rules`
- `view_system_health`
- `manage_system_health`

**User Management:**
- `archive_users`

**Asset Management:**
- `manage_assets` (renamed from `manage_files`)

**Total:** 12 → 24 permissions (100% increase in granularity)

---

## Breaking Changes

### URL Redirects Required

| Old URL | New URL | Status |
|---------|---------|--------|
| `/admin/network` | `/admin/system#network` | Migration |
| `/admin/storage` | `/admin/system#storage` | Migration |
| `/admin/system/alerts` | `/admin/system#alerts` | Migration |
| `/admin/system/logs` | `/admin/system#logs` | Migration |

**Implementation:** Add redirects in `hooks.server.ts` or `+layout.server.ts`

### Permission Renames

| Old | New | Action |
|-----|-----|--------|
| `manage_system_settings` | `manage_alert_rules`, `manage_system_health`, `manage_network` | Split |
| `manage_files` | `manage_assets` | Rename |

---

## Database Migrations Preview

### New Tables (4)

1. **roles** - System (admin, manager, game_master, customer) + custom roles
2. **permissions** - All 24 permissions with labels, categories, descriptions
3. **role_permissions** - Junction table for role-permission mappings
4. **cameras** - Camera configuration with encrypted credentials

### Modified Tables (1)

- **operators** - Add `role_id` FK (keep `role` for Better-Auth compatibility)

### Migration Strategy

```bash
# Backup database
cp apps/escapeplan-api/data/escapeplan.db \
   apps/escapeplan-api/data/escapeplan-backup-session37.db

# Run migrations
cd apps/escapeplan-api
npx drizzle-kit migrate
pnpm db:seed

# Verify
sqlite3 data/escapeplan.db "SELECT * FROM roles;"
sqlite3 data/escapeplan.db "SELECT COUNT(*) FROM permissions;" # Expected: 24
```

---

## Implementation Roadmap

| Phase | Duration | Focus | TODO Task | Status |
|-------|----------|-------|-----------|--------|
| 1 | 8h | Database schema & migrations | P3-RBAC-001 | NOT_STARTED |
| 2 | 4h | Contracts & RBAC logic | P3-RBAC-002 | NOT_STARTED |
| 3 | 12h | Backend API routes | P3-RBAC-003 | NOT_STARTED |
| 4 | 16h | User Management tabs | P3-013 (enhance) | IN_REVIEW |
| 5 | 18h | Camera Management page | P3-016 | ACTIVE |
| 6 | 20h | System Dashboard tabs | P4-008 (enhance) | ACTIVE |
| 7 | 2h | Navigation sidebar | P4-NAV-001 | NOT_STARTED |
| 8 | 12h | Testing & QA | P6-ADMIN-QA | NOT_STARTED |
| **Total** | **92h** | **11.5 days** | 8 tasks | - |

---

## Files Modified

### Documentation Updated
- ✅ `project-docs/project-tracking/TODO.json` (5 new tasks, 4 status updates)
- ✅ `project-docs/dashboard-plan.md` (complete rewrite, 540 lines)
- ✅ `project-docs/project-tracking/sessions/SESSION_38_NOTES.md` (this file)

### No Code Changes
- This was a planning and documentation session
- No application code modified
- No migrations run

---

## Next Steps

### Immediate (Session 39)

**Option A: Start Phase 1 - Database Schema**
1. Create migrations for RBAC tables
2. Create cameras table migration
3. Add role_id FK to operators
4. Seed system roles and permissions
5. Test migrations on Session 37 database

**Option B: Quick Win - Fix Navigation Sidebar**
1. Add Storage link to sidebar (1 hour)
2. Add System Alerts link to sidebar (30 min)
3. Add System Logs link to sidebar (30 min)
4. Test permission-based visibility

**Recommendation:** Start with **Option B** to make existing pages accessible, then proceed to Phase 1.

### Medium-Term (Next 2-3 Sessions)

1. Complete Phase 1 (P3-RBAC-001) - 8 hours
2. Complete Phase 2 (P3-RBAC-002) - 4 hours
3. Start Phase 3 (P3-RBAC-003) - 12 hours
4. Update sidebar with Camera and System Dashboard links

### Long-Term (Sessions 40-45)

1. Build Camera Management page (P3-016) - 18 hours
2. Build System Dashboard tabs (P4-008) - 20 hours
3. Enhance User Management tabs (P3-013) - 16 hours
4. Complete testing & QA (P6-ADMIN-QA) - 12 hours

---

## Risks & Mitigations

### Risk 1: Migration Breaks Existing Operators
**Mitigation:** Database backup before migration, test on copy first

### Risk 2: Permission Logic Change Causes Regression
**Mitigation:** Maintain backward compatibility, comprehensive test coverage

### Risk 3: Camera Credential Encryption Key Management
**Mitigation:** Use environment variables, document key rotation process

### Risk 4: URL Redirects Break Bookmarks
**Mitigation:** Implement 302 redirects, add migration notice in UI

---

## Success Criteria (from DASHBOARD_SYSTEM.md)

### Quantitative
- ✅ Permission Granularity: 12 → 24 (100% increase)
- ✅ Admin Pages: 6 scattered → 4 unified (33% reduction)
- ✅ Sidebar Links: 3 visible → 4 visible (all accessible)
- 🔲 Test Coverage: >85% for new code
- 🔲 Performance: <200ms page load

### Qualitative
- 🔲 Admins can customize roles without code changes
- 🔲 Operators find settings easily (tabbed interface)
- 🔲 Camera setup is intuitive (connection test + preview)
- 🔲 System health is transparent (metrics dashboard)
- 🔲 Permission matrix is understandable (clear labels)

---

## References

- **Full Specification:** `project-docs/specifications/DASHBOARD_SYSTEM.md`
- **Architecture Plan:** `project-docs/dashboard-plan.md`
- **Audit Report:** `project-docs/admin-panel-research-audit.md`
- **TODO Tracking:** `project-docs/project-tracking/TODO.json`

---

**Session Duration:** ~2 hours
**Next Session:** Session 39 - Navigation sidebar quick fix OR Phase 1 database migrations
**Handoff Notes:** All documentation updated. Ready to begin implementation.
