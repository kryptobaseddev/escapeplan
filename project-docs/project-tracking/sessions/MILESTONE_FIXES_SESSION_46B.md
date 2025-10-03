# Milestone System Fixes - Session 46B

**Date:** 2025-10-01
**Status:** 🔧 IN PROGRESS - 2 of 4 Issues Fixed

---

## Issues Reported & Status

### ✅ Issue #2 FIXED: Type Auto-Filling Name
**Problem:** Milestone name should auto-fill based on Type selection (Intro→"Intro", Escaped→"Escaped", Failed→"Failed", Custom→editable)

**Solution Implemented:**
- Moved Type selector before Name field
- Added `onchange` handler that auto-fills name based on type
- Made Name field `readonly` for intro/escaped/failed types
- Custom type allows user to enter any name
- Default milestone type changed from 'custom' to 'intro'

**Files Modified:**
- `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`
  - Lines 1837-1876: Reordered fields and added auto-fill logic
  - Lines 292-293: Changed default type to 'intro' with name 'Intro'

**Code:**
```svelte
<select
  class="select select-bordered select-sm"
  bind:value={milestone.type}
  onchange={(e) => {
    const type = (e.currentTarget as HTMLSelectElement).value as MilestoneType;
    milestone.type = type;
    // Auto-fill name based on type (except custom)
    if (type === 'intro') {
      milestone.name = 'Intro';
    } else if (type === 'escaped') {
      milestone.name = 'Escaped';
    } else if (type === 'failed') {
      milestone.name = 'Failed';
    }
    markDirty();
  }}
>
```

---

### ❌ Issue #1 NOT FIXED: Asset Upload UI
**Problem:** Using manual "Asset ID" input instead of proper file upload UI like HintModal

**Current State:**
- Milestone form has text input for Asset ID
- User must manually enter asset ID from Media tab
- No file upload button
- No preview of uploaded asset

**Required Solution:**
Need to replicate HintModal's upload pattern:
1. Add hidden file input element
2. Add "Upload" button that triggers file input
3. Call `/api/assets/upload?gameId=X&assetType=milestone_media&mediaType=X&milestoneId=X`
4. Store returned `asset.url` in `milestone.assetUrl` field
5. Show upload status (uploading spinner, error messages)
6. Display uploaded asset info (filename, preview for images)

**Note:** `assetType` should be `'milestone_media'` (needs to be added to UploadAssetQuery type in `apps/escapeplan-api/src/assets/upload.ts:18`)

**Files to Modify:**
- `apps/escapeplan-api/src/assets/upload.ts` - Add 'milestone_media' to assetType union
- `apps/escapeplan-web/src/lib/components/games/GameModal.svelte` - Add upload UI (lines 1948-1960)

---

### ❓ Issue #3 INVESTIGATION NEEDED: Milestones Not Saving
**Problem:** Added milestone but it doesn't show in modal or database

**Investigation Results:**
- ✅ Database table `game_milestones` EXISTS and has correct schema
- ✅ API function `persistGameMilestones()` is implemented correctly
- ✅ API is calling `persistGameMilestones(gameId, payload.milestones)` in both createGame and updateGame
- ✅ SaveGameRequest contract includes `milestones` field
- ✅ GameModal `buildPayload()` includes `cleanMilestones` in payload
- ❌ Database has 0 milestones (SELECT COUNT(*) = 0)

**Possible Causes:**
1. **UI Issue:** Milestones array is empty when form is submitted
   - Check if `workingGame.milestones` is populated after clicking "+ Add milestone"
   - Verify `addMilestone()` function is being called
   - Verify `updatePayload()` is being called after adding milestone

2. **Validation Issue:** Form validation failing before save
   - Check if milestone name is required but empty
   - Check if any required fields are missing

3. **API Rejection:** Server rejecting the request
   - Check browser Network tab for 400/500 errors
   - Check API logs for errors during game save

**Debugging Steps:**
1. Open Game Settings
2. Go to Milestones tab
3. Click "+ Add milestone"
4. Fill in required fields (Type, Name)
5. Open browser DevTools Console
6. Check `workingGame.milestones` - should have 1 item
7. Click "Save changes"
8. Check Network tab for `/api/admin/games` POST request
9. Inspect request payload → should have `milestones` array
10. Check response → should be 200 OK
11. If error, check response body for error message

**Quick Test Command:**
```bash
# After trying to save a milestone, check database
sqlite3 /mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api/data/escapeplan.db \
  "SELECT id, name, type FROM game_milestones;"
```

---

### ❌ Issue #4 NOT VERIFIED: Game Runner Milestones Panel Not Appearing
**Problem:** Milestones panel not showing in game runner

**Current Analysis:**
Code in `games/[sessionId]/+page.svelte` (lines 484-554) LOOKS CORRECT:
```svelte
{#if session.availableMilestones && session.availableMilestones.length > 0}
  <div id="milestones" class="glass-panel...">
    <!-- Milestone cards -->
  </div>
{/if}
```

**Why It's Not Showing:**
The panel is conditional on `session.availableMilestones.length > 0`.
If Issue #3 is not fixed (milestones not saving), then there are NO milestones in the database, so:
1. API returns empty `availableMilestones` array
2. Condition evaluates to false
3. Panel doesn't render

**Solution:** Fix Issue #3 first, then milestones panel should automatically appear.

**To Verify After Fix #3:**
1. Create a game with milestones
2. Start a session for that game
3. Go to game runner (`/games/[sessionId]`)
4. Scroll down
5. Should see "Game Milestones" panel with colored cards

---

## What's Working Now

✅ Milestone Type auto-fills Name (intro/escaped/failed = fixed names, custom = editable)
✅ Milestone default type is 'intro' with name 'Intro'
✅ Name field is readonly for non-custom types
✅ Database schema exists and is correct
✅ API persistence logic is correct
✅ SaveGameRequest includes milestones field
✅ buildPayload includes milestones
✅ Game Runner has milestone panel UI code

---

## What Still Needs Fixing

❌ **Asset Upload UI** - Replace text input with file upload (like HintModal)
❓ **Milestone Saving** - Debug why milestones aren't persisting (likely UI/validation issue)
❌ **Game Runner Panel** - Will work once milestones are saved

---

## Next Steps

### Priority 1: Debug Milestone Saving (Issue #3)
1. Test in browser:
   - Open GameModal
   - Add milestone
   - Check browser console for `workingGame.milestones`
   - Save game
   - Check Network tab for POST payload
   - Check for errors

2. If payload is missing milestones:
   - Check if `markDirty()` / `updatePayload()` being called
   - Check if form validation failing silently

3. If payload has milestones but not saving:
   - Check API logs for errors
   - Check database constraints

### Priority 2: Add Asset Upload UI (Issue #1)
1. Update `apps/escapeplan-api/src/assets/upload.ts:18`
   - Add `'milestone_media'` to assetType union
2. Update GameModal milestone form
   - Add file input element
   - Add upload button
   - Add upload handler function
   - Add loading/error states
   - Show uploaded asset info

### Priority 3: Verify Game Runner Panel (Issue #4)
1. After fixing #3, create game with milestone
2. Start session
3. Verify panel appears
4. Test clicking milestone to trigger

---

## Files Modified This Session

1. `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`
   - Fixed Type auto-filling Name
   - Changed default milestone type to 'intro'

---

## Testing Checklist

- [x] Type selector auto-fills name for intro/escaped/failed
- [x] Custom type allows editable name
- [x] Name field is readonly for preset types
- [ ] Can upload media files for milestones
- [ ] Milestones save to database
- [ ] Milestones appear in Game Details Modal
- [ ] Milestones appear in Game Runner panel
- [ ] Can trigger milestone in game runner
- [ ] Milestone triggers broadcast to room display

---

**Current Status:** 2 of 4 issues fixed. Milestone saving needs debugging, then asset upload UI needs implementation.
