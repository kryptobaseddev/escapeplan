import path from 'node:path';
import fs from 'node:fs/promises';
import { sqlite } from '../db/client.js';
import { db } from '../db/client.js';
import { backups } from '@escapeplan/contracts';
import { eq } from 'drizzle-orm';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { fileTypeFromBuffer } from 'file-type';
import {
  getAssetBasePath,
  getAssetSubPath,
  generateAssetFilename,
  getAllowedMimeTypes,
  getExtensionFromMime,
  slugify
} from '@escapeplan/contracts/paths';
import { processFile } from './processing.js';
import { requireSession } from '../auth.js';
import { settings } from '../settings.js';
import { checkDiskSpace } from './fileops.js';

export interface UploadAssetQuery {
  gameId?: string;
  assetType: 'thumbnail' | 'room_background' | 'gallery' | 'puzzle_media' | 'hint_media' | 'milestone_media' | 'system_audio';
  puzzleId?: string;
  milestoneId?: string;
  mediaType?: 'text' | 'image' | 'audio' | 'video';
  order?: number;
  isReusable?: boolean;
}

export interface AssetRecord {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  asset_type: string;
  media_type: string | null;
  file_path: string;
  game_id: string | null;
  puzzle_id: string | null;
  hint_order: number | null;
  is_reusable: number;
  uploaded_by: string;
  uploaded_at: string;
  metadata: string | null;
}

/**
 * Sanitize filename by removing control characters and normalizing Unicode.
 * Prevents UI issues and potential security problems.
 */
function sanitizeFilename(filename: string): string {
  return filename
    // Normalize Unicode (NFC form)
    .normalize('NFC')
    // Remove control characters (0x00-0x1F, 0x7F-0x9F)
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Remove zero-width characters that can be used for spoofing
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Replace problematic characters with underscores
    .replace(/[<>:"|?*]/g, '_')
    // Trim whitespace
    .trim();
}

/**
 * Handle asset upload
 */
export async function handleAssetUpload(request: FastifyRequest, reply: FastifyReply) {
  // Authenticate user
  const session = await requireSession(request.headers);
  if (!session) {
    return reply.status(401).send({ statusCode: 401, message: 'Authentication required' });
  }

  // Check permissions (manage_assets permission required)
  if (session.user.role !== 'admin' && !session.user.permissions?.includes('manage_assets')) {
    return reply.status(403).send({
      statusCode: 403,
      message: 'Insufficient permissions. Required: manage_assets'
    });
  }

  // Parse query params
  const query = request.query as UploadAssetQuery;
  let { gameId, assetType, puzzleId, mediaType, order, isReusable } = query;

  // Treat special gameId values as "no game" (shared/system assets)
  const sharedGameValues = ['shared', 'system', 'reusable', ''];
  if (gameId && sharedGameValues.includes(gameId.toLowerCase())) {
    gameId = undefined;
  }

  // Validate required params
  if (!assetType) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'assetType is required'
    });
  }

  // For gallery and reusable assets, gameId is optional
  const systemAssetTypes = ['system_audio', 'gallery'];
  const requiresGame = !systemAssetTypes.includes(assetType) && !isReusable;

  if (!gameId && requiresGame) {
    return reply.status(400).send({
      statusCode: 400,
      message: `gameId is required for ${assetType} assets unless marked as reusable`
    });
  }

  // For system_audio, mediaType must be 'audio'
  if (assetType === 'system_audio' && mediaType !== 'audio') {
    return reply.status(400).send({
      statusCode: 400,
      message: 'system_audio assets must have mediaType="audio"'
    });
  }

  // Validate hint_media and milestone_media require mediaType
  if ((assetType === 'hint_media' || assetType === 'milestone_media') && !mediaType) {
    return reply.status(400).send({
      statusCode: 400,
      message: `mediaType is required for ${assetType}`
    });
  }

  // Get the uploaded file
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ statusCode: 400, message: 'No file uploaded' });
  }

  // Read file buffer first for validation
  const fileBuffer = await data.toBuffer();

  // Check for empty file
  if (fileBuffer.length === 0) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Uploaded file is empty (0 bytes). Please upload a valid file.'
    });
  }

  // Sanitize and truncate original filename
  let originalFilename = sanitizeFilename(data.filename);

  // Truncate to 255 characters (filesystem limit)
  if (originalFilename.length > 255) {
    // Keep extension, truncate base name
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    const maxBaseLength = 255 - ext.length;
    originalFilename = baseName.substring(0, maxBaseLength) + ext;

    request.log.warn({
      original: data.filename,
      truncated: originalFilename
    }, 'Filename truncated to 255 characters');
  }

  // Log if filename was sanitized
  if (originalFilename !== data.filename) {
    request.log.info({
      original: data.filename,
      sanitized: originalFilename
    }, 'Filename sanitized');
  }

  try {
    // Validate file type
    const allowedTypes = getAllowedMimeTypes(assetType, mediaType);
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({
        statusCode: 400,
        message: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`
      });
    }

    // Validate file size based on detected media type from MIME type
    let maxSize: number;
    if (data.mimetype.startsWith('image/')) {
      maxSize = settings.getMaxImageSizeMB() * 1024 * 1024;
    } else if (data.mimetype.startsWith('audio/')) {
      maxSize = settings.getMaxAudioSizeMB() * 1024 * 1024;
    } else if (data.mimetype.startsWith('video/')) {
      maxSize = settings.getMaxVideoSizeMB() * 1024 * 1024;
    } else {
      // Default to image size for unknown types
      maxSize = settings.getMaxImageSizeMB() * 1024 * 1024;
    }

    if (fileBuffer.length > maxSize) {
      const fileType = data.mimetype.startsWith('image/') ? 'images' :
                       data.mimetype.startsWith('audio/') ? 'audio' : 'video';
      return reply.status(413).send({
        statusCode: 413,
        error: 'Payload Too Large',
        message: `File size ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB for ${fileType}. (Configurable in System Settings)`
      });
    }

    // Check available disk space before accepting upload
    // Use 2x file size as safety margin (processed files may be larger before compression)
    const basePath = getAssetBasePath();
    const diskCheck = await checkDiskSpace(basePath, fileBuffer.length * 2);
    if (!diskCheck.available) {
      return reply.status(507).send({
        statusCode: 507,
        error: 'Insufficient Storage',
        message: `Not enough disk space available. Required: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB, Available: ${(diskCheck.freeBytes / 1024 / 1024).toFixed(2)}MB`
      });
    }

    // Game lookup
    let game: { id: string; slug: string; name: string } | null = null;

    if (gameId) {
      // Try by ID first
      const gameById = sqlite.prepare('SELECT id, slug, name FROM games WHERE id = ?').get(gameId) as { id: string; slug: string; name: string } | undefined;

      // Try by slug if not found
      if (gameById) {
        game = gameById;
      } else {
        const gameBySlug = sqlite.prepare('SELECT id, slug, name FROM games WHERE slug = ?').get(gameId) as { id: string; slug: string; name: string } | undefined;
        if (gameBySlug) {
          game = gameBySlug;
        }
      }

      if (!game) {
        return reply.status(404).send({ statusCode: 404, message: `Game not found: ${gameId}` });
      }
    } else {
      // Shared/System asset - use virtual game object for naming
      game = { id: '', slug: 'shared', name: 'Shared Assets' };
    }

    // Get puzzle details if needed
    let puzzle: { id: string; slug: string; title: string } | undefined;
    if (puzzleId) {
      puzzle = sqlite.prepare('SELECT id, slug, title FROM game_puzzles WHERE id = ?').get(puzzleId) as { id: string; slug: string; title: string } | undefined;
      if (!puzzle) {
        return reply.status(404).send({ statusCode: 404, message: 'Puzzle not found' });
      }
    }

    // Generate filename
    const extension = getExtensionFromMime(data.mimetype);
    const filename = generateAssetFilename({
      gameSlug: game.slug || slugify(game.name),
      puzzleSlug: puzzle?.slug || (puzzle ? slugify(puzzle.title) : undefined),
      assetType,
      mediaType,
      order: order ? parseInt(String(order), 10) : undefined,
      extension
    });

    // Get storage paths
    const subPath = getAssetSubPath(assetType, mediaType);
    const basePath = getAssetBasePath();
    const fullPath = path.join(basePath, subPath, filename);

    // Ensure directory exists
    const fs = await import('node:fs/promises');
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Process and save file
    const processed = await processFile(fileBuffer, fullPath, data.mimetype);

    // Create database record
    const assetId = crypto.randomUUID();
    const assetRecord: AssetRecord = {
      id: assetId,
      filename,
      original_filename: originalFilename,
      mime_type: data.mimetype,
      size_bytes: processed.size,
      asset_type: assetType,
      media_type: mediaType || null,
      file_path: path.join(subPath, filename),
      game_id: game.id || null,
      puzzle_id: puzzleId || null,
      hint_order: order ? parseInt(String(order), 10) : null,
      // Mark as reusable if: system_audio, no game (shared), or explicitly flagged
      is_reusable: (assetType === 'system_audio' || !game.id || isReusable) ? 1 : 0,
      uploaded_by: session.user.id as string,
      uploaded_at: new Date().toISOString(),
      metadata: JSON.stringify(processed.metadata)
    };

    // Insert into database
    const stmt = sqlite.prepare(`
      INSERT INTO assets (
        id, filename, original_filename, mime_type, size_bytes,
        asset_type, media_type, file_path, game_id, puzzle_id,
        hint_order, is_reusable, uploaded_by, uploaded_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      assetRecord.id,
      assetRecord.filename,
      assetRecord.original_filename,
      assetRecord.mime_type,
      assetRecord.size_bytes,
      assetRecord.asset_type,
      assetRecord.media_type,
      assetRecord.file_path,
      assetRecord.game_id,
      assetRecord.puzzle_id,
      assetRecord.hint_order,
      assetRecord.is_reusable,
      assetRecord.uploaded_by,
      assetRecord.uploaded_at,
      assetRecord.metadata
    );

    // Update storage metrics (async, don't wait)
    updateStorageMetrics().catch(err => {
      request.log.error({ err }, 'Failed to update storage metrics');
    });

    // Return success response
    return {
      success: true,
      asset: {
        id: assetRecord.id,
        filename: assetRecord.filename,
        url: `/assets/${assetRecord.file_path}`,
        size: assetRecord.size_bytes,
        mimeType: assetRecord.mime_type,
        metadata: processed.metadata
      }
    };

  } catch (error) {
    request.log.error({ err: error }, 'Failed to upload asset');

    // Cleanup uploaded file if processing failed
    try {
      await fs.unlink(fullPath);
    } catch {
      // File might not exist yet, ignore cleanup errors
    }

    // Return 400 for client errors (bad file format, validation failures)
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('validation failed') ||
        errorMessage.includes('FFprobe') ||
        errorMessage.includes('not installed')) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: errorMessage
      });
    }

    // Return 500 for server errors
    return reply.status(500).send({
      statusCode: 500,
      message: 'Failed to upload asset',
      error: errorMessage
    });
  }
}

/**
 * Update storage metrics in database
 */
async function updateStorageMetrics() {
  const assets = sqlite.prepare('SELECT asset_type, size_bytes, game_id, file_path FROM assets').all() as Array<{
    asset_type: string;
    size_bytes: number;
    game_id: string | null;
    file_path: string;
  }>;

  const byType: Record<string, { count: number; size: number }> = {
    images: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
    video: { count: 0, size: 0 }
  };

  const byGame: Record<string, { count: number; size: number }> = {};

  for (const asset of assets) {
    const category = asset.file_path.split('/')[0]; // images/audio/video
    if (byType[category]) {
      byType[category].count++;
      byType[category].size += asset.size_bytes;
    }

    if (asset.game_id) {
      if (!byGame[asset.game_id]) {
        byGame[asset.game_id] = { count: 0, size: 0 };
      }
      byGame[asset.game_id].count++;
      byGame[asset.game_id].size += asset.size_bytes;
    }
  }

  const totalSize = Object.values(byType).reduce((sum, t) => sum + t.size, 0);
  const totalFiles = Object.values(byType).reduce((sum, t) => sum + t.count, 0);

  // Get last backup date
  const { getLastBackupDate } = await import('../system/backup.js');
  const lastBackupAt = await getLastBackupDate();

  // Insert new metrics record
  const stmt = sqlite.prepare(`
    INSERT INTO storage_metrics (total_size_bytes, total_files, by_type, by_game, last_backup_at, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    totalSize,
    totalFiles,
    JSON.stringify(byType),
    JSON.stringify(byGame),
    lastBackupAt,
    new Date().toISOString()
  );
}

/**
 * Scan filesystem for orphaned asset files (exist on disk but not in database)
 */
async function scanOrphanedFiles(): Promise<{ totalFiles: number; totalBytes: number }> {
  const basePath = getAssetBasePath();

  let orphanedFiles = 0;
  let orphanedBytes = 0;

  try {
    // Get all assets from database
    const dbAssets = sqlite.prepare('SELECT file_path, filename FROM assets').all() as Array<{ file_path: string; filename: string }>;
    const dbFilePaths = new Set(dbAssets.map(a => a.file_path));

    // Scan each asset subdirectory
    const subdirs = ['images', 'audio', 'video'];
    for (const subdir of subdirs) {
      const dirPath = path.join(basePath, subdir);
      try {
        // Recursively scan subdirectories
        const scanDir = async (dir: string, prefix: string = '') => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
            const dbPath = path.join(subdir, relativePath);

            if (entry.isDirectory()) {
              await scanDir(fullPath, relativePath);
            } else if (entry.isFile()) {
              // Check if file exists in database
              if (!dbFilePaths.has(dbPath)) {
                const stats = await fs.stat(fullPath);
                orphanedFiles++;
                orphanedBytes += stats.size;
              }
            }
          }
        };

        await scanDir(dirPath);
      } catch (error) {
        // Directory doesn't exist or can't be read, skip
        console.warn(`Failed to scan ${dirPath}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to scan orphaned files:', error);
  }

  return { totalFiles: orphanedFiles, totalBytes: orphanedBytes };
}

/**
 * Get storage metrics
 * Returns system disk usage + database size + backup metrics + asset-level metrics
 */
export async function getStorageMetrics() {
  // Get system disk usage
  let systemDisk = {
    totalBytes: 0,
    usedBytes: 0,
    availableBytes: 0
  };

  try {
    const dataDir = path.resolve('./data');
    const stats = await fs.statfs(dataDir);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const availableBytes = Number(stats.bavail) * Number(stats.bsize);
    const usedBytes = totalBytes - availableBytes;

    systemDisk = {
      totalBytes,
      usedBytes,
      availableBytes
    };
  } catch (error) {
    console.error('Failed to get system disk stats:', error);
    // Return fallback values on error
    systemDisk = {
      totalBytes: 68719476736, // 64 GB fallback
      usedBytes: 0,
      availableBytes: 68719476736
    };
  }

  // Get database file sizes (active + backups)
  let databaseActive = 0;
  let databaseBackups = 0;
  let backupCount = 0;

  try {
    const dbPath = path.resolve('./data/escapeplan.db');
    const dbStats = await fs.stat(dbPath);
    databaseActive = dbStats.size;
  } catch (error) {
    console.error('Failed to get database size:', error);
  }

  // Count completed backups
  try {
    const completedBackups = await db.select().from(backups).where(eq(backups.status, 'completed'));
    backupCount = completedBackups.length;
    databaseBackups = completedBackups.reduce((sum, b) => sum + (b.file_size_bytes || 0), 0);
  } catch (error) {
    console.error('Failed to get backup stats:', error);
  }

  // Get asset metrics
  const latest = sqlite.prepare('SELECT * FROM storage_metrics ORDER BY recorded_at DESC LIMIT 1').get() as {
    total_size_bytes: number;
    total_files: number;
    by_type: string;
    by_game: string;
    last_backup_at: string | null;
    recorded_at: string;
  } | undefined;

  if (!latest) {
    // No metrics yet, compute fresh and store
    try {
      await updateStorageMetrics();
      // Fetch the newly created record instead of recursing
      const newLatest = sqlite.prepare('SELECT * FROM storage_metrics ORDER BY recorded_at DESC LIMIT 1').get() as {
        total_size_bytes: number;
        total_files: number;
        by_type: string;
        by_game: string;
        last_backup_at: string | null;
        recorded_at: string;
      } | undefined;

      if (!newLatest) {
        // Return minimal response if still no data
        return {
          total: systemDisk,
          database: {
            activeSizeBytes: databaseActive,
            backupsSizeBytes: databaseBackups,
            backupCount: backupCount
          },
          byType: {
            images: { totalFiles: 0, totalBytes: 0 },
            videos: { totalFiles: 0, totalBytes: 0 },
            audio: { totalFiles: 0, totalBytes: 0 }
          },
          byGame: [],
          lastBackupAt: null
        };
      }
      // Continue with the new record
      const byType = JSON.parse(newLatest.by_type);

      return {
        total: systemDisk,
        database: {
          activeSizeBytes: databaseActive,
          backupsSizeBytes: databaseBackups,
          backupCount: backupCount
        },
        byType: {
          images: { totalFiles: byType.images?.count || 0, totalBytes: byType.images?.size || 0 },
          videos: { totalFiles: byType.video?.count || 0, totalBytes: byType.video?.size || 0 },
          audio: { totalFiles: byType.audio?.count || 0, totalBytes: byType.audio?.size || 0 }
        },
        byGame: [],
        lastBackupAt: newLatest.last_backup_at
      };
    } catch (error) {
      console.error('Failed to update storage metrics:', error);
      // Return minimal response on error
      return {
        total: systemDisk,
        database: {
          activeSizeBytes: databaseActive,
          backupsSizeBytes: databaseBackups,
          backupCount: backupCount
        },
        byType: {
          images: { totalFiles: 0, totalBytes: 0 },
          videos: { totalFiles: 0, totalBytes: 0 },
          audio: { totalFiles: 0, totalBytes: 0 }
        },
        byGame: [],
        lastBackupAt: null
      };
    }
  }

  const byType = JSON.parse(latest.by_type);
  const byGame = JSON.parse(latest.by_game);

  // Get game names for by_game data + count orphaned assets in database
  const gameIds = Object.keys(byGame);
  const gamesData: Array<{ gameName: string | null; totalFiles: number; totalBytes: number }> = [];

  // Count orphaned assets (no game_id in database)
  const allAssets = sqlite.prepare('SELECT * FROM assets').all() as Array<{ game_id: string | null; size_bytes: number }>;
  const orphanedDbAssets = allAssets.filter(a => !a.game_id);
  const orphanedDbCount = orphanedDbAssets.length;
  const orphanedDbSize = orphanedDbAssets.reduce((sum, a) => sum + a.size_bytes, 0);

  for (const gameId of gameIds) {
    const game = sqlite.prepare('SELECT name FROM games WHERE id = ?').get(gameId) as { name: string } | undefined;
    gamesData.push({
      gameName: game?.name || null,
      totalFiles: byGame[gameId].count,
      totalBytes: byGame[gameId].size
    });
  }

  // Scan filesystem for orphaned files (not in database at all)
  const orphanedFs = await scanOrphanedFiles();

  // Add orphaned database assets if any exist
  if (orphanedDbCount > 0) {
    gamesData.push({
      gameName: '(Unassigned Assets)',
      totalFiles: orphanedDbCount,
      totalBytes: orphanedDbSize
    });
  }

  // Add orphaned filesystem files if any exist
  if (orphanedFs.totalFiles > 0) {
    gamesData.push({
      gameName: '(Ghost Files - Not in DB)',
      totalFiles: orphanedFs.totalFiles,
      totalBytes: orphanedFs.totalBytes
    });
  }

  // Return format for frontend (total = system disk, separate db and assets)
  return {
    total: systemDisk,
    database: {
      activeSizeBytes: databaseActive,
      backupsSizeBytes: databaseBackups,
      backupCount: backupCount
    },
    byType: {
      images: {
        totalFiles: byType.images?.count || 0,
        totalBytes: byType.images?.size || 0
      },
      videos: {
        totalFiles: byType.video?.count || 0,
        totalBytes: byType.video?.size || 0
      },
      audio: {
        totalFiles: byType.audio?.count || 0,
        totalBytes: byType.audio?.size || 0
      }
    },
    byGame: gamesData,
    lastBackupAt: latest.last_backup_at
  };
}

/**
 * Delete asset and its file
 */
export async function deleteAsset(assetId: string, _userId: string, _userRole: string) {
  const asset = sqlite.prepare('SELECT * FROM assets WHERE id = ?').get(assetId) as AssetRecord | undefined;

  if (!asset) {
    throw new Error('Asset not found');
  }

  // Delete file from filesystem
  const basePath = getAssetBasePath();
  const fullPath = path.join(basePath, asset.file_path);

  const fs = await import('node:fs/promises');
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    // File might already be deleted, log but continue
    console.error(`Failed to delete file ${fullPath}:`, err);
  }

  // Delete from database
  sqlite.prepare('DELETE FROM assets WHERE id = ?').run(assetId);

  // Update metrics
  await updateStorageMetrics();

  return { success: true };
}

/**
 * Get single asset by ID
 */
export async function getAssetById(assetId: string) {
  const asset = sqlite.prepare('SELECT * FROM assets WHERE id = ?').get(assetId) as AssetRecord | undefined;

  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    filename: asset.filename,
    originalFilename: asset.original_filename,
    mimeType: asset.mime_type,
    sizeBytes: asset.size_bytes,
    assetType: asset.asset_type,
    mediaType: asset.media_type,
    url: `/assets/${asset.file_path}`,
    gameId: asset.game_id,
    puzzleId: asset.puzzle_id,
    hintOrder: asset.hint_order,
    isReusable: Boolean(asset.is_reusable),
    uploadedBy: asset.uploaded_by,
    uploadedAt: asset.uploaded_at,
    metadata: asset.metadata ? JSON.parse(asset.metadata) : null
  };
}

/**
 * List assets with filters
 */
export async function listAssets(filters?: {
  gameId?: string;
  assetType?: string;
  mediaType?: string;
  isReusable?: boolean;
  search?: string;
}) {
  let query = 'SELECT * FROM assets WHERE 1=1';
  const params: any[] = [];

  if (filters?.gameId) {
    // Resolve gameId - could be UUID or slug
    let resolvedGameId: string = filters.gameId;

    // Check if it's NOT a UUID (UUIDs are 36 chars with specific pattern)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(filters.gameId)) {
      // It's likely a slug, resolve to UUID
      const game = sqlite.prepare('SELECT id FROM games WHERE slug = ?').get(filters.gameId) as { id: string } | undefined;
      if (game) {
        resolvedGameId = game.id;
      }
    }

    query += ' AND (game_id = ? OR is_reusable = 1)';
    params.push(resolvedGameId);
  }

  if (filters?.assetType) {
    query += ' AND asset_type = ?';
    params.push(filters.assetType);
  }

  if (filters?.mediaType) {
    query += ' AND media_type = ?';
    params.push(filters.mediaType);
  }

  if (filters?.isReusable !== undefined) {
    query += ' AND is_reusable = ?';
    params.push(filters.isReusable ? 1 : 0);
  }

  if (filters?.search) {
    query += ' AND (filename LIKE ? OR original_filename LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += ' ORDER BY uploaded_at DESC';

  const assets = sqlite.prepare(query).all(...params) as AssetRecord[];

  return assets.map(asset => ({
    id: asset.id,
    filename: asset.filename,
    originalFilename: asset.original_filename,
    mimeType: asset.mime_type,
    sizeBytes: asset.size_bytes,
    assetType: asset.asset_type,
    mediaType: asset.media_type,
    url: `/assets/${asset.file_path}`,
    gameId: asset.game_id,
    puzzleId: asset.puzzle_id,
    hintOrder: asset.hint_order,
    isReusable: Boolean(asset.is_reusable),
    uploadedBy: asset.uploaded_by,
    uploadedAt: asset.uploaded_at,
    metadata: asset.metadata ? JSON.parse(asset.metadata) : null
  }));
}

/**
 * Link reusable asset to a game
 */
export async function linkReusableAsset(params: {
  assetId: string;
  gameId: string;
  usageType: 'thumbnail' | 'room_bg' | 'gallery' | 'puzzle' | 'hint';
  puzzleId?: string;
}) {
  const { assetId, gameId, usageType, puzzleId } = params;

  // Verify asset exists and is reusable
  const asset = sqlite.prepare('SELECT * FROM assets WHERE id = ?').get(assetId) as AssetRecord | undefined;
  if (!asset) {
    throw new Error('Asset not found');
  }

  if (!asset.is_reusable) {
    throw new Error('Asset is not marked as reusable');
  }

  // Verify game exists
  const game = sqlite.prepare('SELECT id FROM games WHERE id = ?').get(gameId) as { id: string } | undefined;
  if (!game) {
    throw new Error('Game not found');
  }

  // Create usage record
  const usageId = crypto.randomUUID();
  sqlite.prepare(`
    INSERT INTO asset_usage (id, asset_id, used_in_game_id, used_in_puzzle_id, usage_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(usageId, assetId, gameId, puzzleId || null, usageType, new Date().toISOString());

  return {
    success: true,
    usage: {
      id: usageId,
      assetId,
      gameId,
      puzzleId: puzzleId || null,
      usageType
    }
  };
}
