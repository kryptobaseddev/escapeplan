-- ============================================================================
-- FIX NULL CONFIGS IN GAMES TABLE
-- ============================================================================
-- Task: Fix NULL pricing_config, media_config, booking_rules_config
-- Game: Pirate Mutiny
-- Production Server: 10.0.10.138 (escapeplan/escapeplan)
-- Created: 2025-10-06
-- ============================================================================

-- STEP 1: BACKUP - Create backup table
.output /tmp/games_backup_20251006.sql
.dump games
.output stdout

-- STEP 2: VERIFY CURRENT NULL VALUES
.mode column
.headers on
SELECT
    id,
    slug,
    name,
    CASE WHEN pricing_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as pricing_config,
    CASE WHEN media_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as media_config,
    CASE WHEN booking_rules_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as booking_rules_config
FROM games
WHERE pricing_config IS NULL
   OR media_config IS NULL
   OR booking_rules_config IS NULL;

-- STEP 3: UPDATE pricing_config with valid JSON defaults
UPDATE games
SET pricing_config = '{"tiers":[{"id":"tier-1","label":"Standard","model":"per_person","priceCents":2000,"minPlayers":1,"maxPlayers":5,"displayOrder":1,"active":true}],"discounts":[]}'
WHERE pricing_config IS NULL;

-- STEP 4: UPDATE media_config with valid JSON defaults
UPDATE games
SET media_config = '{"galleryAssetIds":[]}'
WHERE media_config IS NULL;

-- STEP 5: UPDATE booking_rules_config with valid JSON defaults
UPDATE games
SET booking_rules_config = '{"isMobile":false,"reservationStyle":"public","customFields":[]}'
WHERE booking_rules_config IS NULL;

-- STEP 6: VERIFY UPDATES
.print "\n=== VERIFICATION: After Update ==="
SELECT
    id,
    slug,
    name,
    CASE WHEN pricing_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as pricing_config,
    CASE WHEN media_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as media_config,
    CASE WHEN booking_rules_config IS NULL THEN 'NULL' ELSE 'NOT NULL' END as booking_rules_config,
    LENGTH(pricing_config) as pricing_len,
    LENGTH(media_config) as media_len,
    LENGTH(booking_rules_config) as booking_len
FROM games
WHERE id = '431402af-463f-4173-b9a9-1b8d48efd273';

-- STEP 7: VALIDATE JSON
.print "\n=== JSON VALIDATION ==="
SELECT
    'Pirate Mutiny' as game_name,
    json_valid(pricing_config) as pricing_valid,
    json_valid(media_config) as media_valid,
    json_valid(booking_rules_config) as booking_valid
FROM games
WHERE id = '431402af-463f-4173-b9a9-1b8d48efd273';

-- STEP 8: DISPLAY FINAL STATE
.print "\n=== FINAL STATE: All Games ==="
.mode line
SELECT
    id,
    slug,
    name,
    pricing_config,
    media_config,
    booking_rules_config
FROM games
WHERE id = '431402af-463f-4173-b9a9-1b8d48efd273';
