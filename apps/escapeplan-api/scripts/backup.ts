#!/usr/bin/env tsx
/**
 * backup.ts - Database backup CLI script for EscapePlan
 *
 * Creates a full database backup using BackupManager and applies retention policies.
 * This script is called by backup.sh or can be run directly with tsx.
 *
 * Usage:
 *   tsx backup.ts [trigger] [options]
 *
 * Arguments:
 *   trigger - Backup trigger type (optional, defaults to 'manual')
 *             Valid: scheduled-daily, manual, pre-update, pre-migration, on-demand
 *
 * Options:
 *   --no-verify         Skip backup verification after creation
 *   --no-checkpoint     Skip WAL checkpoint before backup
 *   --no-retention      Skip retention policy application
 *   --update-version    Update version for pre-update backups
 *   --notes             Additional notes for backup metadata
 *
 * Exit codes:
 *   0 - Success
 *   1 - Failure
 *
 * Examples:
 *   tsx backup.ts
 *   tsx backup.ts scheduled-daily
 *   tsx backup.ts pre-update --update-version 0.2.0
 *   tsx backup.ts manual --notes "Before major config change"
 *
 * @module backup-cli
 */

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackupManager } from '../src/db/backup/BackupManager.js';
import { RetentionManager } from '../src/db/backup/RetentionManager.js';
import type { BackupTrigger } from '../src/db/backup/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command line arguments
 */
interface CliArgs {
  trigger: BackupTrigger;
  verify: boolean;
  checkpoint: boolean;
  applyRetention: boolean;
  updateVersion?: string;
  notes?: string;
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
 * Parse CLI arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const trigger: BackupTrigger = (args[0] && !args[0].startsWith('--'))
    ? args[0] as BackupTrigger
    : 'manual';

  const verify = !args.includes('--no-verify');
  const checkpoint = !args.includes('--no-checkpoint');
  const applyRetention = !args.includes('--no-retention');

  let updateVersion: string | undefined;
  const updateVersionIndex = args.indexOf('--update-version');
  if (updateVersionIndex !== -1 && args[updateVersionIndex + 1]) {
    updateVersion = args[updateVersionIndex + 1];
  }

  let notes: string | undefined;
  const notesIndex = args.indexOf('--notes');
  if (notesIndex !== -1 && args[notesIndex + 1]) {
    notes = args[notesIndex + 1];
  }

  // Validate trigger
  const validTriggers: BackupTrigger[] = [
    'scheduled-daily',
    'manual',
    'pre-update',
    'pre-migration',
    'on-demand'
  ];

  if (!validTriggers.includes(trigger)) {
    console.error(`ERROR: Invalid trigger type: ${trigger}`);
    console.error(`Valid triggers: ${validTriggers.join(', ')}`);
    process.exit(1);
  }

  return {
    trigger,
    verify,
    checkpoint,
    applyRetention,
    updateVersion,
    notes,
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
      // Just return the paths - BackupManager will validate they exist
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
 * Main backup execution
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs();
    const { dbPath, backupDir } = getPaths();

    console.log('Database Backup');
    console.log('===============');
    console.log(`Trigger: ${args.trigger}`);
    console.log(`Database: ${dbPath}`);
    console.log(`Backup directory: ${backupDir}`);
    console.log(`Verify after creation: ${args.verify ? 'yes' : 'no'}`);
    console.log(`Checkpoint WAL: ${args.checkpoint ? 'yes' : 'no'}`);
    console.log(`Apply retention: ${args.applyRetention ? 'yes' : 'no'}`);
    if (args.updateVersion) {
      console.log(`Update version: ${args.updateVersion}`);
    }
    if (args.notes) {
      console.log(`Notes: ${args.notes}`);
    }
    console.log('');

    // Create BackupManager instance
    const backupManager = new BackupManager(dbPath, backupDir);

    // Create backup
    console.log('Creating backup...');
    const metadata = await backupManager.createFullBackup({
      trigger: args.trigger,
      checkpointWal: args.checkpoint,
      verifyAfterCreate: args.verify,
      updateVersion: args.updateVersion,
      notes: args.notes,
    });

    console.log('');
    console.log('Backup created successfully!');
    console.log('============================');
    console.log(`Backup ID: ${metadata.id}`);
    console.log(`Created: ${metadata.createdAt}`);
    console.log(`Size: ${formatBytes(metadata.sizeBytes)}`);
    console.log(`Total size: ${formatBytes(metadata.totalSizeBytes)}`);
    console.log(`Checksum: ${metadata.checksumSha256.substring(0, 16)}...`);
    console.log(`Verified: ${metadata.verified ? 'yes' : 'no'}`);
    if (metadata.tableCount !== undefined) {
      console.log(`Tables: ${metadata.tableCount}`);
    }
    console.log(`Path: ${metadata.backupPath}`);
    console.log('');

    // Apply retention policies
    if (args.applyRetention) {
      console.log('Applying retention policies...');
      const retentionManager = new RetentionManager(backupDir);
      const result = await retentionManager.applyRetentionPolicies();

      if (result.deleted > 0) {
        console.log(`Deleted ${result.deleted} old backup(s)`);
        console.log(`Freed space: ${formatBytes(result.freedSpace)}`);
      } else {
        console.log('No old backups to delete.');
      }
      console.log('');

      // Show backup summary
      const allBackups = await backupManager.listBackups();
      const summary = {
        totalCount: allBackups.length,
        totalSize: 0,
        byTrigger: {} as Record<string, { count: number; size: number }>,
      };

      for (const backup of allBackups) {
        summary.totalSize += backup.totalSizeBytes;

        if (!summary.byTrigger[backup.trigger]) {
          summary.byTrigger[backup.trigger] = { count: 0, size: 0 };
        }

        summary.byTrigger[backup.trigger].count++;
        summary.byTrigger[backup.trigger].size += backup.totalSizeBytes;
      }

      console.log('Backup Summary');
      console.log('==============');
      console.log(`Total backups: ${summary.totalCount}`);
      console.log(`Total size: ${formatBytes(summary.totalSize)}`);
      console.log('');
      console.log('By trigger type:');
      for (const [trigger, stats] of Object.entries(summary.byTrigger)) {
        console.log(`  ${trigger}: ${stats.count} backup(s), ${formatBytes(stats.size)}`);
      }
      console.log('');

      // Check disk space
      const diskSpace = await retentionManager.checkDiskSpace(backupDir);
      console.log('Disk Space');
      console.log('==========');
      console.log(`Total: ${formatBytes(diskSpace.size)}`);
      console.log(`Used: ${formatBytes(diskSpace.used)}`);
      console.log(`Available: ${formatBytes(diskSpace.available)}`);
      console.log(`Usage: ${diskSpace.usagePercent.toFixed(2)}%`);

      if (diskSpace.usagePercent > 90) {
        console.log('');
        console.log('WARNING: Disk usage is above 90%!');
        console.log('Consider running emergency cleanup or freeing disk space.');
      }
    }

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('Backup failed!');
    console.error('==============');
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
