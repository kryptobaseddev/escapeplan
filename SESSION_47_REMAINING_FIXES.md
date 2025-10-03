# Session 47: Remaining Storage Fixes

**Date:** 2025-10-02
**Status:** 🟡 In Progress

---

## ✅ Completed Fixes

1. **Storage Metrics - Orphaned Assets**
   - Added detection of assets without `game_id`
   - Shows "(Unassigned Assets)" in byGame breakdown
   - Counts ALL assets in system, not just game-associated ones

2. **Database Backup Metrics**
   - Added `database.activeSizeBytes` - Size of escapeplan.db
   - Added `database.backupsSizeBytes` - Total size of all completed backups
   - Added `database.backupCount` - Count of completed backups
   - Updated frontend interface to match

---

## 🔧 Remaining Fixes

### 1. Backup Trigger Button (In Progress)
**Issue:** "Trigger Backup Now" button has no onclick handler
**Location:** `StorageTab.svelte` line 374
**Fix Needed:**
- Add onclick handler to call `/api/admin/backups`
- Show loading state during backup
- Display success/error message
- Refresh backup list after completion

### 2. Asset Library Not Loading
**Issue:** Asset Library tab doesn't show any assets
**Component:** `AssetBrowser.svelte`
**API:** `GET /api/assets/list`
**Fix Needed:**
- Verify `/api/assets/list` endpoint works
- Check if AssetBrowser is calling the API correctly
- Ensure proper data mapping from API response
- Add loading/error states

### 3. Asset Search/Filter Missing
**Issue:** No search or filter functionality in Asset Library
**Fix Needed:**
- Add search input (filter by filename/original_filename)
- Add asset type filter (images/videos/audio)
- Add game filter dropdown
- Update API call with query parameters

---

## API Endpoints Status

### ✅ Working
- `GET /api/admin/system/health` - Real-time system metrics
- `GET /api/admin/storage/metrics` - Enhanced with orphaned assets + backup counts
- `POST /api/admin/backups` - Backup creation (backend ready, frontend not wired)
- `GET /api/admin/backups` - List backups
- `DELETE /api/admin/backups/:id` - Delete backup
- `GET /api/admin/usb-devices` - USB device scan

### 🚧 Needs Frontend Integration
- `POST /api/admin/backups` - Trigger button not connected
- `GET /api/assets/list` - AssetBrowser may not be using it

---

## Implementation Plan

### Priority 1: Backup Trigger (15 min)
```typescript
// In StorageTab.svelte

let backupInProgress = $state(false);
let backupError = $state<string | null>(null);

async function triggerBackup() {
  backupInProgress = true;
  backupError = null;

  try {
    const response = await fetch('/api/admin/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: 'manual',
        includes: {
          database: true,
          games: true,
          assets: false, // Large, optional
          logs: false
        },
        destination: 'local'
      })
    });

    if (!response.ok) throw new Error('Backup failed');

    const backup = await response.json();
    // Show success message
    // Refresh backup list
  } catch (err) {
    backupError = err instanceof Error ? err.message : 'Backup failed';
  } finally {
    backupInProgress = false;
  }
}
```

### Priority 2: Asset Library Fix (30 min)

**Step 1: Check AssetBrowser Component**
```bash
# Location
apps/escapeplan-web/src/lib/components/assets/AssetBrowser.svelte
```

**Step 2: Verify API Call**
```typescript
// Should be calling:
GET /api/assets/list?gameId={optional}&assetType={optional}&search={optional}
```

**Step 3: Add Search/Filter UI**
```svelte
<input type="text" placeholder="Search assets..." bind:value={searchQuery} />
<select bind:value={filterType}>
  <option value="">All Types</option>
  <option value="images">Images</option>
  <option value="audio">Audio</option>
  <option value="video">Video</option>
</select>
```

---

## Storage Breakdown Display (Frontend Update Needed)

### Current UI Shows:
- Total Capacity / Used / Available
- Disk Usage %
- Assets by Type (Images/Videos/Audio)
- Assets by Game

### Should Also Show:
```
Database:
- Active: 42.3 MB (escapeplan.db)
- Backups: 127.8 MB (3 backups)

Images:
- 15 files, 2.0 MB

Videos:
- 3 files, 52.4 MB

Audio:
- 8 files, 1.0 MB

By Game:
- The Mystery Mansion: 12 files, 15.7 MB
- Pirate Mutiny: 8 files, 10.2 MB
- (Unassigned Assets): 6 files, 2.3 MB
```

---

## Testing Checklist

### After Backup Trigger Fix
- [ ] Click "Trigger Backup Now" button
- [ ] Verify loading spinner shows
- [ ] Wait for backup completion (~5-10 seconds)
- [ ] Verify success message displays
- [ ] Check backup appears in list
- [ ] Verify database.backupCount increments

### After Asset Library Fix
- [ ] Navigate to Storage > Asset Library
- [ ] Verify assets load and display
- [ ] Search for specific asset
- [ ] Filter by asset type (Images/Videos/Audio)
- [ ] Verify preview images show correctly
- [ ] Test delete functionality (if exists)

---

## Next Session Tasks

1. **Backup Restore UI**
   - Add "Restore" button for each backup
   - Confirmation dialog with warnings
   - Progress indicator
   - Success/error handling

2. **Backup Download**
   - Add "Download" button for each backup
   - Stream backup file to browser
   - Proper content-disposition headers

3. **USB Backup Support**
   - Detect USB devices
   - Show USB device selector
   - Allow backup to USB destination
   - Handle mount/unmount

---

## Files Modified This Session

1. **Backend**:
   - `apps/escapeplan-api/src/assets/upload.ts` - Enhanced getStorageMetrics()
     - Added orphaned asset detection
     - Added database active + backup sizes
     - Added backup count

2. **Frontend**:
   - `apps/escapeplan-web/src/routes/(app)/admin/system/StorageTab.svelte`
     - Updated interface to include backup metrics

3. **Remaining**:
   - Need to wire up backup trigger button
   - Need to fix Asset Library loading
   - Need to add search/filter UI

---

## Summary

**Completed:**
- ✅ Storage metrics now shows ALL assets (including orphaned)
- ✅ Database breakdown includes active + backup sizes
- ✅ Backup count displayed

**In Progress:**
- 🔧 Backup trigger button (needs onclick handler)
- 🔧 Asset Library (needs investigation)
- 🔧 Search/filter (needs UI implementation)

**Estimated Time to Complete:**
- Backup trigger: 15 minutes
- Asset Library fix: 30 minutes
- Search/filter: 30 minutes
- **Total: ~75 minutes**
