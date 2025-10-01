# EscapePlan Dashboard & Admin Panel - Architecture & Migration Plan

**Document Version:** 3.0
**Last Updated:** 2025-10-01 (Session 38)
**Status:** Migration Planning
**Related Specs:** [DASHBOARD_SYSTEM.md](specifications/DASHBOARD_SYSTEM.md)
**Related Audits:** [Admin Panel Research Audit](admin-panel-research-audit.md)

---

## Table of Contents

1. [Current State (Session 37)](#current-state-session-37)
2. [Target Architecture](#target-architecture)
3. [Migration Strategy](#migration-strategy)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Technical Stack](#technical-stack)
6. [Breaking Changes & Redirects](#breaking-changes--redirects)

---

## Current State (Session 37)

### Existing Admin Pages

| URL | Status | Features | Sidebar Visibility | Issues |
|-----|--------|----------|-------------------|--------|
| `/admin/games` | ✅ Working | Game CRUD, puzzle management, hint configuration | ✅ Visible (manage_games) | None |
| `/admin/users` | ✅ Working | User CRUD, archive/unarchive, role assignment, avatar management | ✅ Visible (manage_users) | Roles assigned inline only, no dedicated Roles/Permissions UI |
| `/admin/network` | ✅ Working | SSID configuration, network settings | ✅ Visible (view_network) | Will migrate to `/admin/system#network` |
| `/admin/storage` | ✅ **COMPLETED** | Storage overview, asset library, backups | ❌ **NOT IN SIDEBAR** | TODO.json incorrectly listed as NOT_STARTED |
| `/admin/system/alerts` | ✅ Working | Alert rule configuration | ❌ **NOT IN SIDEBAR** | Will migrate to `/admin/system#alerts` |
| `/admin/system/logs` | ✅ Working | System log viewer with filters | ❌ **NOT IN SIDEBAR** | Will migrate to `/admin/system#logs` |
| `/admin/cameras` | ❌ Not Built | - | N/A | Priority task P3-016 (18h) |

### Current RBAC System

**Hardcoded Permissions (12 total):**
```typescript
export type OperatorPermission =
  | 'view_dashboard'
  | 'view_bookings'
  | 'manage_bookings'
  | 'manage_sessions'
  | 'view_games'
  | 'manage_games'
  | 'view_network'
  | 'manage_network'
  | 'manage_users'
  | 'manage_files'
  | 'view_system_logs'
  | 'manage_system_settings'; // ⚠️ Too broad
```

**Roles (4 system roles):**
- `admin` - Full access to all permissions
- `manager` - Most permissions except manage_system_settings
- `game_master` - Session control, view cameras, view games
- `customer` - Dashboard and bookings view only

**RBAC Implementation:**
- ✅ Better-Auth v1.3 with username plugin
- ✅ Drizzle SQLite adapter
- ✅ Custom session enrichment with role/permissions
- ✅ Permission checks in API routes via `ensurePermission()`
- ✅ Permission-based sidebar visibility
- ❌ Hardcoded permission matrix (cannot customize roles without code changes)
- ❌ No standalone Roles/Permissions management UI

### Known Issues

1. **Navigation Gaps:** 3 admin pages not in sidebar (Storage, Alerts, Logs)
2. **Coarse Permissions:** `manage_system_settings` is too broad
3. **Hardcoded RBAC:** Cannot create/edit custom roles dynamically
4. **Scattered Admin UX:** No unified system dashboard experience
5. **TODO.json Accuracy:** P3-017 (Storage) incorrectly marked NOT_STARTED

---

## Target Architecture

### Unified Admin Panel Structure

```
/admin/
├── games/              # Keep as-is (Game CRUD)
├── users/              # Enhanced with 3 tabs
│   ├── [users]         → Users list (existing + bulk actions)
│   ├── #roles          → Role management (NEW)
│   └── #permissions    → Permission matrix viewer (NEW)
├── cameras/            # NEW standalone page (P3-016)
│   └── [camera CRUD]   → Camera configuration, HLS management
└── system/             # NEW unified dashboard with 5 tabs
    ├── #health         → System status monitoring (NEW)
    ├── #network        → Network control (MIGRATED)
    ├── #alerts         → Alert rules (MIGRATED)
    ├── #logs           → System logs (MIGRATED)
    └── #storage        → Storage management (MIGRATED)
```

### Database-Driven RBAC

**New Tables:**
```sql
-- System and custom roles
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- All 24 permissions
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Junction table
CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES operators(id),
  UNIQUE(role_id, permission_id)
);

-- Camera configuration with encrypted credentials
CREATE TABLE cameras (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  protocol TEXT NOT NULL CHECK(protocol IN ('rtsp', 'mjpeg', 'onvif')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 554,
  username TEXT,
  password_encrypted TEXT,
  stream_path TEXT,
  resolution TEXT,
  frame_rate INTEGER DEFAULT 15,
  transport TEXT CHECK(transport IN ('tcp', 'udp', 'http')),
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen_at TEXT,
  error_message TEXT,
  hls_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Permission Expansion (12 → 24):**

**Removed:**
- ❌ `manage_system_settings` (split into granular permissions)

**Added:**
```typescript
// Camera management
| 'view_cameras'
| 'manage_cameras'

// Storage management
| 'view_storage'
| 'manage_storage'

// Role & permission management
| 'view_roles'
| 'manage_roles'
| 'view_permissions'
| 'manage_permissions'

// Alert management
| 'manage_alert_rules'

// System health monitoring
| 'view_system_health'
| 'manage_system_health'

// Operator archiving (dangerous action)
| 'archive_users'

// Asset management (renamed from manage_files)
| 'manage_assets'
```

### Updated Sidebar Navigation

```typescript
const adminLinks = $derived([
  // Game Settings (manage_games)
  ...(canManageGames ? [{ href: '/admin/games', label: 'Game Settings', icon: '...' }] : []),

  // User Management (manage_users OR view_roles)
  ...(canManageUsers || canViewRoles
    ? [{ href: '/admin/users', label: 'User Management', icon: '...' }]
    : []),

  // Camera Management (view_cameras OR manage_cameras) - NEW
  ...(canViewCameras || canManageCameras
    ? [{ href: '/admin/cameras', label: 'Camera Management', icon: '...' }]
    : []),

  // System Dashboard (view_system_logs OR manage_alert_rules OR view_network) - NEW
  ...(canViewSystemLogs || canManageAlertRules || canViewNetwork
    ? [{ href: '/admin/system', label: 'System Dashboard', icon: '...' }]
    : [])
]);
```

---

## Migration Strategy

### Phase 1: Database Schema & Migrations (8 hours)
**Task:** P3-RBAC-001

**Actions:**
1. Create migration: `0001_add_rbac_tables.sql`
   - Add `roles`, `permissions`, `role_permissions` tables
   - Seed 4 system roles
   - Seed 24 permissions with categories
   - Seed default role-permission mappings
2. Create migration: `0002_add_cameras_table.sql`
   - Add `cameras` table with encrypted credential support
3. Create migration: `0003_add_operator_role_id.sql`
   - Add `role_id` FK to `operators` table
   - Backfill existing operator roles to role_id FKs
   - Keep `role` column for Better-Auth compatibility

**Validation:**
```bash
# Backup existing database
cp apps/escapeplan-api/data/escapeplan.db apps/escapeplan-api/data/escapeplan-backup-session37.db

# Run migrations
cd apps/escapeplan-api
npx drizzle-kit migrate
pnpm db:seed

# Verify
sqlite3 data/escapeplan.db "SELECT * FROM roles;"
sqlite3 data/escapeplan.db "SELECT COUNT(*) FROM permissions;" # Expected: 24
sqlite3 data/escapeplan.db "SELECT username, role, role_id FROM operators;"
```

### Phase 2: Update Contracts & RBAC Logic (4 hours)
**Task:** P3-RBAC-002

**Actions:**
1. Update `packages/contracts/src/index.ts`
   - Expand `OperatorPermission` type to 24 permissions
   - Add `RoleWithPermissions`, `PermissionSummary` interfaces
2. Update `packages/contracts/src/rbac.ts`
   - Update `PERMISSION_LABELS` with all 24 permissions
   - Update `ROLE_PERMISSIONS` with new mappings
3. Update `apps/escapeplan-api/src/security.ts`
   - Refactor `ensurePermission()` to query database instead of hardcoded matrix
   - Add `getRolePermissions(roleId)` helper
4. Update `apps/escapeplan-api/src/auth-config.ts`
   - Enrich session with `role_id` field

**Testing:**
```bash
pnpm --filter @escapeplan/contracts build
pnpm --filter escapeplan-api test
```

### Phase 3: Backend API Routes (12 hours)
**Task:** P3-RBAC-003

**New Endpoints:**
```typescript
// Roles management
GET    /api/admin/roles
POST   /api/admin/roles
GET    /api/admin/roles/:id
PATCH  /api/admin/roles/:id
DELETE /api/admin/roles/:id
GET    /api/admin/roles/:id/permissions
PATCH  /api/admin/roles/:id/permissions

// Permissions
GET    /api/admin/permissions
GET    /api/admin/permissions/matrix

// Cameras
GET    /api/admin/cameras
POST   /api/admin/cameras
GET    /api/admin/cameras/:id
PATCH  /api/admin/cameras/:id
DELETE /api/admin/cameras/:id
POST   /api/admin/cameras/:id/test
POST   /api/admin/cameras/:id/start
POST   /api/admin/cameras/:id/stop
```

**New Directory Structure:**
```
apps/escapeplan-api/src/
├── cameras/
│   ├── controller.ts       # Camera CRUD
│   ├── encryption.ts       # Credential encryption (libsodium)
│   ├── connection.ts       # Connection testing
│   └── streaming.ts        # HLS stream management
└── index.ts                # Add new routes
```

### Phase 4: User Management Tabs (16 hours)
**Task:** P3-013 Enhancement

**Implementation:**
1. Add tab navigation to `/admin/users/+page.svelte`
2. Build **Users Tab** with bulk actions (CSV export, bulk role change)
3. Build **Roles Tab** with role list, permission editor
4. Build **Permissions Tab** with read-only permission matrix

**New Components:**
- `apps/escapeplan-web/src/lib/components/RoleModal.svelte`
- `apps/escapeplan-web/src/lib/components/PermissionCheckboxGroup.svelte`

### Phase 5: Camera Management Page (18 hours)
**Task:** P3-016

**Implementation:**
1. Create `/admin/cameras/+page.svelte`
2. Build camera list with live preview thumbnails (5s refresh)
3. Build add/edit camera modal with connection test
4. Implement HLS stream start/stop controls
5. Add drag-drop room assignment

### Phase 6: System Dashboard Tabs (20 hours)
**Task:** P4-008 Enhancement

**Implementation:**
1. Create `/admin/system/+page.svelte` with 5 tabs
2. Build **Health Tab** (NEW) - service status, system resources, diagnostics
3. Migrate **Network Tab** from `/admin/network`
4. Migrate **Alerts Tab** from `/admin/system/alerts`
5. Migrate **Logs Tab** from `/admin/system/logs`
6. Migrate **Storage Tab** from `/admin/storage`

### Phase 7: Update Navigation Sidebar (2 hours)
**Task:** P4-NAV-001

**Actions:**
1. Add Camera Management link to sidebar
2. Add System Dashboard link to sidebar
3. Update User Management permission check to include `view_roles`
4. Test responsive layouts

### Phase 8: Testing & QA (12 hours)
**Task:** P6-ADMIN-QA

**Coverage:**
- Unit tests: RBAC logic, camera CRUD, encryption
- Integration tests: Role creation flow, camera connection, HLS streaming
- E2E tests: Admin creates role → assigns to user → user sees permitted tabs
- Migration tests: Session 37 DB → new schema
- Manual QA: All admin pages, mobile/desktop layouts

---

## Implementation Roadmap

| Phase | Duration | Focus | TODO Tasks | Status |
|-------|----------|-------|------------|--------|
| **Phase 1** | 8h | Database schema & migrations | P3-RBAC-001 | NOT_STARTED |
| **Phase 2** | 4h | Contracts & RBAC logic | P3-RBAC-002 | NOT_STARTED |
| **Phase 3** | 12h | Backend API routes | P3-RBAC-003 | NOT_STARTED |
| **Phase 4** | 16h | User Management tabs | P3-013 (enhance) | IN_REVIEW |
| **Phase 5** | 18h | Camera Management page | P3-016 | ACTIVE |
| **Phase 6** | 20h | System Dashboard tabs | P4-008 (enhance) | ACTIVE |
| **Phase 7** | 2h | Navigation sidebar | P4-NAV-001 | NOT_STARTED |
| **Phase 8** | 12h | Testing & QA | P6-ADMIN-QA | NOT_STARTED |
| **Total** | **92h** | **11.5 days** | 8 tasks | - |

---

## Technical Stack

### Current Architecture (Session 37)

**Backend:**
- Fastify v5.6.1 - HTTP server
- Better-Auth v1.3.24 - Authentication (username plugin + admin plugin)
- Drizzle v0.44.5 - ORM
- SQLite + WAL mode - Database
- Socket.IO 5 - Real-time updates
- Winston v3.18.2 - Structured logging

**Frontend:**
- SvelteKit 2 - SSR framework
- Svelte 5 Runes - Reactive state
- DaisyUI 5.1.25 - UI components
- Tailwind CSS 4 - Styling
- Better-Auth Client - Session management
- Vite 5 - Build tool

**Deployment:**
- Raspberry Pi OS Bookworm (64-bit)
- Node.js 24 LTS
- Nginx v1.29.1 - Reverse proxy
- pnpm 9 - Package manager

### Tech Stack After Migration

**No changes to core stack** - only additions:

**New Backend Libraries:**
- `libsodium-wrappers` - Camera credential encryption (already available)
- `ffmpeg` process management - Camera stream testing (already available)

**New Frontend Components:**
- DaisyUI tabs - Tab navigation pattern
- DaisyUI radial progress - System health metrics

---

## Breaking Changes & Redirects

### URL Redirects Required

```typescript
// Add to apps/escapeplan-web/src/hooks.server.ts or +layout.server.ts
const ADMIN_REDIRECTS: Record<string, string> = {
  '/admin/network': '/admin/system#network',
  '/admin/storage': '/admin/system#storage',
  '/admin/system/alerts': '/admin/system#alerts',
  '/admin/system/logs': '/admin/system#logs'
};

export async function handle({ event, resolve }) {
  const redirectTarget = ADMIN_REDIRECTS[event.url.pathname];
  if (redirectTarget) {
    return new Response(null, {
      status: 302,
      headers: { Location: redirectTarget }
    });
  }

  return resolve(event);
}
```

### Permission Name Changes

| Old Permission | New Permission(s) | Migration Action |
|---------------|-------------------|------------------|
| `manage_system_settings` | `manage_alert_rules`, `manage_system_health`, `manage_network` | Split into 3 granular permissions |
| `manage_files` | `manage_assets` | Rename for clarity |

### Database Schema Changes

**Non-Breaking:**
- Add `role_id` FK to `operators` (keep `role` column for Better-Auth)
- Add new tables: `roles`, `permissions`, `role_permissions`, `cameras`

**Breaking (for external integrations):**
- Permission check logic changes from hardcoded to database queries
- Role assignment API may need updates if external systems create operators

---

## Key Decisions

### 1. Why Database-Driven RBAC?

**Problem:** Hardcoded permissions require code changes to customize roles.

**Solution:** Store permissions in database, allow admins to create custom roles dynamically.

**Benefits:**
- Flexibility for business-specific roles (e.g., "Senior Operator", "Intern")
- No code deployments needed for permission changes
- Audit trail for permission grants/revokes
- Supports future multi-tenant scenarios

### 2. Why Tabbed Interfaces?

**Problem:** 6 scattered admin pages, 3 not even in sidebar.

**Solution:** Consolidate related functionality into tabbed SPA-style interfaces.

**Benefits:**
- Unified admin experience (User Management, System Dashboard)
- Reduced sidebar clutter (6 links → 4 links)
- Better mobile UX (swipeable tabs)
- Logical grouping of settings

### 3. Why Standalone Camera Page?

**Problem:** Camera management is complex enough to warrant its own page.

**Solution:** Dedicated `/admin/cameras` page with full CRUD, connection testing, HLS controls.

**Benefits:**
- Live preview thumbnails (not appropriate for tabs)
- Room drag-drop assignment
- Detailed diagnostics UI
- Doesn't clutter System Dashboard

---

## Success Metrics

### Quantitative
- **Permission Granularity:** 12 → 24 permissions (100% increase)
- **Admin Pages:** 6 scattered → 4 unified (33% reduction in nav items)
- **Sidebar Links:** 3 visible → 4 visible (all pages accessible)
- **Test Coverage:** >85% for new code
- **Performance:** <200ms page load for all admin pages

### Qualitative
- Admins can customize roles without code changes ✅
- Operators find settings easily (tabbed interface) ✅
- Camera setup is intuitive (connection test + preview) ✅
- System health is transparent (metrics dashboard) ✅
- Permission matrix is understandable (clear labels) ✅

---

## References

- **Full Specification:** [DASHBOARD_SYSTEM.md](specifications/DASHBOARD_SYSTEM.md)
- **Audit Report:** [Admin Panel Research Audit](admin-panel-research-audit.md)
- **TODO Tracking:** `project-docs/project-tracking/TODO.json`
- **Session Notes:** `project-docs/project-tracking/sessions/SESSION_38_NOTES.md` (pending)

---

**Last Updated:** 2025-10-01
**Next Review:** After Phase 1 completion (P3-RBAC-001)
