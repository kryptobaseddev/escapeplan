/**
 * System Defaults Seed - Settings, Alert Rules, and Network Configuration
 *
 * This seed file populates system configuration data required for the EscapePlan
 * system to operate correctly. It is safe to run in production and uses idempotent
 * operations to preserve user-modified settings.
 *
 * Data included:
 * - System settings (~20 entries: storage limits, backup retention, business rules)
 * - Alert rules (4 rules: game_paused, low_time, excessive_hints, network_offline)
 * - Network profile (default SSID configuration)
 */

import { db } from '../client.ts';
import { sqlite } from '../client.ts';
import { systemSettings } from '@escapeplan/contracts';
import {
  SETTING_KEYS,
  DEFAULT_FILE_SIZE_LIMITS,
  DEFAULT_BACKUP_RETENTION_DAYS,
  DEFAULT_GITHUB_REPO,
  DEFAULT_AUTO_UPDATE_ENABLED,
  BUSINESS_DEFAULTS,
  USER_VALIDATION_DEFAULTS,
  FALLBACK_VERSION
} from '@escapeplan/contracts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rawDb = sqlite;

/**
 * Get application version from package.json
 *
 * @returns Version string or fallback version
 */
function getVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

/**
 * Seeds system configuration data including settings, alert rules, and network profiles.
 *
 * This function is idempotent and safe to run multiple times.
 * - Settings: Only inserts missing keys (preserves user edits)
 * - Alert rules: Uses INSERT OR REPLACE to allow template updates
 * - Network: Preserves existing configuration
 *
 * @returns Promise<void>
 * @throws Error if database operations fail
 */
export async function seedSystemDefaults(): Promise<void> {
  try {
    console.log('[Seed:Defaults] Starting system defaults seeding...');

    // ============================================================================
    // SEED SYSTEM SETTINGS
    // ============================================================================

    console.log('[Seed:Defaults] Populating system settings...');

    const settingsDefaults = [
      // Storage Settings
      {
        key: SETTING_KEYS.STORAGE.MAX_IMAGE_SIZE_MB,
        value: String(DEFAULT_FILE_SIZE_LIMITS.IMAGE_MB),
        type: 'number',
        category: 'storage',
        label: 'Max Image Size (MB)',
        description: 'Maximum file size for image uploads',
        is_editable: true
      },
      {
        key: SETTING_KEYS.STORAGE.MAX_AUDIO_SIZE_MB,
        value: String(DEFAULT_FILE_SIZE_LIMITS.AUDIO_MB),
        type: 'number',
        category: 'storage',
        label: 'Max Audio Size (MB)',
        description: 'Maximum file size for audio uploads',
        is_editable: true
      },
      {
        key: SETTING_KEYS.STORAGE.MAX_VIDEO_SIZE_MB,
        value: String(DEFAULT_FILE_SIZE_LIMITS.VIDEO_MB),
        type: 'number',
        category: 'storage',
        label: 'Max Video Size (MB)',
        description: 'Maximum file size for video uploads',
        is_editable: true
      },
      // Backup Settings
      {
        key: SETTING_KEYS.BACKUP.RETENTION_DAYS,
        value: String(DEFAULT_BACKUP_RETENTION_DAYS),
        type: 'number',
        category: 'backup',
        label: 'Backup Retention (Days)',
        description: 'How many days to keep backup files before auto-deletion',
        is_editable: true
      },
      // Update Settings
      {
        key: SETTING_KEYS.UPDATES.GITHUB_REPO,
        value: DEFAULT_GITHUB_REPO,
        type: 'string',
        category: 'updates',
        label: 'GitHub Repository',
        description: 'Repository for checking and downloading updates (format: owner/repo)',
        is_editable: true
      },
      {
        key: SETTING_KEYS.UPDATES.AUTO_UPDATE_ENABLED,
        value: String(DEFAULT_AUTO_UPDATE_ENABLED),
        type: 'boolean',
        category: 'updates',
        label: 'Enable Auto-Updates',
        description: 'Automatically check for and install updates when available',
        is_editable: true
      },
      // Business Defaults
      {
        key: SETTING_KEYS.BUSINESS.GAME_DURATION_MIN_MINUTES,
        value: String(BUSINESS_DEFAULTS.GAME_DURATION_MIN_MINUTES),
        type: 'number',
        category: 'business',
        label: 'Min Game Duration (Minutes)',
        description: 'Minimum allowed duration for games',
        is_editable: true
      },
      {
        key: SETTING_KEYS.BUSINESS.GAME_DURATION_MAX_MINUTES,
        value: String(BUSINESS_DEFAULTS.GAME_DURATION_MAX_MINUTES),
        type: 'number',
        category: 'business',
        label: 'Max Game Duration (Minutes)',
        description: 'Maximum allowed duration for games',
        is_editable: true
      },
      {
        key: SETTING_KEYS.BUSINESS.DEFAULT_CANCELLATION_POLICY,
        value: BUSINESS_DEFAULTS.DEFAULT_CANCELLATION_POLICY,
        type: 'string',
        category: 'business',
        label: 'Default Cancellation Policy',
        description: 'Default template for game cancellation policies',
        is_editable: true
      },
      {
        key: SETTING_KEYS.BUSINESS.DEFAULT_BOOKING_BUFFER_MINUTES,
        value: String(BUSINESS_DEFAULTS.DEFAULT_BOOKING_BUFFER_MINUTES),
        type: 'number',
        category: 'business',
        label: 'Default Booking Buffer (Minutes)',
        description: 'Default buffer time between bookings',
        is_editable: true
      },
      {
        key: SETTING_KEYS.BUSINESS.DEFAULT_BOOKING_WINDOW_DAYS,
        value: String(BUSINESS_DEFAULTS.DEFAULT_BOOKING_WINDOW_DAYS),
        type: 'number',
        category: 'business',
        label: 'Default Booking Window (Days)',
        description: 'How far in advance bookings can be made',
        is_editable: true
      },
      {
        key: SETTING_KEYS.BUSINESS.DEFAULT_TEXT_HINT_SOUND_ASSET_ID,
        value: String(BUSINESS_DEFAULTS.DEFAULT_TEXT_HINT_SOUND_ASSET_ID ?? 'null'),
        type: 'string',
        category: 'business',
        label: 'Default Text Hint Sound Asset ID',
        description: 'Asset ID for the background sound that plays when text hints are displayed',
        is_editable: true
      },
      {
        key: SETTING_KEYS.BUSINESS.DEFAULT_TEXT_HINT_DURATION_SECONDS,
        value: String(BUSINESS_DEFAULTS.DEFAULT_TEXT_HINT_DURATION_SECONDS),
        type: 'number',
        category: 'business',
        label: 'Default Text Hint Duration (Seconds)',
        description: 'How long text hints remain visible on the room display before auto-dismissing',
        is_editable: true
      },
      // User Validation Settings
      {
        key: SETTING_KEYS.USER_VALIDATION.EMAIL_REQUIRED,
        value: String(USER_VALIDATION_DEFAULTS.EMAIL_REQUIRED),
        type: 'boolean',
        category: 'user_validation',
        label: 'Email Required',
        description: 'Require email address when creating new users',
        is_editable: true
      },
      {
        key: SETTING_KEYS.USER_VALIDATION.PASSWORD_MIN_LENGTH,
        value: String(USER_VALIDATION_DEFAULTS.PASSWORD_MIN_LENGTH),
        type: 'number',
        category: 'user_validation',
        label: 'Minimum Password Length',
        description: 'Minimum number of characters required for passwords',
        is_editable: true
      },
      {
        key: SETTING_KEYS.USER_VALIDATION.PASSWORD_MAX_LENGTH,
        value: String(USER_VALIDATION_DEFAULTS.PASSWORD_MAX_LENGTH),
        type: 'number',
        category: 'user_validation',
        label: 'Maximum Password Length',
        description: 'Maximum number of characters allowed for passwords',
        is_editable: true
      },
      {
        key: SETTING_KEYS.USER_VALIDATION.CAPITALIZE_DISPLAY_NAME,
        value: String(USER_VALIDATION_DEFAULTS.CAPITALIZE_DISPLAY_NAME),
        type: 'boolean',
        category: 'user_validation',
        label: 'Auto-Capitalize Display Names',
        description: 'Automatically capitalize the first letter of each word in display names',
        is_editable: true
      },
      {
        key: SETTING_KEYS.USER_VALIDATION.DEFAULT_ROLE,
        value: USER_VALIDATION_DEFAULTS.DEFAULT_ROLE,
        type: 'string',
        category: 'user_validation',
        label: 'Default Role',
        description: 'Default role assigned to new users',
        is_editable: true
      },
      // System Info (Read-Only)
      {
        key: SETTING_KEYS.SYSTEM.INSTALL_PATH,
        value: process.cwd(),
        type: 'string',
        category: 'system',
        label: 'Install Path',
        description: 'Application installation directory',
        is_editable: false
      },
      {
        key: SETTING_KEYS.SYSTEM.VERSION,
        value: getVersion(),
        type: 'string',
        category: 'system',
        label: 'Version',
        description: 'Current application version',
        is_editable: false
      },
      {
        key: SETTING_KEYS.SYSTEM.BUILD_DATE,
        value: process.env.BUILD_DATE || new Date().toISOString(),
        type: 'string',
        category: 'system',
        label: 'Build Date',
        description: 'When this version was built',
        is_editable: false
      }
    ];

    let settingsCreated = 0;
    let settingsSkipped = 0;

    for (const setting of settingsDefaults) {
      try {
        await db.insert(systemSettings)
          .values(setting)
          .onConflictDoNothing();
        settingsCreated++;
      } catch (error) {
        console.warn(`[Seed:Defaults] Skipped setting ${setting.key}:`, error);
        settingsSkipped++;
      }
    }

    console.log(`[Seed:Defaults] System settings: ${settingsCreated} created, ${settingsSkipped} skipped`);

    // ============================================================================
    // SEED ALERT RULES
    // ============================================================================

    console.log('[Seed:Defaults] Seeding alert rules...');

    const alertRules = [
      {
        id: 'game_paused',
        name: 'game_paused',
        description: 'Alert when a game timer is paused',
        category: 'timer',
        level: 'warning',
        enabled: 1,
        conditions: JSON.stringify({ event: 'timer_paused' }),
        title_template: '⏸ Game Paused',
        message_template: '{{gameName}} paused at {{time}}',
        auto_dismiss_on: JSON.stringify(['timer_resume', 'session_complete'])
      },
      {
        id: 'low_time',
        name: 'low_time',
        description: 'Alert when timer drops below 5 minutes',
        category: 'timer',
        level: 'warning',
        enabled: 1,
        conditions: JSON.stringify({
          event: 'timer_tick',
          threshold: { remaining_seconds: { lt: 300 } }
        }),
        title_template: '⏱ Low Time Remaining',
        message_template: '{{gameName}} has less than 5 minutes remaining',
        auto_dismiss_on: JSON.stringify(['session_complete'])
      },
      {
        id: 'excessive_hints',
        name: 'excessive_hints',
        description: 'Alert when 3+ hints sent in 5 minutes',
        category: 'hint',
        level: 'warning',
        enabled: 1,
        conditions: JSON.stringify({
          event: 'hint_sent',
          threshold: { count: 3, window_minutes: 5 }
        }),
        title_template: '🔔 Excessive Hints',
        message_template: '{{gameName}}: {{count}} hints in {{window_minutes}} minutes',
        auto_dismiss_on: null
      },
      {
        id: 'network_offline',
        name: 'network_offline',
        description: 'Alert when network status changes to offline',
        category: 'network',
        level: 'critical',
        enabled: 1,
        conditions: JSON.stringify({
          event: 'network_status_change',
          threshold: { status: 'offline' }
        }),
        title_template: '🔴 Network Offline',
        message_template: 'Network controller offline - check connectivity',
        auto_dismiss_on: JSON.stringify(['network_online'])
      }
    ];

    let alertRulesCreated = 0;

    try {
      const insertAlertRule = rawDb.prepare(
        `INSERT OR REPLACE INTO alert_rules
         (id, name, description, category, level, enabled, conditions, title_template, message_template, auto_dismiss_on, created_at, updated_at)
         VALUES (@id, @name, @description, @category, @level, @enabled, @conditions, @title_template, @message_template, @auto_dismiss_on, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      );

      for (const rule of alertRules) {
        insertAlertRule.run(rule);
        alertRulesCreated++;
      }

      console.log(`[Seed:Defaults] Alert rules: ${alertRulesCreated} created/updated`);
    } catch (error) {
      console.error('[Seed:Defaults] Error seeding alert rules:', error);
      throw error;
    }

    // ============================================================================
    // SEED NETWORK PROFILE
    // ============================================================================

    console.log('[Seed:Defaults] Seeding network profile...');

    try {
      const existingNetwork = rawDb.prepare('SELECT id FROM network_profiles WHERE id = ?').get('primary');

      if (!existingNetwork) {
        rawDb.prepare(
          `INSERT INTO network_profiles
           (id, name, ssid, password, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated)
           VALUES ('primary', 'EscapePlan Control Network', 'escapeplan_net', 'escape2024',
                   'Primary operator network and broadcast SSID for in-room displays.',
                   '5GHz/2.4GHz', 36, 'WPA2-PSK', 1, 'offline',
                   'Awaiting first health check from Pi appliance.', NULL, CURRENT_TIMESTAMP)`
        ).run();
        console.log('[Seed:Defaults] Network profile created');
      } else {
        console.log('[Seed:Defaults] Network profile already exists, skipping');
      }
    } catch (error) {
      console.error('[Seed:Defaults] Error seeding network profile:', error);
      throw error;
    }

    console.log('[Seed:Defaults] ✅ System defaults seeded successfully\n');
  } catch (error) {
    console.error('[Seed:Defaults] ❌ Fatal error during system defaults seeding:', error);
    throw error;
  }
}
