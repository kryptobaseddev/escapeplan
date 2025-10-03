import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@escapeplan/contracts';
import { getDatabasePath, ensureDataDirectory } from '@escapeplan/contracts/paths';

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

// Ensure data directory exists before opening database
await ensureDataDirectory();

const dbFile = getDatabasePath();

// Initialize better-sqlite3 with WAL mode for better concurrency
export const sqlite = new Database(dbFile);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Initialize Drizzle ORM with full schema for type-safe queries
export const db = drizzle({ client: sqlite, schema });
