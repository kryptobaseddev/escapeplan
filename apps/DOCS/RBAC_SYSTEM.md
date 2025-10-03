# EscapePlan Role-Based Access Control (RBAC) System

**Version:** 1.0
**Last Updated:** 2025-10-01
**Status:** ✅ Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Permissions Reference](#permissions-reference)
5. [System Roles](#system-roles)
6. [API Endpoints](#api-endpoints)
7. [Frontend Integration](#frontend-integration)
8. [Adding New Permissions](#adding-new-permissions)
9. [Creating Custom Roles](#creating-custom-roles)
10. [Security Considerations](#security-considerations)
11. [Testing](#testing)

---

## Overview

EscapePlan uses a **database-driven RBAC system** that allows for flexible permission management through custom roles. The system consists of:

- **27 granular permissions** across 10 categories
- **4 system roles** (admin, manager, game_master, customer)
- **Unlimited custom roles** (admin-defined)
- **Database-backed permission resolution** (no hardcoded matrices)

### Key Features

✅ Dynamic role creation and permission assignment
✅ Per-request permission checking via middleware
✅ Frontend permission-based UI rendering
✅ Audit logging for all role/permission changes
✅ Protection of system roles from modification
✅ Session enrichment with role and permissions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Better Auth Session                     │
│  (HttpOnly cookie: better-auth.session_token)              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Custom Session Enrichment                      │
│  - Adds: role, role_id, permissions[]                      │
│  - Queries: role_permissions + permissions tables          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Route Guards                          │
│  ensurePermission(role, permissions[], required)           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              SvelteKit Page Guards                          │
│  if (!locals.user?.permissions?.includes('perm')) error()  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User logs in** → Better Auth creates session
2. **Session enrichment** → Queries `role_permissions` to add permissions array
3. **API request** → `ensurePermission()` checks if user has required permission
4. **Page load** → SvelteKit `+page.server.ts` checks permissions in `locals.user`
5. **UI rendering** → Components conditionally render based on `$page.data.user.permissions`

---

## Database Schema

### Tables

#### `roles`
```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0, -- 1 for system roles
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**System Roles (is_system = 1):**
- `role-admin` (name: admin)
- `role-manager` (name: manager)
- `role-game-master` (name: game_master)
- `role-customer` (name: customer)

**Custom Roles (is_system = 0):**
- Created by admins via `/api/admin/roles`
- Cannot be named the same as system roles
- Can be deleted if no operators are assigned

#### `permissions`
```sql
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Categories:** dashboard, bookings, sessions, games, network, users, rbac, storage, cameras, system

#### `role_permissions`
```sql
CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES operators(id),
  UNIQUE(role_id, permission_id)
);
```

#### `operators` (Extended)
```sql
ALTER TABLE operators ADD COLUMN role_id TEXT REFERENCES roles(id);
-- Note: 'role' column retained for Better Auth compatibility
```

**Migration Note:** Existing operators are backfilled with `role_id` based on their `role` column.

---

## Permissions Reference

### All 27 Permissions

| Category | Permission Name | Label | Description |
|----------|----------------|-------|-------------|
| **Dashboard** | `view_dashboard` | View dashboard and status widgets | Access main dashboard page |
| **Bookings** | `view_bookings` | View booking calendar | View bookings in calendar/list |
| | `manage_bookings` | Create, modify, and cancel bookings | Full CRUD on bookings |
| **Sessions** | `view_sessions` | View active sessions | View running game sessions |
| | `manage_sessions` | Start, pause, and end game sessions | Control session lifecycle |
| **Games** | `view_games` | View game library | View game catalog |
| | `manage_games` | Create and edit games | Full CRUD on games/puzzles/hints |
| **Network** | `view_network` | View network configuration | View SSID, AP settings |
| | `manage_network` | Modify network settings | Change SSID, channel, password |
| **Users** | `view_users` | View operator list | View user directory |
| | `manage_users` | Create and edit operators | Full CRUD on operators |
| | `archive_users` | Archive and restore operators | Archive/unarchive actions |
| **RBAC** | `view_roles` | View roles | View role list with permissions |
| | `manage_roles` | Create and modify custom roles | Create/edit/delete custom roles |
| | `view_permissions` | View permission definitions | View permission catalog |
| | `manage_permissions` | Assign permissions to roles | Edit role-permission mappings |
| **Assets** | `view_assets` | View media assets | View asset library |
| | `manage_assets` | Upload and manage media assets | Upload/delete assets |
| **Storage** | `view_storage` | View storage usage | View storage metrics |
| | `manage_storage` | Delete assets and manage storage | Manage backups, delete files |
| **Cameras** | `view_cameras` | View camera feeds and status | View camera list/streams |
| | `manage_cameras` | Configure cameras and streaming | Add/edit/delete cameras |
| **System** | `view_system_logs` | View system logs | View audit logs |
| | `view_system_health` | View system health | View service status |
| | `manage_system_health` | Restart services and manage system | Restart services, diagnostics |
| | `view_alert_rules` | View alert rules | View alerting configuration |
| | `manage_alert_rules` | Configure alert rules | Create/edit alert rules |

---

## System Roles

### Admin
**Role ID:** `role-admin`
**Permissions:** ALL (27/27)
**Use Case:** Full system access, create custom roles, manage all operators

### Manager
**Role ID:** `role-manager`
**Permissions:** 18/27
- All dashboard, bookings, sessions, games
- View network (no manage)
- View/manage users (no archive)
- View/manage assets/storage
- View/manage cameras
- View system logs and health (no manage)

**Use Case:** Day-to-day operations, game management, user management

### Game Master
**Role ID:** `role-game-master`
**Permissions:** 7/27
- View dashboard, bookings, sessions, games
- Manage sessions
- View cameras
- View system logs

**Use Case:** Run game sessions, send hints, monitor cameras

### Customer
**Role ID:** `role-customer`
**Permissions:** 2/27
- View dashboard
- View bookings

**Use Case:** Limited read-only access for customers/stakeholders

---

## API Endpoints

### Roles Management

#### `GET /api/admin/roles`
**Permission Required:** `view_roles`

**Response:**
```json
[
  {
    "id": "role-admin",
    "name": "admin",
    "description": "Full system access with all permissions",
    "isSystem": true,
    "createdAt": "2025-09-29T10:00:00.000Z",
    "updatedAt": "2025-09-29T10:00:00.000Z",
    "permissions": [
      {
        "id": "perm-view_dashboard",
        "name": "view_dashboard",
        "label": "View dashboard and status widgets",
        "category": "dashboard",
        "description": null,
        "createdAt": "2025-09-29T10:00:00.000Z"
      },
      // ... 26 more permissions
    ]
  },
  // ... more roles
]
```

#### `POST /api/admin/roles`
**Permission Required:** `manage_roles`

**Request Body:**
```json
{
  "name": "senior_operator",
  "description": "Senior operator with elevated permissions",
  "permissionIds": ["perm-view_dashboard", "perm-manage_sessions"]
}
```

**Response:** `201 Created` with created role object

**Validations:**
- Name must be unique
- Name cannot match system role names
- permissionIds must reference existing permissions

#### `GET /api/admin/roles/:id`
**Permission Required:** `view_roles`

**Response:** Single role object with permissions array

#### `PATCH /api/admin/roles/:id`
**Permission Required:** `manage_roles`

**Request Body:**
```json
{
  "name": "senior_operator_updated",
  "description": "Updated description"
}
```

**Response:** Updated role object

**Constraints:**
- Cannot modify system roles (`is_system = 1`)
- Name must remain unique

#### `DELETE /api/admin/roles/:id`
**Permission Required:** `manage_roles`

**Response:** `204 No Content`

**Constraints:**
- Cannot delete system roles
- Cannot delete roles with assigned operators (returns `400` with error message)

#### `PATCH /api/admin/roles/:id/permissions`
**Permission Required:** `manage_permissions`

**Request Body:**
```json
{
  "permissionIds": ["perm-view_dashboard", "perm-manage_sessions", "perm-view_cameras"]
}
```

**Response:** Updated role object with new permissions

**Behavior:**
- Replaces ALL permissions for the role
- Creates audit log entry
- `granted_by` field set to current user ID

### Permissions Management

#### `GET /api/admin/permissions`
**Permission Required:** `view_permissions`

**Response:**
```json
[
  {
    "id": "perm-view_dashboard",
    "name": "view_dashboard",
    "label": "View dashboard and status widgets",
    "category": "dashboard",
    "description": null,
    "createdAt": "2025-09-29T10:00:00.000Z",
    "assignedToRoles": 4
  },
  // ... 26 more
]
```

#### `GET /api/admin/permissions/matrix`
**Permission Required:** `view_permissions`

**Response:**
```json
{
  "permissions": [ /* all 27 permissions */ ],
  "roles": [ /* all roles with their permissions */ ]
}
```

**Use Case:** Render permission matrix showing which roles have which permissions

---

## Frontend Integration

### Page Server Load

```typescript
// apps/escapeplan-web/src/routes/(app)/admin/users/+page.server.ts
import type { PageServerLoad } from './$types';
import type { RoleWithPermissions, PermissionSummary } from '$lib/api/types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
  // Check permissions
  const canViewRoles = locals.user?.permissions?.includes('view_roles') ?? false;
  const canManageRoles = locals.user?.permissions?.includes('manage_roles') ?? false;

  if (!canViewRoles) {
    throw error(403, 'Permission denied');
  }

  // Load roles
  const rolesData = await fetch('/api/admin/roles').then(r => r.json()) as RoleWithPermissions[];

  return {
    rolesData,
    canManageRoles
  };
};
```

### Component Permission Checks

```svelte
<!-- apps/escapeplan-web/src/routes/(app)/admin/users/+page.svelte -->
<script lang="ts">
  let { data } = $props<{ data: PageData }>();

  const canManageRoles = data.canManageRoles;
</script>

{#if canManageRoles}
  <button onclick={createRole}>Create Custom Role</button>
{/if}
```

### Sidebar Navigation

```svelte
<!-- apps/escapeplan-web/src/routes/(app)/+layout.svelte -->
<script lang="ts">
  const canViewRoles = $derived(
    $page.data.user?.permissions?.includes('view_roles') ?? false
  );
  const canManageUsers = $derived(
    $page.data.user?.permissions?.includes('manage_users') ?? false
  );
</script>

{#if canManageUsers || canViewRoles}
  <a href="/admin/users">User Management</a>
{/if}
```

---

## Adding New Permissions

### Step-by-Step Guide

1. **Add permission to contracts:**

```typescript
// packages/contracts/src/index.ts
export type OperatorPermission =
  | 'view_dashboard'
  // ... existing permissions
  | 'new_permission_name'; // Add here
```

2. **Add permission label:**

```typescript
// packages/contracts/src/index.ts
export const PERMISSION_LABELS: Record<OperatorPermission, string> = {
  // ... existing labels
  new_permission_name: 'Human-readable label for UI'
};
```

3. **Update role mappings (optional):**

```typescript
// packages/contracts/src/index.ts
export const ROLE_PERMISSIONS: Record<OperatorRole, OperatorPermission[]> = {
  admin: [ /* all permissions */ 'new_permission_name' ],
  manager: [ /* ... */ 'new_permission_name' ],
  // ...
};
```

4. **Rebuild contracts:**

```bash
cd packages/contracts
pnpm build
```

5. **Create migration to seed new permission:**

```sql
-- apps/escapeplan-api/drizzle/0003_add_new_permission.sql
INSERT INTO permissions (id, name, label, category, description, created_at)
VALUES (
  'perm-new_permission_name',
  'new_permission_name',
  'Human-readable label for UI',
  'appropriate_category',
  NULL,
  CURRENT_TIMESTAMP
);

-- Optionally add to roles
INSERT INTO role_permissions (id, role_id, permission_id, granted_at)
VALUES (
  lower(hex(randomblob(16))),
  'role-admin',
  'perm-new_permission_name',
  CURRENT_TIMESTAMP
);
```

6. **Run migration:**

```bash
cd apps/escapeplan-api
npx drizzle-kit migrate
```

7. **Use in API routes:**

```typescript
api.get('/api/new-feature', async (request, reply) => {
  const session = await ensureAuth(request, reply);
  if (!session) return;
  if (!ensurePermission(reply, session.user.role, session.user.permissions, 'new_permission_name')) {
    return;
  }
  // ... route logic
});
```

8. **Use in frontend:**

```typescript
// +page.server.ts
if (!locals.user?.permissions?.includes('new_permission_name')) {
  throw error(403, 'Permission denied');
}
```

---

## Creating Custom Roles

### Via API

```bash
# Create custom role
curl -X POST http://localhost:4000/api/admin/roles \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" \
  -d '{
    "name": "senior_operator",
    "description": "Senior operator with camera management",
    "permissionIds": [
      "perm-view_dashboard",
      "perm-manage_sessions",
      "perm-view_cameras",
      "perm-manage_cameras"
    ]
  }'
```

### Via Frontend (Planned)

The `/admin/users` page will have a **Roles tab** with:
- Role list (system + custom)
- Create/Edit role modal
- Permission checkboxes grouped by category
- Preview of operators assigned to each role

---

## Security Considerations

### 1. Permission Checking

**✅ DO:**
```typescript
// Always check on BOTH frontend and backend
// Frontend (UX)
if (!locals.user?.permissions?.includes('manage_users')) {
  throw error(403);
}

// Backend (Security)
if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_users')) {
  return; // Already sends 403
}
```

**❌ DON'T:**
```typescript
// Never rely on frontend checks alone
if (userRole === 'admin') { // Client can modify this!
  await dangerousAction();
}
```

### 2. System Role Protection

System roles **cannot** be:
- Deleted
- Renamed
- Have permissions modified

Enforced in `state.ts`:
```typescript
if (existing.isSystem) {
  throw new Error('Cannot modify system roles');
}
```

### 3. Session Enrichment

Permissions are loaded **per-request** from database:
```typescript
// apps/escapeplan-api/src/security.ts
export function permissionsForRole(roleNameOrId: string): OperatorPermission[] {
  // Queries database, not hardcoded
  const permissions = sqlite.prepare(`
    SELECT p.name FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
  `).all(roleId);

  return permissions.map(p => p.name as OperatorPermission);
}
```

### 4. Audit Logging

All role/permission changes are logged:
```typescript
logToDatabase('info', 'rbac', `Created custom role: ${data.name}`, {
  roleId,
  roleName: data.name
});
```

---

## Testing

### Unit Tests

```typescript
// apps/escapeplan-api/test/rbac.test.ts
import { describe, it, expect } from 'vitest';
import { permissionsForRole, hasPermission } from '../src/security';

describe('RBAC System', () => {
  it('admin should have all permissions', () => {
    const perms = permissionsForRole('admin');
    expect(perms).toHaveLength(27);
    expect(perms).toContain('manage_users');
  });

  it('game_master should not have manage_users', () => {
    const result = hasPermission('game_master', 'manage_users');
    expect(result).toBe(false);
  });

  it('custom roles can be created with specific permissions', async () => {
    const role = await createRole({
      name: 'test_role',
      description: 'Test',
      permissionIds: ['perm-view_dashboard']
    });
    expect(role.permissions).toHaveLength(1);
  });
});
```

### Integration Tests

```typescript
// Test role creation flow
it('should create role → assign permissions → verify user access', async () => {
  // 1. Create custom role
  const role = await createRole({ name: 'tester', permissionIds: ['perm-view_dashboard'] });

  // 2. Create operator with custom role
  const operator = await createOperatorAccount({
    username: 'testuser',
    name: 'Test User',
    role: 'tester', // Custom role
    password: 'password123'
  });

  // 3. Verify permissions
  const perms = permissionsForRole(role.id);
  expect(perms).toEqual(['view_dashboard']);
});
```

### Manual Testing Checklist

- [ ] Admin can create custom role
- [ ] Admin can assign permissions to custom role
- [ ] Admin can edit custom role name/description
- [ ] Admin can delete custom role (when no operators assigned)
- [ ] Admin **cannot** delete custom role with assigned operators
- [ ] Admin **cannot** modify system roles
- [ ] Custom role user only sees permitted tabs/features
- [ ] Permission changes reflect immediately in new sessions
- [ ] Sidebar links hide based on permissions
- [ ] API routes block requests without required permissions

---

## Migration from Hardcoded RBAC

If you're upgrading from the hardcoded RBAC system:

1. **Backup database:**
```bash
cp apps/escapeplan-api/data/escapeplan.db apps/escapeplan-api/data/escapeplan-backup.db
```

2. **Run migrations:**
```bash
cd apps/escapeplan-api
npx drizzle-kit migrate
```

3. **Verify role_id backfill:**
```bash
sqlite3 data/escapeplan.db "SELECT username, role, role_id FROM operators;"
```

Expected output:
```
admin|admin|role-admin
manager1|manager|role-manager
gm1|game_master|role-game-master
```

4. **Test permission resolution:**
```bash
# Login as each role, verify permissions in session
curl http://localhost:4000/api/auth/get-session -H "Cookie: better-auth.session_token=TOKEN"
```

---

## Troubleshooting

### Problem: "Permission denied" despite correct role

**Solution:** Verify session enrichment is working:
```bash
curl http://localhost:4000/api/auth/get-session \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" | jq '.user.permissions'
```

Should return array of permissions. If empty, check:
1. `role_id` is set in operators table
2. `role_permissions` table has mappings for that role
3. Session was created **after** permission changes

### Problem: Custom role creation fails

**Solution:** Check constraints:
```sql
-- Verify name is unique
SELECT * FROM roles WHERE name = 'your_role_name';

-- Verify permission IDs exist
SELECT * FROM permissions WHERE id IN ('perm-xxx', 'perm-yyy');
```

### Problem: Cannot delete custom role

**Solution:** Check for assigned operators:
```sql
SELECT COUNT(*) FROM operators WHERE role_id = 'your-role-id';
```

Reassign operators to different role before deletion.

---

## Reference Implementation

### Complete API Route Example

```typescript
// apps/escapeplan-api/src/index.ts
api.get('/api/admin/roles', async (request, reply) => {
  const session = await ensureAuth(request, reply);
  if (!session) return;
  if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_roles')) {
    return;
  }
  return listRoles();
});
```

### Complete Frontend Example

```svelte
<!-- apps/escapeplan-web/src/routes/(app)/admin/users/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  let { data } = $props<{ data: PageData }>();

  async function createRole() {
    const response = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'new_role',
        description: 'Description',
        permissionIds: ['perm-view_dashboard']
      })
    });

    if (response.ok) {
      // Refresh data
      await invalidate('app:admin:users');
    }
  }
</script>

{#if data.canManageRoles}
  <button onclick={createRole}>Create Role</button>
{/if}
```

---

## Runtime Integration

The RBAC system loads roles and permissions from the database using runtime-detected paths. The system works identically in development and production without any configuration changes.

Database path resolution is handled by the **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)**, ensuring the correct SQLite database is accessed regardless of environment.

### Zero-Configuration Deployment

- **Development:** Uses `{cwd}/data/escapeplan.db`
- **Production:** Uses `/var/lib/escapeplan/escapeplan.db`
- **No environment variables required**

---

## Additional Resources

- **Database Schema:** `apps/escapeplan-api/src/db/schema.ts`
- **Security Functions:** `apps/escapeplan-api/src/security.ts`
- **State Functions:** `apps/escapeplan-api/src/state.ts` (lines 2312-2594)
- **API Routes:** `apps/escapeplan-api/src/index.ts` (lines 564-689)
- **Contracts:** `packages/contracts/src/index.ts`

---

**Document Status:** ✅ Validated (2025-10-01)
**Implementation Status:** ✅ Backend Complete | 🔄 Frontend In Progress
**Test Coverage:** Backend (Unit tests pending) | Frontend (E2E pending)

---

## Related Documentation

### Core System Docs
- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Database path resolution for RBAC tables
- **[Database System](./DATABASE_SYSTEM.md)** - operators, roles, permissions, role_permissions tables
- **[API Contracts & Schema Management](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)** - RBAC schema definition

### Integration Docs
- **[Asset Storage Architecture](./ASSET_STORAGE_ARCHITECTURE.md)** - Uses RBAC permissions for access control
- **[Network & WiFi System](./NETWORK_WIFI_SYSTEM.md)** - Uses RBAC permissions for network management
- **[Logging & Alerting System](./LOGGING_ALERTING_SYSTEM.md)** - Uses RBAC permissions for system logs
