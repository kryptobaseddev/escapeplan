I'll help you compile a comprehensive list of Reolink cameras organized by connection type and provide information on network discovery methods. Let me search for the current lineup and technical details.Based on my research, here's a comprehensive list of Reolink cameras organized by connection type, along with network discovery methods:

## **REOLINK CAMERAS BY CONNECTION TYPE**

### **1. WIRED (PoE) CAMERAS**
*Power and data via single Ethernet cable*

**Bullet Cameras:**
- RLC-410, RLC-510A, RLC-511, RLC-511WA
- RLC-810A, RLC-811A, RLC-820A, RLC-823A
- RLC-840A, RLC-843A
- RLC-811A (4K budget-friendly option)

**Dome Cameras:**
- RLC-520A, RLC-522, RLC-524A, RLC-820A, RLC-824A

**ColorX Series (Full-color night vision):**
- CX410 (4MP with F1.0 aperture)
- CX810 (8MP with enhanced sensor)

**Dual-Lens Cameras:**
- Duo 2 PoE (8MP dual-lens, 180° view)
- Duo 3 PoE (16MP dual-lens, 180° panorama)
- Duo 3V PoE (16MP IK10 dome with motion tracking)
- Duo Floodlight PoE

**PTZ Cameras:**
- RLC-823S2 (8MP with 16x optical zoom)
- RLC-823A (5x zoom)
- TrackMix PoE (dual-sensor with auto-tracking)
- RLC-830A (auto-tracking pan-tilt)
- RLC-81MA (dual-lens without motorized PTZ)
- E1 Outdoor PoE, E1 Outdoor SE PoE

**Video Doorbells:**
- Video Doorbell PoE

---

### **2. WiFi (AC-POWERED/PLUG-IN) CAMERAS**
*Require WiFi connection + AC power adapter*

**WiFi Cameras:**
- RLC series WiFi variants (510WA, 511WA, 520WA, 840WA, etc.)
- Duo 3 WiFi (16MP with WiFi 6 support)
- Duo 2 WiFi
- Duo Floodlight WiFi
- TrackMix WiFi (dual-lens PTZ with WiFi 6)

**Indoor/Pan-Tilt WiFi:**
- E1, E1 Pro, E1 Zoom
- E1 Outdoor CX (ColorX with auto-tracking)
- Lumus, Lumus Pro

**PTZ WiFi:**
- RLC-823S1W (4K WiFi 6 PTZ with 360° protection)

---

### **3. WiFi/4G (BATTERY-POWERED) CAMERAS**
*100% wire-free with rechargeable batteries*

**Argus Series:**
- Argus 2E (budget option)
- Argus 3 Pro (2K resolution)
- Argus 4 Pro (4K with 180° FOV, ColorX technology)
- Argus 4, Argus Track

**Altas Series (24/7 Continuous Recording):**
- Altas (2K bullet-style with WiFi, 20,000mAh battery)
- Altas Go PT (4G with 360° pan-tilt)
- Altas PT Ultra (4K with continuous recording capability)

**Go Series (4G/LTE):**
- Go, Go PT, Go PT Plus, Go Ranger PT

**Battery Dual-Lens:**
- Duo 2 LTE, Duo 4G
- TrackMix LTE, TrackMix LTE Plus (with 4G connectivity)

**Video Doorbells:**
- Video Doorbell Battery (2K resolution, head-to-toe view)

---

## **NETWORK DISCOVERY METHODS**

### **Default Ports for Reolink Cameras:**

- **Server/Media Port:** 9000 (Reolink Client/App access)
- **HTTP Port:** 80 (web browser access)
- **HTTPS Port:** 443 (secure web access)
- **RTSP Port:** 554 (video streaming - VLC, etc.)
- **ONVIF Port:** 8000 (third-party software integration)
- **RTMP Port:** 1935 (web browser live streaming)

**Important Notes:**
- E1/Lumus cameras do NOT support HTTP/HTTPS/RTMP/RTSP/ONVIF ports
- Battery-powered cameras do not support port configuration
- Some models have RTMP, HTTP, RTSP, and ONVIF ports disabled by default - must enable them first

### **Discovery Methods:**

**1. ONVIF Discovery:**
- Reolink cameras support ONVIF Profile S (video/audio streaming, PTZ control)
- Use ONVIF Device Manager - it automatically discovers ONVIF-compatible devices on the network
- Default ONVIF port is 8000 for discovery

**2. Port Scanning with nmap:**
```bash
# Scan for common Reolink ports
nmap -p 80,554,8000,9000 <IP_RANGE>

# Full port scan for Reolink devices
nmap -p- <IP_RANGE>

# Scan with service detection
nmap -sV -p 80,554,8000,9000 <IP_RANGE>

# Quick host discovery
nmap -sn <IP_RANGE>
```

**3. Using evilscan or similar tools:**
```bash
# Scan specific ports
evilscan --host <IP_RANGE> --port 80,554,8000,9000

# With service banner grabbing
evilscan --host <IP_RANGE> --port 80,554,8000,9000 --banner
```

**4. Router DHCP Table:**
- Check router's DHCP Clients Table or Attached Devices page
- Identify cameras by MAC address

**5. Reolink Client/App:**
- Use Reolink Client's "Scan Device in LAN" feature for automatic discovery

**6. Direct Web Access:**
- Access via HTTP: `http://<IP_ADDRESS>:80`
- Default credentials: username `admin`, password set during initial setup

**7. RTSP Stream Discovery:**
- RTSP URL format: `rtsp://<username>:<password>@<IP>:554/Preview_01_main`

### **Discovery Tips:**
- Ensure ports 80, 443, 554, 1935, 8000, and 9000 are not blocked by firewall
- PoE cameras assigned to NVRs use internal 172.x.x.x addresses
- Battery cameras connect via WiFi using QR code scanning during setup
- Most Reolink cameras respond to ping and TCP port probes

This organization covers cameras from approximately 2020-2025, including the latest models announced at CES 2025.