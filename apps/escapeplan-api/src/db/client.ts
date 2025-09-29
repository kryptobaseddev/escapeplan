import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(moduleDir, '../../data');
mkdirSync(dataPath, { recursive: true });

const dbFile = resolve(dataPath, 'escapeplan.db');

export const sqlite = new Database(dbFile);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite);

let schemaReady = false;

function ensureColumn(table: string, column: string, definition: string) {
  const info = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!info.find((c) => c.name === column)) {
    sqlite.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export function runMigrations() {
  if (schemaReady) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS operators (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      permissions TEXT,
      password_hash TEXT NOT NULL,
      email TEXT,
      must_reset_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      story_intro TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      difficulty TEXT,
      pricing_model TEXT,
      category TEXT,
      categories TEXT,
      min_players INTEGER NOT NULL DEFAULT 1,
      max_players INTEGER NOT NULL DEFAULT 1,
      price_per_player_cents INTEGER NOT NULL DEFAULT 0,
      resources_required INTEGER NOT NULL DEFAULT 1,
      validation_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_mobile_capable INTEGER NOT NULL DEFAULT 0,
      theme_token TEXT
    );

    CREATE TABLE IF NOT EXISTS game_puzzles (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      solution TEXT,
      media_asset TEXT,
      operator_actions TEXT,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_code TEXT NOT NULL UNIQUE,
      game_id TEXT NOT NULL REFERENCES games(id),
      room_id TEXT NOT NULL REFERENCES rooms(id),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      deposit_due_cents INTEGER NOT NULL DEFAULT 0,
      total_due_cents INTEGER NOT NULL DEFAULT 0,
      price_tier TEXT NOT NULL,
      discount_code TEXT,
      is_mobile INTEGER NOT NULL DEFAULT 0,
      location_note TEXT,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      status TEXT NOT NULL,
      timer_total_seconds INTEGER NOT NULL,
      timer_remaining_seconds INTEGER NOT NULL,
      timer_status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      scheduled_end TEXT NOT NULL,
      hints_used INTEGER NOT NULL DEFAULT 0,
      stream_thumbnail_url TEXT,
      background_audio_track TEXT,
      background_audio_is_playing INTEGER NOT NULL DEFAULT 0,
      crew_primary TEXT NOT NULL,
      crew_support TEXT,
      recent_alert TEXT
    );

    CREATE TABLE IF NOT EXISTS session_puzzles (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      display_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_hints (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      asset_url TEXT,
      delivered_by TEXT NOT NULL,
      delivered_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timer_slugs (
      slug TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      narrative TEXT
    );

    CREATE TABLE IF NOT EXISTS network_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ssid TEXT NOT NULL,
      description TEXT,
      band TEXT,
      channel INTEGER,
      security TEXT,
      broadcast_enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'offline',
      status_message TEXT,
      details TEXT,
      last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS network_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      last_checked TEXT NOT NULL
    );
  `);

  // Ensure new columns exist for legacy databases
  ensureColumn('operators', 'email', 'TEXT');
  ensureColumn('operators', 'must_reset_password', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('operators', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('operators', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('operators', 'last_login_at', 'TEXT');
  ensureColumn('operators', 'password_hash', 'TEXT NOT NULL DEFAULT ""');
  ensureColumn('operators', 'bio', 'TEXT');

  ensureColumn('games', 'story_intro', 'TEXT');
  ensureColumn('games', 'categories', 'TEXT');
  ensureColumn('games', 'min_players', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('games', 'max_players', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('games', 'price_per_player_cents', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('games', 'resources_required', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('games', 'validation_notes', 'TEXT');
  ensureColumn('games', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('games', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');

  schemaReady = true;
}

runMigrations();
