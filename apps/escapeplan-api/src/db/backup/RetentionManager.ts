/**
 * RetentionManager - Space-aware backup cleanup with GFS retention policies
 *
 * Provides intelligent backup cleanup functionality:
 * - Grandfather-Father-Son (GFS) retention policies
 * - Disk space monitoring and threshold-based cleanup
 * - Preservation of critical pre-update backups
 * - Cross-platform disk space checks
 *
 * @module RetentionManager
 */

import { readdir, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import type {
  BackupMetadata,
  BackupTrigger,
  DiskSpaceInfo,
  RETENTION_POLICIES,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Manages backup retention policies and space-aware cleanup
 *
 * @example
 * ```typescript
 * const retentionManager = new RetentionManager('/var/lib/escapeplan/backups');
 *
 * // Apply retention policies
 * const result = await retentionManager.applyRetentionPolicies();
 * console.log(`Deleted ${result.deleted} backups, freed ${result.freedSpace} bytes`);
 *
 * // Ensure sufficient space before backup
 * const hasSpace = await retentionManager.ensureSufficientSpace(
 *   100 * 1024 * 1024, // 100 MB required
 *   85 // Max 85% disk usage
 * );
 * ```
 */
export class RetentionManager {
  private readonly backupDir: string;

  /**
   * Create a new RetentionManager instance
   *
   * @param backupDir - Absolute path to backup directory
   * @throws {Error} If path is not absolute
   */
  constructor(backupDir: string) {
    if (!backupDir.startsWith('/')) {
      throw new Error('backupDir must be an absolute path');
    }

    this.backupDir = backupDir;
  }

  /**
   * Apply retention policies to all backups
   *
   * Implements Grandfather-Father-Son (GFS) retention:
   * - Daily backups: Keep last 7
   * - Pre-update backups: Keep last 10, max 180 days
   * - Manual backups: Keep last 5, max 14 days
   * - Pre-migration backups: Keep last 10, max 180 days
   * - On-demand backups: Keep last 5, max 14 days
   *
   * @returns Object with count of deleted backups and bytes freed
   * @throws {Error} If backup directory cannot be accessed
   *
   * @example
   * ```typescript
   * const result = await retentionManager.applyRetentionPolicies();
   * console.log(`Deleted ${result.deleted} backups`);
   * console.log(`Freed ${retentionManager.formatBytes(result.freedSpace)}`);
   * ```
   */
  async applyRetentionPolicies(): Promise<{ deleted: number; freedSpace: number }> {
    try {
      const backups = await this.getBackupsInDirectory(this.backupDir);

      // Import RETENTION_POLICIES at runtime
      const { RETENTION_POLICIES } = await import('./types.js');

      let deletedCount = 0;
      let freedSpace = 0;

      // Group backups by trigger type
      const backupsByTrigger = new Map<BackupTrigger, BackupMetadata[]>();
      for (const backup of backups) {
        const existing = backupsByTrigger.get(backup.trigger) || [];
        existing.push(backup);
        backupsByTrigger.set(backup.trigger, existing);
      }

      // Apply retention policy for each trigger type
      for (const [trigger, triggerBackups] of Array.from(backupsByTrigger.entries())) {
        // Get retention policy for this trigger type
        const policy = RETENTION_POLICIES[trigger];
        if (!policy) {
          console.warn(`No retention policy found for trigger: ${trigger}`);
          continue;
        }

        // Sort backups by creation date (newest first)
        const sortedBackups = [...triggerBackups].sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Apply count-based retention
        const backupsToDelete: BackupMetadata[] = [];

        if (policy.count !== undefined) {
          // Keep only the newest N backups
          const excess = sortedBackups.slice(policy.count);
          backupsToDelete.push(...excess);
        }

        // Apply age-based retention
        if (policy.ageInDays !== undefined) {
          const maxAgeMs = policy.ageInDays * 24 * 60 * 60 * 1000;
          const now = Date.now();

          for (const backup of sortedBackups) {
            const backupAge = now - new Date(backup.createdAt).getTime();
            if (backupAge > maxAgeMs && !backupsToDelete.includes(backup)) {
              backupsToDelete.push(backup);
            }
          }
        }

        // Delete backups
        for (const backup of backupsToDelete) {
          try {
            const sizeBefore = backup.totalSizeBytes;
            await rm(backup.backupPath, { recursive: true, force: true });
            deletedCount++;
            freedSpace += sizeBefore;
            console.log(`Deleted backup: ${backup.id} (${trigger}, ${this.formatBytes(sizeBefore)})`);
          } catch (error) {
            console.error(`Failed to delete backup ${backup.id}:`, error);
            // Continue with other deletions
          }
        }
      }

      return { deleted: deletedCount, freedSpace };

    } catch (error) {
      throw new Error(`Failed to apply retention policies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure sufficient disk space for a new backup
   *
   * Checks current disk usage and triggers cleanup if needed.
   * Deletes oldest backups first, but preserves pre-update backups
   * unless absolutely necessary.
   *
   * @param requiredBytes - Required space in bytes
   * @param maxUsagePercent - Maximum allowed disk usage percentage (0-100)
   * @returns True if sufficient space is available or was freed, false otherwise
   * @throws {Error} If disk space check fails
   *
   * @example
   * ```typescript
   * const hasSpace = await retentionManager.ensureSufficientSpace(
   *   100 * 1024 * 1024, // 100 MB
   *   85 // Max 85% usage
   * );
   *
   * if (!hasSpace) {
   *   throw new Error('Insufficient disk space');
   * }
   * ```
   */
  async ensureSufficientSpace(requiredBytes: number, maxUsagePercent: number): Promise<boolean> {
    try {
      // Check current disk space
      const diskSpace = await this.checkDiskSpace(this.backupDir);

      // Calculate if we have enough space
      const availableAfterBackup = diskSpace.available - requiredBytes;
      const usageAfterBackup = ((diskSpace.used + requiredBytes) / diskSpace.size) * 100;

      // Check if we already have sufficient space
      if (availableAfterBackup >= 0 && usageAfterBackup <= maxUsagePercent) {
        return true;
      }

      console.log(`Disk space check: ${this.formatBytes(diskSpace.available)} available, ${this.formatBytes(requiredBytes)} required`);
      console.log(`Current usage: ${diskSpace.usagePercent.toFixed(2)}%, max allowed: ${maxUsagePercent}%`);
      console.log(`Triggering cleanup to free space...`);

      // Calculate how much space we need to free
      const targetUsageBytes = (diskSpace.size * maxUsagePercent) / 100;
      const currentUsedAfterBackup = diskSpace.used + requiredBytes;
      const spaceToFree = Math.max(
        requiredBytes - diskSpace.available,
        currentUsedAfterBackup - targetUsageBytes
      );

      // Get all backups sorted by age (oldest first)
      const backups = await this.getBackupsInDirectory(this.backupDir);
      const sortedBackups = [...backups].sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // Separate pre-update backups from others
      const preUpdateBackups = sortedBackups.filter(b => b.trigger === 'pre-update' || b.trigger === 'pre-migration');
      const otherBackups = sortedBackups.filter(b => b.trigger !== 'pre-update' && b.trigger !== 'pre-migration');

      let freedSpace = 0;
      let deletedCount = 0;

      // First, try to free space by deleting non-pre-update backups
      for (const backup of otherBackups) {
        if (freedSpace >= spaceToFree) {
          break;
        }

        try {
          const sizeBefore = backup.totalSizeBytes;
          await rm(backup.backupPath, { recursive: true, force: true });
          freedSpace += sizeBefore;
          deletedCount++;
          console.log(`Deleted backup: ${backup.id} (${backup.trigger}, ${this.formatBytes(sizeBefore)})`);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.id}:`, error);
          // Continue with other deletions
        }
      }

      // If still not enough space, delete pre-update backups (oldest first)
      if (freedSpace < spaceToFree) {
        console.warn('Deleting pre-update backups to free space (last resort)');

        for (const backup of preUpdateBackups) {
          if (freedSpace >= spaceToFree) {
            break;
          }

          try {
            const sizeBefore = backup.totalSizeBytes;
            await rm(backup.backupPath, { recursive: true, force: true });
            freedSpace += sizeBefore;
            deletedCount++;
            console.log(`Deleted pre-update backup: ${backup.id} (${this.formatBytes(sizeBefore)})`);
          } catch (error) {
            console.error(`Failed to delete backup ${backup.id}:`, error);
            // Continue with other deletions
          }
        }
      }

      console.log(`Cleanup complete: deleted ${deletedCount} backups, freed ${this.formatBytes(freedSpace)}`);

      // Check if we freed enough space
      const diskSpaceAfter = await this.checkDiskSpace(this.backupDir);
      const availableAfterCleanup = diskSpaceAfter.available - requiredBytes;
      const usageAfterCleanup = ((diskSpaceAfter.used + requiredBytes) / diskSpaceAfter.size) * 100;

      return availableAfterCleanup >= 0 && usageAfterCleanup <= maxUsagePercent;

    } catch (error) {
      throw new Error(`Failed to ensure sufficient space: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check disk space for a given path
   *
   * Uses platform-specific commands:
   * - Linux/macOS: `df` command
   * - Windows: `wmic` command (fallback)
   *
   * @param path - Path to check disk space for
   * @returns Disk space information
   * @throws {Error} If disk space check fails
   *
   * @example
   * ```typescript
   * const diskSpace = await retentionManager.checkDiskSpace('/var/lib/escapeplan/backups');
   * console.log(`Total: ${diskSpace.size} bytes`);
   * console.log(`Used: ${diskSpace.used} bytes`);
   * console.log(`Available: ${diskSpace.available} bytes`);
   * console.log(`Usage: ${diskSpace.usagePercent}%`);
   * ```
   */
  async checkDiskSpace(path: string): Promise<DiskSpaceInfo> {
    try {
      if (process.platform === 'win32') {
        // Windows: use wmic
        const driveLetter = path.substring(0, 2); // e.g., "C:"
        const { stdout } = await execAsync(`wmic logicaldisk where "DeviceID='${driveLetter}'" get Size,FreeSpace /format:csv`);

        const lines = stdout.trim().split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('Failed to parse wmic output');
        }

        const dataLine = lines[lines.length - 1];
        const parts = dataLine.split(',');

        if (parts.length < 3) {
          throw new Error('Failed to parse wmic output');
        }

        const available = parseInt(parts[1], 10);
        const size = parseInt(parts[2], 10);
        const used = size - available;
        const usagePercent = (used / size) * 100;

        return {
          size,
          used,
          available,
          usagePercent,
        };

      } else {
        // Linux/macOS: use df
        const { stdout } = await execAsync(`df -k "${path}"`);

        const lines = stdout.trim().split('\n');
        if (lines.length < 2) {
          throw new Error('Failed to parse df output');
        }

        const dataLine = lines[1];
        const parts = dataLine.split(/\s+/);

        if (parts.length < 6) {
          throw new Error('Failed to parse df output');
        }

        // df output format: Filesystem 1K-blocks Used Available Use% Mounted
        const size = parseInt(parts[1], 10) * 1024; // Convert KB to bytes
        const used = parseInt(parts[2], 10) * 1024;
        const available = parseInt(parts[3], 10) * 1024;
        const usagePercentStr = parts[4];
        const usagePercent = parseFloat(usagePercentStr.replace('%', ''));

        return {
          size,
          used,
          available,
          usagePercent,
        };
      }

    } catch (error) {
      throw new Error(`Failed to check disk space: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all backups in a directory
   *
   * Reads all backup directories and parses their manifest.json files.
   *
   * @param dir - Directory to scan for backups
   * @returns Array of backup metadata
   * @private
   */
  private async getBackupsInDirectory(dir: string): Promise<BackupMetadata[]> {
    const backups: BackupMetadata[] = [];

    try {
      // Ensure directory exists
      try {
        await stat(dir);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return []; // Directory doesn't exist yet
        }
        throw error;
      }

      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('backup-')) {
          const manifestPath = join(dir, entry.name, 'manifest.json');

          try {
            const manifestContent = await readFile(manifestPath, 'utf-8');
            const metadata = JSON.parse(manifestContent) as BackupMetadata;
            backups.push(metadata);
          } catch (error) {
            console.warn(`Failed to read manifest for ${entry.name}:`, error);
            // Continue with other backups
          }
        }
      }

      return backups;

    } catch (error) {
      throw new Error(`Failed to get backups: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Format bytes to human-readable string
   *
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB", "3.2 GB")
   * @private
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  }
}
