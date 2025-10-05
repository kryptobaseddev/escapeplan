# Raspberry Pi Setup Requirements for EscapePlan

**Version:** 1.0
**Last Updated:** 2025-10-04
**Status:** ✅ Production Requirements

---

## Table of Contents

1. [Overview](#overview)
2. [Hardware Requirements](#hardware-requirements)
3. [Software Prerequisites](#software-prerequisites)
4. [Network Manager Configuration](#network-manager-configuration)
5. [WiFi Interface Setup](#wifi-interface-setup)
6. [Hostapd Configuration](#hostapd-configuration)
7. [NetworkManager + wpa_supplicant Coexistence](#networkmanager--wpa_supplicant-coexistence)
8. [Installation Steps](#installation-steps)
9. [Verification Checklist](#verification-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This document defines the exact system requirements for running EscapePlan on a Raspberry Pi. The system requires a **dual WiFi architecture**:

- **wlan0** (built-in WiFi) - Broadcast AP via `hostapd` for internal network (10.10.10.0/24)
- **wlan1** (USB WiFi dongle) - Client mode via `NetworkManager` for external internet access

The EscapePlan webapp manages wlan1 connections through NetworkManager's `nmcli` CLI tool.

### Quick Requirements Summary

**Hardware:**
- Raspberry Pi 4/5 (4GB+ RAM recommended)
- USB WiFi dongle (AC600M or equivalent)
- 32GB+ microSD card or SSD

**Software Stack:**
- **OS:** Raspberry Pi OS Lite (64-bit, Debian 12 Bookworm)
- **Runtime:** Node.js 22.x + pnpm 10.12.4
- **Network:** hostapd + dnsmasq (wlan0 AP) + NetworkManager (wlan1 client)
- **Web Server:** nginx (reverse proxy + static files)
- **Database:** SQLite (WAL mode)
- **Media:** ffmpeg (RTSP→HLS camera streams)
- **Services:** systemd-managed API, web, backup services
- **DNS:** Avahi (mDNS for `escapeplan.local`)
- **Time:** chrony (offline-first time sync)

**Key Components:**
1. **26 system packages** (see Software Prerequisites)
2. **System user** (`escapeplan` with video/audio groups)
3. **Directory structure** (`/opt/escapeplan`, `/var/lib/escapeplan`, `/etc/escapeplan`)
4. **3 management scripts** (`escapeplan-certgen`, `escapeplan-config-apply`, `escapeplan-platform-init`)
5. **6 systemd services** (api, web, ffmpeg, platform-init, certgen, backup)
6. **Nginx reverse proxy** (API + WebSocket + HLS streams)
7. **SSL certificates** (self-signed for `escapeplan.local`)
8. **NetworkManager config** (wlan0 unmanaged, wlan1 managed)
9. **Hostapd + dnsmasq** (WiFi AP + DHCP/DNS)
10. **IP forwarding** (NAT from wlan0 to wlan1 for internet sharing)

---

## Hardware Requirements

### Raspberry Pi Model
- **Minimum:** Raspberry Pi 4 Model B (4GB RAM)
- **Recommended:** Raspberry Pi 5 (8GB RAM)
- **Storage:** 32GB+ microSD card or SSD

### WiFi Hardware

#### Built-in WiFi (wlan0)
- **Purpose:** Hostapd access point for internal network
- **Interface Name:** `wlan0`
- **Chipset:** Broadcom BCM43455 (Pi 4) or CYW43455 (Pi 5)
- **Bands:** 2.4GHz and 5GHz (dual-band capable)
- **Requirements:**
  - Must support AP mode (hostapd)
  - Must NOT be managed by NetworkManager

#### USB WiFi Dongle (wlan1)
- **Purpose:** Client mode for external WiFi connections
- **Interface Name:** `wlan1` (auto-assigned)
- **Recommended Model:** AC600M USB WiFi Adapter or equivalent
- **Chipset Requirements:**
  - Must support client mode (station mode)
  - Must work with NetworkManager
  - Does NOT need AP mode support
- **Recommended Chipsets:**
  - Realtek RTL8811AU/RTL8812AU (AC600M)
  - MediaTek MT7612U
  - Ralink RT5572
- **Antenna:** External antenna recommended for better range

---

## Software Prerequisites

### Base Operating System
- **OS:** Raspberry Pi OS Lite (64-bit, Debian 12 "Bookworm" based)
- **Kernel:** Linux 6.1+ with wireless driver support
- **Updates:** System must be up-to-date before installation

```bash
sudo apt update && sudo apt upgrade -y
```

### Required System Packages

#### Complete Package List
```bash
sudo apt update && sudo apt upgrade -y

# Install all required packages
sudo apt install -y \
  avahi-daemon \
  ca-certificates \
  chrony \
  curl \
  dnsmasq \
  ffmpeg \
  git \
  gnupg \
  hostapd \
  iptables-persistent \
  iw \
  jq \
  lm-sensors \
  logrotate \
  network-manager \
  nginx \
  openssl \
  python3 \
  python3-pip \
  rsync \
  sqlite3 \
  vim \
  wireless-tools \
  wpasupplicant \
  build-essential
```

**Package Purposes:**
- **avahi-daemon** - mDNS service for `escapeplan.local` hostname resolution
- **chrony** - Time synchronization for offline-first operation
- **dnsmasq** - DHCP/DNS server for internal network (10.10.10.0/24)
- **ffmpeg** - Camera stream transcoding (RTSP→HLS)
- **hostapd** - WiFi access point on wlan0
- **iptables-persistent** - Firewall rules persistence across reboots
- **jq** - JSON parsing for config-apply script
- **lm-sensors** - Hardware monitoring (CPU temp, voltage)
- **logrotate** - Log file management
- **network-manager** - WiFi client management (nmcli)
- **nginx** - Reverse proxy and static file serving
- **sqlite3** - Database CLI tools
- **wpasupplicant** - WPA2/WPA3 WiFi authentication backend

#### Node.js Runtime (v22.x)
```bash
# Install Node.js 22.x LTS (as per base image)
NODE_MAJOR=22
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor | sudo tee /usr/share/keyrings/nodesource.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update
sudo apt install -y nodejs

# Enable corepack and install pnpm
sudo corepack enable
sudo corepack prepare pnpm@10.12.4 --activate

# Disable npm spam
npm config set update-notifier false
npm config set fund false

# Verify installation
node --version  # Should be v22.x.x
pnpm --version  # Should be 10.12.4
```

---

## System User and Directories

### EscapePlan System User

The system runs under a dedicated `escapeplan` user for security:

```bash
# Create system user
sudo useradd --system --create-home --home-dir /opt/escapeplan --shell /usr/sbin/nologin escapeplan

# Add to video/audio groups (for camera/microphone access)
sudo usermod -a -G video,audio escapeplan
```

### Required Directories

```bash
# Create all required directories with correct permissions
sudo install -d -o escapeplan -g escapeplan -m 0755 /opt/escapeplan
sudo install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan
sudo install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan/assets
sudo install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan/hls
sudo install -d -o escapeplan -g escapeplan -m 0750 /var/lib/escapeplan/backups
sudo install -d -o escapeplan -g escapeplan -m 0755 /var/log/escapeplan
sudo install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan
sudo install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan/certs
sudo install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan/templates
```

**Directory Purposes:**
- `/opt/escapeplan/` - Application binaries and code
  - `/opt/escapeplan/api/` - Fastify API server
  - `/opt/escapeplan/web/` - SvelteKit web app
  - `/opt/escapeplan/ffmpeg/` - Camera stream scripts
- `/var/lib/escapeplan/` - Runtime data
  - `/var/lib/escapeplan/assets/` - Uploaded game assets (images, videos)
  - `/var/lib/escapeplan/hls/` - HLS stream segments
  - `/var/lib/escapeplan/backups/` - Database backups (restricted permissions)
- `/var/log/escapeplan/` - Application logs
- `/etc/escapeplan/` - Configuration files
  - `/etc/escapeplan/certs/` - SSL certificates
  - `/etc/escapeplan/templates/` - Config templates

---

## System Management Scripts

### Required Scripts in /usr/local/sbin/

#### 1. escapeplan-platform-init
**Purpose:** First-boot initialization script
**Runs:** Once on first boot via systemd service

**Tasks:**
- Verify directory structure
- Check system requirements
- Initialize platform state

#### 2. escapeplan-certgen
**Purpose:** Generate self-signed SSL certificates
**Path:** `/usr/local/sbin/escapeplan-certgen`

**Generated Certificates:**
- `/etc/escapeplan/certs/escapeplan.local.key` - Private key (4096-bit RSA)
- `/etc/escapeplan/certs/escapeplan.local.crt` - Certificate (825-day validity)
- `/etc/escapeplan/certs/escapeplan.local.pem` - Combined key+cert
- `/etc/escapeplan/certs/escapeplan.local.pfx` - PKCS#12 format (for Windows/mobile)

**Certificate Details:**
- CN: `escapeplan.local`
- SAN: `DNS:escapeplan.local`, `IP:10.10.10.1`
- Validity: 825 days
- PFX Password: `escapeplan` (for exporting to devices)

**Script Content:**
```bash
#!/usr/bin/env bash
set -euo pipefail

CERT_DIR=/etc/escapeplan/certs
KEY_FILE=${CERT_DIR}/escapeplan.local.key
CRT_FILE=${CERT_DIR}/escapeplan.local.crt
PEM_FILE=${CERT_DIR}/escapeplan.local.pem
PFX_FILE=${CERT_DIR}/escapeplan.local.pfx

mkdir -p "$CERT_DIR"
chown escapeplan:escapeplan "$CERT_DIR"
chmod 0750 "$CERT_DIR"

if [ -f "$KEY_FILE" ] && [ -f "$CRT_FILE" ]; then
  exit 0
fi

openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout "$KEY_FILE" \
  -out "$CRT_FILE" \
  -days 825 \
  -subj "/CN=escapeplan.local" \
  -addext "subjectAltName=DNS:escapeplan.local,IP:10.10.10.1" >/dev/null 2>&1

cat "$CRT_FILE" "$KEY_FILE" >"$PEM_FILE"
chmod 0640 "$KEY_FILE" "$CRT_FILE" "$PEM_FILE"
chown escapeplan:escapeplan "$KEY_FILE" "$CRT_FILE" "$PEM_FILE"

openssl pkcs12 -export -out "$PFX_FILE" -inkey "$KEY_FILE" -in "$CRT_FILE" -password pass:escapeplan >/dev/null 2>&1
chmod 0640 "$PFX_FILE"
chown escapeplan:escapeplan "$PFX_FILE"

exit 0
```

**Install:**
```bash
sudo tee /usr/local/sbin/escapeplan-certgen > /dev/null <<'EOF'
[paste script above]
EOF
sudo chmod +x /usr/local/sbin/escapeplan-certgen
```

#### 3. escapeplan-config-apply
**Purpose:** Apply network/nginx/service configuration from JSON
**Path:** `/usr/local/sbin/escapeplan-config-apply`
**Used by:** EscapePlan webapp's Network Provisioning API (`POST /api/admin/network/apply`)

**Features:**
- Validates JSON configuration
- Updates hostapd, dnsmasq, nginx configs
- Restarts services safely
- Validates WiFi passphrase length (8-63 chars)

**Usage:**
```bash
sudo escapeplan-config-apply --config /tmp/config.json
```

**Configuration Schema:**
```json
{
  "wifi": {
    "ssid": "EscapePlan",
    "passphrase": "strongpassphrase",
    "channel": 6,
    "band": "5g",
    "country": "US"
  },
  "network": {
    "router": "10.10.10.1",
    "dns": "10.10.10.1",
    "dhcpRangeStart": "10.10.10.100",
    "dhcpRangeEnd": "10.10.10.199",
    "domain": "escapeplan.local"
  },
  "nginx": {
    "serverName": "escapeplan.local",
    "apiUpstream": "http://127.0.0.1:4000",
    "webRoot": "/opt/escapeplan/web/build/client",
    "webUpstream": "http://127.0.0.1:4173"
  },
  "services": {
    "enableApi": true,
    "enableWeb": true,
    "enableWifi": true
  }
}
```

**Install:** See `/mnt/projects/escape-plan/escapeplan-base/stages/stage2/05-escapeplan-base/files/usr/local/sbin/escapeplan-config-apply`

---

## Systemd Services

### 1. escapeplan-platform-init.service
**Purpose:** First-boot initialization
**Runs:** Once on first boot (Before=multi-user.target)

```ini
[Unit]
Description=EscapePlan Platform Initialization
Before=multi-user.target
ConditionPathExists=!/var/lib/escapeplan/.initialized

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/escapeplan-platform-init
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

### 2. escapeplan-certgen.service
**Purpose:** Generate SSL certificates on first boot
**Runs:** Once (creates certificates if missing)

```ini
[Unit]
Description=EscapePlan SSL Certificate Generation
Before=nginx.service
After=escapeplan-platform-init.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/escapeplan-certgen
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

### 3. escapeplan-api.service
**Purpose:** Fastify API server (port 4000)
**User:** escapeplan
**Working Directory:** `/opt/escapeplan/api`

```ini
[Unit]
Description=EscapePlan Fastify API
After=network.target escapeplan-platform-init.service
ConditionPathExists=/opt/escapeplan/api/systemd/start.sh

[Service]
Type=simple
User=escapeplan
Group=escapeplan
EnvironmentFile=-/etc/escapeplan/api.env
WorkingDirectory=/opt/escapeplan/api
ExecStart=/opt/escapeplan/api/systemd/start.sh
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### 4. escapeplan-web.service
**Purpose:** SvelteKit SSR server (port 4173, proxied by nginx)
**User:** escapeplan
**Working Directory:** `/opt/escapeplan/web`

```ini
[Unit]
Description=EscapePlan Web Frontend
After=escapeplan-api.service
ConditionPathExists=/opt/escapeplan/web/systemd/start.sh

[Service]
Type=simple
User=escapeplan
Group=escapeplan
EnvironmentFile=-/etc/escapeplan/web.env
WorkingDirectory=/opt/escapeplan/web
ExecStart=/opt/escapeplan/web/systemd/start.sh
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### 5. escapeplan-ffmpeg@.service
**Purpose:** Camera stream workers (RTSP→HLS transcoding)
**Template Service:** Instantiated per camera (e.g., `escapeplan-ffmpeg@room1.service`)
**User:** escapeplan

```ini
[Unit]
Description=EscapePlan ffmpeg pipeline for %i
After=network-online.target escapeplan-api.service
Wants=network-online.target
ConditionPathExists=/opt/escapeplan/ffmpeg/%i.conf

[Service]
Type=simple
User=escapeplan
Group=escapeplan
EnvironmentFile=/opt/escapeplan/ffmpeg/%i.conf
ExecStart=/opt/escapeplan/ffmpeg/run.sh %i
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

**Example Camera Config:** `/opt/escapeplan/ffmpeg/room1.conf`
```bash
RTSP_URL=rtsp://admin:password@192.168.1.100:554/stream
HLS_OUTPUT=/var/lib/escapeplan/hls/room1/stream.m3u8
```

### 6. escapeplan-backup.service + .timer
**Purpose:** Automated database backups
**Schedule:** Daily at 3 AM (configurable)

**Timer:**
```ini
[Unit]
Description=EscapePlan Daily Backup Timer

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

**Service:**
```ini
[Unit]
Description=EscapePlan Database Backup
After=escapeplan-api.service

[Service]
Type=oneshot
User=escapeplan
Group=escapeplan
ExecStart=/opt/escapeplan/api/scripts/backup.sh
```

---

## Nginx Configuration

### Main Configuration File
**Path:** `/etc/escapeplan/nginx.conf` (generated by `escapeplan-config-apply`)
**Included by:** `/etc/nginx/sites-enabled/escapeplan` → symlink to `/etc/escapeplan/nginx.conf`

**Template:**
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name escapeplan.local;

    # Static files (SvelteKit build)
    root /opt/escapeplan/web/build/client;
    try_files $uri $uri/ @escapeplan_web;

    # API proxy (WebSocket support)
    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws/ {
        proxy_pass http://127.0.0.1:4000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Fallback to SvelteKit SSR server
    location @escapeplan_web {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # HLS streams
    location /hls/ {
        alias /var/lib/escapeplan/hls/;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
    }
}
```

### HTTPS Configuration (Future Enhancement)
```nginx
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name escapeplan.local;

    ssl_certificate /etc/escapeplan/certs/escapeplan.local.crt;
    ssl_certificate_key /etc/escapeplan/certs/escapeplan.local.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest of config same as HTTP ...
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name escapeplan.local;
    return 301 https://$server_name$request_uri;
}
```

### Enable Nginx Site

```bash
# Create symlink to enable site
sudo ln -sf /etc/escapeplan/nginx.conf /etc/nginx/sites-enabled/escapeplan

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

## Network Manager Configuration

### Why NetworkManager?

The EscapePlan webapp uses **NetworkManager** (`nmcli`) to:
- Scan for available WiFi networks
- Connect to external WiFi (WPA2/WPA3/Open)
- Retrieve connection status (IP, gateway, DNS)
- Disconnect from networks

**Commands used by the webapp:**
```bash
nmcli -t -f SSID,BSSID,SIGNAL,FREQ,SECURITY,CHAN,IN-USE dev wifi list
nmcli dev wifi connect "SSID" password "PASSWORD"
nmcli connection show --active
nmcli connection down "SSID"
```

### NetworkManager Service Status

NetworkManager **must be running** for the webapp to function:

```bash
sudo systemctl status NetworkManager
```

**Expected output:**
```
● NetworkManager.service - Network Manager
   Loaded: loaded (/lib/systemd/system/NetworkManager.service; enabled)
   Active: active (running) since ...
```

If not running:
```bash
sudo systemctl enable NetworkManager
sudo systemctl start NetworkManager
```

### NetworkManager Configuration File

**Path:** `/etc/NetworkManager/NetworkManager.conf`

**Required settings:**
```ini
[main]
plugins=ifupdown,keyfile
dns=dnsmasq

[ifupdown]
managed=false

[device]
# Only manage wlan1 (USB WiFi dongle), NOT wlan0 (internal AP)
wifi.scan-rand-mac-address=no
```

**Critical:** NetworkManager must be configured to **ignore wlan0** to prevent conflicts with hostapd.

---

## WiFi Interface Setup

### Interface Naming
- **wlan0** - Built-in WiFi (managed by hostapd)
- **wlan1** - USB WiFi dongle (managed by NetworkManager)

### Verify Interfaces

```bash
ip link show
```

**Expected output:**
```
1: lo: <LOOPBACK,UP,LOWER_UP> ...
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
3: wlan0: <BROADCAST,MULTICAST> ...  # Built-in WiFi
4: wlan1: <BROADCAST,MULTICAST,UP,LOWER_UP> ...  # USB dongle
```

### Check Interface Capabilities

```bash
# Check wlan0 supports AP mode
iw list | grep -A 10 "Supported interface modes" | grep "AP"

# Check wlan1 is recognized by NetworkManager
nmcli device status
```

**Expected output for wlan1:**
```
DEVICE  TYPE      STATE         CONNECTION
wlan1   wifi      disconnected  --
wlan0   wifi      unmanaged     --
```

**Important:** wlan0 should show `unmanaged` (not controlled by NetworkManager).

---

## Hostapd Configuration

### Purpose
Hostapd creates the internal WiFi access point on wlan0 for the EscapePlan network (10.10.10.0/24).

### Configuration File

**Path:** `/etc/hostapd/hostapd.conf`

```conf
# Interface and driver
interface=wlan0
driver=nl80211

# Network settings
ssid=EscapePlan
hw_mode=g              # a=5GHz, g=2.4GHz, b=2.4GHz legacy
channel=6              # 1-11 for 2.4GHz, 36-165 for 5GHz
country_code=US

# Security (WPA2-PSK)
auth_algs=1
wpa=2
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP CCMP
rsn_pairwise=CCMP
wpa_passphrase=CHANGE_ON_FIRST_BOOT

# Broadcast SSID
ignore_broadcast_ssid=0

# Logging
logger_syslog=-1
logger_syslog_level=2
logger_stdout=-1
logger_stdout_level=2

# Performance tuning
wmm_enabled=1
ieee80211n=1           # Enable 802.11n (WiFi 4)
ht_capab=[HT40+][SHORT-GI-20][SHORT-GI-40][DSSS_CCK-40]
```

### Hostapd Service

**Enable and start:**
```bash
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl start hostapd
```

**Verify:**
```bash
sudo systemctl status hostapd
```

### wlan0 Static IP Configuration

**Path:** `/etc/dhcpcd.conf` or `/etc/network/interfaces`

**dhcpcd.conf method (recommended):**
```conf
# Add to /etc/dhcpcd.conf
interface wlan0
static ip_address=10.10.10.1/24
nohook wpa_supplicant
```

**Restart dhcpcd:**
```bash
sudo systemctl restart dhcpcd
```

### Prevent NetworkManager from Managing wlan0

**Method 1: /etc/NetworkManager/conf.d/unmanaged.conf**
```ini
[keyfile]
unmanaged-devices=interface-name:wlan0
```

**Method 2: MAC address blacklist**
```bash
# Get wlan0 MAC address
ip link show wlan0 | grep link/ether

# Add to /etc/NetworkManager/NetworkManager.conf
[keyfile]
unmanaged-devices=mac:XX:XX:XX:XX:XX:XX
```

**Restart NetworkManager:**
```bash
sudo systemctl restart NetworkManager
```

---

## NetworkManager + wpa_supplicant Coexistence

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Raspberry Pi                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  wlan0 (Built-in WiFi)                             │
│  ├─ Managed by: hostapd                            │
│  ├─ NOT managed by NetworkManager                  │
│  ├─ Static IP: 10.10.10.1/24                       │
│  └─ Purpose: Internal AP                           │
│                                                     │
│  wlan1 (USB WiFi Dongle)                           │
│  ├─ Managed by: NetworkManager                     │
│  ├─ Uses wpa_supplicant backend (automatic)        │
│  ├─ Dynamic IP: DHCP from external router          │
│  └─ Purpose: External WiFi client                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Key Points

1. **NetworkManager controls wpa_supplicant automatically**
   - When you run `nmcli dev wifi connect`, NetworkManager spawns wpa_supplicant for wlan1
   - You do NOT need to manually run `wpa_supplicant` or `wpa_cli`
   - Configuration is handled internally by NetworkManager

2. **wlan0 MUST be excluded from NetworkManager**
   - Otherwise NetworkManager will conflict with hostapd
   - Use the unmanaged-devices configuration above

3. **Two separate network managers coexist:**
   - **hostapd** for wlan0 (AP mode)
   - **NetworkManager** for wlan1 (client mode)

### Verify Correct Setup

```bash
# Check wlan0 is unmanaged
nmcli device status | grep wlan0
# Should show: wlan0  wifi  unmanaged  --

# Check wlan1 is managed
nmcli device status | grep wlan1
# Should show: wlan1  wifi  disconnected  --  (or connected if WiFi active)

# Check hostapd is running
sudo systemctl status hostapd | grep Active
# Should show: Active: active (running)
```

---

## Installation Steps

### Step 1: Install System Packages

```bash
sudo apt update && sudo apt upgrade -y

# Install all required packages
sudo apt install -y \
  avahi-daemon \
  ca-certificates \
  chrony \
  curl \
  dnsmasq \
  ffmpeg \
  git \
  gnupg \
  hostapd \
  iptables-persistent \
  iw \
  jq \
  lm-sensors \
  logrotate \
  network-manager \
  nginx \
  openssl \
  python3 \
  python3-pip \
  rsync \
  sqlite3 \
  vim \
  wireless-tools \
  wpasupplicant \
  build-essential

# Install Node.js 22.x
NODE_MAJOR=22
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor | sudo tee /usr/share/keyrings/nodesource.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update
sudo apt install -y nodejs

# Enable corepack and install pnpm
sudo corepack enable
sudo corepack prepare pnpm@10.12.4 --activate

# Configure npm
npm config set update-notifier false
npm config set fund false
```

### Step 1.5: Create System User and Directories

```bash
# Create escapeplan system user
sudo useradd --system --create-home --home-dir /opt/escapeplan --shell /usr/sbin/nologin escapeplan
sudo usermod -a -G video,audio escapeplan

# Create directory structure
sudo install -d -o escapeplan -g escapeplan -m 0755 /opt/escapeplan
sudo install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan
sudo install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan/assets
sudo install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan/hls
sudo install -d -o escapeplan -g escapeplan -m 0750 /var/lib/escapeplan/backups
sudo install -d -o escapeplan -g escapeplan -m 0755 /var/log/escapeplan
sudo install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan
sudo install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan/certs
sudo install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan/templates
```

### Step 1.75: Install System Scripts

```bash
# Download scripts from escapeplan-base repo or create manually
# See the "System Management Scripts" section above for content

# escapeplan-certgen
sudo tee /usr/local/sbin/escapeplan-certgen > /dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

CERT_DIR=/etc/escapeplan/certs
KEY_FILE=${CERT_DIR}/escapeplan.local.key
CRT_FILE=${CERT_DIR}/escapeplan.local.crt
PEM_FILE=${CERT_DIR}/escapeplan.local.pem
PFX_FILE=${CERT_DIR}/escapeplan.local.pfx

mkdir -p "$CERT_DIR"
chown escapeplan:escapeplan "$CERT_DIR"
chmod 0750 "$CERT_DIR"

if [ -f "$KEY_FILE" ] && [ -f "$CRT_FILE" ]; then
  exit 0
fi

openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout "$KEY_FILE" \
  -out "$CRT_FILE" \
  -days 825 \
  -subj "/CN=escapeplan.local" \
  -addext "subjectAltName=DNS:escapeplan.local,IP:10.10.10.1" >/dev/null 2>&1

cat "$CRT_FILE" "$KEY_FILE" >"$PEM_FILE"
chmod 0640 "$KEY_FILE" "$CRT_FILE" "$PEM_FILE"
chown escapeplan:escapeplan "$KEY_FILE" "$CRT_FILE" "$PEM_FILE"

openssl pkcs12 -export -out "$PFX_FILE" -inkey "$KEY_FILE" -in "$CRT_FILE" -password pass:escapeplan >/dev/null 2>&1
chmod 0640 "$PFX_FILE"
chown escapeplan:escapeplan "$PFX_FILE"

exit 0
EOF

sudo chmod +x /usr/local/sbin/escapeplan-certgen

# Note: escapeplan-config-apply is complex (236 lines)
# Copy from: /mnt/projects/escape-plan/escapeplan-base/stages/stage2/05-escapeplan-base/files/usr/local/sbin/escapeplan-config-apply
# Or it will be included in the .deb package

# Generate certificates now
sudo /usr/local/sbin/escapeplan-certgen
```

### Step 2: Configure NetworkManager to Ignore wlan0

```bash
sudo mkdir -p /etc/NetworkManager/conf.d
sudo tee /etc/NetworkManager/conf.d/unmanaged.conf > /dev/null <<EOF
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF

sudo systemctl restart NetworkManager
```

### Step 3: Configure wlan0 Static IP

```bash
# Add to /etc/dhcpcd.conf
sudo tee -a /etc/dhcpcd.conf > /dev/null <<EOF

# EscapePlan wlan0 static IP
interface wlan0
static ip_address=10.10.10.1/24
nohook wpa_supplicant
EOF

sudo systemctl restart dhcpcd
```

### Step 4: Configure Hostapd

```bash
# Create hostapd config (with placeholder password)
sudo tee /etc/hostapd/hostapd.conf > /dev/null <<EOF
interface=wlan0
driver=nl80211
ssid=EscapePlan
hw_mode=g
channel=6
country_code=US
auth_algs=1
wpa=2
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP CCMP
rsn_pairwise=CCMP
wpa_passphrase=ChangeThisPassword123!
ignore_broadcast_ssid=0
logger_syslog=-1
logger_syslog_level=2
logger_stdout=-1
logger_stdout_level=2
wmm_enabled=1
ieee80211n=1
ht_capab=[HT40+][SHORT-GI-20][SHORT-GI-40][DSSS_CCK-40]
EOF

# Enable hostapd
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl start hostapd
```

### Step 5: Configure dnsmasq (DHCP + DNS)

```bash
sudo mkdir -p /etc/dnsmasq.d

sudo tee /etc/dnsmasq.d/escapeplan.conf > /dev/null <<EOF
# Interface
interface=wlan0
bind-interfaces

# DHCP range
dhcp-range=10.10.10.50,10.10.10.150,24h

# Gateway and DNS
dhcp-option=3,10.10.10.1    # Router
dhcp-option=6,10.10.10.1    # DNS server

# Domain
domain=escapeplan.local
local=/escapeplan.local/

# Authoritative
dhcp-authoritative

# Logging
log-dhcp
log-queries
EOF

sudo systemctl enable dnsmasq
sudo systemctl restart dnsmasq
```

### Step 6: Enable IP Forwarding (for internet sharing)

```bash
# Enable IP forwarding
sudo sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
sudo sysctl -p

# Add iptables NAT rule
sudo iptables -t nat -A POSTROUTING -o wlan1 -j MASQUERADE
sudo iptables -A FORWARD -i wlan1 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i wlan0 -o wlan1 -j ACCEPT

# Save iptables rules
sudo sh -c "iptables-save > /etc/iptables.ipv4.nat"

# Load on boot
sudo tee -a /etc/rc.local > /dev/null <<EOF
iptables-restore < /etc/iptables.ipv4.nat
exit 0
EOF
sudo chmod +x /etc/rc.local
```

### Step 7: Connect wlan1 to External WiFi (First Time)

```bash
# Scan networks
nmcli dev wifi list

# Connect to your home WiFi
nmcli dev wifi connect "YourNetworkName" password "YourPassword"

# Verify connection
nmcli connection show --active
ping -c 3 github.com
```

### Step 8: Configure Nginx

```bash
# Create initial nginx config
sudo tee /etc/escapeplan/nginx.conf > /dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name escapeplan.local;

    root /opt/escapeplan/web/build/client;
    try_files $uri $uri/ @escapeplan_web;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:4000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location @escapeplan_web {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /hls/ {
        alias /var/lib/escapeplan/hls/;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
    }
}
EOF

# Enable site
sudo ln -sf /etc/escapeplan/nginx.conf /etc/nginx/sites-enabled/escapeplan
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart
sudo nginx -t
sudo systemctl enable --now nginx
```

### Step 9: Install EscapePlan .deb Package

```bash
# Download latest release
LATEST_URL=$(curl -s https://api.github.com/repos/kryptobaseddev/escapeplan-app/releases/latest | grep "browser_download_url.*\.deb" | cut -d '"' -f 4)
wget "$LATEST_URL" -O escapeplan.deb

# Verify checksum (optional but recommended)
wget "${LATEST_URL%.deb}_checksums.txt"
sha256sum -c checksums.txt

# Install package
sudo dpkg -i escapeplan.deb
sudo apt-get install -f  # Fix dependencies if needed

# The .deb package automatically:
# - Installs API/Web code to /opt/escapeplan/
# - Installs systemd service files
# - Creates escapeplan user and directories
# - Bundles all node_modules (no npm install required)
# - Does NOT start services (requires configuration first)
```

### Step 9.5: Configure Environment Variables

**IMPORTANT:** The system uses runtime auto-detection for most settings, but you MUST configure these 2 critical secrets:

```bash
# Copy example environment file
sudo cp /opt/escapeplan/api/.env.example /etc/escapeplan/api.env

# Generate required secrets
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" | sudo tee /etc/escapeplan/api.env
echo "CAMERA_ENCRYPTION_KEY=$(openssl rand -hex 32)" | sudo tee -a /etc/escapeplan/api.env

# Secure the file
sudo chmod 600 /etc/escapeplan/api.env
sudo chown escapeplan:escapeplan /etc/escapeplan/api.env

# Verify secrets were generated
sudo cat /etc/escapeplan/api.env
```

**Required Secrets:**
- `BETTER_AUTH_SECRET` - Used to sign JWT tokens and session cookies (32+ characters)
- `CAMERA_ENCRYPTION_KEY` - Used to encrypt camera credentials (64 hex characters)

**Optional Variables:** All other settings (database path, ports, CORS origins, etc.) are auto-detected based on environment. See `/opt/escapeplan/api/.env.example` for full documentation.

### Step 9.75: Start Services

```bash
# Reload systemd to pick up new service files
sudo systemctl daemon-reload

# Start services (they will read /etc/escapeplan/api.env)
sudo systemctl enable --now escapeplan-api.service
sudo systemctl enable --now escapeplan-web.service
sudo systemctl enable --now escapeplan-backup.timer

# Verify services started correctly
sudo systemctl status escapeplan-api
sudo systemctl status escapeplan-web
sudo systemctl status hostapd
sudo systemctl status dnsmasq
sudo systemctl status nginx
sudo systemctl status NetworkManager
```

### Step 10: Final Verification

```bash
# Check all services are running
sudo systemctl status escapeplan-api | grep Active
sudo systemctl status escapeplan-web | grep Active
sudo systemctl status hostapd | grep Active
sudo systemctl status dnsmasq | grep Active
sudo systemctl status nginx | grep Active
sudo systemctl status NetworkManager | grep Active
sudo systemctl status avahi-daemon | grep Active

# Check network interfaces
ip addr show wlan0  # Should have 10.10.10.1
nmcli device status | grep wlan0  # Should show "unmanaged"
nmcli device status | grep wlan1  # Should show managed state

# Check WiFi AP is broadcasting
sudo iw dev wlan0 info | grep ssid

# Check API is responding
curl http://localhost:4000/api/health

# Check database exists
sudo -u escapeplan ls -lh /var/lib/escapeplan/escapeplan.db

# View logs
sudo journalctl -u escapeplan-api -n 50
sudo journalctl -u escapeplan-web -n 50
```

---

## Verification Checklist

### ✅ System Services

```bash
# Check all critical services are running
sudo systemctl status NetworkManager | grep Active
sudo systemctl status hostapd | grep Active
sudo systemctl status dnsmasq | grep Active
sudo systemctl status avahi-daemon | grep Active
sudo systemctl status escapeplan-api | grep Active
```

### ✅ Network Interfaces

```bash
# Verify wlan0 has static IP
ip addr show wlan0 | grep "inet 10.10.10.1"

# Verify wlan1 is managed by NetworkManager
nmcli device status | grep wlan1

# Verify wlan0 is unmanaged
nmcli device status | grep wlan0 | grep unmanaged
```

### ✅ WiFi AP Broadcasting

```bash
# Check if EscapePlan SSID is visible (from another device)
# Scan for WiFi networks on your phone/laptop

# Or check from Pi itself
sudo iw dev wlan0 info | grep ssid
```

### ✅ DHCP Server

```bash
# Connect a device to EscapePlan WiFi
# Check if it gets IP in 10.10.10.50-150 range

# View DHCP leases
cat /var/lib/misc/dnsmasq.leases
```

### ✅ External WiFi Connection

```bash
# Verify wlan1 is connected
nmcli connection show --active | grep wlan1

# Test internet access
ping -c 3 8.8.8.8
ping -c 3 github.com
```

### ✅ EscapePlan API

```bash
# Check API is listening on port 4000
sudo netstat -tulpn | grep :4000

# Test API health endpoint
curl http://localhost:4000/api/health
```

### ✅ mDNS Resolution

```bash
# From a device connected to EscapePlan WiFi:
ping escapeplan.local

# Should resolve to 10.10.10.1
```

---

## Troubleshooting

### Issue: wlan0 shows "managed" in nmcli

**Symptom:**
```bash
nmcli device status
# wlan0  wifi  disconnected  --
```

**Fix:**
```bash
# Add unmanaged rule
sudo tee /etc/NetworkManager/conf.d/unmanaged.conf > /dev/null <<EOF
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF

sudo systemctl restart NetworkManager
```

### Issue: hostapd fails to start

**Check logs:**
```bash
sudo journalctl -u hostapd -f
```

**Common causes:**
- wlan0 is being used by NetworkManager (see above)
- Invalid channel selection
- Country code mismatch

**Fix:**
```bash
# Verify wlan0 is not in use
sudo iw dev wlan0 info

# Try a different channel
sudo nano /etc/hostapd/hostapd.conf
# Change channel=6 to channel=1 or channel=11

sudo systemctl restart hostapd
```

### Issue: wlan1 not connecting to WiFi via nmcli

**Symptom:**
```bash
nmcli dev wifi connect "SSID" password "PASSWORD"
# Error: No suitable device found: no device found for connection 'SSID'.
```

**Check:**
```bash
# Verify wlan1 exists
ip link show wlan1

# Check if NetworkManager sees it
nmcli device status | grep wlan1
```

**Fix:**
```bash
# Bring interface up
sudo ip link set wlan1 up

# Restart NetworkManager
sudo systemctl restart NetworkManager

# Try connecting again
nmcli dev wifi connect "SSID" password "PASSWORD"
```

### Issue: No internet access from devices on EscapePlan WiFi

**Symptom:** Connected to EscapePlan WiFi but cannot access internet

**Check IP forwarding:**
```bash
cat /proc/sys/net/ipv4/ip_forward
# Should return: 1
```

**Check iptables:**
```bash
sudo iptables -t nat -L -v | grep MASQUERADE
# Should show MASQUERADE rule for wlan1
```

**Fix:**
```bash
# Enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1

# Add NAT rules
sudo iptables -t nat -A POSTROUTING -o wlan1 -j MASQUERADE
sudo iptables -A FORWARD -i wlan1 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i wlan0 -o wlan1 -j ACCEPT

# Save rules
sudo sh -c "iptables-save > /etc/iptables.ipv4.nat"
```

### Issue: USB WiFi dongle not recognized (no wlan1)

**Check USB devices:**
```bash
lsusb
# Look for WiFi adapter entry

# Check kernel drivers
dmesg | grep -i wifi
```

**Fix:**
```bash
# Install driver packages
sudo apt install -y firmware-realtek firmware-ralink

# Reboot
sudo reboot
```

### Issue: EscapePlan webapp cannot scan WiFi

**Symptom:** Network tab in webapp shows error when clicking "Scan Networks"

**Check NetworkManager:**
```bash
sudo systemctl status NetworkManager
nmcli device status
```

**Test nmcli manually:**
```bash
nmcli dev wifi list
```

**Fix:**
```bash
# Ensure NetworkManager is running
sudo systemctl enable --now NetworkManager

# Restart API service
sudo systemctl restart escapeplan-api
```

---

## Summary

### Critical Requirements

1. **NetworkManager must be installed and running** - The webapp depends on `nmcli` commands
2. **wlan0 must be unmanaged by NetworkManager** - Prevents conflicts with hostapd
3. **wlan1 must be managed by NetworkManager** - Allows webapp to control external WiFi
4. **hostapd must run on wlan0** - Provides internal AP
5. **dnsmasq must serve DHCP on wlan0** - Assigns IPs to connected clients
6. **IP forwarding must be enabled** - Allows internet sharing from wlan1 to wlan0

### Service Dependencies

```
EscapePlan Webapp (nmcli commands)
  ↓
NetworkManager.service
  ↓
wpa_supplicant (auto-managed)
  ↓
wlan1 (USB WiFi dongle)

---

hostapd.service
  ↓
wlan0 (built-in WiFi)
  ↓
dnsmasq.service (DHCP/DNS)
```

### Configuration Files Summary

| File | Purpose | Critical Settings |
|------|---------|-------------------|
| `/etc/NetworkManager/conf.d/unmanaged.conf` | Exclude wlan0 from NetworkManager | `unmanaged-devices=interface-name:wlan0` |
| `/etc/dhcpcd.conf` | Static IP for wlan0 | `static ip_address=10.10.10.1/24` |
| `/etc/hostapd/hostapd.conf` | WiFi AP configuration | `interface=wlan0`, `ssid=EscapePlan` |
| `/etc/dnsmasq.d/escapeplan.conf` | DHCP/DNS for internal network | `dhcp-range=10.10.10.50,10.10.10.150` |
| `/etc/sysctl.conf` | IP forwarding | `net.ipv4.ip_forward=1` |

---

## Next Steps

After completing this setup:

1. **Verify all services** using the checklist above
2. **Test webapp WiFi management** from the Network tab in admin panel
3. **Connect external devices** to EscapePlan WiFi and verify internet access
4. **Document your specific WiFi credentials** for first-time setup
5. **Create a backup image** of the working SD card

---

## Related Documentation

- **[NETWORK_WIFI_SYSTEM.md](./NETWORK_WIFI_SYSTEM.md)** - Application-level WiFi management
- **[RUNTIME_CONFIGURATION_SYSTEM.md](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Config file path resolution
- **[DATABASE_SYSTEM.md](./DATABASE_SYSTEM.md)** - Network profile database schema

---

**Document Version:** 1.0
**Created:** 2025-10-04
**Validation Status:** ✅ All requirements validated against escapeplan-base repo and NETWORK_WIFI_SYSTEM.md

---

## Installation Time Estimate

**Fresh Raspberry Pi OS installation:**
- System package installation: ~15-30 minutes
- Node.js + pnpm setup: ~5-10 minutes
- User/directory creation: ~2 minutes
- Script installation: ~5 minutes
- Network configuration: ~10-15 minutes
- Nginx setup: ~5 minutes
- EscapePlan .deb installation: ~10-20 minutes
- **Total: 1-2 hours** (depending on internet speed and Pi model)

**Using pre-built escapeplan-base image:**
- Flash image to SD card: ~10-15 minutes
- First boot + initialization: ~5-10 minutes
- EscapePlan .deb installation: ~10-20 minutes
- **Total: 30-45 minutes**

---

## Component Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│  Raspberry Pi OS (Debian 12 Bookworm)                       │
└────────┬────────────────────────────────────────────────────┘
         │
    ┌────▼──────┐
    │  Packages │
    │  (26 pkgs)│
    └────┬──────┘
         │
    ┌────▼──────────────────────────────────────────────┐
    │  System Setup                                     │
    │  - escapeplan user + groups                       │
    │  - Directory structure (/opt, /var/lib, /etc)     │
    │  - Management scripts (/usr/local/sbin)           │
    └────┬──────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────┬─────────────────────┐
    │                             │                     │
┌───▼────────┐          ┌─────────▼──────┐   ┌────────▼──────┐
│  Network   │          │  Web Services  │   │  SSL/mDNS     │
│  ────────  │          │  ─────────────  │   │  ─────────    │
│  wlan0 AP  │          │  nginx (80)    │   │  certgen      │
│  hostapd   │          │  API (4000)    │   │  avahi        │
│  dnsmasq   │          │  Web (4173)    │   │  chrony       │
│  ────────  │          │  ─────────────  │   │  ─────────    │
│  wlan1 CLI │          │  ffmpeg@.svc   │   │               │
│  nmcli     │          │                │   │               │
└────┬───────┘          └─────────┬──────┘   └────────┬──────┘
     │                            │                    │
     └────────────────┬───────────┴────────────────────┘
                      │
            ┌─────────▼──────────┐
            │  EscapePlan .deb   │
            │  ───────────────   │
            │  API + Web code    │
            │  Systemd services  │
            │  Database + seeds  │
            └────────────────────┘
```

---

## Post-Installation Checklist

After completing all installation steps, verify:

### ✅ System Level
- [ ] All 26 packages installed (`dpkg -l | grep -E "hostapd|dnsmasq|nginx|..."`)
- [ ] Node.js 22.x and pnpm 10.12.4 installed
- [ ] `escapeplan` user exists with correct groups (`id escapeplan`)
- [ ] All directories exist with correct permissions (`ls -la /opt/escapeplan /var/lib/escapeplan /etc/escapeplan`)

### ✅ Network Level
- [ ] wlan0 has static IP 10.10.10.1 (`ip addr show wlan0`)
- [ ] wlan0 is unmanaged by NetworkManager (`nmcli dev status | grep wlan0`)
- [ ] wlan1 is managed by NetworkManager (`nmcli dev status | grep wlan1`)
- [ ] EscapePlan WiFi network is visible (scan from phone/laptop)
- [ ] Devices can connect to EscapePlan WiFi and get DHCP IP
- [ ] `escapeplan.local` resolves from connected devices (`ping escapeplan.local`)

### ✅ Service Level
- [ ] hostapd running (`systemctl status hostapd`)
- [ ] dnsmasq running (`systemctl status dnsmasq`)
- [ ] NetworkManager running (`systemctl status NetworkManager`)
- [ ] nginx running (`systemctl status nginx`)
- [ ] avahi-daemon running (`systemctl status avahi-daemon`)
- [ ] escapeplan-api running (`systemctl status escapeplan-api`)
- [ ] escapeplan-web running (`systemctl status escapeplan-web`)
- [ ] escapeplan-backup timer active (`systemctl status escapeplan-backup.timer`)

### ✅ Application Level
- [ ] API responds to health check (`curl http://localhost:4000/api/health`)
- [ ] Database exists (`sudo -u escapeplan ls -lh /var/lib/escapeplan/escapeplan.db`)
- [ ] SSL certificates generated (`ls -la /etc/escapeplan/certs/`)
- [ ] Nginx config valid (`sudo nginx -t`)
- [ ] Web app accessible via browser at `http://escapeplan.local` (from connected device)
- [ ] Default admin login works (`escapeplan/escapeplan`)

### ✅ External WiFi Connection (Optional)
- [ ] Can scan networks via webapp (`nmcli dev wifi list`)
- [ ] Can connect to external WiFi via webapp
- [ ] Internet accessible from Pi when wlan1 connected
- [ ] Devices on wlan0 can access internet through wlan1 (if connected)

---

## Comparison: Manual Setup vs Base Image

| Aspect | Manual Setup | escapeplan-base Image |
|--------|--------------|----------------------|
| **Time** | 1-2 hours | 30-45 minutes |
| **Complexity** | High (10 steps) | Low (flash + install .deb) |
| **Customization** | Full control | Pre-configured defaults |
| **Errors** | More likely (manual config) | Less likely (tested image) |
| **Updates** | Manual package updates | Image rebuild required |
| **Learning** | Understand all components | Faster deployment |
| **Use Case** | Development/testing | Production deployment |

**Recommendation:**
- **Development:** Manual setup (this document)
- **Production:** Use escapeplan-base image + .deb package
- **Troubleshooting:** This document helps debug both approaches
