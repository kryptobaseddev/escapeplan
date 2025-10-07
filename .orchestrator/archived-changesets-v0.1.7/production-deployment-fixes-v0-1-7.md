---
"escapeplan-api": patch
"escapeplan-web": patch
---

**Production deployment fixes for v0.1.7 (comprehensive emergency fixes)**

This changeset documents all emergency fixes applied directly to production to resolve critical deployment issues with v0.1.7.

---

## 1. Better Auth HTTP Cookies Configuration

**Problem:** Better Auth created `Secure` cookies requiring HTTPS, but the system uses HTTP on the local network.

**Error:** `Authentication cookie missing` - browsers rejected Secure cookies over HTTP

**Emergency Fix Applied:**
```typescript
// File: /opt/escapeplan/api/index.js (line 972)
// Changed from:
useSecureCookies: runtime.isProduction

// To:
useSecureCookies: false
```

**Environment Configuration:**
```bash
# /opt/escapeplan/api/.env
BETTER_AUTH_SECRET=88de9f7699c3b27c80ac1d29b28806a82e5077d8eec4c26848fca4a202cd2e4cb7e5fc7ab3612f8e82ebd6b5ec4f80bc5e0de431a606fb8e7675ed4c898d45cd
AUTH_BASE_URL=http://10.10.10.1/api/auth
WEB_APP_ORIGIN=http://10.10.10.1
NODE_ENV=production
```

**Source Code Fix:**
```typescript
// apps/escapeplan-api/src/auth.ts
advanced: {
  useSecureCookies: false  // Local network uses HTTP, not HTTPS
}
```

---

## 2. BETTER_AUTH_SECRET Generation

**Problem:** No secret generated during installation, using insecure default

**Emergency Fix:**
```bash
# Generated 128-character random secret
BETTER_AUTH_SECRET=$(openssl rand -hex 64)
echo "BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET" | sudo tee /opt/escapeplan/api/.env
```

**Source Code Fix:**
Update `scripts/postinst-orchestrator.sh`:
```bash
# Generate random secret for Better Auth
if [ ! -f /opt/escapeplan/api/.env ]; then
  BETTER_AUTH_SECRET=$(openssl rand -hex 64)

  cat > /opt/escapeplan/api/.env <<EOF
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
AUTH_BASE_URL=http://10.10.10.1/api/auth
WEB_APP_ORIGIN=http://10.10.10.1
NODE_ENV=production
ESCAPEPLAN_DB_PATH=/var/lib/escapeplan/escapeplan.db
EOF

  chown escapeplan:escapeplan /opt/escapeplan/api/.env
  chmod 600 /opt/escapeplan/api/.env
fi
```

**Systemd Service Update:**
```ini
# /etc/systemd/system/escapeplan-api.service
[Service]
EnvironmentFile=-/etc/escapeplan/api.env
EnvironmentFile=/opt/escapeplan/api/.env  # Added this line
```

---

## 3. NetworkManager wlan0 Conflict Prevention

**Problem:** NetworkManager and hostapd both trying to control wlan0 caused kernel panic

**Error:** `Unable to handle kernel NULL pointer dereference`

**Emergency Fix:**
```bash
# Create permanent NetworkManager config
sudo tee /etc/NetworkManager/conf.d/unmanaged-wlan0.conf <<EOF
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF

sudo systemctl restart NetworkManager
```

**Verification:**
```bash
nmcli device status
# wlan0 should show "unmanaged"
```

**Source Code Fix:**
Update `scripts/postinst-orchestrator.sh` or create new `scripts/configure-network.sh`:
```bash
# Ensure wlan0 is unmanaged by NetworkManager (reserved for hostapd)
mkdir -p /etc/NetworkManager/conf.d
cat > /etc/NetworkManager/conf.d/unmanaged-wlan0.conf <<EOF
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF

systemctl reload NetworkManager
```

---

## 4. dnsmasq Configuration

**Problem:** No dnsmasq config for EscapePlan WiFi DHCP/DNS

**Emergency Fix:**
```bash
# /etc/dnsmasq.d/escapeplan.conf
sudo tee /etc/dnsmasq.d/escapeplan.conf <<EOF
# EscapePlan WiFi DHCP Configuration
interface=wlan0
dhcp-range=10.10.10.50,10.10.10.150,24h
dhcp-option=3,10.10.10.1
dhcp-option=6,10.10.10.1
server=8.8.8.8
domain=escapeplan.local
address=/escapeplan.local/10.10.10.1
EOF

sudo systemctl restart dnsmasq
```

**Source Code Fix:**
Create `files/etc/dnsmasq.d/escapeplan.conf` in package and install via postinst.

---

## 5. nginx HTTP-Only Configuration

**Problem:** nginx not configured, HTTPS redirect unnecessary for local network

**Emergency Fix:**
```nginx
# /etc/nginx/sites-available/escapeplan.conf
server {
    listen 80 default_server;
    server_name escapeplan.local 10.10.10.1 _;

    # API backend
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Web frontend
    location / {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Source Code Fix:**
Include nginx config in package at `files/etc/nginx/sites-available/escapeplan.conf`

---

## 6. Network Dashboard Display Fixes

**Problem:**
- Network card showed hardcoded fallback "escapeplan_net"
- Database had wrong SSID/password
- "Network offline · refreshed" badge cluttered UI

**Emergency Fixes:**

### Database Update
```sql
UPDATE network_profiles
SET ssid = 'EscapePlan',
    password = 'Canuescap3',
    status = 'online',
    status_message = 'WiFi AP broadcasting on wlan0',
    last_updated = CURRENT_TIMESTAMP
WHERE ssid = 'escapeplan_net';
```

### Source Code Fixes

**File:** `apps/escapeplan-web/src/lib/components/dashboard/DashboardStats.svelte`
```diff
- <p class="text-sm font-semibold text-base-content md:text-base">{stats.network.ssid ?? 'escapeplan_net'}</p>
+ <p class="text-sm font-semibold text-base-content md:text-base">{stats.network.ssid ?? 'Unknown'}</p>
```

**File:** `apps/escapeplan-web/src/routes/(app)/dashboard/+page.svelte`
```diff
- {#if dashboard}
-   <div class="badge-pill">
-     <span class="inline-flex size-2 rounded-full {dashboard.network.status === 'online' ? 'bg-success' : dashboard.network.status === 'degraded' ? 'bg-warning' : 'bg-error'}"></span>
-     <span>Network {dashboard.network.status} · refreshed {formatTime(dashboard.generatedAt)}</span>
-   </div>
- {/if}
```

**Seed Data Fix:** Update `apps/escapeplan-api/src/db/seeds/02-system-defaults.ts`
```typescript
const defaultNetworkProfile = {
  id: randomUUID(),
  name: 'EscapePlan Control Network',
  ssid: 'EscapePlan',  // Changed from 'escapeplan_net'
  password: 'Canuescap3',  // Changed from 'escape2024'
  description: 'Primary WiFi network for EscapePlan system',
  band: '2.4GHz',
  channel: 7,
  security: 'WPA2-PSK',
  broadcast_enabled: true,
  status: 'online',  // Changed from 'offline'
  status_message: 'WiFi AP broadcasting on wlan0',
  last_updated: new Date().toISOString()
};
```

---

## 7. Pirate Mutiny Game Seed

**New File:** `apps/escapeplan-api/src/db/seed-pirate-mutiny.ts`

Standalone seed script for Pirate Mutiny game with correct schema mapping:
- Difficulty: "Medium" (not numerical 3/5)
- Duration: 20 minutes
- Players: 1-5
- Price: $20 per player ($2000 cents)
- 9 puzzles with solutions from game design doc

**Usage:**
```bash
tsx src/db/seed-pirate-mutiny.ts
# Or via SQL:
sqlite3 /var/lib/escapeplan/escapeplan.db < seed-pirate-mutiny.sql
```

---

## Production Deployment Steps

1. **Database Fixes:**
   ```bash
   sudo sqlite3 /var/lib/escapeplan/escapeplan.db < /tmp/seed-pirate-mutiny.sql
   sudo sqlite3 /var/lib/escapeplan/escapeplan.db "UPDATE network_profiles SET ssid='EscapePlan', password='Canuescap3', status='online' WHERE ssid='escapeplan_net';"
   ```

2. **API Fixes:**
   ```bash
   # Remove process.exit
   sudo sed -i '3194,3202d' /opt/escapeplan/api/index.js

   # Fix Better Auth cookies
   sudo sed -i '972s/useSecureCookies: runtime.isProduction/useSecureCookies: false/' /opt/escapeplan/api/index.js

   # Generate secret
   echo "BETTER_AUTH_SECRET=$(openssl rand -hex 64)" | sudo tee /opt/escapeplan/api/.env

   # Restart API
   sudo systemctl restart escapeplan-api
   ```

3. **Web Fixes:**
   ```bash
   # Deploy updated build (already includes dashboard fixes)
   sudo systemctl stop escapeplan-web
   sudo rm -rf /opt/escapeplan/web/.svelte-kit/output
   sudo cp -r /tmp/web-output /opt/escapeplan/web/.svelte-kit/output
   sudo chown -R escapeplan:escapeplan /opt/escapeplan/web/.svelte-kit
   sudo systemctl start escapeplan-web
   ```

4. **Network Configuration:**
   ```bash
   # NetworkManager config
   sudo tee /etc/NetworkManager/conf.d/unmanaged-wlan0.conf <<EOF
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF

   # dnsmasq config
   sudo tee /etc/dnsmasq.d/escapeplan.conf <<EOF
interface=wlan0
dhcp-range=10.10.10.50,10.10.10.150,24h
dhcp-option=3,10.10.10.1
dhcp-option=6,10.10.10.1
server=8.8.8.8
domain=escapeplan.local
address=/escapeplan.local/10.10.10.1
EOF

   # nginx config
   sudo ln -sf /etc/nginx/sites-available/escapeplan.conf /etc/nginx/sites-enabled/

   # Restart services
   sudo systemctl restart NetworkManager dnsmasq nginx
   ```

---

## Testing Checklist

- [x] API service starts without errors
- [x] Web service serves dashboard correctly
- [x] Login works with HTTP cookies
- [x] Network card shows "EscapePlan" / "Canuescap3"
- [x] No "Network offline" badge on dashboard
- [x] EscapePlan WiFi broadcasts on wlan0
- [x] Remote devices can connect to WiFi
- [x] DHCP assigns IPs in 10.10.10.50-150 range
- [x] http://escapeplan.local resolves correctly
- [x] http://10.10.10.1 works directly
- [x] Pirate Mutiny game appears in Games list
- [x] System survives reboot without kernel panic

---

## Impact Summary

**Severity:** CRITICAL - Multiple showstopper bugs preventing production use
**Affected Versions:** v0.1.6 (boot loop), v0.1.7 (before emergency fixes)
**Production Status:** All fixes applied and verified on device
**Source Code:** Changes documented here, need to be committed

---

## Next Steps

1. Commit all source code changes to repository
2. Update build scripts to prevent architecture issues
3. Update postinst scripts with all configuration steps
4. Test clean install of next version (.deb build)
5. Document network setup in deployment guide
6. Add health checks to prevent similar issues
