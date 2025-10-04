/**
 * Seed Orchestrator
 *
 * Coordinates execution of all seed files in dependency order.
 * This is the main entry point for database seeding operations.
 *
 * Execution flow:
 * 1. Apply database migrations (if not already applied)
 * 2. Check if this is first run
 * 3. Execute seed files in order:
 *    - 01-essential.ts (RBAC + admin user)
 *    - 02-system-defaults.ts (settings + alert rules + network)
 *    - 03-demo-fixtures.ts (Pirate game - dev only, auto-skipped in production)
 *
 * Safe to run in production - demo data is environment-aware.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db as ormDb, sqlite } from '../client.ts';
import { seedEssentialData } from './01-essential.ts';
import { seedSystemDefaults } from './02-system-defaults.ts';
import { seedDemoFixtures } from './03-demo-fixtures.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));
const migrationsPath = resolve(rootDir, '../../../drizzle');

const db = sqlite;

/**
 * Determines if this is the first run of the application by checking for
 * sentinel data that should exist after the first seed execution.
 *
 * Checks performed:
 * 1. Admin role exists
 * 2. Admin user exists
 * 3. At least one permission exists
 *
 * @returns true if first run (no sentinel data found), false otherwise
 */
export function isFirstRun(): boolean {
  try {
    // Check 1: Admin role exists
    const adminRole = db.prepare(`
      SELECT id FROM roles WHERE name = 'admin' LIMIT 1
    `).get();

    if (!adminRole) return true;

    // Check 2: Admin user exists
    const adminUser = db.prepare(`
      SELECT id FROM user WHERE email = 'admin@escapeplan.local' LIMIT 1
    `).get();

    if (!adminUser) return true;

    // Check 3: Any permissions exist
    const permCount = db.prepare(`
      SELECT COUNT(*) as count FROM permissions
    `).get() as { count: number };

    if (permCount.count === 0) return true;

    // All sentinel checks passed - not first run
    return false;
  } catch (error) {
    // Table doesn't exist or other error - assume first run
    console.warn('[Seed] First-run detection failed, assuming first run:', error);
    return true;
  }
}

/**
 * Clears all data from all tables in the database.
 *
 * WARNING: This is a destructive operation that deletes ALL data.
 * Only use this when you explicitly want to reset the database.
 *
 * @returns void
 */
export function clearAll(): void {
  try {
    console.log('[Seed] WARNING: Clearing all database tables...');

    const tables = [
      'session_hints',
      'session_milestones',
      'session_puzzles',
      'timer_slugs',
      'sessions',
      'bookings',
      'game_milestones',
      'game_puzzles',
      'asset_usage',
      'assets',
      'games',
      'session',
      'account',
      'verification',
      'user',
      'role_permissions',
      'roles',
      'permissions',
      'network_profiles',
      'network_health',
      'alerts',
      'alert_rules',
      'system_settings',
      'system_logs'
    ];

    db.exec('PRAGMA foreign_keys = OFF');

    const run = db.transaction(() => {
      for (const table of tables) {
        try {
          db.prepare(`DELETE FROM ${table}`).run();
        } catch (error) {
          if (error instanceof Error && error.message.includes('no such table')) {
            continue;
          }
          throw error;
        }
      }
    });

    run();
    db.exec('PRAGMA foreign_keys = ON');

    console.log('[Seed] ✅ All database tables cleared');
  } catch (error) {
    console.error('[Seed] ❌ Error clearing database tables:', error);
    throw error;
  }
}

/**
 * Main seed orchestration function.
 *
 * Applies migrations and executes seed files in dependency order.
 * Safe to run in production - demo data is automatically skipped.
 *
 * @param options - Seeding options
 * @param options.force - Force re-execution of seeds even if not first run
 * @returns Promise<void>
 * @throws Error if seeding operations fail
 */
export async function seedDatabase(options: { force?: boolean } = {}): Promise<void> {
  try {
    console.log('[Seed] ═══════════════════════════════════════════════════════');
    console.log('[Seed] Starting database seeding process...');
    console.log('[Seed] ═══════════════════════════════════════════════════════\n');

    // Step 1: Apply migrations
    console.log('[Seed] Step 1: Applying database migrations...');
    try {
      migrate(ormDb, { migrationsFolder: migrationsPath });
      console.log('[Seed] ✅ Migrations applied successfully\n');
    } catch (error) {
      console.error('[Seed] ❌ Error applying migrations:', error);
      throw error;
    }

    // Step 2: Check first-run status
    const isFirst = options.force || isFirstRun();

    if (!isFirst) {
      console.log('[Seed] Database already seeded, skipping seed execution');
      console.log('[Seed] (Use --force flag to re-run seeds)\n');
      console.log('[Seed] ═══════════════════════════════════════════════════════');
      return;
    }

    if (options.force) {
      console.log('[Seed] Force flag detected - re-running all seeds\n');
    } else {
      console.log('[Seed] First run detected - seeding essential data\n');
    }

    // Step 3: Execute seed files in dependency order
    try {
      // Seed 1: Essential data (RBAC + admin user)
      console.log('[Seed] Step 2: Seeding essential data (RBAC + admin user)...');
      await seedEssentialData();

      // Seed 2: System defaults (settings + alert rules + network)
      console.log('[Seed] Step 3: Seeding system defaults (settings + alert rules + network)...');
      await seedSystemDefaults();

      // Seed 3: Demo fixtures (Pirate game - auto-skipped in production)
      console.log('[Seed] Step 4: Seeding demo fixtures (development only)...');
      await seedDemoFixtures();

      console.log('[Seed] ═══════════════════════════════════════════════════════');
      console.log('[Seed] ✅ Database seeded successfully');
      console.log('[Seed] ═══════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('[Seed] ❌ Fatal error during seed execution:', error);
      console.log('[Seed] ═══════════════════════════════════════════════════════\n');
      throw error;
    }
  } catch (error) {
    console.error('[Seed] ❌ Database seeding failed:', error);
    throw error;
  }
}

/**
 * CLI entry point
 *
 * Supports the following command-line arguments:
 * - --clear: Clear all database tables before seeding
 * - --force: Force re-execution of seeds even if not first run
 *
 * Usage:
 *   pnpm seed              # Normal seeding (skip if already seeded)
 *   pnpm seed --force      # Force re-seeding
 *   pnpm seed --clear      # Clear all data, then seed
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  (async () => {
    try {
      if (args.includes('--clear')) {
        clearAll();
      }

      const force = args.includes('--force');
      await seedDatabase({ force });

      process.exit(0);
    } catch (error) {
      console.error('[Seed] Fatal error:', error);
      process.exit(1);
    }
  })();
}
