/**
 * Database Seed Entry Point (Legacy - Deprecated)
 *
 * This file now delegates to the new modular seed system in src/db/seeds/.
 * It is maintained for backward compatibility with existing scripts and deployment pipelines.
 *
 * For new development, use the modular seed files directly:
 * - src/db/seeds/01-essential.ts (RBAC + admin user)
 * - src/db/seeds/02-system-defaults.ts (settings + alert rules + network)
 * - src/db/seeds/03-demo-fixtures.ts (Pirate game - dev only)
 * - src/db/seeds/index.ts (orchestrator)
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDatabase, clearAll } from './seeds/index.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(`${rootDir}/../../data`, { recursive: true });

/**
 * Idempotent seed function - safe to run multiple times.
 * Only creates data that doesn't already exist.
 *
 * @deprecated Use seedDatabase from ./seeds/index.ts instead
 */
export async function seedIdempotent(): Promise<void> {
  await seedDatabase();
}

/**
 * Export clearAll for backward compatibility
 */
export { clearAll };

/**
 * CLI entry point
 *
 * Supports the following command-line arguments:
 * - --clear: Clear all database tables before seeding
 * - --force: Force re-execution of seeds even if not first run
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  (async () => {
    try {
      if (args.includes('--clear')) {
        console.log('⚠️  WARNING: Clearing all database tables...');
        clearAll();
        console.log('✅ Database cleared.\n');
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
