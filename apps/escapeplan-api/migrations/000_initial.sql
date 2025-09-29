CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_url TEXT,
  permissions TEXT NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  difficulty TEXT,
  pricing_model TEXT,
  category TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  name TEXT NOT NULL,
  is_mobile_capable INTEGER NOT NULL DEFAULT 0,
  theme_token TEXT
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
  session_id TEXT NOT NULL REFERENCES sessions(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_hints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  asset_url TEXT,
  delivered_by TEXT NOT NULL,
  delivered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timer_slugs (
  slug TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  narrative TEXT
);

CREATE TABLE IF NOT EXISTS network_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  last_checked TEXT NOT NULL
);
