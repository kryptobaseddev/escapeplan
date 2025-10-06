/**
 * BackupManager - Database backup management using better-sqlite3
 *
 * Provides full backup/restore functionality for SQLite databases with:
 * - better-sqlite3 .backup() API for safe online backups
 * - SHA-256 checksum verification
 * - PRAGMA integrity_check validation
 * - Backup metadata tracking
 * - WAL checkpoint support
 *
 * @module BackupManager
 */

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, stat, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { ulid } from 'ulid';
import type {
  BackupMetadata,
  BackupOptions,
  BackupVerificationResult,
} from './types.js';

/**
 * Manages database backups using better-sqlite3 backup API
 *
 * @example
 * ```typescript
 * const backupManager = new BackupManager(
 *   '/var/lib/escapeplan/escapeplan.db',
 *   '/var/lib/escapeplan/backups'
 * );
 *
 * const metadata = await backupManager.createFullBackup({
 *   trigger: 'pre-update',
 *   updateVersion: '0.2.0',
 *   verifyAfterCreate: true
 * });
 *
 * console.log(`Backup created: ${metadata.id}`);
 * ```
 */
export class BackupManager {
  private readonly dbPath: string;
  private readonly backupDir: string;

  /**
   * Create a new BackupManager instance
   *
   * @param dbPath - Absolute path to source database file
   * @param backupDir - Absolute path to backup directory
   * @throws {Error} If paths are not absolute
   */
  constructor(dbPath: string, backupDir: string) {
    if (!dbPath.startsWith('/')) {
      throw new Error('dbPath must be an absolute path');
    }
    if (!backupDir.startsWith('/')) {
      throw new Error('backupDir must be an absolute path');
    }

    this.dbPath = dbPath;
    this.backupDir = backupDir;
  }

  /**
   * Create a full database backup using better-sqlite3 .backup() API
   *
   * Process:
   * 1. Create timestamped backup directory
   * 2. Checkpoint WAL if requested (recommended)
   * 3. Use better-sqlite3 .backup() to copy database
   * 4. Calculate SHA-256 checksum
   * 5. Create manifest.json with metadata
   * 6. Verify backup if requested
   *
   * @param options - Backup configuration options
   * @returns Backup metadata with paths and verification status
   * @throws {Error} If backup creation fails
   *
   * @example
   * ```typescript
   * const metadata = await backupManager.createFullBackup({
   *   trigger: 'pre-update',
   *   checkpointWal: true,
   *   verifyAfterCreate: true,
   *   updateVersion: '0.2.0'
   * });
   * ```
   */
  async createFullBackup(options: BackupOptions): Promise<BackupMetadata> {
    const backupId = ulid();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDirName = `backup-${timestamp}-${backupId}`;
    const backupPath = join(this.backupDir, backupDirName);

    let sourceDb: Database.Database | null = null;

    try {
      // Ensure backup directory exists
      await mkdir(backupPath, { recursive: true });

      const backupDbPath = join(backupPath, 'escapeplan.db');

      // Open source database in readonly mode
      try {
        sourceDb = new Database(this.dbPath, { readonly: true });
      } catch (error) {
        throw new Error(`Failed to open source database: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Checkpoint WAL before backup if requested
      if (options.checkpointWal !== false) {
        try {
          // Open in read-write mode for checkpoint
          const rwDb = new Database(this.dbPath);
          try {
            rwDb.pragma('wal_checkpoint(TRUNCATE)');
          } finally {
            rwDb.close();
          }
        } catch (error) {
          // Non-fatal: log but continue with backup
          console.warn('WAL checkpoint failed, continuing with backup:', error);
        }
      }

      // Reopen source database after checkpoint
      if (sourceDb) {
        sourceDb.close();
      }
      sourceDb = new Database(this.dbPath, { readonly: true });

      // Create backup using better-sqlite3 .backup() API
      try {
        // Use backup API to copy from source to destination
        // This will create the destination file
        await sourceDb.backup(backupDbPath);
      } catch (error) {
        throw new Error(`Backup operation failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Calculate checksum of backed up database
      const checksum = await this.calculateChecksum(backupDbPath);

      // Get file sizes
      const dbStats = await stat(backupDbPath);
      const totalSize = await this.getDirectorySize(backupPath);

      // Get table count for metadata
      let tableCount: number | undefined;
      try {
        const tables = sourceDb.prepare(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).get() as { count: number };
        tableCount = tables.count;
      } catch (error) {
        // Non-fatal
        console.warn('Failed to get table count:', error);
      }

      // Check for WAL/SHM files
      const walPath = `${this.dbPath}-wal`;
      const shmPath = `${this.dbPath}-shm`;
      let includesWal = false;
      let includesShm = false;

      try {
        await stat(walPath);
        includesWal = true;
      } catch {
        // WAL file doesn't exist
      }

      try {
        await stat(shmPath);
        includesShm = true;
      } catch {
        // SHM file doesn't exist
      }

      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        trigger: options.trigger,
        createdAt: new Date().toISOString(),
        backupPath,
        databasePath: backupDbPath,
        checksumSha256: checksum,
        sizeBytes: dbStats.size,
        totalSizeBytes: totalSize,
        sourceDatabasePath: this.dbPath,
        appVersion: options.appVersion,
        updateVersion: options.updateVersion,
        installId: options.installId,
        verified: false,
        includesWal,
        includesShm,
        tableCount,
        notes: options.notes,
      };

      // Write manifest.json
      const manifestPath = join(backupPath, 'manifest.json');
      await writeFile(manifestPath, JSON.stringify(metadata, null, 2), 'utf-8');

      // Verify backup if requested
      if (options.verifyAfterCreate) {
        const verificationResult = await this.verifyBackup(backupDbPath);
        metadata.verified = verificationResult.success;

        if (!verificationResult.success) {
          throw new Error(`Backup verification failed: ${verificationResult.errorMessage}`);
        }
      }

      return metadata;

    } catch (error) {
      // Cleanup failed backup directory
      try {
        await rm(backupPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup backup directory:', cleanupError);
      }

      throw error;

    } finally {
      // Close source database
      if (sourceDb) {
        try {
          sourceDb.close();
        } catch (error) {
          console.error('Error closing source database:', error);
        }
      }
    }
  }

  /**
   * Verify backup integrity
   *
   * Checks:
   * 1. Can open database in readonly mode
   * 2. PRAGMA integrity_check passes
   * 3. Checksum matches manifest (if manifest exists)
   * 4. Manifest.json is valid JSON
   *
   * @param backupPath - Path to backup database file or backup directory
   * @returns Verification result with detailed checks
   *
   * @example
   * ```typescript
   * const result = await backupManager.verifyBackup('/var/lib/escapeplan/backups/backup-xyz/escapeplan.db');
   * if (result.success) {
   *   console.log('Backup is valid');
   * } else {
   *   console.error('Backup verification failed:', result.errorMessage);
   * }
   * ```
   */
  async verifyBackup(backupPath: string): Promise<BackupVerificationResult> {
    let db: Database.Database | null = null;
    const result: BackupVerificationResult = {
      success: false,
      checksumValid: false,
      integrityCheckPassed: false,
      canOpenDatabase: false,
      manifestValid: false,
    };

    try {
      // Determine if path is directory or file
      let dbPath: string;
      let manifestPath: string | null = null;

      try {
        const stats = await stat(backupPath);
        if (stats.isDirectory()) {
          dbPath = join(backupPath, 'escapeplan.db');
          manifestPath = join(backupPath, 'manifest.json');
        } else {
          dbPath = backupPath;
          // Try to find manifest in parent directory
          const parentDir = dirname(backupPath);
          const potentialManifest = join(parentDir, 'manifest.json');
          try {
            await stat(potentialManifest);
            manifestPath = potentialManifest;
          } catch {
            // No manifest found
          }
        }
      } catch (error) {
        result.errorMessage = `Backup path not found: ${error instanceof Error ? error.message : String(error)}`;
        return result;
      }

      // Check if database file exists
      try {
        await stat(dbPath);
      } catch (error) {
        result.errorMessage = `Database file not found: ${dbPath}`;
        return result;
      }

      // Try to open database in readonly mode
      try {
        db = new Database(dbPath, { readonly: true });
        result.canOpenDatabase = true;
      } catch (error) {
        result.errorMessage = `Failed to open database: ${error instanceof Error ? error.message : String(error)}`;
        result.canOpenDatabase = false;
        return result;
      }

      // Run PRAGMA integrity_check
      try {
        const integrityCheck = db.pragma('integrity_check') as Array<{ integrity_check: string }>;

        if (integrityCheck.length === 1 && integrityCheck[0].integrity_check === 'ok') {
          result.integrityCheckPassed = true;
          result.integrityErrors = 0;
        } else {
          result.integrityCheckPassed = false;
          result.integrityErrors = integrityCheck.length;
          result.details = integrityCheck.map(r => r.integrity_check).join('; ');
        }
      } catch (error) {
        result.errorMessage = `Integrity check failed: ${error instanceof Error ? error.message : String(error)}`;
        result.integrityCheckPassed = false;
        return result;
      }

      // Verify checksum if manifest exists
      if (manifestPath) {
        try {
          const manifestContent = await readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent) as BackupMetadata;
          result.manifestValid = true;

          // Calculate current checksum
          const actualChecksum = await this.calculateChecksum(dbPath);
          result.checksumValid = actualChecksum === manifest.checksumSha256;

          if (!result.checksumValid) {
            result.errorMessage = 'Checksum mismatch - backup may be corrupted';
            result.details = `Expected: ${manifest.checksumSha256}, Got: ${actualChecksum}`;
          }
        } catch (error) {
          result.manifestValid = false;
          result.errorMessage = `Manifest validation failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        // No manifest - just verify database can be opened and integrity check passes
        result.checksumValid = true; // Skip checksum if no manifest
        result.manifestValid = true; // Skip manifest if doesn't exist
      }

      // Overall success
      result.success = result.canOpenDatabase && result.integrityCheckPassed && result.checksumValid && result.manifestValid;

      if (!result.success && !result.errorMessage) {
        const failures: string[] = [];
        if (!result.canOpenDatabase) failures.push('cannot open database');
        if (!result.integrityCheckPassed) failures.push('integrity check failed');
        if (!result.checksumValid) failures.push('checksum mismatch');
        if (!result.manifestValid) failures.push('invalid manifest');
        result.errorMessage = `Verification failed: ${failures.join(', ')}`;
      }

      return result;

    } catch (error) {
      result.errorMessage = `Verification error: ${error instanceof Error ? error.message : String(error)}`;
      return result;

    } finally {
      if (db) {
        try {
          db.close();
        } catch (error) {
          console.error('Error closing database during verification:', error);
        }
      }
    }
  }

  /**
   * List all backups in backup directory
   *
   * @returns Array of backup metadata, sorted by creation date (newest first)
   * @throws {Error} If backup directory cannot be read
   *
   * @example
   * ```typescript
   * const backups = await backupManager.listBackups();
   * console.log(`Found ${backups.length} backups`);
   * ```
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const backups: BackupMetadata[] = [];

    try {
      // Ensure backup directory exists
      try {
        await mkdir(this.backupDir, { recursive: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }
      }

      const entries = await readdir(this.backupDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('backup-')) {
          const manifestPath = join(this.backupDir, entry.name, 'manifest.json');

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

      // Sort by creation date, newest first
      backups.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return backups;

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // Backup directory doesn't exist yet
      }
      throw new Error(`Failed to list backups: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a backup by ID
   *
   * @param backupId - ULID of backup to delete
   * @throws {Error} If backup not found or deletion fails
   *
   * @example
   * ```typescript
   * await backupManager.deleteBackup('01JCWXYZ123456789ABCDEFGHI');
   * ```
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Delete backup directory
      await rm(backup.backupPath, { recursive: true, force: true });

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Backup not found: ${backupId}`);
      }
      throw new Error(`Failed to delete backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate SHA-256 checksum of a file
   *
   * @param filePath - Path to file
   * @returns Hex-encoded SHA-256 checksum
   * @private
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath);
      const hash = createHash('sha256');
      hash.update(content);
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate checksum: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get total size of a directory recursively
   *
   * @param dirPath - Path to directory
   * @returns Total size in bytes
   * @private
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else {
          const stats = await stat(fullPath);
          totalSize += stats.size;
        }
      }

      return totalSize;

    } catch (error) {
      throw new Error(`Failed to calculate directory size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
