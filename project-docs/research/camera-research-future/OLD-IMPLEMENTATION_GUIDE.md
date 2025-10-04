# EscapePlan Camera Support - Implementation Guide

## 📋 Overview

This guide provides a complete roadmap for implementing comprehensive multi-brand camera support in the EscapePlan escape room management system.

### What's Included

1. **Developer Documentation** (`CAMERA_SUPPORT_DEVELOPER_DOCS.md`) - 100+ page technical reference
2. **Database Schema** (`camera-schema.ts`) - Enhanced Drizzle ORM schema with 8 new tables
3. **Camera Templates** (`camera-templates.json`) - 15+ pre-configured brand/model settings
4. **Help System** (`camera-help.json`) - User-facing tooltips, guides, and troubleshooting
5. **UI Mockup** (`camera-settings-ui-mockup.svelte`) - Complete DaisyUI component

---

## 🎯 What Changed from Your Current Schema

### Current Schema Limitations
- ❌ Single `stream_path` - no dual-stream support
- ❌ No brand/model identification
- ❌ No PTZ capabilities
- ❌ No audio controls
- ❌ No IR/night vision settings
- ❌ Basic status tracking only
- ❌ Manual configuration required

### Enhanced Schema Features
- ✅ **Dual-stream support** - Main (recording) + Sub (live view)
- ✅ **Brand/model templates** - Auto-configuration for 8 major brands
- ✅ **PTZ control** - Presets, patrols, ONVIF integration
- ✅ **Audio management** - Input/output, volume control, codec support
- ✅ **IR control** - Auto/On/Off night vision modes
- ✅ **Advanced health** - FPS, bitrate, packet loss tracking
- ✅ **Event system** - Motion, tampering, connection events
- ✅ **Recording management** - Session-based recording with metadata
- ✅ **Comprehensive logging** - Debug, connection, health logs

---

## 📊 New Database Tables

### Core Tables (Updated)
```typescript
cameras                 // Enhanced with 20+ new fields
├── Brand/Model identification
├── Dual-stream paths
├── PTZ current position
├── Audio/IR settings
├── ONVIF tokens
└── Health metrics
```

### Supporting Tables (New)
```typescript
camera_streams          // Dual-stream configurations
camera_ptz_presets      // Saved PTZ positions
camera_ptz_patrols      // Auto-patrol sequences
camera_events           // Motion, tampering, alerts
camera_recordings       // Recording sessions
camera_templates        // Brand/model presets (optional)
camera_logs            // Diagnostic logging
```

---

## 🏗️ Implementation Phases

### Phase 1: Database Migration (2-4 hours)

#### Step 1: Backup Current Database
```bash
cp /path/to/database.db /path/to/database.backup.db
```

#### Step 2: Add New Columns to `cameras` Table
```sql
-- Brand & Model
ALTER TABLE cameras ADD COLUMN brand TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE cameras ADD COLUMN model TEXT;

-- Dual Streams
ALTER TABLE cameras ADD COLUMN main_stream_path TEXT;
ALTER TABLE cameras ADD COLUMN sub_stream_path TEXT;
UPDATE cameras SET main_stream_path = stream_path; -- Migrate existing

-- ONVIF
ALTER TABLE cameras ADD COLUMN onvif_port INTEGER DEFAULT 80;
ALTER TABLE cameras ADD COLUMN onvif_profile_token TEXT;
ALTER TABLE cameras ADD COLUMN video_source_token TEXT;

-- Capabilities (see full schema for all fields)
ALTER TABLE cameras ADD COLUMN has_ptz INTEGER DEFAULT 0;
ALTER TABLE cameras ADD COLUMN has_audio INTEGER DEFAULT 0;
-- ... etc
```

#### Step 3: Create New Tables
```bash
# Use Drizzle migration
npx drizzle-kit generate:sqlite
npx drizzle-kit push:sqlite
```

#### Step 4: Migrate Existing Data
```typescript
// migration.ts
import { db } from './db';
import { cameras } from './schema';

// Parse stream_path to determine brand
const cameraUpdates = await db.select().from(cameras).all();

for (const camera of cameraUpdates) {
  const brand = detectBrandFromStreamPath(camera.stream_path);
  
  await db.update(cameras)
    .set({
      brand,
      main_stream_path: camera.stream_path,
      sub_stream_path: getSubStreamPath(brand, camera.stream_path)
    })
    .where(eq(cameras.id, camera.id));
}
```

### Phase 2: Backend API Enhancement (8-12 hours)

#### Update Camera CRUD Endpoints

**Create Camera** (`POST /api/cameras`)
```typescript
// routes/cameras.ts
import { cameraTemplates } from '../data/camera-templates.json';
import { encryptPassword } from '../utils/crypto';

app.post('/api/cameras', async (req, reply) => {
  const { brand, model, password, ...cameraData } = req.body;
  
  // Load template if available
  const template = cameraTemplates.templates.find(
    t => t.brand === brand && (!model || t.model === model)
  );
  
  // Apply template defaults
  const camera = {
    ...cameraData,
    brand,
    model,
    password_encrypted: await encryptPassword(password),
    main_stream_path: template?.main_stream_path || cameraData.main_stream_path,
    sub_stream_path: template?.sub_stream_path || cameraData.sub_stream_path,
    port: template?.default_port || cameraData.port || 554,
    has_ptz: template?.capabilities.ptz || false,
    has_audio: template?.capabilities.audio || false,
    // ... apply all template defaults
  };
  
  const result = await db.insert(cameras).values(camera).returning();
  
  return result[0];
});
```

**Test Connection** (`POST /api/cameras/test`)
```typescript
import ffmpeg from 'fluent-ffmpeg';
import { buildRtspUrl } from '../utils/camera';

app.post('/api/cameras/test', async (req, reply) => {
  const camera = req.body;
  
  // Step 1: Ping test
  const pingResult = await ping(camera.host);
  if (!pingResult.alive) {
    return reply.status(400).send({
      success: false,
      error: 'Camera not reachable on network'
    });
  }
  
  // Step 2: Build RTSP URL
  const streamUrl = buildRtspUrl(camera, 'main');
  
  // Step 3: FFprobe validation
  return new Promise((resolve) => {
    ffmpeg.ffprobe(streamUrl, { timeout: 10000 }, (err, metadata) => {
      if (err) {
        return resolve({
          success: false,
          error: err.message
        });
      }
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      resolve({
        success: true,
        resolution: `${videoStream.width}x${videoStream.height}`,
        codec: videoStream.codec_name,
        fps: eval(videoStream.r_frame_rate),
        has_audio: !!audioStream
      });
    });
  });
});
```

#### Implement PTZ Control
```typescript
import { OnvifDevice } from 'node-onvif';

app.post('/api/cameras/:id/ptz/move', async (req, reply) => {
  const { direction, speed } = req.body;
  const camera = await db.query.cameras.findFirst({
    where: eq(cameras.id, req.params.id)
  });
  
  const device = await getOnvifDevice(camera);
  
  const velocity = {
    left: { x: -speed, y: 0, z: 0 },
    right: { x: speed, y: 0, z: 0 },
    up: { x: 0, y: speed, z: 0 },
    down: { x: 0, y: -speed, z: 0 },
    zoomIn: { x: 0, y: 0, z: speed },
    zoomOut: { x: 0, y: 0, z: -speed }
  };
  
  await device.services.ptz.continuousMove({
    profileToken: camera.onvif_profile_token,
    velocity: velocity[direction]
  });
  
  return { success: true };
});

app.post('/api/cameras/:id/ptz/stop', async (req, reply) => {
  const camera = await getCameraById(req.params.id);
  const device = await getOnvifDevice(camera);
  
  await device.services.ptz.stop({
    profileToken: camera.onvif_profile_token,
    panTilt: true,
    zoom: true
  });
  
  return { success: true };
});
```

#### Implement IR Control
```typescript
app.post('/api/cameras/:id/ir-mode', async (req, reply) => {
  const { mode } = req.body; // 'auto' | 'on' | 'off'
  const camera = await getCameraById(req.params.id);
  const device = await getOnvifDevice(camera);
  
  const modeMap = {
    auto: 'AUTO',
    on: 'ON',
    off: 'OFF'
  };
  
  await device.services.imaging.setImagingSettings({
    videoSourceToken: camera.video_source_token,
    imagingSettings: {
      IrCutFilter: modeMap[mode]
    }
  });
  
  await db.update(cameras)
    .set({ ir_mode: mode })
    .where(eq(cameras.id, camera.id));
  
  return { success: true, mode };
});
```

### Phase 3: Frontend UI Development (12-16 hours)

#### Update Camera Settings Form

1. **Copy the UI mockup** (`camera-settings-ui-mockup.svelte`) to your components
2. **Load templates on mount**:
```typescript
onMount(async () => {
  const res = await fetch('/data/camera-templates.json');
  templates = await res.json();
});
```

3. **Implement brand/model selection logic**
4. **Add real-time validation**
5. **Integrate test connection**
6. **Add PTZ control panel** (separate component)
7. **Add audio/IR controls**

#### Create PTZ Control Component
```svelte
<!-- PTZControls.svelte -->
<script>
  export let cameraId;
  
  async function move(direction) {
    await fetch(`/api/cameras/${cameraId}/ptz/move`, {
      method: 'POST',
      body: JSON.stringify({ direction, speed: 0.5 })
    });
  }
  
  async function stop() {
    await fetch(`/api/cameras/${cameraId}/ptz/stop`, { method: 'POST' });
  }
</script>

<div class="grid grid-cols-3 gap-2">
  <div></div>
  <button class="btn btn-sm" on:click={() => move('up')}>↑</button>
  <div></div>
  <button class="btn btn-sm" on:click={() => move('left')}>←</button>
  <button class="btn btn-sm" on:click={stop}>⏹</button>
  <button class="btn btn-sm" on:click={() => move('right')}>→</button>
  <div></div>
  <button class="btn btn-sm" on:click={() => move('down')}>↓</button>
  <div></div>
</div>
```

### Phase 4: Testing & Validation (4-6 hours)

#### Test Matrix
```
Camera Brand | Model       | RTSP | ONVIF | PTZ | Audio | IR
-------------|-------------|------|-------|-----|-------|----
Reolink      | RLC-810A    | ✅   | ✅    | ❌  | ✅    | ✅
Hikvision    | DS-2CD2x43  | ✅   | ✅    | ❌  | ✅    | ✅
Hikvision    | DS-2DE3304  | ✅   | ✅    | ✅  | ✅    | ✅
Dahua        | IPC-HFW5831 | ✅   | ✅    | ❌  | ✅    | ✅
Amcrest      | IP4M-1041   | ✅   | ✅    | ❌  | ✅    | ✅
Axis         | M3046-V     | ✅   | ✅    | ❌  | ❌    | ❌
Tapo         | C310        | ✅   | ✅    | ❌  | ✅    | ✅
Foscam       | FI9900P     | ✅   | ✅    | ❌  | ✅    | ✅
Generic      | ONVIF       | ✅   | ✅    | ?   | ?     | ?
```

#### Automated Tests
```typescript
describe('Camera Management', () => {
  test('creates Reolink camera from template', async () => {
    const camera = await createCamera({
      brand: 'reolink',
      model: 'RLC-810A',
      name: 'Test Camera',
      host: '10.10.10.100',
      username: 'admin',
      password: 'test123'
    });
    
    expect(camera.port).toBe(554);
    expect(camera.main_stream_path).toBe('/Preview_01_main');
    expect(camera.has_ptz).toBe(false);
    expect(camera.has_audio).toBe(true);
  });
  
  test('tests camera connection', async () => {
    const result = await testConnection(camera.id);
    expect(result.success).toBe(true);
    expect(result.resolution).toMatch(/\d+x\d+/);
  });
  
  test('controls PTZ camera', async () => {
    const ptzCamera = await createPTZCamera();
    await moveCamera(ptzCamera.id, 'left', 0.5);
    await stopCamera(ptzCamera.id);
    expect(true).toBe(true); // No errors thrown
  });
});
```

---

## 🔧 Utility Functions to Implement

### Camera URL Builder
```typescript
// utils/camera.ts
export function buildRtspUrl(
  camera: Camera, 
  stream: 'main' | 'sub' = 'main'
): string {
  const path = stream === 'main' 
    ? camera.main_stream_path 
    : camera.sub_stream_path;
    
  return `rtsp://${encodeURIComponent(camera.username)}:${encodeURIComponent(decryptPassword(camera.password_encrypted))}@${camera.host}:${camera.port}${path}`;
}
```

### Brand Detection
```typescript
export function detectBrandFromStreamPath(path: string): string {
  if (path.includes('/Preview_')) return 'reolink';
  if (path.includes('/Streaming/Channels/')) return 'hikvision';
  if (path.includes('/cam/realmonitor')) return 'dahua';
  if (path.includes('/axis-media/')) return 'axis';
  if (path.includes('/stream')) return 'tapo';
  if (path.includes('/video')) return 'foscam';
  return 'generic';
}
```

### ONVIF Device Pool
```typescript
const devicePool = new Map<string, OnvifDevice>();

export async function getOnvifDevice(camera: Camera): Promise<OnvifDevice> {
  const key = `${camera.host}:${camera.username}`;
  
  if (devicePool.has(key)) {
    return devicePool.get(key)!;
  }
  
  const device = new OnvifDevice({
    xaddr: `http://${camera.host}:${camera.onvif_port}/onvif/device_service`,
    user: camera.username,
    pass: decryptPassword(camera.password_encrypted)
  });
  
  await device.init();
  devicePool.set(key, device);
  
  return device;
}
```

---

## 📦 Required NPM Packages

```json
{
  "dependencies": {
    "node-onvif": "^0.2.8",
    "fluent-ffmpeg": "^2.1.2",
    "sodium-native": "^4.0.4",
    "ping": "^0.4.4"
  },
  "devDependencies": {
    "@types/fluent-ffmpeg": "^2.1.24"
  }
}
```

---

## 🎨 UI/UX Enhancements Needed

### Current UI Issues (from screenshot)
1. ❌ No brand selection - user must know stream path
2. ❌ Port hardcoded to 554 - doesn't work for Foscam (88)
3. ❌ Single stream path - can't configure dual streams
4. ❌ No capability detection - PTZ/audio not accessible
5. ❌ Generic resolution dropdown - not camera-specific

### Enhanced UI Features
1. ✅ Brand/model dropdown with auto-configuration
2. ✅ Dynamic port based on brand
3. ✅ Dual-stream configuration (main/sub)
4. ✅ Capability badges (PTZ, Audio, IR)
5. ✅ PTZ control panel for supported cameras
6. ✅ Audio volume slider
7. ✅ IR mode toggle (Auto/Night/Day)
8. ✅ Real-time test connection with diagnostics
9. ✅ Contextual help tooltips
10. ✅ Error troubleshooting guides

---

## 🚀 Quick Start Guide

### For Developers

1. **Read the developer docs** (`CAMERA_SUPPORT_DEVELOPER_DOCS.md`)
2. **Review the schema** (`camera-schema.ts`)
3. **Study brand templates** (`camera-templates.json`)
4. **Implement in this order**:
   - Database migration
   - Backend API updates
   - Frontend UI
   - Testing

### For Adding New Camera Brands

1. **Add to `camera-templates.json`**:
```json
{
  "id": "new-brand-model",
  "brand": "newbrand",
  "model": "XYZ-123",
  "display_name": "NewBrand XYZ-123",
  "default_port": 554,
  "protocol": "rtsp",
  "main_stream_path": "/custom/path",
  "capabilities": {
    "ptz": false,
    "audio": true,
    ...
  }
}
```

2. **Test connection**
3. **Document quirks** in developer docs
4. **Update brand defaults** in JSON

---

## 📖 Documentation Locations

| Document | Purpose | Audience |
|----------|---------|----------|
| `CAMERA_SUPPORT_DEVELOPER_DOCS.md` | Technical reference, API specs, brand details | Developers |
| `camera-schema.ts` | Database schema with relations | Backend developers |
| `camera-templates.json` | Brand/model presets | All developers |
| `camera-help.json` | User-facing help, tooltips | Frontend developers |
| `camera-settings-ui-mockup.svelte` | UI component reference | Frontend developers |
| This file | Implementation roadmap | Project managers, developers |

---

## 🐛 Known Issues & Workarounds

### Tapo Cameras
- **Issue**: ONVIF port is 2020, not 80
- **Workaround**: Auto-set `onvif_port: 2020` when brand is 'tapo'
- **Issue**: No 2-way audio via ONVIF
- **Note**: Document limitation in UI

### Foscam Cameras
- **Issue**: Default port is 88, not 554
- **Workaround**: Template sets `default_port: 88`
- **Issue**: User creation via web interface doesn't validate password
- **Workaround**: Show warning to use desktop app

### Reolink Cameras
- **Issue**: ONVIF port is 8000
- **Workaround**: Template sets `default_onvif_port: 8000`
- **Issue**: H.265 on main stream may not decode on all clients
- **Workaround**: Provide H.264 sub-stream option

### Raspberry Pi Performance
- **Issue**: Limited CPU for transcoding
- **Workaround**: Use sub-streams for live view, limit 3-4 concurrent
- **Issue**: Gigabit Ethernet bottleneck with 4K
- **Workaround**: Recommend 1080p/2K for most cameras

---

## ✅ Success Criteria

### Phase 1 Complete When:
- [ ] All 8 new tables created
- [ ] Existing cameras migrated
- [ ] No data loss

### Phase 2 Complete When:
- [ ] Camera CRUD works with new schema
- [ ] Test connection validates streams
- [ ] PTZ control works for supported cameras
- [ ] IR/audio control functional

### Phase 3 Complete When:
- [ ] Brand/model selection auto-configures
- [ ] All UI components render correctly
- [ ] Help tooltips show properly
- [ ] Real-time validation works

### Phase 4 Complete When:
- [ ] All brands in test matrix pass
- [ ] 90%+ test coverage
- [ ] Documentation complete
- [ ] No critical bugs

---

## 🎯 Final Deliverables

1. ✅ Comprehensive developer documentation
2. ✅ Enhanced database schema with 8 tables
3. ✅ 15+ camera brand/model templates
4. ✅ Complete help system
5. ✅ Production-ready UI mockup
6. ✅ Implementation guide (this file)

---

## 📞 Support

For implementation questions:
1. Review developer docs for technical details
2. Check help.json for user-facing guidance
3. Reference schema.ts for database structure
4. Study templates.json for brand specifics

---

**Next Steps**: Start with Phase 1 (Database Migration) and work through phases sequentially. Each phase builds on the previous one.

Good luck with implementation! 🚀
