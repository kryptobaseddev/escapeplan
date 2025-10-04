# EscapePlan Network Camera Support - Developer Documentation

**Version:** 1.0.0  
**Last Updated:** October 3, 2025  
**Target Platform:** Raspberry Pi 4+ running Svelte 5 + Fastify  

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Camera Brands](#supported-camera-brands)
3. [Protocol Support](#protocol-support)
4. [Database Schema](#database-schema)
5. [Camera Connection Workflow](#camera-connection-workflow)
6. [Brand-Specific Implementation](#brand-specific-implementation)
7. [PTZ Control](#ptz-control)
8. [Audio Support](#audio-support)
9. [Night Vision / IR Control](#night-vision--ir-control)
10. [Stream Management](#stream-management)
11. [Security Considerations](#security-considerations)
12. [Testing Strategy](#testing-strategy)
13. [Troubleshooting](#troubleshooting)

---

## Overview

EscapePlan is a self-contained camera management system designed to run on Raspberry Pi hardware with a Svelte 5 frontend and Fastify backend. The system supports network cameras (IP cameras) from major manufacturers with focus on RTSP, ONVIF, and MJPEG protocols.

### Core Features

- Multi-brand camera support with automatic configuration
- RTSP/ONVIF/MJPEG protocol support
- Dual-stream capability (main + sub-stream)
- PTZ control for supported cameras
- IR/Night vision mode control
- Audio input management
- Connection testing and validation
- Encrypted credential storage
- Game association for escape room scenarios

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

## Supported Camera Brands

### Primary Support (Fully Tested)

| Brand | RTSP | ONVIF | MJPEG | PTZ | Audio | IR Control | Notes |
|-------|------|-------|-------|-----|-------|------------|-------|
| **Reolink** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | H.265 main, H.264 sub |
| **Hikvision** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Industry standard |
| **Dahua** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OEM for many brands |
| **Amcrest** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Dahua OEM |
| **Axis** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Premium, VAPIX API |
| **TP-Link** | ✅ | ✅ | ❌ | ⚠️ | ✅ | ✅ | Limited PTZ models |
| **Tapo** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | Consumer, Profile S only |
| **Foscam** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | Older firmware issues |

### Generic ONVIF Support

Any camera supporting ONVIF Profile S can be added as a "Generic" camera with manual configuration.

---

## Protocol Support

### RTSP (Real-Time Streaming Protocol)

**Port:** 554 (default)  
**Transport:** TCP (default) / UDP  
**Use Case:** Primary streaming protocol for all cameras

**Advantages:**
- Low latency
- Efficient bandwidth usage
- Supports multiple simultaneous connections
- Industry standard

**URL Format:**
```
rtsp://[username]:[password]@[ip]:[port]/[path]
```

### ONVIF (Open Network Video Interface Forum)

**Port:** 80 (HTTP), 2020 (Tapo specific)  
**Profiles Supported:** Profile S (streaming), Profile T (advanced)  
**Use Case:** Device discovery, PTZ control, configuration

**Capabilities:**
- Automatic stream URL discovery
- PTZ control standardization
- Event management
- Metadata streaming

### MJPEG (Motion JPEG)

**Port:** 80/8080 (HTTP)  
**Use Case:** Fallback streaming, snapshot capture  
**Supported Brands:** Hikvision, Dahua, Amcrest, Axis, Foscam

**URL Format:**
```
http://[username]:[password]@[ip]:[port]/[path]
```

---

## Database Schema

See separate `camera-schema.ts` file for complete Drizzle ORM schema.

### Key Tables

#### `cameras`
- Core camera configuration
- Connection details (encrypted)
- Stream settings
- Status tracking

#### `camera_capabilities`
- PTZ support flags
- Audio capabilities
- IR/Night vision
- Multi-stream support

#### `camera_ptz_presets`
- Named positions
- Pan/tilt/zoom values
- Per-camera storage

#### `camera_streams`
- Main and sub-stream configurations
- Independent resolution/bitrate settings
- Stream-specific paths

---

## Camera Connection Workflow

### 1. Brand/Model Selection

```typescript
interface CameraTemplate {
  brand: string;
  model?: string;
  default_port: number;
  protocol: 'rtsp' | 'onvif' | 'mjpeg';
  main_stream_path: string;
  sub_stream_path?: string;
  requires_auth: boolean;
  default_transport: 'tcp' | 'udp';
  capabilities: {
    ptz: boolean;
    audio: boolean;
    ir_control: boolean;
    two_way_audio: boolean;
    dual_stream: boolean;
  };
  notes?: string;
}
```

### 2. Automatic Configuration

When a user selects a brand/model:
1. Load template from `camera-templates.json`
2. Pre-fill IP address field only
3. Auto-populate port, protocol, stream paths
4. Set transport and capabilities flags
5. User enters credentials and clicks "Test Connection"

### 3. Connection Testing

```javascript
async function testCameraConnection(config) {
  // Step 1: Network connectivity check
  const pingResult = await ping(config.host);
  if (!pingResult.alive) {
    throw new Error('Camera not reachable on network');
  }
  
  // Step 2: ONVIF discovery (if supported)
  if (config.protocol === 'onvif') {
    try {
      const onvifDevice = await discoverOnvifDevice(config);
      config.stream_paths = await onvifDevice.getStreamUris();
    } catch (e) {
      // Fallback to manual RTSP
    }
  }
  
  // Step 3: Stream validation with FFprobe
  const streamUrl = buildStreamUrl(config, 'main');
  const probeResult = await ffprobe(streamUrl, {
    timeout: 10000,
    retry: 2
  });
  
  if (!probeResult.streams || probeResult.streams.length === 0) {
    throw new Error('No valid video stream found');
  }
  
  // Step 4: Extract stream metadata
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

### 4. Credential Encryption

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
- Battery-powered models require 20s timeout
- ONVIF port: 8000 (not 80)
- Supports AAC audio, G711 for two-way

**ONVIF Quirk:**
```javascript
// Must force HTTP port to 8000
const device = new onvif.OnvifDevice({
  xaddr: `http://${ip}:8000/onvif/device_service`,
  user: username,
  pass: password
});
```

**Recommended Settings:**
- Main Stream: 1920x1080@15fps, H.264/H.265
- Sub Stream: 640x360@10fps, H.264
- Transport: TCP (more reliable)

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
- Example: Channel 3 main = 301, Channel 3 sub = 302

**MJPEG Snapshot:**
```
http://[user]:[pass]@[ip]:80/ISAPI/Streaming/channels/101/picture
```

**Key Characteristics:**
- Most widely compatible
- Supports H.264+ / H.265+ compression
- ISAPI for advanced control
- Disable encryption for RTSP: Setup > Network > Advanced > Integration Protocol

**Recommended Settings:**
- Main Stream: 2560x1440@20fps, H.265
- Sub Stream: 704x480@10fps, H.264
- Transport: TCP
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

**Amcrest Note:**
Amcrest cameras are Dahua OEM, use identical URL format.

**Alternative Format (older models):**
```
rtsp://[user]:[pass]@[ip]:554/h264Preview_01_main
rtsp://[user]:[pass]@[ip]:554/h264Preview_01_sub
```

**MJPEG Snapshot:**
```
http://[user]:[pass]@[ip]:80/cgi-bin/snapshot.cgi?channel=1
```

**Key Characteristics:**
- Default credentials: admin/admin (must change!)
- HTTP and RTSP ports can differ
- Smart H.264/H.265+ compression
- Excellent PTZ support

**Recommended Settings:**
- Main Stream: 3840x2160@15fps (8MP), H.265
- Sub Stream: 640x480@10fps, H.264
- Transport: TCP
- Bitrate control: VBR

---

### Axis

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:554/axis-media/media.amp                # Default profile
rtsp://[user]:[pass]@[ip]:554/axis-media/media.amp?resolution=640x480&fps=15
```

**VAPIX Parameters:**
- `resolution`: 1920x1080, 1280x720, 640x480, etc.
- `fps`: 1-30
- `compression`: 0-100 (lower = better quality)
- `streamprofile`: named profiles created in camera UI

**MJPEG:**
```
http://[user]:[pass]@[ip]:80/mjpg/video.mjpg
```

**Key Characteristics:**
- Premium brand, excellent quality
- VAPIX API for advanced control
- Multi-streaming capability (4+ concurrent)
- Supports ONVIF Profile S, T, G
- Advanced analytics (motion, tampering, audio detection)

**Recommended Settings:**
- Main Stream: 1920x1080@25fps, H.264
- Sub Stream: Use streamprofile (e.g., `?streamprofile=Quality`)
- Transport: TCP
- Create custom profiles in camera web interface

**PTZ Control:**
Axis cameras support both ONVIF PTZ and proprietary VAPIX commands:
```
http://[ip]/axis-cgi/com/ptz.cgi?camera=1&pan=[value]&tilt=[value]&zoom=[value]
```

---

### TP-Link / Tapo

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:554/stream1  # Main / High quality
rtsp://[user]:[pass]@[ip]:554/stream2  # Sub / Low quality
```

**ONVIF Port:** 2020 (not standard 80!)

**Key Characteristics:**
- Consumer-focused, easy setup
- ONVIF Profile S only (no 2-way audio via ONVIF)
- Battery models (C410/C420) do NOT support RTSP
- Wired models (C310/C320/C330) fully support RTSP
- PTZ models (TC70/TC85) support pan/tilt via ONVIF
- Must create "Camera Account" in Tapo app before RTSP access

**Setup Steps:**
1. Configure camera in Tapo app
2. Go to Advanced Settings > Camera Account
3. Create username/password (6-32 characters)
4. Enable RTSP in camera settings (if option exists)
5. Use port 554 for RTSP, 2020 for ONVIF

**Important Notes:**
- Cannot use Tapo Care + NVR/RTSP simultaneously
- Stream1 resolution determined by video quality in app
- Set to "Best Quality" in app for full resolution on stream1
- Adjust microphone in app if RTSP audio is low/missing

**Recommended Settings:**
- Main Stream: 2304x1296@15fps (C310), H.264
- Sub Stream: 640x360@10fps, H.264
- Transport: TCP
- Timeout: 20s for initial connection

---

### Foscam

**Stream URL Format:**
```
rtsp://[user]:[pass]@[ip]:88/videoMain   # Main stream
rtsp://[user]:[pass]@[ip]:88/videoSub    # Sub stream
rtsp://[user]:[pass]@[ip]:88/audio       # Audio only
```

**Important:** Default port is 88 (not 554)! Newer models may use 554.

**MJPEG:**
```
http://[user]:[pass]@[ip]:88/cgi-bin/CGIProxy.fcgi?cmd=snapPicture2&usr=[user]&pwd=[pass]
```

**Key Characteristics:**
- Older brand with varying firmware quality
- HD models (FI9821P, FI9831P, etc.) use port 88
- Some models use port 554 (check camera web interface)
- PTZ models have extensive preset support
- ONVIF support varies by firmware version

**User Creation Issue:**
If creating users via camera webpage, password validation is weak. Use Foscam Windows client app to create users with proper format, or RTSP will fail silently.

**Recommended Settings:**
- Main Stream: 1920x1080@15fps, H.264
- Sub Stream: 640x480@10fps, H.264
- Transport: TCP
- Update to latest firmware for best ONVIF support

---

### Generic ONVIF

For cameras not explicitly supported but claiming ONVIF compliance:

**Discovery Flow:**
```javascript
const onvif = require('node-onvif');

// Discover camera
const devices = await onvif.startProbe();
const camera = devices[0];

// Initialize device
const cam = new onvif.OnvifDevice({
  xaddr: camera.xaddr,
  user: username,
  pass: password
});

await cam.init();

// Get profiles
const profiles = await cam.services.media.getProfiles();

// Get stream URI
const streamUri = await cam.services.media.getStreamUri({
  protocol: 'RTSP',
  profileToken: profiles[0].$.token
});

console.log('Stream URL:', streamUri.uri);
```

**Fallback URL Patterns:**
```
rtsp://[ip]:554/onvif1          # Common generic
rtsp://[ip]:554/onvif/profile1  # Alternative
rtsp://[ip]:554/live/0/main     # Some Chinese OEMs
```

---

## PTZ Control

### ONVIF-Based PTZ

**Supported Operations:**
- Absolute positioning (pan, tilt, zoom to specific coordinates)
- Relative positioning (move by delta from current position)
- Continuous move (hold direction until stop command)
- Preset management (save/recall/delete positions)
- Home position
- Patrol/tour (sequence of presets)

**Implementation:**

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
    speed: {
      x: 0.5,      // Pan speed
      y: 0.5,      // Tilt speed
      z: 0.5       // Zoom speed
    }
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
    timeout: 1000  // Auto-stop after 1s if no stop command
  });
}

async function ptzStop(camera) {
  const device = await getOnvifDevice(camera);
  
  await device.services.ptz.stop({
    profileToken: camera.onvif_profile_token,
    panTilt: true,
    zoom: true
  });
}
```

### PTZ Presets

```javascript
async function savePtzPreset(camera, name) {
  const device = await getOnvifDevice(camera);
  
  const result = await device.services.ptz.setPreset({
    profileToken: camera.onvif_profile_token,
    presetName: name
  });
  
  return result.presetToken;
}

async function recallPtzPreset(camera, presetToken) {
  const device = await getOnvifDevice(camera);
  
  await device.services.ptz.gotoPreset({
    profileToken: camera.onvif_profile_token,
    presetToken: presetToken,
    speed: {
      x: 1.0,
      y: 1.0,
      z: 1.0
    }
  });
}
```

### Axis-Specific PTZ (VAPIX)

```javascript
async function axisPTZ(camera, action) {
  const baseUrl = `http://${camera.host}/axis-cgi/com/ptz.cgi`;
  
  const commands = {
    left: 'pan=-30&tilt=0',
    right: 'pan=30&tilt=0',
    up: 'pan=0&tilt=30',
    down: 'pan=0&tilt=-30',
    zoomIn: 'zoom=100',
    zoomOut: 'zoom=-100',
    home: 'move=home'
  };
  
  const response = await fetch(`${baseUrl}?${commands[action]}`, {
    headers: {
      'Authorization': `Basic ${btoa(`${camera.username}:${camera.password}`)}`
    }
  });
  
  return response.ok;
}
```

---

## Audio Support

### Audio Codec Support by Brand

| Brand | Input Codec | Output (2-way) | Notes |
|-------|-------------|----------------|-------|
| Reolink | AAC | G.711 | Via RTSP backchannel |
| Hikvision | G.711/AAC | G.711 | Via ISAPI or ONVIF |
| Dahua | G.711/AAC | G.711 | Via RTP backchannel |
| Amcrest | G.711/AAC | G.711 | Same as Dahua |
| Axis | AAC/G.711 | G.711/AAC | Full duplex via VAPIX |
| Tapo | AAC | ❌ | ONVIF Profile S no 2-way |
| Foscam | G.711 | G.711 | Varies by model |

### Extracting Audio from RTSP

```javascript
async function extractAudioStream(rtspUrl, outputFormat = 'aac') {
  const ffmpeg = require('fluent-ffmpeg');
  
  return new Promise((resolve, reject) => {
    ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport tcp',
        '-analyzeduration 2000000',
        '-probesize 2000000'
      ])
      .audioCodec('copy')
      .format(outputFormat)
      .on('end', resolve)
      .on('error', reject)
      .pipe(outputStream);
  });
}
```

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

### Modes

Most cameras support 3 IR modes:
1. **Auto** - IR LEDs activate based on light sensor
2. **On** - IR LEDs always on (night mode)
3. **Off** - IR LEDs disabled (day mode/color night vision)

### ONVIF Control

```javascript
async function setIRMode(camera, mode) {
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

### Brand-Specific HTTP Commands

**Hikvision:**
```xml
PUT http://[ip]/ISAPI/Image/channels/1/IrcutFilter
<IrcutFilter>
  <IrcutFilterType>day|night|auto</IrcutFilterType>
</IrcutFilter>
```

**Dahua/Amcrest:**
```
http://[ip]/cgi-bin/configManager.cgi?action=setConfig&Lighting[0][0].Mode=Auto|Manual|Off
```

**Reolink:**
```
http://[ip]/api.cgi?cmd=SetIrLights&token=[token]
[{"cmd":"SetIrLights","param":{"IrLights":{"state":"Auto"}}}]
```

---

## Stream Management

### Dual-Stream Strategy

**Main Stream (High Resolution):**
- Use for recording, event capture
- 1080p-4K resolution
- 15-30 FPS
- Higher bitrate (4-8 Mbps)

**Sub Stream (Low Resolution):**
- Use for live viewing, mobile apps
- 640x480 or 720p
- 10-15 FPS
- Lower bitrate (512 Kbps - 2 Mbps)

### FFmpeg Transcoding

For cameras without efficient sub-streams, transcode main stream:

```javascript
function createSubStream(mainStreamUrl, quality = 'medium') {
  const presets = {
    low: { size: '480x360', bitrate: '512k', fps: 10 },
    medium: { size: '640x480', bitrate: '1024k', fps: 15 },
    high: { size: '1280x720', bitrate: '2048k', fps: 20 }
  };
  
  const preset = presets[quality];
  
  return ffmpeg(mainStreamUrl)
    .inputOptions(['-rtsp_transport tcp'])
    .videoCodec('libx264')
    .videoBitrate(preset.bitrate)
    .size(preset.size)
    .fps(preset.fps)
    .audioCodec('aac')
    .audioBitrate('64k')
    .outputOptions([
      '-preset ultrafast',
      '-tune zerolatency',
      '-g 60',
      '-sc_threshold 0'
    ])
    .format('mpegts');
}
```

### HLS Streaming

Convert RTSP to HLS for web playback:

```javascript
async function createHLSStream(camera, outputDir) {
  const streamUrl = buildRtspUrl(camera, 'sub');
  
  return ffmpeg(streamUrl)
    .inputOptions(['-rtsp_transport tcp'])
    .videoCodec('copy')  // No transcoding if already H.264
    .audioCodec('aac')
    .outputOptions([
      '-hls_time 2',
      '-hls_list_size 5',
      '-hls_flags delete_segments',
      '-start_number 1'
    ])
    .output(`${outputDir}/stream.m3u8`)
    .on('start', cmd => console.log('FFmpeg:', cmd))
    .on('error', err => console.error('FFmpeg error:', err))
    .run();
}
```

---

## Security Considerations

### 1. Credential Storage

**NEVER store plain-text passwords!**

Use `libsodium` symmetric encryption:

```javascript
// Generate encryption key (store in .env, never commit!)
const key = crypto.randomBytes(32).toString('hex');
// CAMERA_ENCRYPTION_KEY=a1b2c3d4e5f6...

// Encrypt before INSERT
const encrypted = encryptPassword(plainPassword);
await db.insert(cameras).values({
  ...cameraData,
  password_encrypted: encrypted
});

// Decrypt only when needed for connections
const plain = decryptPassword(camera.password_encrypted);
```

### 2. Network Isolation

Cameras should be on isolated VLAN:
```
Camera VLAN: 10.10.10.0/24
- No internet access
- No inter-camera traffic
- Raspberry Pi has interface on this VLAN
```

### 3. RTSP Authentication

Always enable digest authentication on cameras:
- Hikvision: Setup > Network > Advanced > RTSP Authentication
- Dahua: Setup > Network > Connection > RTSP Port (enable auth)
- Axis: Setup > System > Security > Enable RTSP digest auth

### 4. Rate Limiting

Implement connection attempt limits:

```javascript
const rateLimiter = new Map();

function checkRateLimit(cameraId) {
  const now = Date.now();
  const attempts = rateLimiter.get(cameraId) || [];
  
  // Remove attempts older than 1 minute
  const recentAttempts = attempts.filter(t => now - t < 60000);
  
  if (recentAttempts.length >= 5) {
    throw new Error('Too many connection attempts. Try again in 1 minute.');
  }
  
  recentAttempts.push(now);
  rateLimiter.set(cameraId, recentAttempts);
}
```

### 5. Timeout Configuration

```javascript
const ffmpegTimeouts = {
  probe: 10000,      // 10s for stream validation
  connect: 30000,    // 30s for initial connection
  read: 5000         // 5s for stream read timeout
};
```

---

## Testing Strategy

### Unit Tests

```javascript
describe('Camera Connection', () => {
  test('builds correct Hikvision RTSP URL', () => {
    const url = buildRtspUrl({
      brand: 'hikvision',
      host: '192.168.1.100',
      port: 554,
      username: 'admin',
      password: 'test123',
      channel: 1,
      stream: 'main'
    });
    
    expect(url).toBe('rtsp://admin:test123@192.168.1.100:554/Streaming/Channels/101');
  });
  
  test('encrypts and decrypts password', () => {
    const plain = 'mySecretPassword';
    const encrypted = encryptPassword(plain);
    const decrypted = decryptPassword(encrypted);
    
    expect(decrypted).toBe(plain);
    expect(encrypted).not.toBe(plain);
  });
});
```

### Integration Tests

```javascript
describe('Camera CRUD', () => {
  test('creates camera with encrypted password', async () => {
    const camera = await createCamera({
      name: 'Front Door',
      brand: 'reolink',
      model: 'RLC-810A',
      host: '10.10.10.100',
      username: 'admin',
      password: 'test123'
    });
    
    expect(camera.id).toBeDefined();
    expect(camera.password_encrypted).toBeDefined();
    expect(camera.password_encrypted).not.toContain('test123');
  });
  
  test('tests camera connection successfully', async () => {
    const result = await testConnection(camera.id);
    
    expect(result.success).toBe(true);
    expect(result.resolution).toMatch(/\d+x\d+/);
  });
});
```

### Manual Test Checklist

- [ ] Add camera from each supported brand
- [ ] Test connection for each brand/model
- [ ] Verify main stream playback
- [ ] Verify sub stream playback
- [ ] Test PTZ controls (if supported)
- [ ] Test audio playback (if supported)
- [ ] Test IR mode switching
- [ ] Test preset save/recall
- [ ] Test camera update
- [ ] Test camera deletion
- [ ] Test concurrent stream access (5+ clients)
- [ ] Test failover when camera offline
- [ ] Test password change
- [ ] Test invalid credentials handling

---

## Troubleshooting

### Common Issues

#### 1. "Connection Failed" Error

**Possible Causes:**
- Camera not on same network/VLAN
- Incorrect IP address
- Firewall blocking port 554
- Camera RTSP disabled

**Debug Steps:**
```bash
# Test network connectivity
ping 10.10.10.100

# Check if RTSP port open
nmap -p 554 10.10.10.100

# Test RTSP stream with VLC
# Open Network Stream: rtsp://admin:pass@10.10.10.100:554/...

# Check FFprobe output
ffprobe -rtsp_transport tcp "rtsp://admin:pass@10.10.10.100:554/..."
```

#### 2. "Authentication Failed" Error

**Possible Causes:**
- Wrong username/password
- Special characters in password not URL-encoded
- Camera requires digest auth but only basic provided

**Solutions:**
```javascript
// URL-encode credentials
const encodedUser = encodeURIComponent(username);
const encodedPass = encodeURIComponent(password);

// Use digest auth in FFmpeg
ffmpegOptions.push('-rtsp_flags prefer_tcp');
```

#### 3. "Stream Timeout" Error

**Possible Causes:**
- Camera overloaded (too many connections)
- Network congestion
- Insufficient bandwidth
- Camera firmware issue

**Solutions:**
```javascript
// Increase timeout
ffmpegOptions.push('-timeout 30000000'); // 30s in microseconds

// Use TCP instead of UDP
ffmpegOptions.push('-rtsp_transport tcp');

// Reduce buffer size
ffmpegOptions.push('-analyzeduration 5000000');
ffmpegOptions.push('-probesize 5000000');
```

#### 4. "No Video Stream Found" Error

**Possible Causes:**
- Wrong stream path for camera model
- Camera doesn't support requested codec
- Stream path case-sensitive

**Solutions:**
- Try ONVIF discovery to get correct stream URL
- Test with VLC first
- Check camera web interface for actual stream path
- Try both `/Streaming/` and `/streaming/` (case matters!)

#### 5. PTZ Controls Not Working

**Possible Causes:**
- ONVIF not enabled on camera
- PTZ not enabled in camera settings
- Wrong ONVIF user credentials
- Profile S limitation (Tapo)

**Solutions:**
- Enable ONVIF in camera settings
- Create separate ONVIF user
- Check PTZ capability via ONVIF GetCapabilities
- For Axis, try VAPIX commands instead

---

## Performance Optimization

### Raspberry Pi Considerations

**Hardware Limits:**
- CPU: Quad-core ARM Cortex-A72 @ 1.5GHz
- RAM: 4GB-8GB
- No hardware H.264 decode (only encode on Pi 4)
- Gigabit Ethernet (750 Mbps practical)

**Optimization Strategies:**

1. **Use Sub-Streams for Live View**
   ```javascript
   // Don't decode main streams for UI preview
   const liveViewUrl = buildRtspUrl(camera, 'sub');
   ```

2. **Limit Concurrent Transcoding**
   ```javascript
   const MAX_CONCURRENT_TRANSCODES = 3;
   
   async function acquireTranscodeSlot() {
     while (activeTranscodes >= MAX_CONCURRENT_TRANSCODES) {
       await sleep(100);
     }
     activeTranscodes++;
   }
   ```

3. **Use HLS with Copy Codec**
   ```javascript
   // No transcoding if already H.264
   .videoCodec('copy')
   .audioCodec('copy')  // If AAC
   ```

4. **Connection Pooling**
   ```javascript
   // Reuse ONVIF device connections
   const devicePool = new Map();
   
   function getOnvifDevice(camera) {
     const key = `${camera.host}:${camera.username}`;
     if (devicePool.has(key)) {
       return devicePool.get(key);
     }
     const device = new OnvifDevice(camera);
     devicePool.set(key, device);
     return device;
   }
   ```

5. **Lazy Load Camera Streams**
   ```javascript
   // Only start streaming when user opens live view
   // Stop stream when user leaves page
   ```

---

## Future Enhancements

### Planned Features

1. **Automatic Discovery**
   - Network scanning for cameras (port 554, 80, 8080)
   - ONVIF WS-Discovery probe
   - Zeroconf/mDNS discovery

2. **Motion Detection Integration**
   - Parse ONVIF event stream
   - Trigger on motion events
   - Link to game events

3. **Multi-Camera Views**
   - 2x2, 3x3, 4x4 grid layouts
   - Synchronized playback
   - PTZ camera following

4. **Recording Management**
   - Continuous recording to NAS
   - Event-based clips
   - Retention policies

5. **Advanced PTZ**
   - Auto-patrol patterns
   - Auto-tracking (if supported)
   - Guard tour scheduler

---

## References

### Documentation
- [Hikvision ISAPI](http://www.hikvisioneurope.com/portal/?dir=portal/Technical%20Materials/08%20Technical%20Specifications/)
- [Dahua HTTP API](http://dahuawiki.com/)
- [Axis VAPIX](https://developer.axis.com/vapix/)
- [ONVIF Specifications](https://www.onvif.org/profiles/)
- [RFC 2326 - RTSP](https://tools.ietf.org/html/rfc2326)

### Libraries
- [node-onvif](https://github.com/futomi/node-onvif) - ONVIF client
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) - FFmpeg wrapper
- [sodium-native](https://github.com/sodium-friends/sodium-native) - Encryption

### Tools
- [VLC Media Player](https://www.videolan.org/) - Stream testing
- [ONVIF Device Manager](https://sourceforge.net/projects/onvifdm/) - ONVIF testing
- [iSpy Connect](https://www.ispyconnect.com/) - Stream URL reference

---

**END OF DEVELOPER DOCUMENTATION**
