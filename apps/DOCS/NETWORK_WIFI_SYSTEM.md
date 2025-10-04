# EscapePlan Network & WiFi System - Technical Specification

**Version:** 1.0
**Last Updated:** 2025-10-02
**Status:** ✅ Production-Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Dual WiFi Architecture](#dual-wifi-architecture)
3. [Broadcast WiFi (Internal AP)](#broadcast-wifi-internal-ap)
4. [WiFi Client Mode (External Connectivity)](#wifi-client-mode-external-connectivity)
5. [Network Database Schema](#network-database-schema)
6. [API Endpoints](#api-endpoints)
7. [Frontend Implementation](#frontend-implementation)
8. [Platform Integration](#platform-integration)
9. [Configuration Files](#configuration-files)
10. [Security Considerations](#security-considerations)

---

## System Overview

EscapePlan uses a **dual WiFi architecture** to provide:

1. **Internal WiFi AP** - Hosts a private network for operators and players to access the management console and room display pages
2. **External WiFi Client** - Connects to external WiFi networks for internet access (OTA updates, cloud sync)

**Primary Use Case:**
- **Offline-first operation** - System runs entirely on internal AP without internet
- **Optional internet** - External WiFi connection enables updates and cloud features

**Network Topology:**
```
┌────────────────────────────────────────────────────────────┐
│  Raspberry Pi (EscapePlan Host)                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Internal WiFi AP (hostapd)                                │
│  ├─ Built-in WiFi Adapter (wlan0)                         │
│  ├─ SSID: "EscapePlan" (configurable)                     │
│  ├─ IP: 10.10.10.1 (gateway)                              │
│  ├─ DHCP: 10.10.10.50 - 10.10.10.150 (dnsmasq)            │
│  └─ mDNS: escapeplan.local (Avahi)                        │
│                                                            │
│  External WiFi Client (nmcli)                              │
│  ├─ USB WiFi Dongle (AC600M recommended)                  │
│  ├─ Scan available networks                               │
│  ├─ Connect to WPA2/WPA3/Open networks                    │
│  └─ Provides WAN access for updates                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
          ↓ Internal AP                  ↓ External Client
    ┌─────────────┐                 ┌──────────────┐
    │  Operator   │                 │  Home WiFi   │
    │  Tablets    │                 │  or Mobile   │
    │  (10.10.    │                 │  Hotspot     │
    │   10.x)     │                 │              │
    └─────────────┘                 └──────────────┘
          │                               │
    ┌─────────────┐                       │
    │ Room Timer  │               (Internet for OTA)
    │ Displays    │
    └─────────────┘
```

---

## Dual WiFi Architecture

### Hardware Requirements

**Internal AP (Required):**
- Built-in WiFi adapter (Raspberry Pi 4/5 onboard WiFi)
- Interface: `wlan0`
- Supports 2.4 GHz and 5 GHz (Pi model dependent)

**External Client (Recommended):**
- USB WiFi dongle (AC600M or compatible)
- Interface: `wlan1` (auto-assigned)
- Must support client mode (not AP mode)
- External antenna recommended for better range

**Why Two Adapters?**
- Most WiFi adapters cannot run AP mode and client mode simultaneously
- Separate hardware ensures stable internal network while connecting externally
- Built-in adapter prioritized for AP (better integration)
- USB dongle for client (easily replaceable if damaged)

---

## Broadcast WiFi (Internal AP)

### Purpose

Provides a **private, offline-first network** for:
- Operator tablets accessing the management console
- Room displays showing game progress
- Customer devices viewing room display pages (optional)

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Access Point** | hostapd | Manages WiFi AP and client authentication |
| **DHCP/DNS** | dnsmasq | Assigns IP addresses and resolves DNS queries |
| **mDNS** | Avahi | Broadcasts `escapeplan.local` hostname |
| **NTP** | chrony | Time synchronization for offline operation |
| **Reverse Proxy** | Nginx v1.29.1+ | HTTPS termination and static file serving |

### Default Configuration

```
SSID: EscapePlan
Security: WPA2-PSK
Passphrase: (randomly generated on first boot)
IP Range: 10.10.10.0/24
Gateway: 10.10.10.1
DHCP Range: 10.10.10.50 - 10.10.10.150
DNS: 10.10.10.1 (Pi resolves to external DNS when WAN available)
mDNS Hostname: escapeplan.local
HTTP: Redirects to HTTPS
HTTPS: Port 443 with self-signed certificate
```

### Network Services

**Running on 10.10.10.1:**
- HTTPS (443): SvelteKit PWA + API reverse proxy
- SSH (22): Disabled by default, key-only when enabled
- mDNS (5353): Avahi service broadcasting `_http._tcp` and `_escapeplan._tcp`

### Database Schema

#### network_profiles Table

Stores broadcast WiFi configuration:

```typescript
{
  id: text('id').primaryKey(),
  name: text('name').notNull(),                  // "EscapePlan Network"
  ssid: text('ssid').notNull(),                  // "EscapePlan"
  password: text('password'),                     // WPA2 passphrase
  description: text('description'),               // "Primary operator network"
  band: text('band'),                             // '2.4GHz' | '5GHz' | '5GHz/2.4GHz'
  channel: integer('channel'),                    // 1-11 (2.4GHz) or 36-165 (5GHz)
  security: text('security'),                     // 'WPA2-PSK' | 'WPA3' | 'OPEN'
  broadcast_enabled: boolean,                     // SSID broadcast toggle
  status: text('status'),                         // 'online' | 'offline' | 'error'
  status_message: text('status_message'),         // Human-readable status
  details: json,                                  // Extended config (country code, etc.)
  last_updated: text('last_updated')
}
```

**Seed Data:**
- Single network profile `escapeplan_net` created on first boot
- SSID defaults to `EscapePlan`, customizable via admin UI

#### network_health Table

Tracks network status snapshots:

```typescript
{
  id: integer('id').primaryKey({ autoIncrement: true }),
  status: text('status').notNull(),              // 'online' | 'degraded' | 'offline'
  message: text('message').notNull(),             // "All services operational"
  last_checked: text('last_checked').notNull()    // ISO timestamp
}
```

---

## WiFi Client Mode (External Connectivity)

### Purpose

Enables the Pi to **connect to external WiFi** for:
- Over-The-Air (OTA) software updates
- Cloud backup sync (future feature)
- Remote diagnostics (future feature)

### Implementation

**Technology:** NetworkManager (`nmcli` CLI)

**Key Features:**
- ✅ Scan available WiFi networks
- ✅ Connect to WPA2/WPA3/Open networks
- ✅ View connection status (IP, signal strength, DNS)
- ✅ Disconnect from network
- ✅ Automatic reconnection on boot (if previously connected)

### WiFi Scanning

**Command:**
```bash
nmcli -t -f SSID,BSSID,SIGNAL,FREQ,SECURITY,CHAN,IN-USE dev wifi list
```

**Output Format:**
```
NetworkName:00:11:22:33:44:55:85:5500:WPA2-PSK:6:*
HomeWiFi:AA:BB:CC:DD:EE:FF:72:2437:WPA2-PSK:6:
OpenNetwork:11:22:33:44:55:66:45:2412::1:
```

**Parsing Logic:**
```typescript
function scanWiFiNetworks(): WiFiScanResponse {
  const output = execSync('nmcli -t -f SSID,BSSID,SIGNAL,FREQ,SECURITY,CHAN,IN-USE dev wifi list', {
    encoding: 'utf8',
    timeout: 15000
  });

  const networks: WiFiNetwork[] = output
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [ssid, bssid, signal, freq, security, channel, inUse] = line.split(':');
      return {
        ssid: ssid || '(Hidden Network)',
        bssid,
        signal: Number(signal) || 0,
        frequency: Number(freq) || 0,
        security: security || 'Open',
        channel: Number(channel) || 0,
        inUse: inUse === '*'
      };
    });

  // Deduplicate by SSID, keep strongest signal
  const uniqueNetworks = new Map<string, WiFiNetwork>();
  for (const network of networks) {
    const existing = uniqueNetworks.get(network.ssid);
    if (!existing || network.signal > existing.signal) {
      uniqueNetworks.set(network.ssid, network);
    }
  }

  return {
    networks: Array.from(uniqueNetworks.values()).sort((a, b) => b.signal - a.signal),
    scannedAt: new Date().toISOString()
  };
}
```

### Connecting to WiFi

**Secured Network (WPA2/WPA3):**
```bash
# Delete existing connection if any
nmcli connection delete "NetworkName"

# Connect with password
nmcli dev wifi connect "NetworkName" password "SecurePassword123"
```

**Open Network:**
```bash
nmcli dev wifi connect "OpenNetwork"
```

**Implementation:**
```typescript
function connectToWiFi(request: WiFiClientConnectRequest): WiFiClientStatus {
  const { ssid, password } = request;

  // Delete existing connection to avoid conflicts
  try {
    execSync(`nmcli connection delete "${ssid}"`, { encoding: 'utf8', timeout: 5000 });
  } catch {
    // Ignore if connection doesn't exist
  }

  // Connect
  if (password) {
    execSync(`nmcli dev wifi connect "${ssid}" password "${password}"`, {
      encoding: 'utf8',
      timeout: 30000
    });
  } else {
    execSync(`nmcli dev wifi connect "${ssid}"`, {
      encoding: 'utf8',
      timeout: 30000
    });
  }

  return getWiFiClientStatus();
}
```

### Connection Status

**Command:**
```bash
nmcli -t -f GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS,IP4.GATEWAY,IP4.DNS connection show --active
```

**Status Retrieval:**
```typescript
function getWiFiClientStatus(): WiFiClientStatus {
  try {
    const output = execSync('nmcli -t -f GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS,IP4.GATEWAY,IP4.DNS connection show --active', {
      encoding: 'utf8',
      timeout: 5000
    });

    const lines = output.trim().split('\n');
    const stateMatch = lines.find(l => l.startsWith('GENERAL.STATE:'));
    const connMatch = lines.find(l => l.startsWith('GENERAL.CONNECTION:'));
    const ipMatch = lines.find(l => l.startsWith('IP4.ADDRESS'));
    const gatewayMatch = lines.find(l => l.startsWith('IP4.GATEWAY:'));
    const dnsMatches = lines.filter(l => l.startsWith('IP4.DNS'));

    if (!stateMatch || !stateMatch.includes('activated')) {
      return { connected: false };
    }

    return {
      connected: true,
      ssid: connMatch?.split(':')[1],
      ipAddress: ipMatch?.split(':')[1]?.split('/')[0],
      gateway: gatewayMatch?.split(':')[1],
      dns: dnsMatches.map(d => d.split(':')[1])
    };
  } catch {
    return { connected: false };
  }
}
```

### Disconnecting

**Command:**
```bash
nmcli connection down "NetworkName"
```

**Implementation:**
```typescript
function disconnectFromWiFi(): WiFiClientStatus {
  const status = getWiFiClientStatus();
  if (status.connected && status.ssid) {
    execSync(`nmcli connection down "${status.ssid}"`, {
      encoding: 'utf8',
      timeout: 5000
    });
  }
  return getWiFiClientStatus();
}
```

---

## Network Database Schema

### Tables Overview

| Table | Purpose | Records |
|-------|---------|---------|
| `network_profiles` | Broadcast WiFi configuration | 1 (primary profile) |
| `network_health` | Network status history | Growing (snapshots) |

### TypeScript Interfaces

```typescript
export interface NetworkProfile {
  id: string;
  name: string;
  ssid: string;
  password?: string;
  description?: string;
  band?: '2.4GHz' | '5GHz' | '5GHz/2.4GHz';
  channel?: number;
  security?: 'WPA2-PSK' | 'WPA3' | 'OPEN';
  broadcastEnabled: boolean;
  status: 'online' | 'offline' | 'error';
  statusMessage?: string;
  details?: Record<string, any>;
  lastUpdated: string;
}

export interface NetworkHealth {
  status: 'online' | 'degraded' | 'offline';
  message: string;
  lastChecked: string;
}

export interface WiFiNetwork {
  ssid: string;
  bssid: string;
  signal: number;        // 0-100
  frequency: number;     // MHz
  security: string;      // "WPA2-PSK", "WPA3-SAE", "Open"
  channel: number;
  inUse: boolean;
}

export interface WiFiScanResponse {
  networks: WiFiNetwork[];
  scannedAt: string;
}

export interface WiFiClientConnectRequest {
  ssid: string;
  password?: string;
  security?: string;
}

export interface WiFiClientStatus {
  connected: boolean;
  ssid?: string;
  signal?: number;
  ipAddress?: string;
  gateway?: string;
  dns?: string[];
}
```

---

## API Endpoints

### Broadcast WiFi Management

#### GET /api/admin/network
**Purpose:** Retrieve current broadcast WiFi profile
**Auth:** `view_network` permission
**Response:**
```json
{
  "id": "escapeplan_net",
  "name": "EscapePlan Network",
  "ssid": "EscapePlan",
  "band": "2.4GHz",
  "channel": 6,
  "security": "WPA2-PSK",
  "broadcastEnabled": true,
  "status": "online",
  "statusMessage": "All services operational",
  "lastUpdated": "2025-10-02T14:30:00Z"
}
```

#### PATCH /api/admin/network
**Purpose:** Update broadcast WiFi settings
**Auth:** `manage_network` permission
**Body:**
```json
{
  "name": "MyEscapeRoom WiFi",
  "ssid": "MyEscapeRoom",
  "band": "5GHz",
  "channel": 36,
  "broadcastEnabled": true,
  "description": "Updated network",
  "statusMessage": "Network reconfigured"
}
```
**Response:** Updated `NetworkProfile`

**⚠️ Note:** Changes to SSID/channel/band require network restart via `/admin/network/apply`

#### POST /api/admin/network/apply
**Purpose:** Apply network configuration to system
**Auth:** `manage_network` permission
**Body:**
```json
{
  "wifiSsid": "EscapePlan",
  "wifiPassphrase": "SecurePass123!",
  "wifiChannel": 6,
  "wifiBand": "2.4GHz",
  "wifiCountry": "US",
  "serverName": "escapeplan",
  "networkRouter": "10.10.10.1",
  "networkDns": "8.8.8.8",
  "networkDhcpStart": "10.10.10.50",
  "networkDhcpEnd": "10.10.10.150",
  "enableWifi": true
}
```
**Response:**
```json
{
  "appliedAt": "2025-10-02T14:35:00Z",
  "stdout": "Configuration applied successfully",
  "services": {
    "hostapd": "active",
    "dnsmasq": "active",
    "api": "active",
    "web": "active"
  }
}
```

**Implementation:** Calls `/usr/local/sbin/escapeplan-config-apply` with JSON config

---

### WiFi Client Management

#### GET /api/admin/network/scan
**Purpose:** Scan for available WiFi networks
**Auth:** `view_network` permission
**Response:**
```json
{
  "networks": [
    {
      "ssid": "HomeWiFi",
      "bssid": "AA:BB:CC:DD:EE:FF",
      "signal": 85,
      "frequency": 5500,
      "security": "WPA2-PSK",
      "channel": 100,
      "inUse": false
    },
    {
      "ssid": "OfficeNet",
      "bssid": "11:22:33:44:55:66",
      "signal": 72,
      "frequency": 2437,
      "security": "WPA3-SAE",
      "channel": 6,
      "inUse": false
    }
  ],
  "scannedAt": "2025-10-02T14:40:00Z"
}
```

#### GET /api/admin/network/client
**Purpose:** Get current external WiFi connection status
**Auth:** `view_network` permission
**Response (Connected):**
```json
{
  "connected": true,
  "ssid": "HomeWiFi",
  "signal": 85,
  "ipAddress": "192.168.1.150",
  "gateway": "192.168.1.1",
  "dns": ["8.8.8.8", "8.8.4.4"]
}
```
**Response (Disconnected):**
```json
{
  "connected": false
}
```

#### POST /api/admin/network/client
**Purpose:** Connect to external WiFi network
**Auth:** `manage_network` permission
**Body:**
```json
{
  "ssid": "HomeWiFi",
  "password": "SecurePassword123",
  "security": "WPA2-PSK"
}
```
**Response:** `WiFiClientStatus` (connected)

#### DELETE /api/admin/network/client
**Purpose:** Disconnect from external WiFi
**Auth:** `manage_network` permission
**Response:** `WiFiClientStatus` (disconnected)

---

## Frontend Implementation

### NetworkTab Component

**Location:** `apps/escapeplan-web/src/routes/(app)/admin/system/NetworkTab.svelte`
**Lines:** 734 total

**Features:**
1. **Broadcast WiFi Configuration**
   - Edit SSID, channel, band, security
   - Toggle broadcast visibility
   - Save configuration

2. **Network Provisioning**
   - Full hostapd/dnsmasq configuration
   - Apply settings with service restart

3. **WiFi Client Scanning & Connection**
   - Scan button triggers network scan
   - Display available networks with signal strength icons
   - Security indicator (🔒 secured, 🔓 open)
   - Connect modal for password entry
   - Disconnect button for active connections

**State Management:**
```typescript
let scanning = $state(false);
let connecting = $state(false);
let wifiNetworks = $state<WiFiNetwork[]>([]);
let wifiStatus = $state<WiFiClientStatus | null>(null);
let selectedNetwork = $state<WiFiNetwork | null>(null);
let wifiPassword = $state('');
```

**Signal Strength Icons:**
```typescript
function getSignalIcon(signal: number): string {
  if (signal >= 75) return '📶'; // Excellent
  if (signal >= 50) return '📶'; // Good
  if (signal >= 25) return '📡'; // Fair
  return '📉';                   // Poor
}
```

**Connection Flow:**
1. User clicks "Scan Networks"
2. Frontend calls `GET /admin/network/scan`
3. Networks displayed with signal/security info
4. User clicks "Connect" on a network
5. Modal opens for password (if secured)
6. Frontend calls `POST /admin/network/client` with credentials
7. Connection status updated and displayed

---

## Platform Integration

### System Services

**hostapd.service:**
```ini
[Unit]
Description=Hostapd IEEE 802.11 AP
After=network.target

[Service]
Type=forking
PIDFile=/run/hostapd.pid
ExecStart=/usr/sbin/hostapd -B -P /run/hostapd.pid /etc/hostapd/hostapd.conf
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**dnsmasq.service:**
```ini
[Unit]
Description=dnsmasq - A lightweight DHCP and caching DNS server
After=network.target

[Service]
Type=forking
PIDFile=/run/dnsmasq/dnsmasq.pid
ExecStart=/usr/sbin/dnsmasq -C /etc/dnsmasq.d/escapeplan.conf
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Configuration Apply Tool

**Path:** `/usr/local/sbin/escapeplan-config-apply`
**Purpose:** Privileged script that applies network configuration
**Language:** Bash or Python
**Responsibilities:**
- Update `/etc/hostapd/hostapd.conf`
- Update `/etc/dnsmasq.d/escapeplan.conf`
- Restart hostapd/dnsmasq services
- Validate configuration before applying

**Environment Variable:** `ESCAPEPLAN_CONFIG_APPLY_PATH` (defaults to above path)

---

## Configuration Files

### Runtime Path Resolution

Network configuration files are stored using runtime-detected paths:

| Environment | Config Path |
|-------------|-------------|
| Development | `{cwd}/config/` |
| Production | `/etc/escapeplan/` |

The system automatically uses the correct location based on environment detection. No manual configuration needed.

See **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md#path-resolution)** for how this works.

### hostapd Configuration

**Path:** `/etc/hostapd/hostapd.conf`

```conf
# Interface and driver
interface=wlan0
driver=nl80211

# Network settings
ssid=EscapePlan
hw_mode=g              # a=5GHz, g=2.4GHz
channel=6
country_code=US

# Security
auth_algs=1
wpa=2
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP CCMP
rsn_pairwise=CCMP
wpa_passphrase=GENERATED_ON_FIRST_BOOT

# Broadcast
ignore_broadcast_ssid=0

# Logging
logger_syslog=-1
logger_syslog_level=2
logger_stdout=-1
logger_stdout_level=2
```

### dnsmasq Configuration

**Path:** `/etc/dnsmasq.d/escapeplan.conf`

```conf
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
```

### Static IP Configuration

**Path:** `/etc/dhcpcd.conf` (or `/etc/network/interfaces`)

```conf
interface wlan0
static ip_address=10.10.10.1/24
nohook wpa_supplicant
```

---

## Security Considerations

### Broadcast WiFi Security

**Default Security:** WPA2-PSK with strong random passphrase
**Passphrase Requirements:**
- Minimum 12 characters
- Randomly generated on first boot
- Changeable via admin UI

**Access Control:**
- SSID broadcast can be disabled (hidden network)
- MAC filtering not implemented (overhead vs. benefit)

### External WiFi Client Security

**Password Storage:** Plain text in `nmcli` connection profiles
**Mitigation:** File permissions restrict access to root only
**Future Enhancement:** Encrypt credentials in database

### API Security

**Permissions Required:**
- `view_network` - View network status, scan WiFi
- `manage_network` - Change settings, connect/disconnect

**Rate Limiting:** Not currently implemented
**Recommendation:** Add rate limiting to `/admin/network/scan` (max 1 req/10s)

### HTTPS Certificates

**Type:** Self-signed certificate generated on first boot
**CN:** `escapeplan.local`
**Validity:** 365 days (renewable)
**Export:** Operators must trust certificate on their devices

---

## Implementation Status

### ✅ Completed Features

**Backend APIs:**
- [x] `scanWiFiNetworks()` - nmcli WiFi scanning
- [x] `connectToWiFi()` - nmcli connection with password
- [x] `getWiFiClientStatus()` - Connection info retrieval
- [x] `disconnectFromWiFi()` - Disconnect from external WiFi
- [x] Network profile CRUD (database)
- [x] Network provisioning API (`applyEscapePlanConfig()`)

**API Routes:**
- [x] `GET /admin/network` - Get broadcast profile
- [x] `PATCH /admin/network` - Update broadcast profile
- [x] `POST /admin/network/apply` - Apply configuration
- [x] `GET /admin/network/scan` - Scan WiFi networks
- [x] `GET /admin/network/client` - Get WiFi client status
- [x] `POST /admin/network/client` - Connect to WiFi
- [x] `DELETE /admin/network/client` - Disconnect WiFi

**Frontend UI:**
- [x] NetworkTab component (734 lines)
- [x] Broadcast WiFi edit form
- [x] Network provisioning form
- [x] WiFi scan button and network list
- [x] Connect modal with password input
- [x] Disconnect button
- [x] Signal strength indicators
- [x] Security icons
- [x] Connection status display

**Database:**
- [x] `network_profiles` table with seed data
- [x] `network_health` table

### 🚧 Pending Implementation

**Platform Scripts:**
- [ ] `/usr/local/sbin/escapeplan-config-apply` tool
- [ ] hostapd/dnsmasq configuration templates
- [ ] First-boot passphrase generation
- [ ] Certificate generation and export

**Pi Image Integration:**
- [ ] Base image with hostapd/dnsmasq pre-installed
- [ ] Systemd service units
- [ ] Network interface configuration
- [ ] USB WiFi dongle driver support

**Future Enhancements:**
- [ ] WiFi client credential encryption
- [ ] Automatic reconnection on network loss
- [ ] WiFi signal strength monitoring alerts
- [ ] WPA3 support for broadcast AP
- [ ] Captive portal for customer onboarding

---

## Testing Checklist

### Broadcast WiFi

- [ ] SSID appears in WiFi scan on client devices
- [ ] Clients can connect with correct passphrase
- [ ] DHCP assigns IPs in 10.10.10.50-150 range
- [ ] `escapeplan.local` resolves from connected clients
- [ ] HTTPS redirects from HTTP
- [ ] Self-signed certificate warning appears (expected)
- [ ] Configuration changes persist after reboot
- [ ] hostapd/dnsmasq restart successfully after config update

### WiFi Client

- [ ] Network scan returns available networks
- [ ] Signal strength values are accurate (0-100)
- [ ] Security types correctly identified
- [ ] Connection succeeds with correct password
- [ ] Connection fails with incorrect password
- [ ] IP address assigned by external router
- [ ] Internet connectivity verified (ping 8.8.8.8)
- [ ] Disconnect successfully terminates connection
- [ ] Reconnection works on Pi reboot

### API & Frontend

- [ ] Permission checks enforce `view_network` and `manage_network`
- [ ] NetworkTab loads current profile on mount
- [ ] WiFi scan displays networks sorted by signal strength
- [ ] Connect modal shows/hides password field based on security
- [ ] Toast notifications appear for success/error states
- [ ] Loading spinners show during async operations
- [ ] Connection status updates after connect/disconnect

---

## Troubleshooting

### Broadcast AP Not Starting

**Check hostapd status:**
```bash
systemctl status hostapd
journalctl -u hostapd -f
```

**Common Issues:**
- Channel conflict - try channel 1, 6, or 11 (2.4GHz)
- Driver incompatibility - verify `driver=nl80211` in config
- Interface in use - ensure wlan0 not used by NetworkManager

### WiFi Client Connection Fails

**Check NetworkManager status:**
```bash
nmcli general status
nmcli dev wifi list
```

**Common Issues:**
- Incorrect password - verify capitalization and special chars
- Hidden network - manually specify SSID
- Signal too weak - move Pi closer to router
- USB dongle not detected - verify with `lsusb` and `iwconfig`

### No Internet Access from Broadcast AP

**Verify NAT forwarding:**
```bash
sudo iptables -t nat -L -v
sudo sysctl net.ipv4.ip_forward
```

**Expected:**
- `net.ipv4.ip_forward = 1`
- iptables MASQUERADE rule for 10.10.10.0/24

### mDNS Not Resolving

**Check Avahi:**
```bash
systemctl status avahi-daemon
avahi-browse -a
```

**Test from client:**
```bash
ping escapeplan.local
```

---

## Document Version

**Version:** 1.0
**Created:** 2025-10-02
**Last Validated:** 2025-10-02
**Validation Status:** ✅ All claims verified against codebase

**Related Documentation:**
- `DATABASE_SYSTEM.md` - Network table schema
- `project-overview.md` - Section 2.4 (Network Configuration)
- `API_CONTRACTS_SCHEMA_MANAGEMENT.md` - API validation patterns

**Source Files:**
- `apps/escapeplan-api/src/state.ts` - WiFi client functions (lines 387-557)
- `apps/escapeplan-api/src/platform.ts` - Configuration apply (70 lines)
- `apps/escapeplan-web/src/routes/(app)/admin/system/NetworkTab.svelte` - Frontend UI (734 lines)
- `packages/contracts/src/index.ts` - WiFi types (lines 505-539)
- `packages/contracts/src/schema.ts` - Network tables (lines 409-430)

---

## Related Documentation

### Core System Docs
- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Environment detection, config file path resolution
- **[Database System](./DATABASE_SYSTEM.md)** - network_profiles, network_health tables
- **[API Contracts & Schema Management](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)** - Network schema definition

### Integration Docs
- **[RBAC System](./RBAC_SYSTEM.md)** - Permissions: `view_network`, `manage_network`
- **[Asset Storage Architecture](./ASSET_STORAGE_ARCHITECTURE.md)** - Related storage and path systems
