import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// AUTH & OPERATORS
// ============================================================================

export const operators = sqliteTable('operators', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').unique(),
  email_verified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  role: text('role').notNull(),
  avatar_config: text('avatar_config', { mode: 'json' }), // JSON: DiceBear Bottts config
  bio: text('bio'),
  permissions: text('permissions', { mode: 'json' }).notNull().default(sql`'[]'`),
  must_reset_password: integer('must_reset_password', { mode: 'boolean' }).notNull().default(false),
  password_hash: text('password_hash'),
  last_login_at: text('last_login_at'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  ban_reason: text('ban_reason'),
  ban_expires: text('ban_expires'),
  archived_at: text('archived_at'),
  archived_by: text('archived_by'),
  archived_reason: text('archived_reason')
});

export const operatorAuthSessions = sqliteTable('operator_auth_sessions', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  user_id: text('user_id').notNull().references(() => operators.id),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  impersonated_by: text('impersonated_by')
});

export const operatorAccounts = sqliteTable('operator_accounts', {
  id: text('id').primaryKey(),
  account_id: text('account_id').notNull(),
  provider_id: text('provider_id').notNull(),
  user_id: text('user_id').notNull().references(() => operators.id),
  access_token: text('access_token'),
  refresh_token: text('refresh_token'),
  id_token: text('id_token'),
  access_token_expires_at: text('access_token_expires_at'),
  refresh_token_expires_at: text('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const operatorVerifications = sqliteTable('operator_verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// ============================================================================
// GAMES & ROOMS
// ============================================================================

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  story_intro: text('story_intro'),
  duration_minutes: integer('duration_minutes').notNull().default(60),
  difficulty: text('difficulty'),
  pricing_model: text('pricing_model'),
  category: text('category'),
  categories: text('categories', { mode: 'json' }), // JSON array
  min_players: integer('min_players').notNull().default(1),
  max_players: integer('max_players').notNull().default(1),
  price_per_player_cents: integer('price_per_player_cents').notNull().default(0),
  resources_required: integer('resources_required').notNull().default(1),
  validation_notes: text('validation_notes'),
  media_config: text('media_config', { mode: 'json' }),
  pricing_config: text('pricing_config', { mode: 'json' }),
  booking_rules_config: text('booking_rules_config', { mode: 'json' }),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  archived_at: text('archived_at'),
  archived_by: text('archived_by'),
  archived_reason: text('archived_reason')
});

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  is_mobile_capable: integer('is_mobile_capable', { mode: 'boolean' }).notNull().default(false),
  theme_token: text('theme_token'),
  description: text('description'),
  slug: text('slug'),
  capacity: integer('capacity')
});

export const gamePuzzles = sqliteTable('game_puzzles', {
  id: text('id').primaryKey(),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  solution: text('solution'),
  media_asset: text('media_asset'),
  operator_actions: text('operator_actions'),
  display_order: integer('display_order').notNull().default(0),
  hints: text('hints', { mode: 'json' }), // JSON array
  media_asset_meta: text('media_asset_meta', { mode: 'json' }),
  slug: text('slug')
});

// ============================================================================
// BOOKINGS & SESSIONS
// ============================================================================

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  booking_code: text('booking_code').notNull().unique(),
  game_id: text('game_id').notNull().references(() => games.id),
  room_id: text('room_id').notNull().references(() => rooms.id),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  status: text('status').notNull(),
  party_size: integer('party_size').notNull(),
  deposit_due_cents: integer('deposit_due_cents').notNull().default(0),
  total_due_cents: integer('total_due_cents').notNull().default(0),
  price_tier: text('price_tier').notNull(),
  discount_code: text('discount_code'),
  is_mobile: integer('is_mobile', { mode: 'boolean' }).notNull().default(false),
  is_adhoc: integer('is_adhoc', { mode: 'boolean' }).notNull().default(false),
  location_note: text('location_note'),
  contact_name: text('contact_name').notNull(),
  contact_phone: text('contact_phone').notNull(),
  notes: text('notes')
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  booking_id: text('booking_id').notNull().references(() => bookings.id),
  status: text('status').notNull(),
  timer_total_seconds: integer('timer_total_seconds').notNull(),
  timer_remaining_seconds: integer('timer_remaining_seconds').notNull(),
  timer_total_elapsed_seconds: integer('timer_total_elapsed_seconds').notNull().default(0),
  timer_status: text('timer_status').notNull(),
  started_at: text('started_at').notNull(),
  scheduled_end: text('scheduled_end').notNull(),
  hints_used: integer('hints_used').notNull().default(0),
  stream_thumbnail_url: text('stream_thumbnail_url'),
  background_audio_track: text('background_audio_track'),
  background_audio_is_playing: integer('background_audio_is_playing', { mode: 'boolean' }).notNull().default(false),
  crew_primary: text('crew_primary').notNull(),
  crew_support: text('crew_support')
});

export const sessionPuzzles = sqliteTable('session_puzzles', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull(),
  display_order: integer('display_order').notNull()
});

export const sessionHints = sqliteTable('session_hints', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  message: text('message').notNull(),
  asset_url: text('asset_url'),
  delivered_by: text('delivered_by').notNull(),
  delivered_at: text('delivered_at').notNull()
});

export const timerSlugs = sqliteTable('timer_slugs', {
  slug: text('slug').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  narrative: text('narrative')
});

// ============================================================================
// ASSETS & STORAGE
// ============================================================================

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  original_filename: text('original_filename').notNull(),
  mime_type: text('mime_type').notNull(),
  size_bytes: integer('size_bytes').notNull(),
  asset_type: text('asset_type').notNull(), // 'image' | 'audio' | 'video' | 'document'
  media_type: text('media_type'), // More specific MIME category
  file_path: text('file_path').notNull(),
  game_id: text('game_id').references(() => games.id, { onDelete: 'cascade' }),
  puzzle_id: text('puzzle_id'),
  hint_order: integer('hint_order'),
  is_reusable: integer('is_reusable', { mode: 'boolean' }).notNull().default(false),
  uploaded_by: text('uploaded_by').notNull().references(() => operators.id),
  uploaded_at: text('uploaded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  metadata: text('metadata', { mode: 'json' })
}, (table) => ({
  gameIdIdx: index('idx_assets_game_id').on(table.game_id),
  typeIdx: index('idx_assets_type').on(table.asset_type),
  reusableIdx: index('idx_assets_reusable').on(table.is_reusable)
}));

export const assetUsage = sqliteTable('asset_usage', {
  id: text('id').primaryKey(),
  asset_id: text('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  used_in_game_id: text('used_in_game_id').references(() => games.id, { onDelete: 'cascade' }),
  used_in_puzzle_id: text('used_in_puzzle_id'),
  usage_type: text('usage_type').notNull(), // 'hint' | 'puzzle' | 'intro' | 'background'
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  assetIdIdx: index('idx_asset_usage_asset').on(table.asset_id),
  gameIdIdx: index('idx_asset_usage_game').on(table.used_in_game_id)
}));

export const storageMetrics = sqliteTable('storage_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  total_size_bytes: integer('total_size_bytes').notNull(),
  total_files: integer('total_files').notNull(),
  by_type: text('by_type', { mode: 'json' }).notNull(), // JSON: { image: 123, audio: 456, ... }
  by_game: text('by_game', { mode: 'json' }).notNull(), // JSON: { gameId: size }
  last_backup_at: text('last_backup_at'),
  recorded_at: text('recorded_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// ============================================================================
// NETWORK
// ============================================================================

export const networkProfiles = sqliteTable('network_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ssid: text('ssid').notNull(),
  password: text('password'),
  description: text('description'),
  band: text('band'), // '2.4GHz' | '5GHz' | '5GHz/2.4GHz'
  channel: integer('channel'),
  security: text('security'), // 'WPA2-PSK' | 'WPA3' | 'OPEN'
  broadcast_enabled: integer('broadcast_enabled', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('offline'), // 'online' | 'offline' | 'error'
  status_message: text('status_message'),
  details: text('details', { mode: 'json' }),
  last_updated: text('last_updated').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const networkHealth = sqliteTable('network_health', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  status: text('status').notNull(),
  message: text('message').notNull(),
  last_checked: text('last_checked').notNull()
});

// ============================================================================
// LOGGING & ALERTING
// ============================================================================

export const systemLogs = sqliteTable('system_logs', {
  id: text('id').primaryKey(),
  level: text('level').notNull(), // 'debug' | 'info' | 'warn' | 'error'
  category: text('category').notNull(), // 'session' | 'auth' | 'system' | 'network' | 'api'
  message: text('message').notNull(),
  context: text('context', { mode: 'json' }), // JSON: { sessionId?, userId?, ip?, requestId?, etc }
  timestamp: text('timestamp').notNull(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  timestampIdx: index('idx_logs_timestamp').on(table.timestamp),
  levelIdx: index('idx_logs_level').on(table.level),
  categoryIdx: index('idx_logs_category').on(table.category),
  createdIdx: index('idx_logs_created').on(table.created_at)
}));

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  session_id: text('session_id').references(() => sessions.id, { onDelete: 'cascade' }), // NULL for system alerts
  level: text('level').notNull(), // 'info' | 'warning' | 'critical'
  category: text('category').notNull(), // 'timer' | 'network' | 'system' | 'session' | 'hint'
  title: text('title').notNull(),
  message: text('message').notNull(),
  context: text('context', { mode: 'json' }), // JSON: { gameName?, roomName?, pausedBy?, etc }
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  dismissed_at: text('dismissed_at'),
  dismissed_by: text('dismissed_by').references(() => operators.id)
}, (table) => ({
  sessionIdIdx: index('idx_alerts_session').on(table.session_id),
  levelIdx: index('idx_alerts_level').on(table.level),
  createdIdx: index('idx_alerts_created').on(table.created_at),
  activeIdx: index('idx_alerts_active').on(table.dismissed_at)
}));

export const alertRules = sqliteTable('alert_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  category: text('category').notNull(),
  level: text('level').notNull(), // 'info' | 'warning' | 'critical'
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  conditions: text('conditions', { mode: 'json' }).notNull(), // JSON: { event, threshold?, etc }
  title_template: text('title_template').notNull(),
  message_template: text('message_template').notNull(),
  auto_dismiss_on: text('auto_dismiss_on', { mode: 'json' }), // JSON: array of events
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  enabledIdx: index('idx_alert_rules_enabled').on(table.enabled),
  categoryIdx: index('idx_alert_rules_category').on(table.category)
}));

// ============================================================================
// SCHEMA EXPORTS
// ============================================================================

export const schema = {
  // Auth & Operators
  operators,
  operatorAuthSessions,
  operatorAccounts,
  operatorVerifications,
  // Games & Rooms
  games,
  rooms,
  gamePuzzles,
  // Bookings & Sessions
  bookings,
  sessions,
  sessionPuzzles,
  sessionHints,
  timerSlugs,
  // Assets & Storage
  assets,
  assetUsage,
  storageMetrics,
  // Network
  networkProfiles,
  networkHealth,
  // Logging & Alerting
  systemLogs,
  alerts,
  alertRules
};

// Legacy export for Better Auth compatibility
export const authTables = {
  operators,
  operatorAuthSessions,
  operatorAccounts,
  operatorVerifications
};
