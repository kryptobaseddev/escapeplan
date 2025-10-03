# P3-CAMERAS-001: Complete Camera Management System

**Phase:** 3 (Backend Core)
**Priority:** CRITICAL
**Estimated:** 32 hours
**Status:** IN_PROGRESS
**Assignee:** System Integration Team

---

## Overview

Implement complete camera management system with:
1. **Database foundation** ✅ COMPLETE (Session 44)
2. **Camera CRUD API** - Full REST endpoints
3. **Game-Camera bidirectional association** - Enforce 1-to-1 camera:game, many cameras:game
4. **Camera management UI** - Add/edit/test cameras
5. **Game settings camera selector** - Associate cameras from game modal

---

## Completed (Session 44)

### ✅ Database Schema
- **cameras table** created with all fields
  - `id`, `name`, `game_id` (FK to games)
  - Protocol: `rtsp`, `mjpeg`, `onvif`
  - Connection: `host`, `port`, `username`, `password_encrypted`
  - Stream: `stream_path`, `resolution`, `frame_rate`, `transport`
  - Status: `status`, `last_seen`, `error_message`, `hls_streaming`
- **games.camera_ids** JSON array added for multiple cameras per game
- Migration generated: `0003_bumpy_jack_murdock.sql`

### ✅ TypeScript Contracts
- Camera types exported from `@escapeplan/contracts`:
  - `Camera`, `CameraSummary`
  - `CreateCameraRequest`, `UpdateCameraRequest`
  - `TestCameraConnectionRequest`, `TestCameraConnectionResponse`
  - `StartCameraStreamRequest`, `StopCameraStreamRequest`
  - `CameraStreamStatus`, `GetCamerasResponse`
- `GameDetails.cameraIds` and `SaveGameRequest.cameraIds` added
- Contracts package rebuilt successfully

---

## Remaining Tasks

### 1. Camera CRUD API (8 hours)

**File:** `apps/escapeplan-api/src/index.ts`

**Endpoints:**
```typescript
GET    /api/admin/cameras
  → Returns GetCamerasResponse with all cameras
  → Includes game_name from JOIN

POST   /api/admin/cameras
  → Accepts CreateCameraRequest
  → Encrypts password with libsodium
  → Validates game_id (must exist, camera can only associate with 1 game)
  → Updates games.camera_ids array
  → Returns created Camera

PATCH  /api/admin/cameras/:id
  → Accepts UpdateCameraRequest
  → If gameId changes:
    - Remove from old game's camera_ids
    - Add to new game's camera_ids
    - Validate new game doesn't already have this camera
  → Re-encrypt password if provided
  → Returns updated Camera

DELETE /api/admin/cameras/:id
  → Removes camera_id from associated game's camera_ids
  → Deletes camera record
  → Stops HLS stream if running
```

**Association Logic:**
```typescript
// When creating/updating camera with gameId:
1. If camera.game_id changes:
   - Find old game, remove camera.id from camera_ids array
   - Find new game, add camera.id to camera_ids array
   - Update both games in transaction

2. If game.camera_ids changes (from game settings):
   - For each added camera_id:
     - Update camera.game_id = game.id
     - Remove from previous game's camera_ids if needed
   - For each removed camera_id:
     - Update camera.game_id = null
```

**Validation:**
- Prevent duplicate camera on same game (check game's camera_ids)
- Ensure camera.game_id and games.camera_ids stay in sync
- Atomic updates (use Drizzle transactions)

**RBAC Guards:**
- `GET /api/admin/cameras` → `view_cameras` permission
- `POST /PATCH /DELETE` → `manage_cameras` permission

---

### 2. Camera Connection Testing API (4 hours)

**File:** `apps/escapeplan-api/src/cameras/connection.ts` (new)

**Endpoint:**
```typescript
POST   /api/admin/cameras/test-connection
  → Accepts TestCameraConnectionRequest
  → Attempts connection with 5-second timeout
  → Tests RTSP/MJPEG/ONVIF protocols
  → Returns TestCameraConnectionResponse with diagnostics
```

**Implementation:**
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testCameraConnection(req: TestCameraConnectionRequest) {
  const url = buildCameraUrl(req);

  // Use ffprobe to test connection
  const command = `ffprobe -v quiet -print_format json -show_streams -timeout 5000000 "${url}"`;

  try {
    const { stdout } = await execAsync(command);
    const data = JSON.parse(stdout);

    return {
      success: true,
      diagnostics: {
        reachable: true,
        authValid: true,
        streamAvailable: !!data.streams,
        resolution: data.streams[0]?.width + 'x' + data.streams[0]?.height,
        frameRate: data.streams[0]?.r_frame_rate
      }
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error.message,
      diagnostics: { /* parse error to determine failure reason */ }
    };
  }
}
```

**RBAC:** `manage_cameras` permission required

---

### 3. Camera Streaming Controls (4 hours)

**File:** `apps/escapeplan-api/src/cameras/streaming.ts` (new)

**Endpoints:**
```typescript
POST   /api/admin/cameras/:id/start-stream
  → Starts systemd ffmpeg@ service for camera
  → Updates camera.hls_streaming = true
  → Returns CameraStreamStatus

POST   /api/admin/cameras/:id/stop-stream
  → Stops systemd ffmpeg@ service
  → Updates camera.hls_streaming = false
  → Returns CameraStreamStatus

GET    /api/admin/cameras/:id/stream-status
  → Checks systemd service status
  → Returns CameraStreamStatus
```

**Integration:**
- Uses existing P3-008 camera pipeline infrastructure
- Systemd service: `escapeplan-ffmpeg@{cameraId}.service`
- HLS output: `/var/lib/escapeplan/hls/{cameraId}/stream.m3u8`

**RBAC:** `manage_cameras` permission

---

### 4. Camera Management UI Page (10 hours)

**File:** `apps/escapeplan-web/src/routes/(app)/admin/cameras/+page.svelte`

**Features:**
- **List View:**
  - Desktop: Table with columns [Name, Game, Protocol, Host:Port, Status, Actions]
  - Mobile: Cards with camera details
  - Status badges: 🟢 Online, 🔴 Offline, 🟡 Testing, ⚠️ Error
  - Action menu per camera: Edit, Test, Start/Stop Stream, Delete

- **Add Camera Modal:**
  - Form fields:
    - Name (required)
    - Game association (dropdown, optional) → Shows only games
    - Protocol (dropdown: RTSP/MJPEG/ONVIF)
    - Host (IP or hostname)
    - Port (default 554 for RTSP)
    - Username (optional)
    - Password (masked, optional)
    - Stream path (e.g., `/stream1`)
    - Advanced settings (collapsible):
      - Resolution (480p/720p/1080p/Native)
      - Frame rate (FPS)
      - Transport (TCP/UDP/HTTP)
  - **Test Connection** button:
    - Calls POST /api/admin/cameras/test-connection
    - Shows 5-second preview if successful
    - Shows diagnostic error if failed

- **Edit Camera Modal:**
  - Same form as Add
  - Pre-filled with camera data
  - Password field shows "••••••••" (change to update)
  - Game dropdown shows current + available games

- **Camera-Game Association:**
  - Dropdown shows all games
  - If camera already associated, shows warning: "Will be removed from [OldGame]"
  - Validates 1-to-1 constraint client-side

**Components:**
- `CameraModal.svelte` - Add/Edit form
- `CameraList.svelte` - Table/Card toggle
- `CameraTestPreview.svelte` - 5-second test clip player
- `CameraStatusBadge.svelte` - Status indicators

**API Calls:**
```typescript
// Load cameras
const { cameras } = await fetch('/api/admin/cameras').then(r => r.json());

// Create camera
await fetch('/api/admin/cameras', {
  method: 'POST',
  body: JSON.stringify(createRequest)
});

// Update camera
await fetch(`/api/admin/cameras/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(updateRequest)
});

// Delete camera
await fetch(`/api/admin/cameras/${id}`, { method: 'DELETE' });
```

---

### 5. Game Settings Camera Selector (6 hours)

**File:** `apps/escapeplan-web/src/routes/(app)/admin/games/[id]/GameDetailsModal.svelte`

**Add Cameras Tab (Tab 7):**

**Layout:**
```
┌─────────────────────────────────────────┐
│ Cameras Associated with [Game Name]     │
├─────────────────────────────────────────┤
│                                          │
│ [Camera 1]  Status: 🟢 Online           │
│ rtsp://192.168.1.10:554/stream1         │
│ [Test] [Remove]                          │
│                                          │
│ [Camera 2]  Status: 🔴 Offline          │
│ rtsp://192.168.1.11:554/stream2         │
│ [Test] [Remove]                          │
│                                          │
│ [+ Add Camera]                           │
└─────────────────────────────────────────┘
```

**+ Add Camera Button:**
- Opens dropdown/modal with list of **unassociated cameras only**
- Shows: `[Camera Name] - [Protocol] - [Host:Port]`
- Filter: `cameras.filter(c => c.gameId === null || c.gameId === currentGame.id)`
- On select:
  - Add camera.id to `game.cameraIds` array
  - Show in list immediately (optimistic UI)
  - Save happens when "Save Game" clicked

**Remove Camera:**
- Removes camera.id from `game.cameraIds` array
- Does NOT delete camera (just disassociates)
- Camera becomes available for other games

**Bidirectional Sync:**
```typescript
// When saving game with updated cameraIds:
const addedCameras = newCameraIds.filter(id => !oldCameraIds.includes(id));
const removedCameras = oldCameraIds.filter(id => !newCameraIds.includes(id));

// Server-side (in SaveGame API):
for (const cameraId of addedCameras) {
  await db.update(cameras)
    .set({ game_id: gameId })
    .where(eq(cameras.id, cameraId));
}

for (const cameraId of removedCameras) {
  await db.update(cameras)
    .set({ game_id: null })
    .where(eq(cameras.id, cameraId));
}

await db.update(games)
  .set({ camera_ids: newCameraIds })
  .where(eq(games.id, gameId));
```

**Validation:**
- Show warning if removing camera that's streaming
- Prevent adding camera already associated with another game

---

## Camera Discovery Research (P3-CAMERAS-RESEARCH)

**File:** `project-docs/research/CAMERA_DISCOVERY_OPTIONS.md`

**Investigation Areas:**

### 1. Auto-Discovery Libraries
- **node-onvif** - ONVIF camera discovery via WS-Discovery
- **node-rtsp-stream** - RTSP stream handling
- **fluent-ffmpeg** - FFmpeg wrapper for Node.js
- **bonjour** / **mdns** - Network service discovery

### 2. Manual Discovery Methods
- **IP Range Scan** - Scan 10.10.10.0/24 for open ports (554, 80, 8080)
- **ONVIF Probe** - Send WS-Discovery probe messages
- **UPnP/SSDP** - Universal Plug and Play discovery
- **mDNS Browse** - Search for `_rtsp._tcp` services

### 3. Camera Database Integration
- **IPVM Camera Database** - Manufacturer URL patterns
- **ONVIF Profile S** - Standard stream paths
- **Common defaults** - /stream1, /live/ch00_0, /video.mjpg

### 4. Recommended Approach
1. **Phase 1 (MVP):** Manual entry with connection testing
2. **Phase 2:** IP range scan + port detection
3. **Phase 3:** ONVIF auto-discovery with WS-Discovery
4. **Phase 4:** Manufacturer templates (presets for common cameras)

**Deliverable:** Research doc with implementation recommendations

---

## Testing Checklist

### API Tests
- [ ] Create camera with game association
- [ ] Update camera, change game (verify old game camera_ids updated)
- [ ] Delete camera (verify removed from game camera_ids)
- [ ] Test connection to valid RTSP camera
- [ ] Test connection with invalid credentials
- [ ] Start HLS stream
- [ ] Stop HLS stream
- [ ] Get cameras list with game names

### UI Tests
- [ ] Add camera from cameras page
- [ ] Associate camera with game from cameras page
- [ ] Edit camera, change game association
- [ ] Test connection from camera modal
- [ ] Add camera to game from game settings
- [ ] Remove camera from game settings
- [ ] Delete camera (verify removed from game)

### Integration Tests
- [ ] Create camera via cameras page, verify appears in game settings
- [ ] Add camera to game via game settings, verify gameId updated in cameras page
- [ ] Remove camera from game settings, verify available in "Add Camera" list
- [ ] Start stream from cameras page, verify HLS URL accessible

---

## Acceptance Criteria

1. ✅ Cameras table exists with all required fields
2. ✅ Contracts package exports all camera types
3. ✅ Migration generated and ready to apply
4. [ ] Camera CRUD API complete with RBAC guards
5. [ ] Game-camera association logic enforces 1-to-1 (camera:game) and many-to-1 (cameras:game)
6. [ ] Bidirectional sync working (update camera.game_id ↔ update games.camera_ids)
7. [ ] Camera management UI page complete with test connection
8. [ ] Game settings camera selector working
9. [ ] All tests passing
10. [ ] Documentation complete in CAMERA_DISCOVERY_OPTIONS.md

---

## Dependencies

- ✅ P2-001: pi-gen base image (ffmpeg installed)
- ✅ P3-RBAC-001: RBAC schema (view_cameras, manage_cameras permissions)
- ✅ P3-004: Better-Auth (session management for RBAC)
- 🚧 P3-008: Camera pipeline (systemd ffmpeg@ services) - parallel work

---

## Estimated Hours Breakdown

- [x] Database schema + migration: 2h (DONE)
- [x] TypeScript contracts: 2h (DONE)
- [ ] Camera CRUD API: 8h
- [ ] Connection testing API: 4h
- [ ] Streaming controls API: 4h
- [ ] Camera management UI: 10h
- [ ] Game settings camera tab: 6h
- [ ] Testing + bug fixes: 4h
- [ ] Documentation: 2h

**Total:** 32h (10h remaining after Session 44)

---

## Next Session Priority

**Session 45 (8 hours):**
1. Camera CRUD API (8h) - Complete all REST endpoints
2. Start connection testing API

**Session 46 (10 hours):**
3. Finish connection testing + streaming controls APIs (4h)
4. Camera management UI page (6h)

**Session 47 (6 hours):**
5. Game settings camera tab (6h)

**Session 48 (4 hours):**
6. Testing, bug fixes, documentation

---

## Success Metrics

- Cameras can be added manually with connection validation
- Bi-directional game-camera association works correctly
- Camera streams can be started/stopped from UI
- Game settings show associated cameras
- System ready for auto-discovery research (Phase 2)

---

**Status:** Foundation complete, API + UI implementation next
**Blocker:** None - ready to proceed
**Risk:** Low - schema and contracts validated, clear implementation path
