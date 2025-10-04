# Room Display Migration Guide

## Overview
This guide covers migrating from the old timer-only display to the new media-enabled Room Display system.

## Breaking Changes

### Route Changes
**Frontend:**
- OLD: `/timer/[slug]`
- NEW: `/room/[slug]`

**API:**
- OLD: `/api/public/timer/:slug`
- NEW: `/api/public/room/:slug`

**Action:** Update bookmarks, QR codes, documentation, API client calls

### Schema Changes

#### games.media_config
**REMOVED:** `roomScreenAssetId`
**REPLACED BY:** `room_display_config.backgroundAssetId`

#### games table
**ADDED:** `room_display_config` (JSON)

#### game_milestones table
**ADDED:**
- `display_duration_seconds`
- `loop`
- `loop_count`
- `auto_dismiss`

#### game_puzzles.hints (JSON)
**ADDED to each hint object:**
- `displayDurationSeconds`
- `loop`
- `loopCount`
- `autoDismiss`

### API Changes

#### send_hint command
**NEW payload fields:**
- `displayDurationSeconds`
- `loop`
- `loopCount`
- `autoDismiss`

#### WebSocket Events
**REMOVED:** `hintBanner` from TimerBroadcast
**ADDED:** `room-display:media` event

## Migration Steps

### 1. Database Migration
```sql
-- Add room_display_config to games
ALTER TABLE games ADD COLUMN room_display_config TEXT;

-- Add display settings to game_milestones
ALTER TABLE game_milestones ADD COLUMN display_duration_seconds INTEGER;
ALTER TABLE game_milestones ADD COLUMN loop INTEGER DEFAULT 0;
ALTER TABLE game_milestones ADD COLUMN loop_count INTEGER;
ALTER TABLE game_milestones ADD COLUMN auto_dismiss INTEGER DEFAULT 1;

-- Migrate existing roomScreenAssetId (if any games use it)
UPDATE games
SET room_display_config = json_object(
  'backgroundType', 'asset',
  'backgroundAssetId', json_extract(media_config, '$.roomScreenAssetId'),
  'backgroundOpacity', 40,
  'defaultMediaScale', 90,
  'showTimer', 1,
  'timerPosition', 'center'
)
WHERE media_config IS NOT NULL
  AND json_extract(media_config, '$.roomScreenAssetId') IS NOT NULL;

-- Remove deprecated field
UPDATE games
SET media_config = json_remove(media_config, '$.roomScreenAssetId')
WHERE media_config IS NOT NULL;
```

### 2. Update Game Configurations
- Review each game's Room Display settings
- Set background type (asset/solid/gradient)
- Configure text hint colors if needed
- Set default media scale (90% recommended)

### 3. Update Hints
- Add `displayDurationSeconds` to all image hints (15 seconds default)
- Configure loop settings for audio/video hints if needed

### 4. Update Milestones
- Add `display_duration_seconds` to image milestones
- Configure auto-dismiss settings

### 5. Test Room Display
- Open `/room/[slug]` for each game
- Send text/image/audio/video hints
- Trigger milestones
- Verify background displays correctly
- Verify auto-dismiss timers work

## Rollback Plan

If issues arise, Room Display can be temporarily disabled:

```typescript
// In room_display_config
{
  "showTimer": true,
  "backgroundType": "solid",
  "backgroundColor": "#1a1a1a"
}
```

This provides a minimal dark background with timer only.
