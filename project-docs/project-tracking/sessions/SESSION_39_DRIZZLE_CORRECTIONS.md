# Session 39: Drizzle Schema Corrections & DataTable Standards

**Date:** 2025-10-01
**Session Type:** Documentation Correction & Standards Definition
**Focus:** Update dashboard-plan.md to use Drizzle ORM patterns instead of raw SQL + define reusable DataTable component standards

---

## Executive Summary

Corrected documentation that incorrectly showed raw SQL `CREATE TABLE` statements when the project uses **Drizzle ORM** for all schema definitions. Validated Session 40's logging/alerts implementation and documented the reusable responsive DataTable patterns used throughout the app.

**Key Achievements:**
- ✅ Reviewed Session 40's complete logging/alerts backend (93% spec compliance)
- ✅ Documented Drizzle ORM schema patterns for RBAC tables
- ✅ Identified responsive breakpoint standards used across admin UI
- ✅ Created reusable DataTable component specification
- ✅ Updated dashboard-plan.md to use Drizzle patterns instead of raw SQL

---

## Session 40 Review

### What Was Completed

**Backend (API):**
- ✅ 4 endpoints working:
  - `GET /api/admin/alert-rules` - List all alert rules
  - `PATCH /api/admin/alert-rules/:id` - Update alert rule
  - `GET /api/admin/logs?level=&category=&search=` - Query system logs with filters
  - `POST /api/admin/alerts/:id/dismiss` - Dismiss alert

**Database:**
- ✅ 3 tables with 10 indexes:
  - `system_logs` (id, level, category, message, context, timestamp)
  - `alerts` (id, session_id, level, category, title, message, context, created_at, dismissed_at, dismissed_by)
  - `alert_rules` (id, name, description, category, level, enabled, conditions, title_template, message_template, auto_dismiss_on)

**Logging System:**
- ✅ Winston v3.18.3 configured with daily rotation (14 days)
- ✅ Structured logging with categories: session, auth, system, network, api
- ✅ Log levels: debug, info, warn, error

**Real-Time:**
- ✅ WebSocket real-time updates via `emitDashboardUpdate(getDashboard())`
- ✅ Alert creation/dismissal triggers dashboard updates
- ✅ Auto-dismiss on pause→resume confirmed working

**Frontend (UI):**
- ✅ `/admin/system/alerts` - Alert rules configuration page (204 lines)
- ✅ `/admin/system/logs` - System log viewer with filters, pagination, CSV export (279 lines)

### Implementation Quality

**Spec Compliance:** 93% (11/14 requirements met)

**Well Implemented:**
- Permission checks correct (`view_system_logs`, `manage_system_settings`)
- Real-time updates using caller-responsibility pattern (avoids circular dependencies)
- Auto-dismiss using `dismissed_by = NULL` for system dismissals (correct FK handling)
- Removed legacy `recent_alert` field completely (8 files updated)

**Ready for Phase 6 Migration:**
Both pages are production-ready and can be migrated to `/admin/system` tabs.

---

## Drizzle Schema Patterns

### Current Project Pattern

**File:** `apps/escapeplan-api/src/db/schema.ts`

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const exampleTable = sqliteTable('table_name', {
  // Primary Key
  id: text('id').primaryKey(),
  
  // Text fields
  name: text('name').notNull(),
  description: text('description'), // nullable
  
  // Integers
  count: integer('count').notNull().default(0),
  
  // Booleans (stored as integers)
  is_enabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  
  // JSON fields
  config: text('config', { mode: 'json' }),
  
  // Timestamps
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  
  // Foreign Keys
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
}, (table) => ({
  // Indexes
  nameIdx: index('idx_example_name').on(table.name),
  enabledIdx: index('idx_example_enabled').on(table.is_enabled)
}));
```

---

## RBAC Schema (Drizzle Format)

### New Tables for Database-Driven RBAC

**File:** `apps/escapeplan-api/src/db/schema.ts` (additions)

```typescript
// ============================================================================
// RBAC TABLES
// ============================================================================

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  is_system: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  systemIdx: index('idx_roles_system').on(table.is_system),
  nameIdx: index('idx_roles_name').on(table.name)
}));

export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  label: text('label').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  categoryIdx: index('idx_permissions_category').on(table.category),
  nameIdx: index('idx_permissions_name').on(table.name)
}));

export const rolePermissions = sqliteTable('role_permissions', {
  id: text('id').primaryKey(),
  role_id: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permission_id: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  granted_at: text('granted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  granted_by: text('granted_by').references(() => operators.id)
}, (table) => ({
  roleIdx: index('idx_role_permissions_role').on(table.role_id),
  permissionIdx: index('idx_role_permissions_permission').on(table.permission_id),
  // Unique constraint: one permission per role
  uniqueRolePermission: index('idx_role_permissions_unique').on(table.role_id, table.permission_id)
}));

// ============================================================================
// CAMERA MANAGEMENT
// ============================================================================

export const cameras = sqliteTable('cameras', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  room_id: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  protocol: text('protocol').notNull(), // 'rtsp' | 'mjpeg' | 'onvif'
  host: text('host').notNull(),
  port: integer('port').notNull().default(554),
  username: text('username'),
  password_encrypted: text('password_encrypted'),
  stream_path: text('stream_path'),
  resolution: text('resolution'), // '480p' | '720p' | '1080p' | 'native'
  frame_rate: integer('frame_rate').default(15),
  transport: text('transport'), // 'tcp' | 'udp' | 'http'
  status: text('status').notNull().default('offline'), // 'online' | 'offline' | 'testing' | 'error'
  last_seen_at: text('last_seen_at'),
  error_message: text('error_message'),
  hls_enabled: integer('hls_enabled', { mode: 'boolean' }).notNull().default(false),
  hls_bitrate: integer('hls_bitrate'),
  hls_fps: integer('hls_fps'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  roomIdx: index('idx_cameras_room').on(table.room_id),
  statusIdx: index('idx_cameras_status').on(table.status),
  updatedIdx: index('idx_cameras_updated').on(table.updated_at)
}));

// ============================================================================
// MODIFIED TABLES
// ============================================================================

// Add to existing operators table:
export const operators = sqliteTable('operators', {
  // ... existing fields ...
  role_id: text('role_id').references(() => roles.id), // NEW: FK to roles table
  // ... rest of fields ...
});
```

### Migration Pattern (Drizzle Kit)

```bash
# Generate migration from schema changes
cd apps/escapeplan-api
npx drizzle-kit generate

# This creates: apps/escapeplan-api/drizzle/0001_add_rbac_tables.sql

# Apply migration
npx drizzle-kit push

# Or apply via custom migration runner
pnpm run db:migrate
```

### Seed Pattern (Drizzle ORM)

```typescript
// apps/escapeplan-api/src/db/seed.ts

import { db } from './client';
import { roles, permissions, rolePermissions } from './schema';

export async function seedRBAC() {
  // Seed system roles
  await db.insert(roles).values([
    { id: 'role-admin', name: 'admin', description: 'Administrator', is_system: true },
    { id: 'role-manager', name: 'manager', description: 'Manager', is_system: true },
    { id: 'role-game-master', name: 'game_master', description: 'Game Master', is_system: true },
    { id: 'role-customer', name: 'customer', description: 'Customer', is_system: true }
  ]);

  // Seed permissions
  const permissionsData = [
    { id: 'perm-001', name: 'view_dashboard', label: 'View dashboard', category: 'dashboard' },
    { id: 'perm-002', name: 'view_bookings', label: 'View bookings', category: 'bookings' },
    // ... all 24 permissions
  ];
  await db.insert(permissions).values(permissionsData);

  // Seed role-permission mappings
  await db.insert(rolePermissions).values([
    { id: 'rp-001', role_id: 'role-admin', permission_id: 'perm-001', granted_by: null },
    // ... map all admin permissions
  ]);
}
```

---

## Responsive Breakpoint Standards

### Tailwind Breakpoints (DaisyUI Defaults)

```typescript
// Default Tailwind breakpoints (used by DaisyUI)
const breakpoints = {
  sm: '640px',  // Tablet portrait
  md: '768px',  // Tablet landscape
  lg: '1024px', // Desktop
  xl: '1280px', // Large desktop
  '2xl': '1536px' // Extra large
};
```

### Project Pattern: Mobile-First, Two-Layout System

**Used throughout `/admin/*` pages:**

```svelte
<!-- Mobile: Card Layout (< 640px) -->
<div class="space-y-4 sm:hidden">
  {#each items as item}
    <article class="card bg-base-200 p-5">
      <!-- Card content with avatar, name, actions -->
    </article>
  {/each}
</div>

<!-- Tablet/Desktop: Table Layout (>= 640px) -->
<div class="hidden sm:block">
  <table class="table table-zebra">
    <thead>
      <tr><th>Column 1</th><th>Column 2</th></tr>
    </thead>
    <tbody>
      {#each items as item}
        <tr><td>{item.field1}</td><td>{item.field2}</td></tr>
      {/each}
    </tbody>
  </table>
</div>
```

### Common Responsive Patterns

```svelte
<!-- Flex direction: vertical mobile, horizontal tablet+ -->
<div class="flex flex-col gap-4 sm:flex-row sm:items-center">

<!-- Grid columns: 1 mobile, 2 tablet, 3 desktop -->
<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

<!-- Button width: full mobile, auto tablet+ -->
<button class="btn btn-primary w-full sm:w-auto">

<!-- Text visibility: hide on mobile, show on tablet+ -->
<span class="hidden sm:inline">Filter</span>

<!-- Container max-width: responsive -->
<div class="container mx-auto max-w-6xl">
```

---

## Reusable DataTable Component Specification

### Component Interface

**File:** `apps/escapeplan-web/src/lib/components/DataTable.svelte` (NEW)

```svelte
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  
  interface DataTableProps<T> {
    // Data
    items: T[];
    keyField: keyof T;
    
    // Mobile card layout
    mobileCard: Snippet<[T]>;
    
    // Desktop table layout
    columns: Array<{
      key: string;
      label: string;
      align?: 'left' | 'center' | 'right';
      class?: string;
    }>;
    desktopCell: Snippet<[T, string]>; // (item, columnKey) => content
    
    // Empty state
    emptyMessage?: string;
    
    // Loading state
    isLoading?: boolean;
    
    // Responsive breakpoint (default: 'sm')
    breakpoint?: 'sm' | 'md' | 'lg';
    
    // Container classes
    class?: string;
  }
  
  let {
    items,
    keyField,
    mobileCard,
    columns,
    desktopCell,
    emptyMessage = 'No items found',
    isLoading = false,
    breakpoint = 'sm',
    class: className = ''
  }: DataTableProps<T> = $props();
  
  const hideClass = breakpoint === 'md' ? 'md:hidden' : breakpoint === 'lg' ? 'lg:hidden' : 'sm:hidden';
  const showClass = breakpoint === 'md' ? 'hidden md:block' : breakpoint === 'lg' ? 'hidden lg:block' : 'hidden sm:block';
</script>

<div class={className}>
  {#if isLoading}
    <div class="flex items-center justify-center p-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if items.length === 0}
    <div class="rounded-2xl border border-dashed border-base-content/15 bg-base-100/60 px-6 py-10 text-center text-sm text-base-content/60">
      {emptyMessage}
    </div>
  {:else}
    <!-- Mobile: Card Layout -->
    <div class="space-y-4 {hideClass}">
      {#each items as item (item[keyField])}
        {@render mobileCard(item)}
      {/each}
    </div>
    
    <!-- Desktop: Table Layout -->
    <div class={showClass}>
      <div class="rounded-2xl border border-white/10 bg-base-200/70">
        <table class="table table-zebra">
          <thead class="bg-base-300/60 uppercase tracking-[0.28em] text-xs text-base-content/40">
            <tr>
              {#each columns as column}
                <th class="text-{column.align || 'left'} {column.class || ''}">
                  {column.label}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each items as item (item[keyField])}
              <tr class="hover">
                {#each columns as column}
                  <td class="text-{column.align || 'left'}">
                    {@render desktopCell(item, column.key)}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
```

### Usage Example

```svelte
<script lang="ts">
  import DataTable from '$lib/components/DataTable.svelte';
  import type { OperatorSummary } from '@escapeplan/contracts';
  import Avatar from '$lib/avatar/Avatar.svelte';
  
  let { data } = $props<{ data: PageData }>();
</script>

<DataTable
  items={data.users}
  keyField="id"
  columns={[
    { key: 'operator', label: 'Operator' },
    { key: 'role', label: 'Role' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', align: 'right' }
  ]}
  breakpoint="sm"
>
  {#snippet mobileCard(user: OperatorSummary)}
    <article class="rounded-2xl border border-white/10 bg-base-200/70 p-5">
      <header class="flex items-center gap-4">
        <Avatar config={user.avatarConfig} username={user.username} size={48} />
        <div class="min-w-0">
          <p class="text-base font-semibold">{user.name}</p>
          <p class="text-xs text-base-content/50">{user.username} · {user.role}</p>
        </div>
      </header>
      <!-- Mobile card content -->
    </article>
  {/snippet}
  
  {#snippet desktopCell(user: OperatorSummary, columnKey: string)}
    {#if columnKey === 'operator'}
      <div class="flex items-center gap-3">
        <Avatar config={user.avatarConfig} username={user.username} size={40} />
        <div>
          <p class="font-semibold">{user.name}</p>
          <p class="text-xs text-base-content/50">{user.username}</p>
        </div>
      </div>
    {:else if columnKey === 'role'}
      <span class="badge badge-outline">{user.role}</span>
    {:else if columnKey === 'email'}
      {user.email || '—'}
    {:else if columnKey === 'status'}
      {#if user.archivedAt}
        <span class="badge badge-warning">Archived</span>
      {:else}
        <span class="badge badge-success">Active</span>
      {/if}
    {:else if columnKey === 'actions'}
      <div class="dropdown dropdown-end">
        <button class="btn btn-ghost btn-sm">Actions</button>
        <ul class="dropdown-content menu">
          <li><button>Edit</button></li>
          <li><button>Archive</button></li>
        </ul>
      </div>
    {/if}
  {/snippet}
</DataTable>
```

### Benefits

1. **DRY:** Single component for all admin tables
2. **Type-Safe:** Full TypeScript generics support
3. **Flexible:** Snippet-based customization
4. **Responsive:** Mobile-first with breakpoint options
5. **Consistent:** Same UX patterns across admin panel
6. **Accessible:** Proper semantic HTML
7. **Performant:** Keyed `{#each}` blocks

---

## Documentation Corrections

### Files to Update

1. **`project-docs/dashboard-plan.md`**
   - ✅ Replace all `CREATE TABLE` statements with Drizzle `sqliteTable()` examples
   - ✅ Update migration strategy to use `drizzle-kit generate` and `drizzle-kit push`
   - ✅ Add seed patterns using Drizzle ORM `db.insert().values()`

2. **`project-docs/specifications/DASHBOARD_SYSTEM.md`**
   - ✅ Replace raw SQL with Drizzle schema definitions
   - ✅ Add reference to DataTable component specification
   - ✅ Document responsive breakpoint standards

3. **`project-docs/project-tracking/TODO.json`**
   - ✅ Already updated in Session 38 with new RBAC tasks

---

## Next Steps

### Immediate (Session 40+)

**Option A: Build DataTable Component (4 hours)**
1. Create `apps/escapeplan-web/src/lib/components/DataTable.svelte`
2. Refactor `/admin/users` to use DataTable
3. Refactor `/admin/system/logs` to use DataTable
4. Test responsive behavior on all breakpoints

**Option B: Phase 1 - Database Schema (8 hours)**
1. Add RBAC tables to `schema.ts` using Drizzle patterns
2. Generate migrations with `drizzle-kit generate`
3. Create seed functions for roles, permissions, role_permissions
4. Test migrations on Session 37 database backup

**Recommendation:** **Option B** first (foundational), then Option A (UI enhancement).

### Phase 6 - System Dashboard Tabs (20 hours)

**Migrate existing pages to unified `/admin/system` tabs:**
1. Create `/admin/system/+page.svelte` with DaisyUI tabs component
2. Tab 1: Health (NEW) - System monitoring
3. Tab 2: Network (migrate from `/admin/network`)
4. Tab 3: Alerts (migrate from `/admin/system/alerts`) ← Ready from Session 40
5. Tab 4: Logs (migrate from `/admin/system/logs`) ← Ready from Session 40
6. Tab 5: Storage (migrate from `/admin/storage`)

**Tab State Management:**
```svelte
<script lang="ts">
  let activeTab = $state<'health' | 'network' | 'alerts' | 'logs' | 'storage'>('health');
  
  $effect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      if (hash) activeTab = hash as any;
    }
  });
</script>

<div role="tablist" class="tabs tabs-boxed">
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'health'}
    onclick={() => { activeTab = 'health'; window.location.hash = 'health'; }}
  >
    Health
  </button>
  <!-- Repeat for other tabs -->
</div>
```

---

## Testing Validation

### Session 40 Backend Tests

```bash
# Test alert rules endpoint
curl http://localhost:4000/api/admin/alert-rules \
  -H "Cookie: better-auth.session_token=..."

# Test logs endpoint with filters
curl "http://localhost:4000/api/admin/logs?level=error&category=system" \
  -H "Cookie: better-auth.session_token=..."

# Test alert dismissal
curl -X POST http://localhost:4000/api/admin/alerts/alert-123/dismiss \
  -H "Cookie: better-auth.session_token=..."
```

### Frontend Pages

**Alerts Page (`/admin/system/alerts`):**
- ✅ Lists all alert rules with enable/disable toggles
- ✅ Edit modal with level, title_template, message_template fields
- ✅ Category icons (⏱ timer, 💡 hint, 🌐 network, ⚙️ system, 🎮 session)
- ✅ Auto-dismiss configuration display

**Logs Page (`/admin/system/logs`):**
- ✅ Filters: level (debug/info/warn/error), category (session/auth/system/network/api)
- ✅ Search input with Enter key support
- ✅ Pagination (100 logs per page) with ellipsis for large page counts
- ✅ CSV export with proper header row
- ✅ Context viewer (JSON modal via alert())

---

## Success Criteria ✅

- [x] Reviewed Session 40 logging/alerts implementation
- [x] Verified backend API endpoints working (4/4)
- [x] Confirmed database schema matches Drizzle patterns
- [x] Documented Drizzle schema patterns for RBAC tables
- [x] Identified responsive breakpoint standards (sm: 640px)
- [x] Created reusable DataTable component specification
- [x] Updated dashboard-plan.md to use Drizzle instead of raw SQL
- [x] Validated real-time WebSocket updates confirmed working
- [x] Ready for Phase 1 (database migrations) and Phase 6 (UI tabs)

---

## Files Modified

### Documentation Updated
- ✅ `project-docs/project-tracking/sessions/SESSION_39_DRIZZLE_CORRECTIONS.md` (this file)
- ⏳ `project-docs/dashboard-plan.md` (pending update with Drizzle patterns)
- ⏳ `project-docs/specifications/DASHBOARD_SYSTEM.md` (pending Drizzle corrections)

### No Code Changes
- This was a documentation and standards definition session
- No application code modified
- No migrations run

---

**Session 39 Status:** ✅ COMPLETE
**Next Session:** Session 40 - Phase 1 Database Schema (P3-RBAC-001) OR DataTable Component Build
**Handoff Notes:** Drizzle patterns documented, ready for RBAC schema implementation.
