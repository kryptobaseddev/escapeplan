# **EscapePlan Mobile-First UI/UX Specifications - Session 10 Final**

---

## **P3-013 · Operator Management**

### **Archive Functionality**

**Q: Should archived operators be hidden by default with a filter/toggle to reveal them, and should archives block login or API access?**

**A:** Yes, implement soft-delete archive system:
- **Hidden by default** - Archived users don't appear in main list
- **Toggle filter** - "Show archived" checkbox above user list (desktop) or in filter drawer (mobile)
- **Complete access block** - Archived users cannot log in or make API calls (Better Auth session validation fails)
- **Reversible restore** - Admins can unarchive with single click to instantly restore full access
- **Hard delete option** - Available for GDPR/compliance, requires type-to-confirm (user must type exact username)
- **Audit logging** - All archive/unarchive/delete actions logged with timestamp, actor, and reason

---

**Q: What shape should the archive metadata take?**

**A:** Add these fields to Better Auth user table (via `additionalFields`):

```typescript
// Better Auth additional fields
{
  archivedAt: string | null,        // ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)
  archivedBy: string | null,        // user.id of admin who archived
  archivedReason: string | null,    // optional note (max 500 chars)
  // Keep existing Better Auth deletedAt for hard deletes
}
```

**Migration:** Add columns to existing `user` table, default all to `null`.

---

**Q: What fields are needed in create/edit modals?**

**A:**

**Create User Modal:**
- username (required, unique validation)
- name (required, display name)
- email (required, email format validation)
- avatar (optional, URL validation)
- bio (optional, max 500 chars, textarea)
- role (required, dropdown: admin/manager/game_master/customer)
- mustResetPassword (toggle, default ON)
- password (required, min 12 chars, shown on create only)

**Edit User Modal:**
- name (required)
- email (required)
- avatar (optional)
- bio (optional, max 500 chars)
- role (dropdown, admin-only can assign 'admin' role)
- mustResetPassword (toggle)
- **NO password field** (separate "Reset Password" action button)

**Future (Post-MVP):** Per-permission overrides as checkboxes below role selector (modifies `user.permissions` JSON field).

---

**Q: What interaction pattern should confirmation dialogs use?**

**A:** Create reusable `$lib/components/ConfirmDialog.svelte`:

**Component Structure:**
```svelte
<!-- Mobile-first: full-screen on <640px, centered modal on larger -->
<dialog class="modal modal-bottom sm:modal-middle">
  <div class="modal-box">
    <h3 class="font-bold text-lg">{title}</h3>
    <p class="py-4">{message}</p>

    <!-- Type-to-confirm for destructive actions -->
    {#if requiresTypedConfirm}
      <input
        type="text"
        placeholder="Type '{confirmWord}' to confirm"
        class="input input-bordered w-full"
        bind:value={typedValue}
      />
    {/if}

    <!-- Mobile: vertical stack (cancel on top), Desktop: horizontal -->
    <div class="modal-action flex-col-reverse sm:flex-row gap-2">
      <button class="btn btn-ghost w-full sm:w-auto" onclick={cancel}>
        Cancel
      </button>
      <button
        class="btn {variant} w-full sm:w-auto"
        onclick={confirm}
        disabled={requiresTypedConfirm && typedValue !== confirmWord}
      >
        {confirmText}
      </button>
    </div>
  </div>
</dialog>
```

**Variants:**
- `info` → `btn-info` (blue)
- `warning` → `btn-warning` (yellow)
- `danger` → `btn-error` (red)

**Usage Pattern:**
```typescript
import { openConfirmDialog } from '$lib/components/ConfirmDialog.svelte';

// Simple confirmation
const confirmed = await openConfirmDialog({
  title: 'Archive User',
  message: 'This will block login and hide from list. You can unarchive later.',
  confirmText: 'Archive',
  variant: 'warning'
});

// Type-to-confirm (destructive)
const deleted = await openConfirmDialog({
  title: 'Delete User Permanently',
  message: 'This action cannot be undone. All data will be lost.',
  confirmText: 'Delete Forever',
  variant: 'danger',
  requiresTypedConfirm: true,
  confirmWord: user.username
});
```

**Mobile Behavior:**
- Full-screen modal on <640px
- Cancel button on top (safe thumb zone)
- Danger button below (requires deliberate reach)
- Both buttons full-width on mobile

---

### **User List - Mobile-First Layout**

**Breakpoint-Specific Layouts:**

**Mobile (<640px):**
```svelte
<!-- Card-based list, single column -->
<div class="space-y-3">
  {#each users as user}
    <div class="glass-panel p-4">
      <!-- Header: Avatar + Name only -->
      <div class="flex items-center gap-3 mb-3">
        <div class="avatar">
          <div class="w-10 rounded-xl">
            {#if user.avatarUrl}
              <img src={user.avatarUrl} alt={user.name} />
            {:else}
              <div class="bg-base-300 flex items-center justify-center text-sm font-semibold">
                {initials(user.name)}
              </div>
            {/if}
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-base truncate">{user.name}</h3>
          <p class="text-xs text-base-content/60 truncate">{user.username}</p>
        </div>
        <!-- Status badge -->
        <span class="badge badge-sm {user.mustResetPassword ? 'badge-warning' : 'badge-success'}">
          {user.mustResetPassword ? 'Reset' : 'Active'}
        </span>
      </div>

      <!-- Action buttons - horizontal scroll NOT allowed, stack instead -->
      <div class="flex flex-col gap-2">
        <button class="btn btn-sm btn-primary w-full">Edit</button>
        <button class="btn btn-sm btn-ghost w-full">Reset Password</button>
        <button class="btn btn-sm btn-warning w-full">Archive</button>
      </div>
    </div>
  {/each}
</div>
```

**Tablet (640px - 1024px):**
```svelte
<!-- 2-column grid of cards -->
<div class="grid grid-cols-2 gap-4">
  {#each users as user}
    <div class="glass-panel p-5">
      <!-- Same structure as mobile but more breathing room -->
      <div class="flex items-center gap-3 mb-4">
        <div class="avatar">
          <div class="w-12 rounded-xl">
            <!-- avatar content -->
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-lg truncate">{user.name}</h3>
          <p class="text-sm text-base-content/60">{user.email}</p>
          <p class="text-xs text-base-content/50">{user.role}</p>
        </div>
      </div>

      <!-- Actions as horizontal row on tablet -->
      <div class="flex gap-2">
        <button class="btn btn-sm btn-primary flex-1">Edit</button>
        <button class="btn btn-sm btn-ghost flex-1">Reset</button>
        <button class="btn btn-sm btn-warning flex-1">Archive</button>
      </div>
    </div>
  {/each}
</div>
```

**Desktop (≥1024px):**
```svelte
<!-- Full data table -->
<table class="table table-zebra">
  <thead>
    <tr>
      <th>User</th>
      <th>Email</th>
      <th>Role</th>
      <th>Status</th>
      <th>Last Login</th>
      <th class="text-right">Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each users as user}
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <div class="avatar">
              <div class="w-10 rounded-xl"><!-- avatar --></div>
            </div>
            <div>
              <div class="font-semibold">{user.name}</div>
              <div class="text-xs text-base-content/50">{user.username}</div>
            </div>
          </div>
        </td>
        <td>{user.email}</td>
        <td>
          <span class="badge badge-outline">{roleLabel(user.role)}</span>
        </td>
        <td>
          <span class="badge {user.mustResetPassword ? 'badge-warning' : 'badge-success'}">
            {user.mustResetPassword ? 'Reset Required' : 'Active'}
          </span>
        </td>
        <td class="text-sm text-base-content/60">
          {relative(user.lastLoginAt)}
        </td>
        <td>
          <div class="flex justify-end gap-2">
            <button class="btn btn-sm btn-ghost">Edit</button>
            <button class="btn btn-sm btn-ghost">Reset</button>
            <button class="btn btn-sm btn-ghost text-warning">Archive</button>
          </div>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
```

**Key Mobile Rules:**
- ❌ **NO horizontal scrolling tables**
- ✅ Cards with stacked content
- ✅ Only essential fields shown (Name + Actions on mobile)
- ✅ Full-width action buttons (no cramped touch targets)
- ✅ Minimum 44px touch target height (DaisyUI `btn-sm` is 32px, add `py-3` for mobile: `btn-sm py-3`)

---

## **P3-014 · Game Management**

### **Field List and Validation**

**Core Fields (all games):**
```typescript
{
  // Basic Info
  name: string (required, max 100 chars)
  slug: string (required, unique, auto-gen from name, editable)
  description: string (required, max 500 chars)
  storyIntro: string (optional, max 1000 chars, rich text)

  // Gameplay
  durationMinutes: number (required, 5-240)
  difficulty: number (required, 1-5)
  minPlayers: number (required, 1-20)
  maxPlayers: number (required, 1-20, must be ≥ minPlayers)
  resourcesRequired: number (required, default 1, min 1)

  // Pricing & Categorization
  pricingModel: 'PER_PERSON' | 'FLAT_ROOM' (required)
  pricePerPlayerCents: number (required if PER_PERSON, min 0)
  categories: string[] (optional, tag input: Private, Mobile, Horror, etc.)

  // Mobile/Booking
  is_mobile: boolean (default false)
  location_notes: string (optional, max 1000 chars, shown if is_mobile)

  // Branding
  room_theme: string (optional, dropdown: escapeplan-pirate, escapeplan-space, etc.)
  room_screen_asset_id: number | null (FK to assets, for timer display background)
  thumbnail_asset_id: number | null (FK to assets, for booking page)
  gallery_asset_ids: number[] (optional, multi-upload for marketing)

  // Internal
  validationNotes: string (optional, max 500 chars, internal use only)

  // Archive (added in P3-014)
  archivedAt: string | null
  archivedBy: string | null
}
```

**Nested Collections:**
```typescript
// Rooms (separate table, many-to-many via game_room_map)
rooms: {
  uuid: string (unique, immutable)
  name: string (required, max 50 chars)
  slug: string (auto-gen from name, editable, unique)
  description: string (optional, max 300 chars)
  isMobileCapable: boolean (default false)
  themeToken: string (optional, inherits from game if null)
  capacity: number (optional, defaults to game.maxPlayers)
}[]

// Puzzles (separate table, FK to game)
puzzles: {
  uuid: string (unique, immutable)
  title: string (required, max 100 chars)
  description: string (optional, max 500 chars)
  displayOrder: number (auto-calculated, manual override)
  solution: string (optional, encrypted at rest)
  image_asset_id: number | null (FK to assets)
}[]

// Hints (separate table, FK to puzzle)
hints: {
  uuid: string (unique, immutable)
  type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' (required)
  content: string (required if TEXT, max 500 chars)
  asset_id: number | null (required if IMAGE/AUDIO/VIDEO)
  ordinal: number (auto-increment, manual override)
}[]

// Pricing Tiers (separate table, FK to game)
pricingTiers: {
  category: string (required: Adult, Youth, Senior, Group, Private)
  priceCents: number (required, min 0)
  minParticipants: number (optional, min 1)
  maxParticipants: number (optional, must be ≥ min if set)
}[]
```

**No additional schema updates planned for MVP.** Archive flag is part of P3-014.

---

### **Game List - Mobile-First Layout**

**Search & Filters:**
1. **Primary filters** (always visible):
   - "Show archived" toggle (checkbox)
   - "Mobile games only" toggle (checkbox)
   - Search input (name/slug fuzzy)

2. **Secondary filters** (collapsible on mobile):
   - Difficulty (1-5 star buttons)
   - Categories (multi-select chips)

3. **Sort** (dropdown):
   - Name (A-Z)
   - Name (Z-A)
   - Duration (shortest first)
   - Duration (longest first)
   - Recently updated

**Breakpoint Layouts:**

**Mobile (<768px):**
```svelte
<!-- Stacked cards, NO table -->
<div class="space-y-3">
  {#each filteredGames as game}
    <div class="glass-panel p-4">
      <!-- Header: Game name only -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-base truncate">{game.name}</h3>
          <p class="text-xs text-base-content/60 truncate">
            {game.durationMinutes} min · {difficultyStars(game.difficulty)}
          </p>
          {#if game.is_mobile}
            <span class="badge badge-info badge-sm mt-1">Mobile</span>
          {/if}
        </div>
        <!-- Quick status indicator -->
        {#if game.archivedAt}
          <span class="badge badge-ghost badge-sm">Archived</span>
        {/if}
      </div>

      <!-- Action buttons - stacked, NO horizontal scroll -->
      <div class="flex flex-col gap-2">
        <button class="btn btn-sm btn-primary w-full">Edit</button>
        <button class="btn btn-sm btn-ghost w-full">Duplicate</button>
        <button class="btn btn-sm btn-warning w-full">
          {game.archivedAt ? 'Unarchive' : 'Archive'}
        </button>
      </div>
    </div>
  {/each}
</div>
```

**Tablet (768px - 1024px):**
```svelte
<!-- 2-column grid, still cards -->
<div class="grid grid-cols-2 gap-4">
  {#each filteredGames as game}
    <div class="glass-panel p-5">
      <div class="flex items-start gap-3 mb-4">
        {#if game.thumbnail_asset_id}
          <img
            src={assetUrl(game.thumbnail_asset_id)}
            alt={game.name}
            class="w-16 h-16 rounded-lg object-cover"
          />
        {:else}
          <div class="w-16 h-16 rounded-lg bg-base-300 flex items-center justify-center">
            <span class="text-2xl">{gameIcon(game.categories[0])}</span>
          </div>
        {/if}
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-lg truncate">{game.name}</h3>
          <p class="text-sm text-base-content/60">
            {game.durationMinutes} min · {game.minPlayers}-{game.maxPlayers} players
          </p>
          <div class="flex gap-1 mt-1">
            {difficultyStars(game.difficulty)}
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-sm btn-primary flex-1">Edit</button>
        <button class="btn btn-sm btn-ghost flex-1">Duplicate</button>
        <button class="btn btn-sm btn-warning flex-1">Archive</button>
      </div>
    </div>
  {/each}
</div>
```

**Desktop (≥1024px):**
```svelte
<!-- Full data table -->
<table class="table table-zebra">
  <thead>
    <tr>
      <th>Game</th>
      <th>Duration</th>
      <th>Difficulty</th>
      <th>Players</th>
      <th>Categories</th>
      <th>Type</th>
      <th class="text-right">Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each filteredGames as game}
      <tr class:opacity-60={game.archivedAt}>
        <td>
          <div class="flex items-center gap-3">
            {#if game.thumbnail_asset_id}
              <img
                src={assetUrl(game.thumbnail_asset_id)}
                class="w-10 h-10 rounded-lg object-cover"
              />
            {/if}
            <div>
              <div class="font-semibold">{game.name}</div>
              <div class="text-xs text-base-content/50">/{game.slug}</div>
            </div>
          </div>
        </td>
        <td>{game.durationMinutes} min</td>
        <td>
          <div class="flex gap-0.5">
            {#each Array(game.difficulty) as _}
              <span class="text-warning">★</span>
            {/each}
          </div>
        </td>
        <td>{game.minPlayers}-{game.maxPlayers}</td>
        <td>
          <div class="flex gap-1">
            {#each game.categories.slice(0, 2) as cat}
              <span class="badge badge-sm">{cat}</span>
            {/each}
            {#if game.categories.length > 2}
              <span class="badge badge-sm badge-ghost">+{game.categories.length - 2}</span>
            {/if}
          </div>
        </td>
        <td>
          {#if game.is_mobile}
            <span class="badge badge-info">Mobile</span>
          {:else}
            <span class="badge badge-neutral">Storefront</span>
          {/if}
        </td>
        <td>
          <div class="flex justify-end gap-2">
            <button class="btn btn-sm btn-ghost">Edit</button>
            <button class="btn btn-sm btn-ghost">Duplicate</button>
            <button class="btn btn-sm btn-ghost text-warning">
              {game.archivedAt ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
```

---

### **Game Modal - Tabbed Form (MVP Approach)**

**For MVP (P3-014):** Use structured form with JSON textareas for rooms/puzzles/hints.

**Tab Structure:**
1. **Game Details** - Basic info, gameplay settings
2. **Images & Media** - Thumbnails, backgrounds, theme
3. **Rooms** - JSON textarea with validation
4. **Puzzles & Hints** - JSON textarea with validation
5. **Pricing** - Model, tiers, deposits
6. **Booking Rules** - Mobile settings, policies

**Mobile (<640px):**
```svelte
<!-- Full-screen modal -->
<dialog class="modal" data-fullscreen>
  <div class="modal-box w-full max-w-none h-screen m-0 rounded-none">
    <!-- Top tabs - horizontal, swipeable -->
    <div class="tabs tabs-boxed mb-4 overflow-x-auto flex-nowrap">
      <button class="tab {activeTab === 'details' ? 'tab-active' : ''}">
        Details
      </button>
      <button class="tab {activeTab === 'media' ? 'tab-active' : ''}">
        Media
      </button>
      <!-- ... other tabs -->
    </div>

    <!-- Tab content (scrollable) -->
    <div class="overflow-y-auto h-[calc(100vh-12rem)]">
      {#if activeTab === 'details'}
        <!-- Game Details form -->
      {/if}
      <!-- ... other tab content -->
    </div>

    <!-- Bottom sticky actions -->
    <div class="modal-action sticky bottom-0 bg-base-100 pt-4 border-t">
      <button class="btn btn-ghost flex-1">Cancel</button>
      <button class="btn btn-primary flex-1">Save Game</button>
    </div>
  </div>
</dialog>
```

**Desktop (≥1024px):**
```svelte
<!-- Centered modal with side tabs -->
<dialog class="modal modal-middle">
  <div class="modal-box max-w-4xl flex gap-4">
    <!-- Left sidebar tabs - vertical -->
    <div class="tabs tabs-vertical w-40 flex-shrink-0">
      <button class="tab {activeTab === 'details' ? 'tab-active' : ''}">
        Game Details
      </button>
      <button class="tab {activeTab === 'media' ? 'tab-active' : ''}">
        Images & Media
      </button>
      <!-- ... other tabs -->
    </div>

    <!-- Right content area -->
    <div class="flex-1 overflow-y-auto max-h-[80vh]">
      {#if activeTab === 'details'}
        <!-- Game Details form -->
      {/if}
      <!-- ... other tab content -->
    </div>

    <!-- Actions (bottom of modal) -->
    <div class="modal-action">
      <button class="btn btn-ghost">Cancel</button>
      <button class="btn btn-primary">Save Game</button>
    </div>
  </div>
</dialog>
```

**JSON Validation:**
- Real-time syntax highlighting (use CodeMirror or simple pre)
- Error display below textarea with line numbers
- Example templates shown in placeholder

**Post-MVP (P4-007):** Migrate to rich UI:
- `<RoomList>` component with add/remove/drag-reorder
- `<PuzzleEditor>` with nested `<HintList>` (collapsible)
- Media upload with preview, drag-drop, progress bars

---

### **Archive Workflow**

**Same pattern as users:**
- Archive button → confirmation modal ("Why are you archiving this game?")
- API call to `PATCH /api/admin/games/:id/archive` with reason
- Game disappears from default list
- "Show archived" toggle reveals archived games (opacity 60%)
- Unarchive button → instant restore (`PATCH /api/admin/games/:id/unarchive`)
- Hard delete → type-to-confirm with game slug (`DELETE /api/admin/games/:id?force=true`)

---

## **P3-015 · Dashboard & Game Runner**

### **Quick Start Ad-hoc Sessions**

**Entry Point:**
- Dashboard header: `"+ Quick Start"` button (top-right, `btn-primary`)
- Game runner header: Same button
- Keyboard shortcut: `Cmd/Ctrl + K` (opens modal)

**Modal Layout:**

**Mobile (<640px):**
```svelte
<dialog class="modal modal-bottom">
  <div class="modal-box">
    <h3 class="font-bold text-lg mb-4">Quick Start Session</h3>

    <!-- Single-column form -->
    <div class="space-y-4">
      <label class="form-control">
        <span class="label-text">Game</span>
        <select class="select select-bordered w-full">
          <option disabled selected>Select game...</option>
          {#each availableGames as game}
            <option value={game.id}>{game.name} ({game.durationMinutes}min)</option>
          {/each}
        </select>
      </label>

      <label class="form-control">
        <span class="label-text">Room</span>
        <select class="select select-bordered w-full" disabled={!selectedGame}>
          <option disabled selected>Select room...</option>
          {#each availableRooms as room}
            <option value={room.uuid} disabled={room.occupied}>
              {room.name} {room.occupied ? '(Occupied until ' + room.occupiedUntil + ')' : ''}
            </option>
          {/each}
        </select>
      </label>

      <label class="form-control">
        <span class="label-text">Party Size</span>
        <input
          type="number"
          class="input input-bordered w-full"
          min={selectedGame?.minPlayers || 1}
          max={selectedGame?.maxPlayers || 8}
          value={selectedGame?.minPlayers || 2}
        />
      </label>

      <label class="form-control">
        <span class="label-text">Duration (optional)</span>
        <input
          type="number"
          class="input input-bordered w-full"
          placeholder={selectedGame?.durationMinutes + ' min (default)'}
        />
      </label>

      <label class="form-control">
        <span class="label-text">Notes (optional)</span>
        <textarea
          class="textarea textarea-bordered w-full"
          placeholder="Walk-in, event, training..."
          maxlength="500"
        ></textarea>
      </label>
    </div>

    <!-- Stacked action buttons -->
    <div class="modal-action flex-col-reverse gap-2">
      <button class="btn btn-ghost w-full">Cancel</button>
      <button class="btn btn-primary w-full">Start Session</button>
    </div>
  </div>
</dialog>
```

**Desktop (≥768px):**
```svelte
<dialog class="modal modal-middle">
  <div class="modal-box max-w-lg">
    <h3 class="font-bold text-xl mb-4">Quick Start Session</h3>

    <!-- 2-column grid for some fields -->
    <div class="grid grid-cols-2 gap-4 mb-4">
      <label class="form-control col-span-2">
        <span class="label-text">Game</span>
        <select class="select select-bordered">
          <!-- options -->
        </select>
      </label>

      <label class="form-control col-span-2">
        <span class="label-text">Room</span>
        <select class="select select-bordered">
          <!-- options -->
        </select>
      </label>

      <label class="form-control">
        <span class="label-text">Party Size</span>
        <input type="number" class="input input-bordered" />
      </label>

      <label class="form-control">
        <span class="label-text">Duration (min)</span>
        <input type="number" class="input input-bordered" />
      </label>

      <label class="form-control col-span-2">
        <span class="label-text">Notes</span>
        <textarea class="textarea textarea-bordered"></textarea>
      </label>
    </div>

    <div class="modal-action">
      <button class="btn btn-ghost">Cancel</button>
      <button class="btn btn-primary">Start Session</button>
    </div>
  </div>
</dialog>
```

**Backend Behavior:**
```typescript
// POST /api/sessions/quick-start
{
  gameId: number,
  roomUuid: string,
  partySize: number,
  durationOverride?: number,
  notes?: string
}

// Creates:
booking {
  status: 'ADHOC',
  is_adhoc: true,
  customer_name: 'Walk-in',
  customer_email: null,
  customer_phone: null,
  participants: partySize,
  start_time: NOW,
  end_time: NOW + duration,
  price_cents: 0,
  discount_cents: 0,
  deposit_cents: 0,
  balance_due_cents: 0
}

session {
  booking_id: booking.id,
  status: 'RUNNING',
  started_at: NOW,
  elapsed_seconds: 0
}

// Returns session data, frontend redirects to /games/:sessionId
```

**Validation:**
- Room availability check (no overlapping sessions in that room)
- Party size within game min/max
- Duration reasonable (5-240 min)

---

### **Booked Session Visibility**

**Dashboard Widget:**
```svelte
<!-- Combined list: ad-hoc + booked sessions -->
<section class="glass-panel p-6">
  <header class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold">Active Sessions</h2>
    <button class="btn btn-sm btn-primary">+ Quick Start</button>
  </header>

  <div class="space-y-3">
    {#each activeSessions as session}
      <div class="rounded-xl border border-white/10 bg-base-100/60 p-4">
        <!-- Mobile: stacked, Desktop: horizontal -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-semibold">{session.gameName}</h3>
              {#if session.is_adhoc}
                <span class="badge badge-sm badge-ghost">Ad-hoc</span>
              {/if}
            </div>
            <p class="text-sm text-base-content/60">
              {session.roomName} · {session.players} players
            </p>
          </div>

          <div class="text-right sm:text-center">
            <p class="text-2xl font-display {timerColor(session.remainingSeconds)}">
              {formatTimer(session.remainingSeconds)}
            </p>
            <p class="text-xs uppercase text-base-content/50">{session.status}</p>
          </div>
        </div>

        <!-- Actions - mobile: full width buttons, desktop: inline -->
        <div class="flex flex-col sm:flex-row gap-2 mt-4">
          <button class="btn btn-sm btn-primary flex-1">Open Runner</button>
          <button class="btn btn-sm btn-ghost flex-1">Copy Room Link</button>
          <button class="btn btn-sm btn-ghost flex-1">Open Room Display</button>
        </div>
      </div>
    {/each}
  </div>
</section>
```

**Bookings Page:**
```svelte
<!-- Separate "Start Session" button for confirmed bookings -->
{#each confirmedBookings as booking}
  <tr>
    <td>{booking.customerName}</td>
    <td>{booking.gameName}</td>
    <td>{formatTime(booking.startTime)}</td>
    <td>
      {#if booking.sessionId}
        <a href="/games/{booking.sessionId}" class="btn btn-sm btn-ghost">
          View Session
        </a>
      {:else if isUpcoming(booking)}
        <button class="btn btn-sm btn-primary" onclick={() => startSession(booking)}>
          Start Session
        </button>
      {/if}
    </td>
  </tr>
{/each}
```

**Game Runner:**
- No visual distinction between ad-hoc and booked sessions
- Both have identical controls (timer, hints, notes, end session)
- Booking details panel shows "Ad-hoc walk-in" vs customer info

---

### **Static Room Links**

**URL Pattern:**
```
https://escapeplan.local/{game.slug}
Examples:
  - https://escapeplan.local/pirate-mutiny
  - https://escapeplan.local/space-heist
  - https://escapeplan.local/pharaohs-tomb

Multi-room disambiguation (if needed):
  - https://escapeplan.local/pirate-mutiny?room=harbor-hold-uuid
```

**Page Behavior:**
```svelte
<!-- /routes/(public)/[gameSlug]/+page.svelte -->
<script>
  import { page } from '$app/stores';
  import { initializeRealtime } from '$lib/realtime';

  let gameSlug = $page.params.gameSlug;
  let roomUuid = $page.url.searchParams.get('room');
  let activeSession = $state(null);

  // Subscribe to WebSocket for this game
  onMount(() => {
    const unsubscribe = sessionsStore.subscribe((sessions) => {
      activeSession = sessions.find(s =>
        s.gameSlug === gameSlug &&
        (!roomUuid || s.roomUuid === roomUuid)
      );
    });
    return unsubscribe;
  });
</script>

{#if activeSession}
  <!-- Show live timer, hints sent, room background -->
  <div
    class="min-h-screen flex items-center justify-center"
    style="background: url({activeSession.roomBackground}) center/cover"
  >
    <div class="glass-panel p-8 text-center">
      <h1 class="text-6xl font-display mb-4">{activeSession.gameName}</h1>
      <p class="text-8xl font-display {timerColor(activeSession.remainingSeconds)}">
        {formatTimer(activeSession.remainingSeconds)}
      </p>

      {#if activeSession.recentHints.length}
        <div class="mt-8">
          <h2 class="text-2xl font-semibold mb-4">Recent Hints</h2>
          <div class="space-y-4">
            {#each activeSession.recentHints.slice(-3) as hint}
              <div class="glass-panel p-4 text-left">
                {#if hint.type === 'TEXT'}
                  <p>{hint.content}</p>
                {:else if hint.type === 'IMAGE'}
                  <img src={hint.assetUrl} alt="Hint" class="rounded-lg" />
                {:else if hint.type === 'AUDIO'}
                  <audio src={hint.assetUrl} controls class="w-full" />
                {:else if hint.type === 'VIDEO'}
                  <video src={hint.assetUrl} controls class="w-full rounded-lg" />
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <!-- No active session -->
  <div class="min-h-screen flex items-center justify-center bg-base-100">
    <div class="text-center">
      <h1 class="text-4xl font-display text-base-content/60 mb-4">
        Waiting for session...
      </h1>
      <p class="text-lg text-base-content/40">
        This room will display the timer when a game starts.
      </p>
    </div>
  </div>
{/if}
```

**Dashboard Actions:**

**Mobile (<640px):**
```svelte
<!-- Stacked buttons -->
<div class="flex flex-col gap-2">
  <button class="btn btn-sm btn-primary w-full" onclick={copyRoomLink}>
    📋 Copy Room Link
  </button>
  <button class="btn btn-sm btn-ghost w-full" onclick={openRoomDisplay}>
    🖥️ Open Room Display
  </button>
</div>
```

**Desktop (≥768px):**
```svelte
<!-- Inline buttons -->
<div class="flex gap-2">
  <button class="btn btn-sm btn-ghost" onclick={copyRoomLink}>
    📋 Copy Link
  </button>
  <button class="btn btn-sm btn-ghost" onclick={openRoomDisplay}>
    🖥️ Open Display
  </button>
</div>
```

**Copy Link Function:**
```typescript
async function copyRoomLink(session) {
  const url = `${window.location.origin}/${session.gameSlug}`;
  await navigator.clipboard.writeText(url);

  // Show toast
  toast.success('Room link copied!', {
    description: url,
    duration: 3000
  });
}
```

**Open Display Function:**
```typescript
function openRoomDisplay(session) {
  const url = `${window.location.origin}/${session.gameSlug}`;
  window.open(url, '_blank', 'fullscreen=yes');
}
```

---

### **Responsive Breakpoints**

**Mobile (<640px):**
- Single column layout
- Full-width cards
- Stacked action buttons
- Sticky bottom navigation
- No data tables (use cards instead)

**Tablet Portrait (640px - 1024px):**
- 2-column grid for metrics
- Stacked content sections
- Some tables acceptable (if <5 columns)
- Action buttons can be horizontal rows

**Tablet Landscape / Desktop (≥1024px):**
- Multi-column dashboard (2-4 columns)
- Full data tables
- Side-by-side game runner (camera left, controls right)
- Inline action buttons

---

### **Confirmation Modal Pattern**

**Standard Usage:**
```typescript
import { confirmDialog } from '$lib/components/ConfirmDialog';

// Archive user
const archived = await confirmDialog.open({
  title: 'Archive User',
  message: `Archive ${user.name}? They will not be able to log in.`,
  confirmText: 'Archive',
  variant: 'warning'
});

// Delete game (type-to-confirm)
const deleted = await confirmDialog.open({
  title: 'Delete Game Permanently',
  message: 'This action cannot be undone. Type the game slug to confirm.',
  confirmText: 'Delete Forever',
  variant: 'danger',
  requiresTypedConfirm: true,
  confirmWord: game.slug
});

// End session
const ended = await confirmDialog.open({
  title: 'End Session',
  message: 'Mark this session as complete?',
  confirmText: 'End Session',
  variant: 'info'
});
```

---

## **Follow-through Admin Features**

### **File Storage UI**

**Backend API:**
```typescript
// GET /api/admin/storage/status
{
  total_mb: 30720,
  used_mb: 4821,
  available_mb: 25899,
  usage_percent: 15.7,
  assets: {
    count: 127,
    size_mb: 3204,
    by_type: {
      image: { count: 89, size_mb: 2145 },
      audio: { count: 23, size_mb: 456 },
      video: { count: 15, size_mb: 603 }
    }
  },
  hls_cache_mb: 512,
  backups_mb: 1105,
  logs_mb: 89,
  database_mb: 134
}

// GET /api/admin/storage/assets?kind=image&limit=50&offset=0
{
  total: 89,
  assets: [
    {
      id: 1,
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      kind: "IMAGE",
      filename: "pirate-room-bg.jpg",
      mime: "image/jpeg",
      bytes: 2_450_000,
      size_mb: 2.34,
      thumbnailUrl: "/assets/thumb/1.jpg",
      fullUrl: "/assets/1.jpg",
      uploadedBy: "admin",
      uploadedAt: "2025-09-29T10:30:00Z",
      usedBy: {
        games: ["Pirate Mutiny"],
        puzzles: [],
        hints: ["Intro Hint", "Map Clue"]
      }
    }
  ]
}

// POST /api/admin/storage/assets (multipart/form-data)
// Body: file (binary)
// Returns: { id, uuid, url, thumbnailUrl }

// DELETE /api/admin/storage/assets/:uuid?force=true
// soft-delete if force=false, hard-delete if force=true
```

**Frontend UI (Mobile-First):**

**Mobile (<640px):**
```svelte
<!-- Grid view, 2 columns -->
<div class="grid grid-cols-2 gap-3">
  {#each assets as asset}
    <button
      class="glass-panel p-3 text-left"
      onclick={() => openAssetDetail(asset)}
    >
      {#if asset.kind === 'IMAGE'}
        <img src={asset.thumbnailUrl} class="w-full aspect-square object-cover rounded-lg mb-2" />
      {:else if asset.kind === 'AUDIO'}
        <div class="w-full aspect-square bg-base-300 rounded-lg mb-2 flex items-center justify-center">
          <span class="text-4xl">🎵</span>
        </div>
      {:else if asset.kind === 'VIDEO'}
        <video src={asset.fullUrl} class="w-full aspect-square object-cover rounded-lg mb-2" />
      {/if}

      <p class="text-xs font-semibold truncate">{asset.filename}</p>
      <p class="text-xs text-base-content/50">{asset.size_mb.toFixed(2)} MB</p>
    </button>
  {/each}
</div>
```

**Desktop (≥1024px):**
```svelte
<!-- Grid view, 4 columns or List view (table) -->
{#if viewMode === 'grid'}
  <div class="grid grid-cols-4 gap-4">
    <!-- Same as mobile but 4 cols -->
  </div>
{:else}
  <table class="table">
    <thead>
      <tr>
        <th>Preview</th>
        <th>Name</th>
        <th>Type</th>
        <th>Size</th>
        <th>Used By</th>
        <th>Uploaded</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each assets as asset}
        <tr>
          <td>
            <img src={asset.thumbnailUrl} class="w-10 h-10 rounded-lg object-cover" />
          </td>
          <td class="font-semibold">{asset.filename}</td>
          <td><span class="badge">{asset.kind}</span></td>
          <td>{asset.size_mb.toFixed(2)} MB</td>
          <td>
            <span class="badge badge-sm">
              {asset.usedBy.games.length + asset.usedBy.puzzles.length + asset.usedBy.hints.length} uses
            </span>
          </td>
          <td class="text-sm text-base-content/60">{relative(asset.uploadedAt)}</td>
          <td>
            <button class="btn btn-sm btn-ghost">View</button>
            <button class="btn btn-sm btn-ghost text-error">Delete</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
```

---

### **Backup/Log Surfaces**

**Backup Controls (Admin Only):**

**Mobile Layout:**
```svelte
<section class="space-y-4">
  <header class="flex flex-col gap-2">
    <h2 class="text-lg font-semibold">Backups</h2>
    <button class="btn btn-primary w-full">Trigger Backup Now</button>
  </header>

  <!-- Backup list as cards -->
  <div class="space-y-3">
    {#each backups as backup}
      <div class="glass-panel p-4">
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="font-semibold">{formatDateTime(backup.timestamp)}</p>
            <p class="text-sm text-base-content/60">
              {backup.type === 'auto' ? '🤖 Automatic' : '👤 Manual'}
            </p>
          </div>
          <span class="badge {backup.status === 'complete' ? 'badge-success' : 'badge-warning'}">
            {backup.status}
          </span>
        </div>

        <p class="text-sm text-base-content/60 mb-3">
          Size: {(backup.bytes / 1024 / 1024).toFixed(2)} MB
        </p>

        <div class="flex flex-col gap-2">
          <button class="btn btn-sm btn-primary w-full">Download</button>
          <button class="btn btn-sm btn-ghost w-full text-error">Delete</button>
        </div>
      </div>
    {/each}
  </div>
</section>
```

**Desktop Layout:**
```svelte
<section>
  <header class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold">Backups</h2>
    <button class="btn btn-primary">Trigger Backup Now</button>
  </header>

  <table class="table">
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Type</th>
        <th>Size</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each backups as backup}
        <tr>
          <td>{formatDateTime(backup.timestamp)}</td>
          <td>
            <span class="badge">
              {backup.type === 'auto' ? 'Automatic' : 'Manual'}
            </span>
          </td>
          <td>{(backup.bytes / 1024 / 1024).toFixed(2)} MB</td>
          <td>
            <span class="badge {backup.status === 'complete' ? 'badge-success' : 'badge-warning'}">
              {backup.status}
            </span>
          </td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost">Download</button>
              <button class="btn btn-sm btn-ghost text-error">Delete</button>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>
```

**Log Viewer (Read-Only for MVP):**
```svelte
<section>
  <header class="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
    <h2 class="text-lg font-semibold">System Logs</h2>

    <div class="flex flex-col sm:flex-row gap-2 flex-1">
      <select class="select select-bordered flex-1">
        <option value="escapeplan-api">API</option>
        <option value="escapeplan-ffmpeg">FFmpeg</option>
        <option value="nginx">Nginx</option>
        <option value="systemd">Systemd</option>
      </select>

      <select class="select select-bordered flex-1">
        <option value="error">Errors</option>
        <option value="warn">Warnings</option>
        <option value="info">Info</option>
        <option value="debug">Debug</option>
      </select>

      <button class="btn btn-primary">Download Logs</button>
    </div>
  </header>

  <!-- Log output (mobile: full width, desktop: code block) -->
  <pre class="bg-base-300 p-4 rounded-lg overflow-x-auto text-xs sm:text-sm">
    {#each logLines as line}
      <div class="log-line {line.severity}">
        <span class="text-base-content/50">[{line.timestamp}]</span>
        <span class="font-semibold">{line.service}</span>
        <span class={line.severity === 'error' ? 'text-error' : line.severity === 'warn' ? 'text-warning' : ''}>
          {line.message}
        </span>
      </div>
    {/each}
  </pre>
</section>
```

---

### **Role/Permission Tuning**

**MVP:** Per-role only (RBAC matrix from project-overview.md §5.1)

**Roles:**
- `admin` → All permissions
- `manager` → Most permissions except system/network settings
- `game_master` → Read games/rooms, operate sessions, send hints
- `customer` → Create booking, read own booking

**Post-MVP:** Per-user overrides in user edit modal:

```svelte
<!-- User edit modal, advanced section -->
<div class="collapse collapse-arrow">
  <input type="checkbox" />
  <div class="collapse-title font-semibold">
    Advanced: Permission Overrides
  </div>
  <div class="collapse-content">
    <p class="text-sm text-base-content/60 mb-4">
      Override default {user.role} permissions for this user only.
    </p>

    <div class="space-y-2">
      {#each allPermissions as permission}
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm"
            checked={user.permissions.includes(permission)}
            on:change={(e) => togglePermission(permission, e.target.checked)}
          />
          <span class="text-sm">{permissionLabel(permission)}</span>
        </label>
      {/each}
    </div>
  </div>
</div>
```

**Storage:** Better Auth `additionalFields.permissions` as JSON array.

---

## **Mobile-First Immediate Action Plan**

### **Session 10 Priorities:**

1. ✅ **Create ConfirmDialog.svelte** (P3-018) - CRITICAL
   - Blocks P3-013, P3-014, P3-015
   - Mobile-first: full-screen <640px, centered modal ≥640px
   - Variants: info/warning/danger
   - Type-to-confirm support
   - Promise-based API

2. ✅ **Replace inline forms with modals**
   - UserModal: create/edit user form in modal
   - GameModal: tabbed form (MVP: JSON textareas)
   - "+ Add User" and "+ Add Game" header buttons

3. ✅ **Make all lists mobile-responsive**
   - Users: cards <640px, table ≥1024px
   - Games: cards <768px, table ≥1024px
   - Bookings: cards <768px, table ≥768px
   - **NO horizontal scrolling tables on mobile**
   - Show only essential columns (Name + Actions)

4. ✅ **Fix touch targets**
   - Minimum 44×44px (iOS HIG)
   - Prefer 48×48px (Material Design)
   - DaisyUI `btn-sm` = 32px → add `py-3` on mobile

5. ✅ **Dashboard quick actions**
   - "+ Quick Start" modal
   - "Copy Room Link" per session
   - "Open Room Display" per session

### **Next Session Priorities:**

6. **UUID Migration** (P3-019)
   - Add UUIDs to rooms, puzzles, hints, cameras
   - Drizzle migration script
   - Update API contracts
   - Update frontend routes

7. **Archive Workflows**
   - User archive/unarchive
   - Game archive/unarchive
   - API endpoints
   - "Show archived" toggle filters

8. **Camera Management** (P3-016)
   - Camera list (cards mobile, table desktop)
   - Camera add/edit modal
   - Test connection (5s timeout)
   - HLS stream controls

---

**All specifications are now mobile-first with explicit breakpoint behaviors, NO horizontal scrolling on small screens, and proper touch target sizing.**