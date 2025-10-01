# Asset Storage Configuration

This document describes the environment variables and configuration options for the EscapePlan asset storage system.

## Environment Variables

### Storage Paths

#### `ESCAPEPLAN_DATA_DIR`
- **Type:** String (path)
- **Default:**
  - Development: `./data`
  - Production: `/var/lib/escapeplan`
- **Description:** Base directory for all EscapePlan data including database and assets

#### `ESCAPEPLAN_ASSET_DIR`
- **Type:** String (path)
- **Default:** `${ESCAPEPLAN_DATA_DIR}/assets`
- **Description:** Directory where uploaded asset files are stored
- **Structure:**
  ```
  assets/
  ├── thumbnails/
  ├── room-backgrounds/
  ├── gallery/
  ├── puzzles/
  └── hints/
  ```

### File Size Limits

#### `MAX_IMAGE_SIZE_MB`
- **Type:** Integer
- **Default:** `10`
- **Description:** Maximum size for image uploads in megabytes
- **Valid Range:** 1-100
- **Affected Types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`

#### `MAX_AUDIO_SIZE_MB`
- **Type:** Integer
- **Default:** `25`
- **Description:** Maximum size for audio uploads in megabytes
- **Valid Range:** 1-200
- **Affected Types:** `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp3`

#### `MAX_VIDEO_SIZE_MB`
- **Type:** Integer
- **Default:** `50`
- **Description:** Maximum size for video uploads in megabytes
- **Valid Range:** 1-500
- **Affected Types:** `video/mp4`, `video/webm`, `video/quicktime`

### Backup Configuration

#### `ESCAPEPLAN_BACKUP_DIR`
- **Type:** String (path)
- **Default:**
  - Development: `./data/backups`
  - Production: `/var/backups/escapeplan`
- **Description:** Directory where backup archives are stored

#### `BACKUP_RETENTION_DAYS`
- **Type:** Integer
- **Default:** `7`
- **Description:** Number of days to retain automatic backups
- **Valid Range:** 1-365
- **Note:** Manual backups (not prefixed with `auto-`) are never automatically deleted

## API Configuration

### Upload Endpoint

**POST** `/api/assets/upload`

Query Parameters:
- `gameId` (required): Game identifier
- `assetType` (required): One of `thumbnail`, `room_background`, `gallery`, `puzzle_media`, `hint_media`
- `puzzleId` (optional): Required for `puzzle_media` and `hint_media` types
- `mediaType` (optional): Required for `hint_media` - one of `text`, `image`, `audio`, `video`
- `order` (optional): Display order for hints
- `isReusable` (optional): Whether asset can be shared across games

Request:
- Content-Type: `multipart/form-data`
- Field: `file` (binary)

Response:
```json
{
  "id": "uuid-v4",
  "filename": "game-slug-asset-type-uuid.ext",
  "original_filename": "original.ext",
  "mime_type": "image/jpeg",
  "size_bytes": 102400,
  "asset_type": "thumbnail",
  "url": "/assets/game-slug-asset-type-uuid.ext",
  "metadata": {
    "width": 1920,
    "height": 1080,
    "duration": null
  }
}
```

### Asset Serving

**GET** `/assets/:filename`

- Serves files with appropriate `Content-Type` headers
- Supports byte-range requests for video streaming
- Cache headers set for 1 year (immutable assets)

## Backup & Restore

### Manual Backup

```bash
# Development
./scripts/backup-storage.sh my-backup-name

# Production
/usr/local/bin/escapeplan-backup
```

### Automated Backups

Production deployments include a systemd timer that runs daily at 2:00 AM:

```bash
# Enable automatic backups
sudo systemctl enable escapeplan-backup.timer
sudo systemctl start escapeplan-backup.timer

# Check timer status
sudo systemctl status escapeplan-backup.timer
sudo systemctl list-timers

# View backup logs
sudo journalctl -u escapeplan-backup.service
```

### Restore from Backup

```bash
# Development
./scripts/restore-storage.sh auto-20250930-020000.tar.gz

# Production
sudo /usr/local/bin/escapeplan-restore auto-20250930-020000.tar.gz
```

## Storage Metrics

The system tracks storage usage and records metrics in the `storage_metrics` table:

```sql
SELECT * FROM storage_metrics ORDER BY recorded_at DESC LIMIT 10;
```

Available via API:

**GET** `/api/admin/storage/metrics`

Response:
```json
{
  "total": {
    "totalBytes": 107374182400,
    "usedBytes": 5368709120,
    "availableBytes": 102005473280,
    "usedPercent": 5
  },
  "byType": {
    "images": { "totalFiles": 45, "totalBytes": 2097152000 },
    "audio": { "totalFiles": 12, "totalBytes": 524288000 },
    "videos": { "totalFiles": 8, "totalBytes": 2621440000 }
  },
  "byGame": [
    {
      "gameId": "pirate-mutiny",
      "gameName": "Pirate Mutiny",
      "totalFiles": 23,
      "totalBytes": 1572864000
    }
  ],
  "lastBackupAt": "2025-09-30T02:00:15Z"
}
```

## File Naming Convention

Assets are stored with slug-based filenames:

**Pattern:** `{game-slug}-{asset-type}-{uuid}.{ext}`

Examples:
- `pirate-mutiny-thumbnail-a1b2c3d4.jpg`
- `pirate-mutiny-room-background-e5f6g7h8.mp4`
- `pirate-mutiny-puzzle-intro-hint-video-1-i9j0k1l2.mp4`

## Security Considerations

1. **Authentication Required:** All upload endpoints require `manage_games` permission
2. **MIME Type Validation:** Files are validated against allowed types before processing
3. **File Size Limits:** Enforced before saving to disk
4. **Path Traversal Prevention:** Filenames are sanitized and UUIDs prevent collisions
5. **Virus Scanning:** ⚠️ Not yet implemented - planned for production hardening

## Performance Optimization

### Image Processing
- JPEG compression: 85% quality
- PNG compression: Level 8
- Automatic WebP conversion (planned)
- Thumbnail generation (planned)

### Video Processing
- Metadata extraction only (no transcoding)
- FFmpeg used for duration/codec detection
- HLS transcoding handled separately by `escapeplan-ffmpeg@` service

### Caching
- Static assets served with far-future cache headers
- CDN-ready (no cookies, immutable URLs)
- Asset URLs include UUID to prevent cache invalidation issues

## Monitoring

### Disk Space Alerts

Add to your monitoring system:

```bash
# Check available space
df -h /var/lib/escapeplan

# Alert if less than 10% free
USED_PERCENT=$(df /var/lib/escapeplan | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $USED_PERCENT -gt 90 ]; then
  echo "WARNING: Disk usage above 90%"
fi
```

### Backup Health Check

```bash
# Verify recent backup exists
find /var/backups/escapeplan -name "auto-*.tar.gz" -mtime -1 | grep -q . || echo "ERROR: No backup in last 24 hours"

# Verify checksums
cd /var/backups/escapeplan
for backup in auto-*.tar.gz; do
  if [ -f "$backup.sha256" ]; then
    sha256sum -c "$backup.sha256" || echo "ERROR: Checksum failed for $backup"
  fi
done
```

## Troubleshooting

### "No space left on device"
1. Check disk usage: `df -h /var/lib/escapeplan`
2. Review backup retention: `BACKUP_RETENTION_DAYS`
3. Clean old assets: Use Storage Dashboard to identify large unused files
4. Consider increasing storage or moving to external volume

### "Permission denied"
1. Verify ownership: `ls -la /var/lib/escapeplan`
2. Should be: `escapeplan:escapeplan`
3. Fix with: `sudo chown -R escapeplan:escapeplan /var/lib/escapeplan`

### "Upload failed: File too large"
1. Check configured limits in `.env`
2. Verify nginx upload limits: `/etc/nginx/nginx.conf`
  ```nginx
  client_max_body_size 50M;
  ```
3. Restart services after changes

## Migration Guide

### From Text Input to Asset Upload

If upgrading from a version that used text-based asset IDs:

1. Existing asset IDs in `media.thumbnailAssetId` etc. will continue to work
2. New uploads will generate UUIDs as asset IDs
3. Manual migration script available: `scripts/migrate-asset-ids.sh` (planned)

## Future Enhancements

- [ ] Automatic image optimization and responsive variants
- [ ] Video thumbnail extraction
- [ ] Bulk upload UI
- [ ] Asset usage tracking and cleanup suggestions
- [ ] S3-compatible storage backend option
- [ ] Asset tagging and advanced search
- [ ] Asset versioning and history
