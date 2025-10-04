/**
 * Shared types and utilities for state management modules
 *
 * This module provides common types, helper functions, and utilities
 * used across all state management domains (network, games, operators,
 * sessions, bookings, dashboard).
 */

/**
 * Generic result type for operations that may fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Standard filters for list operations
 */
export interface ListFilters {
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Safely parse JSON with type inference
 * Returns undefined if parsing fails or value is null
 */
export function safeParse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Format a date string to ISO 8601
 */
export function toISOString(date: Date | string): string {
  if (typeof date === 'string') {
    return new Date(date).toISOString();
  }
  return date.toISOString();
}

/**
 * Check if a date string represents a valid date
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Database row to domain model converter helper
 */
export type RowToModel<TRow, TModel> = (row: TRow) => TModel;

/**
 * Common error codes for state operations
 */
export enum StateErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFLICT = 'CONFLICT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Standard error structure for state operations
 */
export interface StateError {
  code: StateErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Create a standard state error
 */
export function createStateError(
  code: StateErrorCode,
  message: string,
  details?: Record<string, unknown>
): StateError {
  return { code, message, details };
}

/**
 * Archive metadata for soft-deleted records
 */
export interface ArchiveMetadata {
  archivedAt: string;
  archivedBy: string;
  archivedReason?: string | null;
}

/**
 * Audit metadata for record tracking
 */
export interface AuditMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Check if a record is archived
 */
export function isArchived(record: { archivedAt?: string | null }): boolean {
  return record.archivedAt != null;
}

/**
 * Filter archived records from a list
 */
export function filterArchived<T extends { archivedAt?: string | null }>(
  records: T[],
  includeArchived = false
): T[] {
  if (includeArchived) {
    return records;
  }
  return records.filter(record => !isArchived(record));
}
