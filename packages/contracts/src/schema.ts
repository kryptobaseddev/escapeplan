import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// AUTH & OPERATORS
// ============================================================================

// Database-driven RBAC: System and custom roles
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  is_system: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Database-driven RBAC: All permissions
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  label: text('label').notNull(),
  category: text('category').notNull(), // dashboard, bookings, sessions, games, network, users, rbac, storage, cameras, system
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Database-driven RBAC: Junction table for role-permission mappings
export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: text('id').primaryKey(),
    role_id: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    permission_id: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
    granted_at: text('granted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    granted_by: text('granted_by').references(() => operators.id)
  },
  (table) => ({
    uniqueRolePermission: index('idx_role_permission_unique').on(table.role_id, table.permission_id)
  })
);

export const operators = sqliteTable('operators', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').unique(),
  email_verified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  role: text('role').notNull(),
  permissions: text('permissions', { mode: 'json' }).notNull().default(sql`'[]'`),
  role_id: text('role_id').notNull().references(() => roles.id), // FK to roles table for database-driven RBAC
  avatar_config: text('avatar_config', { mode: 'json' }), // JSON: DiceBear Bottts config
  bio: text('bio'),
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
  game_type: text('game_type').notNull().default('storefront'), // 'storefront' | 'mobile'
  pricing_model: text('pricing_model'), // DEPRECATED: Use pricing_config.tiers[].model instead
  category: text('category'),
  categories: text('categories', { mode: 'json' }), // JSON array
  min_players: integer('min_players').notNull().default(1), // Room capacity minimum
  max_players: integer('max_players').notNull().default(1), // Room capacity maximum
  price_per_player_cents: integer('price_per_player_cents'), // DEPRECATED: Use pricing_config.tiers instead
  resources_required: integer('resources_required').notNull().default(1),
  validation_notes: text('validation_notes'),
  default_volume: integer('default_volume').notNull().default(80), // 0-100, game-wide default for all media
  camera_ids: text('camera_ids', { mode: 'json' }).default(sql`'[]'`), // JSON array of camera IDs associated with this game
  media_config: text('media_config', { mode: 'json' }),
  pricing_config: text('pricing_config', { mode: 'json' }), // Enhanced: tiers with per-tier models
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
  hints: text('hints', { mode: 'json' }), // JSON array with volumeLevel per hint
  media_asset_meta: text('media_asset_meta', { mode: 'json' }),
  slug: text('slug')
});

// Game Milestones - Intro/Escaped/Failed/Custom events
export const gameMilestones = sqliteTable('game_milestones', {
  id: text('id').primaryKey(),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'intro' | 'escaped' | 'failed' | 'custom'
  name: text('name').notNull(), // User-friendly name (e.g., "Welcome Message", "Victory Sequence")
  media_type: text('media_type'), // 'text' | 'image' | 'audio' | 'video' | null
  content: text('content'), // Text content or description
  asset_id: text('asset_id').references(() => assets.id, { onDelete: 'set null' }), // Asset reference for media
  volume_level: integer('volume_level').notNull().default(80), // 0-100, overrides game default_volume
  display_order: integer('display_order').notNull().default(0),
  // Trigger conditions
  trigger_type: text('trigger_type').notNull(), // 'manual' | 'timer' | 'condition'
  trigger_config: text('trigger_config', { mode: 'json' }), // JSON: { minutes?, interval?, hintsUsed?, etc }
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  gameIdIdx: index('idx_game_milestones_game').on(table.game_id),
  typeIdx: index('idx_game_milestones_type').on(table.type),
  enabledIdx: index('idx_game_milestones_enabled').on(table.enabled)
}));

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
  puzzle_id: text('puzzle_id'), // Reference back to game_puzzles for hint lookup
  title: text('title').notNull(),
  description: text('description'), // Copy from game_puzzles for quick access
  solution: text('solution'), // Copy from game_puzzles for quick access
  status: text('status').notNull(), // 'available' | 'in_progress' | 'completed'
  display_order: integer('display_order').notNull(),
  hints: text('hints', { mode: 'json' }) // Copy of hints from game_puzzles with volumeLevel
});

export const sessionHints = sqliteTable('session_hints', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  puzzle_id: text('puzzle_id'), // Which puzzle this hint was for (optional)
  type: text('type').notNull(), // 'text' | 'image' | 'audio' | 'video'
  message: text('message').notNull(),
  asset_url: text('asset_url'),
  volume_level: integer('volume_level'), // Volume at which this hint was sent
  delivered_by: text('delivered_by').notNull(),
  delivered_at: text('delivered_at').notNull()
});

// Session Milestones - Track which milestones were triggered during session
export const sessionMilestones = sqliteTable('session_milestones', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  milestone_id: text('milestone_id').notNull().references(() => gameMilestones.id),
  milestone_type: text('milestone_type').notNull(), // Copy of type for quick lookup
  milestone_name: text('milestone_name').notNull(), // Copy of name for display
  media_type: text('media_type'), // Copy of media_type
  content: text('content'), // Copy of content
  asset_url: text('asset_url'), // Resolved asset URL at trigger time
  volume_level: integer('volume_level'), // Volume level used
  triggered_at: text('triggered_at').notNull(),
  triggered_by: text('triggered_by').references(() => operators.id) // NULL for auto-triggers
}, (table) => ({
  sessionIdIdx: index('idx_session_milestones_session').on(table.session_id),
  milestoneIdIdx: index('idx_session_milestones_milestone').on(table.milestone_id),
  triggeredAtIdx: index('idx_session_milestones_triggered').on(table.triggered_at),
  uniqueMilestone: index('idx_session_milestone_unique').on(table.session_id, table.milestone_id)
}));

export const timerSlugs = sqliteTable('timer_slugs', {
  slug: text('slug').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  narrative: text('narrative')
});

// ============================================================================
// DISCOUNT CODES
// ============================================================================

export const discountCodes = sqliteTable('discount_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description'),
  type: text('type').notNull(), // 'percent' | 'fixed_amount'
  percent_off: integer('percent_off'), // 0-100
  amount_off_cents: integer('amount_off_cents'),
  valid_from: text('valid_from'),
  valid_until: text('valid_until'),
  max_uses: integer('max_uses'), // NULL = unlimited
  current_uses: integer('current_uses').notNull().default(0),
  applies_to: text('applies_to').notNull().default('all'), // 'all' | 'selected'
  minimum_party_size: integer('minimum_party_size'),
  notes: text('notes'),
  created_by: text('created_by').notNull().references(() => operators.id),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  archived_at: text('archived_at')
}, (table) => ({
  codeIdx: index('idx_discount_codes_code').on(table.code),
  activeIdx: index('idx_discount_codes_active').on(table.archived_at, table.valid_from, table.valid_until)
}));

export const discountCodeGames = sqliteTable('discount_code_games', {
  id: text('id').primaryKey(),
  discount_code_id: text('discount_code_id').notNull().references(() => discountCodes.id, { onDelete: 'cascade' }),
  game_id: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  uniquePair: index('idx_discount_game_unique').on(table.discount_code_id, table.game_id),
  codeIdx: index('idx_discount_game_code').on(table.discount_code_id),
  gameIdx: index('idx_discount_game_game').on(table.game_id)
}));

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
  default_volume: integer('default_volume').notNull().default(80), // 0-100, default volume for this asset
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

// System Health Snapshots - Real metrics from Node.js os module
export const systemHealth = sqliteTable('system_health', {
  id: text('id').primaryKey(),
  cpu_usage_percent: integer('cpu_usage_percent').notNull(), // 0-100
  memory_total_mb: integer('memory_total_mb').notNull(),
  memory_used_mb: integer('memory_used_mb').notNull(),
  disk_total_gb: integer('disk_total_gb').notNull(),
  disk_used_gb: integer('disk_used_gb').notNull(),
  uptime_seconds: integer('uptime_seconds').notNull(),
  services_status: text('services_status', { mode: 'json' }).notNull(), // JSON: Array<{name, status, uptime, details}>
  recorded_at: text('recorded_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  recordedIdx: index('idx_system_health_recorded').on(table.recorded_at)
}));

// Backup History - Track all backup operations
export const backups = sqliteTable('backups', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'manual' | 'scheduled' | 'pre-update'
  status: text('status').notNull(), // 'in_progress' | 'completed' | 'failed'
  file_path: text('file_path'),
  file_size_bytes: integer('file_size_bytes'),
  includes: text('includes', { mode: 'json' }).notNull(), // JSON: { database, games, assets, logs }
  destination: text('destination').notNull(), // 'local' | 'usb'
  usb_device: text('usb_device'),
  checksum_sha256: text('checksum_sha256'),
  error_message: text('error_message'),
  created_by: text('created_by').notNull().references(() => operators.id),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  completed_at: text('completed_at')
}, (table) => ({
  createdIdx: index('idx_backups_created').on(table.created_at),
  statusIdx: index('idx_backups_status').on(table.status),
  typeIdx: index('idx_backups_type').on(table.type)
}));

// USB Devices - Track connected USB drives for backups
export const usbDevices = sqliteTable('usb_devices', {
  id: text('id').primaryKey(),
  device_path: text('device_path').notNull(), // /dev/sda1
  mount_point: text('mount_point'), // /mnt/escapeplan-backup
  label: text('label'),
  total_space_gb: integer('total_space_gb'),
  available_space_gb: integer('available_space_gb'),
  is_mounted: integer('is_mounted', { mode: 'boolean' }).notNull().default(false),
  last_seen: text('last_seen').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  devicePathIdx: index('idx_usb_devices_path').on(table.device_path),
  mountedIdx: index('idx_usb_devices_mounted').on(table.is_mounted)
}));

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
// CAMERAS
// ============================================================================

export const cameras = sqliteTable('cameras', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  game_id: text('game_id').references(() => games.id, { onDelete: 'set null' }), // 1-to-1: camera can only be associated with one game
  protocol: text('protocol').notNull(), // 'rtsp' | 'mjpeg' | 'onvif'
  host: text('host').notNull(),
  port: integer('port').notNull().default(554),
  username: text('username'),
  password_encrypted: text('password_encrypted'), // Encrypted with libsodium
  stream_path: text('stream_path'),
  resolution: text('resolution').default('720p'), // '480p' | '720p' | '1080p' | 'native'
  frame_rate: integer('frame_rate').default(15),
  transport: text('transport').default('tcp'), // 'tcp' | 'udp' | 'http'
  status: text('status').default('offline'), // 'online' | 'offline' | 'testing' | 'error'
  last_seen: text('last_seen'),
  error_message: text('error_message'),
  hls_streaming: integer('hls_streaming', { mode: 'boolean' }).default(false),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  gameIdIdx: index('idx_cameras_game').on(table.game_id),
  statusIdx: index('idx_cameras_status').on(table.status)
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
  gameMilestones,
  // Bookings & Sessions
  bookings,
  sessions,
  sessionPuzzles,
  sessionHints,
  sessionMilestones,
  timerSlugs,
  // Discount Codes
  discountCodes,
  discountCodeGames,
  // Assets & Storage
  assets,
  assetUsage,
  storageMetrics,
  systemHealth,
  backups,
  usbDevices,
  // Network
  networkProfiles,
  networkHealth,
  // Logging & Alerting
  systemLogs,
  alerts,
  alertRules,
  // Cameras
  cameras,
  // Database-driven RBAC
  roles,
  permissions,
  rolePermissions
};

// Legacy export for Better Auth compatibility
export const authTables = {
  operators,
  operatorAuthSessions,
  operatorAccounts,
  operatorVerifications
};
