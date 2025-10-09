/**
 * Dynamic Path Resolution - NO Environment Variables Required!
 *
 * All paths are automatically determined based on runtime environment detection.
 * This module is Node.js ONLY - do not import in browser/SvelteKit contexts!
 *
 * Moved from apps/escapeplan-api/src/assets/paths.ts to shared contracts package.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { runtime } from './runtime.js';

/**
 * Get the base path for asset storage
 * - Development: {cwd}/data/assets
 * - Production: /var/lib/escapeplan/assets
 */
export function getAssetBasePath(): string {
  return runtime.assetsDir;
}

/**
 * Get the base path for application data
 * - Development: {cwd}/data
 * - Production: /var/lib/escapeplan
 */
export function getDataBasePath(): string {
  return runtime.baseDir;
}

/**
 * Get the database file path
 * - Development: {cwd}/data/escapeplan.db
 * - Production: /var/lib/escapeplan/data/escapeplan.db
 */
export function getDatabasePath(): string {
  return path.join(runtime.dataDir, 'escapeplan.db');
}

/**
 * Get the base path for backups
 * - Development: {cwd}/data/backups
 * - Production: /var/backups/escapeplan
 */
export function getBackupBasePath(): string {
  return runtime.backupDir;
}

/**
 * Get subdirectory path for asset type
 */
export function getAssetSubPath(assetType: string, mediaType?: string): string {
  switch (assetType) {
    case 'system_audio':
      return 'audio/system';
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
  gameSlug: string | null;
  puzzleSlug?: string;
  assetType: string;
  mediaType?: string;
  order?: number;
  extension: string;
}): string {
  const { gameSlug, puzzleSlug, assetType, mediaType, order, extension } = params;
  const uuid = crypto.randomUUID().slice(0, 8); // Short UUID

  // Use 'system' prefix for null gameSlug or 'system' gameSlug
  const slug = gameSlug || 'system';

  // For hint media
  if (assetType === 'hint_media' && puzzleSlug && mediaType) {
    const orderStr = order ? `-${order}` : '';
    return `${slug}-${puzzleSlug}-hint-${mediaType}${orderStr}-${uuid}.${extension}`;
  }

  // For milestone media
  if (assetType === 'milestone_media' && mediaType) {
    return `${slug}-milestone-${mediaType}-${uuid}.${extension}`;
  }

  // For gallery (numbered)
  if (assetType === 'gallery' && order) {
    return `${slug}-gallery-${order}-${uuid}.${extension}`;
  }

  // For other types (including system_audio)
  const typeSlug = assetType.replace('_', '-');
  return `${slug}-${typeSlug}-${uuid}.${extension}`;
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
    'audio/mp4': 'm4a',
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
  // System audio only accepts audio types
  if (assetType === 'system_audio') {
    return ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm'];
  }

  if (assetType === 'hint_media' || assetType === 'milestone_media') {
    if (mediaType === 'image') {
      return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    }
    if (mediaType === 'audio') {
      return ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/ogg'];
    }
    if (mediaType === 'video') {
      return ['video/mp4', 'video/webm', 'video/ogg'];
    }
  }

  // Gallery supports all media types (images, audio, video)
  if (assetType === 'gallery') {
    return [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/webm', 'video/ogg'
    ];
  }

  // Images only for thumbnails, room backgrounds, puzzle media
  if (['thumbnail', 'room_background', 'puzzle_media'].includes(assetType)) {
    return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  }

  return [];
}

/**
 * Get max file size in bytes for asset type
 *
 * NOTE: This will be replaced with database-backed settings in the future.
 * For now, it uses hardcoded defaults. In API context, use the settings manager instead.
 */
export function getMaxFileSize(assetType: string, mediaType?: string): number {
  // These are FALLBACK values only
  // In the API, use settingsManager.get() instead
  const IMAGE_MAX = 10 * 1024 * 1024;  // 10 MB
  const AUDIO_MAX = 25 * 1024 * 1024;  // 25 MB
  const VIDEO_MAX = 50 * 1024 * 1024;  // 50 MB

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
 * Ensure backup directory exists
 */
export async function ensureBackupDirectory(): Promise<string> {
  const backupPath = getBackupBasePath();
  await fs.mkdir(backupPath, { recursive: true });
  return backupPath;
}

/**
 * Ensure data directory exists
 */
export async function ensureDataDirectory(): Promise<string> {
  const dataPath = runtime.dataDir;
  await fs.mkdir(dataPath, { recursive: true });
  return dataPath;
}

export function ensureDataDirectorySync(): string {
  const dataPath = runtime.dataDir;
  mkdirSync(dataPath, { recursive: true });
  return dataPath;
}
