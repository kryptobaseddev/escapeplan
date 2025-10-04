/**
 * RBAC (Roles and Permissions) state management
 *
 * This module provides role and permission management operations using a class-based state pattern
 * inspired by Svelte 5 runes. These functions manage the RBAC system separately from operator accounts.
 */

import { randomUUID } from 'node:crypto';
import { sqlite } from '../../db/client.js';
import { logToDatabase } from '../../logging/index.js';
import type {
  RoleWithPermissions,
  PermissionSummary,
  OperatorPermission,
  PermissionCategory,
  CreateRoleRequest,
  UpdateRoleRequest,
  UpdateRolePermissionsRequest,
  GetPermissionsResponse,
  GetRolesResponse
} from '@escapeplan/contracts';

/**
 * Class-based state management for RBAC domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 */
class RolesState {
  // In a Svelte context, these would use $state rune
  // For backend, we keep them as regular class properties
  roles: RoleWithPermissions[] = [];
  permissions: PermissionSummary[] = [];

  /**
   * List all roles with their permissions
   */
  listRoles(): RoleWithPermissions[] {
    const roles = sqlite.prepare(`
      SELECT
        r.id,
        r.name,
        r.description,
        r.is_system as isSystem,
        r.created_at as createdAt,
        r.updated_at as updatedAt
      FROM roles r
      ORDER BY r.is_system DESC, r.name ASC
    `).all() as Array<{
      id: string;
      name: string;
      description: string | null;
      isSystem: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return roles.map(role => {
      const permissions = sqlite.prepare(`
        SELECT p.id, p.name, p.label, p.category, p.description, p.created_at as createdAt
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.category, p.name
      `).all(role.id) as Array<{
        id: string;
        name: string;
        label: string;
        category: string;
        description: string | null;
        createdAt: string;
      }>;

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: Boolean(role.isSystem),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        permissions: permissions.map(p => ({
          ...p,
          name: p.name as OperatorPermission,
          category: p.category as PermissionCategory
        }))
      };
    });
  }

  /**
   * Get a single role with its permissions
   */
  getRoleById(roleId: string): RoleWithPermissions | null {
    const role = sqlite.prepare(`
      SELECT
        r.id,
        r.name,
        r.description,
        r.is_system as isSystem,
        r.created_at as createdAt,
        r.updated_at as updatedAt
      FROM roles r
      WHERE r.id = ?
    `).get(roleId) as {
      id: string;
      name: string;
      description: string | null;
      isSystem: number;
      createdAt: string;
      updatedAt: string;
    } | undefined;

    if (!role) {
      return null;
    }

    const permissions = sqlite.prepare(`
      SELECT p.id, p.name, p.label, p.category, p.description, p.created_at as createdAt
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.category, p.name
    `).all(roleId) as Array<{
      id: string;
      name: string;
      label: string;
      category: string;
      description: string | null;
      createdAt: string;
    }>;

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: Boolean(role.isSystem),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissions: permissions.map(p => ({
        ...p,
        name: p.name as OperatorPermission,
        category: p.category as PermissionCategory
      }))
    };
  }

  /**
   * Create a new custom role
   */
  createRole(data: CreateRoleRequest): RoleWithPermissions {
    const roleId = randomUUID();
    const now = new Date().toISOString();

    // Insert role
    sqlite.prepare(`
      INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(roleId, data.name, data.description ?? null, now, now);

    // Insert permissions if provided
    if (data.permissionIds && data.permissionIds.length > 0) {
      const insertPermStmt = sqlite.prepare(`
        INSERT INTO role_permissions (id, role_id, permission_id, granted_at)
        VALUES (?, ?, ?, ?)
      `);

      for (const permissionId of data.permissionIds) {
        insertPermStmt.run(randomUUID(), roleId, permissionId, now);
      }
    }

    logToDatabase('info', 'rbac', `Created custom role: ${data.name}`, { roleId, roleName: data.name });

    const created = this.getRoleById(roleId);
    if (!created) {
      throw new Error('Failed to retrieve created role');
    }

    return created;
  }

  /**
   * Update a role's metadata (name, description)
   */
  updateRole(roleId: string, data: UpdateRoleRequest): RoleWithPermissions {
    const existing = this.getRoleById(roleId);
    if (!existing) {
      throw new Error('Role not found');
    }

    if (existing.isSystem) {
      throw new Error('Cannot modify system roles');
    }

    const now = new Date().toISOString();
    const name = data.name ?? existing.name;
    const description = data.description !== undefined ? data.description : existing.description;

    sqlite.prepare(`
      UPDATE roles
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `).run(name, description, now, roleId);

    logToDatabase('info', 'rbac', `Updated role: ${name}`, { roleId, changes: data });

    const updated = this.getRoleById(roleId);
    if (!updated) {
      throw new Error('Failed to retrieve updated role');
    }

    return updated;
  }

  /**
   * Update a role's permissions
   */
  updateRolePermissions(roleId: string, data: UpdateRolePermissionsRequest, grantedBy?: string): RoleWithPermissions {
    const existing = this.getRoleById(roleId);
    if (!existing) {
      throw new Error('Role not found');
    }

    if (existing.isSystem) {
      throw new Error('Cannot modify permissions for system roles');
    }

    const now = new Date().toISOString();

    // Transaction: delete existing permissions, then insert new ones
    sqlite.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);

    if (data.permissionIds && data.permissionIds.length > 0) {
      const insertStmt = sqlite.prepare(`
        INSERT INTO role_permissions (id, role_id, permission_id, granted_at, granted_by)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const permissionId of data.permissionIds) {
        insertStmt.run(randomUUID(), roleId, permissionId, now, grantedBy ?? null);
      }
    }

    // Update role's updated_at timestamp
    sqlite.prepare('UPDATE roles SET updated_at = ? WHERE id = ?').run(now, roleId);

    logToDatabase('info', 'rbac', `Updated permissions for role: ${existing.name}`, {
      roleId,
      permissionCount: data.permissionIds?.length ?? 0,
      grantedBy
    });

    const updated = this.getRoleById(roleId);
    if (!updated) {
      throw new Error('Failed to retrieve updated role');
    }

    return updated;
  }

  /**
   * Delete a custom role
   */
  deleteRole(roleId: string): void {
    const existing = this.getRoleById(roleId);
    if (!existing) {
      throw new Error('Role not found');
    }

    if (existing.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    // Check if any operators are using this role
    const operatorsUsingRole = sqlite.prepare('SELECT COUNT(*) as count FROM user WHERE role_id = ?').get(roleId) as { count: number };
    if (operatorsUsingRole.count > 0) {
      throw new Error(`Cannot delete role: ${operatorsUsingRole.count} operator(s) are assigned to this role`);
    }

    sqlite.prepare('DELETE FROM roles WHERE id = ?').run(roleId);

    logToDatabase('info', 'rbac', `Deleted custom role: ${existing.name}`, { roleId });
  }

  /**
   * List all permissions
   */
  listPermissions(): PermissionSummary[] {
    const permissions = sqlite.prepare(`
      SELECT
        p.id,
        p.name,
        p.label,
        p.category,
        p.description,
        p.created_at as createdAt,
        (SELECT COUNT(*) FROM role_permissions WHERE permission_id = p.id) as assignedToRoles
      FROM permissions p
      ORDER BY p.category, p.name
    `).all() as Array<{
      id: string;
      name: string;
      label: string;
      category: string;
      description: string | null;
      createdAt: string;
      assignedToRoles: number;
    }>;

    return permissions.map(p => ({
      ...p,
      name: p.name as OperatorPermission,
      category: p.category as PermissionCategory
    }));
  }

  /**
   * Get permission matrix (all roles with all permissions)
   */
  getPermissionMatrix(): GetPermissionsResponse & GetRolesResponse {
    return {
      permissions: this.listPermissions(),
      roles: this.listRoles()
    };
  }
}

/**
 * Singleton instance of the roles state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const rolesState = new RolesState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const listRoles = () => rolesState.listRoles();

export const getRoleById = (roleId: string) => rolesState.getRoleById(roleId);

export const createRole = (data: CreateRoleRequest) => rolesState.createRole(data);

export const updateRole = (roleId: string, data: UpdateRoleRequest) => rolesState.updateRole(roleId, data);

export const updateRolePermissions = (roleId: string, data: UpdateRolePermissionsRequest, grantedBy?: string) =>
  rolesState.updateRolePermissions(roleId, data, grantedBy);

export const deleteRole = (roleId: string) => rolesState.deleteRole(roleId);

export const listPermissions = () => rolesState.listPermissions();

export const getPermissionMatrix = () => rolesState.getPermissionMatrix();
