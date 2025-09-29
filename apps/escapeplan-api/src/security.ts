import type { OperatorPermission, OperatorRole } from '@escapeplan/contracts';

const ROLE_PERMISSION_MAP: Record<OperatorRole, OperatorPermission[]> = {
  admin: ['manage_users', 'manage_games', 'manage_network', 'manage_sessions', 'rotate_admin_credentials', 'view_network'],
  general_manager: ['manage_games', 'manage_sessions', 'rotate_admin_credentials', 'view_network'],
  game_master: ['manage_sessions'],
  technician: ['manage_network', 'view_network']
};

export function permissionsForRole(role: OperatorRole): OperatorPermission[] {
  return ROLE_PERMISSION_MAP[role] ?? [];
}

export function hasPermission(role: OperatorRole, permission: OperatorPermission): boolean {
  return permissionsForRole(role).includes(permission) || role === 'admin';
}

export function normalizePermissions(role: OperatorRole, stored?: string | null): OperatorPermission[] {
  const value = stored ? (JSON.parse(stored) as OperatorPermission[]) : [];
  const merged = new Set<OperatorPermission>([...permissionsForRole(role), ...value]);
  return Array.from(merged);
}
