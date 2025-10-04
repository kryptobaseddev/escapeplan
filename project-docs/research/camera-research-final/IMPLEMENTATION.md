# Camera Support - Implementation Guide

## Overview

This guide walks you through implementing multi-brand camera support using the 2-table schema approach.

---

## Phase 1: MVP Implementation (8-12 hours)

### Step 1: Database Migration (1 hour)

**Add columns to existing `cameras` table:**

```sql
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
```

**Create `camera_streams` table:**

```sql
CREATE TABLE camera_streams (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  stream_type TEXT NOT NULL CHECK(stream_type IN ('main', 'sub')),
  stream_path TEXT NOT NULL,
  resolution TEXT NOT NULL,
  frame_rate INTEGER NOT NULL,
  codec TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_camera_streams_camera_id ON camera_streams(camera_id);
CREATE INDEX idx_camera_streams_type ON camera_streams(camera_id, stream_type);
```

**Migrate existing data:**

```sql
-- Copy stream_path to main_stream_path
UPDATE cameras SET main_stream_path = stream_path WHERE stream_path IS NOT NULL;

-- Detect brand from stream path patterns
UPDATE cameras SET brand = 'hikvision' WHERE main_stream_path LIKE '%/Streaming/Channels/%';
UPDATE cameras SET brand = 'dahua' WHERE main_stream_path LIKE '%/cam/realmonitor%';
UPDATE cameras SET brand = 'reolink' WHERE main_stream_path LIKE '%Preview_%';
UPDATE cameras SET brand = 'axis' WHERE main_stream_path LIKE '%/axis-media/%';
UPDATE cameras SET brand = 'foscam' WHERE main_stream_path LIKE '%/video%';
UPDATE cameras SET brand = 'tapo' WHERE main_stream_path LIKE '%/stream%';
```

---

### Step 2: Backend Setup (3 hours)

**Install dependencies:**

```bash
npm install fluent-ffmpeg sodium-native
```

**Copy utilities** (`/server/utils/camera-discovery.ts`):

```typescript
import ffmpeg from 'fluent-ffmpeg';

export async function validateCameraStream(url: string, timeout = 10000) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(url, { timeout: timeout / 1000 }, (err, metadata) => {
      if (err) {
        return resolve({ valid: false, error: err.message });
      }

      const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');

      if (!videoStream) {
        return resolve({ valid: false, error: 'No video stream found' });
      }

      resolve({
        valid: true,
        resolution: `${videoStream.width}x${videoStream.height}`,
        fps: eval(videoStream.r_frame_rate || '0'),
        codec: videoStream.codec_name,
        hasAudio: !!audioStream
      });
    });
  });
}

export function buildRtspUrl(camera: {
  host: string;
  port: number;
  username: string;
  password: string;
  streamPath: string;
}): string {
  const encodedUser = encodeURIComponent(camera.username);
  const encodedPass = encodeURIComponent(camera.password);
  
  return `rtsp://${encodedUser}:${encodedPass}@${camera.host}:${camera.port}${camera.streamPath}`;
}
```

**Create API endpoints** (`/server/routes/cameras.ts`):

```typescript
import { FastifyInstance } from 'fastify';
import { validateCameraStream, buildRtspUrl } from '../utils/camera-discovery';
import { encryptPassword } from '../utils/crypto';
import { db } from '../db';
import { cameras, cameraStreams } from '../db/schema';
import fs from 'fs/promises';

export default async function cameraRoutes(fastify: FastifyInstance) {
  
  // Load camera templates
  fastify.get('/api/camera-templates', async (req, res) => {
    const data = await fs.readFile('./data/camera-templates.json', 'utf-8');
    return JSON.parse(data);
  });
  
  // Test camera connection
  fastify.post('/api/cameras/test', async (req, res) => {
    const { host, port, username, password, streamPath } = req.body as any;
    
    const url = buildRtspUrl({
      host,
      port,
      username,
      password,
      streamPath
    });
    
    const result = await validateCameraStream(url);
    return result;
  });
  
  // Create camera
  fastify.post('/api/cameras', async (req, res) => {
    const { camera: cameraData, streams } = req.body as any;
    
    // Insert camera
    const [camera] = await db.insert(cameras).values({
      id: crypto.randomUUID(),
      ...cameraData,
      password_encrypted: encryptPassword(cameraData.password)
    }).returning();
    
    // Insert streams
    if (streams && streams.length > 0) {
      await db.insert(cameraStreams).values(
        streams.map((s: any) => ({
          id: crypto.randomUUID(),
          camera_id: camera.id,
          ...s
        }))
      );
    }
    
    return camera;
  });
  
  // Get camera streams
  fastify.get('/api/cameras/:id/streams', async (req, res) => {
    const { id } = req.params as any;
    
    const streams = await db.query.cameraStreams.findMany({
      where: eq(cameraStreams.camera_id, id)
    });
    
    return streams;
  });
}
```

**Encryption utility** (`/server/utils/crypto.ts`):

```typescript
import sodium from 'sodium-native';

const ENCRYPTION_KEY = Buffer.from(process.env.CAMERA_ENCRYPTION_KEY || '', 'hex');

export function encryptPassword(plainPassword: string): string {
  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
  sodium.randombytes_buf(nonce);
  
  const ciphertext = Buffer.alloc(
    plainPassword.length + sodium.crypto_secretbox_MACBYTES
  );
  
  sodium.crypto_secretbox_easy(
    ciphertext,
    Buffer.from(plainPassword),
    nonce,
    ENCRYPTION_KEY
  );
  
  return Buffer.concat([nonce, ciphertext]).toString('hex');
}

export function decryptPassword(encrypted: string): string {
  const combined = Buffer.from(encrypted, 'hex');
  const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
  
  const plaintext = Buffer.alloc(
    ciphertext.length - sodium.crypto_secretbox_MACBYTES
  );
  
  sodium.crypto_secretbox_open_easy(
    plaintext,
    ciphertext,
    nonce,
    ENCRYPTION_KEY
  );
  
  return plaintext.toString();
}
```

**Generate encryption key** (run once, save to `.env`):

```typescript
import crypto from 'crypto';

const key = crypto.randomBytes(32).toString('hex');
console.log('CAMERA_ENCRYPTION_KEY=' + key);
```

---

### Step 3: Frontend UI (4 hours)

**Copy camera templates to public data:**

```bash
cp camera-templates.json /server/data/camera-templates.json
```

**Use the Svelte component** (`camera-settings-ui.svelte`):

The component is already created and handles:
- Brand/model selection
- Auto-configuration from templates
- Connection testing
- Stream configuration
- PTZ/Audio/IR settings

**Integrate into your app:**

```svelte
<script lang="ts">
  import CameraSettings from './components/camera-settings-ui.svelte';
  
  let showCameraForm = false;
  let cameras = [];
  
  async function loadCameras() {
    const res = await fetch('/api/cameras');
    cameras = await res.json();
  }
  
  function handleCameraSave() {
    showCameraForm = false;
    loadCameras();
  }
  
  onMount(loadCameras);
</script>

<div class="camera-management">
  <div class="header">
    <h1>Cameras</h1>
    <button class="btn btn-primary" on:click={() => showCameraForm = true}>
      Add Camera
    </button>
  </div>
  
  {#if showCameraForm}
    <CameraSettings 
      onSave={handleCameraSave}
      onCancel={() => showCameraForm = false}
    />
  {/if}
  
  <div class="camera-grid">
    {#each cameras as camera}
      <div class="camera-card">
        <h3>{camera.name}</h3>
        <p>{camera.brand} - {camera.host}</p>
        <span class="badge {camera.status === 'online' ? 'badge-success' : 'badge-error'}">
          {camera.status}
        </span>
      </div>
    {/each}
  </div>
</div>
```

---

### Step 4: Testing (2 hours)

**Test with each brand:**

1. **Reolink RLC-810A:**
   - Select brand: Reolink
   - Select model: RLC-810A
   - Enter IP: `10.10.10.100`
   - Enter credentials
   - Test connection ✓
   - Verify: Port 554, H.265 codec, 4K resolution

2. **Hikvision DS-2CD2x43G0:**
   - Select brand: Hikvision
   - Select model: DS-2CD2x43G0-I
   - Enter IP: `10.10.10.101`
   - Test connection ✓
   - Verify: `/Streaming/Channels/101` path

3. **Tapo C310:**
   - Select brand: Tapo
   - Select model: C310
   - Create Camera Account in Tapo app first!
   - Enter IP: `10.10.10.102`
   - Test connection ✓
   - Verify: Port 554, ONVIF port 2020

**Check database:**

```sql
SELECT 
  c.name, 
  c.brand, 
  c.host, 
  c.main_stream_path,
  s.stream_type,
  s.resolution,
  s.frame_rate
FROM cameras c
LEFT JOIN camera_streams s ON c.id = s.camera_id
ORDER BY c.name, s.stream_type;
```

---

## Phase 2: Network Scan (8 hours)

### Install Dependencies

```bash
npm install evilscan
```

### Backend Implementation

**Network scanner** (`/server/utils/network-scanner.ts`):

```typescript
import Evilscan from 'evilscan';

export async function scanNetworkForCameras(subnet = '10.10.10.0/24') {
  const candidates: Array<{ ip: string; port: number }> = [];
  
  return new Promise((resolve) => {
    const scanner = new Evilscan({
      target: subnet,
      port: '554,80,8080,88',
      status: 'O',
      banner: false
    });
    
    scanner.on('result', (data: any) => {
      if (data.status === 'open') {
        candidates.push({
          ip: data.ip,
          port: parseInt(data.port)
        });
      }
    });
    
    scanner.on('done', () => resolve(candidates));
    
    scanner.run();
  });
}
```

**API endpoint:**

```typescript
fastify.get('/api/cameras/scan', async (req, res) => {
  const { subnet } = req.query as any;
  const candidates = await scanNetworkForCameras(subnet);
  
  // Test each candidate
  const detected = [];
  for (const candidate of candidates) {
    const result = await probeCameraPatterns(candidate.ip, candidate.port);
    if (result) {
      detected.push({
        ...candidate,
        ...result
      });
    }
  }
  
  return detected;
});
```

### Frontend UI

Add scan button:

```svelte
<button class="btn btn-secondary" on:click={scanNetwork}>
  Scan Network
</button>

{#if scanResults.length > 0}
  <div class="scan-results">
    <h3>Discovered Cameras</h3>
    {#each scanResults as result}
      <div class="result-card">
        <p>{result.ip}:{result.port}</p>
        <p>Detected: {result.brand}</p>
        <button on:click={() => addFromScan(result)}>Add</button>
      </div>
    {/each}
  </div>
{/if}
```

---

## Phase 3: ONVIF Discovery (12 hours)

### Install Dependencies

```bash
npm install node-onvif
```

### Backend Implementation

**ONVIF discovery** (`/server/utils/onvif-discovery.ts`):

```typescript
import onvif from 'node-onvif';

export async function discoverOnvifCameras() {
  const devices = await onvif.startProbe();
  const cameras = [];
  
  for (const device of devices) {
    try {
      const cam = new onvif.OnvifDevice({
        xaddr: device.xaddr
      });
      
      await cam.init();
      
      const profiles = await cam.services.media.getProfiles();
      const streamUri = await cam.services.media.getStreamUri({
        protocol: 'RTSP',
        profileToken: profiles[0]?.$.token
      });
      
      cameras.push({
        name: device.name || 'ONVIF Camera',
        manufacturer: device.hardware || 'Unknown',
        ip: device.urn?.split(':')[4] || '',
        streamUrl: streamUri.uri,
        profiles: profiles
      });
    } catch (err) {
      console.error('ONVIF probe failed:', err);
    }
  }
  
  return cameras;
}
```

**API endpoint:**

```typescript
fastify.get('/api/cameras/discover-onvif', async (req, res) => {
  const cameras = await discoverOnvifCameras();
  return cameras;
});
```

### Frontend UI

Add discovery button:

```svelte
<button class="btn btn-accent" on:click={discoverOnvif}>
  Discover ONVIF Cameras
</button>

{#if onvifCameras.length > 0}
  <div class="onvif-results">
    <h3>ONVIF Cameras</h3>
    {#each onvifCameras as camera}
      <div class="camera-discovery-card">
        <h4>{camera.name}</h4>
        <p>{camera.manufacturer}</p>
        <p>{camera.ip}</p>
        <button on:click={() => addOnvifCamera(camera)}>
          Add Camera
        </button>
      </div>
    {/each}
  </div>
{/if}
```

---

## Testing Checklist

### Phase 1 MVP
- [ ] Database migrated successfully
- [ ] Camera templates load in UI
- [ ] Brand selection auto-fills port and paths
- [ ] Test connection validates stream
- [ ] Password is encrypted in database
- [ ] Camera saves with correct brand/model
- [ ] Streams table populated
- [ ] Camera appears in list

### Phase 2 Network Scan
- [ ] Scan detects cameras on network
- [ ] Brand auto-detected from stream path
- [ ] Scan results display correctly
- [ ] Add camera from scan results works

### Phase 3 ONVIF Discovery
- [ ] ONVIF discovery finds cameras
- [ ] Stream URLs retrieved correctly
- [ ] Camera details pre-filled
- [ ] One-click add works

---

## Deployment

### Environment Variables

```bash
# .env
CAMERA_ENCRYPTION_KEY=<32-byte-hex-key>
```

### Production Checklist

- [ ] Generate unique encryption key
- [ ] Configure camera VLAN (10.10.10.0/24)
- [ ] Firewall rules in place
- [ ] RTSP authentication enabled on cameras
- [ ] Default passwords changed
- [ ] Rate limiting implemented
- [ ] Logging configured
- [ ] Backup encryption key securely

---

## Troubleshooting

### "No video stream found"
1. Test stream URL in VLC first
2. Check if RTSP is enabled in camera settings
3. Verify stream path is correct for brand/model
4. Try both TCP and UDP transport

### "Authentication failed"
1. Verify credentials in camera web interface
2. For Tapo: Create Camera Account in app
3. For Foscam: Use desktop app to create user
4. Check for special characters in password

### "Connection timeout"
1. Increase timeout to 20-30 seconds
2. Check network connectivity (ping camera)
3. Verify camera is not overloaded
4. Try sub-stream instead of main stream

---

## Next Steps

After MVP is working:

1. **Add PTZ Presets** - Save favorite camera positions
2. **Motion Detection** - Integrate ONVIF events
3. **Recording** - Save clips to NAS
4. **Mobile App** - Live view on phone
5. **Analytics** - Person/vehicle detection

---

## Support

- **Documentation:** See `CAMERA_SUPPORT_DEVELOPER_DOCS.md`
- **Templates:** See `camera-templates.json`
- **Help Text:** See `camera-help.json`
- **Issues:** Check troubleshooting section first

---

**Success Criteria:**

✅ Can add cameras from 8+ brands  
✅ Auto-configuration from templates works  
✅ Test connection validates stream  
✅ Passwords encrypted in database  
✅ Dual streams configured correctly  
✅ PTZ/Audio/IR controls function  

**Estimated Time:** 8-12 hours for MVP
