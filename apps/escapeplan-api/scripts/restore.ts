#!/usr/bin/env tsx
/**
 * restore.ts - Database restore CLI script for EscapePlan
 *
 * Restores a database backup with verification and safety checks.
 * Lists available backups and allows selection by ID or interactive mode.
 *
 * Usage:
 *   tsx restore.ts [backup-id] [options]
 *
 * Arguments:
 *   backup-id - Specific backup ULID to restore (optional, prompts if not provided)
 *
 * Options:
 *   --list              List all available backups and exit
 *   --verify            Verify backup before restore (default)
 *   --no-verify         Skip verification (not recommended)
 *   --force             Skip confirmation prompt
 *
 * Exit codes:
 *   0 - Success
 *   1 - Failure
 *   2 - User cancelled
 *
 * Examples:
 *   tsx restore.ts --list
 *   tsx restore.ts 01JCWXYZ123456789ABCDEFGHI
 *   tsx restore.ts --verify
 *
 * WARNINGS:
 *   - This will OVERWRITE the current database
 *   - Ensure the API server is stopped before restoring
 *   - A pre-restore backup is automatically created
 *
 * @module restore-cli
 */

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, access, constants } from 'node:fs/promises';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { BackupManager } from '../src/db/backup/BackupManager.js';
import type { BackupMetadata } from '../src/db/backup/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CLI arguments
 */
interface CliArgs {
  backupId?: string;
  listOnly: boolean;
  verify: boolean;
  force: boolean;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format date to human-readable string
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Parse CLI arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const backupId = args.find(arg => !arg.startsWith('--'));
  const listOnly = args.includes('--list');
  const verify = !args.includes('--no-verify');
  const force = args.includes('--force');

  return {
    backupId,
    listOnly,
    verify,
    force,
  };
}

/**
 * Detect environment and get paths
 */
function getPaths(): { dbPath: string; backupDir: string } {
  // Check for production paths
  if (process.env.ESCAPEPLAN_DATA_DIR) {
    const dataDir = process.env.ESCAPEPLAN_DATA_DIR;
    return {
      dbPath: join(dataDir, 'escapeplan.db'),
      backupDir: join(dataDir, 'backups'),
    };
  }

  // Check common production paths
  const productionPaths = [
    '/var/lib/escapeplan',
    '/opt/escapeplan/data',
  ];

  for (const prodPath of productionPaths) {
    try {
      const dbPath = join(prodPath, 'escapeplan.db');
      const backupDir = join(prodPath, 'backups');
      return { dbPath, backupDir };
    } catch {
      continue;
    }
  }

  // Development environment
  const projectRoot = resolve(__dirname, '../..');
  const dbPath = join(projectRoot, 'data', 'escapeplan.db');
  const backupDir = join(projectRoot, 'data', 'backups');

  return { dbPath, backupDir };
}

/**
 * List all available backups
 */
function listBackups(backups: BackupMetadata[]): void {
  if (backups.length === 0) {
    console.log('No backups found.');
    return;
  }

  console.log('Available Backups');
  console.log('=================');
  console.log('');

  for (const backup of backups) {
    console.log(`ID: ${backup.id}`);
    console.log(`  Trigger: ${backup.trigger}`);
    console.log(`  Created: ${formatDate(backup.createdAt)}`);
    console.log(`  Size: ${formatBytes(backup.sizeBytes)}`);
    console.log(`  Verified: ${backup.verified ? 'yes' : 'no'}`);
    if (backup.tableCount !== undefined) {
      console.log(`  Tables: ${backup.tableCount}`);
    }
    if (backup.updateVersion) {
      console.log(`  Update Version: ${backup.updateVersion}`);
    }
    if (backup.notes) {
      console.log(`  Notes: ${backup.notes}`);
    }
    console.log('');
  }
}

/**
 * Prompt user for backup selection
 */
async function promptForBackup(backups: BackupMetadata[]): Promise<string | null> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('Select a backup to restore:');
    console.log('');

    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.id} (${backup.trigger}, ${formatDate(backup.createdAt)})`);
    });

    console.log('');
    const answer = await rl.question('Enter backup number or ID (or "cancel"): ');

    if (answer.toLowerCase() === 'cancel' || answer === '') {
      return null;
    }

    // Check if numeric selection
    const num = parseInt(answer, 10);
    if (!isNaN(num) && num >= 1 && num <= backups.length) {
      return backups[num - 1].id;
    }

    // Check if valid backup ID
    const backup = backups.find(b => b.id === answer);
    if (backup) {
      return backup.id;
    }

    console.log(`Invalid selection: ${answer}`);
    return null;

  } finally {
    rl.close();
  }
}

/**
 * Prompt for confirmation
 */
async function promptConfirmation(backup: BackupMetadata): Promise<boolean> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('');
    console.log('WARNING: This will OVERWRITE the current database!');
    console.log('');
    console.log('Backup to restore:');
    console.log(`  ID: ${backup.id}`);
    console.log(`  Trigger: ${backup.trigger}`);
    console.log(`  Created: ${formatDate(backup.createdAt)}`);
    console.log(`  Size: ${formatBytes(backup.sizeBytes)}`);
    console.log('');
    console.log('A pre-restore backup will be created automatically.');
    console.log('');

    const answer = await rl.question('Are you sure you want to continue? (yes/no): ');
    return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';

  } finally {
    rl.close();
  }
}

/**
 * Main restore execution
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs();
    const { dbPath, backupDir } = getPaths();

    console.log('Database Restore');
    console.log('================');
    console.log(`Database: ${dbPath}`);
    console.log(`Backup directory: ${backupDir}`);
    console.log('');

    // Create BackupManager instance
    const backupManager = new BackupManager(dbPath, backupDir);

    // List all backups
    const backups = await backupManager.listBackups();

    if (args.listOnly) {
      listBackups(backups);
      process.exit(0);
    }

    if (backups.length === 0) {
      console.error('ERROR: No backups available to restore.');
      process.exit(1);
    }

    // Get backup ID
    let backupId = args.backupId;

    if (!backupId) {
      listBackups(backups);
      backupId = await promptForBackup(backups);

      if (!backupId) {
        console.log('Restore cancelled.');
        process.exit(2);
      }
    }

    // Find backup metadata
    const backup = backups.find(b => b.id === backupId);
    if (!backup) {
      console.error(`ERROR: Backup not found: ${backupId}`);
      process.exit(1);
    }

    // Verify backup if requested
    if (args.verify) {
      console.log('Verifying backup...');
      const verification = await backupManager.verifyBackup(backup.databasePath);

      if (!verification.success) {
        console.error('');
        console.error('ERROR: Backup verification failed!');
        console.error(`Reason: ${verification.errorMessage}`);
        if (verification.details) {
          console.error(`Details: ${verification.details}`);
        }
        process.exit(1);
      }

      console.log('Backup verified successfully.');
      console.log('');
    }

    // Confirm restore
    if (!args.force) {
      const confirmed = await promptConfirmation(backup);
      if (!confirmed) {
        console.log('Restore cancelled.');
        process.exit(2);
      }
    }

    // Create pre-restore backup
    console.log('Creating pre-restore backup...');
    const preRestoreBackup = await backupManager.createFullBackup({
      trigger: 'manual',
      checkpointWal: true,
      verifyAfterCreate: false,
      notes: `Pre-restore backup before restoring ${backupId}`,
    });
    console.log(`Pre-restore backup created: ${preRestoreBackup.id}`);
    console.log('');

    // Check if database exists and is writable
    try {
      await access(dbPath, constants.W_OK);
    } catch (error) {
      console.error(`ERROR: Database file is not writable: ${dbPath}`);
      console.error('Ensure the API server is stopped and you have write permissions.');
      process.exit(1);
    }

    // Perform restore
    console.log('Restoring database...');
    await copyFile(backup.databasePath, dbPath);

    console.log('');
    console.log('Restore completed successfully!');
    console.log('==============================');
    console.log(`Restored backup: ${backup.id}`);
    console.log(`Created: ${formatDate(backup.createdAt)}`);
    console.log(`Pre-restore backup: ${preRestoreBackup.id}`);
    console.log('');
    console.log('IMPORTANT: Restart the API server to use the restored database.');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('Restore failed!');
    console.error('===============');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(`Error: ${String(error)}`);
    }
    process.exit(1);
  }
}

// Run main function
main();
