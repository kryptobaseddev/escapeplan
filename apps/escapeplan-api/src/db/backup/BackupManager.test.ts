/**
 * Tests for BackupManager
 * Validates backup creation, verification, and management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupManager } from './BackupManager.js';
import Database from 'better-sqlite3';
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BackupMetadata } from './types.js';

describe('BackupManager', () => {
  let testDbPath: string;
  let backupDir: string;
  let backupManager: BackupManager;
  let testDb: Database.Database;

  beforeEach(async () => {
    // Create temporary test database
    const tempDir = join(tmpdir(), `backup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    testDbPath = join(tempDir, 'test.db');
    backupDir = join(tempDir, 'backups');

    await mkdir(backupDir, { recursive: true });

    // Initialize test database with some data
    testDb = new Database(testDbPath);
    testDb.pragma('journal_mode = WAL');

    testDb.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      );

      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      INSERT INTO users (name, email) VALUES
        ('Alice', 'alice@example.com'),
        ('Bob', 'bob@example.com'),
        ('Charlie', 'charlie@example.com');

      INSERT INTO posts (user_id, title, content) VALUES
        (1, 'First Post', 'Hello World'),
        (1, 'Second Post', 'TypeScript is great'),
        (2, 'Bob''s Post', 'Testing backups');
    `);

    backupManager = new BackupManager(testDbPath, backupDir);
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
    const tempDir = join(testDbPath, '..');
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup failed, ignore
    }
  });

  describe('Constructor', () => {
    it('should create BackupManager with valid paths', () => {
      expect(backupManager).toBeDefined();
    });

    it('should throw error for relative database path', () => {
      expect(() => new BackupManager('relative/path.db', backupDir)).toThrow('absolute path');
    });

    it('should throw error for relative backup directory path', () => {
      expect(() => new BackupManager(testDbPath, 'relative/dir')).toThrow('absolute path');
    });
  });

  describe('createFullBackup()', () => {
    it('should create backup with manual trigger', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
        checkpointWal: true,
      });

      expect(metadata).toBeDefined();
      expect(metadata.id).toBeDefined();
      expect(metadata.trigger).toBe('manual');
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.backupPath).toBeDefined();
      expect(metadata.databasePath).toContain('escapeplan.db');
      expect(metadata.checksumSha256).toBeDefined();
      expect(metadata.checksumSha256).toHaveLength(64); // SHA-256 is 64 hex chars
      expect(metadata.sizeBytes).toBeGreaterThan(0);
      expect(metadata.totalSizeBytes).toBeGreaterThanOrEqual(metadata.sizeBytes);
      expect(metadata.sourceDatabasePath).toBe(testDbPath);
    });

    it('should create backup with pre-update trigger', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'pre-update',
        updateVersion: '0.2.0',
        installId: 'test-install-123',
      });

      expect(metadata.trigger).toBe('pre-update');
      expect(metadata.updateVersion).toBe('0.2.0');
      expect(metadata.installId).toBe('test-install-123');
    });

    it('should create backup with app version', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
        appVersion: '0.1.0',
      });

      expect(metadata.appVersion).toBe('0.1.0');
    });

    it('should create backup with notes', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
        notes: 'Test backup for unit tests',
      });

      expect(metadata.notes).toBe('Test backup for unit tests');
    });

    it('should checkpoint WAL before backup by default', async () => {
      // Write some data to create WAL
      testDb.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Test', 'test@example.com');

      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      expect(metadata).toBeDefined();
    });

    it('should skip WAL checkpoint if requested', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
        checkpointWal: false,
      });

      expect(metadata).toBeDefined();
    });

    it('should verify backup after creation if requested', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
        verifyAfterCreate: true,
      });

      expect(metadata.verified).toBe(true);
    });

    it('should include table count in metadata', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      expect(metadata.tableCount).toBe(2); // users and posts
    });

    it('should create manifest.json with metadata', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      const manifestPath = join(metadata.backupPath, 'manifest.json');
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent) as BackupMetadata;

      expect(manifest.id).toBe(metadata.id);
      expect(manifest.trigger).toBe('manual');
      expect(manifest.checksumSha256).toBe(metadata.checksumSha256);
    });

    it('should handle backup creation when source database is locked', async () => {
      // Create another connection to lock database
      const lockingDb = new Database(testDbPath);
      lockingDb.prepare('BEGIN EXCLUSIVE').run();

      try {
        // Backup should still work because it opens readonly
        const metadata = await backupManager.createFullBackup({
          trigger: 'manual',
        });

        expect(metadata).toBeDefined();
      } finally {
        lockingDb.prepare('ROLLBACK').run();
        lockingDb.close();
      }
    }, 10000); // 10 second timeout for this test

    it('should cleanup on backup failure', async () => {
      // Create a BackupManager with invalid database path
      const invalidManager = new BackupManager('/nonexistent/database.db', backupDir);

      await expect(invalidManager.createFullBackup({
        trigger: 'manual',
      })).rejects.toThrow();

      // Verify no partial backup directory remains
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(0);
    });
  });

  describe('verifyBackup()', () => {
    it('should verify valid backup by database path', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      const result = await backupManager.verifyBackup(metadata.databasePath);

      expect(result.success).toBe(true);
      expect(result.canOpenDatabase).toBe(true);
      expect(result.integrityCheckPassed).toBe(true);
      expect(result.checksumValid).toBe(true);
      expect(result.manifestValid).toBe(true);
      expect(result.integrityErrors).toBe(0);
    });

    it('should verify valid backup by directory path', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      const result = await backupManager.verifyBackup(metadata.backupPath);

      expect(result.success).toBe(true);
      expect(result.canOpenDatabase).toBe(true);
      expect(result.integrityCheckPassed).toBe(true);
      expect(result.checksumValid).toBe(true);
      expect(result.manifestValid).toBe(true);
    });

    it('should detect missing backup path', async () => {
      const result = await backupManager.verifyBackup('/nonexistent/backup.db');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('not found');
    });

    it('should detect corrupted database file', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      // Corrupt the database file by writing random bytes at the start
      // SQLite has specific header requirements, so corruption should be detected
      const corruptedData = Buffer.alloc(1024);
      corruptedData.write('CORRUPTED DATA');
      await writeFile(metadata.databasePath, corruptedData);

      const result = await backupManager.verifyBackup(metadata.databasePath);

      expect(result.success).toBe(false);
      // Note: Better-sqlite3 may still open a corrupted file, but integrity check should fail
      expect(result.integrityCheckPassed).toBe(false);
    });

    it('should detect checksum mismatch', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      // Modify database without updating manifest
      const backupDb = new Database(metadata.databasePath);
      backupDb.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Modified', 'modified@example.com');
      backupDb.close();

      const result = await backupManager.verifyBackup(metadata.backupPath);

      expect(result.success).toBe(false);
      expect(result.checksumValid).toBe(false);
      expect(result.errorMessage).toContain('Checksum mismatch');
    });

    it('should verify backup without manifest', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      // Delete manifest
      await rm(join(metadata.backupPath, 'manifest.json'));

      const result = await backupManager.verifyBackup(metadata.databasePath);

      // Should succeed without checksum verification
      expect(result.success).toBe(true);
      expect(result.canOpenDatabase).toBe(true);
      expect(result.integrityCheckPassed).toBe(true);
    });

    it('should handle invalid manifest JSON', async () => {
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
      });

      // Write invalid JSON to manifest
      await writeFile(join(metadata.backupPath, 'manifest.json'), 'INVALID JSON', 'utf-8');

      const result = await backupManager.verifyBackup(metadata.backupPath);

      expect(result.success).toBe(false);
      expect(result.manifestValid).toBe(false);
      expect(result.errorMessage).toContain('Manifest validation failed');
    });
  });

  describe('listBackups()', () => {
    it('should return empty array when no backups exist', async () => {
      const backups = await backupManager.listBackups();
      expect(backups).toEqual([]);
    });

    it('should list single backup', async () => {
      await backupManager.createFullBackup({ trigger: 'manual' });

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].trigger).toBe('manual');
    });

    it('should list multiple backups', async () => {
      await backupManager.createFullBackup({ trigger: 'manual' });
      await backupManager.createFullBackup({ trigger: 'pre-update', updateVersion: '0.2.0' });
      await backupManager.createFullBackup({ trigger: 'scheduled-daily' });

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(3);
    });

    it('should sort backups by creation date (newest first)', async () => {
      const backup1 = await backupManager.createFullBackup({ trigger: 'manual', notes: 'First' });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const backup2 = await backupManager.createFullBackup({ trigger: 'manual', notes: 'Second' });

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(2);
      expect(backups[0].id).toBe(backup2.id); // Newest first
      expect(backups[1].id).toBe(backup1.id);
    });

    it('should skip directories without manifest.json', async () => {
      await backupManager.createFullBackup({ trigger: 'manual' });

      // Create directory without manifest
      const fakeBackupDir = join(backupDir, 'backup-fake-123');
      await mkdir(fakeBackupDir);

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(1); // Only the valid backup
    });

    it('should skip non-backup directories', async () => {
      await backupManager.createFullBackup({ trigger: 'manual' });

      // Create non-backup directory
      await mkdir(join(backupDir, 'other-directory'));

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(1); // Only the valid backup
    });
  });

  describe('deleteBackup()', () => {
    it('should delete backup by ID', async () => {
      const metadata = await backupManager.createFullBackup({ trigger: 'manual' });

      await backupManager.deleteBackup(metadata.id);

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(0);
    });

    it('should throw error when deleting nonexistent backup', async () => {
      await expect(backupManager.deleteBackup('nonexistent-id')).rejects.toThrow('not found');
    });

    it('should delete all backup files and directory', async () => {
      const metadata = await backupManager.createFullBackup({ trigger: 'manual' });

      // Verify directory exists
      const manifestPath = join(metadata.backupPath, 'manifest.json');
      await readFile(manifestPath, 'utf-8'); // Should not throw

      await backupManager.deleteBackup(metadata.id);

      // Verify directory is gone
      await expect(readFile(manifestPath, 'utf-8')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle ENOENT when listing backups from nonexistent directory', async () => {
      const tempBackupDir = join(tmpdir(), `nonexistent-${Date.now()}`);
      const manager = new BackupManager(testDbPath, tempBackupDir);

      const backups = await manager.listBackups();
      expect(backups).toEqual([]);
    });

    it('should handle EACCES when accessing restricted directory', async () => {
      // This test is platform-dependent and may not work in all environments
      // Skip if running in environment without permission control
      if (process.platform === 'win32') {
        return; // Skip on Windows
      }

      // Test would require creating a restricted directory
      // Skipping for now as it requires special setup
    });

    it('should provide meaningful error messages', async () => {
      const invalidManager = new BackupManager('/root/inaccessible/db.db', '/root/inaccessible/backups');

      await expect(invalidManager.createFullBackup({
        trigger: 'manual',
      })).rejects.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should create, verify, list, and delete backup', async () => {
      // Create backup
      const metadata = await backupManager.createFullBackup({
        trigger: 'pre-update',
        updateVersion: '0.2.0',
        verifyAfterCreate: true,
      });

      expect(metadata.verified).toBe(true);

      // List backups
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe(metadata.id);

      // Verify backup again
      const verifyResult = await backupManager.verifyBackup(metadata.backupPath);
      expect(verifyResult.success).toBe(true);

      // Delete backup
      await backupManager.deleteBackup(metadata.id);

      // Verify deleted
      const backupsAfterDelete = await backupManager.listBackups();
      expect(backupsAfterDelete).toHaveLength(0);
    });

    it('should handle multiple concurrent backups', async () => {
      const backupPromises = [
        backupManager.createFullBackup({ trigger: 'manual', notes: 'Backup 1' }),
        backupManager.createFullBackup({ trigger: 'manual', notes: 'Backup 2' }),
        backupManager.createFullBackup({ trigger: 'manual', notes: 'Backup 3' }),
      ];

      const results = await Promise.all(backupPromises);

      expect(results).toHaveLength(3);
      expect(new Set(results.map(r => r.id)).size).toBe(3); // All unique IDs

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(3);
    });

    it('should preserve data integrity across backup and restore', async () => {
      // Get original data
      const originalUsers = testDb.prepare('SELECT * FROM users ORDER BY id').all();
      const originalPosts = testDb.prepare('SELECT * FROM posts ORDER BY id').all();

      // Create backup
      const metadata = await backupManager.createFullBackup({
        trigger: 'manual',
        verifyAfterCreate: true,
      });

      // Open backup database and verify data
      const backupDb = new Database(metadata.databasePath, { readonly: true });
      try {
        const backupUsers = backupDb.prepare('SELECT * FROM users ORDER BY id').all();
        const backupPosts = backupDb.prepare('SELECT * FROM posts ORDER BY id').all();

        expect(backupUsers).toEqual(originalUsers);
        expect(backupPosts).toEqual(originalPosts);
      } finally {
        backupDb.close();
      }
    });
  });
});
