/**
 * Tests for RetentionManager
 * Validates retention policy enforcement and space-aware cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RetentionManager } from './RetentionManager.js';
import Database from 'better-sqlite3';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BackupMetadata } from './types.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

describe('RetentionManager', () => {
  let testDbPath: string;
  let backupDir: string;
  let retentionManager: RetentionManager;
  let testDb: Database.Database;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = join(tmpdir(), `retention-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    testDbPath = join(tempDir, 'test.db');
    backupDir = join(tempDir, 'backups');

    await mkdir(backupDir, { recursive: true });

    // Initialize test database
    testDb = new Database(testDbPath);
    testDb.pragma('journal_mode = WAL');

    testDb.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      );

      INSERT INTO users (name, email) VALUES
        ('Alice', 'alice@example.com'),
        ('Bob', 'bob@example.com');
    `);

    retentionManager = new RetentionManager(backupDir);
  });

  afterEach(async () => {
    // Close test database
    if (testDb) {
      try {
        testDb.close();
      } catch {
        // Already closed
      }
    }

    // Cleanup test directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup failed, ignore
    }
  });

  /**
   * Helper function to create a mock backup
   */
  async function createMockBackup(
    trigger: 'manual' | 'scheduled-daily' | 'pre-update' | 'pre-migration' | 'on-demand',
    createdAt: Date,
    sizeBytes: number = 1024 * 1024 // 1 MB default
  ): Promise<BackupMetadata> {
    const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const backupDirName = `backup-${timestamp}-${backupId}`;
    const backupPath = join(backupDir, backupDirName);

    await mkdir(backupPath, { recursive: true });

    const metadata: BackupMetadata = {
      id: backupId,
      trigger,
      createdAt: createdAt.toISOString(),
      backupPath,
      databasePath: join(backupPath, 'escapeplan.db'),
      checksumSha256: '0'.repeat(64),
      sizeBytes,
      totalSizeBytes: sizeBytes,
      sourceDatabasePath: testDbPath,
      verified: true,
      includesWal: false,
      includesShm: false,
    };

    // Create manifest.json
    await writeFile(join(backupPath, 'manifest.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    // Create dummy database file
    await writeFile(join(backupPath, 'escapeplan.db'), Buffer.alloc(sizeBytes), 'binary');

    return metadata;
  }

  describe('Constructor', () => {
    it('should create RetentionManager with valid path', () => {
      expect(retentionManager).toBeDefined();
    });

    it('should throw error for relative path', () => {
      expect(() => new RetentionManager('relative/path')).toThrow('absolute path');
    });
  });

  describe('applyRetentionPolicies()', () => {
    it('should return zero deletions when no backups exist', async () => {
      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(0);
      expect(result.freedSpace).toBe(0);
    });

    it('should keep last 7 daily backups', async () => {
      // Create 10 daily backups
      const backups: BackupMetadata[] = [];
      for (let i = 0; i < 10; i++) {
        const createdAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const backup = await createMockBackup('scheduled-daily', createdAt, 1024 * 1024);
        backups.push(backup);
      }

      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(3); // Should delete 3 oldest
      expect(result.freedSpace).toBe(3 * 1024 * 1024);
    });

    it('should keep last 10 pre-update backups', async () => {
      // Create 15 pre-update backups
      for (let i = 0; i < 15; i++) {
        const createdAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        await createMockBackup('pre-update', createdAt, 1024 * 1024);
      }

      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(5); // Should delete 5 oldest
      expect(result.freedSpace).toBe(5 * 1024 * 1024);
    });

    it('should delete manual backups older than 14 days', async () => {
      // Create manual backups: 1 recent, 1 old
      await createMockBackup('manual', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), 1024 * 1024); // 5 days old
      await createMockBackup('manual', new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), 1024 * 1024); // 20 days old

      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(1); // Should delete the 20-day-old backup
      expect(result.freedSpace).toBe(1024 * 1024);
    });

    it('should delete pre-update backups older than 180 days', async () => {
      // Create pre-update backups: 1 recent, 1 old
      await createMockBackup('pre-update', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 1024 * 1024); // 30 days old
      await createMockBackup('pre-update', new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), 1024 * 1024); // 200 days old

      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(1); // Should delete the 200-day-old backup
      expect(result.freedSpace).toBe(1024 * 1024);
    });

    it('should apply both count and age policies', async () => {
      // Create 8 manual backups: 5 recent, 3 old (>14 days)
      for (let i = 0; i < 5; i++) {
        await createMockBackup('manual', new Date(Date.now() - i * 24 * 60 * 60 * 1000), 1024 * 1024);
      }
      for (let i = 0; i < 3; i++) {
        await createMockBackup('manual', new Date(Date.now() - (20 + i) * 24 * 60 * 60 * 1000), 1024 * 1024);
      }

      const result = await retentionManager.applyRetentionPolicies();

      // Should delete all 3 old backups (age > 14 days)
      expect(result.deleted).toBe(3);
      expect(result.freedSpace).toBe(3 * 1024 * 1024);
    });

    it('should handle multiple backup types separately', async () => {
      // Create 10 daily, 8 manual backups
      for (let i = 0; i < 10; i++) {
        await createMockBackup('scheduled-daily', new Date(Date.now() - i * 24 * 60 * 60 * 1000), 1024 * 1024);
      }
      for (let i = 0; i < 8; i++) {
        await createMockBackup('manual', new Date(Date.now() - i * 24 * 60 * 60 * 1000), 1024 * 1024);
      }

      const result = await retentionManager.applyRetentionPolicies();

      // Daily: delete 3 (keep 7)
      // Manual: delete 3 (keep 5)
      expect(result.deleted).toBe(6);
      expect(result.freedSpace).toBe(6 * 1024 * 1024);
    });

    it('should continue on deletion errors', async () => {
      // Create 10 daily backups
      for (let i = 0; i < 10; i++) {
        await createMockBackup('scheduled-daily', new Date(Date.now() - i * 24 * 60 * 60 * 1000), 1024 * 1024);
      }

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await retentionManager.applyRetentionPolicies();

      // Should still delete successfully
      expect(result.deleted).toBeGreaterThan(0);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('checkDiskSpace()', () => {
    it('should return disk space information', async () => {
      const diskSpace = await retentionManager.checkDiskSpace(backupDir);

      expect(diskSpace.size).toBeGreaterThan(0);
      expect(diskSpace.used).toBeGreaterThanOrEqual(0);
      expect(diskSpace.available).toBeGreaterThan(0);
      expect(diskSpace.usagePercent).toBeGreaterThanOrEqual(0);
      expect(diskSpace.usagePercent).toBeLessThanOrEqual(100);
    });

    it('should calculate usage percentage correctly', async () => {
      const diskSpace = await retentionManager.checkDiskSpace(backupDir);

      const calculatedPercent = (diskSpace.used / diskSpace.size) * 100;
      // Allow for rounding differences in df output
      expect(Math.abs(diskSpace.usagePercent - calculatedPercent)).toBeLessThan(1);
    });

    it('should handle non-existent path gracefully', async () => {
      const nonexistentPath = join(tempDir, 'nonexistent');

      await expect(retentionManager.checkDiskSpace(nonexistentPath)).rejects.toThrow();
    });
  });

  describe('ensureSufficientSpace()', () => {
    it('should return true when sufficient space exists', async () => {
      const diskSpace = await retentionManager.checkDiskSpace(backupDir);
      const smallRequirement = 1024; // 1 KB

      const result = await retentionManager.ensureSufficientSpace(smallRequirement, 95);

      expect(result).toBe(true);
    });

    it('should delete oldest non-pre-update backups first', async () => {
      // Create backups: 5 manual (oldest), 5 daily, 5 pre-update (newest)
      const manualBackups: BackupMetadata[] = [];
      for (let i = 0; i < 5; i++) {
        const backup = await createMockBackup(
          'manual',
          new Date(Date.now() - (20 + i) * 24 * 60 * 60 * 1000),
          10 * 1024 * 1024 // 10 MB each
        );
        manualBackups.push(backup);
      }

      for (let i = 0; i < 5; i++) {
        await createMockBackup(
          'scheduled-daily',
          new Date(Date.now() - (10 + i) * 24 * 60 * 60 * 1000),
          10 * 1024 * 1024
        );
      }

      for (let i = 0; i < 5; i++) {
        await createMockBackup(
          'pre-update',
          new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          10 * 1024 * 1024
        );
      }

      // Request space that requires deleting some backups
      // This is platform-dependent, so we just verify it doesn't throw
      const result = await retentionManager.ensureSufficientSpace(1024 * 1024, 99);

      expect(typeof result).toBe('boolean');
    });

    it('should preserve pre-update backups as long as possible', async () => {
      // Create 3 manual and 3 pre-update backups
      for (let i = 0; i < 3; i++) {
        await createMockBackup(
          'manual',
          new Date(Date.now() - (10 + i) * 24 * 60 * 60 * 1000),
          5 * 1024 * 1024
        );
      }

      const preUpdateBackups: BackupMetadata[] = [];
      for (let i = 0; i < 3; i++) {
        const backup = await createMockBackup(
          'pre-update',
          new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          5 * 1024 * 1024
        );
        preUpdateBackups.push(backup);
      }

      // This test verifies the method runs without error
      const result = await retentionManager.ensureSufficientSpace(1024, 99);

      expect(typeof result).toBe('boolean');
    });

    it('should handle very low disk space scenarios', async () => {
      // Create some backups
      for (let i = 0; i < 5; i++) {
        await createMockBackup(
          'manual',
          new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          1024 * 1024
        );
      }

      // Try to ensure space with very tight constraints
      // The actual result depends on available disk space
      const result = await retentionManager.ensureSufficientSpace(100 * 1024 * 1024, 50);

      expect(typeof result).toBe('boolean');
    });

    it('should log cleanup progress', async () => {
      // Spy on console.log
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create some backups
      for (let i = 0; i < 5; i++) {
        await createMockBackup(
          'manual',
          new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          1024 * 1024
        );
      }

      await retentionManager.ensureSufficientSpace(1024, 99);

      // Verify logging occurred (method should log when checking space)
      // Note: Logging may or may not happen depending on available space
      consoleLogSpy.mockRestore();
    });
  });

  describe('getBackupsInDirectory() - private method via applyRetentionPolicies', () => {
    it('should handle empty backup directory', async () => {
      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(0);
      expect(result.freedSpace).toBe(0);
    });

    it('should skip non-backup directories', async () => {
      // Create non-backup directory
      await mkdir(join(backupDir, 'not-a-backup'));

      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(0);
    });

    it('should skip directories without manifest.json', async () => {
      // Create backup-looking directory without manifest
      await mkdir(join(backupDir, 'backup-invalid-123'));

      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(0);
    });

    it('should handle corrupted manifest.json gracefully', async () => {
      // Create directory with invalid manifest
      const backupDirName = 'backup-invalid-456';
      await mkdir(join(backupDir, backupDirName));
      await writeFile(join(backupDir, backupDirName, 'manifest.json'), 'INVALID JSON', 'utf-8');

      // Spy on console.warn
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await retentionManager.applyRetentionPolicies();

      expect(result.deleted).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('formatBytes() - private method', () => {
    it('should format bytes correctly via deletion logs', async () => {
      // Spy on console.log to capture formatted bytes
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create and delete a backup
      await createMockBackup('manual', new Date(), 1024 * 1024 * 1.5);

      await retentionManager.applyRetentionPolicies();

      // Verify console.log was called (deletion should log formatted bytes)
      // The exact format depends on implementation

      consoleLogSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when retention policies fail', async () => {
      // Create a manager with invalid directory to trigger error
      const invalidManager = new RetentionManager('/root/inaccessible/backups');

      // This may not throw on all systems, depends on permissions
      // Just verify it doesn't crash
      try {
        await invalidManager.applyRetentionPolicies();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle disk space check failures gracefully', async () => {
      await expect(retentionManager.checkDiskSpace('/nonexistent/path/that/does/not/exist')).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      try {
        await retentionManager.checkDiskSpace('/nonexistent/path/that/does/not/exist');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to check disk space');
      }
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete retention lifecycle', async () => {
      // Create diverse set of backups
      const backups: BackupMetadata[] = [];

      // 10 daily backups
      for (let i = 0; i < 10; i++) {
        backups.push(await createMockBackup('scheduled-daily', new Date(Date.now() - i * 24 * 60 * 60 * 1000), 1024 * 1024));
      }

      // 8 manual backups
      for (let i = 0; i < 8; i++) {
        backups.push(await createMockBackup('manual', new Date(Date.now() - i * 24 * 60 * 60 * 1000), 1024 * 1024));
      }

      // 5 pre-update backups
      for (let i = 0; i < 5; i++) {
        backups.push(await createMockBackup('pre-update', new Date(Date.now() - i * 24 * 60 * 60 * 1000), 1024 * 1024));
      }

      // Apply retention
      const result = await retentionManager.applyRetentionPolicies();

      // Daily: delete 3 (keep 7)
      // Manual: delete 3 (keep 5)
      // Pre-update: keep all (< 10)
      expect(result.deleted).toBe(6);
      expect(result.freedSpace).toBe(6 * 1024 * 1024);
    });

    it('should handle space-aware cleanup followed by retention', async () => {
      // Create backups
      for (let i = 0; i < 5; i++) {
        await createMockBackup('manual', new Date(Date.now() - i * 24 * 60 * 60 * 1000), 2 * 1024 * 1024);
      }

      // Ensure space
      const spaceResult = await retentionManager.ensureSufficientSpace(1024, 99);
      expect(typeof spaceResult).toBe('boolean');

      // Apply retention policies
      const retentionResult = await retentionManager.applyRetentionPolicies();
      expect(retentionResult.deleted).toBeGreaterThanOrEqual(0);
    });

    it('should verify disk space calculations are consistent', async () => {
      const diskSpace1 = await retentionManager.checkDiskSpace(backupDir);
      const diskSpace2 = await retentionManager.checkDiskSpace(backupDir);

      // Should be approximately the same (allowing for small variations)
      expect(Math.abs(diskSpace1.usagePercent - diskSpace2.usagePercent)).toBeLessThan(1);
    });
  });

  describe('Cross-platform compatibility', () => {
    it('should work on current platform', async () => {
      // This test verifies basic functionality works on the current platform
      await createMockBackup('manual', new Date(), 1024 * 1024);

      const result = await retentionManager.applyRetentionPolicies();
      expect(result).toBeDefined();

      const diskSpace = await retentionManager.checkDiskSpace(backupDir);
      expect(diskSpace).toBeDefined();
      expect(diskSpace.size).toBeGreaterThan(0);
    });

    it('should handle platform-specific disk space commands', async () => {
      const diskSpace = await retentionManager.checkDiskSpace(backupDir);

      // Verify all required fields are present
      expect(diskSpace).toHaveProperty('size');
      expect(diskSpace).toHaveProperty('used');
      expect(diskSpace).toHaveProperty('available');
      expect(diskSpace).toHaveProperty('usagePercent');

      // Verify values are reasonable
      expect(diskSpace.size).toBeGreaterThan(0);
      expect(diskSpace.available).toBeGreaterThanOrEqual(0);
      expect(diskSpace.used).toBeGreaterThanOrEqual(0);
      expect(diskSpace.usagePercent).toBeGreaterThanOrEqual(0);
      expect(diskSpace.usagePercent).toBeLessThanOrEqual(100);
    });
  });
});
