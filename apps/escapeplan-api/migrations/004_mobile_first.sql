-- Mobile-first admin overhaul schema updates

-- Extend games table with JSON configs for media, pricing, booking rules
ALTER TABLE games ADD COLUMN media_config TEXT;
ALTER TABLE games ADD COLUMN pricing_config TEXT;
ALTER TABLE games ADD COLUMN booking_rules_config TEXT;

-- Support ad-hoc session metadata on bookings
ALTER TABLE bookings ADD COLUMN is_adhoc INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_is_adhoc ON bookings(is_adhoc);
