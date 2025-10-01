import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const moduleDir = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(moduleDir, '../../data');
mkdirSync(dataPath, { recursive: true });

const dbFile = resolve(dataPath, 'escapeplan.db');

// Initialize better-sqlite3 with WAL mode for better concurrency
export const sqlite = new Database(dbFile);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Initialize Drizzle ORM with full schema for type-safe queries
export const db = drizzle(sqlite, { schema });
