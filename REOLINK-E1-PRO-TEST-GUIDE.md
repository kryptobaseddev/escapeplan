# Reolink E1 Pro - End-to-End Test Guide

## Camera Specifications

- **Model**: Reolink E1 Pro
- **IP Address**: 10.0.10.138
- **ONVIF Port**: 8000 (confirmed OPEN)
- **RTSP Port**: 554 (confirmed CLOSED - firmware bug)
- **Username**: admin
- **Password**: Farmstar1984!
- **Protocol**: ONVIF (required due to RTSP port issue)

## Prerequisites

1. Ensure you're on the same network as the camera (10.0.10.x subnet)
2. Camera is powered on and connected to network
3. ONVIF service is enabled on camera (should be default)
4. API server is running: `pnpm --filter escapeplan-api dev`

## Test Sequence

### 1. Backend Connection Test (Direct)

Run the automated E2E test script:

```bash
cd /mnt/projects/escape-plan/escapeplan-app
npx tsx test-reolink-e1-pro-e2e.ts
```

**Expected Output:**
- ✅ ONVIF Connection: SUCCESS
- ✅ Password Encryption: SUCCESS
- ✅ Camera Data Structure: SUCCESS
- ✅ Stream Validation: SUCCESS (with resolution and FPS detected)
- ✅ PTZ Controls Validation: SUCCESS
- ✅ Capabilities Check: SUCCESS

**Verify:**
- Connection succeeds with `success: true`
- Resolution detected: `640x360` or `2880x1616`
- Frame rate detected: `15` or `25` fps
- Stream URL extracted (RTSP format with credentials)

### 2. API Endpoint Test (Connection Test)

Test the API connection test endpoint:

```bash
curl -X POST http://localhost:4000/api/admin/cameras/test \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "protocol": "onvif",
    "host": "10.0.10.138",
    "port": 8000,
    "username": "admin",
    "password": "Farmstar1984!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "diagnostics": {
    "reachable": true,
    "authValid": true,
    "streamAvailable": true,
    "resolution": "640x360",
    "frameRate": 15
  }
}
```

### 3. Camera Creation via API

Create the camera in the database:

```bash
curl -X POST http://localhost:4000/api/admin/cameras \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Reolink E1 Pro - Test Room",
    "brand": "reolink",
    "model": "E1 Pro",
    "protocol": "onvif",
    "host": "10.0.10.138",
    "port": 8000,
    "username": "admin",
    "password": "Farmstar1984!",
    "resolution": "720p",
    "frameRate": 15,
    "transport": "tcp",
    "hasPtz": true,
    "hasAudio": true,
    "hasIrControl": true,
    "irMode": "auto",
    "audioVolume": 80,
    "ptzPan": 0,
    "ptzTilt": 0,
    "ptzZoom": 0
  }'
```

**Expected Response:**
- HTTP 201 Created
- Camera object with encrypted password
- All fields saved correctly

### 4. Frontend Form Test (Web UI)

1. **Navigate** to: http://localhost:5173/admin/cameras

2. **Click**: "Add Camera" button

3. **Fill Form**:
   - Name: `Reolink E1 Pro - Test Room`
   - Brand: Select `Reolink`
   - Model: `E1 Pro`
   - Protocol: Select `ONVIF`
     - ⚠️ Verify port auto-changes to `8000`
   - IP Address: `10.0.10.138`
   - Port: `8000` (should auto-fill)
   - Username: `admin`
   - Password: `Farmstar1984!`

4. **Click**: "Test Connection" button

   **Expected**:
   - ✅ Success message displayed
   - Diagnostics shown:
     - Camera reachable: Yes
     - Authentication valid: Yes
     - Stream available: Yes
     - Resolution: 640x360 or 2880x1616
     - Frame rate: 15 or 25 fps

5. **Configure Capabilities**:
   - [x] PTZ Controls (should be checked)
   - [x] Audio (should be checked)
   - [x] IR Control (should be checked)
   - IR Mode: Auto
   - Audio Volume: 80

6. **Click**: "Create Camera"

   **Expected**:
   - Success message
   - Redirect to camera list
   - New camera appears in list

### 5. Database Verification

Check the camera was saved correctly:

```bash
cd /mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api
sqlite3 data/escapeplan.db

# Query the camera
SELECT
  id, name, brand, model, protocol, host, port,
  has_ptz, has_audio, has_ir_control,
  ptz_pan, ptz_tilt, ptz_zoom,
  ir_mode, audio_volume,
  status, hls_streaming
FROM cameras
WHERE name LIKE '%Reolink E1 Pro%';
```

**Expected Results**:
- name: "Reolink E1 Pro - Test Room"
- brand: "reolink"
- model: "E1 Pro"
- protocol: "onvif"
- host: "10.0.10.138"
- port: 8000
- has_ptz: 1
- has_audio: 1
- has_ir_control: 1
- ptz_pan: 0
- ptz_tilt: 0
- ptz_zoom: 0
- ir_mode: "auto"
- audio_volume: 80
- status: "offline" (until streaming starts)
- hls_streaming: 0

**Check password encryption**:
```sql
SELECT password_encrypted FROM cameras WHERE name LIKE '%Reolink E1 Pro%';
```
- Should be hex string (not plaintext password)
- Length should be ~106 characters

### 6. Stream URL Discovery Test

Verify ONVIF discovers the correct stream URL:

```bash
# Run this Node.js snippet to test ONVIF stream discovery
node -e "
const onvif = require('node-onvif');
const device = new onvif.OnvifDevice({
  xaddr: 'http://10.0.10.138:8000/onvif/device_service',
  user: 'admin',
  pass: 'Farmstar1984!'
});

device.init(5000).then(() => {
  return device.getStreamUri({ protocol: 'RTSP' });
}).then(result => {
  console.log('Stream URI:', result.uri);
  console.log('Success!');
}).catch(err => {
  console.error('Error:', err.message);
});
"
```

**Expected Output**:
- Stream URI: `rtsp://...` (should be valid RTSP URL)
- May include credentials in URL or separate

### 7. ffprobe Validation

Test the discovered stream URL with ffprobe:

```bash
# Replace <STREAM_URL> with the URL from step 6
ffprobe -v quiet -print_format json -show_streams -timeout 5000000 "<STREAM_URL>"
```

**Expected Output**:
```json
{
  "streams": [
    {
      "codec_type": "video",
      "codec_name": "h264",
      "width": 640,
      "height": 360,
      "r_frame_rate": "15/1",
      ...
    }
  ]
}
```

### 8. PTZ Controls Test

Test PTZ movement (if camera supports it):

1. **Via Web UI**:
   - Open camera detail page
   - Use PTZ controls (pan/tilt/zoom)
   - Verify camera physically moves

2. **Via API**:
```bash
curl -X PATCH http://localhost:4000/api/admin/cameras/<CAMERA_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "ptzPan": 45,
    "ptzTilt": -15,
    "ptzZoom": 50
  }'
```

**Expected**:
- Camera moves to new position
- Database updated with new PTZ values

## Acceptance Criteria Checklist

- [ ] **ONVIF Connection**: Successfully connects to 10.0.10.138:8000
- [ ] **Authentication**: Credentials validated correctly
- [ ] **Stream Discovery**: RTSP URL extracted from ONVIF
- [ ] **Resolution Detection**: Correct resolution detected (640x360 or 2880x1616)
- [ ] **FPS Detection**: Correct frame rate detected (15 or 25)
- [ ] **Camera Creation**: Camera created via form successfully
- [ ] **Database Persistence**: All fields saved correctly
- [ ] **Password Encryption**: Password encrypted (not plaintext)
- [ ] **PTZ Controls**: PTZ values saved (pan=0, tilt=0, zoom=0)
- [ ] **Capabilities**: hasPtz=true, hasAudio=true, hasIrControl=true
- [ ] **Connection Diagnostics**: Accurate error messages on failure
- [ ] **Form Validation**: Port auto-changes to 8000 for ONVIF

## Common Issues & Solutions

### Issue: EHOSTUNREACH Error
**Cause**: Not on same network as camera
**Solution**: Ensure you're on 10.0.10.x subnet or camera's network

### Issue: Connection Timeout
**Cause**: ONVIF service disabled or wrong port
**Solution**:
- Verify ONVIF is enabled in camera settings
- Confirm port 8000 is open (not 554 due to firmware bug)

### Issue: Authentication Failed
**Cause**: Wrong username/password
**Solution**:
- Verify credentials: admin / Farmstar1984!
- Check camera web interface login works

### Issue: No Stream URI Returned
**Cause**: Camera doesn't support ONVIF GetStreamUri
**Solution**:
- Try different ONVIF profile
- Check camera firmware version
- Verify ONVIF compliance

### Issue: ffprobe Fails on Stream URL
**Cause**: RTSP port 554 closed (known firmware bug)
**Solution**:
- This is expected - ONVIF should work around it
- Stream URL may use different port
- May need firmware update from Reolink

## Test Results Template

```
Date: ___________
Tester: ___________
Environment: Development / Production

TEST RESULTS:
[ ] TEST 1: ONVIF Connection - PASS / FAIL
    Notes: ______________________________

[ ] TEST 2: Camera Creation - PASS / FAIL
    Camera ID: ___________________________
    Notes: ______________________________

[ ] TEST 3: Stream Validation - PASS / FAIL
    Resolution: __________________________
    FPS: _________________________________
    Notes: ______________________________

[ ] TEST 4: Database Persistence - PASS / FAIL
    Notes: ______________________________

[ ] TEST 5: PTZ Controls - PASS / FAIL
    Notes: ______________________________

OVERALL STATUS: PASS / FAIL

Issues Encountered:
_________________________________________
_________________________________________

Recommendations:
_________________________________________
_________________________________________
```

## Next Steps After Testing

1. **If all tests pass**:
   - Mark camera as production-ready
   - Document any quirks or workarounds
   - Test HLS streaming if needed
   - Integrate into game room setup

2. **If tests fail**:
   - Review error messages carefully
   - Check network connectivity
   - Verify camera firmware version
   - Try RTSP direct connection (if port 554 opens)
   - Contact Reolink support if ONVIF issues persist

## Additional Resources

- **Reolink E1 Pro Manual**: Check for ONVIF configuration details
- **ONVIF Device Manager**: Download for desktop ONVIF testing
- **Camera Web Interface**: http://10.0.10.138 (for manual config)
- **Project Docs**: `/mnt/projects/escape-plan/escapeplan-app/project-docs/`
