import { sqlite } from './db/client.js';
import type { OperatorPermission, OperatorRole } from '@escapeplan/contracts';

const VALID_ROLES = new Set<OperatorRole>(['admin', 'manager', 'game_master', 'customer']);

export function normalizeRole(role: string): OperatorRole {
  if (VALID_ROLES.has(role as OperatorRole)) {
    return role as OperatorRole;
  }
  throw new Error(`Unsupported operator role: ${role}`);
}

export function resolveRoleId(role: OperatorRole): string {
  const record = sqlite
    .prepare('SELECT id FROM roles WHERE name = ? LIMIT 1')
    .get(role) as { id: string } | undefined;

  if (!record) {
    throw new Error(`Role not found: ${role}`);
  }

  return record.id;
}

/**
 * Get permissions for a role from the database.
 * Falls back to querying by role name if role_id is not provided.
 */
export function permissionsForRole(roleNameOrId: string): OperatorPermission[] {
  // Try to find role by name or ID
  const role = sqlite.prepare(`
    SELECT id, name FROM roles WHERE name = ? OR id = ? LIMIT 1
  `).get(roleNameOrId, roleNameOrId) as { id: string; name: string } | undefined;

  if (!role) {
    throw new Error(`Role not found: ${roleNameOrId}`);
  }

  // Get all permissions for this role
  const permissions = sqlite.prepare(`
    SELECT p.name
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
    ORDER BY p.category, p.name
  `).all(role.id) as Array<{ name: string }>;

  return permissions.map(p => p.name as OperatorPermission);
}

/**
 * Check if a permission name is valid (exists in database).
 */
export function sanitizePermissionName(permission: string): OperatorPermission | null {
  const result = sqlite.prepare('SELECT name FROM permissions WHERE name = ? LIMIT 1').get(permission) as { name: string } | undefined;
  return result ? (result.name as OperatorPermission) : null;
}

/**
 * Check if a role has a specific permission (queries database).
 */
export function hasPermission(roleNameOrId: string, permission: OperatorPermission): boolean {
  const normalizedRole = normalizeRole(roleNameOrId);

  // Admin always has all permissions
  if (normalizedRole === 'admin') {
    return true;
  }

  // Query database for this specific role-permission mapping
  const result = sqlite.prepare(`
    SELECT 1
    FROM roles r
    INNER JOIN role_permissions rp ON r.id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.id
    WHERE r.name = ? AND p.name = ?
    LIMIT 1
  `).get(normalizedRole, permission);

  return Boolean(result);
}

/**
 * Normalize and merge role-based and custom permissions.
 * Queries database for role permissions, then merges with stored custom permissions.
 */
export function normalizePermissions(roleNameOrId: string, storedCustomPerms?: string | null): OperatorPermission[] {
  const normalizedRole = normalizeRole(roleNameOrId);

  // Get permissions from database for this role
  const rolePerms = permissionsForRole(normalizedRole);

  // Parse any custom permissions stored in operators.permissions JSON field
  const customPerms = storedCustomPerms ? parseStoredPermissions(storedCustomPerms) : [];

  // Merge and deduplicate
  const merged = new Set<OperatorPermission>([...rolePerms, ...customPerms]);
  return Array.from(merged);
}

/**
 * Get all available permissions from database.
 */
export function getAllPermissions(): OperatorPermission[] {
  const permissions = sqlite.prepare('SELECT name FROM permissions ORDER BY category, name').all() as Array<{ name: string }>;
  return permissions.map(p => p.name as OperatorPermission);
}

/**
 * Get all available roles from database.
 */
export function getAllRoles(): Array<{ id: string; name: OperatorRole; description: string | null; isSystem: boolean }> {
  const roles = sqlite.prepare('SELECT id, name, description, is_system FROM roles ORDER BY name').all() as Array<{
    id: string;
    name: string;
    description: string | null;
    is_system: number;
  }>;

  return roles.map(r => ({
    id: r.id,
    name: r.name as OperatorRole,
    description: r.description,
    isSystem: Boolean(r.is_system)
  }));
}

function parseStoredPermissions(value: string): OperatorPermission[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => (typeof entry === 'string' ? sanitizePermissionName(entry) : null))
      .filter((entry): entry is OperatorPermission => entry !== null);
  } catch {
    return [];
  }
}
