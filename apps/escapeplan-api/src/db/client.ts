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
      email TEXT UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL,
      avatar_config TEXT,
      bio TEXT,
      permissions TEXT NOT NULL DEFAULT '[]',
      must_reset_password INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      banned INTEGER NOT NULL DEFAULT 0,
      ban_reason TEXT,
      ban_expires TEXT,
      archived_at TEXT,
      archived_by TEXT,
      archived_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS operator_auth_sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT,
      impersonated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS operator_accounts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at TEXT,
      refresh_token_expires_at TEXT,
      scope TEXT,
      password TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operator_verifications (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      archived_at TEXT,
      archived_by TEXT,
      archived_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      uuid TEXT UNIQUE,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_mobile_capable INTEGER NOT NULL DEFAULT 0,
      theme_token TEXT,
      description TEXT,
      slug TEXT,
      capacity INTEGER
    );

    CREATE TABLE IF NOT EXISTS game_puzzles (
      id TEXT PRIMARY KEY,
      uuid TEXT UNIQUE,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      solution TEXT,
      media_asset TEXT,
      operator_actions TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      hints TEXT,
      media_asset_meta TEXT
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
      timer_total_elapsed_seconds INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      asset_type TEXT NOT NULL,
      media_type TEXT,
      file_path TEXT NOT NULL,
      game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
      puzzle_id TEXT,
      hint_order INTEGER,
      is_reusable INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL REFERENCES operators(id),
      uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_assets_game_id ON assets(game_id);
    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
    CREATE INDEX IF NOT EXISTS idx_assets_reusable ON assets(is_reusable);

    CREATE TABLE IF NOT EXISTS asset_usage (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      used_in_game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
      used_in_puzzle_id TEXT,
      usage_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_asset_usage_asset ON asset_usage(asset_id);
    CREATE INDEX IF NOT EXISTS idx_asset_usage_game ON asset_usage(used_in_game_id);

    CREATE TABLE IF NOT EXISTS storage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_size_bytes INTEGER NOT NULL,
      total_files INTEGER NOT NULL,
      by_type TEXT NOT NULL,
      by_game TEXT NOT NULL,
      last_backup_at TEXT,
      recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure new columns exist for legacy databases
  ensureColumn('operators', 'email', 'TEXT');
  ensureColumn('operators', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('operators', 'permissions', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('operators', 'must_reset_password', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('operators', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('operators', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('operators', 'last_login_at', 'TEXT');
  ensureColumn('operators', 'password_hash', 'TEXT');
  ensureColumn('operators', 'bio', 'TEXT');
  ensureColumn('operators', 'banned', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('operators', 'ban_reason', 'TEXT');
  ensureColumn('operators', 'ban_expires', 'TEXT');
  ensureColumn('operators', 'archived_at', 'TEXT');
  ensureColumn('operators', 'archived_by', 'TEXT');
  ensureColumn('operators', 'archived_reason', 'TEXT');

  sqlite.exec(`
    UPDATE operators SET role = 'manager' WHERE role = 'general_manager';
    UPDATE operators SET role = 'game_master' WHERE role = 'technician';
  `);

  ensureColumn('games', 'story_intro', 'TEXT');
  ensureColumn('games', 'categories', 'TEXT');
  ensureColumn('games', 'min_players', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('games', 'max_players', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('games', 'price_per_player_cents', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('games', 'resources_required', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('games', 'validation_notes', 'TEXT');
  ensureColumn('games', 'media_config', 'TEXT');
  ensureColumn('games', 'pricing_config', 'TEXT');
  ensureColumn('games', 'booking_rules_config', 'TEXT');
  ensureColumn('games', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('games', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('games', 'archived_at', 'TEXT');
  ensureColumn('games', 'archived_by', 'TEXT');
  ensureColumn('games', 'archived_reason', 'TEXT');

  ensureColumn('rooms', 'uuid', 'TEXT');
  ensureColumn('rooms', 'description', 'TEXT');
  ensureColumn('rooms', 'slug', 'TEXT');
  ensureColumn('rooms', 'capacity', 'INTEGER');

  ensureColumn('bookings', 'is_adhoc', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('bookings', 'notes', 'TEXT');

  ensureColumn('game_puzzles', 'uuid', 'TEXT');
  ensureColumn('game_puzzles', 'slug', 'TEXT');
  ensureColumn('game_puzzles', 'hints', 'TEXT');
  ensureColumn('game_puzzles', 'media_asset_meta', 'TEXT');

  sqlite.exec(`
    UPDATE operators SET email_verified = 0 WHERE email_verified IS NULL;
    UPDATE operators SET permissions = json('[]') WHERE permissions IS NULL;
    UPDATE operators SET banned = 0 WHERE banned IS NULL;
    UPDATE rooms SET uuid = id WHERE uuid IS NULL OR uuid = '';
    UPDATE game_puzzles SET uuid = id WHERE uuid IS NULL OR uuid = '';
  `);

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_uuid ON rooms(uuid);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_game_puzzles_uuid ON game_puzzles(uuid);
  `);

  schemaReady = true;
}

runMigrations();
