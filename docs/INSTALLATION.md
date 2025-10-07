# EscapePlan Installation Guide

This guide covers installation of the EscapePlan application package on systems with the escapeplan-base platform.

## Prerequisites

### Required Base Platform

Before installing the EscapePlan application, you must have the `escapeplan-base` platform installed. This provides all system-level services and configuration.

**Verify base platform is installed:**
```bash
dpkg -l | grep escapeplan-base
```

Expected output:
```
ii  escapeplan-base  1.0.0  arm64  EscapePlan base OS platform
```

If `escapeplan-base` is not installed, you must install the base OS image first. See the `escapeplan-base` repository documentation for installation instructions.

### System Requirements

**Hardware:**
- Raspberry Pi 4 Model B (4GB+ RAM recommended)
- 32GB+ microSD card (Class 10 or better)
- Ethernet or Wi-Fi for initial setup (optional after base OS installation)

**Base OS Platform:**
- `escapeplan-base` (>= 1.0.0) or `escapeplan-platform` virtual package
- Raspberry Pi OS (64-bit) or compatible Debian-based system

**Network:**
- Base OS configures Wi-Fi hotspot (SSID: EscapePlan, 10.10.10.0/24)
- Application accessible at `https://escapeplan.local` via mDNS

## Installation Methods

### Method 1: Package Manager (Recommended)

If you have the `.deb` package file:

```bash
# Download or transfer the package to your system
# Example: escapeplan_0.1.7_arm64.deb

# Install with automatic dependency resolution
sudo apt install ./escapeplan_0.1.7_arm64.deb
```

The package manager will:
1. Verify `escapeplan-base` is installed (>= 1.0.0)
2. Check system dependencies (Node.js >= 22, nginx >= 1.18, SQLite >= 3.34)
3. Install application files to `/opt/escapeplan/`
4. Run post-install scripts to rebuild native modules
5. Enable and start systemd services

### Method 2: Direct dpkg Installation

If dependencies are already satisfied:

```bash
sudo dpkg -i escapeplan_0.1.7_arm64.deb
```

If you encounter dependency errors:
```bash
sudo apt --fix-broken install
```

## Post-Installation Process

### Automatic Steps

The package post-install script (`/opt/escapeplan/scripts/postinst-orchestrator.sh`) automatically performs:

1. **Dependency Validation**: Verifies base OS services are running
2. **Native Module Rebuild**: Recompiles better-sqlite3, sharp, argon2, sodium-native for target architecture
3. **Service Configuration**: Enables systemd units
4. **Health Check**: Validates installation integrity

### What Gets Installed

**Application Files:**
```
/opt/escapeplan/
├── api/                  # Fastify backend
│   ├── dist/            # Compiled JavaScript
│   ├── node_modules/    # Production dependencies
│   └── package.json
├── web/                  # SvelteKit PWA
│   ├── build/           # Static files
│   └── package.json
├── packages/
│   └── contracts/       # Shared types
└── scripts/
    ├── postinst-orchestrator.sh
    ├── pi-post-install.sh
    ├── nginx-configure.sh
    └── health-check.sh
```

**Configuration Files:**
```
/etc/nginx/sites-available/
└── escapeplan.conf      # Reverse proxy configuration

/etc/systemd/system/
└── escapeplan-api.service
```

**Data Directory:**
```
/opt/escapeplan/api/data/
└── escapeplan.db        # SQLite database (created on first run)
```

### Manual Verification

After installation, verify services are running:

```bash
# Check application service status
sudo systemctl status escapeplan-api

# Check nginx reverse proxy
sudo systemctl status nginx

# View recent application logs
sudo journalctl -u escapeplan-api -n 50
```

Expected output for `escapeplan-api`:
```
● escapeplan-api.service - EscapePlan API Server
     Loaded: loaded (/etc/systemd/system/escapeplan-api.service; enabled)
     Active: active (running) since [timestamp]
```

## Post-Installation Configuration

### Initial Setup

1. **Access the application:**
   ```
   https://escapeplan.local
   ```
   (Self-signed TLS certificate - browser will show security warning)

2. **Default credentials:**
   - Username: `admin`
   - Password: `admin`
   (Change immediately after first login)

3. **Database initialization:**
   The API automatically creates the database and runs migrations on first start.

### Optional: Manual Service Management

**Start/stop services:**
```bash
# Stop application
sudo systemctl stop escapeplan-api

# Start application
sudo systemctl start escapeplan-api

# Restart application
sudo systemctl restart escapeplan-api

# Disable auto-start
sudo systemctl disable escapeplan-api
```

**View logs:**
```bash
# Real-time logs
sudo journalctl -u escapeplan-api -f

# Logs since last boot
sudo journalctl -u escapeplan-api -b

# Logs from last hour
sudo journalctl -u escapeplan-api --since "1 hour ago"
```

## Troubleshooting

### Installation Fails: Base Platform Not Found

**Error:**
```
Dependency is not satisfiable: escapeplan-base (>= 1.0.0)
```

**Solution:**
Install `escapeplan-base` first. The application package cannot be installed without the base platform.

### Native Module Compilation Fails

**Error:**
```
Error: Cannot find module 'better-sqlite3'
```

**Solution:**
The post-install script may have failed during native module rebuild. Manually rebuild:

```bash
cd /opt/escapeplan/api
sudo npm rebuild better-sqlite3 sharp argon2 sodium-native --build-from-source
```

**Requirements:**
- `build-essential` (C++ compiler)
- `python3` (for node-gyp)

Install if missing:
```bash
sudo apt install build-essential python3
```

### Service Won't Start

**Check logs:**
```bash
sudo journalctl -u escapeplan-api -n 100
```

**Common issues:**
1. **Port 4000 already in use:**
   ```bash
   sudo lsof -i :4000
   sudo kill -9 <PID>
   sudo systemctl start escapeplan-api
   ```

2. **Database file permissions:**
   ```bash
   sudo chown -R escapeplan:escapeplan /opt/escapeplan/api/data
   sudo systemctl restart escapeplan-api
   ```

3. **Node.js version mismatch:**
   ```bash
   node --version  # Should be >= 22
   ```
   If incorrect, reinstall `escapeplan-base`.

### Cannot Access Web Interface

**Check nginx:**
```bash
sudo systemctl status nginx
sudo nginx -t  # Test configuration syntax
```

**Check DNS resolution:**
```bash
ping escapeplan.local
```

If mDNS not working, use IP address directly:
```
https://10.10.10.1
```

### Database Corruption

**Restore from backup:**
```bash
cd /opt/escapeplan/api
sudo node dist/scripts/restore.js

# Or manually:
sudo cp data/backups/escapeplan-YYYYMMDD-HHMMSS.db data/escapeplan.db
sudo systemctl restart escapeplan-api
```

## Upgrading

### Standard Upgrade Process

1. **Download new package version:**
   ```bash
   # Example: escapeplan_0.2.0_arm64.deb
   ```

2. **Install upgrade:**
   ```bash
   sudo apt install ./escapeplan_0.2.0_arm64.deb
   ```

3. **Package manager handles:**
   - Stop running services
   - Replace application files
   - Rebuild native modules (if needed)
   - Run database migrations
   - Restart services

4. **Verify upgrade:**
   ```bash
   dpkg -l | grep escapeplan
   sudo systemctl status escapeplan-api
   ```

### Rolling Back

If upgrade fails:

```bash
# List available versions
apt list escapeplan --all-versions

# Install previous version
sudo apt install escapeplan=0.1.7
```

Or restore from backup:
```bash
sudo dpkg -i escapeplan_0.1.7_arm64.deb
```

## Uninstallation

### Remove Application (Keep Configuration)

```bash
sudo apt remove escapeplan
```

This removes:
- Application files (`/opt/escapeplan/`)
- systemd service units
- nginx configuration

This preserves:
- Database file (if you manually moved it)
- Log files in `/var/log/`

### Complete Removal (Including Configuration)

```bash
sudo apt purge escapeplan
```

**Note:** This does NOT remove the base OS platform. To fully uninstall:

```bash
# Remove application
sudo apt purge escapeplan

# Remove base platform (optional)
sudo apt purge escapeplan-base
```

## Advanced Configuration

### Custom Database Location

Default: `/opt/escapeplan/api/data/escapeplan.db`

To use custom location:

1. **Edit service file:**
   ```bash
   sudo systemctl edit escapeplan-api
   ```

2. **Add environment variable:**
   ```ini
   [Service]
   Environment="DATABASE_PATH=/custom/path/escapeplan.db"
   ```

3. **Restart service:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart escapeplan-api
   ```

### Custom API Port

Default: 4000

1. **Edit service file:**
   ```bash
   sudo systemctl edit escapeplan-api
   ```

2. **Add environment variable:**
   ```ini
   [Service]
   Environment="PORT=5000"
   ```

3. **Update nginx proxy:**
   ```bash
   sudo nano /etc/nginx/sites-available/escapeplan.conf
   # Change proxy_pass http://localhost:4000 to new port
   ```

4. **Restart services:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart escapeplan-api nginx
   ```

## Development Installation

For local development (not production):

### Clone Repository

```bash
git clone https://github.com/kryptobaseddev/escapeplan-app.git
cd escapeplan-app
```

### Install Dependencies

```bash
# Install pnpm if not present
npm install -g pnpm@10.12.4

# Install workspace dependencies
pnpm install
```

### Build Packages

```bash
# Build all packages (contracts → API → web)
pnpm run build
```

### Start Development Servers

```bash
# Run API + web concurrently
pnpm run dev

# Or run individually:
pnpm --filter escapeplan-api dev
pnpm --filter escapeplan-web dev
```

**Access points:**
- API: `http://localhost:4000`
- Web: `http://localhost:5173`

### Build Debian Package Locally

```bash
# Build .deb package
pnpm run build:deb

# Output: dist/escapeplan_0.1.7_arm64.deb
```

## Security Considerations

1. **Change default credentials immediately** after first login
2. **Self-signed TLS certificate** is used by default - browser will show warnings
3. **Network isolation**: Application runs on isolated 10.10.10.0/24 network
4. **No internet required**: System operates fully offline after installation
5. **File permissions**: Application runs as `escapeplan` system user (created by base OS)

## Support and Documentation

- **Main README**: `/mnt/projects/escape-plan/escapeplan-app/README.md`
- **Architecture guide**: `/mnt/projects/escape-plan/escapeplan-app/CLAUDE.md`
- **Dependencies**: `/mnt/projects/escape-plan/escapeplan-app/docs/DEPENDENCIES.md`
- **Health checks**: Run `/opt/escapeplan/scripts/health-check.sh`
- **Logs**: `sudo journalctl -u escapeplan-api`

## Related Documentation

- Base OS Installation: See `escapeplan-base` repository
- API Reference: See `CLAUDE.md` section "API Surface"
- Database Schema: See `CLAUDE.md` section "Database Layer"
- Real-Time Events: See `CLAUDE.md` section "Real-Time Communication"
