import { ALL_PERMISSIONS, ROLE_PERMISSIONS, type OperatorPermission, type OperatorRole } from '@escapeplan/contracts';

const VALID_ROLES = new Set<OperatorRole>(['admin', 'manager', 'game_master', 'customer']);

export function normalizeRole(role: string): OperatorRole {
  if (VALID_ROLES.has(role as OperatorRole)) {
    return role as OperatorRole;
  }
  throw new Error(`Unsupported operator role: ${role}`);
}

export function permissionsForRole(role: string): OperatorPermission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}

export function sanitizePermissionName(permission: string): OperatorPermission | null {
  if ((ALL_PERMISSIONS as string[]).includes(permission)) {
    return permission as OperatorPermission;
  }
  return null;
}

export function hasPermission(role: string, permission: OperatorPermission): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || ROLE_PERMISSIONS[normalized].includes(permission);
}

export function normalizePermissions(role: string, stored?: string | null): OperatorPermission[] {
  const normalizedRole = normalizeRole(role);
  const resolved = stored ? parseStoredPermissions(stored) : [];
  const merged = new Set<OperatorPermission>([...ROLE_PERMISSIONS[normalizedRole], ...resolved]);
  return Array.from(merged);
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
