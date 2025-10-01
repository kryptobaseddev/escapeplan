import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  difficulty: text('difficulty'),
  pricingModel: text('pricing_model'),
  category: text('category')
});

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  name: text('name').notNull(),
  isMobileCapable: integer('is_mobile_capable', { mode: 'boolean' }).notNull().default(false),
  themeToken: text('theme_token')
});

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  bookingCode: text('booking_code').notNull().unique(),
  gameId: text('game_id').notNull().references(() => games.id),
  roomId: text('room_id').notNull().references(() => rooms.id),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status').notNull(),
  partySize: integer('party_size').notNull(),
  depositDueCents: integer('deposit_due_cents').notNull().default(0),
  totalDueCents: integer('total_due_cents').notNull().default(0),
  priceTier: text('price_tier').notNull(),
  discountCode: text('discount_code'),
  isMobile: integer('is_mobile', { mode: 'boolean' }).notNull().default(false),
  locationNote: text('location_note'),
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone').notNull()
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  status: text('status').notNull(),
  timerTotalSeconds: integer('timer_total_seconds').notNull(),
  timerRemainingSeconds: integer('timer_remaining_seconds').notNull(),
  timerTotalElapsedSeconds: integer('timer_total_elapsed_seconds').notNull().default(0),
  timerStatus: text('timer_status').notNull(),
  startedAt: text('started_at').notNull(),
  scheduledEnd: text('scheduled_end').notNull(),
  hintsUsed: integer('hints_used').notNull().default(0),
  streamThumbnailUrl: text('stream_thumbnail_url'),
  backgroundAudioTrack: text('background_audio_track'),
  backgroundAudioIsPlaying: integer('background_audio_is_playing', { mode: 'boolean' }).notNull().default(false),
  crewPrimary: text('crew_primary').notNull(),
  crewSupport: text('crew_support'),
  recentAlert: text('recent_alert')
});

export const sessionPuzzles = sqliteTable('session_puzzles', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  title: text('title').notNull(),
  status: text('status').notNull(),
  displayOrder: integer('display_order').notNull()
});

export const sessionHints = sqliteTable('session_hints', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  type: text('type').notNull(),
  message: text('message').notNull(),
  assetUrl: text('asset_url'),
  deliveredBy: text('delivered_by').notNull(),
  deliveredAt: text('delivered_at').notNull()
});

export const timerSlugs = sqliteTable('timer_slugs', {
  slug: text('slug').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  narrative: text('narrative')
});

export const networkHealth = sqliteTable('network_health', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  status: text('status').notNull(),
  message: text('message').notNull(),
  lastChecked: text('last_checked').notNull()
});

export const upsertOperators = sql`
INSERT INTO operators (
  id,
  username,
  name,
  email,
  role,
  avatar_config,
  bio,
  permissions,
  must_reset_password,
  updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  username = excluded.username,
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  avatar_config = excluded.avatar_config,
  bio = excluded.bio,
  permissions = excluded.permissions,
  must_reset_password = excluded.must_reset_password,
  updated_at = CURRENT_TIMESTAMP;
`;

export const authTables = {
  operators,
  operatorAuthSessions,
  operatorAccounts,
  operatorVerifications
};
