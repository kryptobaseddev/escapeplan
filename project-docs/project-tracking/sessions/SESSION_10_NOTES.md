# Session 10 Notes - Comprehensive UI/UX Requirements & Admin Panel Enhancement

**Date**: 2025-09-30
**Duration**: Planning phase
**Participants**: Keaton (Product Owner), Claude AI (Lead Developer)
**Session Type**: Planning/Requirements Gathering
**Project Version**: 0.1.0

---

## Session Goals

1. Define comprehensive mobile-first UI/UX requirements for all admin panels
2. Establish detailed specifications for operator management, game management, and camera management
3. Document dashboard and game runner enhancement requirements
4. Plan system storage visualization and management features
5. Update TODO.json and USER_STORIES.json with granular acceptance criteria

## Key Requirements Captured

### **Operator Management (P3-013 Enhancement)**

#### Current Issues
- Inline "invite new user" form creates poor mobile UX
- User list lacks proper table/card structure for mobile
- No archive functionality (only delete)
- Missing confirmation modals for destructive actions
- No batch operations or filtering

#### Requirements
1. **Mobile-Optimized User List**
   - Card-based layout on mobile (<640px)
   - Table layout on tablet/desktop (≥768px)
   - Per-user action menu (edit, archive, delete)
   - Avatar display with fallback to initials
   - Status badges (active, archived, must reset password)

2. **+ Add User Button**
   - Header-level action button (top-right, primary color)
   - Opens modal with create form
   - Mobile: full-screen modal
   - Tablet/Desktop: centered modal (max-width: 600px)

3. **User Add/Edit Modal**
   - Single component for both create and edit modes
   - Fields: username, name, email, avatar URL, bio, role, must reset password
   - Password field only on create (separate reset action for edits)
   - Role selector with permission preview (show default permissions for selected role)
   - Validation: email format, password strength (min 12 chars), required fields

4. **Archive System**
   - Soft-delete with metadata: `archivedAt`, `archivedBy`, `archivedReason`
   - Archived users: blocked from login/API access
   - "Show archived" toggle filter (hidden by default)
   - Unarchive button for admins (instant restore)
   - Keep hard-delete for compliance (requires double-confirm with typed username)

5. **Confirmation Modals**
   - Reusable `ConfirmDialog.svelte` component
   - Standard patterns:
     - Archive: "Are you sure?" with reason field
     - Delete: "Type username to confirm"
     - Bulk actions: "Confirm operation on N users"
   - Mobile: full-screen with bottom sheet
   - Desktop: centered overlay

6. **Search & Filters**
   - Search: name, username, email (fuzzy, client-side)
   - Filters: role (multi-select), status (active/archived), permissions (has permission X)
   - Clear filters button

---

### **Game Management (P3-014 Complete Overhaul)**

#### Current Issues
- Face-up form data (terrible mobile UX)
- JSON textarea inputs for rooms/puzzles (horrible user experience)
- No table/list view of games
- Missing search, filter, and archive features
- Poor field organization and validation
- No slug auto-generation
- Missing UUID primary keys (using integer IDs creates FK issues on name changes)

#### Requirements

##### **1. Game List View (Mobile-Friendly Table)**

**Layout:**
- Mobile (<768px): Stacked cards with game name, difficulty stars, duration, status badge, action menu
- Tablet/Desktop (≥768px): Data table with columns: Name, Slug, Duration, Difficulty, Categories, Status, Actions

**Features:**
- Search: name, slug (real-time filter)
- Filters:
  - is_mobile (toggle: Show mobile games only)
  - archived (toggle: Show archived)
  - difficulty (1-5 star selector)
  - categories (multi-select chips)
- Sort: Name (A-Z), Duration (shortest/longest), Recently updated, Created date
- Bulk actions: Archive selected, Delete selected (both require confirmation)

**Action Menu (per game):**
- Edit (opens modal)
- Duplicate (clone game with "Copy" suffix)
- Archive/Unarchive
- Delete (double-confirm with typed slug)

##### **2. Game Add/Edit Modal (Tabbed Form)**

**Modal Structure:**
- Mobile: Full-screen modal with top nav tabs
- Desktop: Centered modal (max-width: 900px) with side tabs
- Tabs: Game Details, Images & Media, Rooms, Puzzles & Hints, Pricing, Booking Rules

**Tab 1: Game Details**
Fields:
- Name (required, max 100 chars)
- Slug (auto-generated from name: lowercase, hyphens for spaces, editable, unique validation)
- Description (textarea, max 500 chars)
- Story intro (rich text editor, max 1000 chars, optional)
- Duration (number input, minutes, required, range: 5-240)
- Difficulty (1-5 star selector with labels: Beginner, Easy, Medium, Hard, Expert)
- Categories (tag input: Private, Public, Mobile, Horror, Adventure, Puzzle, Family-Friendly, etc.)
- Min players (number, default 1, range: 1-20)
- Max players (number, default 8, range: 1-20)
- Resources required (number, default 1, tooltip: "Number of game master staff required")
- Validation notes (textarea, optional, internal use only)

**Tab 2: Images & Media**
- Game thumbnail (image upload, preview, recommended: 16:9, 1200×675px)
- Room screen background (image or video upload, preview, used on timer display page)
- Gallery images (multi-upload, drag-to-reorder, used for marketing/booking page)
- Theme token (dropdown: escapeplan-pirate, escapeplan-space, escapeplan-noir, etc.)
- All uploads:
  - Drag-drop zone
  - File size limit: images 5MB, videos 50MB
  - Formats: JPG, PNG, WebP (images), MP4, WebM (video)
  - Preview with delete/replace buttons

**Tab 3: Rooms**
- Add Room button (opens nested modal)
- Room list (draggable cards for display order)
- Each room card shows:
  - Name (required, max 50 chars)
  - UUID (auto-generated, immutable, displayed but not editable)
  - Description (textarea, max 300 chars)
  - Is mobile capable (toggle)
  - Theme token (inherited from game but overridable)
  - Actions: Edit, Remove (confirm)
- Room form fields:
  - Name, slug (auto-gen from name), description
  - Is mobile capable, theme token
  - Capacity (number, optional, defaults to game max)
- **UUID Requirement**: All rooms get unique UUID on creation, FK relationships use UUID not name

**Tab 4: Puzzles & Hints**
- Add Puzzle button (opens nested form)
- Puzzle list (draggable for display order)
- Each puzzle card shows:
  - Title (required, max 100 chars)
  - UUID (auto-generated)
  - Description (textarea, max 500 chars)
  - Display order (auto-calculated, manual override)
  - Solution (text input, optional, encrypted at rest)
  - Image asset (upload/select from library)
  - Hints count badge
  - Actions: Edit, Remove (confirm if hints exist), Duplicate
- Nested Hint List (within puzzle card):
  - Add Hint button
  - Hint type selector: Text, Image, Audio, Video
  - Ordinal (auto-incremented, manual override)
  - Content:
    - Text: Rich text editor (max 500 chars)
    - Image: Upload/select from library
    - Audio: Upload MP3/WAV/OGG (max 10MB)
    - Video: Upload MP4/WebM (max 50MB)
  - Preview button (shows hint as player would see it)
  - Actions: Edit, Remove, Reorder (drag handles)

**Tab 5: Pricing**
- Pricing model selector: Per Person, Flat Room Rate
- Pricing tiers (add/remove rows):
  - Category (dropdown: Adult, Youth, Senior, Group, Private Buyout)
  - Price (currency input, cents stored as integer)
  - Min participants (number, optional)
  - Max participants (number, optional)
- Deposit settings:
  - Require deposit (toggle)
  - Deposit amount (percentage or fixed amount)
  - Deposit due date (relative: "7 days before", "at booking")
- Discount codes section:
  - Add code button
  - Code list: code, type (percentage/fixed), amount, expiry, uses remaining

**Tab 6: Booking Rules**
- Is mobile game (toggle)
- Mobile-specific settings (shown if is_mobile = true):
  - Location notes template (textarea, 500 chars)
  - Travel buffer (minutes before/after, default 60)
  - Equipment checklist (multi-line text, one item per line)
- Reservation style: Public (shared slots), Private (exclusive booking)
- Difficulty toggle on booking (allow customer to choose difficulty at booking time)
- Advance booking window (min/max days before game can be booked)
- Cancellation policy (text, displayed to customers)

**Validation:**
- Slug uniqueness check (API call on blur)
- Min players ≤ Max players
- At least one room assigned
- At least one puzzle with at least one hint
- At least one pricing tier
- Mobile games must have location notes template

##### **3. Backend Schema Changes**

**Required Drizzle ORM Updates:**
- Add UUIDs to all tables as primary keys or alongside integer IDs
- Tables needing UUID: rooms, games, puzzles, hints, cameras, bookings, game_sessions
- Migration: generate UUIDs for existing records, update FK constraints
- New fields:
  - games: `room_screen_asset_id`, `thumbnail_asset_id`, `gallery_asset_ids` (JSON array)
  - rooms: `uuid` (unique), `capacity`, `theme_token`
  - puzzles: `uuid` (unique), `solution_encrypted`, `image_asset_id`
  - hints: `uuid` (unique), `asset_id` (FK to assets)

---

### **Dashboard Enhancements (P3-015 Expansion)**

#### Current Issues
- No quick-start for ad-hoc games
- Booked sessions not clearly distinguished from ad-hoc
- Missing room link copy/open actions
- No visual indicators for session health

#### Requirements

##### **1. Quick Start Modal (Ad-hoc Game Launch)**

**Trigger:**
- Dashboard header: "+ Quick Start" button (primary, top-right)
- Keyboard shortcut: Cmd/Ctrl + K

**Modal Fields:**
1. Game selector (dropdown, searchable)
   - Shows: name, duration, difficulty stars
   - Filters: only non-archived games
   - Mobile: full-screen picker
2. Room selector (dropdown, filtered by game compatibility)
   - Shows: name, capacity, current status (available/occupied)
   - Validation: cannot select occupied room
3. Party size (number input)
   - Min: game.minPlayers
   - Max: min(game.maxPlayers, room.capacity)
   - Default: game.minPlayers
4. Duration override (number input, minutes, optional)
   - Default: game.durationMinutes
   - Tooltip: "Override game default duration"
5. Notes (textarea, 500 chars, optional)
   - Placeholder: "Walk-in, event, training session..."

**Behavior:**
- API creates synthetic booking:
  - status: 'ADHOC'
  - customer_name: 'Walk-in'
  - customer_email: null
  - is_adhoc: true (new field)
- Auto-creates session in RUNNING state
- Redirects to game runner page
- Dashboard updates in real-time (WebSocket)

##### **2. Upcoming Bookings Widget Enhancement**

**Current State:**
- Shows next 4 hours of bookings
- Basic table with time, game, party, status

**Enhancements:**
- Separate visual sections:
  - "Ready to Start" (confirmed bookings in next 15 min)
  - "Upcoming" (confirmed bookings 15 min - 4 hours)
  - "Pending" (unconfirmed bookings needing attention)
- Per-booking actions:
  - "Start Session" button (creates session from booking)
  - "View Details" (opens booking detail modal)
  - "Edit" (opens booking edit form)
  - "Cancel" (confirmation required)
- Conflict indicators:
  - Red badge if room is double-booked
  - Yellow badge if staff shortage detected
- Ad-hoc session indicator:
  - Gray badge "Ad-hoc" for walk-in sessions

##### **3. Active Sessions Widget Enhancement**

**Current State:**
- Lists active sessions with timer, hints used, room

**Enhancements:**
- Room link actions (per session):
  - **Copy Link**: Copies `https://escapeplan.local/{game.slug}` to clipboard
    - Shows toast: "Room link copied!"
    - Link format: `${window.location.origin}/${session.game.slug}`
  - **Open Room**: Opens room timer page in new window/tab
    - Target: `_blank`
    - Window features: fullscreen on desktop, regular tab on mobile
- Session health indicators:
  - Green: On track (timer > 25% remaining)
  - Yellow: Running low (timer 10-25% remaining)
  - Red: Overtime (timer < 0)
  - Gray: Paused
- Camera status badge:
  - Shows if cameras are online/offline for that room
- Quick actions dropdown:
  - Send hint (opens hint selector)
  - Pause/Resume
  - End session (confirmation)
  - View full runner

---

### **Game Runner Page (P3-015 Critical Updates)**

#### Current Issues
- Cannot add sessions from runner page
- Room link not easily accessible
- No quick hint send
- Timer controls not prominent enough

#### Requirements

##### **1. Quick Add Session (from Game Runner)**

**Trigger:**
- Runner page header: "+ Start Another Game" button
- Opens same Quick Start modal as dashboard

**Use Case:**
- Game master finishes one session, immediately starts another
- No need to navigate back to dashboard

##### **2. Room Link Prominence**

**Location:**
- Top of game runner page, below game name
- Format: `🔗 Room Display: https://escapeplan.local/pirate-mutiny`

**Actions:**
- Copy button (same as dashboard)
- Open button (same as dashboard)
- QR code button (generates QR code modal for tablet/phone scanning)

**Static URL Behavior:**
- Game slug-based: `/pirate-mutiny`, `/space-heist`, etc.
- Works even if room TV is set to URL before session starts
- Page shows "Waiting for session..." if no active session
- Auto-updates when session starts (WebSocket)
- If multiple rooms running same game: URL param disambiguation `?room=harbor-hold`

##### **3. Timer Controls Enhancement**

**Layout:**
- Large countdown display (center, 6rem font on desktop, 4rem on mobile)
- Color coding: green (>25% left), yellow (10-25%), red (<10%), flashing red (overtime)
- Control buttons (large touch targets, ≥60px height on mobile):
  - Start (if scheduled)
  - Pause/Resume (toggle)
  - Add Time (opens modal: +1, +5, +10, +15 min)
  - End Session (confirmation: "Mark complete" or "Mark aborted")

##### **4. Hint Dispatch Enhancement**

**Current State:**
- Puzzle list with hint buttons

**Enhancements:**
- Hint quick-send (per puzzle):
  - Dropdown of hints for that puzzle
  - One-click send (no extra modal if hint is simple)
  - Confirmation toast: "Hint sent to room display"
- Custom hint (not predefined):
  - "Send Custom Hint" button
  - Opens modal: text input (500 chars) or asset upload
  - Option to save custom hint to puzzle for future use
- Hint history panel:
  - Collapsible sidebar (right side on desktop, bottom drawer on mobile)
  - Shows all hints sent this session with timestamp
  - "Undo" button (if sent <30 seconds ago)

---

### **Camera Management Admin Panel (NEW: P3-016)**

#### Requirements

##### **1. Camera List View**

**Layout:**
- Table/card hybrid:
  - Mobile: Cards with thumbnail, name, status
  - Desktop: Table with columns: Preview, Name, Location, Status, Actions

**Columns/Fields:**
- Preview: Live thumbnail (refreshes every 5s) or placeholder if offline
- Name: User-friendly name (e.g., "Harbor Hold Overhead", "Pirate Mutiny Door Cam")
- Location: Room association (dropdown selector)
- Protocol: RTSP, MJPEG, ONVIF
- URL: Masked (shows `rtsp://****:****@10.10.10.60/stream`)
- Status:
  - Online (green badge)
  - Offline (red badge, with last seen timestamp)
  - Testing (yellow, during connection test)
- Actions: Edit, Test, Delete

##### **2. Add/Edit Camera Modal**

**Fields:**
1. Name (required, max 50 chars)
2. Room association (dropdown, optional, can assign later)
3. Protocol (dropdown: RTSP, MJPEG, ONVIF Auto-Detect)
4. Connection details:
   - Host/IP (text input, validates IP or hostname)
   - Port (number, default 554 for RTSP, 80 for MJPEG)
   - Username (text, optional)
   - Password (password input, encrypted at rest, optional)
   - Stream path (text, e.g., `/stream`, `/cam/realmonitor?channel=1`)
5. Advanced settings (collapsible):
   - Resolution (dropdown: 480p, 720p, 1080p, Native)
   - Frame rate (number, FPS, default 15)
   - Transport (dropdown: TCP, UDP, HTTP)
6. Test connection button:
   - Sends test request to camera
   - Shows preview if successful
   - Shows error message if failed (with diagnostic hints)

**Validation:**
- Name uniqueness
- Valid IP/hostname format
- Port range (1-65535)
- Required: name, protocol, host

##### **3. Camera Testing & Diagnostics**

**Test Connection Flow:**
1. User clicks "Test" button
2. Backend attempts connection with provided credentials
3. Response scenarios:
   - ✅ Success: Shows 5-second preview clip + "Connection successful"
   - ❌ Timeout: "Camera not responding. Check network/firewall."
   - ❌ Auth failed: "Invalid credentials. Check username/password."
   - ❌ Protocol error: "Stream format not supported. Try different protocol."
4. Option to save camera even if test fails (for debugging)

**Live Preview:**
- Camera list: Thumbnail updates every 5s
- Edit modal: Live preview pane (updates every 1s during test)
- Dashboard: Full HLS stream (for active sessions)

##### **4. Camera-to-Game Association**

**Relationship:**
- Cameras belong to rooms (FK: camera.room_id → rooms.uuid)
- Games associate with rooms (FK: game_room_map)
- When session starts, automatically loads cameras for that room

**Management:**
- In camera modal: assign to room via dropdown
- In room management (future): list cameras assigned to room
- Validation: warn if room has no cameras assigned

##### **5. Stream Management**

**HLS Pipeline Control:**
- Start/Stop buttons per camera (starts ffmpeg worker)
- Status indicator:
  - Streaming (green, with bitrate/fps display)
  - Stopped (gray)
  - Error (red, with error message)
- Auto-restart: If stream drops, systemd restarts ffmpeg worker
- Logs: Link to view ffmpeg logs for diagnostics

**Backup/Fallback:**
- If RTSP/HLS fails, attempt MJPEG fallback (still image stream)
- If all fail, show placeholder with "Camera offline" message

---

### **System Storage Admin Panel (NEW: P3-017)**

#### Requirements

##### **1. Storage Overview Dashboard**

**Visual Indicators:**
- Total capacity: Pie chart or donut chart
  - Segments: Used (blue), Reserved (yellow), Available (green)
  - Center: Percentage used (e.g., "42% Used")
- Breakdown by category:
  - Database (SQLite .db file size)
  - Assets (images, audio, video)
  - HLS cache (live stream segments)
  - Backups (compressed archives)
  - Logs (journald + ffmpeg logs)
  - System (OS + packages)

**Metrics Cards:**
- Total capacity (e.g., 30 GB for 32GB SD card)
- Used space (e.g., 12.4 GB)
- Available space (e.g., 17.6 GB)
- Largest single asset (e.g., "pirate_intro.mp4 - 245 MB")
- Oldest backup (date, with auto-delete warning if >30 days)

##### **2. Asset Library**

**Layout:**
- Grid view (mobile: 2 cols, tablet: 3 cols, desktop: 4 cols)
- List view (table with columns: Thumbnail, Name, Type, Size, Used By, Uploaded, Actions)
- Toggle between grid/list

**Asset Cards (Grid View):**
- Thumbnail/icon (based on type)
- Filename (truncated)
- Type badge (image/audio/video)
- Size (e.g., "1.2 MB")
- Usage indicator (e.g., "Used in 3 games")
- Actions: View, Download, Delete

**Asset Details Modal:**
- Full preview (image viewer, audio player, video player)
- Metadata:
  - Filename, type, MIME, size
  - Dimensions (for images/videos)
  - Duration (for audio/videos)
  - Uploaded by, uploaded at
- Usage report:
  - List of games/puzzles/hints using this asset
  - Warning if deleting: "This asset is used in 3 hints. Delete anyway?"
- Actions: Replace, Download, Delete

##### **3. Asset Upload**

**Upload Zone:**
- Drag-drop area (full-page dropzone or in-modal)
- File browser button (backup for mobile)
- Multi-file support
- Progress indicators (per file):
  - Uploading (progress bar)
  - Processing (spinner for video transcoding)
  - Complete (checkmark)
  - Failed (error icon with message)

**Validation:**
- File size limits: 5MB (images), 10MB (audio), 50MB (video)
- Allowed formats:
  - Images: JPG, PNG, WebP, GIF
  - Audio: MP3, WAV, OGG
  - Video: MP4, WebM
- Auto-convert: WebP for images (smaller size), MP4 H.264 for video (compatibility)

##### **4. Backup Management**

**Backup List:**
- Table: Timestamp, Type (auto/manual), Size, Status, Actions
- Auto-backups: Nightly at 3 AM (configurable)
- Manual backups: Triggered by admin

**Backup Actions:**
- Download (serves .tar.gz file)
- Restore (opens confirmation modal with warnings)
- Delete (confirmation required)

**Backup Settings:**
- Retention policy: Keep last N backups (default 7)
- Auto-delete old backups (toggle)
- Backup schedule (cron expression or simple picker)
- Include assets in backup (toggle, warning about size)

##### **5. Log Management**

**Log Viewer:**
- Service selector: API, ffmpeg, nginx, systemd
- Date range picker
- Severity filter: Error, Warning, Info, Debug
- Live tail (updates every 1s for selected service)
- Syntax highlighting (log level colors)

**Log Actions:**
- Download (as .txt file)
- Clear logs (confirmation, archives before clearing)
- Export diagnostics bundle (includes logs + system info)

---

## Decisions Made

### **Technical Decisions**

1. **UUID Primary Keys**
   - **Decision**: Add UUIDs to rooms, puzzles, hints, cameras alongside integer IDs
   - **Rationale**: Prevents FK breakage when names change; allows safer replication/sync
   - **Migration Strategy**: Generate UUIDs for existing records in migration script
   - **Impact**: Drizzle schema updates, API contract changes, frontend uses UUIDs in URLs

2. **Slug Auto-Generation**
   - **Decision**: Generate slugs from names (lowercase, hyphenate spaces) with manual override
   - **Rationale**: Reduces user error, ensures URL-safe slugs, allows customization
   - **Implementation**: Client-side utility function, debounced on name field change
   - **Validation**: Backend checks uniqueness, returns 409 if conflict

3. **Tabbed Modal Forms**
   - **Decision**: Use DaisyUI tabs for multi-section forms (games, cameras)
   - **Rationale**: Reduces visual overwhelm, mobile-friendly (swipeable tabs), progressive disclosure
   - **Mobile**: Top horizontal tabs (swipeable)
   - **Desktop**: Side vertical tabs (fixed)

4. **Confirmation Modal Pattern**
   - **Decision**: Reusable `ConfirmDialog.svelte` component with standard variants
   - **Variants**: Info, Warning, Danger (each with color scheme)
   - **Advanced**: Type-to-confirm for destructive actions (delete, hard delete)
   - **Mobile**: Full-screen modal with bottom actions (safe thumb zone)

5. **Static Room Links**
   - **Decision**: Use game slug URLs (`/pirate-mutiny`) not session IDs
   - **Rationale**: TV browsers can be preset before sessions start, no need to update URLs
   - **Multi-room handling**: If multiple rooms run same game, use query param `?room=UUID`
   - **Fallback**: Page shows "Waiting for session" if accessed outside active session

6. **Ad-hoc Booking Status**
   - **Decision**: New booking status 'ADHOC' instead of separate table
   - **Rationale**: Reuses existing booking/session flow, simpler queries
   - **Additional field**: `is_adhoc: boolean` for easier filtering
   - **Customer info**: Set to default values (customer_name: 'Walk-in', email: null)

### **Process Decisions**

1. **Mobile-First Enforcement**
   - All new components start with mobile viewport (390px)
   - Desktop features are enhancements, not requirements
   - Touch targets: minimum 44×44px (Apple HIG), prefer 48×48px (Material)

2. **Confirmation Required For**
   - Delete (any entity)
   - Archive (users, games)
   - End session
   - Cancel booking
   - Bulk operations

3. **No Confirmation Required For**
   - Edit (reversible)
   - Unarchive (reversible)
   - Pause session (reversible)
   - Send hint (logged but not harmful)

---

## Architecture & Design Changes

### **Frontend Component Hierarchy**

```
/lib/components/
  /admin/
    UserModal.svelte              # Create/edit user form
    UserList.svelte               # Mobile-responsive user table/cards
    GameModal.svelte              # Tabbed game form (6 tabs)
    GameList.svelte               # Searchable/filterable game table
    CameraModal.svelte            # Camera config form
    CameraList.svelte             # Camera table with live previews
    StorageDashboard.svelte       # Storage overview with charts
    AssetLibrary.svelte           # Grid/list asset browser
    BackupManager.svelte          # Backup list and controls
  /modals/
    ConfirmDialog.svelte          # Reusable confirmation modal
    QuickStartModal.svelte        # Ad-hoc game start form
  /dashboard/
    ActiveSessionsWidget.svelte   # Live sessions with room links
    UpcomingBookingsWidget.svelte # Next 4 hours bookings
    NetworkStatusWidget.svelte    # Network health card
  /game-runner/
    TimerDisplay.svelte           # Large countdown with controls
    HintDispatcher.svelte         # Puzzle + hint UI
    HintHistory.svelte            # Collapsible sidebar
  /ui/
    Tabs.svelte                   # Reusable tab component
    Dropzone.svelte               # File upload drag-drop
    ChartDonut.svelte             # Storage visualization
```

### **Backend API Additions**

**New Endpoints:**
- `POST /api/admin/storage/status` - Get disk usage stats
- `GET /api/admin/storage/assets` - List assets with pagination
- `POST /api/admin/storage/assets` - Upload asset (multipart)
- `DELETE /api/admin/storage/assets/:id` - Delete asset (soft)
- `GET /api/admin/backups` - List backups
- `POST /api/admin/backups/trigger` - Create manual backup
- `GET /api/admin/backups/:id/download` - Download backup
- `POST /api/admin/backups/:id/restore` - Restore from backup
- `GET /api/admin/logs/:service` - Fetch logs (with filters)
- `POST /api/admin/cameras` - Add camera
- `PUT /api/admin/cameras/:id` - Update camera
- `DELETE /api/admin/cameras/:id` - Delete camera
- `POST /api/admin/cameras/:id/test` - Test camera connection
- `POST /api/admin/cameras/:id/start` - Start HLS stream
- `POST /api/admin/cameras/:id/stop` - Stop HLS stream
- `PATCH /api/admin/users/:id/archive` - Archive user
- `PATCH /api/admin/users/:id/unarchive` - Unarchive user
- `PATCH /api/admin/games/:id/archive` - Archive game
- `PATCH /api/admin/games/:id/unarchive` - Unarchive game
- `POST /api/sessions/quick-start` - Create ad-hoc session

**Schema Changes (Drizzle migrations needed):**
```typescript
// Add UUIDs
rooms: { uuid: uuid('uuid').defaultRandom().notNull().unique() }
puzzles: { uuid: uuid('uuid').defaultRandom().notNull().unique() }
hints: { uuid: uuid('uuid').defaultRandom().notNull().unique() }
cameras: { uuid: uuid('uuid').defaultRandom().notNull().unique() }

// Add archive fields to users
users: {
  archivedAt: timestamp('archived_at'),
  archivedBy: integer('archived_by').references(() => users.id),
  archivedReason: text('archived_reason')
}

// Add archive fields to games
games: {
  archivedAt: timestamp('archived_at'),
  archivedBy: integer('archived_by').references(() => users.id)
}

// Add asset fields to games
games: {
  thumbnailAssetId: integer('thumbnail_asset_id').references(() => assets.id),
  roomScreenAssetId: integer('room_screen_asset_id').references(() => assets.id),
  galleryAssetIds: json('gallery_asset_ids').$type<number[]>().default([])
}

// Add is_adhoc to bookings
bookings: {
  isAdhoc: boolean('is_adhoc').default(false)
}

// New cameras table
cameras: {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').defaultRandom().notNull().unique(),
  name: text('name').notNull(),
  roomId: integer('room_id').references(() => rooms.id),
  protocol: text('protocol').notNull(), // 'rtsp' | 'mjpeg' | 'onvif'
  host: text('host').notNull(),
  port: integer('port').notNull(),
  username: text('username'),
  passwordEncrypted: text('password_encrypted'), // libsodium encrypted
  streamPath: text('stream_path'),
  resolution: text('resolution'),
  frameRate: integer('frame_rate').default(15),
  transport: text('transport').default('tcp'),
  status: text('status').default('offline'), // 'online' | 'offline' | 'testing'
  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}
```

---

## Next Steps

### **Immediate Actions (Session 10 Implementation)**

1. ✅ Create SESSION_10_NOTES.md (this document)
2. ⏳ Update TODO.json with granular task breakdown:
   - Split P3-013 into subtasks (UserModal, UserList, Archive API, ConfirmDialog)
   - Split P3-014 into subtasks (GameModal tabs, GameList, UUID migration)
   - Split P3-015 into subtasks (QuickStart, RoomLinks, HintDispatcher)
   - Add P3-016 (Camera Management) with full task breakdown
   - Add P3-017 (Storage Management) with full task breakdown
3. ⏳ Update USER_STORIES.json with new stories:
   - US-036: Admin archives inactive operators
   - US-037: Manager edits game with tabbed form
   - US-038: Game master quick-starts ad-hoc session
   - US-039: Admin manages network cameras
   - US-040: Admin monitors system storage
4. ⏳ Review Drizzle schemas and plan UUID migration
5. Create reusable ConfirmDialog.svelte component
6. Implement UserModal and UserList components
7. Implement GameModal with tabbed structure

### **Medium-term Goals (Next 2-3 Sessions)**

- Complete all admin panel UX overhauls
- Implement camera management full CRUD
- Build storage dashboard with visualizations
- Complete game runner enhancements
- Test mobile UX on actual iPads (1024×768)

---

## Notes for Next Session

### **Context Needed**
- Current Drizzle schema location: `apps/escapeplan-api/src/db/schema.ts`
- Migration runner: Drizzle Kit
- Asset storage path: `/var/lib/escapeplan/assets`
- HLS output path: `/var/lib/escapeplan/hls/{cameraId}`

### **Open Questions**
- Should room slug auto-generation happen when room name changes, or only on creation?
- How to handle camera credential encryption key management? (Store in env var?)
- Should asset uploads be chunked for large videos? (> 50MB)
- What backup compression format? (tar.gz, zip, or bespoke?)

### **Pitfalls to Avoid**
- Don't use integer IDs in URLs — always use UUIDs or slugs for public-facing routes
- Don't forget to validate slug uniqueness across all games, not just current game
- Camera test connections must have timeout (5s max) to avoid blocking
- Asset deletes must check usage before allowing (FK constraints + application logic)

---

**Session Summary**: Captured comprehensive UI/UX requirements for mobile-first admin panels, including operator management modal redesign, game management tabbed forms with UUID architecture, dashboard quick-start flows, camera management CRUD, and system storage visualization. Established detailed acceptance criteria for tasks P3-013 through P3-017, documented confirmation modal patterns, and planned Drizzle schema migrations for UUID support. Next session will focus on updating TODO.json and USER_STORIES.json with granular task breakdowns and implementing the reusable ConfirmDialog component.