ALTER TABLE operators RENAME COLUMN password TO password_hash;
ALTER TABLE operators ADD COLUMN email TEXT;
ALTER TABLE operators ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE operators ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE operators ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE operators ADD COLUMN last_login_at TEXT;

ALTER TABLE games ADD COLUMN categories TEXT NOT NULL DEFAULT '[]';
ALTER TABLE games ADD COLUMN min_players INTEGER NOT NULL DEFAULT 1;
ALTER TABLE games ADD COLUMN max_players INTEGER NOT NULL DEFAULT 1;
ALTER TABLE games ADD COLUMN price_per_player_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN resources_required INTEGER NOT NULL DEFAULT 1;
ALTER TABLE games ADD COLUMN story_intro TEXT;
ALTER TABLE games ADD COLUMN validation_notes TEXT;
ALTER TABLE games ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE games ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

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

CREATE INDEX IF NOT EXISTS idx_game_puzzles_game_id ON game_puzzles(game_id);

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
