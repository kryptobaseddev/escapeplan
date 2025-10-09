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
export const DEFAULT_GITHUB_REPO = 'kryptobaseddev/escapeplan';

/** Default auto-update setting */
export const DEFAULT_AUTO_UPDATE_ENABLED = true;

/** Default system volume (0-100) */
export const DEFAULT_SYSTEM_VOLUME = 80;

/** Business defaults for game configuration */
export const BUSINESS_DEFAULTS = {
  /** Minimum game duration in minutes */
  GAME_DURATION_MIN_MINUTES: 30,
  /** Maximum game duration in minutes */
  GAME_DURATION_MAX_MINUTES: 240,
  /** Default cancellation policy template */
  DEFAULT_CANCELLATION_POLICY: 'Cancellations made 48 hours or more in advance will receive a full refund. Cancellations made within 48 hours are non-refundable but may be rescheduled subject to availability.',
  /** Default booking buffer time in minutes */
  DEFAULT_BOOKING_BUFFER_MINUTES: 15,
  /** Default booking window in days */
  DEFAULT_BOOKING_WINDOW_DAYS: 90,
  /** Default text hint sound asset ID */
  DEFAULT_TEXT_HINT_SOUND_ASSET_ID: null as string | null,
  /** Default text hint duration in seconds */
  DEFAULT_TEXT_HINT_DURATION_SECONDS: 60
} as const;

/** User validation defaults */
export const USER_VALIDATION_DEFAULTS = {
  /** Email field required for user creation */
  EMAIL_REQUIRED: true,
  /** Minimum password length */
  PASSWORD_MIN_LENGTH: 12,
  /** Maximum password length */
  PASSWORD_MAX_LENGTH: 128,
  /** Auto-capitalize display name */
  CAPITALIZE_DISPLAY_NAME: true,
  /** Default role for new users */
  DEFAULT_ROLE: 'game_master'
} as const;

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
  /** Business defaults */
  BUSINESS: {
    GAME_DURATION_MIN_MINUTES: 'business.game_duration_min_minutes',
    GAME_DURATION_MAX_MINUTES: 'business.game_duration_max_minutes',
    DEFAULT_CANCELLATION_POLICY: 'business.default_cancellation_policy',
    DEFAULT_BOOKING_BUFFER_MINUTES: 'business.default_booking_buffer_minutes',
    DEFAULT_BOOKING_WINDOW_DAYS: 'business.default_booking_window_days',
    DEFAULT_TEXT_HINT_SOUND_ASSET_ID: 'business.default_text_hint_sound_asset_id',
    DEFAULT_TEXT_HINT_DURATION_SECONDS: 'business.default_text_hint_duration_seconds'
  },
  /** User validation settings */
  USER_VALIDATION: {
    EMAIL_REQUIRED: 'user_validation.email_required',
    PASSWORD_MIN_LENGTH: 'user_validation.password_min_length',
    PASSWORD_MAX_LENGTH: 'user_validation.password_max_length',
    CAPITALIZE_DISPLAY_NAME: 'user_validation.capitalize_display_name',
    DEFAULT_ROLE: 'user_validation.default_role'
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
  BUSINESS: 'business',
  USER_VALIDATION: 'user_validation',
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
