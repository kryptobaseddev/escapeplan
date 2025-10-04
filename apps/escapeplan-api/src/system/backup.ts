/**
 * Backup System
 *
 * Creates compressed .tar.gz backups with selective inclusion:
 * - Database (SQLite file) - always included
 * - Games data (from database)
 * - Assets (images/video/audio files)
 * - System logs (last 7 days)
 *
 * Supports local and USB storage destinations
 * Includes SHA-256 checksum and manifest.json
 */

import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as tar from 'tar';
import { db } from '../db/client.js';
import { backups, games, assets, systemLogs } from '@escapeplan/contracts';
import { eq, and, gte, desc } from 'drizzle-orm';
import { monotonicFactory } from 'ulid';
import type { BackupIncludes, BackupResponse } from '@escapeplan/contracts';
import { getBackupBasePath, getDatabasePath, getAssetBasePath, ensureBackupDirectory } from '@escapeplan/contracts/paths';

const ulid = monotonicFactory();

// ============================================================================
// CONFIGURATION
// ============================================================================

const BACKUP_DIR_USB = '/mnt/escapeplan-backup';
const MAX_BACKUPS = 7; // Keep last 7 backups

// Get environment-aware paths
function getBackupDir(destination: 'local' | 'usb'): string {
  return destination === 'usb' ? BACKUP_DIR_USB : getBackupBasePath();
}

const DB_FILE_PATH = getDatabasePath();
const ASSETS_DIR = getAssetBasePath();

// ============================================================================
// BACKUP CREATION
// ============================================================================

interface BackupOptions {
  type: 'manual' | 'scheduled' | 'pre-update';
  includes: BackupIncludes;
  destination: 'local' | 'usb';
  usbDeviceId?: string;
  createdBy: string;
}

/**
 * Create backup manifest with metadata
 */
async function createManifest(includes: BackupIncludes): Promise<object> {
  const manifest = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    hostname: process.env.HOSTNAME || 'escapeplan',
    includes: includes,
    contents: {} as Record<string, any>
  };

  // Count database records
  if (includes.database) {
    const [gamesCount] = await db.select().from(games);
    manifest.contents.database = {
      file: 'escapeplan.db',
      tables: ['operators', 'games', 'bookings', 'sessions', 'cameras', 'roles', 'permissions']
    };
  }

  // Count assets
  if (includes.assets) {
    const allAssets = await db.select().from(assets);
    manifest.contents.assets = {
      totalFiles: allAssets.length,
      totalBytes: allAssets.reduce((sum, a) => sum + a.size_bytes, 0)
    };
  }

  // Count logs
  if (includes.logs) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentLogs = await db
      .select()
      .from(systemLogs)
      .where(gte(systemLogs.timestamp, sevenDaysAgo));

    manifest.contents.logs = {
      totalLogs: recentLogs.length,
      since: sevenDaysAgo
    };
  }

  return manifest;
}

/**
 * Calculate SHA-256 checksum of a file
 */
async function calculateChecksum(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

/**
 * Export database tables to JSON (for games data)
 */
async function exportGamesData(tempDir: string): Promise<void> {
  const allGames = await db.select().from(games);
  await fs.writeFile(
    path.join(tempDir, 'games.json'),
    JSON.stringify(allGames, null, 2)
  );
}

/**
 * Export logs to JSON
 */
async function exportLogs(tempDir: string): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentLogs = await db
    .select()
    .from(systemLogs)
    .where(gte(systemLogs.timestamp, sevenDaysAgo));

  await fs.writeFile(
    path.join(tempDir, 'logs.json'),
    JSON.stringify(recentLogs, null, 2)
  );
}

/**
 * Create backup archive
 */
export async function createBackup(options: BackupOptions): Promise<BackupResponse> {
  const backupId = ulid();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `escapeplan-backup-${timestamp}.tar.gz`;

  // Determine backup directory (environment-aware)
  const backupDir = getBackupDir(options.destination);
  const backupFilePath = path.join(backupDir, backupFileName);

  // Ensure backup directory exists
  if (options.destination === 'local') {
    await ensureBackupDirectory();
  } else {
    await fs.mkdir(backupDir, { recursive: true });
  }

  // Create backup record (in_progress)
  const backupRecord = {
    id: backupId,
    type: options.type,
    status: 'in_progress' as const,
    file_path: null,
    file_size_bytes: null,
    includes: options.includes,
    destination: options.destination,
    usb_device: options.usbDeviceId,
    checksum_sha256: null,
    error_message: null,
    created_by: options.createdBy,
    created_at: new Date().toISOString(),
    completed_at: null
  };

  await db.insert(backups).values(backupRecord);

  try {
    // Create temporary directory for staging backup files
    const tempDir = path.join('/tmp', `backup-${backupId}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create manifest
    const manifest = await createManifest(options.includes);
    await fs.writeFile(
      path.join(tempDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Copy database file (always included)
    if (options.includes.database) {
      await fs.copyFile(DB_FILE_PATH, path.join(tempDir, 'escapeplan.db'));
    }

    // Export games data
    if (options.includes.games) {
      await exportGamesData(tempDir);
    }

    // Copy assets directory
    if (options.includes.assets) {
      try {
        await fs.cp(ASSETS_DIR, path.join(tempDir, 'assets'), { recursive: true });
      } catch (error) {
        // Assets directory might not exist yet
        console.warn('Assets directory not found, skipping');
      }
    }

    // Export logs
    if (options.includes.logs) {
      await exportLogs(tempDir);
    }

    // Create tar.gz archive
    await tar.create(
      {
        gzip: true,
        file: backupFilePath,
        cwd: tempDir
      },
      ['.'] // Include all files in temp directory
    );

    // Calculate checksum
    const checksum = await calculateChecksum(backupFilePath);

    // Get file size
    const stats = await fs.stat(backupFilePath);
    const fileSizeBytes = stats.size;

    // Update backup record (completed)
    await db
      .update(backups)
      .set({
        status: 'completed',
        file_path: backupFilePath,
        file_size_bytes: fileSizeBytes,
        checksum_sha256: checksum,
        completed_at: new Date().toISOString()
      })
      .where(eq(backups.id, backupId));

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Enforce retention policy
    await enforceBackupRetention(options.destination);

    return {
      id: backupId,
      type: options.type,
      status: 'completed',
      filePath: backupFilePath,
      fileSizeBytes,
      includes: options.includes,
      destination: options.destination,
      usbDevice: options.usbDeviceId,
      checksumSha256: checksum,
      createdBy: options.createdBy,
      createdAt: backupRecord.created_at,
      completedAt: new Date().toISOString()
    };
  } catch (error) {
    // Update backup record (failed)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await db
      .update(backups)
      .set({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .where(eq(backups.id, backupId));

    throw error;
  }
}

// ============================================================================
// BACKUP MANAGEMENT
// ============================================================================

/**
 * List all backups
 */
export async function listBackups(destination?: 'local' | 'usb'): Promise<BackupResponse[]> {
  const query = destination
    ? db.select().from(backups).where(eq(backups.destination, destination))
    : db.select().from(backups);

  const results = await query.orderBy(desc(backups.created_at));

  return results.map((b) => ({
    id: b.id,
    type: b.type as 'manual' | 'scheduled' | 'pre-update',
    status: b.status as 'in_progress' | 'completed' | 'failed',
    filePath: b.file_path || undefined,
    fileSizeBytes: b.file_size_bytes || undefined,
    includes: b.includes as BackupIncludes,
    destination: b.destination as 'local' | 'usb',
    usbDevice: b.usb_device || undefined,
    checksumSha256: b.checksum_sha256 || undefined,
    errorMessage: b.error_message || undefined,
    createdBy: b.created_by,
    createdAt: b.created_at,
    completedAt: b.completed_at || undefined
  }));
}

/**
 * Get backup by ID
 */
export async function getBackupById(backupId: string): Promise<BackupResponse | null> {
  const [result] = await db
    .select()
    .from(backups)
    .where(eq(backups.id, backupId))
    .limit(1);

  if (!result) return null;

  return {
    id: result.id,
    type: result.type as 'manual' | 'scheduled' | 'pre-update',
    status: result.status as 'in_progress' | 'completed' | 'failed',
    filePath: result.file_path || undefined,
    fileSizeBytes: result.file_size_bytes || undefined,
    includes: result.includes as BackupIncludes,
    destination: result.destination as 'local' | 'usb',
    usbDevice: result.usb_device || undefined,
    checksumSha256: result.checksum_sha256 || undefined,
    errorMessage: result.error_message || undefined,
    createdBy: result.created_by,
    createdAt: result.created_at,
    completedAt: result.completed_at || undefined
  };
}

/**
 * Delete backup
 */
export async function deleteBackup(backupId: string): Promise<void> {
  const backup = await getBackupById(backupId);
  if (!backup) throw new Error('Backup not found');

  // Delete file from filesystem
  if (backup.filePath) {
    try {
      await fs.unlink(backup.filePath);
    } catch (error) {
      console.error('Failed to delete backup file:', error);
    }
  }

  // Delete database record
  await db.delete(backups).where(eq(backups.id, backupId));
}

/**
 * Enforce backup retention policy
 * Keep only last MAX_BACKUPS backups per destination
 */
async function enforceBackupRetention(destination: 'local' | 'usb'): Promise<void> {
  const allBackups = await db
    .select()
    .from(backups)
    .where(
      and(
        eq(backups.destination, destination),
        eq(backups.status, 'completed')
      )
    )
    .orderBy(desc(backups.created_at));

  if (allBackups.length > MAX_BACKUPS) {
    const toDelete = allBackups.slice(MAX_BACKUPS);
    for (const backup of toDelete) {
      await deleteBackup(backup.id);
    }
  }
}

/**
 * Get latest backup date
 */
export async function getLastBackupDate(): Promise<string | null> {
  const [latest] = await db
    .select()
    .from(backups)
    .where(eq(backups.status, 'completed'))
    .orderBy(desc(backups.created_at))
    .limit(1);

  return latest?.completed_at || null;
}
