# Remaining Work: UI/UX Fixes & CRUD Testing

**Generated:** 2025-10-02
**Priority:** HIGH - User-facing issues

---

## Type Errors Status ✅

**Total Errors:** 13 → 9 (4 fixed)

### Fixed (Session Current)
- ✅ LogCategory 'rbac' added
- ✅ PricingModel type assertion corrected
- ✅ Contracts rebuilt
- ✅ API built successfully

### Remaining (Low Priority)
- 9 type errors remain - all are LOW severity, pre-existing, no runtime impact
- See `TYPE_ERRORS_ANALYSIS.md` for full details
- Can be addressed in future cleanup session

---

## Critical UI/UX Issues 🚨

### 1. Game Modal - Missing Features

#### 1.1 Missing Cameras Tab ⚠️ HIGH
**Issue:** No UI to associate cameras with games

**Current State:**
- Game modal has tabs: Details, Media, Pricing, Booking, Puzzles, Milestones
- Camera association missing

**Required:**
- Add "Cameras" tab to GameModal
- Multi-select checkboxes for available cameras
- Save to `game.cameraIds` array field (already in schema ✅)

**Implementation Location:**
```
apps/escapeplan-web/src/lib/components/games/GameModal.svelte
```

**API Support:**
- ✅ `cameraIds` field already in `saveGameSchema`
- ✅ Backend handles camera association
- ✅ GET `/api/admin/cameras` returns all cameras

**Mock Design:**
```svelte
<!-- Cameras Tab -->
{#if activeTab === 'cameras'}
  <div class="cameras-section">
    <h3>Associated Cameras</h3>
    <p class="text-sm text-base-content/60">
      Select cameras to display during this game's sessions
    </p>

    <div class="camera-list">
      {#each availableCameras as camera}
        <label class="camera-option">
          <input
            type="checkbox"
            bind:group={workingGame.cameraIds}
            value={camera.id}
          />
          <span>{camera.name}</span>
          <span class="text-xs">{camera.protocol} - {camera.host}</span>
        </label>
      {/each}
    </div>

    {#if workingGame.cameraIds.length === 0}
      <div class="alert alert-info">
        No cameras selected. Sessions will not have camera feeds.
      </div>
    {/if}
  </div>
{/if}
```

---

#### 1.2 Missing Default Volume Setting ⚠️ HIGH
**Issue:** No UI to set game's default audio volume

**Current State:**
- `defaultVolume` field exists in schema (default: 80%)
- Not editable in Game Details tab
- Milestones/Hints should inherit this value

**Required:**
Add to Game Details tab (first tab):
```svelte
<label class="form-control">
  <div class="label">
    <span class="label-text">Default Audio Volume</span>
    <span class="label-text-alt">
      Inherited by hints and milestones (can be overridden)
    </span>
  </div>
  <input
    type="range"
    min="0"
    max="100"
    bind:value={workingGame.defaultVolume}
    class="range range-primary"
  />
  <div class="flex justify-between text-xs px-2">
    <span>Mute</span>
    <span>{workingGame.defaultVolume}%</span>
    <span>Max</span>
  </div>
</label>
```

---

### 2. Hints - Missing Audio Settings ⚠️ HIGH

**Issue:** Hints can have audio/video but no volume control or upload UI

**Current Behavior:**
- Milestones have audio upload button and volume slider ✅
- Hints do NOT have this feature ❌

**Required Changes:**

#### 2.1 Add Audio Upload to HintItem Component
Pattern to follow from Milestones:
```svelte
<!-- In hint editing UI -->
{#if hint.type === 'audio' || hint.type === 'video'}
  <div class="audio-controls">
    <!-- Upload Button -->
    <button
      type="button"
      class="btn btn-sm btn-outline"
      onclick={() => openAudioUpload(hintIndex)}
    >
      <IconUpload size={16} />
      {hint.assetUrl ? 'Change Audio' : 'Upload Audio'}
    </button>

    <!-- Volume Slider -->
    <label>
      <span>Volume</span>
      <input
        type="range"
        min="0"
        max="100"
        bind:value={hint.volumeLevel}
        class="range range-sm range-primary"
      />
      <span>{hint.volumeLevel ?? gameDefaultVolume}%</span>
    </label>
  </div>
{/if}
```

#### 2.2 Update Hint Schema
**Already done!** ✅ The `hintSchema` in validation.ts needs `volumeLevel`:

Check `/packages/contracts/src/validation.ts`:
```typescript
export const hintSchema = z.object({
  uuid: z.string(),
  type: z.enum(['text', 'image', 'audio', 'video']),
  content: z.string(),
  assetUrl: z.string().optional(),
  order: z.number().int().min(1),
  volumeLevel: z.number().int().min(0).max(100).optional() // ADD THIS
});
```

Then rebuild:
```bash
pnpm --filter @escapeplan/contracts build
```

---

### 3. Volume Slider UI/UX Broken 🐛 HIGH

**Issue:** Volume sliders in GameDetailsModal (view-only) not working properly

**Symptoms:**
- Slider "traces back and forth"
- Not visually representing volume correctly
- Different appearance than edit mode

**Expected Behavior:**
- Same slider UI as in GameModal edit mode
- Shows current volume visually
- Disabled (read-only) in view mode

**Current Code Issue:**
GameDetailsModal likely using different slider component or binding.

**Fix Required:**
Standardize all volume sliders to use this pattern:

```svelte
<!-- Read-only volume display -->
<div class="volume-display">
  <input
    type="range"
    min="0"
    max="100"
    value={volumeLevel}
    disabled
    class="range range-sm range-primary"
  />
  <span class="volume-label">{volumeLevel}%</span>
</div>

<style>
  .volume-display input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
```

---

### 4. Milestones - Audio Display Inconsistency 🐛 MEDIUM

**Issue:** GameDetailsModal shows milestone audio as number, hints show slider

**Current:**
- **Hints:** Display volume with slider (correct ✅)
- **Milestones:** Display volume as plain number (incorrect ❌)

**Fix:**
Update GameDetailsModal milestone display to match hints:

```svelte
<!-- BEFORE -->
<div>Audio: {milestone.volumeLevel}%</div>

<!-- AFTER -->
<div class="audio-level">
  <span class="label">Audio Level:</span>
  <input
    type="range"
    min="0"
    max="100"
    value={milestone.volumeLevel}
    disabled
    class="range range-xs range-primary"
  />
  <span>{milestone.volumeLevel}%</span>
</div>
```

---

### 5. Media Playback Error 🐛 HIGH

**Error:**
```
Uncaught TypeError: Cannot read properties of null (reading 'pause')
at GameDetailsModal.svelte:70:14
at stopAllMedia (GameDetailsModal.svelte:69:33)
```

**Root Cause:**
The `stopAllMedia()` function tries to pause media elements that don't exist or aren't loaded yet.

**Current Code (GameDetailsModal.svelte:69-70):**
```javascript
function stopAllMedia() {
  document.querySelectorAll('audio, video').forEach(media => {
    media.pause(); // ❌ media might be null
  });
}
```

**Fix:**
```javascript
function stopAllMedia() {
  document.querySelectorAll('audio, video').forEach(media => {
    if (media && typeof media.pause === 'function') {
      try {
        media.pause();
        media.currentTime = 0;
      } catch (e) {
        console.warn('Failed to pause media:', e);
      }
    }
  });
}
```

**Trigger:** Occurs when:
1. Viewing game details
2. Media previews are playing
3. User clicks "Edit" or closes modal
4. stopAllMedia() called but media element not fully loaded

---

## Testing Checklist 🧪

### CRUD Operations to Test

#### Games ✅
- [x] Schema refactored
- [ ] Create new game with all fields
- [ ] Edit existing game
- [ ] Add/remove cameras (after Cameras tab implemented)
- [ ] Add/remove puzzles
- [ ] Add/remove milestones
- [ ] Set default volume
- [ ] Upload media assets
- [ ] Archive/unarchive

#### Users ✅
- [x] Schema refactored
- [ ] Create operator
- [ ] Update operator profile
- [ ] Reset password
- [ ] Archive/unarchive

#### Roles ✅
- [x] Schema refactored
- [ ] Create role
- [ ] Update role
- [ ] Assign permissions
- [ ] Delete role

#### Cameras ✅
- [x] Schema refactored
- [ ] Create camera
- [ ] Update camera settings
- [ ] Test connection
- [ ] Delete camera
- [ ] Associate with game (after UI implemented)

#### Sessions ✅
- [x] Schema refactored
- [ ] Quick start session
- [ ] Start/pause/resume timer
- [ ] Send hints
- [ ] Trigger milestones
- [ ] View camera feeds
- [ ] Complete session

#### Hints (NEW) ⚠️
- [ ] Add hint to puzzle
- [ ] Upload audio for hint
- [ ] Set hint volume level
- [ ] Preview hint audio
- [ ] Save puzzle with audio hints

---

## Implementation Priority

### Phase 1: Critical Fixes (2-3 hours)
1. Fix media playback error (30 min)
2. Add default volume to Game Details tab (30 min)
3. Add volumeLevel to hint schema (15 min)
4. Standardize volume slider UI (1 hour)
5. Test game CRUD operations (30 min)

### Phase 2: Missing Features (3-4 hours)
1. Add Cameras tab to GameModal (2 hours)
   - Fetch cameras list
   - Multi-select UI
   - Save camera associations
   - Test camera display in sessions

2. Add audio controls to Hints (2 hours)
   - Upload button
   - Volume slider
   - Preview playback
   - Test in game sessions

### Phase 3: Polish (1-2 hours)
1. Fix milestone audio display consistency (30 min)
2. Add volume inheritance logic (1 hour)
   - Hints without volume → use game default
   - Milestones without volume → use game default
3. Comprehensive CRUD testing (30 min)

**Total Estimated Time:** 6-9 hours

---

## Files to Modify

### Frontend (Svelte)
1. `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`
   - Add Cameras tab
   - Add default volume input

2. `apps/escapeplan-web/src/lib/components/games/GameDetailsModal.svelte`
   - Fix stopAllMedia error
   - Fix milestone audio display
   - Standardize volume sliders

3. `apps/escapeplan-web/src/lib/components/games/PuzzlesTab.svelte` (or wherever hints are edited)
   - Add audio upload for hints
   - Add volume slider for hints

### Backend (API)
1. `packages/contracts/src/validation.ts`
   - Add `volumeLevel` to `hintSchema`
   - Rebuild contracts

2. `apps/escapeplan-api/src/state.ts` (if needed)
   - Verify hint persistence includes volume

---

## Success Criteria

### Must Have ✅
- [ ] No console errors when viewing/editing games
- [ ] Default volume settable in game details
- [ ] Cameras associable with games
- [ ] Hints have audio upload and volume control
- [ ] All volume sliders work consistently
- [ ] All CRUD operations tested and working

### Nice to Have 🌟
- [ ] Volume inheritance clearly documented in UI
- [ ] Audio preview works in all contexts
- [ ] Camera feed preview in game modal
- [ ] Bulk camera assignment

---

## Notes

### Audio Volume Inheritance Logic
```
Game Default (80%)
  ↓ inherits if not set
Milestone Volume (can override)
  ↓ inherits if not set
Hint Volume (can override)
```

### Camera Association Flow
```
1. Admin creates cameras in /admin/cameras
2. Admin edits game → Cameras tab
3. Selects which cameras to use
4. Saves game with cameraIds array
5. Session starts → loads associated cameras
6. Dashboard shows camera feeds for active sessions
```

---

## References

- Schema Refactoring: `SCHEMA_REFACTOR_COMPLETE.md`
- Type Errors: `TYPE_ERRORS_ANALYSIS.md`
- API Documentation: `apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md`
- Original Issues: This document

---

## Next Steps

1. Review this document
2. Prioritize which issues to tackle first
3. Create feature branch: `git checkout -b fix/ui-ux-improvements`
4. Work through Phase 1 critical fixes
5. Test each fix thoroughly
6. Move to Phase 2 and 3

**Estimated completion:** 1-2 development sessions
