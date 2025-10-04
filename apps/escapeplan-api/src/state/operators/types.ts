/**
 * Operators state management types
 *
 * This module defines types for operator (user) operations including:
 * - Operator account creation, updating, and deletion
 * - Role and permission management
 * - Profile and authentication management
 * - Password reset and security operations
 * - Archive and ban operations
 */

import type {
  OperatorProfile,
  OperatorSummary,
  OperatorRole,
  OperatorPermission,
  CreateOperatorRequest,
  UpdateOperatorRequest,
  ResetOperatorPasswordRequest,
  ChangeOwnPasswordRequest,
  UpdateOwnProfileRequest,
  ArchiveOperatorRequest,
  BotttsAvatarConfig
} from '@escapeplan/contracts';
import type { AuditMetadata, ArchiveMetadata } from '../shared/types.js';

/**
 * Re-export contract types for convenience
 */
export type {
  OperatorProfile,
  OperatorSummary,
  OperatorRole,
  OperatorPermission,
  CreateOperatorRequest,
  UpdateOperatorRequest,
  ResetOperatorPasswordRequest,
  ChangeOwnPasswordRequest,
  UpdateOwnProfileRequest,
  ArchiveOperatorRequest,
  BotttsAvatarConfig
};

/**
 * Database row representation of an operator
 */
export interface OperatorRow {
  id: string;
  username: string;
  name: string;
  user_type: string;
  role_id: string;
  avatar_config: string | Record<string, unknown> | null;
  bio: string | null;
  email: string;
  emailVerified: number;
  must_reset_password: number;
  createdAt: string;
  updatedAt: string;
  last_login_at: string | null;
  banned: number | null;
  ban_reason: string | null;
  ban_expires: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archived_reason: string | null;
}

/**
 * Filters for listing operators
 */
export interface OperatorListFilters {
  search?: string;
  role?: OperatorRole | 'all';
  status?: 'active' | 'archived' | 'all';
}

/**
 * Operator with permissions resolved
 */
export interface OperatorWithPermissions extends OperatorProfile {
  permissions: OperatorPermission[];
  roleId: string;
}

/**
 * Ban operator request
 */
export interface BanOperatorRequest {
  reason: string;
  expiresAt?: string | null;
}

/**
 * Unban operator request
 */
export interface UnbanOperatorRequest {
  reason?: string;
}

/**
 * Operator login metadata
 */
export interface OperatorLoginMetadata {
  operatorId: string;
  loginAt: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Operator operation errors
 */
export enum OperatorErrorCode {
  OPERATOR_NOT_FOUND = 'OPERATOR_NOT_FOUND',
  OPERATOR_ARCHIVED = 'OPERATOR_ARCHIVED',
  OPERATOR_BANNED = 'OPERATOR_BANNED',
  USERNAME_CONFLICT = 'USERNAME_CONFLICT',
  EMAIL_CONFLICT = 'EMAIL_CONFLICT',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CANNOT_SELF_DELETE = 'CANNOT_SELF_DELETE',
  CANNOT_SELF_ARCHIVE = 'CANNOT_SELF_ARCHIVE',
}

export interface OperatorError {
  code: OperatorErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  requiredPermission?: OperatorPermission;
}

/**
 * Role with permissions
 */
export interface RoleWithPermissions {
  id: string;
  name: string;
  displayName: string;
  permissions: OperatorPermission[];
  userTypeScope: 'operator' | 'customer' | 'both';
  createdAt: string;
  updatedAt: string;
}
