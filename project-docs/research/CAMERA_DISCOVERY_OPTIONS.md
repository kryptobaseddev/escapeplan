# Camera Discovery & Management Research

**Date:** 2025-10-01
**Purpose:** Research auto-discovery options for network cameras
**Status:** Initial research phase

---

## Executive Summary

EscapePlan needs robust camera discovery for IP cameras (RTSP/MJPEG/ONVIF) on local network (10.10.10.0/24). Current manual entry works but auto-discovery would improve UX.

**Recommended Approach:**
1. **Phase 1 (MVP - Current):** Manual entry with connection validation ✅
2. **Phase 2:** Network scan + port detection (8 hours)
3. **Phase 3:** ONVIF auto-discovery (12 hours)
4. **Phase 4:** Manufacturer templates (6 hours)

---

## Available Libraries & Tools

### 1. ONVIF Discovery

**node-onvif** ([GitHub](https://github.com/futomi/node-onvif))
- ✅ ONVIF-compliant camera discovery via WS-Discovery
- ✅ Device info, stream URLs, PTZ control
- ✅ Well-maintained, 700+ stars
- ❌ Requires ONVIF support (not all cameras)

```javascript
const onvif = require('node-onvif');

// Discover ONVIF cameras on network
onvif.startProbe().then((devices) => {
  devices.forEach((device) => {
    console.log({
      name: device.name,
      address: device.address,
      manufacturer: device.manufacturer,
      model: device.model,
      streamUrl: device.streamUrl
    });
  });
});
```

**Use Case:** Auto-discover ONVIF Profile S cameras
**Effort:** 12 hours (integration + testing)
**ROI:** High for ONVIF cameras, zero for others

---

### 2. Network Scanning

**evilscan** ([npm](https://www.npmjs.com/package/evilscan))
- ✅ Fast port scanner for Node.js
- ✅ Can scan IP ranges for common camera ports
- ✅ Identifies open ports (554 RTSP, 80/8080 HTTP)

```javascript
const Evilscan = require('evilscan');

const options = {
  target: '10.10.10.0/24',
  port: '554,80,8080,81',
  status: 'O', // Open ports only
  banner: true
};

const scanner = new Evilscan(options);

scanner.on('result', (data) => {
  if (data.status === 'open') {
    console.log(`Potential camera at ${data.ip}:${data.port}`);
    // Probe with ffprobe to confirm
  }
});

scanner.run();
```

**Use Case:** Find devices with camera ports open
**Effort:** 8 hours (scan + validation)
**ROI:** Medium - finds cameras but still needs manual verification

---

### 3. mDNS/Bonjour Service Discovery

**bonjour** ([npm](https://www.npmjs.com/package/bonjour))
- ✅ Discover services advertised via mDNS
- ✅ Many IP cameras advertise `_rtsp._tcp` or `_http._tcp`
- ❌ Not all cameras use mDNS

```javascript
const bonjour = require('bonjour')();

// Browse for RTSP services
bonjour.find({ type: 'rtsp' }, (service) => {
  console.log({
    name: service.name,
    host: service.host,
    port: service.port,
    addresses: service.addresses
  });
});
```

**Use Case:** Discover cameras advertising mDNS services
**Effort:** 4 hours (integration)
**ROI:** Low - few cameras use mDNS for streams

---

### 4. UPnP/SSDP Discovery

**node-ssdp** ([npm](https://www.npmjs.com/package/node-ssdp))
- ✅ Universal Plug and Play discovery
- ✅ Some cameras advertise via SSDP
- ❌ Inconsistent support across manufacturers

```javascript
const { Client } = require('node-ssdp');
const client = new Client();

client.on('response', (headers, statusCode, rinfo) => {
  console.log('Found device:', {
    location: headers.LOCATION,
    server: headers.SERVER,
    address: rinfo.address
  });
});

client.search('urn:schemas-upnp-org:device:MediaServer:1');
```

**Use Case:** Discover UPnP-enabled cameras
**Effort:** 6 hours
**ROI:** Low - limited camera support

---

### 5. Stream Validation with FFmpeg

**fluent-ffmpeg** ([npm](https://www.npmjs.com/package/fluent-ffmpeg))
- ✅ Wrapper for ffmpeg/ffprobe
- ✅ Test stream URLs for validity
- ✅ Extract stream metadata (resolution, FPS, codec)

```javascript
const ffmpeg = require('fluent-ffmpeg');

function validateCameraStream(url) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(url, { timeout: 5 }, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      resolve({
        valid: true,
        resolution: `${videoStream.width}x${videoStream.height}`,
        fps: eval(videoStream.r_frame_rate), // e.g., "30/1" → 30
        codec: videoStream.codec_name
      });
    });
  });
}
```

**Use Case:** Validate discovered/manual camera URLs
**Effort:** 2 hours (already planned in connection testing API)
**ROI:** High - essential for any discovery method

---

## Manufacturer-Specific URL Patterns

### Common RTSP URL Formats

| Manufacturer | Default URL Pattern | Default Port | Notes |
|--------------|---------------------|--------------|-------|
| Hikvision | `rtsp://[ip]:554/Streaming/Channels/101` | 554 | Also 102, 103 for sub-streams |
| Dahua | `rtsp://[ip]:554/cam/realmonitor?channel=1&subtype=0` | 554 | channel=1 main, subtype=1 sub |
| Axis | `rtsp://[ip]:554/axis-media/media.amp` | 554 | May require `/onvif/media_service` |
| Reolink | `rtsp://[ip]:554/h264Preview_01_main` | 554 | 01=channel, main/sub stream |
| Amcrest | `rtsp://[ip]:554/cam/realmonitor?channel=1&subtype=0` | 554 | Same as Dahua |
| Foscam | `rtsp://[ip]:554/videoMain` | 554 | videoSub for low-res |
| TP-Link | `rtsp://[ip]:554/stream1` | 554 | stream2 for sub-stream |
| Generic ONVIF | `rtsp://[ip]:554/onvif1` | 554 | ONVIF Profile S default |

### MJPEG URL Patterns

| Manufacturer | Default URL Pattern | Port |
|--------------|---------------------|------|
| Axis | `http://[ip]/mjpg/video.mjpg` | 80 |
| Generic | `http://[ip]:8080/video.mjpg` | 8080 |
| Foscam | `http://[ip]:88/cgi-bin/CGIProxy.fcgi?cmd=snapPicture2&usr=&pwd=` | 88 |

---

## Recommended Implementation Plan

### Phase 1: Manual Entry + Validation ✅ (CURRENT - Session 44)

**Status:** In progress
**Features:**
- Manual camera entry form
- Connection testing with ffprobe
- Protocol selection (RTSP/MJPEG/ONVIF)
- Credential encryption

**Deliverables:**
- Camera CRUD API
- Camera management UI
- Test connection endpoint

**Effort:** 32 hours (22h remaining)
**Priority:** CRITICAL

---

### Phase 2: Network Scan Discovery (POST-MVP)

**Status:** Planned
**Approach:**
1. Scan 10.10.10.0/24 for common camera ports (554, 80, 8080, 88)
2. Test discovered IPs with common URL patterns
3. Validate streams with ffprobe
4. Present candidates to user for confirmation

**Libraries:**
- `evilscan` - Port scanning
- `fluent-ffmpeg` - Stream validation

**Implementation:**
```javascript
// Scan network for cameras
async function discoverCameras(subnet = '10.10.10.0/24') {
  const candidates = await scanPorts(subnet, [554, 80, 8080, 88]);

  const cameras = [];
  for (const candidate of candidates) {
    const results = await testUrlPatterns(candidate.ip, candidate.port);
    if (results.valid) {
      cameras.push({
        ip: candidate.ip,
        port: candidate.port,
        protocol: results.protocol,
        streamPath: results.path,
        manufacturer: results.manufacturer // guessed from pattern
      });
    }
  }

  return cameras;
}
```

**UI Flow:**
1. User clicks "Scan Network" button
2. Progress indicator shows: "Scanning 10.10.10.0/24..."
3. Results table shows discovered cameras
4. User selects cameras to add
5. Auto-fills connection details, user adds name/credentials

**Effort:** 8 hours
**Priority:** HIGH (Phase 2 feature)
**Dependencies:** Phase 1 complete

---

### Phase 3: ONVIF Auto-Discovery (POST-MVP)

**Status:** Planned
**Approach:**
1. Send WS-Discovery probe on network
2. Parse ONVIF device responses
3. Retrieve stream URLs via GetStreamUri
4. Extract device info (name, manufacturer, model)
5. Present to user with auto-filled details

**Libraries:**
- `node-onvif` - ONVIF protocol handling

**Implementation:**
```javascript
const onvif = require('node-onvif');

async function discoverOnvifCameras() {
  const devices = await onvif.startProbe();

  const cameras = [];
  for (const device of devices) {
    const cam = new onvif.OnvifDevice({ xaddr: device.xaddr });
    await cam.init();

    const profiles = await cam.services.media.getProfiles();
    const streamUri = await cam.services.media.getStreamUri({
      protocol: 'RTSP',
      profileToken: profiles[0].$.token
    });

    cameras.push({
      name: device.name || 'ONVIF Camera',
      manufacturer: device.hardware || 'Unknown',
      ip: device.urn.split(':')[4],
      protocol: 'rtsp',
      streamUrl: streamUri.uri,
      onvifCapable: true
    });
  }

  return cameras;
}
```

**UI Flow:**
1. User clicks "Discover ONVIF Cameras"
2. Probe sent, progress shown
3. Results table with device info
4. One-click add with pre-filled details

**Effort:** 12 hours
**Priority:** MEDIUM (Phase 3 feature)
**Dependencies:** Phase 1 complete, ONVIF cameras in use

---

### Phase 4: Manufacturer Templates (POST-MVP)

**Status:** Planned
**Approach:**
1. Build template library for common manufacturers
2. User selects manufacturer from dropdown
3. Auto-fill default port, stream path, transport
4. User only needs to enter IP and credentials

**Data Structure:**
```typescript
interface CameraTemplate {
  manufacturer: string;
  models?: string[];
  defaultPort: number;
  protocol: 'rtsp' | 'mjpeg';
  streamPathTemplate: string; // e.g., "/Streaming/Channels/{channel}"
  channels: number; // How many streams available
  authRequired: boolean;
  defaultTransport: 'tcp' | 'udp';
  notes?: string;
}

const templates: CameraTemplate[] = [
  {
    manufacturer: 'Hikvision',
    defaultPort: 554,
    protocol: 'rtsp',
    streamPathTemplate: '/Streaming/Channels/101',
    channels: 3,
    authRequired: true,
    defaultTransport: 'tcp',
    notes: 'Use 101 for main stream, 102 for sub-stream'
  },
  // ... more templates
];
```

**UI Flow:**
1. User selects "Add Camera from Template"
2. Dropdown shows manufacturers
3. Form pre-fills based on template
4. User enters IP, credentials, tests connection

**Effort:** 6 hours
**Priority:** LOW (convenience feature)
**Dependencies:** Phase 1 complete

---

## Security Considerations

### Password Encryption
- Use **libsodium** (`sodium-native` npm package)
- Encrypt passwords before storing in database
- Environment variable for encryption key
- Never expose plain passwords in API responses

```javascript
const sodium = require('sodium-native');

function encryptPassword(plainPassword) {
  const key = Buffer.from(process.env.CAMERA_ENCRYPTION_KEY, 'hex');
  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
  sodium.randombytes_buf(nonce);

  const ciphertext = Buffer.alloc(plainPassword.length + sodium.crypto_secretbox_MACBYTES);
  sodium.crypto_secretbox_easy(ciphertext, Buffer.from(plainPassword), nonce, key);

  return Buffer.concat([nonce, ciphertext]).toString('hex');
}

function decryptPassword(encrypted) {
  const key = Buffer.from(process.env.CAMERA_ENCRYPTION_KEY, 'hex');
  const data = Buffer.from(encrypted, 'hex');
  const nonce = data.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = data.slice(sodium.crypto_secretbox_NONCEBYTES);

  const plaintext = Buffer.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES);
  sodium.crypto_secretbox_open_easy(plaintext, ciphertext, nonce, key);

  return plaintext.toString();
}
```

### Network Isolation
- Cameras on same subnet as EscapePlan Pi (10.10.10.0/24)
- No internet access for camera network
- Firewall rules prevent camera-to-camera communication

---

## Testing Strategy

### Unit Tests
- [ ] Port scanner finds open ports
- [ ] URL pattern matching works for each manufacturer
- [ ] Stream validation detects invalid URLs
- [ ] ONVIF probe parses device responses
- [ ] Password encryption/decryption round-trips

### Integration Tests
- [ ] Network scan discovers test camera
- [ ] ONVIF discovery finds ONVIF camera
- [ ] Template auto-fill generates correct URLs
- [ ] Connection test validates real stream

### Manual QA
- [ ] Scan detects cameras on real network
- [ ] Discovery results are accurate
- [ ] One-click add from scan results works
- [ ] Templates work for 5+ manufacturers

---

## Performance Considerations

### Network Scan Optimization
- Parallel port scanning (max 50 concurrent)
- Skip unresponsive IPs after 2-second timeout
- Cache discovered devices for 5 minutes

### Stream Validation
- 5-second timeout for ffprobe
- Queue validation requests (max 3 concurrent)
- Show progress indicator for long scans

---

## Conclusion

**MVP Approach:** Manual entry with robust connection testing (Phase 1) is sufficient for pilot.

**Future Enhancements:**
1. **Phase 2 (Network Scan)** - Best ROI, works for all cameras
2. **Phase 3 (ONVIF Discovery)** - Great UX for ONVIF cameras
3. **Phase 4 (Templates)** - Nice-to-have, low effort

**Recommended Libraries:**
- ✅ `fluent-ffmpeg` - Stream validation (Phase 1)
- ✅ `evilscan` - Network scanning (Phase 2)
- ✅ `node-onvif` - ONVIF discovery (Phase 3)
- ✅ `sodium-native` - Password encryption (Phase 1)

**Next Steps:**
1. Complete Phase 1 camera CRUD + UI (Session 45-47)
2. Research Phase 2 network scan implementation
3. Prototype ONVIF discovery with test cameras
4. Build manufacturer template library

---

**Status:** Research complete, ready for phased implementation
**Owner:** Platform Integration Team
**Last Updated:** 2025-10-01
