# Camera Support - Implementation Guide

## MVP: Focused on What Matters

### 1. Database (2 Tables)

**Enhanced `cameras` table:**
- Add `brand`, `model` fields
- Add `main_stream_path`, `sub_stream_path` (replace single `stream_path`)
- Add capability flags: `has_ptz`, `has_audio`, `has_ir_control`
- Add settings: `ir_mode`, `audio_volume`
- Add PTZ position: `ptz_pan`, `ptz_tilt`, `ptz_zoom`

**New `camera_streams` table:**
- Track main/sub stream configs separately
- Store resolution, fps, codec per stream

### 2. Backend (3 Core Functions)

**A. Test Connection** (validate stream)
```typescript
POST /api/cameras/test
{
  host: "10.10.10.100",
  port: 554,
  username: "admin",
  password: "password",
  streamPath: "/Streaming/Channels/101"
}

// Returns:
{
  valid: true,
  resolution: "1920x1080",
  fps: 20,
  codec: "h264",
  hasAudio: true
}
```

**B. Brand Template Lookup**
```typescript
GET /api/camera-brands

// Returns:
[
  {
    id: "hikvision",
    name: "Hikvision",
    port: 554,
    main_path: "/Streaming/Channels/101",
    sub_path: "/Streaming/Channels/102"
  },
  // ...
]
```

**C. Create Camera** (with auto-config from brand)
```typescript
POST /api/cameras
{
  name: "Front Door",
  brand: "hikvision",
  host: "10.10.10.100",
  username: "admin",
  password: "password"
}

// Auto-fills port, paths from brand template
```

### 3. Frontend (Simplified UI Flow)

**Step 1: Brand Selection**
```svelte
<select bind:value={camera.brand}>
  <option value="reolink">Reolink</option>
  <option value="hikvision">Hikvision</option>
  <option value="dahua">Dahua</option>
  <!-- ... -->
</select>
```

**Step 2: Auto-Fill from Template**
```javascript
// When brand changes:
onBrandChange(brand) {
  const template = templates.find(t => t.id === brand);
  camera.port = template.port;
  camera.main_stream_path = template.main_path;
  camera.sub_stream_path = template.sub_path;
}
```

**Step 3: Manual Fields**
```svelte
<input bind:value={camera.host} placeholder="10.10.10.100" />
<input bind:value={camera.username} placeholder="admin" />
<input type="password" bind:value={camera.password} />
```

**Step 4: Test Connection**
```javascript
async function testConnection() {
  const result = await fetch('/api/cameras/test', {
    method: 'POST',
    body: JSON.stringify(camera)
  });
  
  if (result.valid) {
    // Show success + stream info
  } else {
    // Show error
  }
}
```

---

## Future Phases (Post-MVP)

### Phase 2: Network Scan (8 hours)
```javascript
// Add "Scan Network" button
async function scanNetwork() {
  const cameras = await fetch('/api/cameras/scan?subnet=10.10.10.0/24');
  // Show discovered cameras, user picks which to add
}
```

**Backend:**
```typescript
// Uses evilscan to find open ports 554, 80, 8080, 88
// Tests common URL patterns
// Returns candidates with auto-detected brand
```

### Phase 3: ONVIF Discovery (12 hours)
```javascript
// Add "Discover ONVIF" button
async function discoverOnvif() {
  const cameras = await fetch('/api/cameras/discover-onvif');
  // Shows ONVIF cameras with full details pre-filled
}
```

**Backend:**
```typescript
// Uses node-onvif to probe network
// Gets stream URLs, manufacturer, model
// Returns cameras ready to add
```

---

## Migration from Your Current Schema

```sql
-- Add new columns to existing cameras table
ALTER TABLE cameras ADD COLUMN brand TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE cameras ADD COLUMN model TEXT;
ALTER TABLE cameras ADD COLUMN main_stream_path TEXT;
ALTER TABLE cameras ADD COLUMN sub_stream_path TEXT;
ALTER TABLE cameras ADD COLUMN has_ptz INTEGER DEFAULT 0;
ALTER TABLE cameras ADD COLUMN has_audio INTEGER DEFAULT 0;
ALTER TABLE cameras ADD COLUMN has_ir_control INTEGER DEFAULT 0;
ALTER TABLE cameras ADD COLUMN ir_mode TEXT DEFAULT 'auto';
ALTER TABLE cameras ADD COLUMN audio_volume INTEGER DEFAULT 80;
ALTER TABLE cameras ADD COLUMN ptz_pan REAL;
ALTER TABLE cameras ADD COLUMN ptz_tilt REAL;
ALTER TABLE cameras ADD COLUMN ptz_zoom REAL;

-- Migrate existing data
UPDATE cameras SET main_stream_path = stream_path;

-- Detect brand from existing stream paths
UPDATE cameras SET brand = 'hikvision' WHERE stream_path LIKE '%/Streaming/Channels/%';
UPDATE cameras SET brand = 'dahua' WHERE stream_path LIKE '%/cam/realmonitor%';
UPDATE cameras SET brand = 'reolink' WHERE stream_path LIKE '%Preview_%';
-- ...etc

-- Create new camera_streams table
CREATE TABLE camera_streams (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  stream_type TEXT NOT NULL,
  stream_path TEXT NOT NULL,
  resolution TEXT NOT NULL,
  frame_rate INTEGER NOT NULL,
  codec TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Required NPM Packages

**MVP (Phase 1):**
```bash
npm install fluent-ffmpeg sodium-native
```

**Phase 2:**
```bash
npm install evilscan
```

**Phase 3:**
```bash
npm install node-onvif
```

---

## Testing Checklist

**MVP:**
- [ ] Load brand templates
- [ ] Auto-fill port/paths when brand selected
- [ ] Test connection validates stream
- [ ] Create camera with encrypted password
- [ ] Camera appears in list with correct brand

**Phase 2:**
- [ ] Network scan finds cameras on 10.10.10.0/24
- [ ] Detected cameras show correct brand/model
- [ ] Can add cameras from scan results

**Phase 3:**
- [ ] ONVIF discovery finds compatible cameras
- [ ] Stream URLs auto-populated
- [ ] One-click add from discovery

---

## File Structure

```
/server
  /routes
    cameras.ts          # CRUD + test connection
  /utils
    camera-discovery.ts # Scan, ONVIF, validation
    crypto.ts          # Password encryption
  /data
    camera-brands.json # Brand templates

/client
  /components
    CameraForm.svelte  # Add/edit camera
    CameraList.svelte  # List cameras
  /lib
    api.ts            # API client
```

---

## Bottom Line

**MVP = 3 things:**
1. Enhanced database (2 tables)
2. Brand templates (JSON file)
3. Test connection (ffprobe validation)

**Total effort:** 8-12 hours

Everything else (network scan, ONVIF, PTZ, etc.) comes AFTER the MVP works.
