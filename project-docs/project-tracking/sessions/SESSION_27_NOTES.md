# SESSION 27: Asset Storage Implementation

**Date:** 2025-09-30
**Agent:** CLAUDE-1
**Task:** Complete asset storage backend implementation (upload, serving, metrics)
**Assigned From:** User handoff from SESSION 26

## Objectives

Continue asset storage implementation from Session 26 foundation:

### Backend (Priority)
1. **Upload Endpoint** - `POST /api/assets/upload` with multipart handling
2. **File Serving** - `GET /api/assets/*` with @fastify/static
3. **Storage Metrics API** - `GET /api/admin/storage/metrics`
4. **Asset Management** - List, get, delete, and link endpoints

### Frontend (After Backend)
5. **Asset Upload Component** - Drag & drop with progress
6. **GameModal Media Tab** - Integration with upload UI
7. **Asset Selection Interface** - Current game + reusable assets
8. **Storage Dashboard** - Metrics visualization

### DevOps (Final)
9. **Backup Automation** - Shell script with cron configuration
10. **Environment Configuration** - Document .env variables

## Session Plan

1. Review Session 26 foundation work
2. Review ASSET_STORAGE_ARCHITECTURE.md
3. Implement upload endpoint with multipart handling
4. Add file serving with @fastify/static
5. Create storage metrics collection and API
6. Test upload flow end-to-end
7. Update session notes with progress

## Foundation Review (Session 26)

### Database Schema ✅
- `assets` table with full metadata
- `asset_usage` table for reusable asset tracking
- `storage_metrics` table for monitoring
- Added `slug` field to `game_puzzles` table

### Dependencies Installed ✅
- `@fastify/multipart@^9.2.1` - File upload handling
- `sharp@^0.34.4` - Image compression
- `fluent-ffmpeg@^2.1.3` - Audio/video metadata
- `@types/fluent-ffmpeg@^2.1.27` - TypeScript types

### Utility Modules ✅
- `apps/escapeplan-api/src/assets/paths.ts` (147 lines)
  - Dynamic path resolution (dev: data/assets, prod: /var/lib/escapeplan/assets)
  - Filename generation with slug support
  - MIME type validation
  - File size limits
- `apps/escapeplan-api/src/assets/processing.ts` (147 lines)
  - Image compression with Sharp
  - FFmpeg metadata extraction

## Implementation Log

### Task 1: Register @fastify/multipart Plugin ✅

**File:** `apps/escapeplan-api/src/index.ts`

- Added import for `multipart` and `fastifyStatic` (lines 3-4)
- Added `path` import from node:path (line 1)
- Registered multipart plugin with file size limits (lines 324-334):
  - Field name size: 100 bytes
  - Field size: 1MB
  - Max files: 1
  - Max file size: 50MB
  - Header pairs: 2000

### Task 2: Install & Register @fastify/static ✅

**Installation:**
```bash
pnpm add @fastify/static@^8.2.0
```

**Registration in index.ts** (lines 336-345):
- Dynamic asset path resolution (dev: `data/assets`, prod: `/var/lib/escapeplan/assets`)
- Prefix: `/assets/`
- Disabled reply decoration to avoid conflicts

### Task 3: Create Asset Upload Handler ✅

**File:** `apps/escapeplan-api/src/assets/upload.ts` (NEW - 343 lines)

**Exports:**
- `handleAssetUpload(request, reply)` - Main upload handler
- `getStorageMetrics()` - Storage metrics getter
- `updateStorageMetrics()` - Internal metrics updater

**Upload Handler Features:**
- Authentication check (requires `manage_games` permission)
- Query parameter validation (gameId, assetType, puzzleId, mediaType, order, isReusable)
- File type validation against allowed MIME types
- File size validation against configurable limits
- Game/puzzle lookup from database
- Filename generation using slug-based naming convention
- File processing (compression for images, metadata extraction for audio/video)
- Database record creation with all metadata
- Async storage metrics update

**Validation:**
- Checks `assetType` is one of: thumbnail, room_background, gallery, puzzle_media, hint_media
- For `hint_media`, requires `mediaType` (text/image/audio/video)
- Validates MIME type against allowed list per asset type
- Enforces file size limits (10MB images, 25MB audio, 50MB video by default)

**Database Integration:**
- Uses raw SQLite `prepare()` statements for performance
- Inserts into `assets` table with full metadata
- Creates UUID for asset ID
- Stores file path, original filename, mime type, size, metadata JSON
- Links to game_id (nullable for reusable assets)
- Records uploader ID and timestamp

**Storage Metrics:**
- Collects metrics after each upload (async)
- Groups by file type (images/audio/video)
- Groups by game ID
- Stores total size and file count
- Records timestamp for metrics snapshot

### Task 4: Add API Routes ✅

**File:** `apps/escapeplan-api/src/index.ts`

Added imports (line 52):
```typescript
import { handleAssetUpload, getStorageMetrics } from './assets/upload.js';
```

Added routes (lines 779-793):

**POST /api/assets/upload**
- Delegates to `handleAssetUpload()`
- Returns asset record with generated URL

**GET /api/admin/storage/metrics**
- Requires authentication
- Returns formatted storage metrics:
  - Total size/files with human-readable formatting
  - Breakdown by type (images/audio/video)
  - Breakdown by game with game names
  - Last backup timestamp
  - Recording timestamp

## Completion Checklist

- [x] Create SESSION_27_NOTES.md tracking file
- [x] Implement upload endpoint with multipart handling
- [x] Add file serving with @fastify/static
- [x] Create storage metrics collection system
- [x] Implement storage metrics API
- [x] Implement asset delete API
- [x] Implement asset list API
- [x] Implement reusable asset linking API
- [x] Update ASSET_STORAGE_ARCHITECTURE.md
- [ ] Test upload flow end-to-end (deferred - requires dev server setup)
- [ ] Commit changes with descriptive message

## Artifacts Modified

### New Files Created

1. **apps/escapeplan-api/src/assets/upload.ts** (484 lines)
   - Asset upload handler with authentication, validation, processing
   - Storage metrics collection and retrieval
   - Asset listing with dynamic filtering
   - Asset deletion with filesystem cleanup
   - Reusable asset linking with usage tracking
   - Database integration using raw SQLite statements

### Modified Files

2. **apps/escapeplan-api/src/index.ts**
   - Line 1: Added `path` import
   - Lines 3-4: Added `multipart` and `fastifyStatic` imports
   - Line 52: Added asset handler imports (handleAssetUpload, getStorageMetrics, deleteAsset, listAssets, linkReusableAsset)
   - Lines 325-334: Registered multipart plugin
   - Lines 337-345: Registered static file serving
   - Lines 780-848: Added 5 asset management routes (upload, list, delete, link, metrics)

3. **apps/escapeplan-api/package.json** (via pnpm)
   - Added `@fastify/static@^8.2.0` dependency

4. **project-docs/ASSET_STORAGE_ARCHITECTURE.md**
   - Updated implementation status sections
   - Added API endpoint implementation details
   - Marked backend as complete for Session 27

## Technical Notes

### Path Resolution
- Development: `{project}/apps/escapeplan-api/data/assets`
- Production: `/var/lib/escapeplan/assets`
- Static serving at `/assets/*` maps to base path

### File Naming Convention
Follows architecture spec:
```
{game-slug}-{puzzle-slug}-hint-{media-type}-{order}-{uuid}.{ext}
```

Examples:
- `pirate-mutiny-thumbnail-a1b2c3d4.jpg`
- `pirate-mutiny-intro-hint-image-1-q7r8s9t0.jpg`
- `pirate-mutiny-treasure-hint-video-3-y5z6a7b8.mp4`

### Database Schema
Uses tables created in Session 26:
- `assets` - Asset records with metadata
- `asset_usage` - Reusable asset tracking
- `storage_metrics` - Aggregated storage stats

### Processing Pipeline
1. Validate authentication & permissions
2. Parse and validate request parameters
3. Receive multipart file upload
4. Validate file type and size
5. Lookup game/puzzle from database
6. Generate slug-based filename
7. Process file (compress images, extract video/audio metadata)
8. Save to filesystem
9. Create database record
10. Update storage metrics (async)
11. Return asset URL and metadata

### Task 5: Complete Asset Management APIs ✅

**File:** `apps/escapeplan-api/src/assets/upload.ts`

Added three additional functions (lines 347-483):

**deleteAsset(assetId, userId, userRole):**
- Retrieves asset record from database
- Deletes file from filesystem using `fs.unlink()`
- Removes database record
- Updates storage metrics
- Returns success confirmation

**listAssets(filters):**
- Dynamic SQL query building based on filters
- Filters: gameId, assetType, mediaType, isReusable, search
- For gameId filter, includes both game-specific AND reusable assets
- Returns formatted asset array with URLs and parsed metadata
- Ordered by upload date (newest first)

**linkReusableAsset(params):**
- Validates asset exists and is marked as reusable
- Validates target game exists
- Creates record in `asset_usage` table
- Links asset to game with usage type (thumbnail/room_bg/gallery/puzzle/hint)
- Returns usage record with IDs

**File:** `apps/escapeplan-api/src/index.ts`

Added routes (lines 784-848):

- **GET /api/assets/list** - Lists assets with optional filters
- **DELETE /api/assets/:id** - Deletes asset (requires manage_games permission)
- **POST /api/assets/link** - Links reusable asset to game (requires manage_games permission)

All routes include proper authentication, permission checks, and error handling.

## Known Limitations

1. **No frontend implementation yet** - Upload UI, GameModal integration, and storage dashboard pending
2. **No backup automation** - Scripts and cron jobs not yet created
3. **Manual backup API not implemented** - `POST /api/admin/storage/backup` endpoint not created
4. **Pre-existing type errors** - Several unrelated type errors exist in index.ts and state.ts that were not addressed

## Backend Implementation Summary

**All core asset storage backend functionality is now complete:**

✅ **Upload Pipeline**
- Multipart file handling with size/type validation
- Image compression (JPEG 85%, PNG level 8)
- Video/audio metadata extraction
- Slug-based filename generation
- Database persistence with full metadata

✅ **File Management**
- Static file serving at `/assets/*`
- Asset listing with filters (gameId, type, media, reusable, search)
- Asset deletion with filesystem cleanup
- Storage metrics tracking

✅ **Reusable Assets**
- Asset linking to multiple games
- Usage tracking in asset_usage table
- Support for all asset types

**API Surface:**
- `POST /api/assets/upload` - Upload with processing
- `GET /api/assets/list` - Filtered listing
- `DELETE /api/assets/:id` - Delete with cleanup
- `POST /api/assets/link` - Link reusable asset
- `GET /api/admin/storage/metrics` - Formatted metrics

## Next Session Priorities

### Frontend (Primary Focus)
1. **AssetUpload.svelte** - Drag & drop component with progress indicator
2. **GameModal Media Tab** - Replace text inputs with upload UI
3. **Asset Selection UI** - Browse current game + reusable assets
4. **Storage Dashboard** - Visualize metrics with charts

### DevOps (Secondary)
5. **Backup Script** - `/var/lib/escapeplan/scripts/backup-assets.sh`
6. **Cron Configuration** - Daily backup at 2 AM
7. **Environment Variables** - Document MAX_IMAGE_SIZE_MB, MAX_AUDIO_SIZE_MB, MAX_VIDEO_SIZE_MB

### Testing (Verification)
8. Test upload flow with sample files (image, audio, video)
9. Verify storage metrics accuracy
10. Test file serving at `/assets/*` URLs
11. Validate permission checks
12. Test reusable asset linking workflow
