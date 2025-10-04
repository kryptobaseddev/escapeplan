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
