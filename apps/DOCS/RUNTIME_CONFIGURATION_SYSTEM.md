# Runtime Configuration & Environment System

**Last Updated:** 2025-10-03
**Status:** Active
**Owner:** Platform Team

## Overview

EscapePlan uses a **zero-configuration** runtime system that automatically detects development vs production environments without requiring `.env` files or `NODE_ENV` environment variables. All configuration is either auto-detected at runtime or stored in the database as editable system settings.

## Table of Contents

1. [Runtime Detection](#runtime-detection)
2. [Path Resolution](#path-resolution)
3. [System Settings (Database)](#system-settings-database)
4. [Environment Variables (Optional Overrides)](#environment-variables-optional-overrides)
5. [Development vs Production](#development-vs-production)
6. [Database Seeding](#database-seeding)
7. [API Integration](#api-integration)
8. [Deployment](#deployment)

---

## Runtime Detection

### Detection Logic

The system automatically detects production vs development mode using **filesystem and process inspection**, not environment variables.

**Location:** `packages/contracts/src/runtime.ts`

```typescript
function detectRuntime(): RuntimeEnvironment {
  const cwd = process.cwd();

  // Check 1: Debian package install location
  const isDebianInstall = cwd.startsWith('/opt/escapeplan') ||
                          cwd.startsWith('/usr/lib/escapeplan');

  // Check 2: Systemd service (systemd always sets INVOCATION_ID)
  const isSystemd = !!process.env.INVOCATION_ID;

  // Check 3: Built code detection
  const hasDistFolder = existsSync(join(cwd, 'dist'));
  const hasSrcFolder = existsSync(join(cwd, 'src'));
  const isBuilt = hasDistFolder && !hasSrcFolder;

  // Production if:
  // - Running from Debian package location
  // - OR running via systemd AND built code
  const isProduction = isDebianInstall || (isSystemd && isBuilt);
  const isDevelopment = !isProduction;

  // Path resolution based on environment...
}
```

### Detection Criteria

**Production Mode Detected When:**
- ✓ Running from `/opt/escapeplan/` or `/usr/lib/escapeplan/` (Debian package)
- ✓ Running via systemd (has `INVOCATION_ID` env var) AND built code exists

**Development Mode Detected When:**
- ✓ None of the production criteria are met
- ✓ Running from source directory with `src/` folder

### Runtime Object

```typescript
export interface RuntimeEnvironment {
  isProduction: boolean;      // true in production
  isDevelopment: boolean;     // true in development
  isPackaged: boolean;        // true if running from .deb
  isSystemd: boolean;         // true if systemd service
  isBuilt: boolean;           // true if dist/ exists, src/ doesn't

  baseDir: string;            // Base data directory
  dataDir: string;            // Database directory
  assetsDir: string;          // Uploaded assets directory
  backupDir: string;          // Backup archives directory
}
```

### Singleton Instance

```typescript
import { runtime } from '@escapeplan/contracts/runtime';

console.log(runtime.isProduction);  // false (in dev)
console.log(runtime.dataDir);       // '/opt/escapeplan/data' (prod)
                                     // or '{cwd}/data' (dev)
```

---

## Path Resolution

### Dynamic Paths (No Hardcoding)

All filesystem paths are resolved dynamically based on runtime detection.

**Location:** `packages/contracts/src/paths.ts`

### Path Functions

```typescript
import {
  getAssetBasePath,
  getDatabasePath,
  getBackupBasePath,
  ensureAssetDirectory,
  ensureBackupDirectory
} from '@escapeplan/contracts/paths';
```

### Path Mapping

| Path Type | Development | Production |
|-----------|-------------|------------|
| **Base** | `{cwd}/data` | `/var/lib/escapeplan` |
| **Database** | `{cwd}/data/escapeplan.db` | `/var/lib/escapeplan/escapeplan.db` |
| **Assets** | `{cwd}/data/assets` | `/var/lib/escapeplan/assets` |
| **Backups** | `{cwd}/data/backups` | `/var/backups/escapeplan` |

### Example Usage

```typescript
import { getDatabasePath } from '@escapeplan/contracts/paths';

const dbPath = getDatabasePath();
// Dev:  /mnt/projects/escapeplan-app/apps/escapeplan-api/data/escapeplan.db
// Prod: /var/lib/escapeplan/escapeplan.db
```

---

## System Settings (Database)

### Overview

Runtime-configurable settings stored in the `system_settings` table. These can be changed via the admin UI without restarting the application.

### Schema

**Table:** `system_settings`

```sql
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'string' | 'number' | 'boolean' | 'json'
  category TEXT NOT NULL,       -- 'storage' | 'backup' | 'updates' | 'system'
  label TEXT NOT NULL,
  description TEXT,
  is_editable INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT REFERENCES user(id)
);
```

### Default Settings

| Key | Value | Type | Category | Editable |
|-----|-------|------|----------|----------|
| `storage.max_image_size_mb` | `10` | number | storage | ✓ |
| `storage.max_audio_size_mb` | `25` | number | storage | ✓ |
| `storage.max_video_size_mb` | `50` | number | storage | ✓ |
| `backup.retention_days` | `7` | number | backup | ✓ |
| `updates.github_repo` | `escapeplan/escapeplan` | string | updates | ✓ |
| `updates.auto_update_enabled` | `true` | boolean | updates | ✓ |
| `system.install_path` | `{cwd}` | string | system | ✗ |
| `system.version` | `0.1.0` | string | system | ✗ |
| `system.build_date` | `{timestamp}` | string | system | ✗ |

### Settings Manager

**Location:** `apps/escapeplan-api/src/settings.ts`

```typescript
import { settings } from './settings.js';

// Initialize (called on server startup)
await settings.init();

// Get settings (type-safe)
const maxSize = settings.getMaxImageSizeMB();  // Returns: number

// Update settings
await settings.set('storage.max_image_size_mb', 20, operatorId);

// Reload from database
await settings.reload();
```

### Convenience Methods

```typescript
settings.getMaxImageSizeMB(): number
settings.getMaxAudioSizeMB(): number
settings.getMaxVideoSizeMB(): number
settings.getBackupRetentionDays(): number
settings.getGithubRepo(): string
settings.isAutoUpdateEnabled(): boolean
```

### Caching

Settings are **loaded once on startup** and cached in memory for performance. To update:

1. User changes setting via API: `PUT /api/admin/settings/:key`
2. Settings manager updates database AND cache
3. No server restart required

---

## Environment Variables (Optional Overrides)

While the system works without any environment variables, you can optionally override defaults:

### Available Overrides

| Variable | Default (Dev) | Default (Prod) | Purpose |
|----------|---------------|----------------|---------|
| `PORT` | `4000` | `4000` | API server port |
| `HOST` | `0.0.0.0` | `0.0.0.0` | Bind address |
| `BASE_URL` | `http://localhost:4000` | `https://escapeplan.local` | API base URL |
| `WEB_APP_ORIGIN` | `http://localhost:5173` | `https://escapeplan.local` | Web app origin |
| `ESCAPEPLAN_DATA_DIR` | `{cwd}/data` | `/var/lib/escapeplan` | Data directory |
| `ESCAPEPLAN_ASSET_DIR` | `{cwd}/data/assets` | `/var/lib/escapeplan/assets` | Asset directory |
| `ESCAPEPLAN_BACKUP_DIR` | `{cwd}/data/backups` | `/var/backups/escapeplan` | Backup directory |
| `BUILD_DATE` | `{current timestamp}` | Set during build | Build timestamp |
| `INVOCATION_ID` | - | Set by systemd | Systemd service indicator |

### Usage (Optional)

```bash
# Override API port (development)
PORT=5000 pnpm dev

# Override data directory (advanced)
ESCAPEPLAN_DATA_DIR=/custom/path pnpm start
```

**Note:** Most deployments should NOT use these. They exist for advanced customization only.

---

## Development vs Production

### Development Mode

**Detected When:**
- Running from source directory
- `src/` folder exists
- NOT running from `/opt/escapeplan/`

**Characteristics:**
- Paths relative to `process.cwd()`
- Database: `./data/escapeplan.db`
- Assets: `./data/assets/`
- Logs to console with debug info
- Auto-reload enabled (`tsx watch`)

**Commands:**
```bash
pnpm dev          # Start dev server with watch
pnpm build        # Build for production
pnpm lint         # Type-check
pnpm test         # Run tests
```

### Production Mode

**Detected When:**
- Running from `/opt/escapeplan/` or `/usr/lib/escapeplan/`
- OR running via systemd with built code (`dist/` exists, `src/` doesn't)

**Characteristics:**
- Absolute paths (`/var/lib/escapeplan/`, `/var/backups/escapeplan/`)
- Database: `/var/lib/escapeplan/escapeplan.db`
- Assets: `/var/lib/escapeplan/assets/`
- Runs as systemd service
- Domain: `https://escapeplan.local` (mDNS)

**Systemd Service:**
```ini
[Unit]
Description=EscapePlan API Server

[Service]
Type=simple
WorkingDirectory=/opt/escapeplan/api
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

**Note:** No `Environment=` directives needed! Runtime auto-detects everything.

---

## Database Seeding

### Drizzle ORM Integration

EscapePlan uses **Drizzle ORM** for type-safe database operations with a push-only schema workflow.

**Config Location:** `apps/escapeplan-api/drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit';
import { getDatabasePath } from '@escapeplan/contracts/paths';

export default defineConfig({
  schema: '../../packages/contracts/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabasePath()  // Auto-resolves based on runtime
  }
});
```

### Schema Location

**Shared Schema:** `packages/contracts/src/schema.ts`

All tables defined here are shared between:
- API (for database operations)
- Web (for type definitions)
- Drizzle Kit (for schema synchronization)

### Schema Change Workflow

```bash
# 1. Edit schema
vim apps/escapeplan-api/src/db/schema.ts

# 2. Rebuild contracts
pnpm --filter @escapeplan/contracts build

# 3. Apply to database (push-only workflow)
cd apps/escapeplan-api && npx drizzle-kit push

# 4. Verify with seed data
pnpm --filter escapeplan-api db:seed
```

**Note:** EscapePlan uses a push-only workflow. No migration files are generated or tracked. Schema changes are applied directly to the database via `drizzle-kit push`.

### System Settings Seeding

**Seed Script:** `apps/escapeplan-api/src/db/seed-settings.ts`

```bash
# Seed default system settings
pnpm db:seed:settings
```

**What it does:**
1. Reads default values from `constants.ts`
2. Inserts into `system_settings` table
3. Uses `onConflictDoNothing()` - won't overwrite existing settings
4. Safe to run multiple times (idempotent)

**Called Automatically:**
The API server calls `seedSystemSettings()` on startup:

```typescript
// apps/escapeplan-api/src/index.ts
if (!skipAutostart && !isTestEnv) {
  const server = await buildServer();

  // Seed default system settings if needed
  await seedSystemSettings();

  // Initialize settings manager
  await initializeSettings();

  await server.listen({ port: DEFAULT_PORT, host: '0.0.0.0' });
}
```

---

## API Integration

### Environment Module

**Location:** `apps/escapeplan-api/src/env.ts`

```typescript
import { env } from './env.js';

console.log(env.isDev);          // true (in development)
console.log(env.isProd);         // false (in development)
console.log(env.baseUrl);        // http://localhost:4000
console.log(env.dataDir);        // /path/to/cwd/data
console.log(env.maxImageSizeMB); // 10 (from constants)
```

### Settings Endpoints

**GET /api/admin/settings**
```typescript
// Returns all settings grouped by category
{
  "settings": {
    "storage": [
      { "key": "storage.max_image_size_mb", "value": 10, ... }
    ],
    "backup": [ ... ],
    "updates": [ ... ],
    "system": [ ... ]
  }
}
```

**PUT /api/admin/settings/:key**
```typescript
// Update a setting
PUT /api/admin/settings/storage.max_image_size_mb
{
  "value": 20
}

// Response
{
  "success": true,
  "key": "storage.max_image_size_mb",
  "value": 20
}
```

**Permissions Required:** `manage_system_health`

### Using Settings in Code

```typescript
import { settings } from './settings.js';

// In API routes
api.post('/upload', async (request, reply) => {
  const maxSize = settings.getMaxImageSizeMB() * 1024 * 1024;

  if (fileSize > maxSize) {
    return reply.status(413).send({
      error: `File too large. Max: ${maxSize / 1024 / 1024}MB`
    });
  }

  // ... upload logic
});
```

---

## Deployment

### .deb Package Structure

```
/opt/escapeplan/
├── api/
│   ├── dist/              # Built JavaScript
│   └── package.json
└── web/
    └── build/             # SvelteKit static output

/var/lib/escapeplan/
├── escapeplan.db          # SQLite database
└── assets/                # Uploaded media

/var/backups/escapeplan/   # Backup archives

/etc/systemd/system/
└── escapeplan-api.service # Systemd unit
```

### Postinstall Script

```bash
#!/bin/bash
# /opt/escapeplan/scripts/postinstall.sh

# Create data directories
mkdir -p /var/lib/escapeplan/assets
mkdir -p /var/backups/escapeplan

# Apply schema (push-only workflow)
# Note: EscapePlan uses direct schema sync via drizzle-kit push
# No migration files are tracked - schema changes are applied directly
cd /opt/escapeplan/api
npx drizzle-kit push --force

# Seed settings (idempotent)
node dist/db/seed-settings.js

# Enable service
systemctl daemon-reload
systemctl enable escapeplan-api.service
systemctl start escapeplan-api.service
```

### Zero-Config Guarantee

**No configuration files required:**
- ❌ No `.env` files
- ❌ No `NODE_ENV` variable
- ❌ No hardcoded paths
- ✅ Everything auto-detected
- ✅ Settings stored in database
- ✅ Paths resolved dynamically

**The `.deb` package is truly plug-and-play.**

---

## Troubleshooting

### Check Runtime Detection

```bash
node -e "import('@escapeplan/contracts/runtime').then(m => {
  console.log('Mode:', m.runtime.isProduction ? 'production' : 'development');
  console.log('Database:', m.runtime.dataDir + '/escapeplan.db');
});"
```

### Verify Settings

```bash
sqlite3 /var/lib/escapeplan/escapeplan.db "SELECT * FROM system_settings;"
```

### Force Reseed Settings

```bash
cd /opt/escapeplan/api
node dist/db/seed-settings.js
```

### Check Environment

```bash
curl http://localhost:4000/api/health | jq '.environment'
```

---

## Related Documentation

### Core System Docs
- **[Database System](./DATABASE_SYSTEM.md)** - SQLite schema, Drizzle ORM, push-only workflow
- **[API Contracts & Schema Management](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)** - Schema changes, Drizzle + Zod patterns
- **[Asset Storage Architecture](./ASSET_STORAGE_ARCHITECTURE.md)** - File uploads, path resolution, storage limits

### Feature-Specific Docs
- **[Network & WiFi System](./NETWORK_WIFI_SYSTEM.md)** - Network configuration (uses runtime paths for config files)
- **[Logging & Alerting System](./LOGGING_ALERTING_SYSTEM.md)** - System logs, alert rules (stored in database)
- **[RBAC System](./RBAC_SYSTEM.md)** - Permissions system (uses database-backed settings)

### Integration Points

#### With Database System
- `system_settings` table stores runtime configuration
- Settings seeded via `seed-settings.ts` on startup
- Schema changes applied automatically in production via `drizzle-kit push`

#### With API Contracts
- Settings schema defined in `packages/contracts/src/schema.ts`
- Settings types exported for type-safe access across API/Web
- Validation via Drizzle schema constraints

#### With Asset Storage
- Asset path resolution uses runtime detection
- File size limits stored in `system_settings` table
- Upload handlers read from settings manager, not env vars

#### With Network System
- Network config files written to runtime-detected paths
- Production uses `/etc/escapeplan/`, dev uses `./config/`
- WiFi settings can reference system settings for defaults

## Code References

- **Runtime Detection:** `packages/contracts/src/runtime.ts`
- **Path Resolution:** `packages/contracts/src/paths.ts`
- **Constants:** `packages/contracts/src/constants.ts`
- **Settings Manager:** `apps/escapeplan-api/src/settings.ts`
- **Settings Types:** `packages/contracts/src/settings-types.ts`
- **Schema Definition:** `packages/contracts/src/schema.ts`
- **Environment Module:** `apps/escapeplan-api/src/env.ts`
- **Drizzle Config:** `apps/escapeplan-api/drizzle.config.ts`

---

**Document Version:** 1.0.0
**Last Reviewed:** 2025-10-03
**Next Review:** 2025-11-03
