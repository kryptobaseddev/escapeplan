#!/usr/bin/env tsx
/**
 * ============================================================================
 * FIX NULL CONFIGS IN GAMES TABLE
 * ============================================================================
 * Task: Fix NULL pricing_config, media_config, booking_rules_config
 * Game: Pirate Mutiny
 * Production Server: 10.0.10.138 (escapeplan/escapeplan)
 * Created: 2025-10-06
 * ============================================================================
 *
 * This script uses Drizzle ORM to safely fix NULL config values in the games
 * table. It creates a backup, validates JSON, and provides rollback capability.
 *
 * Usage:
 *   Production: tsx scripts/fix-null-configs.ts --db=/var/lib/escapeplan/escapeplan.db
 *   Local Dev:  tsx scripts/fix-null-configs.ts --db=./apps/escapeplan-api/data/escapeplan.db
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, isNull, or, sql } from 'drizzle-orm';
import { games } from '../packages/contracts/src/schema.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_DB_PATH = '/var/lib/escapeplan/escapeplan.db';
const BACKUP_DIR = '/var/lib/escapeplan/backups';
const DEV_DB_PATH = './apps/escapeplan-api/data/escapeplan.db';

// Default JSON configurations
const DEFAULT_PRICING_CONFIG = {
  tiers: [
    {
      id: 'tier-1',
      label: 'Standard',
      model: 'per_person',
      priceCents: 2000,
      minPlayers: 1,
      maxPlayers: 5,
      displayOrder: 1,
      active: true
    }
  ],
  discounts: []
};

const DEFAULT_MEDIA_CONFIG = {
  galleryAssetIds: []
};

const DEFAULT_BOOKING_RULES_CONFIG = {
  isMobile: false,
  reservationStyle: 'public',
  customFields: []
};

// ============================================================================
// UTILITIES
// ============================================================================

function log(level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', message: string) {
  const colors = {
    INFO: '\x1b[34m',      // Blue
    SUCCESS: '\x1b[32m',   // Green
    WARNING: '\x1b[33m',   // Yellow
    ERROR: '\x1b[31m',     // Red
    RESET: '\x1b[0m'
  };
  console.log(`${colors[level]}[${level}]${colors.RESET} ${message}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dbArg = args.find(arg => arg.startsWith('--db='));

  let dbPath = DEFAULT_DB_PATH;

  if (dbArg) {
    dbPath = dbArg.split('=')[1];
  } else if (fs.existsSync(DEV_DB_PATH)) {
    log('INFO', 'Using development database path');
    dbPath = DEV_DB_PATH;
  }

  return { dbPath };
}

function createBackup(dbPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                    new Date().toTimeString().split(' ')[0].replace(/:/g, '');
  const backupDir = path.dirname(dbPath) === '/var/lib/escapeplan'
    ? BACKUP_DIR
    : path.join(path.dirname(dbPath), 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `escapeplan_backup_${timestamp}.db`);
  fs.copyFileSync(dbPath, backupFile);

  return backupFile;
}

function validateJSON(obj: any): boolean {
  try {
    JSON.stringify(obj);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// MAIN MIGRATION LOGIC
// ============================================================================

async function main() {
  const { dbPath } = parseArgs();

  // STEP 1: Verify database exists
  if (!fs.existsSync(dbPath)) {
    log('ERROR', `Database not found at: ${dbPath}`);
    log('INFO', 'Usage: tsx scripts/fix-null-configs.ts --db=/path/to/escapeplan.db');
    process.exit(1);
  }

  log('INFO', `Database found: ${dbPath}`);

  // STEP 2: Create backup
  log('INFO', 'Creating database backup...');
  let backupFile: string;
  try {
    backupFile = createBackup(dbPath);
    log('SUCCESS', `Backup created: ${backupFile}`);
  } catch (error) {
    log('ERROR', `Failed to create backup: ${error}`);
    process.exit(1);
  }

  // STEP 3: Connect to database with Drizzle
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  try {
    // STEP 4: Check for NULL values
    log('INFO', 'Checking for NULL values in games table...');

    const gamesWithNulls = await db
      .select({
        id: games.id,
        slug: games.slug,
        name: games.name,
        pricing_config: games.pricing_config,
        media_config: games.media_config,
        booking_rules_config: games.booking_rules_config
      })
      .from(games)
      .where(
        or(
          isNull(games.pricing_config),
          isNull(games.media_config),
          isNull(games.booking_rules_config)
        )
      );

    if (gamesWithNulls.length === 0) {
      log('WARNING', 'No games with NULL config values found. Nothing to fix.');
      sqlite.close();
      return;
    }

    log('INFO', `Found ${gamesWithNulls.length} game(s) with NULL config values:`);
    gamesWithNulls.forEach(game => {
      console.log(`  - ${game.name} (${game.slug})`);
      console.log(`    pricing_config: ${game.pricing_config === null ? 'NULL' : 'NOT NULL'}`);
      console.log(`    media_config: ${game.media_config === null ? 'NULL' : 'NOT NULL'}`);
      console.log(`    booking_rules_config: ${game.booking_rules_config === null ? 'NULL' : 'NOT NULL'}`);
    });

    // STEP 5: Prompt for confirmation
    console.log('');
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Do you want to proceed with fixing NULL values? (y/N): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      log('WARNING', 'Operation cancelled by user');
      sqlite.close();
      return;
    }

    // STEP 6: Validate default JSON configs
    log('INFO', 'Validating default JSON configurations...');
    if (!validateJSON(DEFAULT_PRICING_CONFIG) ||
        !validateJSON(DEFAULT_MEDIA_CONFIG) ||
        !validateJSON(DEFAULT_BOOKING_RULES_CONFIG)) {
      log('ERROR', 'Invalid JSON in default configurations');
      sqlite.close();
      process.exit(1);
    }
    log('SUCCESS', 'Default JSON configurations are valid');

    // STEP 7: Update games with NULL values
    log('INFO', 'Updating games with NULL config values...');

    let updateCount = 0;
    for (const game of gamesWithNulls) {
      const updates: any = {
        updated_at: sql`CURRENT_TIMESTAMP`
      };

      if (game.pricing_config === null) {
        updates.pricing_config = JSON.stringify(DEFAULT_PRICING_CONFIG);
      }
      if (game.media_config === null) {
        updates.media_config = JSON.stringify(DEFAULT_MEDIA_CONFIG);
      }
      if (game.booking_rules_config === null) {
        updates.booking_rules_config = JSON.stringify(DEFAULT_BOOKING_RULES_CONFIG);
      }

      await db
        .update(games)
        .set(updates)
        .where(eq(games.id, game.id));

      updateCount++;
      log('SUCCESS', `Updated ${game.name} (${game.slug})`);
    }

    log('SUCCESS', `Updated ${updateCount} game(s)`);

    // STEP 8: Verify updates
    log('INFO', 'Verifying updates...');

    const verifyGames = await db
      .select({
        id: games.id,
        slug: games.slug,
        name: games.name,
        pricing_config: games.pricing_config,
        media_config: games.media_config,
        booking_rules_config: games.booking_rules_config
      })
      .from(games)
      .where(
        or(
          eq(games.id, gamesWithNulls[0].id)
        )
      );

    verifyGames.forEach(game => {
      console.log(`\n  Game: ${game.name} (${game.slug})`);
      console.log(`    pricing_config: ${game.pricing_config ? 'NOT NULL' : 'NULL'} (${game.pricing_config ? JSON.parse(game.pricing_config as string).tiers.length + ' tier(s)' : ''})`);
      console.log(`    media_config: ${game.media_config ? 'NOT NULL' : 'NULL'}`);
      console.log(`    booking_rules_config: ${game.booking_rules_config ? 'NOT NULL' : 'NULL'}`);
    });

    // STEP 9: Validate JSON in database
    log('INFO', 'Validating JSON in database...');

    const allGames = await db
      .select({
        id: games.id,
        slug: games.slug,
        pricing_config: games.pricing_config,
        media_config: games.media_config,
        booking_rules_config: games.booking_rules_config
      })
      .from(games);

    let invalidJSON = false;
    for (const game of allGames) {
      try {
        if (game.pricing_config) JSON.parse(game.pricing_config as string);
        if (game.media_config) JSON.parse(game.media_config as string);
        if (game.booking_rules_config) JSON.parse(game.booking_rules_config as string);
      } catch (error) {
        log('ERROR', `Invalid JSON in game ${game.slug}: ${error}`);
        invalidJSON = true;
      }
    }

    if (invalidJSON) {
      log('ERROR', 'Found invalid JSON in database. Rolling back...');
      sqlite.close();
      fs.copyFileSync(backupFile, dbPath);
      log('WARNING', 'Database restored from backup');
      process.exit(1);
    }

    log('SUCCESS', 'All JSON is valid!');

    // STEP 10: Check for remaining NULLs
    const remainingNulls = await db
      .select({
        id: games.id
      })
      .from(games)
      .where(
        or(
          isNull(games.pricing_config),
          isNull(games.media_config),
          isNull(games.booking_rules_config)
        )
      );

    if (remainingNulls.length > 0) {
      log('WARNING', `Still found ${remainingNulls.length} game(s) with NULL values`);
    } else {
      log('SUCCESS', 'All NULL values have been fixed!');
    }

    // STEP 11: Display summary
    console.log('');
    log('SUCCESS', '==================================');
    log('SUCCESS', 'DATABASE MIGRATION COMPLETE');
    log('SUCCESS', '==================================');
    log('INFO', `Backup location: ${backupFile}`);
    log('INFO', `Database: ${dbPath}`);
    log('INFO', `NULL configs fixed: ${updateCount}`);
    log('INFO', 'JSON validation: PASSED');
    console.log('');
    log('WARNING', 'IMPORTANT: Test the application to ensure everything works correctly');
    log('WARNING', 'If issues occur, restore from backup:');
    log('WARNING', `  cp ${backupFile} ${dbPath}`);
    console.log('');

  } catch (error) {
    log('ERROR', `Migration failed: ${error}`);
    log('ERROR', 'Rolling back to backup...');
    sqlite.close();
    fs.copyFileSync(backupFile, dbPath);
    log('WARNING', 'Database restored from backup');
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch((error) => {
  log('ERROR', `Unhandled error: ${error}`);
  process.exit(1);
});
