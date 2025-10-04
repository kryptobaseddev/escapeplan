# EscapePlan Camera Support - Developer Documentation

**Version:** 2.0.0  
**Last Updated:** October 3, 2025  
**Target Platform:** Raspberry Pi 4+ running Svelte 5 + Fastify  
**Schema:** 2-table design (cameras + camera_streams)

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Supported Camera Brands](#supported-camera-brands)
4. [Camera Connection Workflow](#camera-connection-workflow)
5. [Brand-Specific Implementation](#brand-specific-implementation)
6. [PTZ Control](#ptz-control)
7. [Audio Support](#audio-support)
8. [Night Vision / IR Control](#night-vision--ir-control)
9. [Stream Management](#stream-management)
10. [Security Considerations](#security-considerations)
11. [Testing Strategy](#testing-strategy)
12. [Troubleshooting](#troubleshooting)

---

## Overview

EscapePlan supports network cameras from major manufacturers with a streamlined 2-table database design focused on essential functionality.

### Core Features

- Multi-brand camera support with automatic configuration from templates
- RTSP/ONVIF/MJPEG protocol support
- Dual-stream capability (main + sub-stream)
- PTZ control for supported cameras
- IR/Night vision mode control
- Audio input management
- Connection testing and validation
- Encrypted credential storage

### Architecture

```
┌─────────────────────────────────────────────┐
│         Svelte 5 Frontend (DaisyUI)         │
│  - Camera Management UI                     │
│  - Live Stream Viewer                       │
│  - PTZ Controls                             │
└──────────────────┬──────────────────────────┘
                   │
                   │ HTTP/WebSocket
                   │
┌──────────────────▼──────────────────────────┐
│         Fastify Backend (Node.js)           │
│  - Camera CRUD API                          │
│  - Stream Proxy/Transcoding (FFmpeg)        │
│  - ONVIF Client (node-onvif)                │
│  - Credential Encryption (libsodium)        │
└──────────────────┬──────────────────────────┘
                   │
                   │ RTSP/ONVIF/HTTP
                   │
┌──────────────────▼──────────────────────────┐
│         Network Cameras (10.10.10.0/24)     │
│  - Reolink, Hikvision, Dahua, etc.          │
└─────────────────────────────────────────────┘
```

---

## Database Schema

### 2-Table Design

The system uses a streamlined 2-table approach:

#### `cameras` Table
Core camera configuration and settings:
- **Identity:** id, name, brand, model
- **Network:** host, port, username, password_encrypted
- **Protocol:** protocol, main_stream_path, sub_stream_path
- **Capabilities:** has_ptz, has_audio, has_ir_control (boolean flags)
- **Settings:** ir_mode, audio_volume, ptz_pan, ptz_tilt, ptz_zoom
- **Status:** status, last_seen, error_message
- **Association:** game_id (optional link to escape room game)

#### `camera_streams` Table
Stream-specific configurations:
- **Identity:** id, camera_id (FK), stream_type ('main' | 'sub')
- **Settings:** stream_path, resolution, frame_rate, codec

### Migration from Complex Schemas

If migrating from a multi-table design:

```sql
-- Add new columns to cameras table
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

-- Create camera_streams table
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

## Supported Camera Brands

### Primary Support (Fully Tested)

| Brand | RTSP | ONVIF | MJPEG | PTZ | Audio | IR Control | Default Port |
|-------|------|-------|-------|-----|-------|------------|--------------|
| **Reolink** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | 554 |
| **Hikvision** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 554 |
| **Dahua** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 554 |
| **Amcrest** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 554 |
| **Axis** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 554 |
| **TP-Link** | ✅ | ✅ | ❌ | ⚠️ | ✅ | ✅ | 554 |
| **Tapo** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | 554 |
| **Foscam** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 88 |

---

## Camera Connection Workflow

### 1. Brand/Model Selection

Cameras are configured using templates from `camera-templates.json`:

```typescript
interface CameraTemplate {
  id: string;
  brand: string;
  model: string;
  display_name: string;
  default_port: number;
  protocol: 'rtsp' | 'onvif' | 'mjpeg';
  main_stream_path: string;
  sub_stream_path?: string;
  has_ptz: boolean;
  has_audio: boolean;
  has_ir: boolean;
  video_specs: {
    max_resolution: string;
    main_codec: string;
    sub_codec: string;
    max_fps: number;
  };
  recommended_settings: {
    transport: 'tcp' | 'udp';
    timeout: number;
    main_resolution: string;
    main_fps: number;
    sub_resolution: string;
    sub_fps: number;
  };
}
```

### 2. Connection Testing

```javascript
async function testCameraConnection(config) {
  // Build stream URL
  const streamUrl = buildStreamUrl(config, 'main');
  
  // Validate with FFprobe
  const probeResult = await ffprobe(streamUrl, {
    timeout: 10000,
    retry: 2
  });
  
  const videoStream = probeResult.streams.find(s => s.codec_type === 'video');
  
  return {
    success: true,
    resolution: `${videoStream.width}x${videoStream.height}`,
    codec: videoStream.codec_name,
    fps: eval(videoStream.r_frame_rate),
    has_audio: probeResult.streams.some(s => s.codec_type === 'audio')
  };
}
```

### 3. Saving Camera

```javascript
async function createCamera(data) {
  // Insert camera record
  const camera = await db.insert(cameras).values({
    id: generateId(),
    name: data.name,
    brand: data.brand,
    model: data.model,
    host: data.host,
    port: data.port,
    username: data.username,
    password_encrypted: encryptPassword(data.password),
    protocol: data.protocol,
    main_stream_path: data.main_stream_path,
    sub_stream_path: data.sub_stream_path,
    has_ptz: data.has_ptz,
    has_audio: data.has_audio,
    has_ir_control: data.has_ir_control
  });
  
  // Insert stream configurations
  await db.insert(cameraStreams).values([
    {
      id: generateId(),
      camera_id: camera.id,
      stream_type: 'main',
      stream_path: data.main_stream_path,
      resolution: data.main_resolution,
      frame_rate: data.main_fps,
      codec: data.main_codec
    },
    {
      id: generateId(),
      camera_id: camera.id,
      stream_type: 'sub',
      stream_path: data.sub_stream_path,
      resolution: data.sub_resolution,
      frame_rate: data.sub_fps,
      codec: data.sub_codec
    }
  ]);
  
  return camera;
}
```

---

## Brand-Specific Implementation

### Reolink

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:554/Preview_01_main  # Main stream
rtsp://[user]:[pass]@[ip]:554/Preview_01_sub   # Sub stream
```

**Key Characteristics:**
- 8MP cameras use H.265 for main stream, H.264 for sub stream
- ONVIF port: 8000 (not 80)
- Supports AAC audio

**Recommended Settings:**
- Main Stream: 1920x1080@15fps, H.264/H.265
- Sub Stream: 640x360@10fps, H.264
- Transport: TCP
- Timeout: 20s

---

### Hikvision

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:554/Streaming/Channels/101  # Ch1 Main
rtsp://[user]:[pass]@[ip]:554/Streaming/Channels/102  # Ch1 Sub
rtsp://[user]:[pass]@[ip]:554/Streaming/Channels/103  # Ch1 Third
```

**Channel Numbering:**
- First digit: channel number (1-based)
- Second digit: stream type (01=main, 02=sub, 03=third)

**MJPEG Snapshot:**
```
http://[user]:[pass]@[ip]:80/ISAPI/Streaming/channels/101/picture
```

**Key Settings:**
- Disable encryption for RTSP: Setup > Network > Advanced > Integration Protocol
- Enable RTSP auth: Setup > Network > Advanced Settings > RTSP Authentication

---

### Dahua / Amcrest

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:554/cam/realmonitor?channel=1&subtype=0  # Main
rtsp://[user]:[pass]@[ip]:554/cam/realmonitor?channel=1&subtype=1  # Sub
```

**Parameters:**
- `channel`: 1-based camera channel
- `subtype`: 0 = main, 1 = sub, 2 = third stream

**MJPEG Snapshot:**
```
http://[user]:[pass]@[ip]:80/cgi-bin/snapshot.cgi?channel=1
```

**Important:** Amcrest cameras are Dahua OEM, use identical URL format.

---

### Axis

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:554/axis-media/media.amp
rtsp://[user]:[pass]@[ip]:554/axis-media/media.amp?resolution=640x480&fps=15
```

**VAPIX Parameters:**
- `resolution`: 1920x1080, 1280x720, 640x480, etc.
- `fps`: 1-30
- `streamprofile`: named profiles created in camera UI

**PTZ Control (VAPIX):**
```
http://[ip]/axis-cgi/com/ptz.cgi?camera=1&pan=[value]&tilt=[value]&zoom=[value]
```

---

### TP-Link Tapo

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:554/stream1  # Main / High quality
rtsp://[user]:[pass]@[ip]:554/stream2  # Sub / Low quality
```

**Important Setup:**
1. Configure camera in Tapo app
2. Go to Advanced Settings > Camera Account
3. Create username/password (6-32 characters)
4. ONVIF Port is 2020 (not 80!)

**Notes:**
- Set video quality to "Best" in app for full resolution on stream1
- ONVIF Profile S only (no 2-way audio via ONVIF)

---

### Foscam

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:88/videoMain   # Main stream
rtsp://[user]:[pass]@[ip]:88/videoSub    # Sub stream
```

**Important:** Default port is 88 (not 554)!

**User Creation:** Create users via Foscam Windows client app for proper authentication. Web interface has weak password validation.

---

## PTZ Control

### ONVIF-Based PTZ

```javascript
async function ptzAbsoluteMove(camera, pan, tilt, zoom) {
  const device = await getOnvifDevice(camera);
  
  await device.services.ptz.absoluteMove({
    profileToken: camera.onvif_profile_token,
    position: {
      x: pan,      // -1.0 to 1.0 (left to right)
      y: tilt,     // -1.0 to 1.0 (down to up)
      z: zoom      // 0.0 to 1.0 (wide to tele)
    },
    speed: { x: 0.5, y: 0.5, z: 0.5 }
  });
}

async function ptzContinuousMove(camera, direction) {
  const device = await getOnvifDevice(camera);
  
  const velocity = {
    left: { x: -0.5, y: 0, z: 0 },
    right: { x: 0.5, y: 0, z: 0 },
    up: { x: 0, y: 0.5, z: 0 },
    down: { x: 0, y: -0.5, z: 0 },
    zoomIn: { x: 0, y: 0, z: 0.5 },
    zoomOut: { x: 0, y: 0, z: -0.5 }
  };
  
  await device.services.ptz.continuousMove({
    profileToken: camera.onvif_profile_token,
    velocity: velocity[direction],
    timeout: 1000
  });
}
```

### Storing PTZ Position

PTZ positions are stored directly in the `cameras` table:

```javascript
async function updatePtzPosition(cameraId, pan, tilt, zoom) {
  await db.update(cameras)
    .set({
      ptz_pan: pan,
      ptz_tilt: tilt,
      ptz_zoom: zoom
    })
    .where(eq(cameras.id, cameraId));
}
```

---

## Audio Support

### Audio Codec Support by Brand

| Brand | Input Codec | Notes |
|-------|-------------|-------|
| Reolink | AAC | Best quality |
| Hikvision | G.711/AAC | Via ISAPI or ONVIF |
| Dahua | G.711/AAC | Via RTP backchannel |
| Amcrest | G.711/AAC | Same as Dahua |
| Axis | AAC/G.711 | Full duplex via VAPIX |
| Tapo | AAC | ONVIF Profile S |
| Foscam | G.711 | Varies by model |

### Checking Audio Presence

```javascript
async function hasAudioStream(rtspUrl) {
  const ffprobe = require('fluent-ffmpeg').ffprobe;
  
  return new Promise((resolve, reject) => {
    ffprobe(rtspUrl, { timeout: 5000 }, (err, metadata) => {
      if (err) return reject(err);
      
      const audioStream = metadata.streams.find(
        s => s.codec_type === 'audio'
      );
      
      resolve({
        hasAudio: !!audioStream,
        codec: audioStream?.codec_name,
        sampleRate: audioStream?.sample_rate,
        channels: audioStream?.channels
      });
    });
  });
}
```

---

## Night Vision / IR Control

### IR Mode Control

IR mode is stored in the `cameras` table as `ir_mode`:

```javascript
async function setIRMode(camera, mode) {
  // Update database
  await db.update(cameras)
    .set({ ir_mode: mode })
    .where(eq(cameras.id, camera.id));
  
  // Apply to camera via ONVIF
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
}
```

---

## Stream Management

### Dual-Stream Strategy

**Main Stream (High Resolution):**
- Use for recording, event capture
- 1080p-4K resolution
- 15-30 FPS
- Configured in `camera_streams` table

**Sub Stream (Low Resolution):**
- Use for live viewing, mobile apps
- 640x480 or 720p
- 10-15 FPS
- Configured in `camera_streams` table

### Retrieving Stream Configuration

```javascript
async function getStreamConfig(cameraId, streamType) {
  const stream = await db.query.cameraStreams.findFirst({
    where: and(
      eq(cameraStreams.camera_id, cameraId),
      eq(cameraStreams.stream_type, streamType)
    )
  });
  
  return stream;
}
```

---

## Security Considerations

### 1. Credential Encryption

Use libsodium for password encryption:

```javascript
import sodium from 'sodium-native';

function encryptPassword(plainPassword) {
  const key = Buffer.from(process.env.CAMERA_ENCRYPTION_KEY, 'hex');
  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
  sodium.randombytes_buf(nonce);
  
  const ciphertext = Buffer.alloc(
    plainPassword.length + sodium.crypto_secretbox_MACBYTES
  );
  
  sodium.crypto_secretbox_easy(
    ciphertext,
    Buffer.from(plainPassword),
    nonce,
    key
  );
  
  return Buffer.concat([nonce, ciphertext]).toString('hex');
}
```

### 2. Network Isolation

Cameras should be on isolated VLAN:
```
Camera VLAN: 10.10.10.0/24
- No internet access
- No inter-camera traffic
- Raspberry Pi has interface on this VLAN
```

### 3. Connection Rate Limiting

```javascript
const rateLimiter = new Map();

function checkRateLimit(cameraId) {
  const now = Date.now();
  const attempts = rateLimiter.get(cameraId) || [];
  const recentAttempts = attempts.filter(t => now - t < 60000);
  
  if (recentAttempts.length >= 5) {
    throw new Error('Too many connection attempts');
  }
  
  recentAttempts.push(now);
  rateLimiter.set(cameraId, recentAttempts);
}
```

---

## Testing Strategy

### Unit Tests

```javascript
describe('Camera Management', () => {
  test('creates camera with encrypted password', async () => {
    const camera = await createCamera({
      name: 'Front Door',
      brand: 'reolink',
      host: '10.10.10.100',
      username: 'admin',
      password: 'test123'
    });
    
    expect(camera.password_encrypted).toBeDefined();
    expect(camera.password_encrypted).not.toContain('test123');
  });
  
  test('creates stream configurations', async () => {
    const streams = await db.query.cameraStreams.findMany({
      where: eq(cameraStreams.camera_id, camera.id)
    });
    
    expect(streams).toHaveLength(2);
    expect(streams.find(s => s.stream_type === 'main')).toBeDefined();
    expect(streams.find(s => s.stream_type === 'sub')).toBeDefined();
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Connection Failed"

**Debug Steps:**
```bash
# Test network
ping 10.10.10.100

# Check RTSP port
nmap -p 554 10.10.10.100

# Test with VLC
# Open Network Stream: rtsp://admin:pass@10.10.10.100:554/...

# Check FFprobe
ffprobe -rtsp_transport tcp "rtsp://admin:pass@10.10.10.100:554/..."
```

#### 2. "Authentication Failed"

**Solutions:**
- Verify credentials in camera web interface
- For Tapo: Create Camera Account in app (Advanced Settings > Camera Account)
- For Foscam: Create user via desktop app, not web interface
- Try removing special characters from password

#### 3. "Stream Timeout"

**Solutions:**
```javascript
// Increase timeout
ffmpegOptions.push('-timeout 30000000'); // 30s in microseconds

// Use TCP
ffmpegOptions.push('-rtsp_transport tcp');

// Reduce buffer
ffmpegOptions.push('-analyzeduration 5000000');
ffmpegOptions.push('-probesize 5000000');
```

#### 4. PTZ Not Working

**Solutions:**
- Enable ONVIF in camera settings
- Create separate ONVIF user account
- For Axis: Try VAPIX commands instead of ONVIF
- Verify camera has PTZ hardware (not digital PTZ)

---

## Performance Optimization

### Raspberry Pi Best Practices

1. **Use Sub-Streams for Live View**
   ```javascript
   const liveViewConfig = await getStreamConfig(cameraId, 'sub');
   ```

2. **Limit Concurrent Transcoding**
   ```javascript
   const MAX_CONCURRENT = 3;
   ```

3. **HLS with Copy Codec**
   ```javascript
   .videoCodec('copy')  // No transcoding if H.264
   .audioCodec('copy')  // No transcoding if AAC
   ```

4. **Connection Pooling**
   ```javascript
   const devicePool = new Map();
   
   function getOnvifDevice(camera) {
     const key = `${camera.host}:${camera.username}`;
     if (devicePool.has(key)) return devicePool.get(key);
     const device = new OnvifDevice(camera);
     devicePool.set(key, device);
     return device;
   }
   ```

---

**END OF DEVELOPER DOCUMENTATION**
