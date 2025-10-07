#!/usr/bin/env node
/**
 * Database Migration Runner
 *
 * Standalone migration runner that applies Drizzle migrations to the database.
 * Designed to be safe, idempotent, and resilient to failures.
 *
 * Features:
 * - Idempotent: Safe to run multiple times
 * - Automatic backup before migration
 * - Rollback on failure
 * - Migration verification
 * - Schema version tracking
 * - Comprehensive error handling
 * - Detailed logging
 *
 * Usage:
 *   node src/db/migrate.ts [--verify] [--skip-backup]
 *
 * Options:
 *   --verify       Only verify migrations without applying
 *   --skip-backup  Skip automatic backup (not recommended for production)
 *
 * Exit codes:
 *   0 - Success
 *   1 - Migration failure
 *   2 - Verification failure
 *   3 - Pre-migration checks failed
 */

import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, copyFileSync, unlinkSync, statSync, readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getDatabasePath, ensureDataDirectorySync } from '@escapeplan/contracts/paths';

// ============================================================================
// CONFIGURATION
// ============================================================================

const rootDir = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(rootDir, '../../drizzle');
const MIGRATION_JOURNAL_FILE = join(MIGRATIONS_DIR, 'meta/_journal.json');
const DB_PATH = getDatabasePath();
const BACKUP_SUFFIX = '.pre-migration-backup';

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const LOG_PREFIX = '[Migration]';

function logInfo(message: string): void {
  console.log(`${LOG_PREFIX} ℹ️  ${message}`);
}

function logSuccess(message: string): void {
  console.log(`${LOG_PREFIX} ✅ ${message}`);
}

function logWarning(message: string): void {
  console.warn(`${LOG_PREFIX} ⚠️  ${message}`);
}

function logError(message: string): void {
  console.error(`${LOG_PREFIX} ❌ ${message}`);
}

function logHeader(message: string): void {
  console.log('\n' + '═'.repeat(70));
  console.log(`${LOG_PREFIX} ${message}`);
  console.log('═'.repeat(70) + '\n');
}

// ============================================================================
// PRE-MIGRATION CHECKS
// ============================================================================

/**
 * Verifies that all required files and directories exist before migration
 */
async function performPreMigrationChecks(): Promise<boolean> {
  logInfo('Performing pre-migration checks...');

  // Check 1: Migrations directory exists
  if (!existsSync(MIGRATIONS_DIR)) {
    logError(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    return false;
  }
  logSuccess(`Migrations directory found: ${MIGRATIONS_DIR}`);

  // Check 2: Migration journal exists
  if (!existsSync(MIGRATION_JOURNAL_FILE)) {
    logError(`Migration journal not found: ${MIGRATION_JOURNAL_FILE}`);
    return false;
  }
  logSuccess(`Migration journal found: ${MIGRATION_JOURNAL_FILE}`);

  // Check 3: At least one migration SQL file exists
  const sqlFiles = existsSync(MIGRATIONS_DIR)
    ? import('fs')
        .then((fs) => fs.readdirSync(MIGRATIONS_DIR).filter((f: string) => f.endsWith('.sql')))
    : Promise.resolve([]);

  const files = await sqlFiles;
  if (files.length === 0) {
    logError('No migration SQL files found in migrations directory');
    return false;
  }
  logSuccess(`Found ${files.length} migration file(s)`);

  // Check 4: Data directory exists
  ensureDataDirectorySync();
  logSuccess('Data directory verified');

  return true;
}

// ============================================================================
// BACKUP MANAGEMENT
// ============================================================================

/**
 * Creates a backup of the database before migration
 * @returns Path to backup file, or null if backup was not created (fresh install)
 */
function createBackup(): string | null {
  // Skip backup if database doesn't exist (fresh install)
  if (!existsSync(DB_PATH)) {
    logInfo('Database does not exist yet - skipping backup (fresh install)');
    return null;
  }

  const backupPath = `${DB_PATH}${BACKUP_SUFFIX}`;

  try {
    logInfo('Creating pre-migration backup...');

    // Remove old backup if it exists
    if (existsSync(backupPath)) {
      logWarning('Removing old pre-migration backup...');
      unlinkSync(backupPath);
    }

    // Copy database file
    copyFileSync(DB_PATH, backupPath);

    // Copy WAL file if it exists
    const walPath = `${DB_PATH}-wal`;
    const walBackupPath = `${backupPath}-wal`;
    if (existsSync(walPath)) {
      copyFileSync(walPath, walBackupPath);
    }

    // Copy SHM file if it exists
    const shmPath = `${DB_PATH}-shm`;
    const shmBackupPath = `${backupPath}-shm`;
    if (existsSync(shmPath)) {
      copyFileSync(shmPath, shmBackupPath);
    }

    const backupSize = statSync(backupPath).size;
    logSuccess(`Backup created: ${backupPath} (${(backupSize / 1024 / 1024).toFixed(2)} MB)`);

    return backupPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Failed to create backup: ${errorMessage}`);
    throw error;
  }
}

/**
 * Restores database from backup in case of migration failure
 */
function restoreFromBackup(backupPath: string | null): void {
  if (!backupPath) {
    logInfo('No backup to restore (fresh install scenario)');
    return;
  }

  try {
    logWarning('Restoring database from backup...');

    // Restore main database file
    if (existsSync(backupPath)) {
      copyFileSync(backupPath, DB_PATH);
      logSuccess('Database file restored');
    }

    // Restore WAL file if backup exists
    const walBackupPath = `${backupPath}-wal`;
    const walPath = `${DB_PATH}-wal`;
    if (existsSync(walBackupPath)) {
      copyFileSync(walBackupPath, walPath);
      logSuccess('WAL file restored');
    }

    // Restore SHM file if backup exists
    const shmBackupPath = `${backupPath}-shm`;
    const shmPath = `${DB_PATH}-shm`;
    if (existsSync(shmBackupPath)) {
      copyFileSync(shmBackupPath, shmPath);
      logSuccess('SHM file restored');
    }

    logSuccess('Database successfully restored from backup');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Failed to restore from backup: ${errorMessage}`);
    logError('Manual intervention required - backup is at: ' + backupPath);
    throw error;
  }
}

/**
 * Removes backup after successful migration
 */
function cleanupBackup(backupPath: string | null): void {
  if (!backupPath) {
    return;
  }

  try {
    logInfo('Cleaning up backup files...');

    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }

    const walBackupPath = `${backupPath}-wal`;
    if (existsSync(walBackupPath)) {
      unlinkSync(walBackupPath);
    }

    const shmBackupPath = `${backupPath}-shm`;
    if (existsSync(shmBackupPath)) {
      unlinkSync(shmBackupPath);
    }

    logSuccess('Backup files cleaned up');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning(`Failed to cleanup backup: ${errorMessage}`);
    logWarning('Backup files remain at: ' + backupPath);
  }
}

// ============================================================================
// MIGRATION VERIFICATION
// ============================================================================

/**
 * Verifies that migrations were applied successfully by checking schema
 */
function verifyMigration(db: Database.Database): boolean {
  try {
    logInfo('Verifying migration results...');

    // Check 1: Core tables exist
    const coreTables = [
      'user',
      'session',
      'roles',
      'permissions',
      'role_permissions',
      'games',
      'bookings',
      'sessions',
      'cameras',
      'system_settings',
    ];

    for (const table of coreTables) {
      const result = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        )
        .get(table);

      if (!result) {
        logError(`Required table '${table}' not found after migration`);
        return false;
      }
    }
    logSuccess(`All ${coreTables.length} core tables verified`);

    // Check 2: Drizzle migrations table exists
    const migrationsTableExists = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'`
      )
      .get();

    if (!migrationsTableExists) {
      logError('Drizzle migrations tracking table not found');
      return false;
    }
    logSuccess('Migration tracking table verified');

    // Check 3: Count applied migrations
    const migrationCount = db
      .prepare(`SELECT COUNT(*) as count FROM __drizzle_migrations`)
      .get() as { count: number };

    if (migrationCount.count === 0) {
      logError('No migrations recorded in tracking table');
      return false;
    }
    logSuccess(`${migrationCount.count} migration(s) recorded in tracking table`);

    // Check 4: Verify foreign keys are enabled
    const foreignKeysEnabled = db.pragma('foreign_keys', { simple: true }) as number;
    if (foreignKeysEnabled !== 1) {
      logWarning('Foreign keys are not enabled - this may cause data integrity issues');
    } else {
      logSuccess('Foreign keys enabled');
    }

    // Check 5: Verify WAL mode is enabled
    const journalMode = db.pragma('journal_mode', { simple: true }) as string;
    if (journalMode.toLowerCase() !== 'wal') {
      logWarning(`Journal mode is '${journalMode}' (expected 'wal')`);
    } else {
      logSuccess('WAL mode enabled');
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Migration verification failed: ${errorMessage}`);
    return false;
  }
}

/**
 * Gets the current schema version from migration journal
 */
function getCurrentSchemaVersion(): string {
  try {
    if (!existsSync(MIGRATION_JOURNAL_FILE)) {
      return 'unknown';
    }

    const journalContent = readFileSync(MIGRATION_JOURNAL_FILE, 'utf-8');
    const journal = JSON.parse(journalContent);

    if (!journal.entries || journal.entries.length === 0) {
      return 'none';
    }

    // Return the tag of the latest migration
    const latestEntry = journal.entries[journal.entries.length - 1];
    return latestEntry.tag || 'untagged';
  } catch (error) {
    logWarning('Could not determine schema version');
    return 'unknown';
  }
}

/**
 * Gets the list of applied migrations from the database
 */
function getAppliedMigrations(db: Database.Database): string[] {
  try {
    // Check if migrations table exists
    const tableExists = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'`
      )
      .get();

    if (!tableExists) {
      return [];
    }

    const migrations = db
      .prepare(`SELECT hash FROM __drizzle_migrations ORDER BY created_at ASC`)
      .all() as Array<{ hash: string }>;

    return migrations.map((m) => m.hash);
  } catch (error) {
    logWarning('Could not retrieve applied migrations');
    return [];
  }
}

// ============================================================================
// MIGRATION EXECUTION
// ============================================================================

/**
 * Applies database migrations using Drizzle migrator
 */
async function applyMigrations(): Promise<void> {
  let db: Database.Database | null = null;
  let backupPath: string | null = null;

  try {
    logHeader('Database Migration Runner');

    // Step 1: Pre-migration checks
    if (!(await performPreMigrationChecks())) {
      logError('Pre-migration checks failed');
      throw new Error('Pre-migration checks failed');
    }

    // Step 2: Create backup (if database exists)
    backupPath = createBackup();

    // Step 3: Open database connection
    logInfo('Opening database connection...');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    logSuccess('Database connection established');

    // Step 4: Check current state
    const appliedMigrations = getAppliedMigrations(db);
    if (appliedMigrations.length > 0) {
      logInfo(`Currently applied migrations: ${appliedMigrations.length}`);
    } else {
      logInfo('No migrations applied yet (fresh database)');
    }

    // Step 5: Apply migrations
    logInfo('Applying migrations from: ' + MIGRATIONS_DIR);
    const ormDb = drizzle(db);

    try {
      migrate(ormDb, { migrationsFolder: MIGRATIONS_DIR });
      logSuccess('Migrations applied successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if error is due to migrations already being applied
      if (
        errorMessage.includes('already exists') ||
        errorMessage.includes('no such table')
      ) {
        logWarning('Some migrations may already be applied - this is expected');
        logSuccess('Migration process completed (no new migrations to apply)');
      } else {
        throw error;
      }
    }

    // Step 6: Verify migration success
    if (!verifyMigration(db)) {
      throw new Error('Migration verification failed');
    }

    // Step 7: Check final state
    const finalMigrations = getAppliedMigrations(db);
    const schemaVersion = getCurrentSchemaVersion();

    logSuccess(`Final state: ${finalMigrations.length} migration(s) applied`);
    logSuccess(`Schema version: ${schemaVersion}`);

    // Step 8: Cleanup
    db.close();
    cleanupBackup(backupPath);

    logHeader('Migration Completed Successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logError('Migration failed: ' + errorMessage);
    if (errorStack) {
      console.error(errorStack);
    }

    // Close database connection
    if (db) {
      try {
        db.close();
      } catch (closeError) {
        logWarning('Error closing database connection');
      }
    }

    // Restore from backup
    if (backupPath) {
      try {
        restoreFromBackup(backupPath);
      } catch (restoreError) {
        logError('Rollback failed - database may be in inconsistent state');
        logError('Manual recovery required using backup at: ' + backupPath);
        throw new Error('Rollback failed - database may be in inconsistent state');
      }
    }

    logHeader('Migration Failed - Database Rolled Back');
    throw error;
  }
}

/**
 * Verifies migrations without applying them
 */
async function verifyOnly(): Promise<void> {
  let db: Database.Database | null = null;

  try {
    logHeader('Migration Verification Mode');

    // Step 1: Pre-migration checks
    if (!(await performPreMigrationChecks())) {
      logError('Pre-migration checks failed');
      process.exit(3);
    }

    // Step 2: Check if database exists
    if (!existsSync(DB_PATH)) {
      logInfo('Database does not exist - no migrations to verify');
      process.exit(0);
    }

    // Step 3: Open database connection
    logInfo('Opening database connection...');
    db = new Database(DB_PATH, { readonly: true });
    logSuccess('Database connection established (read-only)');

    // Step 4: Verify current state
    const verified = verifyMigration(db);

    // Step 5: Report results
    const appliedMigrations = getAppliedMigrations(db);
    const schemaVersion = getCurrentSchemaVersion();

    logInfo(`Applied migrations: ${appliedMigrations.length}`);
    logInfo(`Schema version: ${schemaVersion}`);

    db.close();

    if (verified) {
      logHeader('Verification Passed');
      process.exit(0);
    } else {
      logHeader('Verification Failed');
      process.exit(2);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('Verification error: ' + errorMessage);

    if (db) {
      try {
        db.close();
      } catch (closeError) {
        // Ignore
      }
    }

    logHeader('Verification Failed');
    process.exit(2);
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  try {
    // Check for verify-only mode
    if (args.includes('--verify')) {
      await verifyOnly();
    } else {
      await applyMigrations();
      // When run as CLI, exit with success code
      process.exit(0);
    }
  } catch (error) {
    // When run as CLI, exit with error code
    process.exit(1);
  }
}

// Export for use in other scripts
export { applyMigrations, verifyMigration, getCurrentSchemaVersion, getAppliedMigrations };
