# Asset Storage Architecture

## Overview

Comprehensive file upload and asset management system for EscapePlan games, hints, and media with monitoring, compression, and backup support.

## Storage Paths

### Dynamic Path Resolution
```typescript
const getAssetBasePath = () => {
  const isDev = process.env.NODE_ENV === 'development';
  return isDev
    ? path.join(process.cwd(), 'apps/escapeplan-api/data/assets')
    : '/var/lib/escapeplan/assets';
};
```

### Directory Structure
```
{basePath}/
├── images/
│   ├── thumbnails/           # Game thumbnails
│   ├── room-backgrounds/     # Room display backgrounds
│   ├── gallery/              # Booking gallery images
│   ├── puzzle-media/         # Puzzle reference images
│   └── hint-media/           # Hint images
├── audio/
│   └── hint-media/           # Hint audio files
└── video/
    └── hint-media/           # Hint video files
```

## Database Schema

### Assets Table
```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,                    -- UUID
  filename TEXT NOT NULL,                 -- Normalized: {game-slug}-{type}-{uuid}.{ext}
  original_filename TEXT NOT NULL,        -- User's original filename
  mime_type TEXT NOT NULL,                -- e.g., 'image/jpeg', 'audio/mpeg'
  size_bytes INTEGER NOT NULL,
  asset_type TEXT NOT NULL,               -- 'thumbnail' | 'room_background' | 'gallery' |
                                          -- 'puzzle_media' | 'hint_media'
  media_type TEXT,                        -- For hint_media: 'text' | 'image' | 'audio' | 'video'
  file_path TEXT NOT NULL,                -- Relative: 'images/thumbnails/{filename}'
  game_id TEXT,                           -- REFERENCES games(id) - nullable for reusable assets
  puzzle_id TEXT,                         -- REFERENCES game_puzzles(id) - for puzzle/hint media
  hint_order INTEGER,                     -- For hint media ordering
  is_reusable INTEGER DEFAULT 0,          -- Boolean: can be used across games
  uploaded_by TEXT NOT NULL,              -- Operator ID
  uploaded_at TEXT NOT NULL,              -- ISO timestamp
  metadata TEXT,                          -- JSON: { width, height, duration, etc. }

  -- Indexes
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (puzzle_id) REFERENCES game_puzzles(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES operators(id)
);

CREATE INDEX idx_assets_game_id ON assets(game_id);
CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_reusable ON assets(is_reusable);
```

### Asset Usage Tracking
```sql
CREATE TABLE asset_usage (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  used_in_game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  used_in_puzzle_id TEXT REFERENCES game_puzzles(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL,  -- 'thumbnail' | 'room_bg' | 'gallery' | 'puzzle' | 'hint'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Storage Metrics Table
```sql
CREATE TABLE storage_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_size_bytes INTEGER NOT NULL,
  total_files INTEGER NOT NULL,
  by_type TEXT NOT NULL,              -- JSON: { images: { count, size }, audio: {...}, video: {...} }
  by_game TEXT NOT NULL,              -- JSON: { game-id: { count, size }, ... }
  last_backup_at TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## File Naming Convention

### Pattern
```
{game-slug}-{asset-type}-{specifics}-{uuid}.{ext}

Examples:
- pirate-mutiny-thumbnail-a1b2c3d4.jpg
- pirate-mutiny-room-bg-e5f6g7h8.jpg
- pirate-mutiny-gallery-1-i9j0k1l2.jpg
- pirate-mutiny-puzzle-intro-m3n4o5p6.jpg
- pirate-mutiny-intro-hint-image-1-q7r8s9t0.jpg
- pirate-mutiny-intro-hint-audio-2-u1v2w3x4.mp3
- pirate-mutiny-treasure-hint-video-3-y5z6a7b8.mp4
```

### Hint Media Naming
```
{game-slug}-{puzzle-slug}-hint-{media-type}-{order}-{uuid}.{ext}

Where:
- game-slug: normalized game name
- puzzle-slug: normalized puzzle title
- media-type: 'text' | 'image' | 'audio' | 'video'
- order: hint order number (1, 2, 3...)
- uuid: short unique identifier
- ext: file extension
```

## File Upload Implementation

### Dependencies
```bash
npm install @fastify/multipart
npm install sharp           # Image processing/compression
npm install fluent-ffmpeg   # Video/audio metadata extraction
```

### Fastify Multipart Setup
```typescript
import multipart from '@fastify/multipart';

// Register plugin with limits
await fastify.register(multipart, {
  limits: {
    fieldNameSize: 100,      // Max field name size
    fieldSize: 1024 * 1024,  // Max field value size (1MB)
    fields: 10,              // Max number of non-file fields
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 1,                // Max files per request
    headerPairs: 2000        // Max header key=>value pairs
  }
});
```

### Upload Endpoint
```typescript
POST /api/assets/upload

Query params:
- gameId: string (required)
- assetType: 'thumbnail' | 'room_background' | 'gallery' | 'puzzle_media' | 'hint_media'
- puzzleId?: string (required for puzzle/hint media)
- mediaType?: 'text' | 'image' | 'audio' | 'video' (required for hint_media)
- order?: number (for hints)
- isReusable?: boolean (default: false)

Body: multipart/form-data
- file: File

Response:
{
  success: true,
  asset: {
    id: string,
    filename: string,
    url: string,  // /assets/images/thumbnails/pirate-mutiny-thumbnail-abc123.jpg
    size: number,
    mimeType: string
  }
}
```

### Upload Handler Logic
```typescript
async function handleAssetUpload(request, reply) {
  const data = await request.file();
  if (!data) throw new Error('No file uploaded');

  const { gameId, assetType, puzzleId, mediaType, order, isReusable } = request.query;

  // Validate file type
  const allowedTypes = getAllow edMimeTypes(assetType, mediaType);
  if (!allowedTypes.includes(data.mimetype)) {
    throw new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
  }

  // Generate filename
  const game = await getGameBySlug(gameId);
  const puzzle = puzzleId ? await getPuzzleById(puzzleId) : null;
  const filename = generateFilename({
    gameSlug: game.slug,
    puzzleSlug: puzzle?.slug,
    assetType,
    mediaType,
    order,
    extension: getExtension(data.mimetype)
  });

  // Determine storage path
  const subPath = getAssetSubPath(assetType, mediaType);
  const fullPath = path.join(getAssetBasePath(), subPath, filename);

  // Ensure directory exists
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

  // Process file (compress if image, extract metadata if video/audio)
  const processedFile = await processFile(data, fullPath, data.mimetype);

  // Save to database
  const asset = await createAssetRecord({
    filename,
    originalFilename: data.filename,
    mimeType: data.mimetype,
    sizeBytes: processedFile.size,
    assetType,
    mediaType,
    filePath: path.join(subPath, filename),
    gameId,
    puzzleId,
    hintOrder: order,
    isReusable: isReusable || false,
    uploadedBy: request.user.id,
    metadata: processedFile.metadata
  });

  // Update storage metrics
  await updateStorageMetrics();

  return { success: true, asset };
}
```

### File Processing
```typescript
async function processFile(data, outputPath, mimeType) {
  const buffer = await data.toBuffer();
  let metadata = {};
  let finalBuffer = buffer;

  if (mimeType.startsWith('image/')) {
    // Compress and extract metadata using sharp
    const image = sharp(buffer);
    const info = await image.metadata();

    metadata = {
      width: info.width,
      height: info.height,
      format: info.format
    };

    // Compress JPEG/PNG
    if (mimeType === 'image/jpeg') {
      finalBuffer = await image.jpeg({ quality: 85 }).toBuffer();
    } else if (mimeType === 'image/png') {
      finalBuffer = await image.png({ compressionLevel: 8 }).toBuffer();
    }
  } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    // Extract metadata using fluent-ffmpeg
    metadata = await extractMediaMetadata(buffer);
  }

  await fs.promises.writeFile(outputPath, finalBuffer);

  return {
    size: finalBuffer.length,
    metadata
  };
}
```

## Storage Monitoring

### Metrics Collection
```typescript
async function updateStorageMetrics() {
  const assets = await db.select().from(assetsTable);

  const byType = {
    images: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
    video: { count: 0, size: 0 }
  };

  const byGame = {};

  for (const asset of assets) {
    const category = asset.filePath.split('/')[0]; // images/audio/video
    byType[category].count++;
    byType[category].size += asset.sizeBytes;

    if (asset.gameId) {
      if (!byGame[asset.gameId]) {
        byGame[asset.gameId] = { count: 0, size: 0 };
      }
      byGame[asset.gameId].count++;
      byGame[asset.gameId].size += asset.sizeBytes;
    }
  }

  const totalSize = Object.values(byType).reduce((sum, t) => sum + t.size, 0);
  const totalFiles = Object.values(byType).reduce((sum, t) => sum + t.count, 0);

  await db.insert(storageMetricsTable).values({
    totalSizeBytes: totalSize,
    totalFiles,
    byType: JSON.stringify(byType),
    byGame: JSON.stringify(byGame),
    recordedAt: new Date().toISOString()
  });
}
```

### Storage Dashboard API
```typescript
GET /api/admin/storage/metrics

Response:
{
  total: {
    size: number,      // bytes
    files: number,
    sizeFormatted: "2.5 GB"
  },
  byType: {
    images: { count: 150, size: 1800000000, sizeFormatted: "1.8 GB" },
    audio: { count: 45, size: 500000000, sizeFormatted: "500 MB" },
    video: { count: 12, size: 200000000, sizeFormatted: "200 MB" }
  },
  byGame: [
    { gameId: "game-1", name: "Pirate Mutiny", count: 25, size: 300000000 },
    // ...
  ],
  lastBackup: "2025-09-29T10:30:00Z"
}
```

## Backup Strategy

### Automated Backups
```bash
#!/bin/bash
# /var/lib/escapeplan/scripts/backup-assets.sh

ASSET_DIR="/var/lib/escapeplan/assets"
BACKUP_DIR="/var/lib/escapeplan/backups/assets"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create backup with compression
tar -czf "$BACKUP_DIR/assets-$TIMESTAMP.tar.gz" -C "$ASSET_DIR" .

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "assets-*.tar.gz" -mtime +7 -delete

# Update last backup timestamp in database
sqlite3 /var/lib/escapeplan/data/escapeplan.db \
  "UPDATE storage_metrics SET last_backup_at = datetime('now') WHERE id = (SELECT MAX(id) FROM storage_metrics)"
```

### Cron Job
```bash
# Daily backup at 2 AM
0 2 * * * /var/lib/escapeplan/scripts/backup-assets.sh >> /var/log/escapeplan/asset-backup.log 2>&1
```

## Asset Reuse

### Reusable Asset Flag
- Default: `is_reusable = 0` (game-specific)
- When enabled: `is_reusable = 1` (can be linked to multiple games)

### Asset Selection UI
Shows two tabs:
1. **Current Game Assets** - Assets uploaded for this game
2. **Reusable Assets** - Assets marked as reusable from any game

### Linking Reusable Assets
```typescript
POST /api/assets/link

Body:
{
  assetId: string,      // Existing asset ID
  gameId: string,       // Target game
  usageType: string     // 'thumbnail' | 'room_bg' | 'gallery'
}

// Creates entry in asset_usage table
// Updates game.media_config to reference the asset
```

## File Size Limits

### Current Limits
- Images: 10 MB
- Audio: 25 MB
- Video: 50 MB

### Configurable via Environment
```env
MAX_IMAGE_SIZE_MB=10
MAX_AUDIO_SIZE_MB=25
MAX_VIDEO_SIZE_MB=50
```

## Security

### File Validation
1. Check MIME type against allowed list
2. Verify file extension matches MIME type
3. Scan for malicious content (if needed)
4. Sanitize filenames

### Access Control
- Upload: Requires `manage_games` permission
- Delete: Requires `manage_games` permission
- View: Based on session access (authenticated operators)

## API Endpoints Summary

```typescript
✅ POST   /api/assets/upload              # Upload new asset
✅ DELETE /api/assets/:id                 # Delete asset and file
✅ GET    /api/assets/list                # List assets (with filters)
✅ POST   /api/assets/link                # Link reusable asset to game
✅ GET    /api/admin/storage/metrics      # Get storage metrics
🚧 POST   /api/admin/storage/backup       # Trigger manual backup (not implemented)
```

### Implementation Details

**POST /api/assets/upload**
- Query params: gameId, assetType, puzzleId?, mediaType?, order?, isReusable?
- Requires `manage_games` permission
- Validates MIME type and file size
- Processes images (compression), extracts video/audio metadata
- Returns: `{ success, asset: { id, filename, url, size, mimeType, metadata } }`

**GET /api/assets/list**
- Query params: gameId?, assetType?, mediaType?, isReusable?, search?
- Requires authentication
- Returns array of assets with URLs and metadata

**DELETE /api/assets/:id**
- Requires `manage_games` permission
- Deletes file from filesystem and database record
- Updates storage metrics
- Returns: `{ success: true }`

**POST /api/assets/link**
- Body: `{ assetId, gameId, usageType, puzzleId? }`
- Requires `manage_games` permission
- Creates asset_usage record
- Returns: `{ success, usage: { id, assetId, gameId, puzzleId, usageType } }`

**GET /api/admin/storage/metrics**
- Requires authentication
- Returns: `{ total: { size, files, sizeFormatted }, byType: {...}, byGame: [...], lastBackup, recordedAt }`

## Implementation Status

### ✅ Completed (Sessions 26 & 27)

#### Session 26: Foundation
1. **Database Schema** - `apps/escapeplan-api/src/db/client.ts`
   - ✅ Added `slug` field to `game_puzzles` table (line 273)
   - ✅ Created `assets` table with full metadata (lines 226-242)
   - ✅ Created `asset_usage` table for reusable assets (lines 248-257)
   - ✅ Created `storage_metrics` table for monitoring (lines 260-267)
   - ✅ Added indexes for performance

2. **Dependencies Installed**
   - ✅ `@fastify/multipart@^9.2.1` - File upload handling
   - ✅ `@fastify/static@^8.2.0` - Static file serving
   - ✅ `sharp@^0.34.4` - Image compression
   - ✅ `fluent-ffmpeg@^2.1.3` - Audio/video metadata extraction
   - ✅ `@types/fluent-ffmpeg@^2.1.27` - TypeScript types

3. **Asset Utility Modules**
   - ✅ `apps/escapeplan-api/src/assets/paths.ts` (157 lines)
     - Dynamic path resolution for dev/production
     - Filename generation with slug support
     - MIME type validation
     - File size limits
     - Directory management
   - ✅ `apps/escapeplan-api/src/assets/processing.ts` (151 lines)
     - Image compression with Sharp
     - FFmpeg metadata extraction
     - Multi-format support
     - Error handling

#### Session 27: Backend Complete
4. **Upload Handler & API** - `apps/escapeplan-api/src/assets/upload.ts` (484 lines)
   - ✅ `handleAssetUpload()` - Full upload pipeline with auth, validation, processing
   - ✅ `getStorageMetrics()` - Formatted metrics retrieval
   - ✅ `listAssets()` - Filtered asset listing
   - ✅ `deleteAsset()` - Asset deletion with filesystem cleanup
   - ✅ `linkReusableAsset()` - Reusable asset linking with usage tracking
   - ✅ Internal `updateStorageMetrics()` - Automatic metrics updates

5. **API Routes** - `apps/escapeplan-api/src/index.ts`
   - ✅ Registered @fastify/multipart (lines 325-334)
   - ✅ Registered @fastify/static (lines 337-345)
   - ✅ POST /api/assets/upload (lines 780-782)
   - ✅ GET /api/assets/list (lines 784-806)
   - ✅ DELETE /api/assets/:id (lines 808-819)
   - ✅ POST /api/assets/link (lines 821-837)
   - ✅ GET /api/admin/storage/metrics (lines 839-848)

### ✅ Backend Complete (Session 27)

#### Core Infrastructure
1. **Upload Endpoint** - `POST /api/assets/upload` ✅
   - Multipart handler with @fastify/multipart
   - File type and size validation
   - Image compression (Sharp) and video/audio metadata (FFmpeg)
   - Database record creation with slug-based filenames
   - Automatic storage metrics updates

2. **File Serving** - `GET /api/assets/*` ✅
   - @fastify/static plugin registered
   - Dynamic path resolution (dev/prod)
   - Serves from `/assets/` prefix

3. **Asset Management APIs** ✅
   - `GET /api/assets/list` - List assets with filters (gameId, assetType, mediaType, isReusable, search)
   - `DELETE /api/assets/:id` - Delete asset and file from filesystem
   - `POST /api/assets/link` - Link reusable asset to game with usage tracking

4. **Storage Metrics API** ✅
   - `GET /api/admin/storage/metrics` - Returns formatted metrics (total, by type, by game)
   - Automatic metrics collection after uploads/deletes
   - Human-readable size formatting

### 🚧 Remaining Work (Next Session)

#### Backend (Optional)
1. **Manual Backup Trigger**
   - `POST /api/admin/storage/backup` - Trigger manual backup job

#### Frontend
5. **Asset Upload Component** - `apps/escapeplan-web/src/lib/components/assets/AssetUpload.svelte`
   - Drag & drop zone
   - File picker
   - Upload progress
   - Preview on success
   - Error handling

6. **GameModal Media Tab**
   - Replace text inputs with upload components
   - Show uploaded asset previews
   - Add delete/replace buttons
   - Support reusable asset selection

7. **Asset Selection UI**
   - Tab: Current Game Assets
   - Tab: Reusable Assets
   - Preview grid
   - Select/link functionality

8. **Storage Dashboard**
   - Display metrics (total size, file count)
   - Breakdown by type
   - Breakdown by game
   - Last backup status

#### DevOps
9. **Backup Automation**
   - Create `/var/lib/escapeplan/scripts/backup-assets.sh`
   - Configure cron job (daily at 2 AM)
   - Retention policy (7 days)
   - Logging

10. **Environment Configuration**
    - Add `.env` variables for file size limits
    - Document configuration options
    - Production deployment notes

## Next Steps

For the next development session, continue with:
1. Review this architecture document
2. Reference SESSION_26_NOTES.md for foundation work completed
3. Start with upload endpoint implementation
4. Use Context7 for @fastify/static best practices if needed
