import path from 'node:path';
import { sqlite } from '../db/client.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  getAssetBasePath,
  getAssetSubPath,
  generateAssetFilename,
  getAllowedMimeTypes,
  getMaxFileSize,
  getExtensionFromMime,
  slugify
} from './paths.js';
import { processFile } from './processing.js';
import { requireSession } from '../auth.js';

export interface UploadAssetQuery {
  gameId: string;
  assetType: 'thumbnail' | 'room_background' | 'gallery' | 'puzzle_media' | 'hint_media';
  puzzleId?: string;
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
 * Handle asset upload
 */
export async function handleAssetUpload(request: FastifyRequest, reply: FastifyReply) {
  // Authenticate user
  const session = await requireSession(request.headers);
  if (!session) {
    return reply.status(401).send({ statusCode: 401, message: 'Authentication required' });
  }

  // Check permissions (manage_games permission required)
  if (session.user.role !== 'admin' && !session.user.permissions?.includes('manage_games')) {
    return reply.status(403).send({ statusCode: 403, message: 'Permission denied' });
  }

  // Parse query params
  const query = request.query as UploadAssetQuery;
  const { gameId, assetType, puzzleId, mediaType, order, isReusable } = query;

  // Validate required params
  if (!gameId || !assetType) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'gameId and assetType are required'
    });
  }

  // Validate hint_media requires mediaType
  if (assetType === 'hint_media' && !mediaType) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'mediaType is required for hint_media'
    });
  }

  // Get the uploaded file
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ statusCode: 400, message: 'No file uploaded' });
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

    // Validate file size
    const maxSize = getMaxFileSize(assetType, mediaType);
    const fileBuffer = await data.toBuffer();
    if (fileBuffer.length > maxSize) {
      return reply.status(400).send({
        statusCode: 400,
        message: `File too large. Max size: ${Math.round(maxSize / 1024 / 1024)}MB`
      });
    }

    // Get game details for slug
    const game = sqlite.prepare('SELECT id, slug, name FROM games WHERE id = ?').get(gameId) as { id: string; slug: string; name: string } | undefined;
    if (!game) {
      return reply.status(404).send({ statusCode: 404, message: 'Game not found' });
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
    const processed = await processFile(data, fullPath, data.mimetype);

    // Create database record
    const assetId = crypto.randomUUID();
    const assetRecord: AssetRecord = {
      id: assetId,
      filename,
      original_filename: data.filename,
      mime_type: data.mimetype,
      size_bytes: processed.size,
      asset_type: assetType,
      media_type: mediaType || null,
      file_path: path.join(subPath, filename),
      game_id: isReusable ? null : gameId,
      puzzle_id: puzzleId || null,
      hint_order: order ? parseInt(String(order), 10) : null,
      is_reusable: isReusable ? 1 : 0,
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
    return reply.status(500).send({
      statusCode: 500,
      message: 'Failed to upload asset',
      error: (error as Error).message
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

  // Insert new metrics record
  const stmt = sqlite.prepare(`
    INSERT INTO storage_metrics (total_size_bytes, total_files, by_type, by_game, recorded_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    totalSize,
    totalFiles,
    JSON.stringify(byType),
    JSON.stringify(byGame),
    new Date().toISOString()
  );
}

/**
 * Get storage metrics
 */
export async function getStorageMetrics() {
  const latest = sqlite.prepare('SELECT * FROM storage_metrics ORDER BY recorded_at DESC LIMIT 1').get() as {
    total_size_bytes: number;
    total_files: number;
    by_type: string;
    by_game: string;
    last_backup_at: string | null;
    recorded_at: string;
  } | undefined;

  if (!latest) {
    // No metrics yet, compute fresh
    await updateStorageMetrics();
    return getStorageMetrics();
  }

  const byType = JSON.parse(latest.by_type);
  const byGame = JSON.parse(latest.by_game);

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Get game names for by_game data
  const gameIds = Object.keys(byGame);
  const gamesData: Array<{ id: string; name: string; count: number; size: number; sizeFormatted: string }> = [];

  for (const gameId of gameIds) {
    const game = sqlite.prepare('SELECT name FROM games WHERE id = ?').get(gameId) as { name: string } | undefined;
    if (game) {
      gamesData.push({
        id: gameId,
        name: game.name,
        count: byGame[gameId].count,
        size: byGame[gameId].size,
        sizeFormatted: formatBytes(byGame[gameId].size)
      });
    }
  }

  return {
    total: {
      size: latest.total_size_bytes,
      files: latest.total_files,
      sizeFormatted: formatBytes(latest.total_size_bytes)
    },
    byType: {
      images: {
        count: byType.images?.count || 0,
        size: byType.images?.size || 0,
        sizeFormatted: formatBytes(byType.images?.size || 0)
      },
      audio: {
        count: byType.audio?.count || 0,
        size: byType.audio?.size || 0,
        sizeFormatted: formatBytes(byType.audio?.size || 0)
      },
      video: {
        count: byType.video?.count || 0,
        size: byType.video?.size || 0,
        sizeFormatted: formatBytes(byType.video?.size || 0)
      }
    },
    byGame: gamesData,
    lastBackup: latest.last_backup_at,
    recordedAt: latest.recorded_at
  };
}

/**
 * Delete asset and its file
 */
export async function deleteAsset(assetId: string, userId: string, userRole: string) {
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
    query += ' AND (game_id = ? OR is_reusable = 1)';
    params.push(filters.gameId);
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
