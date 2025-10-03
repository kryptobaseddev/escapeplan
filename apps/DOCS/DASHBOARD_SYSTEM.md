# Dashboard & Admin Panel System Specification

**Document Version:** 2.0
**Created:** 2025-10-01
**Status:** Implementation Phase
**Target:** Session 38+
**Related:** P3-013, P3-016, P3-017, P4-008, US-035, US-036, US-039, US-040

---

## Executive Summary

This document defines the complete architecture for EscapePlan's unified Admin Panel system, including User Management, System Dashboard, Camera Management, and RBAC (Role-Based Access Control) with database-driven permissions.

**Key Changes:**
1. **Unified Tabbed Interfaces** - Group related admin functions into SPA-style tabbed pages
2. **Database-Driven RBAC** - Move from hardcoded permissions to editable database records
3. **Fine-Grained Permissions** - Expand from 12 to 20+ granular CRUD permissions
4. **Breaking Changes** - Consolidate `/admin/network` and `/admin/storage` into `/admin/system`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [URL Structure](#url-structure)
4. [Permission System](#permission-system)
5. [Database Schema](#database-schema)
6. [Implementation Plan](#implementation-plan)
7. [User Stories](#user-stories)
8. [Migration Guide](#migration-guide)
9. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### Current State (Session 37)

**Existing Pages:**
- ✅ `/admin/games` - Game management (working)
- ✅ `/admin/users` - User management (in review)
- ✅ `/admin/network` - Network control (working, will migrate)
- ✅ `/admin/storage` - Storage management (working, will migrate)
- ✅ `/admin/system/alerts` - Alert rules (just added, will migrate)
- ✅ `/admin/system/logs` - System logs (just added, will migrate)
- ❌ `/admin/cameras` - NOT EXISTS (new)

**Issues:**
1. ⚠️ Storage/Alerts/Logs pages not in sidebar navigation
2. ⚠️ No unified admin experience (scattered pages)
3. ⚠️ Hardcoded RBAC permissions (can't customize roles)
4. ⚠️ Coarse-grained permissions (e.g., `manage_system_settings` too broad)
5. ⚠️ No Roles/Permissions management UI

### Target State (Post-Implementation)

**New Structure:**
```
/admin/
├── games/              # Keep as-is (Game CRUD)
├── users/              # Enhanced with tabs
│   ├── [active tab]    → Users list (existing + enhancements)
│   ├── roles           → Role management (NEW)
│   └── permissions     → Permission matrix (NEW)
├── cameras/            # NEW standalone page
│   └── [camera CRUD]   → Camera management
└── system/             # NEW unified dashboard
    ├── health          → System status monitoring
    ├── network         → Network control (migrated)
    ├── alerts          → Alert rules (migrated)
    ├── logs            → System logs (migrated)
    └── storage         → Storage management (migrated)
```

**Sidebar Navigation:**
```
Primary Links (always visible):
- Dashboard
- Bookings
- Game Runner

Admin Links (permission-based):
- Game Settings        (manage_games)
- User Management      (manage_users OR view_roles)
- Camera Management    (view_cameras OR manage_cameras)
- System Dashboard     (view_system_logs OR manage_system_settings OR view_network)

Account Link:
- Account
```

---

## Technology Stack

### Frontend
- **SvelteKit 2.x** - SSR framework
- **Svelte 5 Runes** - Reactive state management
- **DaisyUI 5.1.25** - UI component library
- **Tailwind CSS 4** - Utility-first CSS
- **Better Auth Client** - Authentication

### Backend
- **Fastify 5.x** - HTTP server
- **Better Auth v1.3** - Authentication system
  - Username plugin (enabled)
  - Admin plugin (enabled)
  - Custom session enrichment
- **Drizzle ORM** - Database queries
- **SQLite + WAL** - Database with Write-Ahead Logging
- **Socket.IO** - Real-time updates

### Build Tools
- **pnpm workspaces** - Monorepo management
- **TypeScript 5.x** - Type safety
- **Vite 5.x** - Build tool

---

## URL Structure

### Admin Pages

| URL | Purpose | Tabs | Permissions |
|-----|---------|------|-------------|
| `/admin/games` | Game management | None (existing single-page CRUD) | `manage_games` |
| `/admin/users` | User management | **Users** \| Roles \| Permissions | `manage_users`, `view_roles`, `manage_roles` |
| `/admin/cameras` | Camera management | None (single-page CRUD) | `view_cameras`, `manage_cameras` |
| `/admin/system` | System dashboard | Health \| Network \| **Alerts** \| Logs \| Storage | See breakdown below |

### System Dashboard Tab Permissions

| Tab | View Permission | Manage Permission | Notes |
|-----|----------------|-------------------|-------|
| **Health** | `view_system_logs` | `manage_system_settings` | Service status, uptime, diagnostics |
| **Network** | `view_network` | `manage_network` | SSID, channel, AP config |
| **Alerts** | `view_system_logs` | `manage_alert_rules` | Alert rule configuration |
| **Logs** | `view_system_logs` | N/A (read-only) | System log viewer with filters |
| **Storage** | `view_storage` | `manage_storage` | Asset library, backups |

**Tab Visibility Logic:**
- Show tab if user has **view** OR **manage** permission
- Enable edit controls only if user has **manage** permission
- Admin role has all permissions by default

---

## Permission System

### Current Permissions (12 total - Session 37)

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
  | 'manage_system_settings';
```

### New Permissions (24 total - Target)

**Removed (1):**
- ❌ `manage_system_settings` - Too broad, split into specific permissions

**Added (13):**
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

// Alert management (replacing manage_system_settings)
| 'manage_alert_rules'

// System health monitoring
| 'view_system_health'
| 'manage_system_health'

// Operator archiving (dangerous action)
| 'archive_users'

// Asset management (renamed from manage_files)
| 'manage_assets'
```

**Final Permission Set (24):**
```typescript
export type OperatorPermission =
  // Dashboard & Monitoring
  | 'view_dashboard'
  | 'view_system_health'
  | 'manage_system_health'

  // Bookings & Sessions
  | 'view_bookings'
  | 'manage_bookings'
  | 'manage_sessions'

  // Games & Content
  | 'view_games'
  | 'manage_games'

  // Users & RBAC
  | 'manage_users'
  | 'archive_users'
  | 'view_roles'
  | 'manage_roles'
  | 'view_permissions'
  | 'manage_permissions'

  // Network & Infrastructure
  | 'view_network'
  | 'manage_network'

  // Cameras & Streaming
  | 'view_cameras'
  | 'manage_cameras'

  // Storage & Assets
  | 'view_storage'
  | 'manage_storage'
  | 'manage_assets'

  // Logging & Alerting
  | 'view_system_logs'
  | 'manage_alert_rules';
```

### Default Role Assignments

```typescript
export const ROLE_PERMISSIONS: Record<OperatorRole, OperatorPermission[]> = {
  admin: [
    // Admins have ALL permissions
    ...ALL_PERMISSIONS
  ],

  manager: [
    'view_dashboard',
    'view_system_health',
    'view_bookings',
    'manage_bookings',
    'manage_sessions',
    'view_games',
    'manage_games',
    'view_network',
    'manage_users',
    'archive_users',
    'view_roles',
    'view_permissions',
    'view_cameras',
    'view_storage',
    'manage_storage',
    'manage_assets',
    'view_system_logs'
  ],

  game_master: [
    'view_dashboard',
    'view_bookings',
    'manage_sessions',
    'view_games',
    'view_cameras'
  ],

  customer: [
    'view_dashboard',
    'view_bookings'
  ]
};
```

### Permission Labels (for UI display)

```typescript
export const PERMISSION_LABELS: Record<OperatorPermission, string> = {
  view_dashboard: 'View dashboard and status widgets',
  view_system_health: 'View system health and diagnostics',
  manage_system_health: 'Configure system health settings',
  view_bookings: 'View bookings calendar and manifests',
  manage_bookings: 'Modify, cancel, and create bookings',
  manage_sessions: 'Control live sessions and timers',
  view_games: 'View game library and details',
  manage_games: 'Edit game settings, puzzles, and rooms',
  manage_users: 'Manage operator accounts',
  archive_users: 'Archive and unarchive operators',
  view_roles: 'View roles and their permissions',
  manage_roles: 'Create, edit, and delete roles',
  view_permissions: 'View permission definitions',
  manage_permissions: 'Assign permissions to roles',
  view_network: 'View appliance network status',
  manage_network: 'Modify network configuration',
  view_cameras: 'View camera streams and status',
  manage_cameras: 'Configure cameras and streaming',
  view_storage: 'View storage usage and assets',
  manage_storage: 'Manage backups and storage settings',
  manage_assets: 'Upload and manage media assets',
  view_system_logs: 'View system logs and audit trail',
  manage_alert_rules: 'Configure alert rules and thresholds'
};
```

---

## Database Schema

### New Tables

#### 1. `roles` Table (NEW)

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0, -- 1 for admin/manager/game_master/customer
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_system ON roles(is_system);
CREATE INDEX idx_roles_name ON roles(name);

-- Seed system roles
INSERT INTO roles (id, name, description, is_system) VALUES
  ('role-admin', 'admin', 'Administrator', 1),
  ('role-manager', 'manager', 'Manager', 1),
  ('role-game-master', 'game_master', 'Game Master', 1),
  ('role-customer', 'customer', 'Customer', 1);
```

#### 2. `permissions` Table (NEW)

```sql
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- 'view_dashboard', 'manage_users', etc.
  label TEXT NOT NULL, -- Human-readable label
  category TEXT NOT NULL, -- 'dashboard', 'users', 'games', 'network', etc.
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_permissions_name ON permissions(name);

-- Seed all 24 permissions (see permission list above)
```

#### 3. `role_permissions` Table (NEW - Junction)

```sql
CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES operators(id),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
```

### Modified Tables

#### 1. `operators` Table - Add `role_id` FK

```sql
-- Migration: Add role_id column
ALTER TABLE operators ADD COLUMN role_id TEXT REFERENCES roles(id);

-- Migrate existing role strings to role_id FKs
UPDATE operators SET role_id = 'role-admin' WHERE role = 'admin';
UPDATE operators SET role_id = 'role-manager' WHERE role = 'manager';
UPDATE operators SET role_id = 'role-game-master' WHERE role = 'game_master';
UPDATE operators SET role_id = 'role-customer' WHERE role = 'customer';

-- Add NOT NULL constraint after migration
ALTER TABLE operators ALTER COLUMN role_id SET NOT NULL;

-- Create index
CREATE INDEX idx_operators_role ON operators(role_id);

-- Note: Keep `role` column for Better-Auth compatibility, sync via trigger
```

#### 2. `cameras` Table (NEW)

```sql
CREATE TABLE cameras (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  protocol TEXT NOT NULL CHECK(protocol IN ('rtsp', 'mjpeg', 'onvif')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 554,
  username TEXT,
  password_encrypted TEXT, -- Encrypted with libsodium
  stream_path TEXT,
  resolution TEXT CHECK(resolution IN ('480p', '720p', '1080p', 'native')),
  frame_rate INTEGER DEFAULT 15,
  transport TEXT CHECK(transport IN ('tcp', 'udp', 'http')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'testing', 'error')),
  last_seen_at TEXT,
  error_message TEXT,
  hls_enabled INTEGER NOT NULL DEFAULT 0,
  hls_bitrate INTEGER,
  hls_fps INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cameras_room ON cameras(room_id);
CREATE INDEX idx_cameras_status ON cameras(status);
CREATE INDEX idx_cameras_updated ON cameras(updated_at DESC);
```

---

## Implementation Plan

### Phase 1: Database Schema & Migrations (8 hours)
**TODO:** P3-RBAC-001

**Tasks:**
1. Create migration: Add `roles`, `permissions`, `role_permissions` tables
2. Create migration: Add `cameras` table
3. Create migration: Add `role_id` FK to `operators` table
4. Seed system roles (admin, manager, game_master, customer)
5. Seed all 24 permissions with labels/categories
6. Seed default role_permissions mappings
7. Write migration script to backfill existing operator roles
8. Test migrations: fresh DB + migration from Session 37 state

**Files:**
- `apps/escapeplan-api/migrations/0001_add_rbac_tables.sql`
- `apps/escapeplan-api/migrations/0002_add_cameras_table.sql`
- `apps/escapeplan-api/src/db/seed.ts` (update)

**Acceptance Criteria:**
- ✅ All new tables created with indexes
- ✅ Existing operators migrated to role_id FKs
- ✅ 24 permissions seeded
- ✅ 4 system roles seeded with permissions
- ✅ Migration script tested on Session 37 database

---

### Phase 2: Update Contracts & RBAC Logic (4 hours)
**TODO:** P3-RBAC-002

**Tasks:**
1. Update `OperatorPermission` type (24 permissions)
2. Update `PERMISSION_LABELS` with new labels
3. Update `ROLE_PERMISSIONS` with new mappings
4. Add contracts for roles/permissions CRUD:
   - `RoleWithPermissions` interface
   - `PermissionSummary` interface
   - `UpdateRolePermissionsRequest` interface
5. Update `ensurePermission()` to query database instead of hardcoded matrix
6. Add helper: `getRolePermissions(roleId)` → query `role_permissions` table
7. Update Better-Auth session enrichment to include `role_id`

**Files:**
- `packages/contracts/src/index.ts`
- `packages/contracts/src/rbac.ts`
- `apps/escapeplan-api/src/security.ts`
- `apps/escapeplan-api/src/auth-config.ts`

**Acceptance Criteria:**
- ✅ Contracts package builds without errors
- ✅ Permission checks use database queries
- ✅ Backward compatibility maintained (existing API routes work)
- ✅ Test coverage for `getRolePermissions()`

---

### Phase 3: Backend API Routes (12 hours)
**TODO:** P3-RBAC-003

**New Endpoints:**

#### Roles Management
```typescript
GET    /api/admin/roles              # List all roles
POST   /api/admin/roles              # Create custom role (requires manage_roles)
GET    /api/admin/roles/:id          # Get role with permissions
PATCH  /api/admin/roles/:id          # Update role metadata
DELETE /api/admin/roles/:id          # Delete custom role (block system roles)
GET    /api/admin/roles/:id/permissions  # Get role's permissions
PATCH  /api/admin/roles/:id/permissions  # Update role's permissions
```

#### Permissions Management
```typescript
GET    /api/admin/permissions        # List all permissions with categories
GET    /api/admin/permissions/matrix # Get full role-permission matrix
```

#### Camera Management
```typescript
GET    /api/admin/cameras            # List all cameras
POST   /api/admin/cameras            # Create camera
GET    /api/admin/cameras/:id        # Get camera details
PATCH  /api/admin/cameras/:id        # Update camera
DELETE /api/admin/cameras/:id        # Delete camera
POST   /api/admin/cameras/:id/test   # Test camera connection (5s timeout)
POST   /api/admin/cameras/:id/start  # Start HLS stream
POST   /api/admin/cameras/:id/stop   # Stop HLS stream
```

**Files:**
- `apps/escapeplan-api/src/index.ts` (add routes)
- `apps/escapeplan-api/src/state.ts` (add business logic)
- `apps/escapeplan-api/src/cameras/` (NEW directory)
  - `controller.ts` - Camera CRUD
  - `encryption.ts` - Credential encryption (libsodium)
  - `connection.ts` - Connection testing
  - `streaming.ts` - HLS stream management

**Acceptance Criteria:**
- ✅ All endpoints implemented with RBAC guards
- ✅ Camera credentials encrypted at rest
- ✅ Connection test times out after 5s max
- ✅ System logs record all CRUD operations
- ✅ Vitest integration tests cover happy path + errors

---

### Phase 4: User Management Tabs (16 hours)
**TODO:** P3-013-ENHANCE

**Enhancements to `/admin/users`:**

1. **Tab Navigation**
   - DaisyUI tabs component
   - URL hash routing: `/admin/users#users`, `/admin/users#roles`, `/admin/users#permissions`
   - Active tab persists on refresh

2. **Users Tab (existing + enhancements)**
   - Keep existing user list/modal/archive functionality
   - Add bulk actions: Export CSV, Bulk role change
   - Add advanced filters: Created date range, Last login
   - Add user activity summary (last login, sessions managed)

3. **Roles Tab (NEW)**
   ```svelte
   <!-- Roles Tab Layout -->
   <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
     <!-- Left: Role List -->
     <div class="lg:col-span-1">
       <h3>Roles (6)</h3>
       <ul>
         <li>Admin (system)</li>
         <li>Manager (system)</li>
         <li>Game Master (system)</li>
         <li>Customer (system)</li>
         <li>Senior Operator (custom) [Edit] [Delete]</li>
         <li>Intern (custom) [Edit] [Delete]</li>
       </ul>
       <button>+ Create Role</button>
     </div>

     <!-- Right: Selected Role Details -->
     <div class="lg:col-span-2">
       <h3>Manager Role</h3>
       <p>System role - cannot delete</p>

       <h4>Assigned Permissions (15)</h4>
       <div class="permission-groups">
         <div class="group">
           <h5>Dashboard & Monitoring</h5>
           <label><input type="checkbox" checked disabled> View dashboard</label>
           <label><input type="checkbox" checked> View system health</label>
         </div>
         <!-- ... more groups ... -->
       </div>

       <button>Save Changes</button>
     </div>
   </div>
   ```

4. **Permissions Tab (NEW - Read-Only Matrix)**
   ```svelte
   <!-- Permission Matrix -->
   <table class="table table-xs">
     <thead>
       <tr>
         <th>Permission</th>
         <th>Admin</th>
         <th>Manager</th>
         <th>Game Master</th>
         <th>Customer</th>
         <th>Senior Operator</th>
       </tr>
     </thead>
     <tbody>
       <tr>
         <td>View Dashboard</td>
         <td>✅</td>
         <td>✅</td>
         <td>✅</td>
         <td>✅</td>
         <td>✅</td>
       </tr>
       <tr>
         <td>Manage Users</td>
         <td>✅</td>
         <td>✅</td>
         <td>❌</td>
         <td>❌</td>
         <td>❌</td>
       </tr>
       <!-- ... all 24 permissions ... -->
     </tbody>
   </table>
   ```

**Files:**
- `apps/escapeplan-web/src/routes/(app)/admin/users/+page.svelte` (enhance)
- `apps/escapeplan-web/src/routes/(app)/admin/users/+page.server.ts` (enhance)
- `apps/escapeplan-web/src/lib/components/RoleModal.svelte` (NEW)
- `apps/escapeplan-web/src/lib/components/PermissionCheckboxGroup.svelte` (NEW)

**Acceptance Criteria:**
- ✅ Three tabs render correctly on mobile/desktop
- ✅ Users tab keeps existing functionality
- ✅ Roles tab allows permission editing (save via API)
- ✅ Permissions tab displays read-only matrix
- ✅ System roles (admin/manager/game_master/customer) cannot be deleted
- ✅ Custom roles can be created/edited/deleted
- ✅ Changes logged to `system_logs`

---

### Phase 5: Camera Management Page (18 hours)
**TODO:** P3-016

**New Page: `/admin/cameras`**

**Features:**
1. **Camera List (Grid/Table View)**
   - Card view (mobile): Preview thumbnail, name, room, status badge
   - Table view (desktop): Name, Room, Protocol, Host, Status, Last Seen, Actions
   - Live preview thumbnails refresh every 5s
   - Status badges: Online (green), Offline (red), Testing (yellow), Error (red with message)

2. **Add/Edit Camera Modal**
   ```svelte
   <form>
     <!-- Basic Settings -->
     <input name="name" placeholder="Front Door Camera" required>
     <select name="room_id">
       <option value="">No room</option>
       <option value="room-123">Main Room</option>
     </select>

     <!-- Connection Settings -->
     <select name="protocol" required>
       <option value="rtsp">RTSP</option>
       <option value="mjpeg">MJPEG</option>
       <option value="onvif">ONVIF</option>
     </select>
     <input name="host" placeholder="192.168.1.100" required>
     <input name="port" type="number" value="554" required>
     <input name="username" placeholder="admin">
     <input name="password" type="password" placeholder="••••••••">
     <input name="stream_path" placeholder="/stream1">

     <!-- Advanced Settings (Collapsible) -->
     <select name="resolution">
       <option value="native">Native</option>
       <option value="1080p">1080p</option>
       <option value="720p">720p</option>
       <option value="480p">480p</option>
     </select>
     <input name="frame_rate" type="number" value="15">
     <select name="transport">
       <option value="tcp">TCP</option>
       <option value="udp">UDP</option>
       <option value="http">HTTP</option>
     </select>

     <!-- Test Connection Button -->
     <button type="button" onclick={testConnection}>
       Test Connection (5s timeout)
     </button>
     <div class="test-result">
       {#if testing}
         <span class="loading loading-spinner"></span> Testing...
       {:else if testSuccess}
         ✅ Connection successful! Preview:
         <img src={previewUrl} alt="Camera preview" />
       {:else if testError}
         ❌ {testError}
       {/if}
     </div>

     <button type="submit">Save Camera</button>
   </form>
   ```

3. **HLS Stream Management**
   - Start/Stop buttons per camera
   - Stream status: Streaming (green with bitrate/fps), Stopped (gray), Error (red)
   - Automatic restart on failure (with exponential backoff)
   - Stream health metrics: Bitrate, FPS, Uptime

4. **Camera Diagnostics**
   - Connection test history (last 10 attempts)
   - Error log viewer (last 50 errors)
   - Network latency graph (optional)

**Files:**
- `apps/escapeplan-web/src/routes/(app)/admin/cameras/+page.svelte` (NEW)
- `apps/escapeplan-web/src/routes/(app)/admin/cameras/+page.server.ts` (NEW)
- `apps/escapeplan-web/src/lib/components/CameraModal.svelte` (NEW)
- `apps/escapeplan-web/src/lib/components/CameraPreview.svelte` (NEW)

**Acceptance Criteria:**
- ✅ Camera list shows all cameras with live previews
- ✅ Add camera modal validates all fields
- ✅ Test connection times out after 5s
- ✅ Test connection shows preview on success
- ✅ Credentials are encrypted when saved
- ✅ HLS stream start/stop works
- ✅ Drag-drop room assignment works
- ✅ All CRUD operations logged

---

### Phase 6: System Dashboard Tabs (20 hours)
**TODO:** P4-008-ENHANCE

**New Page: `/admin/system` with 5 tabs**

#### Tab 1: Health (NEW)
```svelte
<div class="space-y-6">
  <!-- Service Status Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="stat">
      <div class="stat-title">API Server</div>
      <div class="stat-value text-success">●</div>
      <div class="stat-desc">Uptime: 7d 4h 23m</div>
    </div>
    <div class="stat">
      <div class="stat-title">WebSocket</div>
      <div class="stat-value text-success">●</div>
      <div class="stat-desc">12 clients connected</div>
    </div>
    <div class="stat">
      <div class="stat-title">Database</div>
      <div class="stat-value text-success">●</div>
      <div class="stat-desc">42.3 MB, WAL mode</div>
    </div>
  </div>

  <!-- System Resources -->
  <div class="card bg-base-200">
    <div class="card-body">
      <h3>System Resources</h3>
      <div class="space-y-2">
        <div>
          <span>CPU Usage</span>
          <progress class="progress progress-primary" value="35" max="100"></progress>
          <span>35%</span>
        </div>
        <div>
          <span>Memory</span>
          <progress class="progress progress-primary" value="58" max="100"></progress>
          <span>2.3 GB / 4 GB</span>
        </div>
        <div>
          <span>Disk</span>
          <progress class="progress progress-warning" value="72" max="100"></progress>
          <span>45 GB / 64 GB</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Diagnostics -->
  <div class="card bg-base-200">
    <div class="card-body">
      <h3>Diagnostics</h3>
      <button class="btn btn-sm">Test Network Connectivity</button>
      <button class="btn btn-sm">Test Camera Streams</button>
      <button class="btn btn-sm">Download Diagnostic Bundle</button>
    </div>
  </div>
</div>
```

#### Tab 2: Network (MIGRATED from `/admin/network`)
- Move existing `/admin/network/+page.svelte` content into tab
- Keep all functionality (SSID, channel, AP config)
- Add Wi-Fi client list (devices connected to EscapePlan AP)

#### Tab 3: Alerts (MIGRATED from `/admin/system/alerts`)
- Move existing `/admin/system/alerts/+page.svelte` content into tab
- Keep all functionality (enable/disable rules, edit templates)

#### Tab 4: Logs (MIGRATED from `/admin/system/logs`)
- Move existing `/admin/system/logs/+page.svelte` content into tab
- Keep all functionality (filters, search, pagination, CSV export)

#### Tab 5: Storage (MIGRATED from `/admin/storage`)
- Move existing `/admin/storage/+page.svelte` content into tab
- Keep all functionality (overview, asset library, backups)

**Files:**
- `apps/escapeplan-web/src/routes/(app)/admin/system/+page.svelte` (NEW)
- `apps/escapeplan-web/src/routes/(app)/admin/system/+page.server.ts` (NEW)
- Migrate content from:
  - `/admin/network/+page.svelte`
  - `/admin/system/alerts/+page.svelte`
  - `/admin/system/logs/+page.svelte`
  - `/admin/storage/+page.svelte`

**Acceptance Criteria:**
- ✅ All 5 tabs render correctly
- ✅ Tab state persists on refresh (URL hash)
- ✅ Health tab shows accurate system metrics
- ✅ Network tab retains all existing functionality
- ✅ Alerts tab retains all existing functionality
- ✅ Logs tab retains all existing functionality
- ✅ Storage tab retains all existing functionality
- ✅ Tab visibility based on permissions
- ✅ Responsive on mobile/tablet/desktop

---

### Phase 7: Update Navigation Sidebar (2 hours)
**TODO:** P4-NAV-001

**Changes to `/admin/+layout.svelte`:**

```typescript
const adminLinks = $derived([
  ...(canManageGames
    ? [{
        href: '/admin/games',
        label: 'Game Settings',
        icon: 'M4 6h16v2H4zm2 4h12v2H6zm3 4h6v2H9z'
      }]
    : []),

  ...(canManageUsers || canViewRoles
    ? [{
        href: '/admin/users',
        label: 'User Management',
        icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm7 7a6 6 0 10-14 0h2a4 4 0 118 0h2z'
      }]
    : []),

  ...(canViewCameras || canManageCameras
    ? [{
        href: '/admin/cameras',
        label: 'Camera Management',
        icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
      }]
    : []),

  ...(canViewSystemLogs || canManageSystemSettings || canViewNetwork
    ? [{
        href: '/admin/system',
        label: 'System Dashboard',
        icon: 'M4 5h16v2H4zm2 4h12v2H6zm3 4h6v2H9zm-5 4h16v2H4z'
      }]
    : [])
]);

// Add permission checks
const canViewRoles = $derived(props.data.user?.permissions?.includes('view_roles') ?? false);
const canViewCameras = $derived(props.data.user?.permissions?.includes('view_cameras') ?? false);
const canManageCameras = $derived(props.data.user?.permissions?.includes('manage_cameras') ?? false);
const canManageSystemSettings = $derived(props.data.user?.permissions?.includes('manage_alert_rules') ?? false);
```

**Acceptance Criteria:**
- ✅ All 4 admin links visible to appropriate roles
- ✅ Links hide if user lacks all required permissions
- ✅ Active state highlights current page

---

### Phase 8: Testing & QA (12 hours)
**TODO:** P6-ADMIN-QA

**Test Scenarios:**

1. **RBAC Permission Tests**
   - [ ] Admin can access all tabs
   - [ ] Manager can access all except manage_roles
   - [ ] Game Master can only access cameras (view)
   - [ ] Customer has no admin access
   - [ ] Custom role with specific permissions works

2. **User Management Tests**
   - [ ] Create/edit/archive/unarchive users
   - [ ] Create custom role
   - [ ] Edit role permissions (save to DB)
   - [ ] Delete custom role (block system roles)
   - [ ] Permission matrix displays correctly

3. **Camera Management Tests**
   - [ ] Add camera with RTSP credentials
   - [ ] Test connection (success + failure cases)
   - [ ] Start/stop HLS stream
   - [ ] Drag-drop room assignment
   - [ ] Credentials encrypted in database
   - [ ] Delete camera

4. **System Dashboard Tests**
   - [ ] Health tab shows accurate metrics
   - [ ] Network tab updates SSID successfully
   - [ ] Alerts tab toggles rules
   - [ ] Logs tab filters/search/export work
   - [ ] Storage tab uploads assets

5. **Migration Tests**
   - [ ] Migrate Session 37 database to new schema
   - [ ] Existing operators retain permissions
   - [ ] Old `/admin/network` redirects to `/admin/system#network`
   - [ ] Old `/admin/storage` redirects to `/admin/system#storage`

**Files:**
- `apps/escapeplan-api/test/rbac.test.ts` (NEW)
- `apps/escapeplan-api/test/cameras.test.ts` (NEW)
- `apps/escapeplan-web/tests/admin-panel.spec.ts` (Playwright E2E)

**Acceptance Criteria:**
- ✅ All test scenarios pass
- ✅ No regressions in existing features
- ✅ Manual QA checklist completed
- ✅ Documentation updated

---

## User Stories

### US-035: Streamline Admin Console (IN_PROGRESS)
**Related:** P4-010

**Acceptance Criteria:**
- [x] Inline validation on all forms
- [x] Success/error feedback via toasts
- [ ] PWA update prompts work
- [ ] All admin tabs accessible via sidebar

**Implementation Status:** 75% complete

---

### US-036: Archive Inactive Operators (IN_REVIEW)
**Related:** P3-013

**Acceptance Criteria:**
- [x] Archive/unarchive buttons work
- [x] Archived users blocked from login
- [x] Show archived users toggle
- [ ] Audit log for archive actions

**Implementation Status:** 90% complete

---

### US-039: Configure Network Cameras (NOT_STARTED → IN_PROGRESS)
**Related:** P3-016

**Acceptance Criteria:**
- [ ] Add/edit camera modal with connection test
- [ ] Test connection shows preview on success
- [ ] HLS stream start/stop works
- [ ] Credentials encrypted
- [ ] Drag-drop room assignment

**Implementation Status:** 0% → Planned for Phase 5

---

### US-040: Monitor Storage Usage (NOT_STARTED → IN_PROGRESS)
**Related:** P3-017

**Acceptance Criteria:**
- [x] Storage overview dashboard (exists, will migrate)
- [x] Asset library with upload
- [x] Backup management UI
- [ ] Integrated into System Dashboard tabs

**Implementation Status:** 80% (existing page) → Will migrate to tabs

---

### US-041: Better-Auth Backend Alignment (IN_REVIEW → BLOCKED)
**Related:** P3-021, P3-RBAC-002

**Status:** BLOCKED pending RBAC database schema

**Next Steps:** Resume after Phase 1 completes

---

### US-042: Admin Console Better-Auth Integration (IN_REVIEW → BLOCKED)
**Related:** P3-022

**Status:** BLOCKED pending backend alignment

**Next Steps:** Resume after US-041 completes

---

## Migration Guide

### Breaking Changes

1. **URL Changes (Redirects Required)**
   ```typescript
   // Add to hooks.server.ts or +layout.server.ts
   const REDIRECTS = {
     '/admin/network': '/admin/system#network',
     '/admin/storage': '/admin/system#storage',
     '/admin/system/alerts': '/admin/system#alerts',
     '/admin/system/logs': '/admin/system#logs'
   };
   ```

2. **Hardcoded Permissions → Database Queries**
   ```typescript
   // BEFORE (hardcoded)
   import { ROLE_PERMISSIONS } from '@escapeplan/contracts';
   const permissions = ROLE_PERMISSIONS[user.role];

   // AFTER (database query)
   const permissions = await getRolePermissions(user.role_id);
   ```

3. **Permission Names Changed**
   ```typescript
   // BEFORE
   'manage_system_settings' // Too broad

   // AFTER (more granular)
   'manage_alert_rules'
   'manage_system_health'
   'manage_network'
   ```

### Migration Steps

1. **Backup Database**
   ```bash
   cp apps/escapeplan-api/data/escapeplan.db apps/escapeplan-api/data/escapeplan-backup-session37.db
   ```

2. **Run Migrations**
   ```bash
   cd apps/escapeplan-api
   npx drizzle-kit migrate
   pnpm db:seed
   ```

3. **Verify Migration**
   ```bash
   # Check roles table
   sqlite3 data/escapeplan.db "SELECT * FROM roles;"

   # Check permissions
   sqlite3 data/escapeplan.db "SELECT COUNT(*) FROM permissions;"
   # Expected: 24

   # Check operator role_id assignment
   sqlite3 data/escapeplan.db "SELECT username, role, role_id FROM operators;"
   ```

4. **Update Frontend Routes**
   - Remove old `/admin/network` page
   - Remove old `/admin/storage` page
   - Remove old `/admin/system/alerts` page (keep for redirect)
   - Remove old `/admin/system/logs` page (keep for redirect)

5. **Test Permissions**
   ```bash
   # Run backend tests
   pnpm --filter escapeplan-api test

   # Run E2E tests
   pnpm --filter escapeplan-web test:e2e
   ```

---

## Testing Strategy

### Unit Tests (Vitest)

**Backend:**
- `test/rbac.test.ts` - Permission resolution logic
- `test/cameras.test.ts` - Camera CRUD operations
- `test/roles.test.ts` - Role management
- `test/encryption.test.ts` - Credential encryption

**Expected Coverage:** >85% for new code

### Integration Tests (Vitest)

**Scenarios:**
1. Create custom role → Assign permissions → Create user with role → Verify access
2. Add camera → Test connection → Start HLS → Verify stream
3. Edit role permissions → Verify users get updated permissions
4. Archive user → Verify login blocked → Unarchive → Verify login works

### E2E Tests (Playwright)

**User Flows:**
1. Admin creates custom role with specific permissions
2. Admin assigns custom role to new user
3. New user logs in and sees only permitted tabs
4. Manager adds camera and tests connection
5. Admin navigates through all System Dashboard tabs

### Manual QA Checklist

**Pre-Release:**
- [ ] All sidebar links work
- [ ] All tabs load without errors
- [ ] Permission checks prevent unauthorized access
- [ ] Mobile layout works (all tabs responsive)
- [ ] Dark mode compatible (DaisyUI themes)
- [ ] Toast notifications appear correctly
- [ ] Forms validate properly
- [ ] Camera preview refreshes every 5s
- [ ] HLS streams start/stop correctly
- [ ] Audit logs record all admin actions

---

## Related Tasks

### TODO.json Updates

| Task ID | Status | Title | Phase |
|---------|--------|-------|-------|
| P3-013 | IN_REVIEW → ACTIVE | Refine operator management experience | Phase 4 |
| P3-016 | NOT_STARTED → ACTIVE | Build camera management admin interface | Phase 5 |
| P3-017 | NOT_STARTED → COMPLETED | Implement storage visualization (migrate to tabs) | Phase 6 |
| P4-008 | NOT_STARTED → ACTIVE | Build settings and system health interface | Phase 6 |
| P3-RBAC-001 | NEW | Database schema & migrations for RBAC | Phase 1 |
| P3-RBAC-002 | NEW | Update contracts & RBAC logic | Phase 2 |
| P3-RBAC-003 | NEW | Backend API routes for roles/permissions/cameras | Phase 3 |
| P4-NAV-001 | NEW | Update navigation sidebar | Phase 7 |
| P6-ADMIN-QA | NEW | Testing & QA for admin panel | Phase 8 |

---

## Success Metrics

### Quantitative
- **Permission Granularity:** 12 → 24 permissions (100% increase)
- **Admin Pages:** 6 scattered → 4 unified pages (33% reduction in nav items)
- **Lines of Code:** ~1,500 new lines (estimated)
- **Test Coverage:** >85% for new code
- **Performance:** <200ms page load for all admin pages

### Qualitative
- Admins can customize roles without code changes
- Operators find relevant settings easily (tabbed interface)
- Camera setup is intuitive (connection test + preview)
- System health is transparent (metrics dashboard)
- Permission matrix is understandable (clear labels)

---

## Appendix

### A. DaisyUI Tab Component Pattern

```svelte
<script lang="ts">
  let activeTab = $state<'users' | 'roles' | 'permissions'>('users');

  // Sync with URL hash
  $effect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      if (hash) activeTab = hash as any;
    }
  });

  function setTab(tab: string) {
    activeTab = tab as any;
    window.location.hash = tab;
  }
</script>

<div role="tablist" class="tabs tabs-boxed">
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'users'}
    onclick={() => setTab('users')}
  >
    Users
  </button>
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'roles'}
    onclick={() => setTab('roles')}
  >
    Roles
  </button>
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'permissions'}
    onclick={() => setTab('permissions')}
  >
    Permissions
  </button>
</div>

<div class="mt-6">
  {#if activeTab === 'users'}
    <!-- Users content -->
  {:else if activeTab === 'roles'}
    <!-- Roles content -->
  {:else if activeTab === 'permissions'}
    <!-- Permissions content -->
  {/if}
</div>
```

### B. Camera Credential Encryption

```typescript
// Using libsodium (already available in project)
import sodium from 'libsodium-wrappers';

await sodium.ready;

const SECRET_KEY = process.env.CAMERA_ENCRYPTION_KEY; // 32-byte hex key

export function encryptCameraPassword(password: string): string {
  const key = Buffer.from(SECRET_KEY, 'hex');
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const cipher = sodium.crypto_secretbox_easy(password, nonce, key);

  // Store nonce + cipher as base64
  return Buffer.concat([nonce, cipher]).toString('base64');
}

export function decryptCameraPassword(encrypted: string): string {
  const key = Buffer.from(SECRET_KEY, 'hex');
  const combined = Buffer.from(encrypted, 'base64');

  const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const cipher = combined.slice(sodium.crypto_secretbox_NONCEBYTES);

  return sodium.crypto_secretbox_open_easy(cipher, nonce, key, 'text');
}
```

### C. Permission Category Breakdown

```typescript
export const PERMISSION_CATEGORIES = {
  dashboard: ['view_dashboard', 'view_system_health', 'manage_system_health'],
  bookings: ['view_bookings', 'manage_bookings'],
  sessions: ['manage_sessions'],
  games: ['view_games', 'manage_games'],
  users: ['manage_users', 'archive_users'],
  rbac: ['view_roles', 'manage_roles', 'view_permissions', 'manage_permissions'],
  network: ['view_network', 'manage_network'],
  cameras: ['view_cameras', 'manage_cameras'],
  storage: ['view_storage', 'manage_storage', 'manage_assets'],
  logging: ['view_system_logs', 'manage_alert_rules']
} as const;
```

---

**END OF SPECIFICATION**

*This document serves as the implementation bible for the Dashboard & Admin Panel system. All development work MUST reference this specification.*
