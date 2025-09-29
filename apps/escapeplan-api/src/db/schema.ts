import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const operators = sqliteTable('operators', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>().notNull(),
  passwordHash: text('password_hash').notNull()
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
insert into operators (id, username, name, role, avatar_url, bio, permissions, password_hash)
values (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  username = excluded.username,
  name = excluded.name,
  role = excluded.role,
  avatar_url = excluded.avatar_url,
  bio = excluded.bio,
  permissions = excluded.permissions,
  password_hash = excluded.password_hash;
`;
