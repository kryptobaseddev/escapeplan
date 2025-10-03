import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Get the base path for asset storage
 * - Development: {project}/apps/escapeplan-api/data/assets
 * - Production: /var/lib/escapeplan/assets
 */
export function getAssetBasePath(): string {
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
  return isDev
    ? path.join(process.cwd(), 'data', 'assets')
    : '/var/lib/escapeplan/assets';
}

/**
 * Get subdirectory path for asset type
 */
export function getAssetSubPath(assetType: string, mediaType?: string): string {
  switch (assetType) {
    case 'thumbnail':
      return 'images/thumbnails';
    case 'room_background':
      return 'images/room-backgrounds';
    case 'gallery':
      return 'images/gallery';
    case 'puzzle_media':
      return 'images/puzzle-media';
    case 'hint_media':
      if (mediaType === 'image') return 'images/hint-media';
      if (mediaType === 'audio') return 'audio/hint-media';
      if (mediaType === 'video') return 'video/hint-media';
      return 'images/hint-media'; // Default fallback
    case 'milestone_media':
      if (mediaType === 'image') return 'images/milestone-media';
      if (mediaType === 'audio') return 'audio/milestone-media';
      if (mediaType === 'video') return 'video/milestone-media';
      return 'images/milestone-media'; // Default fallback
    default:
      throw new Error(`Unknown asset type: ${assetType}`);
  }
}

/**
 * Normalize a string to slug format (lowercase, hyphens, no special chars)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '-')  // Replace spaces, underscores, multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Generate filename for asset
 */
export function generateAssetFilename(params: {
  gameSlug: string;
  puzzleSlug?: string;
  assetType: string;
  mediaType?: string;
  order?: number;
  extension: string;
}): string {
  const { gameSlug, puzzleSlug, assetType, mediaType, order, extension } = params;
  const uuid = crypto.randomUUID().slice(0, 8); // Short UUID

  // For hint media
  if (assetType === 'hint_media' && puzzleSlug && mediaType) {
    const orderStr = order ? `-${order}` : '';
    return `${gameSlug}-${puzzleSlug}-hint-${mediaType}${orderStr}-${uuid}.${extension}`;
  }

  // For milestone media
  if (assetType === 'milestone_media' && mediaType) {
    return `${gameSlug}-milestone-${mediaType}-${uuid}.${extension}`;
  }

  // For gallery (numbered)
  if (assetType === 'gallery' && order) {
    return `${gameSlug}-gallery-${order}-${uuid}.${extension}`;
  }

  // For other types
  const typeSlug = assetType.replace('_', '-');
  return `${gameSlug}-${typeSlug}-${uuid}.${extension}`;
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
  };

  return mimeMap[mimeType] || 'bin';
}

/**
 * Get allowed MIME types for asset type
 */
export function getAllowedMimeTypes(assetType: string, mediaType?: string): string[] {
  if (assetType === 'hint_media' || assetType === 'milestone_media') {
    if (mediaType === 'image') {
      return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    }
    if (mediaType === 'audio') {
      return ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
    }
    if (mediaType === 'video') {
      return ['video/mp4', 'video/webm', 'video/ogg'];
    }
  }

  // Images for thumbnails, room backgrounds, gallery, puzzle media
  if (['thumbnail', 'room_background', 'gallery', 'puzzle_media'].includes(assetType)) {
    return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  }

  return [];
}

/**
 * Get max file size in bytes for asset type
 */
export function getMaxFileSize(assetType: string, mediaType?: string): number {
  const IMAGE_MAX = parseInt(process.env.MAX_IMAGE_SIZE_MB || '10', 10) * 1024 * 1024;
  const AUDIO_MAX = parseInt(process.env.MAX_AUDIO_SIZE_MB || '25', 10) * 1024 * 1024;
  const VIDEO_MAX = parseInt(process.env.MAX_VIDEO_SIZE_MB || '50', 10) * 1024 * 1024;

  if (assetType === 'hint_media' || assetType === 'milestone_media') {
    if (mediaType === 'image') return IMAGE_MAX;
    if (mediaType === 'audio') return AUDIO_MAX;
    if (mediaType === 'video') return VIDEO_MAX;
  }

  // All non-hint assets are images
  return IMAGE_MAX;
}

/**
 * Ensure asset directory exists
 */
export async function ensureAssetDirectory(assetType: string, mediaType?: string): Promise<string> {
  const basePath = getAssetBasePath();
  const subPath = getAssetSubPath(assetType, mediaType);
  const fullPath = path.join(basePath, subPath);

  await fs.mkdir(fullPath, { recursive: true });

  return fullPath;
}

/**
 * Get the base path for backups
 * - Development: {project}/apps/escapeplan-api/data/backups
 * - Production: /var/backups/escapeplan
 */
export function getBackupBasePath(): string {
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
  return isDev
    ? path.join(process.cwd(), 'data', 'backups')
    : '/var/backups/escapeplan';
}

/**
 * Get the database file path
 * - Development: {project}/apps/escapeplan-api/data/escapeplan.db
 * - Production: /var/lib/escapeplan/data/escapeplan.db
 */
export function getDatabasePath(): string {
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
  return isDev
    ? path.join(process.cwd(), 'data', 'escapeplan.db')
    : '/var/lib/escapeplan/data/escapeplan.db';
}

/**
 * Ensure backup directory exists
 */
export async function ensureBackupDirectory(): Promise<string> {
  const backupPath = getBackupBasePath();
  await fs.mkdir(backupPath, { recursive: true });
  return backupPath;
}
