/**
 * System Settings Manager - Database-backed runtime configuration
 *
 * Provides a cached, type-safe interface to system settings stored in the database.
 * Settings are loaded on startup and cached in memory for performance.
 */

import { db } from './db/client.js';
import { systemSettings } from '@escapeplan/contracts';
import {
  SETTING_KEYS,
  DEFAULT_FILE_SIZE_LIMITS,
  DEFAULT_BACKUP_RETENTION_DAYS,
  DEFAULT_GITHUB_REPO,
  DEFAULT_AUTO_UPDATE_ENABLED,
  BUSINESS_DEFAULTS,
  USER_VALIDATION_DEFAULTS,
  type SettingType,
  type SettingCategory,
  type SystemSettingKey,
  type SystemSettingValue
} from '@escapeplan/contracts';
import { eq } from 'drizzle-orm';
import { runtime } from '@escapeplan/contracts/runtime';

/** Default values for all settings (fallback if not in database) */
const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.STORAGE.MAX_IMAGE_SIZE_MB]: String(DEFAULT_FILE_SIZE_LIMITS.IMAGE_MB),
  [SETTING_KEYS.STORAGE.MAX_AUDIO_SIZE_MB]: String(DEFAULT_FILE_SIZE_LIMITS.AUDIO_MB),
  [SETTING_KEYS.STORAGE.MAX_VIDEO_SIZE_MB]: String(DEFAULT_FILE_SIZE_LIMITS.VIDEO_MB),
  [SETTING_KEYS.BACKUP.RETENTION_DAYS]: String(DEFAULT_BACKUP_RETENTION_DAYS),
  [SETTING_KEYS.UPDATES.GITHUB_REPO]: DEFAULT_GITHUB_REPO,
  [SETTING_KEYS.UPDATES.AUTO_UPDATE_ENABLED]: String(DEFAULT_AUTO_UPDATE_ENABLED),
  [SETTING_KEYS.BUSINESS.GAME_DURATION_MIN_MINUTES]: String(BUSINESS_DEFAULTS.GAME_DURATION_MIN_MINUTES),
  [SETTING_KEYS.BUSINESS.GAME_DURATION_MAX_MINUTES]: String(BUSINESS_DEFAULTS.GAME_DURATION_MAX_MINUTES),
  [SETTING_KEYS.BUSINESS.DEFAULT_CANCELLATION_POLICY]: BUSINESS_DEFAULTS.DEFAULT_CANCELLATION_POLICY,
  [SETTING_KEYS.BUSINESS.DEFAULT_BOOKING_BUFFER_MINUTES]: String(BUSINESS_DEFAULTS.DEFAULT_BOOKING_BUFFER_MINUTES),
  [SETTING_KEYS.BUSINESS.DEFAULT_BOOKING_WINDOW_DAYS]: String(BUSINESS_DEFAULTS.DEFAULT_BOOKING_WINDOW_DAYS),
  [SETTING_KEYS.USER_VALIDATION.EMAIL_REQUIRED]: String(USER_VALIDATION_DEFAULTS.EMAIL_REQUIRED),
  [SETTING_KEYS.USER_VALIDATION.PASSWORD_MIN_LENGTH]: String(USER_VALIDATION_DEFAULTS.PASSWORD_MIN_LENGTH),
  [SETTING_KEYS.USER_VALIDATION.PASSWORD_MAX_LENGTH]: String(USER_VALIDATION_DEFAULTS.PASSWORD_MAX_LENGTH),
  [SETTING_KEYS.USER_VALIDATION.CAPITALIZE_DISPLAY_NAME]: String(USER_VALIDATION_DEFAULTS.CAPITALIZE_DISPLAY_NAME),
  [SETTING_KEYS.USER_VALIDATION.DEFAULT_ROLE]: USER_VALIDATION_DEFAULTS.DEFAULT_ROLE,
  [SETTING_KEYS.SYSTEM.INSTALL_PATH]: process.cwd(),
  [SETTING_KEYS.SYSTEM.VERSION]: '0.1.0', // Will be overridden from package.json
  [SETTING_KEYS.SYSTEM.BUILD_DATE]: new Date().toISOString()
};

/**
 * Settings Manager with in-memory cache
 */
class SettingsManager {
  private cache = new Map<string, any>();
  private initialized = false;

  /**
   * Initialize settings manager by loading all settings from database
   * Call this during application startup
   */
  async init(): Promise<void> {
    if (this.initialized) {
      console.warn('[Settings] Already initialized, skipping');
      return;
    }

    try {
      const settings = await db.query.systemSettings.findMany();

      for (const setting of settings) {
        const parsedValue = this.parseValue(setting.value, setting.type as SettingType);
        this.cache.set(setting.key, parsedValue);
      }

      this.initialized = true;

      if (runtime.isDevelopment) {
        console.log(`[Settings] Loaded ${settings.length} settings from database`);
      }
    } catch (error) {
      console.error('[Settings] Failed to load settings:', error);
      // Continue with defaults
      this.initialized = true;
    }
  }

  /**
   * Get a setting value (type-safe)
   */
  get<K extends SystemSettingKey>(key: K): SystemSettingValue<K> {
    if (!this.initialized) {
      throw new Error('SettingsManager not initialized. Call init() first!');
    }

    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as SystemSettingValue<K>;
    }

    // Fall back to default
    const defaultValue = DEFAULTS[key];
    if (defaultValue === undefined) {
      throw new Error(`Unknown setting key: ${key}`);
    }

    // Parse default value based on expected type
    return this.parseDefaultValue(key, defaultValue) as SystemSettingValue<K>;
  }

  /**
   * Update a setting value
   */
  async set<K extends SystemSettingKey>(
    key: K,
    value: SystemSettingValue<K>,
    updatedBy: string
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('SettingsManager not initialized. Call init() first!');
    }

    // Check if setting exists and is editable
    const existing = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, key)
    });

    if (!existing) {
      throw new Error(`Setting ${key} does not exist. Settings must be created via seed script.`);
    }

    if (!existing.is_editable) {
      throw new Error(`Setting ${key} is not editable`);
    }

    // Convert value to string for database storage
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Update database
    await db.update(systemSettings)
      .set({
        value: strValue,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      })
      .where(eq(systemSettings.key, key));

    // Update cache
    this.cache.set(key, value);

    if (runtime.isDevelopment) {
      console.log(`[Settings] Updated ${key} = ${strValue}`);
    }
  }

  /**
   * Reload all settings from database (clear cache and re-init)
   */
  async reload(): Promise<void> {
    this.cache.clear();
    this.initialized = false;
    await this.init();
  }

  /**
   * Get all settings grouped by category
   */
  async getAll(): Promise<Record<SettingCategory, Array<{
    key: string;
    value: any;
    label: string;
    description: string | null;
    type: SettingType;
    isEditable: boolean;
  }>>> {
    const settings = await db.query.systemSettings.findMany();

    const grouped: Record<SettingCategory, any[]> = {
      storage: [],
      backup: [],
      updates: [],
      business: [],
      user_validation: [],
      system: [],
      general: []
    };

    for (const setting of settings) {
      const parsedValue = this.parseValue(setting.value, setting.type as SettingType);

      grouped[setting.category as SettingCategory].push({
        key: setting.key,
        value: parsedValue,
        label: setting.label,
        description: setting.description,
        type: setting.type,
        isEditable: setting.is_editable
      });
    }

    return grouped;
  }

  /**
   * Parse string value based on type
   */
  private parseValue(value: string, type: SettingType): any {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'json':
        return JSON.parse(value);
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Parse default value based on key name patterns
   */
  private parseDefaultValue(key: string, value: string): any {
    if (key.includes('_mb') || key.includes('_days')) {
      return Number(value);
    }
    if (key.includes('_enabled')) {
      return value === 'true';
    }
    return value;
  }

  // ============================================================================
  // Convenience getters for common settings (cached, synchronous)
  // ============================================================================

  getMaxImageSizeMB(): number {
    return this.get(SETTING_KEYS.STORAGE.MAX_IMAGE_SIZE_MB);
  }

  getMaxAudioSizeMB(): number {
    return this.get(SETTING_KEYS.STORAGE.MAX_AUDIO_SIZE_MB);
  }

  getMaxVideoSizeMB(): number {
    return this.get(SETTING_KEYS.STORAGE.MAX_VIDEO_SIZE_MB);
  }

  getBackupRetentionDays(): number {
    return this.get(SETTING_KEYS.BACKUP.RETENTION_DAYS);
  }

  getGithubRepo(): string {
    return this.get(SETTING_KEYS.UPDATES.GITHUB_REPO);
  }

  isAutoUpdateEnabled(): boolean {
    return this.get(SETTING_KEYS.UPDATES.AUTO_UPDATE_ENABLED);
  }

  getGameDurationMinMinutes(): number {
    return this.get(SETTING_KEYS.BUSINESS.GAME_DURATION_MIN_MINUTES);
  }

  getGameDurationMaxMinutes(): number {
    return this.get(SETTING_KEYS.BUSINESS.GAME_DURATION_MAX_MINUTES);
  }

  getDefaultCancellationPolicy(): string {
    return this.get(SETTING_KEYS.BUSINESS.DEFAULT_CANCELLATION_POLICY);
  }

  getDefaultBookingBufferMinutes(): number {
    return this.get(SETTING_KEYS.BUSINESS.DEFAULT_BOOKING_BUFFER_MINUTES);
  }

  getDefaultBookingWindowDays(): number {
    return this.get(SETTING_KEYS.BUSINESS.DEFAULT_BOOKING_WINDOW_DAYS);
  }

  isEmailRequired(): boolean {
    return this.get(SETTING_KEYS.USER_VALIDATION.EMAIL_REQUIRED);
  }

  getPasswordMinLength(): number {
    return this.get(SETTING_KEYS.USER_VALIDATION.PASSWORD_MIN_LENGTH);
  }

  getPasswordMaxLength(): number {
    return this.get(SETTING_KEYS.USER_VALIDATION.PASSWORD_MAX_LENGTH);
  }

  shouldCapitalizeDisplayName(): boolean {
    return this.get(SETTING_KEYS.USER_VALIDATION.CAPITALIZE_DISPLAY_NAME);
  }

  getDefaultRole(): string {
    return this.get(SETTING_KEYS.USER_VALIDATION.DEFAULT_ROLE);
  }
}

/**
 * Singleton settings manager instance
 */
export const settings = new SettingsManager();

/**
 * Initialize settings manager (call this in app startup)
 */
export async function initializeSettings(): Promise<void> {
  await settings.init();
}
