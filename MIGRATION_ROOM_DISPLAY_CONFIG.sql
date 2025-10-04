-- ============================================================================
-- MIGRATION: Room Display Config Schema Changes
-- Date: 2025-10-03
-- Description: Add room_display_config to games table and display settings
--              to game_milestones table. Remove deprecated roomScreenAssetId.
-- ============================================================================

-- Add room_display_config column to games table
-- This replaces the deprecated media_config.roomScreenAssetId with a comprehensive
-- configuration system for Room Display backgrounds and visual settings
ALTER TABLE games ADD COLUMN room_display_config TEXT;

-- Add media display settings to game_milestones table
-- These settings control how milestone media is displayed on the Room Display screen
ALTER TABLE game_milestones ADD COLUMN display_duration_seconds INTEGER;
ALTER TABLE game_milestones ADD COLUMN loop INTEGER DEFAULT 0; -- boolean: 0=false, 1=true
ALTER TABLE game_milestones ADD COLUMN loop_count INTEGER; -- NULL = infinite when loop=1
ALTER TABLE game_milestones ADD COLUMN auto_dismiss INTEGER DEFAULT 1; -- boolean: 0=false, 1=true

-- NOTE: The following cleanup is for reference only. Do NOT run these commands
-- as they would break existing data. The application code has been updated to
-- ignore roomScreenAssetId in media_config JSON fields.
--
-- DEPRECATED FIELD (do not remove from database, just stop using):
-- - games.media_config JSON field contains deprecated roomScreenAssetId
-- - This field is now ignored by application code
-- - Room Display backgrounds are now configured via games.room_display_config
--
-- Migration path for existing data:
-- 1. If games.media_config.roomScreenAssetId exists, consider migrating to:
--    games.room_display_config = {
--      "backgroundType": "asset",
--      "backgroundAssetId": "<value from roomScreenAssetId>",
--      "backgroundOpacity": 40,
--      "defaultMediaScale": 90,
--      "showTimer": true,
--      "timerPosition": "center",
--      "textHintTextColor": "#000000",
--      "textHintBackgroundColor": "#FFA500"
--    }

-- ============================================================================
-- VALIDATION CHECKS (Optional - run to verify migration)
-- ============================================================================

-- Verify room_display_config column exists
SELECT COUNT(*) as games_with_room_display_config
FROM pragma_table_info('games')
WHERE name = 'room_display_config';

-- Verify game_milestones display settings columns exist
SELECT COUNT(*) as milestone_display_columns
FROM pragma_table_info('game_milestones')
WHERE name IN ('display_duration_seconds', 'loop', 'loop_count', 'auto_dismiss');

-- Check for games with deprecated roomScreenAssetId that might need migration
-- (This query shows JSON parsing - implementation depends on SQLite version)
-- SELECT id, name, media_config
-- FROM games
-- WHERE media_config LIKE '%roomScreenAssetId%';
