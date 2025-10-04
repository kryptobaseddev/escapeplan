/**
 * System Settings TypeScript Types
 *
 * Universal types for runtime-configurable system settings stored in database.
 */

import type { SettingCategory, SettingType } from './constants.js';

/** Database record for a system setting */
export interface SystemSetting {
  key: string;
  value: string; // Stored as string, parsed based on type
  type: SettingType;
  category: SettingCategory;
  label: string;
  description: string | null;
  is_editable: boolean;
  updated_at: string;
  updated_by: string | null;
}

/** Request to update a system setting */
export interface UpdateSystemSettingRequest {
  value: string | number | boolean | object;
}

/** Response when fetching all settings */
export interface GetSystemSettingsResponse {
  settings: Record<SettingCategory, SystemSetting[]>;
}

/** Response when updating a setting */
export interface UpdateSystemSettingResponse {
  success: boolean;
  setting: SystemSetting;
}

/** Typed setting values for compile-time safety */
export interface SystemSettingValues {
  // Storage
  'storage.max_image_size_mb': number;
  'storage.max_audio_size_mb': number;
  'storage.max_video_size_mb': number;

  // Backup
  'backup.retention_days': number;

  // Updates
  'updates.github_repo': string;
  'updates.auto_update_enabled': boolean;

  // Business defaults
  'business.game_duration_min_minutes': number;
  'business.game_duration_max_minutes': number;
  'business.default_cancellation_policy': string;
  'business.default_booking_buffer_minutes': number;
  'business.default_booking_window_days': number;

  // System (read-only)
  'system.install_path': string;
  'system.version': string;
  'system.build_date': string;
}

/** Valid setting keys (type-safe) */
export type SystemSettingKey = keyof SystemSettingValues;

/** Get the value type for a specific setting key */
export type SystemSettingValue<K extends SystemSettingKey> = SystemSettingValues[K];
