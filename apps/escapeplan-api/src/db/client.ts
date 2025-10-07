import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@escapeplan/contracts';
import { getDatabasePath, ensureDataDirectorySync } from '@escapeplan/contracts/paths';

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

// Ensure data directory exists before opening database (synchronous to avoid top-level await)
ensureDataDirectorySync();

const dbFile = getDatabasePath();

// Initialize better-sqlite3 with WAL mode for better concurrency
export const sqlite = new Database(dbFile);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Initialize Drizzle ORM with full schema for type-safe queries
export const db = drizzle({ client: sqlite, schema });

// ============================================================================
// MIGRATIONS
// ============================================================================

/**
 * Runs database migrations during application startup.
 * This is a wrapper around the async applyMigrations function from migrate.ts.
 *
 * IMPORTANT: This must be awaited in buildServer() to ensure migrations
 * complete before the application starts accepting requests.
 */
export async function runMigrations(): Promise<void> {
  const { applyMigrations } = await import('./migrate.js');
  await applyMigrations();
}
