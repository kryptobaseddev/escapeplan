# Room Display Media Research

**Date:** 2025-10-03
**Purpose:** Research how Room Display timer, backgrounds, and media hints currently work, and identify requirements for sending headless media (audio/video/image) to the Room Display screen.

**Note:** This document contains historical research. Routes have since been renamed:
- Frontend: `/timer/[slug]` → `/room/[slug]`
- API: `/api/public/timer/:slug` → `/api/public/room/:slug`

---

## 1. Current Room Display Implementation

### 1.1 Room Display Timer Page

**Location:** `/apps/escapeplan-web/src/routes/(public)/timer/[slug]/+page.svelte`

**Current Features:**
- **Public unauthenticated page** accessed via `/timer/{game-slug}`
- Displays game timer countdown in large text (formatTimer utility)
- Shows game name and session ID
- Displays hint banners when hints are sent (last hint message shown)
- Real-time updates via Socket.IO `timer:update` events
- Fallback polling every 5 seconds if WebSocket unavailable
- Background gradient overlay with primary/secondary color accents
- **NO background image/video currently displayed** (only gradient)

**Current Background Implementation:**
```typescript
// Line 78-81 of +page.svelte
<section class="relative flex min-h-screen flex-col items-center justify-center
         overflow-hidden text-center bg-base-300">
  <div class="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/85"></div>
  <div class="absolute inset-x-0 top-0 h-48 bg-gradient-to-br from-primary/30 via-transparent to-secondary/30"></div>
```

**Data Structure Received (`TimerBroadcast`):**
```typescript
interface TimerBroadcast {
  slug: string;
  sessionId: string;
  gameName: string;
  roomName: string;
  narrative?: string;
  background: {
    type: 'image' | 'video';
    url: string;
  };
  timer: TimerState;
  hintBanner?: {
    message: string;
    shownAt: string;
  };
}
```

**Current Background Data Source:**
- **File:** `/apps/escapeplan-api/src/state.ts:1985-2003` (`toTimerBroadcast` function)
- **Current behavior:** Uses `streamThumbnailUrl` (camera feed) as background fallback
- **Hardcoded fallback:** `https://placehold.co/1200x800?text=EscapePlan`
- **NOT using `roomScreenAssetId`** from game's `media_config`

```typescript
// Current implementation (state.ts:1992-1995)
background: {
  type: 'image',
  url: details.streamThumbnailUrl ?? 'https://placehold.co/1200x800?text=EscapePlan'
}
```

---

## 2. Room Display Background Feature

### 2.1 Game Media Configuration

**Schema Location:** `/packages/contracts/src/schema.ts:161`

```typescript
media_config: text('media_config', { mode: 'json' })
```

**Type Definition:** `/packages/contracts/src/validation.ts:60-64`

```typescript
export const mediaConfigSchema = z.object({
  thumbnailAssetId: z.string().optional(),
  roomScreenAssetId: z.string().optional(),  // ← Room Display background
  galleryAssetIds: z.array(z.string()).default([])
}).optional();

export type GameMediaConfig = z.infer<typeof mediaConfigSchema>;
```

**Purpose:**
- `roomScreenAssetId`: Asset ID for Room Display background (image or video)
- When set in game settings, should display on Room Display screen
- Currently stored in `games.media_config` JSON field but **NOT used** in `toTimerBroadcast`

**How to Set:**
- Game edit modal: `/apps/escapeplan-web/src/lib/components/games/GameModal.svelte`
- "Room Display Background" section in GameMediaSection component
- Asset selected via AssetBrowser component

---

## 3. Hint System (Text vs. Media Hints)

### 3.1 Current Hint Delivery (Text Only)

**Game Runner Hint Form:** `/apps/escapeplan-web/src/routes/(app)/games/[sessionId]/+page.svelte:449-466`

```svelte
<form class="mt-5 space-y-4" onsubmit={handleHint}>
  <textarea name="message" required rows="3"></textarea>
  <select name="medium">
    <option value="text">Text</option>
    <option value="image">Image</option>
    <option value="audio">Audio</option>
    <option value="video">Video</option>
  </select>
  <button type="submit">Send hint</button>
</form>
```

**Current Behavior:**
- Sends `send_hint` command via WebSocket
- Payload: `{ message: string, medium: 'text' | 'image' | 'audio' | 'video' }`
- **Only text message is sent** - no asset URL, no media playback
- Stored in `session_hints` table with `asset_url` field (currently always NULL)

**Hint Storage Schema:**
```typescript
// session_hints table
{
  id: string;
  session_id: string;
  type: 'text' | 'image' | 'audio' | 'video';
  message: string;
  asset_url: string | null;  // ← Currently always NULL
  delivered_by: string;
  delivered_at: string;
}
```

**Current `send_hint` Command:** `/apps/escapeplan-api/src/state.ts:2078-2101`

```typescript
case 'send_hint': {
  const message = String(command.payload?.message ?? '').trim();
  if (!message) {
    throw new Error('Hint message required');
  }
  const medium = String(command.payload?.medium ?? 'text');
  sqlite
    .prepare(`INSERT INTO session_hints (id, session_id, type, message, asset_url, delivered_by, delivered_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(`hint-${Date.now()}`, sessionId, medium, message, null, 'Console Operator', nowIso);
  // asset_url is hardcoded to NULL ↑
}
```

### 3.2 Puzzle Pre-Configured Hints

**Location:** `/apps/escapeplan-web/src/routes/(app)/games/[sessionId]/+page.svelte:395-435`

**How It Works:**
- Each puzzle can have pre-configured hints defined in game setup
- Hints include: `{ uuid, type, content, assetUrl?, volumeLevel?, order }`
- Quick-send buttons render for each puzzle's hints
- Clicking button calls `sendPuzzleHint(puzzleId, hint)`

**Puzzle Hint Delivery Function (lines 100-109):**
```typescript
async function sendPuzzleHint(puzzleId: string, hint: {
  content: string;
  type: string;
  assetUrl?: string;
  volumeLevel?: number
}) {
  hintFormError = null;
  await dispatchCommand('send_hint', {
    message: hint.content,
    medium: hint.type,
    assetUrl: hint.assetUrl,  // ← Asset URL IS sent for puzzle hints
    volumeLevel: hint.volumeLevel || session.gameDefaultVolume || 80,
    puzzleId
  });
}
```

**Key Finding:**
- Puzzle hints **DO support `assetUrl`** in payload
- API currently **ignores `assetUrl`** and sets it to NULL in database
- `volumeLevel` is included but also ignored in current implementation

---

## 4. Media Modal Component (Headless Mode)

### 4.1 MediaModal Component

**Location:** `/apps/escapeplan-web/src/lib/components/media/MediaModal.svelte`
**Documentation:** `/apps/DOCS/MEDIA_MODAL.md`

**Features:**
- Native HTML5 media elements (no external dependencies)
- Supports images, audio, video
- **Headless mode:** `showControls={false}` hides all controls
- Auto-play, looping, volume control
- Window scaling (10-100% of viewport)
- Asset details panel (optional, can be hidden)

**Headless Mode Example (from docs):**
```svelte
<MediaModal
  isOpen={isOpen}
  src="/assets/videos/hint-01.mp4"
  title="Hint Video"
  mediaType="video"
  windowScale={95}
  showControls={false}  <!-- Headless mode -->
  autoPlay={true}
  mediaLoop={true}
  onClose={() => isOpen = false}
/>
```

**Key Capabilities:**
- Can display media with NO controls
- Can hide asset details (filename, size, etc.)
- Can auto-play and loop
- Supports all three media types: image, audio, video

---

## 5. WebSocket Real-Time Communication

### 5.1 Current WebSocket Events

**Server Emitters:** `/apps/escapeplan-api/src/realtime.ts`

```typescript
export function emitSessionUpdate(session: GameSessionDetails) {
  io?.emit('session:update', session);
}

export function emitTimerUpdate(broadcast: TimerBroadcast) {
  io?.emit('timer:update', broadcast);
}

export function emitCommandAck(response: CommandResponse) {
  io?.emit('session:command', response);
}

export function emitDashboardUpdate(snapshot: DashboardResponse) {
  io?.emit('dashboard:update', snapshot);
}

export function emitBookingsUpdate(payload: BookingCalendarResponse) {
  io?.emit('bookings:update', payload);
}
```

**Client Listeners (Room Display):** `/apps/escapeplan-web/src/routes/(public)/timer/[slug]/+page.svelte:28-39`

```typescript
onMount(() => {
  const socket = getSocket();
  if (socket) {
    const handler = (broadcast: TimerBroadcast) => {
      if (broadcast.slug === params.slug) {
        timer = broadcast;
        errorMessage = null;
      }
    };
    socket.on('timer:update', handler);
    unsub = () => socket.off('timer:update', handler);
  }
});
```

**Current Events Used by Room Display:**
- `timer:update` - Updates timer countdown, hint banners, background
- **NO dedicated media playback event**

---

## 6. Gap Analysis: What's Missing for Media Hints

### 6.1 Missing Backend Support

**Problem 1: `assetUrl` Ignored in `send_hint` Command**
- **Location:** `/apps/escapeplan-api/src/state.ts:2086`
- **Current:** `asset_url` hardcoded to `null`
- **Needed:** Extract `assetUrl` from `command.payload` and store it

**Problem 2: `volumeLevel` Ignored**
- **Current:** Not extracted from payload
- **Needed:** Support volume control for audio/video hints

**Problem 3: Room Display Background Not Used**
- **Location:** `/apps/escapeplan-api/src/state.ts:1992-1995` (`toTimerBroadcast`)
- **Current:** Uses camera `streamThumbnailUrl` or placeholder
- **Needed:** Check `game.media.roomScreenAssetId` and construct URL `/api/assets/{assetId}`

### 6.2 Missing Frontend Support (Room Display)

**Problem 1: Background Not Rendered**
- **Location:** `/apps/escapeplan-web/src/routes/(public)/timer/[slug]/+page.svelte`
- **Current:** Only gradient background
- **Needed:** Render `timer.background.url` as `<img>` or `<video>` based on `timer.background.type`

**Problem 2: No Media Playback for Hints**
- **Current:** Only text hints displayed in banner
- **Needed:** Detect when hint has `assetUrl` and media type, trigger MediaModal or direct playback

**Problem 3: No Dedicated Media Display Event**
- **Current:** Hints only update `hintBanner` text in `TimerBroadcast`
- **Needed:** Either:
  - Option A: Extend `TimerBroadcast` with `activeMedia?: { type, url, volumeLevel }`
  - Option B: New WebSocket event `room-display:media` with media playback instructions

---

## 7. Proposed Implementation Approach

### 7.1 Fix Room Display Background

**Step 1: Update `toTimerBroadcast` Function**

**File:** `/apps/escapeplan-api/src/state.ts:1985-2003`

**Current:**
```typescript
background: {
  type: 'image',
  url: details.streamThumbnailUrl ?? 'https://placehold.co/1200x800?text=EscapePlan'
}
```

**Proposed:**
```typescript
// Fetch game to get media_config
const game = getGameById(details.gameId);
const mediaConfig = game?.media;
const backgroundUrl = mediaConfig?.roomScreenAssetId
  ? `/api/assets/${mediaConfig.roomScreenAssetId}`
  : details.streamThumbnailUrl ?? 'https://placehold.co/1200x800?text=EscapePlan';

// Determine type based on asset metadata (requires asset lookup)
const backgroundType = determineAssetType(mediaConfig?.roomScreenAssetId) ?? 'image';

background: {
  type: backgroundType,
  url: backgroundUrl
}
```

**Step 2: Render Background on Room Display**

**File:** `/apps/escapeplan-web/src/routes/(public)/timer/[slug]/+page.svelte:77-94`

**Proposed:**
```svelte
<section class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center">
  <!-- Background Media -->
  {#if timer.background.type === 'video'}
    <video
      class="absolute inset-0 w-full h-full object-cover opacity-40"
      src={timer.background.url}
      autoplay
      muted
      loop
      playsinline
    ></video>
  {:else}
    <img
      class="absolute inset-0 w-full h-full object-cover opacity-40"
      src={timer.background.url}
      alt="Room background"
    />
  {/if}

  <!-- Gradient overlay (keep for text readability) -->
  <div class="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/85"></div>

  <!-- Timer and hint content (existing) -->
  <div class="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 px-6">
    <!-- ... existing timer display ... -->
  </div>
</section>
```

---

### 7.2 Enable Media Hints to Room Display

**Option A: Extend TimerBroadcast with Active Media**

**Pros:**
- Reuses existing `timer:update` event
- Simple implementation
- Media state tied to session state

**Cons:**
- Media playback state managed in `TimerBroadcast`
- Requires tracking "active media" in session

**Implementation:**

**Step 1: Update `TimerBroadcast` Type**

**File:** `/packages/contracts/src/index.ts:277-292`

```typescript
export interface TimerBroadcast {
  slug: string;
  sessionId: string;
  gameName: string;
  roomName: string;
  narrative?: string;
  background: {
    type: 'image' | 'video';
    url: string;
  };
  timer: TimerState;
  hintBanner?: {
    message: string;
    shownAt: string;
  };
  activeMedia?: {  // ← NEW
    type: 'image' | 'audio' | 'video';
    url: string;
    volumeLevel?: number;
    loop?: boolean;
    triggeredAt: string;
  };
}
```

**Step 2: Update `send_hint` Command**

**File:** `/apps/escapeplan-api/src/state.ts:2078-2101`

```typescript
case 'send_hint': {
  const message = String(command.payload?.message ?? '').trim();
  if (!message) {
    throw new Error('Hint message required');
  }
  const medium = String(command.payload?.medium ?? 'text');
  const assetUrl = command.payload?.assetUrl ? String(command.payload.assetUrl) : null;
  const volumeLevel = command.payload?.volumeLevel ? Number(command.payload.volumeLevel) : null;

  sqlite
    .prepare(`INSERT INTO session_hints (id, session_id, type, message, asset_url, volume_level, delivered_by, delivered_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`hint-${Date.now()}`, sessionId, medium, message, assetUrl, volumeLevel, 'Console Operator', nowIso);

  sqlite
    .prepare(`UPDATE sessions SET hints_used = hints_used + 1 WHERE id = ?`)
    .run(sessionId);

  // Store active media for Room Display (if media hint)
  if (assetUrl && medium !== 'text') {
    sqlite
      .prepare(`UPDATE sessions SET active_media = ? WHERE id = ?`)
      .run(JSON.stringify({
        type: medium,
        url: assetUrl,
        volumeLevel: volumeLevel ?? session.gameDefaultVolume,
        triggeredAt: nowIso
      }), sessionId);
  }

  logToDatabase('info', 'session', `Hint sent: ${message.substring(0, 50)}`, {
    sessionId,
    gameName: session.gameName,
    roomName: session.roomName,
    medium,
    hasAsset: !!assetUrl
  });
  break;
}
```

**Step 3: Include Active Media in `toTimerBroadcast`**

**File:** `/apps/escapeplan-api/src/state.ts:1985-2003`

```typescript
export function toTimerBroadcast(slug: string, details: GameSessionDetails, narrative?: string): TimerBroadcast {
  // Get active media from session (if exists)
  const session = sqlite.prepare('SELECT active_media FROM sessions WHERE id = ?').get(details.id);
  const activeMedia = session?.active_media ? JSON.parse(session.active_media) : null;

  return {
    slug,
    sessionId: details.id,
    gameName: details.gameName,
    roomName: details.roomName,
    narrative,
    background: {
      type: 'image',
      url: details.streamThumbnailUrl ?? 'https://placehold.co/1200x800?text=EscapePlan'
    },
    timer: details.timer,
    hintBanner: details.hintLog.length
      ? {
          message: details.hintLog[details.hintLog.length - 1]!.message,
          shownAt: details.hintLog[details.hintLog.length - 1]!.deliveredAt
        }
      : undefined,
    activeMedia  // ← NEW
  };
}
```

**Step 4: Render Active Media on Room Display**

**File:** `/apps/escapeplan-web/src/routes/(public)/timer/[slug]/+page.svelte`

```svelte
<script>
  import MediaModal from '$lib/components/media/MediaModal.svelte';

  // ... existing code ...

  let activeMedia = $derived(timer?.activeMedia);
  let mediaModalOpen = $state(false);

  $effect(() => {
    // When new media hint arrives, open modal
    if (activeMedia && activeMedia.triggeredAt !== lastMediaTriggeredAt) {
      mediaModalOpen = true;
      lastMediaTriggeredAt = activeMedia.triggeredAt;
    }
  });
</script>

<!-- Existing timer display -->
<section>
  <!-- ... existing timer/hint banner ... -->
</section>

<!-- Media Modal for Headless Playback -->
{#if activeMedia}
  <MediaModal
    isOpen={mediaModalOpen}
    src={activeMedia.url}
    title="Game Hint"
    mediaType={activeMedia.type}
    windowScale={100}
    showControls={false}
    autoPlay={true}
    mediaLoop={activeMedia.loop ?? false}
    onClose={() => mediaModalOpen = false}
  />
{/if}
```

---

**Option B: New Dedicated WebSocket Event**

**Pros:**
- Cleaner separation of concerns
- No session state pollution
- Supports one-time media playback without persistence

**Cons:**
- More complex (two events instead of one)
- Room Display must listen to two events

**Implementation:**

**Step 1: Add New Event Emitter**

**File:** `/apps/escapeplan-api/src/realtime.ts`

```typescript
export interface RoomDisplayMediaCommand {
  slug: string;
  mediaType: 'image' | 'audio' | 'video';
  url: string;
  volumeLevel?: number;
  loop?: boolean;
  duration?: number; // Optional auto-close after N seconds
}

export function emitRoomDisplayMedia(command: RoomDisplayMediaCommand) {
  io?.emit('room-display:media', command);
}
```

**Step 2: Emit Media Event on Hint Send**

**File:** `/apps/escapeplan-api/src/state.ts:2078-2101`

```typescript
case 'send_hint': {
  // ... existing hint storage ...

  // If media hint, broadcast to Room Display
  if (assetUrl && medium !== 'text') {
    const timerSlugs = timerSlugBySessionStmt.all(sessionId) as { slug: string }[];
    for (const { slug } of timerSlugs) {
      emitRoomDisplayMedia({
        slug,
        mediaType: medium as 'image' | 'audio' | 'video',
        url: assetUrl,
        volumeLevel: volumeLevel ?? session.gameDefaultVolume,
        loop: false
      });
    }
  }
  break;
}
```

**Step 3: Listen for Media Event on Room Display**

**File:** `/apps/escapeplan-web/src/routes/(public)/timer/[slug]/+page.svelte`

```svelte
<script>
  import MediaModal from '$lib/components/media/MediaModal.svelte';

  let mediaCommand = $state(null);
  let mediaModalOpen = $state(false);

  onMount(() => {
    const socket = getSocket();
    if (socket) {
      // Existing timer listener
      socket.on('timer:update', timerHandler);

      // NEW: Media playback listener
      socket.on('room-display:media', (cmd: RoomDisplayMediaCommand) => {
        if (cmd.slug === params.slug) {
          mediaCommand = cmd;
          mediaModalOpen = true;
        }
      });
    }
  });
</script>

<!-- Media Modal -->
{#if mediaCommand}
  <MediaModal
    isOpen={mediaModalOpen}
    src={mediaCommand.url}
    title="Game Hint"
    mediaType={mediaCommand.mediaType}
    windowScale={100}
    showControls={false}
    autoPlay={true}
    mediaLoop={mediaCommand.loop ?? false}
    onClose={() => mediaModalOpen = false}
  />
{/if}
```

---

## 8. Database Schema Changes Required

### 8.1 Add Missing Columns to `session_hints`

**File:** `/packages/contracts/src/schema.ts` (session_hints table)

**Current:**
```typescript
export const sessionHints = sqliteTable('session_hints', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'text' | 'image' | 'audio' | 'video'
  message: text('message').notNull(),
  asset_url: text('asset_url'),  // ← Already exists but unused
  delivered_by: text('delivered_by').notNull(),
  delivered_at: text('delivered_at').notNull()
});
```

**Needed (Option A):**
```typescript
export const sessionHints = sqliteTable('session_hints', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  message: text('message').notNull(),
  asset_url: text('asset_url'),
  volume_level: integer('volume_level'),  // ← NEW: 0-100
  delivered_by: text('delivered_by').notNull(),
  delivered_at: text('delivered_at').notNull()
});
```

### 8.2 Add Active Media Column to `sessions` (Option A Only)

**File:** `/packages/contracts/src/schema.ts` (sessions table)

```typescript
export const sessions = sqliteTable('sessions', {
  // ... existing columns ...
  active_media: text('active_media', { mode: 'json' }),  // ← NEW: Stores current Room Display media
});
```

**Type:**
```typescript
interface ActiveMediaState {
  type: 'image' | 'audio' | 'video';
  url: string;
  volumeLevel?: number;
  loop?: boolean;
  triggeredAt: string;
}
```

---

## 9. Implementation Recommendations

### 9.1 Recommended Approach: Option A (Extend TimerBroadcast)

**Rationale:**
- Simpler for MVP (single event)
- Room Display state is self-contained
- Easier to test and debug
- Natural fit with existing `timer:update` pattern

**Drawbacks:**
- Requires session state management
- Media persists until cleared (need clear mechanism)

### 9.2 Implementation Order

**Phase 1: Room Display Background (Highest Priority)**
1. Update `toTimerBroadcast` to use `media.roomScreenAssetId`
2. Add background rendering to Room Display page
3. Test with image and video backgrounds

**Phase 2: Media Hint Infrastructure**
1. Add `volume_level` column to `session_hints` table
2. Update `send_hint` command to accept and store `assetUrl` and `volumeLevel`
3. Add `active_media` column to `sessions` table

**Phase 3: Room Display Media Playback**
1. Extend `TimerBroadcast` interface with `activeMedia`
2. Update `toTimerBroadcast` to include active media
3. Add MediaModal integration to Room Display page
4. Test with all three media types (image, audio, video)

**Phase 4: Media Clearing Mechanism**
1. Add `clear_media` command to remove active media
2. Auto-clear after media playback completes (for images/audio with duration)
3. UI button in Game Runner to manually clear Room Display media

### 9.3 Testing Checklist

**Room Display Background:**
- [ ] Image background displays correctly
- [ ] Video background plays, loops, and is muted
- [ ] Gradient overlay maintains text readability
- [ ] Fallback to camera stream if no background configured
- [ ] Fallback to placeholder if no camera or background

**Media Hints:**
- [ ] Text hints still work (existing behavior)
- [ ] Image hints display on Room Display
- [ ] Audio hints play on Room Display at correct volume
- [ ] Video hints play on Room Display with volume control
- [ ] Headless mode (no controls, no asset details)
- [ ] Auto-play works
- [ ] Loop setting respected
- [ ] Media clears after playback or manual clear

**WebSocket Reliability:**
- [ ] Media syncs immediately when online
- [ ] Graceful degradation when offline
- [ ] No duplicate playback on reconnect
- [ ] Timer continues updating during media playback

---

## 10. Additional Considerations

### 10.1 Asset Type Detection

**Challenge:** `TimerBroadcast.background.type` requires knowing if asset is image or video.

**Solutions:**
1. Store `mime_type` in `assets` table and query it
2. Use file extension heuristic (`.mp4` = video, `.jpg` = image)
3. Default to `image` and let browser handle errors

**Recommended:** Query `assets` table for accurate type detection.

### 10.2 Video Autoplay Policy

**Browser Restriction:** Most browsers block autoplay of videos with audio.

**Workarounds:**
- Background videos: Mute them (already planned)
- Hint videos: Require user interaction OR mute by default
- Audio hints: Will always autoplay (no video element restriction)

### 10.3 Performance on Raspberry Pi

**Concern:** Video decoding may strain Pi CPU.

**Mitigations:**
- Recommend H.264 codec (hardware accelerated on Pi)
- Limit video resolution to 1080p max
- Provide admin warnings for large video files
- Consider video compression guidelines in docs

### 10.4 Multiple Room Displays

**Use Case:** Some games may have multiple displays (e.g., lobby + room).

**Current Support:**
- `timer_display_configs` table already supports multiple slugs per session
- Each slug can have different `narrative` text
- **Question:** Should each slug support different media?

**Recommendation:** Not for MVP - all Room Displays for a session show same media.

---

## 11. Summary of Findings

### What Currently Works:
✅ Room Display timer countdown
✅ Hint text banners on Room Display
✅ MediaModal component with headless mode
✅ Puzzle hints support `assetUrl` in frontend
✅ `media.roomScreenAssetId` stored in game settings

### What's Missing:
❌ Room Display background not rendered (only gradient)
❌ `media.roomScreenAssetId` not used in `toTimerBroadcast`
❌ `send_hint` command ignores `assetUrl` and `volumeLevel`
❌ No media playback mechanism on Room Display
❌ No `volume_level` column in `session_hints` table

### What Needs to Be Built:
1. **Room Display Background Rendering**
   - Modify `toTimerBroadcast` to use `media.roomScreenAssetId`
   - Add `<img>` or `<video>` background to Room Display page

2. **Media Hint Backend Support**
   - Accept `assetUrl` and `volumeLevel` in `send_hint` command
   - Store in `session_hints` table (add `volume_level` column)
   - Track active media in `sessions.active_media` (Option A)

3. **Media Hint Frontend Playback**
   - Integrate MediaModal into Room Display page
   - Listen for `activeMedia` in `TimerBroadcast`
   - Auto-play media in headless mode
   - Respect volume and loop settings

4. **Media Clearing**
   - Add `clear_media` command
   - Auto-clear logic (after playback or timeout)
   - UI button in Game Runner

---

## 12. Next Steps (Implementation Session)

**When implementing (NOT in this research session):**

1. **Choose Option A or B** (Recommend: Option A)
2. **Phase 1:** Room Display Background
   - Modify `toTimerBroadcast` in `state.ts`
   - Update Room Display page background rendering
   - Test with sample images and videos

3. **Phase 2:** Media Hint Database
   - Add `volume_level` to `session_hints` schema
   - Add `active_media` to `sessions` schema (if Option A)
   - Run `drizzle-kit push`

4. **Phase 3:** Media Hint Backend
   - Update `send_hint` command to accept/store media
   - Update `toTimerBroadcast` to include `activeMedia`
   - Test API with Postman/curl

5. **Phase 4:** Media Hint Frontend
   - Update `TimerBroadcast` interface in contracts
   - Add MediaModal to Room Display page
   - Wire up reactive playback
   - Test end-to-end flow

6. **Phase 5:** Polish
   - Add `clear_media` command
   - Add UI controls in Game Runner
   - Performance testing on Pi
   - Documentation updates

---

## Implementation Status

**Phase 1: Schema Design** ✅ COMPLETE
- Added `room_display_config` to games table
- Added display settings to hints/milestones
- Removed deprecated `roomScreenAssetId`
- Created validation schemas

**Phase 2: WebSocket Events** ✅ COMPLETE
- Added `room-display:media` event
- Updated `send_hint` command
- Updated `trigger_milestone` command
- Removed hintBanner from TimerBroadcast

**Phase 3: Room Display Page** ✅ COMPLETE
- Renamed route from `/timer/[slug]` to `/room/[slug]`
- Created 6 component files (Background, Timer, TextHint, Audio, Image, Video)
- WebSocket event handling
- Z-index layering implementation

**Phase 4: Game Runner Updates** ✅ COMPLETE
- Added display settings to hint form
- Updated sendPuzzleHint() function
- Updated Room Display URL generation
- Form validation for image hints

**Phase 5: Documentation** ✅ COMPLETE
- Updated API_CONTRACTS_SCHEMA_MANAGEMENT.md
- Updated ROOM_DISPLAY_MEDIA_RESEARCH.md
- Migration guide for deprecated fields

---

**END OF RESEARCH**
