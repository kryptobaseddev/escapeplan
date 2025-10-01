import { sqlite } from './client.js';

/**
 * Initialize database schema from scratch.
 * This script creates all tables defined in schema.ts.
 * Run this ONLY when you want to reset the database completely.
 */
export function initializeSchema() {
  console.log('Initializing database schema...');

  sqlite.exec(`
    -- ============================================================================
    -- AUTH & OPERATORS
    -- ============================================================================

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

    -- ============================================================================
    -- GAMES & ROOMS
    -- ============================================================================

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
      media_config TEXT,
      pricing_config TEXT,
      booking_rules_config TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      archived_at TEXT,
      archived_by TEXT,
      archived_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
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
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      solution TEXT,
      media_asset TEXT,
      operator_actions TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      hints TEXT,
      media_asset_meta TEXT,
      slug TEXT
    );

    -- ============================================================================
    -- BOOKINGS & SESSIONS
    -- ============================================================================

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
      is_adhoc INTEGER NOT NULL DEFAULT 0,
      location_note TEXT,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      notes TEXT
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
      crew_support TEXT
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

    -- ============================================================================
    -- ASSETS & STORAGE
    -- ============================================================================

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

    -- ============================================================================
    -- NETWORK
    -- ============================================================================

    CREATE TABLE IF NOT EXISTS network_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ssid TEXT NOT NULL,
      password TEXT,
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

    -- ============================================================================
    -- LOGGING & ALERTING
    -- ============================================================================

    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
    CREATE INDEX IF NOT EXISTS idx_logs_category ON system_logs(category);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON system_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      dismissed_at TEXT,
      dismissed_by TEXT REFERENCES operators(id)
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_session ON alerts(session_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level);
    CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(dismissed_at) WHERE dismissed_at IS NULL;

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      category TEXT NOT NULL,
      level TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      conditions TEXT NOT NULL,
      title_template TEXT NOT NULL,
      message_template TEXT NOT NULL,
      auto_dismiss_on TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
    CREATE INDEX IF NOT EXISTS idx_alert_rules_category ON alert_rules(category);
  `);

  console.log('✅ Database schema initialized successfully');
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeSchema();
}
