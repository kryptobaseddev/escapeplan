/**
 * Universal Application Constants
 *
 * These constants can be used in both Node.js (API) and browser (Web) contexts.
 * DO NOT import Node.js APIs here (fs, path, etc.)
 */

/** Default port for API server */
export const DEFAULT_API_PORT = 4000;

/** Default port for SvelteKit dev server */
export const DEFAULT_WEB_PORT = 5173;

/** Production domain (mDNS address) */
export const PRODUCTION_DOMAIN = 'escapeplan.local';

/** API base path (appended to domain) */
export const API_BASE_PATH = '/api';

/** Default authentication path */
export const AUTH_PATH = '/api/auth';

/** Default file size limits (in MB) */
export const DEFAULT_FILE_SIZE_LIMITS = {
  /** Maximum image file size in MB */
  IMAGE_MB: 10,
  /** Maximum audio file size in MB */
  AUDIO_MB: 25,
  /** Maximum video file size in MB */
  VIDEO_MB: 50
} as const;

/** Default backup retention period (in days) */
export const DEFAULT_BACKUP_RETENTION_DAYS = 7;

/** Default GitHub repository for updates */
export const DEFAULT_GITHUB_REPO = 'escapeplan/escapeplan';

/** Default auto-update setting */
export const DEFAULT_AUTO_UPDATE_ENABLED = true;

/** Default system volume (0-100) */
export const DEFAULT_SYSTEM_VOLUME = 80;

/** Application name */
export const APP_NAME = 'EscapePlan';

/** Application version (fallback if package.json can't be read) */
export const FALLBACK_VERSION = '0.1.0';

/** mDNS service name */
export const MDNS_SERVICE_NAME = 'escapeplan';

/** Default network subnet */
export const DEFAULT_NETWORK_SUBNET = '10.10.10.0/24';

/** Default router IP */
export const DEFAULT_ROUTER_IP = '10.10.10.1';

/** System setting keys (for type-safe access) */
export const SETTING_KEYS = {
  /** Storage settings */
  STORAGE: {
    MAX_IMAGE_SIZE_MB: 'storage.max_image_size_mb',
    MAX_AUDIO_SIZE_MB: 'storage.max_audio_size_mb',
    MAX_VIDEO_SIZE_MB: 'storage.max_video_size_mb'
  },
  /** Backup settings */
  BACKUP: {
    RETENTION_DAYS: 'backup.retention_days'
  },
  /** Update settings */
  UPDATES: {
    GITHUB_REPO: 'updates.github_repo',
    AUTO_UPDATE_ENABLED: 'updates.auto_update_enabled'
  },
  /** System information (read-only) */
  SYSTEM: {
    INSTALL_PATH: 'system.install_path',
    VERSION: 'system.version',
    BUILD_DATE: 'system.build_date'
  }
} as const;

/** Setting categories for UI grouping */
export const SETTING_CATEGORIES = {
  STORAGE: 'storage',
  BACKUP: 'backup',
  UPDATES: 'updates',
  SYSTEM: 'system',
  GENERAL: 'general'
} as const;

export type SettingCategory = typeof SETTING_CATEGORIES[keyof typeof SETTING_CATEGORIES];

/** Setting types for validation */
export const SETTING_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json'
} as const;

export type SettingType = typeof SETTING_TYPES[keyof typeof SETTING_TYPES];
