/**
 * Operators domain state management
 *
 * This module provides operator (user) account operations using a class-based state pattern
 * inspired by Svelte 5 runes. All functions maintain existing behavior from the original
 * state.ts implementation, with full Better Auth integration.
 */

import { sqlite } from '../../db/client.js';
import { auth } from '../../auth.js';
import { normalizeRole, resolveRoleId, permissionsForRole } from '../../security.js';
import type {
  OperatorProfile,
  OperatorSummary,
  OperatorRole,
  OperatorPermission,
  CreateOperatorRequest,
  UpdateOperatorRequest,
  ResetOperatorPasswordRequest,
  ChangeOwnPasswordRequest,
  UpdateOwnProfileRequest
} from '@escapeplan/contracts';
import type { OperatorRow, OperatorListFilters } from './types.js';

/**
 * Better Auth context promise (cached)
 */
const authContextPromise = auth.$context;

/**
 * Get Better Auth context
 */
async function getAuthContext() {
  return authContextPromise;
}

/**
 * Get Better Auth internal adapter
 */
async function getInternalAdapter() {
  const context = await getAuthContext();
  return context.internalAdapter;
}

/**
 * Get operator row from database by ID
 */
function getOperatorRow(id: string): OperatorRow | undefined {
  return sqlite.prepare(`SELECT * FROM user WHERE id = ? LIMIT 1`).get(id) as OperatorRow | undefined;
}

/**
 * Map database operator row to OperatorProfile domain object
 */
function mapOperator(row: OperatorRow | undefined): OperatorProfile | undefined {
  if (!row) return undefined;

  // Get role name from role_id
  const roleRecord = sqlite
    .prepare(`SELECT name FROM roles WHERE id = ? LIMIT 1`)
    .get(row.role_id) as { name: string } | undefined;

  if (!roleRecord) {
    throw new Error(`Role not found for role_id: ${row.role_id}`);
  }

  const resolvedRole = normalizeRole(roleRecord.name);

  // Get permissions from database via role_id
  const permissions = permissionsForRole(row.role_id);

  // Handle avatar_config: can be string (raw SQLite) or already parsed (Drizzle with mode: 'json')
  let avatarConfig;
  if (row.avatar_config) {
    try {
      avatarConfig = typeof row.avatar_config === 'string'
        ? JSON.parse(row.avatar_config)
        : row.avatar_config;
    } catch {
      avatarConfig = undefined;
    }
  }

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: resolvedRole,
    avatarConfig,
    bio: row.bio ?? undefined,
    permissions,
    email: row.email ?? undefined,
    emailVerified: Boolean(row.emailVerified),
    banned: row.banned ? Boolean(row.banned) : undefined,
    banReason: row.ban_reason ?? undefined,
    banExpires: row.ban_expires ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedBy: row.archived_by ?? undefined,
    archivedReason: row.archived_reason ?? undefined
  };
}

/**
 * Map database operator row to OperatorSummary (includes additional fields)
 */
function mapOperatorSummary(row: OperatorRow): OperatorSummary {
  const profile = mapOperator(row);
  if (!profile) {
    throw new Error('Unable to map operator row');
  }
  return {
    ...profile,
    mustResetPassword: Boolean(row.must_reset_password),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.last_login_at ?? undefined
  };
}

/**
 * Class-based state management for operators domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 */
class OperatorsState {
  // In a Svelte context, these would use $state rune
  // For backend, we keep them as regular class properties
  operators: OperatorSummary[] = [];
  currentOperator: OperatorProfile | undefined = undefined;

  /**
   * Create a new operator account
   */
  async createOperatorAccount(input: CreateOperatorRequest): Promise<OperatorSummary> {
    const username = input.username.trim();
    const existing = sqlite
      .prepare(`SELECT id FROM user WHERE username = ? LIMIT 1`)
      .get(username) as { id: string } | undefined;
    if (existing) {
      throw new Error('Username already exists');
    }

    const email = input.email?.trim();

    const role = normalizeRole(input.role);
    const roleId = resolveRoleId(role);
    const permissions = permissionsForRole(role);
    const context = await getAuthContext();
    const adapter = await getInternalAdapter();

    if (email) {
      const existingByEmail = await adapter.findUserByEmail(email);
      if (existingByEmail) {
        throw new Error('Email already exists');
      }
    }

    const trimmedName = input.name.trim();
    const trimmedBio = input.bio?.trim() ?? null;
    // Better-Auth uses 'image' field which maps to 'avatar_config' column with mode: 'json'
    // Drizzle will automatically JSON.stringify the object, so pass it directly
    const avatarImage = input.avatarConfig ?? undefined;

    const hashedPassword = await context.password.hash(input.password);

    // Create user - password goes in account table, not user table
    const user = await adapter.createUser({
      ...(email ? { email } : {}),
      name: trimmedName,
      username,
      user_type: 'operator',
      role_id: roleId,
      ...(trimmedBio ? { bio: trimmedBio } : {}),
      ...(avatarImage ? { avatar_config: JSON.stringify(avatarImage) } : {}),
      must_reset_password: input.mustResetPassword ?? false,
      emailVerified: Boolean(email),
      archived_at: null,
      archived_by: null,
      archived_reason: null
    } as any) as any;

    await adapter.createAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: hashedPassword
    });

    // Note: role_id is already set in createUser via additionalFields
    // Permissions are derived from role_id via database relationships, not stored directly

    const row = getOperatorRow(user.id);
    if (!row) {
      throw new Error('Failed to load created operator');
    }
    return mapOperatorSummary(row);
  }

  /**
   * Update an existing operator account
   */
  async updateOperatorAccount(id: string, input: UpdateOperatorRequest): Promise<OperatorSummary> {
    const row = getOperatorRow(id);
    if (!row) {
      throw new Error('Operator not found');
    }

    // Get current role name from role_id if no new role is provided
    let roleValue: string;
    if (input.role !== undefined) {
      roleValue = input.role;
    } else {
      const currentRoleRecord = sqlite
        .prepare(`SELECT name FROM roles WHERE id = ? LIMIT 1`)
        .get(row.role_id) as { name: string } | undefined;
      if (!currentRoleRecord) {
        throw new Error(`Role not found for role_id: ${row.role_id}`);
      }
      roleValue = currentRoleRecord.name;
    }

    const resolvedRole = normalizeRole(roleValue);
    const resolvedRoleId = resolveRoleId(resolvedRole);
    const permissions = permissionsForRole(resolvedRole);
    const context = await getAuthContext();
    const adapter = await getInternalAdapter();

    // permissions column has mode: 'json', so Drizzle will automatically stringify the array
    const updates: Record<string, unknown> = {
      role: resolvedRole,
      roleId: resolvedRoleId,
      permissions: permissions
    };

    if (input.name !== undefined) {
      updates.name = input.name.trim();
    }
    if (input.email !== undefined) {
      updates.email = input.email?.trim();
    }
    if (input.avatarConfig !== undefined) {
      // Better-Auth uses 'image' field which maps to 'avatar_config' column with mode: 'json'
      // Drizzle will automatically JSON.stringify the object, so pass it directly
      updates.image = input.avatarConfig ?? null;
    }
    if (input.bio !== undefined) {
      const trimmed = input.bio?.trim();
      updates.bio = trimmed && trimmed.length > 0 ? trimmed : null;
    }
    if (input.mustResetPassword !== undefined) {
      updates.mustResetPassword = input.mustResetPassword;
    }

    await adapter.updateUser(id, updates);

    const updated = getOperatorRow(id);
    if (!updated) {
      throw new Error('Unable to load updated operator');
    }
    return mapOperatorSummary(updated);
  }

  /**
   * Reset operator password (admin function)
   */
  async resetOperatorPassword(
    id: string,
    input: ResetOperatorPasswordRequest
  ): Promise<OperatorSummary> {
    const row = getOperatorRow(id);
    if (!row) {
      throw new Error('Operator not found');
    }

    const context = await getAuthContext();
    const adapter = await getInternalAdapter();
    const hashedPassword = await context.password.hash(input.password);

    const accounts = await adapter.findAccounts(id);
    const credential = accounts.find((account) => account.providerId === 'credential');
    if (!credential) {
      await adapter.createAccount({
        userId: id,
        providerId: 'credential',
        accountId: id,
        password: hashedPassword
      });
    } else {
      await adapter.updatePassword(id, hashedPassword);
    }

    const mustReset = input.forceReset ?? true;
    await adapter.updateUser(id, { mustResetPassword: mustReset, passwordHash: hashedPassword });

    const updated = getOperatorRow(id);
    if (!updated) {
      throw new Error('Unable to read operator');
    }
    return mapOperatorSummary(updated);
  }

  /**
   * Change own password (self-service)
   */
  async changeOwnPassword(operatorId: string, payload: ChangeOwnPasswordRequest): Promise<void> {
    const context = await getAuthContext();
    const adapter = await getInternalAdapter();
    const accounts = await adapter.findAccounts(operatorId);
    const credential = accounts.find((account) => account.providerId === 'credential');
    if (!credential || !credential.password) {
      throw new Error('Credential account not configured for this user');
    }

    const valid = await context.password.verify({ password: payload.currentPassword, hash: credential.password });
    if (!valid) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await context.password.hash(payload.newPassword);
    await adapter.updatePassword(operatorId, hashedPassword);
    await adapter.updateUser(operatorId, { mustResetPassword: false, passwordHash: hashedPassword });
  }

  /**
   * Update own profile (self-service)
   */
  async updateOwnProfile(operatorId: string, payload: UpdateOwnProfileRequest): Promise<OperatorProfile> {
    const row = getOperatorRow(operatorId);
    if (!row) {
      throw new Error('Operator not found');
    }

    // Build updates object for Better-Auth adapter
    const updates: Record<string, unknown> = {};

    if (payload.name !== undefined) {
      updates.name = payload.name.trim();
    }
    if (payload.email !== undefined) {
      updates.email = payload.email?.trim();
    }
    if (payload.avatarConfig !== undefined) {
      // Better-Auth uses 'image' field which maps to 'avatar_config' column with mode: 'json'
      // Pass the object directly - Better Auth adapter + Drizzle will handle serialization
      updates.image = payload.avatarConfig ?? null;
    }
    if (payload.bio !== undefined) {
      const trimmed = payload.bio?.trim();
      updates.bio = trimmed || null;
    }

    // Use Better-Auth adapter to update
    const adapter = await getInternalAdapter();
    await adapter.updateUser(operatorId, updates);

    const updated = getOperatorRow(operatorId);
    const profile = mapOperator(updated);
    if (!profile) {
      throw new Error('Unable to load updated profile');
    }
    return profile;
  }

  /**
   * Delete operator account (hard delete)
   */
  async deleteOperatorAccount(id: string): Promise<void> {
    const row = getOperatorRow(id);
    if (!row) return;

    // Get role name from role_id to check if admin
    const roleRecord = sqlite
      .prepare(`SELECT name FROM roles WHERE id = ? LIMIT 1`)
      .get(row.role_id) as { name: string } | undefined;

    if (roleRecord?.name === 'admin') {
      const adminCount = sqlite
        .prepare(`SELECT COUNT(*) as count FROM user u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin'`)
        .get() as { count: number };
      if (adminCount.count <= 1) {
        throw new Error('Cannot remove the final admin account');
      }
    }
    const adapter = await getInternalAdapter();
    await adapter.deleteUser(id);
  }

  /**
   * Archive operator account (soft delete)
   */
  async archiveOperatorAccount(
    id: string,
    actorId: string,
    reason?: string | null
  ): Promise<OperatorSummary> {
    const row = getOperatorRow(id);
    if (!row) {
      throw new Error('Operator not found');
    }

    // Get role name from role_id to check if admin
    const roleRecord = sqlite
      .prepare(`SELECT name FROM roles WHERE id = ? LIMIT 1`)
      .get(row.role_id) as { name: string } | undefined;

    if (roleRecord?.name === 'admin') {
      const adminCount = sqlite
        .prepare(`SELECT COUNT(*) as count FROM user u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin' AND u.archived_at IS NULL`)
        .get() as { count: number };
      if (adminCount.count <= 1) {
        throw new Error('Cannot archive the final active admin');
      }
    }

    const now = new Date().toISOString();
    const adapter = await getInternalAdapter();
    await adapter.updateUser(id, {
      archivedAt: now,
      archivedBy: actorId,
      archivedReason: reason ?? null
    });

    sqlite.prepare(`DELETE FROM session WHERE userId = ?`).run(id);

    const updated = getOperatorRow(id);
    if (!updated) {
      throw new Error('Unable to read archived operator');
    }
    return mapOperatorSummary(updated);
  }

  /**
   * Unarchive operator account
   */
  async unarchiveOperatorAccount(id: string): Promise<OperatorSummary> {
    const row = getOperatorRow(id);
    if (!row) {
      throw new Error('Operator not found');
    }

    const adapter = await getInternalAdapter();
    await adapter.updateUser(id, {
      archivedAt: null,
      archivedBy: null,
      archivedReason: null
    });

    const updated = getOperatorRow(id);
    if (!updated) {
      throw new Error('Unable to read restored operator');
    }
    return mapOperatorSummary(updated);
  }

  /**
   * Find operator by ID
   */
  findOperatorById(id: string): OperatorProfile | undefined {
    const stmt = sqlite.prepare(`SELECT * FROM user WHERE id = ? LIMIT 1`);
    const row = stmt.get(id) as OperatorRow | undefined;
    return mapOperator(row);
  }

  /**
   * List operator summaries with filters
   */
  listOperatorSummaries(filters: OperatorListFilters = {}): OperatorSummary[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status === 'archived') {
      conditions.push('u.archived_at IS NOT NULL');
    } else if (filters.status === 'active') {
      conditions.push('u.archived_at IS NULL');
    }

    if (filters.role && filters.role !== 'all') {
      conditions.push('r.name = ?');
      params.push(filters.role);
    }

    if (filters.search && filters.search.trim().length) {
      const normalized = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push(
        '(LOWER(u.username) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(COALESCE(u.email, \'\')) LIKE ?)'
      );
      params.push(normalized, normalized, normalized);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = sqlite
      .prepare(
        `SELECT u.*
         FROM user u
         JOIN roles r ON u.role_id = r.id
         ${whereClause}
         ORDER BY CASE WHEN u.archived_at IS NULL THEN 0 ELSE 1 END,
                  u.name COLLATE NOCASE ASC`
      )
      .all(...params) as OperatorRow[];
    return rows.map(mapOperatorSummary);
  }

  /**
   * Update operator login timestamp
   */
  updateOperatorLoginTimestamp(id: string, iso: string): void {
    sqlite.prepare(`UPDATE user SET last_login_at = ?, updatedAt = ? WHERE id = ?`).run(iso, iso, id);
  }

  /**
   * Get all permissions for a user by querying their role's permissions
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const result = sqlite.prepare(`
      SELECT DISTINCT p.name
      FROM user u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.id = ?
    `).all(userId) as { name: string }[];
    return result.map(row => row.name);
  }

  /**
   * Check if a user has a specific permission
   */
  async userHasPermission(userId: string, permissionName: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return userPermissions.includes(permissionName);
  }

  /**
   * Require a user to have a specific permission, throwing an error if they don't
   */
  async requirePermission(userId: string, permissionName: string): Promise<void> {
    const hasPermission = await this.userHasPermission(userId, permissionName);
    if (!hasPermission) {
      throw new Error(`Permission denied: ${permissionName}`);
    }
  }
}

/**
 * Singleton instance of the operators state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const operatorsState = new OperatorsState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const createOperatorAccount = (input: CreateOperatorRequest) =>
  operatorsState.createOperatorAccount(input);

export const updateOperatorAccount = (id: string, input: UpdateOperatorRequest) =>
  operatorsState.updateOperatorAccount(id, input);

export const resetOperatorPassword = (id: string, input: ResetOperatorPasswordRequest) =>
  operatorsState.resetOperatorPassword(id, input);

export const changeOwnPassword = (operatorId: string, payload: ChangeOwnPasswordRequest) =>
  operatorsState.changeOwnPassword(operatorId, payload);

export const updateOwnProfile = (operatorId: string, payload: UpdateOwnProfileRequest) =>
  operatorsState.updateOwnProfile(operatorId, payload);

export const deleteOperatorAccount = (id: string) =>
  operatorsState.deleteOperatorAccount(id);

export const archiveOperatorAccount = (id: string, actorId: string, reason?: string | null) =>
  operatorsState.archiveOperatorAccount(id, actorId, reason);

export const unarchiveOperatorAccount = (id: string) =>
  operatorsState.unarchiveOperatorAccount(id);

export const findOperatorById = (id: string) =>
  operatorsState.findOperatorById(id);

export const listOperatorSummaries = (filters?: OperatorListFilters) =>
  operatorsState.listOperatorSummaries(filters);

export const updateOperatorLoginTimestamp = (id: string, iso: string) =>
  operatorsState.updateOperatorLoginTimestamp(id, iso);

export const getUserPermissions = (userId: string) =>
  operatorsState.getUserPermissions(userId);

export const userHasPermission = (userId: string, permissionName: string) =>
  operatorsState.userHasPermission(userId, permissionName);

export const requirePermission = (userId: string, permissionName: string) =>
  operatorsState.requirePermission(userId, permissionName);

/**
 * Export helper functions that may be used by other modules
 */
export { mapOperator, mapOperatorSummary, getOperatorRow };

/**
 * Re-export types for convenience
 */
export type { OperatorListFilters } from './types.js';
