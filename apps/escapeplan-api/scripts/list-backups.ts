#!/usr/bin/env tsx
/**
 * list-backups.ts - List database backups CLI script for EscapePlan
 *
 * Lists all available database backups with metadata and filtering options.
 * Provides human-readable output with size, date, and verification status.
 *
 * Usage:
 *   tsx list-backups.ts [options]
 *
 * Options:
 *   --trigger <type>    Filter by trigger type (scheduled-daily, manual, pre-update, etc.)
 *   --verified          Show only verified backups
 *   --unverified        Show only unverified backups
 *   --json              Output as JSON instead of human-readable format
 *   --summary           Show summary statistics only
 *
 * Exit codes:
 *   0 - Success
 *   1 - Failure
 *
 * Examples:
 *   tsx list-backups.ts
 *   tsx list-backups.ts --trigger pre-update
 *   tsx list-backups.ts --verified
 *   tsx list-backups.ts --json
 *   tsx list-backups.ts --summary
 *
 * @module list-backups-cli
 */

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackupManager } from '../src/db/backup/BackupManager.js';
import { RetentionManager } from '../src/db/backup/RetentionManager.js';
import type { BackupMetadata, BackupTrigger } from '../src/db/backup/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CLI arguments
 */
interface CliArgs {
  trigger?: BackupTrigger;
  verifiedOnly: boolean;
  unverifiedOnly: boolean;
  jsonOutput: boolean;
  summaryOnly: boolean;
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
 * Calculate relative time
 */
function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const date = new Date(isoDate);
  const diffMs = now - date.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Parse CLI arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  let trigger: BackupTrigger | undefined;
  const triggerIndex = args.indexOf('--trigger');
  if (triggerIndex !== -1 && args[triggerIndex + 1]) {
    trigger = args[triggerIndex + 1] as BackupTrigger;

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
  }

  const verifiedOnly = args.includes('--verified');
  const unverifiedOnly = args.includes('--unverified');
  const jsonOutput = args.includes('--json');
  const summaryOnly = args.includes('--summary');

  return {
    trigger,
    verifiedOnly,
    unverifiedOnly,
    jsonOutput,
    summaryOnly,
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
 * Display backups in human-readable format
 */
function displayBackups(backups: BackupMetadata[]): void {
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
    console.log(`  Created: ${formatDate(backup.createdAt)} (${getRelativeTime(backup.createdAt)})`);
    console.log(`  Size: ${formatBytes(backup.sizeBytes)}`);
    console.log(`  Total Size: ${formatBytes(backup.totalSizeBytes)}`);
    console.log(`  Verified: ${backup.verified ? 'yes' : 'no'}`);
    console.log(`  Checksum: ${backup.checksumSha256.substring(0, 16)}...`);

    if (backup.tableCount !== undefined) {
      console.log(`  Tables: ${backup.tableCount}`);
    }

    if (backup.includesWal || backup.includesShm) {
      const files = [];
      if (backup.includesWal) files.push('WAL');
      if (backup.includesShm) files.push('SHM');
      console.log(`  Includes: ${files.join(', ')}`);
    }

    if (backup.appVersion) {
      console.log(`  App Version: ${backup.appVersion}`);
    }

    if (backup.updateVersion) {
      console.log(`  Update Version: ${backup.updateVersion}`);
    }

    if (backup.notes) {
      console.log(`  Notes: ${backup.notes}`);
    }

    console.log('');
  }

  console.log(`Total: ${backups.length} backup${backups.length !== 1 ? 's' : ''}`);
}

/**
 * Display summary statistics
 */
async function displaySummary(backupManager: BackupManager, backupDir: string): Promise<void> {
  const retentionManager = new RetentionManager(backupDir);
  const allBackups = await backupManager.listBackups();
  const summary = await getBackupSummary(allBackups);
  const diskSpace = await retentionManager.checkDiskSpace(backupDir);

  console.log('Backup Summary');
  console.log('==============');
  console.log('');
  console.log(`Total Backups: ${summary.totalCount}`);
  console.log(`Total Size: ${formatBytes(summary.totalSize)}`);
  console.log('');
  console.log('By Trigger Type:');

  for (const [trigger, stats] of Object.entries(summary.byTrigger)) {
    console.log(`  ${trigger}:`);
    console.log(`    Count: ${stats.count}`);
    console.log(`    Size: ${formatBytes(stats.size)}`);
  }

  console.log('');
  console.log('Disk Space:');
  console.log(`  Total: ${formatBytes(diskSpace.size)}`);
  console.log(`  Used: ${formatBytes(diskSpace.used)}`);
  console.log(`  Available: ${formatBytes(diskSpace.available)}`);
  console.log(`  Usage: ${diskSpace.usagePercent.toFixed(2)}%`);

  if (diskSpace.usagePercent > 90) {
    console.log('');
    console.log('WARNING: Disk usage is above 90%!');
    console.log('Consider deleting old backups or freeing disk space.');
  } else if (diskSpace.usagePercent > 80) {
    console.log('');
    console.log('NOTICE: Disk usage is above 80%.');
    console.log('Monitor disk space and clean up old backups as needed.');
  }
}

/**
 * Get summary data for RetentionManager
 */
async function getBackupSummary(
  backups: BackupMetadata[]
): Promise<{
  totalCount: number;
  totalSize: number;
  byTrigger: Record<BackupTrigger, { count: number; size: number }>;
}> {
  const summary = {
    totalCount: backups.length,
    totalSize: 0,
    byTrigger: {} as Record<BackupTrigger, { count: number; size: number }>,
  };

  for (const backup of backups) {
    summary.totalSize += backup.totalSizeBytes;

    if (!summary.byTrigger[backup.trigger]) {
      summary.byTrigger[backup.trigger] = { count: 0, size: 0 };
    }

    summary.byTrigger[backup.trigger].count++;
    summary.byTrigger[backup.trigger].size += backup.totalSizeBytes;
  }

  return summary;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs();
    const { dbPath, backupDir } = getPaths();

    // Create BackupManager instance
    const backupManager = new BackupManager(dbPath, backupDir);

    // List all backups
    let backups = await backupManager.listBackups();

    // Apply filters
    if (args.trigger) {
      backups = backups.filter(b => b.trigger === args.trigger);
    }

    if (args.verifiedOnly) {
      backups = backups.filter(b => b.verified);
    }

    if (args.unverifiedOnly) {
      backups = backups.filter(b => !b.verified);
    }

    // Output based on format
    if (args.summaryOnly) {
      await displaySummary(backupManager, backupDir);
    } else if (args.jsonOutput) {
      console.log(JSON.stringify(backups, null, 2));
    } else {
      displayBackups(backups);
    }

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('Failed to list backups!');
    console.error('======================');
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
