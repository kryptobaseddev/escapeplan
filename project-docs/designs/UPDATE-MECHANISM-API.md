# UPDATE MECHANISM API - Architecture Design

**Version:** 1.0
**Date:** 2025-10-04
**Status:** Design Phase
**Author:** Claude Code

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [API Endpoints Design](#2-api-endpoints-design)
3. [Update Process Workflow](#3-update-process-workflow)
4. [Backup Integration](#4-backup-integration)
5. [Installation Process](#5-installation-process)
6. [Rollback Mechanism](#6-rollback-mechanism)
7. [Download Management](#7-download-management)
8. [Security Considerations](#8-security-considerations)
9. [Socket.IO Events Design](#9-socketio-events-design)
10. [Database Schema](#10-database-schema)
11. [File System Structure](#11-file-system-structure)
12. [Error Handling Strategy](#12-error-handling-strategy)

---

## 1. System Architecture

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      EscapePlan Update System               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐ │
│  │  Web Client  │◄────►│  Fastify API │◄────►│ Database │ │
│  │  (SvelteKit) │      │  (HTTP/REST) │      │ (SQLite) │ │
│  └──────────────┘      └──────────────┘      └──────────┘ │
│         ▲                      ▲                           │
│         │                      │                           │
│         │              ┌───────┴────────┐                  │
│         │              │                │                  │
│    ┌────▼─────┐   ┌───▼────┐    ┌──────▼──────┐          │
│    │Socket.IO │   │ Backup │    │   GitHub    │          │
│    │  Events  │   │ System │    │  Releases   │          │
│    └──────────┘   └────────┘    │     API     │          │
│                                  └─────────────┘          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              systemd Services Layer                 │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │                                                       │  │
│  │  escapeplan-api.service                             │  │
│  │  escapeplan-updater.service (one-shot)              │  │
│  │  escapeplan-backup.service (pre-update trigger)     │  │
│  │                                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              File System Layer                      │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │                                                       │  │
│  │  /opt/escapeplan/                                    │  │
│  │  /var/lib/escapeplan/                               │  │
│  │  /var/lib/escapeplan/updates/                       │  │
│  │  /var/lib/escapeplan/backups/                       │  │
│  │  /mnt/escapeplan-backup/ (USB)                      │  │
│  │                                                       │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Diagram

```
                         UPDATE FLOW

┌────────────┐         ┌────────────┐         ┌────────────┐
│   CHECK    │────────►│  DOWNLOAD  │────────►│   BACKUP   │
│  (GitHub)  │         │   (.deb)   │         │ (Database) │
└────────────┘         └────────────┘         └────────────┘
                              │                      │
                              ▼                      ▼
                       ┌────────────┐         ┌────────────┐
                       │   VERIFY   │────────►│  INSTALL   │
                       │ (Checksum) │         │   (dpkg)   │
                       └────────────┘         └────────────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │  MIGRATE   │
                                              │ (Drizzle)  │
                                              └────────────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │  RESTART   │
                                              │ (systemd)  │
                                              └────────────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │   VERIFY   │
                                              │  (Health)  │
                                              └────────────┘

                         ROLLBACK FLOW

┌────────────┐         ┌────────────┐         ┌────────────┐
│   DETECT   │────────►│   STOP     │────────►│  RESTORE   │
│  (Failure) │         │ (Services) │         │ (Database) │
└────────────┘         └────────────┘         └────────────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │ REINSTALL  │
                                              │ (Old .deb) │
                                              └────────────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │  RESTART   │
                                              │ (systemd)  │
                                              └────────────┘
```

### 1.3 State Machine

```
                    UPDATE STATE MACHINE

                    ┌──────────┐
                    │   IDLE   │
                    └────┬─────┘
                         │ check_for_updates()
                         ▼
                  ┌──────────────┐
                  │   CHECKING   │
                  └──────┬───────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
     ┌─────────────────┐    ┌─────────────┐
     │ UPDATE_AVAILABLE│    │  UP_TO_DATE │──┐
     └────────┬────────┘    └─────────────┘  │
              │                               │
              │ download_update()             │
              ▼                               │
       ┌──────────────┐                       │
       │ DOWNLOADING  │                       │
       └──────┬───────┘                       │
              │                               │
    ┌─────────┴─────────┐                     │
    │                   │                     │
    ▼                   ▼                     │
┌─────────────┐   ┌──────────────┐            │
│ DOWNLOADED  │   │DOWNLOAD_FAILED│──────┐    │
└──────┬──────┘   └──────────────┘      │    │
       │                                 │    │
       │ verify_checksum()              │    │
       ▼                                 │    │
┌──────────────┐                         │    │
│  VERIFYING   │                         │    │
└──────┬───────┘                         │    │
       │                                 │    │
   ┌───┴────┐                            │    │
   │        │                            │    │
   ▼        ▼                            │    │
┌────────┐ ┌──────────────┐              │    │
│VERIFIED│ │VERIFY_FAILED │──────────────┤    │
└───┬────┘ └──────────────┘              │    │
    │                                     │    │
    │ install_update()                   │    │
    ▼                                     │    │
┌───────────┐                             │    │
│ BACKING_UP│                             │    │
└─────┬─────┘                             │    │
      │                                   │    │
  ┌───┴────┐                              │    │
  │        │                              │    │
  ▼        ▼                              │    │
┌──────┐ ┌─────────────┐                  │    │
│BACKED│ │BACKUP_FAILED│──────────────────┤    │
│_UP   │ └─────────────┘                  │    │
└──┬───┘                                  │    │
   │                                      │    │
   │ install_package()                    │    │
   ▼                                      │    │
┌──────────────┐                          │    │
│ INSTALLING   │                          │    │
└──────┬───────┘                          │    │
       │                                  │    │
   ┌───┴────┐                             │    │
   │        │                             │    │
   ▼        ▼                             │    │
┌─────────┐ ┌──────────────┐              │    │
│INSTALLED│ │INSTALL_FAILED│──────────────┤    │
└────┬────┘ └──────────────┘              │    │
     │                                    │    │
     │ migrate_database()                 │    │
     ▼                                    │    │
┌──────────────┐                          │    │
│  MIGRATING   │                          │    │
└──────┬───────┘                          │    │
       │                                  │    │
   ┌───┴────┐                             │    │
   │        │                             │    │
   ▼        ▼                             │    │
┌────────┐ ┌───────────────┐              │    │
│MIGRATED│ │MIGRATION_FAILED│─────────────┤    │
└───┬────┘ └───────────────┘             │    │
    │                                     │    │
    │ restart_services()                  │    │
    ▼                                     │    │
┌──────────────┐                          │    │
│ RESTARTING   │                          │    │
└──────┬───────┘                          │    │
       │                                  │    │
   ┌───┴────┐                             │    │
   │        │                             │    │
   ▼        ▼                             │    │
┌─────────┐ ┌──────────────┐              │    │
│RESTARTED│ │RESTART_FAILED│──────────────┤    │
└────┬────┘ └──────────────┘              │    │
     │                                    │    │
     │ verify_health()                    │    │
     ▼                                    │    │
┌──────────────┐                          │    │
│  VERIFYING   │                          │    │
│   HEALTH     │                          │    │
└──────┬───────┘                          │    │
       │                                  │    │
   ┌───┴────┐                             │    │
   │        │                             │    │
   ▼        ▼                             │    │
┌──────────┐ ┌─────────────┐              │    │
│ COMPLETE │ │HEALTH_FAILED│──────────────┤    │
└────┬─────┘ └─────────────┘              │    │
     │                                    │    │
     │                                    │    │
     └────────────────────────────────────┘    │
                                               │
                   ┌────────────────────────────┘
                   │
                   ▼
            ┌──────────────┐
            │  ROLLING_BACK│
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   ROLLED_BACK│────► IDLE
            └──────────────┘
```

### 1.4 Failure Recovery Paths

**Automatic Rollback Triggers:**
1. **Download Failed** → Retry with backoff (3 attempts) → Manual intervention
2. **Checksum Mismatch** → Re-download → Manual intervention
3. **Backup Failed** → Abort update → Log error
4. **Installation Failed** → Rollback to previous version
5. **Migration Failed** → Restore database → Reinstall old package
6. **Health Check Failed** → Auto-rollback → Alert admin

**Manual Recovery Options:**
- Force rollback via API endpoint
- Upload `.deb` manually (USB stick)
- Restore from backup manually

---

## 2. API Endpoints Design

### 2.1 GET /api/updates/check

**Purpose:** Check for available updates from GitHub Releases

**Authentication:** Required (Better Auth session)
**Authorization:** `view_system_health` permission
**Rate Limiting:** 1 request per minute per user

**Request:**
```typescript
// No body required
```

**Response (200 OK):**
```typescript
interface UpdateCheckResponse {
  current: string;           // e.g., "0.1.0"
  latest: string;            // e.g., "0.2.0"
  updateAvailable: boolean;
  release: {
    version: string;
    url: string;             // GitHub release page
    notes: string;           // Markdown release notes
    publishedAt: string;     // ISO 8601
    downloadUrl: string;     // Direct .deb download
    checksumSha256: string;  // SHA-256 from release assets
    size: number;            // Bytes
  } | null;
}
```

**Error Responses:**
```typescript
// 503 Service Unavailable
{
  error: {
    code: 'AUTO_UPDATE_DISABLED',
    message: 'Auto-update is disabled in this environment'
  }
}

// 500 Internal Server Error
{
  error: {
    code: 'UPDATE_CHECK_FAILED' | 'GITHUB_API_ERROR',
    message: string,
    details?: {
      statusCode?: number,
      rateLimitReset?: string  // If rate limited
    }
  }
}
```

---

### 2.2 GET /api/updates/version

**Purpose:** Get current version and build metadata

**Authentication:** Required
**Authorization:** Any authenticated user
**Rate Limiting:** None

**Response (200 OK):**
```typescript
interface VersionResponse {
  version: string;           // "0.1.0"
  buildDate: string;         // ISO 8601
  githubRepo: string;        // "org/repo"
  environment: 'production' | 'development';
  commitSha?: string;        // Git commit (if available)
  updateHistory: {
    lastUpdate: string | null;  // ISO 8601
    lastUpdateVersion: string | null;
  };
}
```

---

### 2.3 POST /api/updates/download

**Purpose:** Initiate download of update package

**Authentication:** Required
**Authorization:** `manage_system_health` permission
**Rate Limiting:** 1 active download at a time (global)

**Request:**
```typescript
interface DownloadUpdateRequest {
  version: string;           // Target version to download
  downloadUrl: string;       // GitHub asset URL
  checksumSha256: string;    // Expected checksum
  size: number;              // Expected file size
  source: 'github' | 'manual';  // Download source
}
```

**Response (202 Accepted):**
```typescript
interface DownloadUpdateResponse {
  downloadId: string;        // ULID for tracking
  status: 'queued' | 'downloading';
  version: string;
  estimatedDuration?: number; // Seconds (based on size)
  pollUrl: string;           // `/api/updates/download/${downloadId}`
}
```

**Error Responses:**
```typescript
// 409 Conflict
{
  error: {
    code: 'DOWNLOAD_IN_PROGRESS',
    message: 'Another download is already in progress',
    details: {
      activeDownloadId: string
    }
  }
}

// 400 Bad Request
{
  error: {
    code: 'INVALID_VERSION' | 'INVALID_URL',
    message: string
  }
}
```

---

### 2.4 GET /api/updates/download/:downloadId

**Purpose:** Poll download progress

**Authentication:** Required
**Authorization:** `view_system_health` permission
**Rate Limiting:** None

**Response (200 OK):**
```typescript
interface DownloadStatusResponse {
  downloadId: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  version: string;
  progress: {
    bytesDownloaded: number;
    totalBytes: number;
    percentage: number;      // 0-100
    speedBps: number;        // Bytes per second
    remainingSeconds?: number;
  } | null;
  filePath?: string;         // Available when completed
  checksumVerified?: boolean;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  startedAt?: string;        // ISO 8601
  completedAt?: string;      // ISO 8601
}
```

---

### 2.5 POST /api/updates/install

**Purpose:** Begin update installation process

**Authentication:** Required
**Authorization:** `manage_system_health` permission
**Rate Limiting:** 1 installation at a time (global)

**Request:**
```typescript
interface InstallUpdateRequest {
  downloadId: string;        // From download endpoint
  backupIncludes: {
    database: boolean;
    games: boolean;
    assets: boolean;
    logs: boolean;
  };
  waitForCompletion?: boolean;  // If true, wait for active sessions
  maxWaitMinutes?: number;      // Default: 30
  skipMigrations?: boolean;     // Default: false (dangerous)
}
```

**Response (202 Accepted):**
```typescript
interface InstallUpdateResponse {
  installId: string;         // ULID for tracking
  status: 'pending_backup' | 'backing_up' | 'ready_to_install';
  version: string;
  backupId?: string;         // Created backup ID
  estimatedDuration?: number; // Seconds
  pollUrl: string;           // `/api/updates/install/${installId}`
  activeSessions?: number;   // If waiting for sessions
  waitingUntil?: string;     // ISO 8601
}
```

**Error Responses:**
```typescript
// 409 Conflict
{
  error: {
    code: 'INSTALLATION_IN_PROGRESS' | 'ACTIVE_SESSIONS',
    message: string,
    details: {
      activeInstallId?: string,
      activeSessions?: number,
      sessionIds?: string[]
    }
  }
}

// 404 Not Found
{
  error: {
    code: 'DOWNLOAD_NOT_FOUND',
    message: 'Download not found or expired'
  }
}
```

---

### 2.6 GET /api/updates/install/:installId

**Purpose:** Poll installation progress

**Authentication:** Required
**Authorization:** `view_system_health` permission
**Rate Limiting:** None

**Response (200 OK):**
```typescript
interface InstallStatusResponse {
  installId: string;
  status: 'pending_backup' | 'backing_up' | 'backed_up' |
          'installing' | 'migrating' | 'restarting' |
          'verifying' | 'completed' | 'failed' | 'rolled_back';
  version: string;
  currentStage: {
    name: string;            // Human-readable stage name
    percentage: number;      // Stage progress 0-100
    message?: string;        // Status message
  };
  backupId?: string;
  migrationLogs?: string[];  // Drizzle migration output
  healthCheckResult?: {
    healthy: boolean;
    checks: {
      database: boolean;
      api: boolean;
      webApp: boolean;
    };
  };
  error?: {
    code: string;
    message: string;
    stage: string;           // Where it failed
    rollbackTriggered: boolean;
  };
  startedAt?: string;
  completedAt?: string;
  duration?: number;         // Seconds
}
```

---

### 2.7 POST /api/updates/rollback

**Purpose:** Manually trigger rollback to previous version

**Authentication:** Required
**Authorization:** `manage_system_health` permission
**Rate Limiting:** None

**Request:**
```typescript
interface RollbackRequest {
  installId?: string;        // Optional: rollback specific install
  targetVersion?: string;    // Optional: rollback to specific version
  restoreBackup: boolean;    // Restore database from backup
  backupId?: string;         // Specific backup to restore (optional)
  reason?: string;           // Optional: reason for rollback
}
```

**Response (202 Accepted):**
```typescript
interface RollbackResponse {
  rollbackId: string;        // ULID for tracking
  status: 'stopping_services' | 'restoring_database' |
          'reinstalling' | 'restarting';
  fromVersion: string;
  toVersion: string;
  backupId?: string;
  pollUrl: string;
}
```

**Error Responses:**
```typescript
// 404 Not Found
{
  error: {
    code: 'NO_PREVIOUS_VERSION' | 'BACKUP_NOT_FOUND',
    message: string
  }
}

// 409 Conflict
{
  error: {
    code: 'ROLLBACK_IN_PROGRESS',
    message: string,
    details: {
      activeRollbackId: string
    }
  }
}
```

---

### 2.8 POST /api/updates/upload

**Purpose:** Upload `.deb` package manually (USB/offline scenario)

**Authentication:** Required
**Authorization:** `manage_system_health` permission
**Rate Limiting:** 1 upload per 5 minutes

**Request (multipart/form-data):**
```typescript
interface ManualUploadRequest {
  file: File;                // .deb package
  checksumSha256: string;    // Expected checksum
  version: string;           // Package version
}
```

**Response (200 OK):**
```typescript
interface ManualUploadResponse {
  downloadId: string;        // Treat as downloaded
  version: string;
  filePath: string;
  checksumVerified: boolean;
  size: number;
  uploadedAt: string;
  readyToInstall: boolean;
}
```

**Error Responses:**
```typescript
// 400 Bad Request
{
  error: {
    code: 'INVALID_FILE_TYPE' | 'CHECKSUM_MISMATCH' | 'FILE_TOO_LARGE',
    message: string,
    details?: {
      expectedChecksum?: string,
      actualChecksum?: string,
      maxSizeMB?: number
    }
  }
}

// 413 Payload Too Large
{
  error: {
    code: 'FILE_TOO_LARGE',
    message: 'Package file exceeds maximum size',
    details: {
      maxSizeMB: 500
    }
  }
}
```

---

### 2.9 GET /api/updates/history

**Purpose:** Retrieve update history

**Authentication:** Required
**Authorization:** `view_system_health` permission
**Rate Limiting:** None

**Query Parameters:**
```typescript
interface UpdateHistoryQuery {
  limit?: number;            // Default: 20, Max: 100
  offset?: number;           // Default: 0
  status?: 'completed' | 'failed' | 'rolled_back';
}
```

**Response (200 OK):**
```typescript
interface UpdateHistoryResponse {
  updates: {
    id: string;
    fromVersion: string;
    toVersion: string;
    status: 'completed' | 'failed' | 'rolled_back';
    type: 'automatic' | 'manual' | 'manual_upload';
    backupId?: string;
    downloadId?: string;
    installId?: string;
    rollbackId?: string;
    error?: string;
    initiatedBy: string;     // User ID
    initiatedAt: string;
    completedAt?: string;
    duration?: number;        // Seconds
  }[];
  total: number;
  limit: number;
  offset: number;
}
```

---

### 2.10 GET /api/updates/backups

**Purpose:** List backups associated with updates

**Authentication:** Required
**Authorization:** `view_storage` permission
**Rate Limiting:** None

**Query Parameters:**
```typescript
interface UpdateBackupsQuery {
  type?: 'pre-update' | 'manual' | 'scheduled';
  limit?: number;            // Default: 20
  offset?: number;           // Default: 0
}
```

**Response (200 OK):**
```typescript
interface UpdateBackupsResponse {
  backups: {
    id: string;
    type: 'pre-update' | 'manual' | 'scheduled';
    status: 'completed' | 'failed';
    version?: string;        // Associated update version
    filePath: string;
    fileSizeBytes: number;
    includes: {
      database: boolean;
      games: boolean;
      assets: boolean;
      logs: boolean;
    };
    checksumSha256: string;
    createdBy: string;
    createdAt: string;
    expiresAt?: string;      // 24h retention for update backups
  }[];
  total: number;
}
```

---

## 3. Update Process Workflow

### 3.1 Step-by-Step Update Stages

**Stage 1: Check for Updates**
- API calls GitHub Releases API
- Compare semantic versions
- Cache result for 5 minutes
- Return update metadata if available

**Stage 2: Download Package**
- Create download record in database
- Download `.deb` from GitHub/manual upload
- Stream to `/var/lib/escapeplan/updates/`
- Track progress (bytes downloaded, speed)
- Emit Socket.IO events every 1 second

**Stage 3: Verify Package**
- Calculate SHA-256 checksum
- Compare with expected checksum
- Validate `.deb` metadata (version, architecture)
- Reject if mismatch

**Stage 4: Pre-Installation Backup**
- Trigger backup system (`system/backup.ts`)
- Include: database, games, assets, logs
- Store locally + USB (if available)
- Validate backup integrity

**Stage 5: Wait for Session Completion**
- Check for active sessions
- If `waitForCompletion = true`:
  - Poll every 30 seconds
  - Timeout after `maxWaitMinutes`
  - Notify operators via Socket.IO
- If timeout or no wait: force update

**Stage 6: Install Package**
- Stop `escapeplan-api.service`
- Run `dpkg -i /var/lib/escapeplan/updates/<package>.deb`
- Capture dpkg output for logging
- Update `/opt/escapeplan/` files

**Stage 7: Run Migrations**
- Execute `drizzle-kit push` (schema sync)
- Log migration output
- Rollback on failure

**Stage 8: Restart Services**
- Start `escapeplan-api.service`
- Wait for service to be active (30s timeout)
- Verify process is running

**Stage 9: Health Verification**
- Check database connectivity
- Verify API responds to `/api/health`
- Validate web app build exists
- Check camera streams (optional)

**Stage 10: Cleanup**
- Delete downloaded `.deb` (after 24h)
- Archive old backups (keep last 7)
- Update `update_history` table
- Emit completion event

### 3.2 Stage Transition Logic

```typescript
interface StageTransition {
  from: UpdateStage;
  to: UpdateStage;
  condition: () => boolean;
  onEnter: () => Promise<void>;
  onExit: () => Promise<void>;
  timeout: number;  // Seconds
  retryable: boolean;
}

const transitions: StageTransition[] = [
  {
    from: 'IDLE',
    to: 'CHECKING',
    condition: () => true,
    onEnter: async () => { /* Fetch GitHub */ },
    timeout: 30,
    retryable: true
  },
  {
    from: 'DOWNLOADING',
    to: 'VERIFYING',
    condition: () => download.bytesDownloaded === download.totalBytes,
    onEnter: async () => { /* Calculate checksum */ },
    timeout: 60,
    retryable: false
  },
  // ... (all stage transitions)
];
```

### 3.3 Timeout Handling

| Stage | Timeout | Action on Timeout |
|-------|---------|-------------------|
| Checking | 30s | Retry 3x with backoff, then fail |
| Downloading | 30min | Cancel, mark as failed, allow retry |
| Verifying | 60s | Fail immediately (likely corruption) |
| Backing Up | 10min | Abort update, log error |
| Installing | 5min | Trigger rollback |
| Migrating | 5min | Trigger rollback |
| Restarting | 2min | Trigger rollback |
| Health Check | 2min | Trigger rollback |

### 3.4 Rollback Trigger Conditions

**Automatic Rollback:**
1. Installation dpkg error (exit code ≠ 0)
2. Migration failure (Drizzle error)
3. Service restart failure (systemd timeout)
4. Health check failure (API unreachable)
5. Database corruption detected

**Manual Rollback:**
- Admin invokes `/api/updates/rollback`
- Emergency rollback from physical button (future)

### 3.5 User Session Handling

**Session Wait Strategy:**
```typescript
async function waitForSessionCompletion(
  maxWaitMinutes: number
): Promise<'completed' | 'timeout'> {
  const deadline = Date.now() + maxWaitMinutes * 60 * 1000;

  while (Date.now() < deadline) {
    const activeSessions = await listActiveSessions();

    if (activeSessions.length === 0) {
      return 'completed';
    }

    // Emit warning to operators
    emitUpdatePending({
      waitingForSessions: activeSessions.length,
      sessionIds: activeSessions.map(s => s.id),
      timeRemaining: Math.floor((deadline - Date.now()) / 1000)
    });

    await sleep(30_000); // Poll every 30s
  }

  return 'timeout';
}
```

**Force Update:**
- Send session pause commands
- Save session state to database
- Log forced interruption
- Resume sessions post-update (auto-recovery)

---

## 4. Backup Integration

### 4.1 When to Trigger Backups

**Pre-Update Backup (Automatic):**
- Triggered before Stage 6 (Install Package)
- Type: `pre-update`
- Always includes:
  - ✅ Database (full SQLite file)
  - ✅ Games (JSON export)
  - ✅ Assets (if size < 10GB)
  - ✅ Logs (last 7 days)

**Manual Backup (User-Initiated):**
- Via `/api/updates/backup` endpoint
- Operator selects what to include
- Type: `manual`

**Scheduled Backup (Daily):**
- systemd timer: `escapeplan-backup.timer`
- 3:00 AM daily
- Type: `scheduled`
- Not related to updates

### 4.2 Backup Validation Requirements

**Pre-Update Validation:**
```typescript
interface BackupValidation {
  checksumValid: boolean;      // SHA-256 matches manifest
  databaseIntegrity: boolean;  // SQLite PRAGMA integrity_check
  manifestValid: boolean;      // manifest.json schema valid
  sizeReasonable: boolean;     // Not 0 bytes, not exceeding disk
  tarExtractable: boolean;     // Can extract without errors
}

async function validateBackup(backupId: string): Promise<BackupValidation> {
  const backup = await getBackupById(backupId);

  // 1. Checksum validation
  const actualChecksum = await calculateChecksum(backup.filePath);
  const checksumValid = actualChecksum === backup.checksumSha256;

  // 2. Extract manifest
  const manifest = await extractManifest(backup.filePath);
  const manifestValid = validateManifestSchema(manifest);

  // 3. Size check
  const stats = await fs.stat(backup.filePath);
  const sizeReasonable = stats.size > 1024 && stats.size < 100e9; // 1KB - 100GB

  // 4. Database integrity (if included)
  let databaseIntegrity = true;
  if (manifest.includes.database) {
    const dbFile = await extractDatabaseFromBackup(backup.filePath);
    databaseIntegrity = await checkDatabaseIntegrity(dbFile);
  }

  return {
    checksumValid,
    databaseIntegrity,
    manifestValid,
    sizeReasonable,
    tarExtractable: true // If we got here, tar is valid
  };
}
```

### 4.3 Backup Metadata Tracking

**Extended Backup Record:**
```typescript
interface UpdateBackupMetadata {
  id: string;
  type: 'pre-update' | 'manual' | 'scheduled';
  updateVersion?: string;        // Associated update version
  previousVersion?: string;      // System version before update
  installId?: string;            // Associated install process
  retentionExpires: string;      // 24h for pre-update, 7d for manual
  validated: boolean;
  validationResults?: BackupValidation;
  restoreTested: boolean;        // Dry-run restore successful
}
```

### 4.4 Retention During Update

**Pre-Update Backup Retention:**
- Keep for 24 hours after successful update
- Keep indefinitely if update failed (for rollback)
- Delete automatically if update rolled back successfully

**Retention Policy:**
```typescript
async function enforceUpdateBackupRetention(): Promise<void> {
  const preUpdateBackups = await db
    .select()
    .from(backups)
    .where(eq(backups.type, 'pre-update'));

  for (const backup of preUpdateBackups) {
    const associatedUpdate = await db
      .select()
      .from(updateHistory)
      .where(eq(updateHistory.backupId, backup.id))
      .limit(1);

    if (associatedUpdate && associatedUpdate[0].status === 'completed') {
      const updateCompletedAt = new Date(associatedUpdate[0].completedAt);
      const expiresAt = new Date(updateCompletedAt.getTime() + 24 * 60 * 60 * 1000);

      if (Date.now() > expiresAt.getTime()) {
        await deleteBackup(backup.id);
      }
    }
  }
}
```

---

## 5. Installation Process

### 5.1 systemd Service Approach

**New Service: `escapeplan-updater.service`**

```ini
[Unit]
Description=EscapePlan Update Installer
After=network.target
Requires=escapeplan-api.service

[Service]
Type=oneshot
User=root
Environment="ESCAPEPLAN_UPDATE_ID=%i"
ExecStartPre=/usr/bin/systemctl stop escapeplan-api.service
ExecStart=/opt/escapeplan/scripts/install-update.sh ${ESCAPEPLAN_UPDATE_ID}
ExecStartPost=/usr/bin/systemctl start escapeplan-api.service
TimeoutStartSec=600
RemainAfterExit=no

[Install]
WantedBy=multi-user.target
```

**Installation Script: `/opt/escapeplan/scripts/install-update.sh`**

```bash
#!/bin/bash
set -euo pipefail

UPDATE_ID=$1
UPDATE_DIR="/var/lib/escapeplan/updates"
LOG_FILE="/var/log/escapeplan-update.log"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

log "Starting update installation: $UPDATE_ID"

# 1. Find .deb package
DEB_FILE=$(ls $UPDATE_DIR/*.deb 2>/dev/null | head -n1)
if [ -z "$DEB_FILE" ]; then
  log "ERROR: No .deb package found"
  exit 1
fi

# 2. Install package
log "Installing package: $DEB_FILE"
dpkg -i "$DEB_FILE" 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
  log "ERROR: dpkg installation failed"
  exit 1
fi

# 3. Run migrations
log "Running database migrations"
cd /opt/escapeplan/api
npx drizzle-kit push 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
  log "ERROR: Database migration failed"
  exit 1
fi

log "Update installation completed successfully"
exit 0
```

### 5.2 dpkg Installation Wrapper

**API Wrapper Function:**
```typescript
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface DpkgResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function installDebPackage(debFilePath: string): Promise<DpkgResult> {
  try {
    const { stdout, stderr } = await execAsync(
      `sudo dpkg -i ${debFilePath}`,
      {
        timeout: 300_000,  // 5 minutes
        maxBuffer: 10 * 1024 * 1024  // 10MB output
      }
    );

    return {
      success: true,
      stdout,
      stderr,
      exitCode: 0
    };
  } catch (error: any) {
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    };
  }
}
```

### 5.3 Migration Execution Strategy

**Migration Runner:**
```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-kit/migrator';

interface MigrationResult {
  success: boolean;
  migrationsApplied: number;
  logs: string[];
  error?: string;
}

async function runMigrations(): Promise<MigrationResult> {
  const logs: string[] = [];

  try {
    // Use drizzle-kit push (schema sync, no migration files)
    const { stdout, stderr } = await execAsync(
      'npx drizzle-kit push',
      {
        cwd: '/opt/escapeplan/api',
        timeout: 300_000
      }
    );

    logs.push(stdout);
    if (stderr) logs.push(stderr);

    return {
      success: true,
      migrationsApplied: 1,  // Schema synced
      logs
    };
  } catch (error: any) {
    return {
      success: false,
      migrationsApplied: 0,
      logs,
      error: error.message
    };
  }
}
```

### 5.4 Service Restart Coordination

**Restart Manager:**
```typescript
interface ServiceStatus {
  active: boolean;
  substate: 'running' | 'dead' | 'failed' | 'unknown';
  pid?: number;
  uptime?: number;
}

async function restartEscapePlanServices(): Promise<void> {
  // 1. Stop API service
  await execAsync('sudo systemctl stop escapeplan-api.service');

  // 2. Wait for clean shutdown
  await sleep(5000);

  // 3. Start API service
  await execAsync('sudo systemctl start escapeplan-api.service');

  // 4. Wait for service to be active
  const maxWaitSeconds = 120;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const status = await getServiceStatus('escapeplan-api');

    if (status.active && status.substate === 'running') {
      return; // Success
    }

    await sleep(2000);
  }

  throw new Error('Service failed to start within timeout');
}

async function getServiceStatus(serviceName: string): Promise<ServiceStatus> {
  const { stdout } = await execAsync(
    `systemctl show ${serviceName} --property=ActiveState,SubState,MainPID,ExecMainStartTimestamp`
  );

  const lines = stdout.split('\n');
  const props: Record<string, string> = {};

  for (const line of lines) {
    const [key, value] = line.split('=');
    if (key && value) props[key] = value;
  }

  return {
    active: props.ActiveState === 'active',
    substate: props.SubState as any || 'unknown',
    pid: props.MainPID ? parseInt(props.MainPID) : undefined
  };
}
```

### 5.5 Health Check Verification

**Post-Update Health Check:**
```typescript
interface HealthCheckResult {
  healthy: boolean;
  checks: {
    database: boolean;
    api: boolean;
    webApp: boolean;
    migrations: boolean;
  };
  details: string[];
}

async function verifySystemHealth(): Promise<HealthCheckResult> {
  const details: string[] = [];
  let allHealthy = true;

  // 1. Database connectivity
  let databaseHealthy = false;
  try {
    await db.select().from(systemSettings).limit(1);
    databaseHealthy = true;
    details.push('✅ Database: Connected');
  } catch (error: any) {
    allHealthy = false;
    details.push(`❌ Database: ${error.message}`);
  }

  // 2. API health endpoint
  let apiHealthy = false;
  try {
    const response = await fetch('http://localhost:4000/api/health', {
      timeout: 5000
    });
    apiHealthy = response.ok;
    details.push(apiHealthy ? '✅ API: Responding' : '❌ API: Non-200 response');
  } catch (error: any) {
    allHealthy = false;
    details.push(`❌ API: ${error.message}`);
  }

  // 3. Web app build exists
  let webAppHealthy = false;
  try {
    await fs.access('/opt/escapeplan/web/.svelte-kit/output');
    webAppHealthy = true;
    details.push('✅ Web App: Build exists');
  } catch {
    allHealthy = false;
    details.push('❌ Web App: Build missing');
  }

  // 4. Migrations applied
  let migrationsHealthy = false;
  try {
    // Check if schema matches expected version
    const schemaVersion = await getSchemaVersion();
    migrationsHealthy = true;
    details.push(`✅ Migrations: Schema v${schemaVersion}`);
  } catch (error: any) {
    allHealthy = false;
    details.push(`❌ Migrations: ${error.message}`);
  }

  return {
    healthy: allHealthy && databaseHealthy && apiHealthy && webAppHealthy && migrationsHealthy,
    checks: {
      database: databaseHealthy,
      api: apiHealthy,
      webApp: webAppHealthy,
      migrations: migrationsHealthy
    },
    details
  };
}
```

---

## 6. Rollback Mechanism

### 6.1 Automatic Rollback Triggers

**Trigger Conditions:**
```typescript
enum RollbackTrigger {
  INSTALLATION_FAILED = 'installation_failed',
  MIGRATION_FAILED = 'migration_failed',
  SERVICE_START_FAILED = 'service_start_failed',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  DATABASE_CORRUPTION = 'database_corruption',
  MANUAL_TRIGGER = 'manual_trigger'
}

interface RollbackDecision {
  shouldRollback: boolean;
  trigger: RollbackTrigger;
  severity: 'critical' | 'high' | 'medium';
  automatic: boolean;
}

function evaluateRollback(
  installStatus: InstallStatusResponse
): RollbackDecision {
  // Critical: Immediate rollback
  if (installStatus.status === 'failed' &&
      installStatus.error?.stage === 'migrating') {
    return {
      shouldRollback: true,
      trigger: RollbackTrigger.MIGRATION_FAILED,
      severity: 'critical',
      automatic: true
    };
  }

  // High: Rollback after retry
  if (installStatus.status === 'failed' &&
      installStatus.error?.stage === 'restarting') {
    return {
      shouldRollback: true,
      trigger: RollbackTrigger.SERVICE_START_FAILED,
      severity: 'high',
      automatic: true
    };
  }

  // Health check failure
  if (installStatus.healthCheckResult &&
      !installStatus.healthCheckResult.healthy) {
    return {
      shouldRollback: true,
      trigger: RollbackTrigger.HEALTH_CHECK_FAILED,
      severity: 'high',
      automatic: true
    };
  }

  return {
    shouldRollback: false,
    trigger: RollbackTrigger.MANUAL_TRIGGER,
    severity: 'medium',
    automatic: false
  };
}
```

### 6.2 Manual Rollback Process

**Rollback Executor:**
```typescript
interface RollbackProcess {
  id: string;
  fromVersion: string;
  toVersion: string;
  backupId: string;
  stages: RollbackStage[];
  currentStage: number;
}

type RollbackStage =
  | 'stop_services'
  | 'restore_database'
  | 'reinstall_package'
  | 'restart_services'
  | 'verify_health';

async function executeRollback(request: RollbackRequest): Promise<RollbackProcess> {
  const rollbackId = ulid();

  // 1. Find previous version package
  const previousVersion = await findPreviousVersion(request.targetVersion);
  if (!previousVersion) {
    throw new Error('No previous version available for rollback');
  }

  // 2. Find or select backup
  const backup = request.backupId
    ? await getBackupById(request.backupId)
    : await findLatestBackup('pre-update');

  if (!backup) {
    throw new Error('No backup available for rollback');
  }

  // 3. Create rollback record
  const rollback: RollbackProcess = {
    id: rollbackId,
    fromVersion: env.version,
    toVersion: previousVersion.version,
    backupId: backup.id,
    stages: [
      'stop_services',
      'restore_database',
      'reinstall_package',
      'restart_services',
      'verify_health'
    ],
    currentStage: 0
  };

  await db.insert(updateRollbacks).values({
    id: rollbackId,
    from_version: rollback.fromVersion,
    to_version: rollback.toVersion,
    backup_id: backup.id,
    status: 'in_progress',
    reason: request.reason,
    triggered_by: 'automatic', // or user ID
    started_at: new Date().toISOString()
  });

  // 4. Execute stages sequentially
  try {
    for (const stage of rollback.stages) {
      await executeRollbackStage(stage, rollback);
      rollback.currentStage++;
    }

    // Mark as completed
    await db.update(updateRollbacks)
      .set({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .where(eq(updateRollbacks.id, rollbackId));

    return rollback;
  } catch (error: any) {
    // Mark as failed
    await db.update(updateRollbacks)
      .set({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .where(eq(updateRollbacks.id, rollbackId));

    throw error;
  }
}
```

### 6.3 Database Restoration

**Database Restore Logic:**
```typescript
async function restoreDatabaseFromBackup(backupId: string): Promise<void> {
  const backup = await getBackupById(backupId);
  if (!backup || !backup.filePath) {
    throw new Error('Backup not found or invalid');
  }

  // 1. Extract database from backup
  const tempDir = `/tmp/rollback-${Date.now()}`;
  await fs.mkdir(tempDir, { recursive: true });

  await tar.extract({
    file: backup.filePath,
    cwd: tempDir
  });

  const backupDbPath = path.join(tempDir, 'escapeplan.db');

  // 2. Validate extracted database
  const integrity = await checkDatabaseIntegrity(backupDbPath);
  if (!integrity.valid) {
    throw new Error(`Backup database integrity check failed: ${integrity.error}`);
  }

  // 3. Stop API service
  await execAsync('sudo systemctl stop escapeplan-api.service');
  await sleep(5000);

  // 4. Backup current (failed) database
  const failedDbPath = `${getDatabasePath()}.failed-${Date.now()}`;
  await fs.copyFile(getDatabasePath(), failedDbPath);

  // 5. Restore backup database
  await fs.copyFile(backupDbPath, getDatabasePath());

  // 6. Cleanup temp directory
  await fs.rm(tempDir, { recursive: true });

  console.log(`Database restored from backup ${backupId}`);
}

interface DatabaseIntegrity {
  valid: boolean;
  error?: string;
}

async function checkDatabaseIntegrity(dbPath: string): Promise<DatabaseIntegrity> {
  try {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath, { readonly: true });

    const result = db.pragma('integrity_check');
    db.close();

    if (result[0]?.integrity_check === 'ok') {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: result[0]?.integrity_check || 'Unknown error'
      };
    }
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
```

### 6.4 Package Reinstallation

**Reinstall Previous Version:**
```typescript
async function reinstallPreviousVersion(version: string): Promise<void> {
  // 1. Find previous .deb package
  const packagePath = await findPackageByVersion(version);

  if (!packagePath) {
    // Try to download from GitHub Releases
    const downloadUrl = await getGitHubReleaseUrl(version);
    if (downloadUrl) {
      await downloadPackage(downloadUrl, `/var/lib/escapeplan/updates/escapeplan_${version}.deb`);
      packagePath = `/var/lib/escapeplan/updates/escapeplan_${version}.deb`;
    } else {
      throw new Error(`Package for version ${version} not found`);
    }
  }

  // 2. Install package
  const result = await installDebPackage(packagePath);

  if (!result.success) {
    throw new Error(`Package installation failed: ${result.stderr}`);
  }

  console.log(`Reinstalled version ${version}`);
}

async function findPackageByVersion(version: string): Promise<string | null> {
  const possiblePaths = [
    `/var/lib/escapeplan/updates/escapeplan_${version}.deb`,
    `/var/lib/escapeplan/updates/escapeplan_${version}_arm64.deb`,
    `/opt/escapeplan/packages/escapeplan_${version}.deb`
  ];

  for (const path of possiblePaths) {
    try {
      await fs.access(path);
      return path;
    } catch {
      continue;
    }
  }

  return null;
}
```

### 6.5 Verification After Rollback

**Post-Rollback Verification:**
```typescript
async function verifyRollbackSuccess(rollbackId: string): Promise<boolean> {
  // 1. Health check
  const health = await verifySystemHealth();

  if (!health.healthy) {
    console.error('Rollback health check failed:', health.details);
    return false;
  }

  // 2. Verify version
  const currentVersion = env.version;
  const rollback = await db
    .select()
    .from(updateRollbacks)
    .where(eq(updateRollbacks.id, rollbackId))
    .limit(1);

  if (rollback[0].to_version !== currentVersion) {
    console.error(`Version mismatch: expected ${rollback[0].to_version}, got ${currentVersion}`);
    return false;
  }

  // 3. Smoke test critical features
  try {
    await db.select().from(games).limit(1);
    await db.select().from(bookings).limit(1);
    await db.select().from(sessions).limit(1);
  } catch (error) {
    console.error('Database smoke test failed:', error);
    return false;
  }

  console.log(`Rollback ${rollbackId} verified successfully`);
  return true;
}
```

---

## 7. Download Management

### 7.1 GitHub Releases API Integration

**GitHub Client:**
```typescript
interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

class GitHubReleasesClient {
  private readonly baseUrl = 'https://api.github.com';
  private readonly repo: string;

  constructor(repo: string) {
    this.repo = repo; // e.g., "kryptobaseddev/escapeplan-app"
  }

  async getLatestRelease(): Promise<GitHubRelease | null> {
    const url = `${this.baseUrl}/repos/${this.repo}/releases/latest`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EscapePlan-App',
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async getReleaseByVersion(version: string): Promise<GitHubRelease | null> {
    const tag = version.startsWith('v') ? version : `v${version}`;
    const url = `${this.baseUrl}/repos/${this.repo}/releases/tags/${tag}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EscapePlan-App',
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async getDebAsset(release: GitHubRelease): Promise<GitHubAsset | null> {
    return release.assets.find(a => a.name.endsWith('.deb')) || null;
  }

  async getChecksumFile(release: GitHubRelease): Promise<string | null> {
    const checksumAsset = release.assets.find(a =>
      a.name.endsWith('.sha256') || a.name.endsWith('.checksums.txt')
    );

    if (!checksumAsset) return null;

    const response = await fetch(checksumAsset.browser_download_url);
    return await response.text();
  }
}
```

### 7.2 Checksum Verification

**Checksum Validator:**
```typescript
interface ChecksumVerification {
  valid: boolean;
  expected: string;
  actual: string;
  algorithm: 'sha256';
}

async function verifyPackageChecksum(
  filePath: string,
  expectedChecksum: string
): Promise<ChecksumVerification> {
  const actualChecksum = await calculateChecksum(filePath);

  return {
    valid: actualChecksum.toLowerCase() === expectedChecksum.toLowerCase(),
    expected: expectedChecksum.toLowerCase(),
    actual: actualChecksum.toLowerCase(),
    algorithm: 'sha256'
  };
}

async function extractChecksumFromRelease(
  release: GitHubRelease,
  fileName: string
): Promise<string | null> {
  const client = new GitHubReleasesClient(env.githubRepo);
  const checksumFileContent = await client.getChecksumFile(release);

  if (!checksumFileContent) return null;

  // Parse checksum file (format: "checksum  filename")
  const lines = checksumFileContent.split('\n');
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    if (match && match[2] === fileName) {
      return match[1];
    }
  }

  return null;
}
```

### 7.3 Resume Support for Interrupted Downloads

**Resumable Download Manager:**
```typescript
interface DownloadProgress {
  downloadId: string;
  bytesDownloaded: number;
  totalBytes: number;
  resumeSupported: boolean;
  lastChunkAt: string;
}

class ResumableDownloader {
  async download(
    url: string,
    destinationPath: string,
    downloadId: string,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void> {
    // Check if partial file exists
    let bytesDownloaded = 0;
    try {
      const stats = await fs.stat(destinationPath);
      bytesDownloaded = stats.size;
    } catch {
      // File doesn't exist, start fresh
    }

    // Check if server supports resume (Range header)
    const headResponse = await fetch(url, { method: 'HEAD' });
    const acceptsRange = headResponse.headers.get('accept-ranges') === 'bytes';
    const totalBytes = parseInt(headResponse.headers.get('content-length') || '0');

    if (!acceptsRange && bytesDownloaded > 0) {
      // Server doesn't support resume, delete partial and start over
      await fs.unlink(destinationPath);
      bytesDownloaded = 0;
    }

    // Start download with Range header
    const headers: Record<string, string> = {
      'User-Agent': 'EscapePlan-App'
    };

    if (bytesDownloaded > 0 && acceptsRange) {
      headers['Range'] = `bytes=${bytesDownloaded}-`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const fileStream = createWriteStream(destinationPath, {
      flags: bytesDownloaded > 0 ? 'a' : 'w'  // Append if resuming
    });

    const reader = response.body!.getReader();
    const startTime = Date.now();
    let lastProgressEmit = Date.now();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      fileStream.write(value);
      bytesDownloaded += value.length;

      // Emit progress every 1 second
      if (Date.now() - lastProgressEmit > 1000) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speedBps = bytesDownloaded / elapsed;
        const remainingBytes = totalBytes - bytesDownloaded;
        const remainingSeconds = remainingBytes / speedBps;

        onProgress({
          downloadId,
          bytesDownloaded,
          totalBytes,
          resumeSupported: acceptsRange,
          lastChunkAt: new Date().toISOString()
        });

        lastProgressEmit = Date.now();
      }
    }

    fileStream.end();

    // Final progress emit
    onProgress({
      downloadId,
      bytesDownloaded,
      totalBytes,
      resumeSupported: acceptsRange,
      lastChunkAt: new Date().toISOString()
    });
  }
}
```

### 7.4 Progress Tracking (Socket.IO Events)

**Download Progress Tracker:**
```typescript
import { emitUpdateProgress } from './realtime.js';

async function trackDownloadProgress(
  downloadId: string,
  url: string,
  destinationPath: string
): Promise<void> {
  const downloader = new ResumableDownloader();

  await downloader.download(
    url,
    destinationPath,
    downloadId,
    async (progress) => {
      // Update database
      await db.update(updateDownloads)
        .set({
          bytes_downloaded: progress.bytesDownloaded,
          total_bytes: progress.totalBytes,
          progress_percentage: Math.floor((progress.bytesDownloaded / progress.totalBytes) * 100),
          updated_at: new Date().toISOString()
        })
        .where(eq(updateDownloads.id, downloadId));

      // Emit Socket.IO event
      emitUpdateProgress({
        type: 'download',
        downloadId,
        stage: 'downloading',
        progress: {
          bytesDownloaded: progress.bytesDownloaded,
          totalBytes: progress.totalBytes,
          percentage: Math.floor((progress.bytesDownloaded / progress.totalBytes) * 100),
          speedBps: calculateSpeed(progress),
          remainingSeconds: calculateRemaining(progress)
        }
      });
    }
  );
}

function calculateSpeed(progress: DownloadProgress): number {
  // Calculate from database record (time elapsed vs bytes downloaded)
  const record = await db.select()
    .from(updateDownloads)
    .where(eq(updateDownloads.id, progress.downloadId))
    .limit(1);

  const startedAt = new Date(record[0].started_at).getTime();
  const elapsed = (Date.now() - startedAt) / 1000;

  return progress.bytesDownloaded / elapsed;
}
```

### 7.5 Download Caching Strategy

**Cache Manager:**
```typescript
interface CachedDownload {
  version: string;
  filePath: string;
  checksumSha256: string;
  cachedAt: string;
  size: number;
}

const CACHE_DIR = '/var/lib/escapeplan/updates/cache';
const CACHE_RETENTION_DAYS = 7;

class DownloadCache {
  async get(version: string): Promise<CachedDownload | null> {
    const cachePath = path.join(CACHE_DIR, `escapeplan_${version}.deb`);

    try {
      await fs.access(cachePath);
      const stats = await fs.stat(cachePath);

      // Check if cache is still valid (within retention period)
      const cachedAt = stats.mtime;
      const age = Date.now() - cachedAt.getTime();
      const maxAge = CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      if (age > maxAge) {
        await fs.unlink(cachePath);
        return null;
      }

      const checksum = await calculateChecksum(cachePath);

      return {
        version,
        filePath: cachePath,
        checksumSha256: checksum,
        cachedAt: cachedAt.toISOString(),
        size: stats.size
      };
    } catch {
      return null;
    }
  }

  async set(version: string, sourcePath: string): Promise<void> {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const cachePath = path.join(CACHE_DIR, `escapeplan_${version}.deb`);
    await fs.copyFile(sourcePath, cachePath);
  }

  async clear(): Promise<void> {
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }

  async prune(): Promise<void> {
    const files = await fs.readdir(CACHE_DIR);
    const now = Date.now();
    const maxAge = CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtime.getTime();

      if (age > maxAge) {
        await fs.unlink(filePath);
      }
    }
  }
}
```

---

## 8. Security Considerations

### 8.1 Package Integrity Verification (SHA-256)

**Verification Pipeline:**
```typescript
interface PackageSecurity {
  checksumValid: boolean;
  signatureValid: boolean;
  architectureValid: boolean;
  versionValid: boolean;
  sizeValid: boolean;
}

async function verifyPackageSecurity(
  filePath: string,
  expectedMetadata: {
    checksum: string;
    version: string;
    size: number;
  }
): Promise<PackageSecurity> {
  const result: PackageSecurity = {
    checksumValid: false,
    signatureValid: false,
    architectureValid: false,
    versionValid: false,
    sizeValid: false
  };

  // 1. Checksum verification
  const actualChecksum = await calculateChecksum(filePath);
  result.checksumValid = actualChecksum === expectedMetadata.checksum;

  // 2. Size verification (within 5% tolerance)
  const stats = await fs.stat(filePath);
  const sizeDiff = Math.abs(stats.size - expectedMetadata.size) / expectedMetadata.size;
  result.sizeValid = sizeDiff < 0.05;

  // 3. Architecture verification
  const { stdout } = await execAsync(`dpkg-deb --info ${filePath}`);
  result.architectureValid = stdout.includes('Architecture: arm64') ||
                              stdout.includes('Architecture: all');

  // 4. Version verification
  const versionMatch = stdout.match(/Version: (.+)/);
  result.versionValid = versionMatch?.[1] === expectedMetadata.version;

  // 5. Signature verification (future: GPG signature)
  result.signatureValid = true; // TODO: Implement GPG verification

  return result;
}
```

### 8.2 Signature Verification Approach

**GPG Signature Verification (Future Implementation):**
```typescript
interface SignatureVerification {
  valid: boolean;
  signer: string;
  signedAt: string;
  keyId: string;
  trustLevel: 'ultimate' | 'full' | 'marginal' | 'unknown';
}

async function verifyPackageSignature(
  packagePath: string,
  signaturePath: string
): Promise<SignatureVerification> {
  // Verify .deb.asc signature file against .deb package
  const { stdout, stderr } = await execAsync(
    `gpg --verify ${signaturePath} ${packagePath}`
  );

  // Parse GPG output
  const signerMatch = stdout.match(/Good signature from "(.+)"/);
  const keyIdMatch = stdout.match(/key ID ([A-F0-9]+)/);
  const dateMatch = stdout.match(/Signature made (.+)/);

  return {
    valid: stdout.includes('Good signature'),
    signer: signerMatch?.[1] || 'Unknown',
    signedAt: dateMatch?.[1] || '',
    keyId: keyIdMatch?.[1] || '',
    trustLevel: determineTrustLevel(stdout)
  };
}

function determineTrustLevel(gpgOutput: string): SignatureVerification['trustLevel'] {
  if (gpgOutput.includes('ultimate trust')) return 'ultimate';
  if (gpgOutput.includes('full trust')) return 'full';
  if (gpgOutput.includes('marginal trust')) return 'marginal';
  return 'unknown';
}

// Import trusted public key (one-time setup)
async function importTrustedKey(publicKeyUrl: string): Promise<void> {
  const response = await fetch(publicKeyUrl);
  const keyContent = await response.text();

  const tempKeyFile = '/tmp/escapeplan-release.key';
  await fs.writeFile(tempKeyFile, keyContent);

  await execAsync(`gpg --import ${tempKeyFile}`);
  await fs.unlink(tempKeyFile);
}
```

### 8.3 Privilege Escalation (sudo/systemd)

**Secure Privilege Escalation:**

**sudoers Configuration (`/etc/sudoers.d/escapeplan`):**
```bash
# Allow escapeplan user to run update commands without password
escapeplan ALL=(root) NOPASSWD: /usr/bin/systemctl stop escapeplan-api.service
escapeplan ALL=(root) NOPASSWD: /usr/bin/systemctl start escapeplan-api.service
escapeplan ALL=(root) NOPASSWD: /usr/bin/systemctl restart escapeplan-api.service
escapeplan ALL=(root) NOPASSWD: /usr/bin/dpkg -i /var/lib/escapeplan/updates/*.deb
escapeplan ALL=(root) NOPASSWD: /usr/bin/systemctl daemon-reload
```

**Wrapper Functions:**
```typescript
async function executePrivilegedCommand(
  command: 'stop' | 'start' | 'restart' | 'install',
  ...args: string[]
): Promise<void> {
  const allowedCommands = {
    stop: 'sudo systemctl stop escapeplan-api.service',
    start: 'sudo systemctl start escapeplan-api.service',
    restart: 'sudo systemctl restart escapeplan-api.service',
    install: (debPath: string) => `sudo dpkg -i ${debPath}`
  };

  const cmd = command === 'install'
    ? allowedCommands.install(args[0])
    : allowedCommands[command];

  // Validate command against whitelist
  if (!cmd) {
    throw new Error(`Unauthorized command: ${command}`);
  }

  // Execute with timeout and logging
  const { stdout, stderr } = await execAsync(cmd, {
    timeout: 300_000,
    uid: process.getuid(),  // Run as escapeplan user, sudo handles elevation
  });

  // Log execution
  await logSecurityEvent({
    type: 'privileged_command',
    command: cmd,
    user: process.env.USER,
    success: true,
    timestamp: new Date().toISOString()
  });
}
```

### 8.4 Upload Validation (Manual Uploads)

**Upload Validator:**
```typescript
interface UploadValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    version: string;
    architecture: string;
    size: number;
  };
}

async function validateManualUpload(
  file: File,
  expectedChecksum: string
): Promise<UploadValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. File type validation
  if (!file.name.endsWith('.deb')) {
    errors.push('Invalid file type. Must be .deb package.');
  }

  // 2. Size validation (max 500MB)
  const maxSizeBytes = 500 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    errors.push(`File size exceeds maximum (${maxSizeBytes / 1024 / 1024}MB)`);
  }

  // 3. Save to temp location
  const tempPath = `/tmp/upload-${Date.now()}.deb`;
  await saveUploadedFile(file, tempPath);

  // 4. Checksum validation
  const actualChecksum = await calculateChecksum(tempPath);
  if (actualChecksum !== expectedChecksum) {
    errors.push(`Checksum mismatch. Expected: ${expectedChecksum}, Got: ${actualChecksum}`);
  }

  // 5. Extract metadata
  const { stdout } = await execAsync(`dpkg-deb --info ${tempPath}`);
  const versionMatch = stdout.match(/Version: (.+)/);
  const archMatch = stdout.match(/Architecture: (.+)/);

  const version = versionMatch?.[1] || 'unknown';
  const architecture = archMatch?.[1] || 'unknown';

  // 6. Architecture validation
  if (architecture !== 'arm64' && architecture !== 'all') {
    errors.push(`Invalid architecture: ${architecture}. Expected: arm64 or all`);
  }

  // 7. Version validation (must be newer than current)
  const currentVersion = env.version;
  if (compareVersions(version, currentVersion) <= 0) {
    warnings.push(`Version ${version} is not newer than current ${currentVersion}`);
  }

  // Cleanup temp file if invalid
  if (errors.length > 0) {
    await fs.unlink(tempPath);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      version,
      architecture,
      size: file.size
    }
  };
}

async function saveUploadedFile(file: File, destinationPath: string): Promise<void> {
  const buffer = await file.arrayBuffer();
  await fs.writeFile(destinationPath, Buffer.from(buffer));
}
```

### 8.5 CSRF Protection

**CSRF Token Validation:**
```typescript
import { FastifyRequest } from 'fastify';

// Extend Fastify session with CSRF token
declare module 'fastify' {
  interface Session {
    csrfToken: string;
  }
}

async function validateCsrfToken(request: FastifyRequest): Promise<boolean> {
  const sessionToken = request.session.csrfToken;
  const requestToken = request.headers['x-csrf-token'] as string;

  if (!sessionToken || !requestToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(sessionToken),
    Buffer.from(requestToken)
  );
}

// Middleware for update endpoints
async function requireCsrfProtection(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const valid = await validateCsrfToken(request);

    if (!valid) {
      return reply.code(403).send({
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'CSRF token validation failed'
        }
      });
    }
  }
}

// Apply to update routes
server.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/updates/')) {
    await requireCsrfProtection(request, reply);
  }
});
```

---

## 9. Socket.IO Events Design

### 9.1 Real-Time Update Progress Events

**Event Emitters:**
```typescript
// Add to realtime.ts
export function emitUpdateProgress(event: UpdateProgressEvent) {
  io?.emit('update:progress', event);
}

export function emitUpdateStatus(event: UpdateStatusEvent) {
  io?.emit('update:status', event);
}

export function emitUpdateError(event: UpdateErrorEvent) {
  io?.emit('update:error', event);
}

export function emitUpdateComplete(event: UpdateCompleteEvent) {
  io?.emit('update:complete', event);
}

export function emitUpdatePending(event: UpdatePendingEvent) {
  io?.emit('update:pending', event);
}
```

### 9.2 Event Payload Schemas

**TypeScript Event Definitions:**
```typescript
// packages/contracts/src/update-events.ts

export interface UpdateProgressEvent {
  type: 'download' | 'backup' | 'install' | 'migrate' | 'rollback';
  downloadId?: string;
  installId?: string;
  rollbackId?: string;
  stage: string;
  progress: {
    percentage: number;         // 0-100
    bytesDownloaded?: number;
    totalBytes?: number;
    speedBps?: number;
    remainingSeconds?: number;
    message?: string;
  };
  timestamp: string;
}

export interface UpdateStatusEvent {
  type: 'check' | 'download' | 'install' | 'rollback';
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  version?: string;
  stage?: string;
  timestamp: string;
}

export interface UpdateErrorEvent {
  type: 'download' | 'install' | 'rollback';
  id: string;
  error: {
    code: string;
    message: string;
    stage?: string;
    retryable: boolean;
    details?: Record<string, any>;
  };
  timestamp: string;
}

export interface UpdateCompleteEvent {
  type: 'download' | 'install' | 'rollback';
  id: string;
  fromVersion?: string;
  toVersion: string;
  duration: number;           // Seconds
  timestamp: string;
}

export interface UpdatePendingEvent {
  reason: 'active_sessions' | 'manual_approval';
  waitingForSessions?: number;
  sessionIds?: string[];
  timeRemaining?: number;     // Seconds
  message: string;
  timestamp: string;
}

export interface UpdateAvailableEvent {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  size: number;
  publishedAt: string;
  timestamp: string;
}
```

### 9.3 Client Reconnection Handling

**Event History Buffer:**
```typescript
interface EventHistory {
  events: Array<{
    type: string;
    payload: any;
    timestamp: string;
    sequenceId: number;
  }>;
  maxSize: number;
}

class UpdateEventHistory {
  private history: EventHistory = {
    events: [],
    maxSize: 100
  };
  private sequenceCounter = 0;

  add(type: string, payload: any): void {
    this.history.events.push({
      type,
      payload,
      timestamp: new Date().toISOString(),
      sequenceId: this.sequenceCounter++
    });

    // Trim to max size
    if (this.history.events.length > this.history.maxSize) {
      this.history.events.shift();
    }
  }

  getSince(sequenceId: number): EventHistory['events'] {
    return this.history.events.filter(e => e.sequenceId > sequenceId);
  }

  getRecent(count: number = 10): EventHistory['events'] {
    return this.history.events.slice(-count);
  }

  clear(): void {
    this.history.events = [];
    this.sequenceCounter = 0;
  }
}

const updateEventHistory = new UpdateEventHistory();

// Emit with history tracking
export function emitUpdateProgressWithHistory(event: UpdateProgressEvent) {
  io?.emit('update:progress', event);
  updateEventHistory.add('update:progress', event);
}

// Client reconnection handler
io?.on('connection', (socket) => {
  socket.on('update:sync', (lastSequenceId: number) => {
    const missedEvents = updateEventHistory.getSince(lastSequenceId);
    socket.emit('update:history', missedEvents);
  });
});
```

### 9.4 Event History for Reconnected Clients

**Client-Side Reconnection:**
```typescript
// apps/escapeplan-web/src/lib/realtime/update-sync.ts
import { io } from 'socket.io-client';

class UpdateSyncClient {
  private socket: Socket;
  private lastSequenceId = -1;

  constructor() {
    this.socket = io();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      // Request missed events since last sequence
      this.socket.emit('update:sync', this.lastSequenceId);
    });

    this.socket.on('update:history', (events: any[]) => {
      // Replay missed events
      for (const event of events) {
        this.handleEvent(event.type, event.payload);
        this.lastSequenceId = Math.max(this.lastSequenceId, event.sequenceId);
      }
    });

    this.socket.on('update:progress', (event: UpdateProgressEvent) => {
      this.handleEvent('update:progress', event);
    });

    // ... other event listeners
  }

  private handleEvent(type: string, payload: any): void {
    switch (type) {
      case 'update:progress':
        updateProgressStore.set(payload);
        break;
      case 'update:status':
        updateStatusStore.set(payload);
        break;
      case 'update:error':
        updateErrorStore.set(payload);
        break;
      case 'update:complete':
        updateCompleteStore.set(payload);
        break;
    }
  }
}
```

---

## 10. Database Schema

### 10.1 Update History Table

```sql
CREATE TABLE update_history (
  id TEXT PRIMARY KEY,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'rolled_back')),
  type TEXT NOT NULL CHECK (type IN ('automatic', 'manual', 'manual_upload')),

  -- Foreign keys to tracking tables
  backup_id TEXT REFERENCES backups(id),
  download_id TEXT REFERENCES update_downloads(id),
  install_id TEXT REFERENCES update_installations(id),
  rollback_id TEXT REFERENCES update_rollbacks(id),

  -- Error details
  error_message TEXT,
  error_stage TEXT,

  -- Audit
  initiated_by TEXT NOT NULL REFERENCES user(id),
  initiated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  duration INTEGER,  -- Seconds

  -- Metadata
  release_notes TEXT,
  github_url TEXT
);

CREATE INDEX idx_update_history_status ON update_history(status);
CREATE INDEX idx_update_history_initiated_at ON update_history(initiated_at DESC);
CREATE INDEX idx_update_history_to_version ON update_history(to_version);
```

### 10.2 Update Downloads Table

```sql
CREATE TABLE update_downloads (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('github', 'manual_upload')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'downloading', 'completed', 'failed', 'cancelled')),

  -- Download metadata
  download_url TEXT,
  file_path TEXT,
  file_size_bytes INTEGER,
  checksum_sha256 TEXT NOT NULL,

  -- Progress tracking
  bytes_downloaded INTEGER DEFAULT 0,
  total_bytes INTEGER,
  progress_percentage INTEGER DEFAULT 0,
  speed_bps INTEGER,  -- Bytes per second
  resume_supported INTEGER DEFAULT 0,  -- Boolean

  -- Error handling
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_update_downloads_status ON update_downloads(status);
CREATE INDEX idx_update_downloads_version ON update_downloads(version);
```

### 10.3 Update Installations Table

```sql
CREATE TABLE update_installations (
  id TEXT PRIMARY KEY,
  download_id TEXT NOT NULL REFERENCES update_downloads(id),
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'pending_backup',
    'backing_up',
    'backed_up',
    'installing',
    'migrating',
    'restarting',
    'verifying',
    'completed',
    'failed',
    'rolled_back'
  )),

  -- Configuration
  wait_for_sessions INTEGER DEFAULT 0,  -- Boolean
  max_wait_minutes INTEGER DEFAULT 30,
  skip_migrations INTEGER DEFAULT 0,    -- Boolean

  -- Backup reference
  backup_id TEXT REFERENCES backups(id),

  -- Current stage
  current_stage TEXT,
  stage_progress INTEGER DEFAULT 0,  -- 0-100
  stage_message TEXT,

  -- Migration logs
  migration_logs TEXT,  -- JSON array of log lines

  -- Health check
  health_check_passed INTEGER DEFAULT 0,  -- Boolean
  health_check_details TEXT,  -- JSON

  -- Error handling
  error_code TEXT,
  error_message TEXT,
  error_stage TEXT,
  rollback_triggered INTEGER DEFAULT 0,  -- Boolean

  -- Timestamps
  started_at TEXT,
  completed_at TEXT,
  duration INTEGER  -- Seconds
);

CREATE INDEX idx_update_installations_status ON update_installations(status);
CREATE INDEX idx_update_installations_download_id ON update_installations(download_id);
```

### 10.4 Update Rollbacks Table

```sql
CREATE TABLE update_rollbacks (
  id TEXT PRIMARY KEY,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'stopping_services',
    'restoring_database',
    'reinstalling',
    'restarting',
    'verifying',
    'completed',
    'failed'
  )),

  -- Trigger information
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'automatic',
    'manual',
    'health_check_failed',
    'migration_failed',
    'install_failed'
  )),
  reason TEXT,
  install_id TEXT REFERENCES update_installations(id),

  -- Backup reference
  backup_id TEXT NOT NULL REFERENCES backups(id),

  -- Health verification
  health_check_passed INTEGER DEFAULT 0,  -- Boolean
  health_check_details TEXT,  -- JSON

  -- Error handling
  error_message TEXT,

  -- Audit
  triggered_by TEXT,  -- User ID or 'system'
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  duration INTEGER  -- Seconds
);

CREATE INDEX idx_update_rollbacks_status ON update_rollbacks(status);
CREATE INDEX idx_update_rollbacks_from_version ON update_rollbacks(from_version);
CREATE INDEX idx_update_rollbacks_trigger_type ON update_rollbacks(trigger_type);
```

### 10.5 Drizzle ORM Schema

**TypeScript Schema Definition:**
```typescript
// packages/contracts/src/schema.ts (additions)

export const updateHistory = sqliteTable('update_history', {
  id: text('id').primaryKey(),
  fromVersion: text('from_version').notNull(),
  toVersion: text('to_version').notNull(),
  status: text('status').notNull().$type<'completed' | 'failed' | 'rolled_back'>(),
  type: text('type').notNull().$type<'automatic' | 'manual' | 'manual_upload'>(),

  backupId: text('backup_id').references(() => backups.id),
  downloadId: text('download_id').references(() => updateDownloads.id),
  installId: text('install_id').references(() => updateInstallations.id),
  rollbackId: text('rollback_id').references(() => updateRollbacks.id),

  errorMessage: text('error_message'),
  errorStage: text('error_stage'),

  initiatedBy: text('initiated_by').notNull().references(() => user.id),
  initiatedAt: text('initiated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
  duration: integer('duration'),

  releaseNotes: text('release_notes'),
  githubUrl: text('github_url')
}, (table) => ({
  statusIdx: index('idx_update_history_status').on(table.status),
  initiatedAtIdx: index('idx_update_history_initiated_at').on(table.initiatedAt),
  toVersionIdx: index('idx_update_history_to_version').on(table.toVersion)
}));

export const updateDownloads = sqliteTable('update_downloads', {
  id: text('id').primaryKey(),
  version: text('version').notNull(),
  source: text('source').notNull().$type<'github' | 'manual_upload'>(),
  status: text('status').notNull().$type<'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled'>(),

  downloadUrl: text('download_url'),
  filePath: text('file_path'),
  fileSizeBytes: integer('file_size_bytes'),
  checksumSha256: text('checksum_sha256').notNull(),

  bytesDownloaded: integer('bytes_downloaded').default(0),
  totalBytes: integer('total_bytes'),
  progressPercentage: integer('progress_percentage').default(0),
  speedBps: integer('speed_bps'),
  resumeSupported: integer('resume_supported', { mode: 'boolean' }).default(false),

  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),

  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  statusIdx: index('idx_update_downloads_status').on(table.status),
  versionIdx: index('idx_update_downloads_version').on(table.version)
}));

export const updateInstallations = sqliteTable('update_installations', {
  id: text('id').primaryKey(),
  downloadId: text('download_id').notNull().references(() => updateDownloads.id),
  version: text('version').notNull(),
  status: text('status').notNull().$type<
    'pending_backup' | 'backing_up' | 'backed_up' | 'installing' |
    'migrating' | 'restarting' | 'verifying' | 'completed' |
    'failed' | 'rolled_back'
  >(),

  waitForSessions: integer('wait_for_sessions', { mode: 'boolean' }).default(false),
  maxWaitMinutes: integer('max_wait_minutes').default(30),
  skipMigrations: integer('skip_migrations', { mode: 'boolean' }).default(false),

  backupId: text('backup_id').references(() => backups.id),

  currentStage: text('current_stage'),
  stageProgress: integer('stage_progress').default(0),
  stageMessage: text('stage_message'),

  migrationLogs: text('migration_logs'),

  healthCheckPassed: integer('health_check_passed', { mode: 'boolean' }).default(false),
  healthCheckDetails: text('health_check_details'),

  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  errorStage: text('error_stage'),
  rollbackTriggered: integer('rollback_triggered', { mode: 'boolean' }).default(false),

  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  duration: integer('duration')
}, (table) => ({
  statusIdx: index('idx_update_installations_status').on(table.status),
  downloadIdIdx: index('idx_update_installations_download_id').on(table.downloadId)
}));

export const updateRollbacks = sqliteTable('update_rollbacks', {
  id: text('id').primaryKey(),
  fromVersion: text('from_version').notNull(),
  toVersion: text('to_version').notNull(),
  status: text('status').notNull().$type<
    'stopping_services' | 'restoring_database' | 'reinstalling' |
    'restarting' | 'verifying' | 'completed' | 'failed'
  >(),

  triggerType: text('trigger_type').notNull().$type<
    'automatic' | 'manual' | 'health_check_failed' |
    'migration_failed' | 'install_failed'
  >(),
  reason: text('reason'),
  installId: text('install_id').references(() => updateInstallations.id),

  backupId: text('backup_id').notNull().references(() => backups.id),

  healthCheckPassed: integer('health_check_passed', { mode: 'boolean' }).default(false),
  healthCheckDetails: text('health_check_details'),

  errorMessage: text('error_message'),

  triggeredBy: text('triggered_by'),
  startedAt: text('started_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
  duration: integer('duration')
}, (table) => ({
  statusIdx: index('idx_update_rollbacks_status').on(table.status),
  fromVersionIdx: index('idx_update_rollbacks_from_version').on(table.fromVersion),
  triggerTypeIdx: index('idx_update_rollbacks_trigger_type').on(table.triggerType)
}));
```

---

## 11. File System Structure

### 11.1 Directory Tree

```
/opt/escapeplan/
├── api/                           # API application
│   ├── dist/
│   │   └── index.js
│   ├── package.json
│   └── node_modules/
├── web/                           # Web application
│   ├── .svelte-kit/
│   │   └── output/
│   ├── package.json
│   └── node_modules/
├── scripts/                       # System scripts
│   ├── install-update.sh
│   ├── rollback-update.sh
│   └── health-check.sh
└── packages/                      # Previous version packages
    ├── escapeplan_0.1.0_arm64.deb
    └── escapeplan_0.2.0_arm64.deb

/var/lib/escapeplan/
├── escapeplan.db                  # SQLite database
├── escapeplan.db-wal
├── escapeplan.db-shm
├── updates/                       # Update downloads
│   ├── cache/                     # Download cache
│   │   ├── escapeplan_0.3.0.deb
│   │   └── escapeplan_0.3.0.deb.sha256
│   ├── escapeplan_0.3.0_arm64.deb
│   └── checksums.txt
├── backups/                       # Local backups
│   ├── escapeplan-backup-2025-10-04T10-00-00.tar.gz
│   ├── escapeplan-backup-2025-10-04T10-00-00.tar.gz.sha256
│   └── retention.json
└── assets/                        # Media assets
    ├── images/
    ├── audio/
    └── video/

/mnt/escapeplan-backup/            # USB backups
├── escapeplan-backup-2025-10-04T10-00-00.tar.gz
└── escapeplan-backup-2025-10-04T10-00-00.tar.gz.sha256

/var/log/
├── escapeplan-update.log          # Update process logs
├── escapeplan-api.log
└── escapeplan/
    └── update-2025-10-04.log

/tmp/
├── backup-{ulid}/                 # Temporary backup staging
├── rollback-{timestamp}/          # Temporary rollback files
└── upload-{timestamp}.deb         # Temporary upload files
```

### 11.2 File Ownership and Permissions

**Production Permissions:**
```bash
# Application files (owned by root, readable by escapeplan)
chown -R root:escapeplan /opt/escapeplan/
chmod -R 755 /opt/escapeplan/
chmod 750 /opt/escapeplan/scripts/*.sh

# Data directory (owned by escapeplan)
chown -R escapeplan:escapeplan /var/lib/escapeplan/
chmod 750 /var/lib/escapeplan/
chmod 600 /var/lib/escapeplan/escapeplan.db

# Update directories (writable by escapeplan)
chmod 750 /var/lib/escapeplan/updates/
chmod 750 /var/lib/escapeplan/backups/

# USB mount (owned by escapeplan)
chown -R escapeplan:escapeplan /mnt/escapeplan-backup/
chmod 750 /mnt/escapeplan-backup/

# Logs (writable by escapeplan)
chown escapeplan:escapeplan /var/log/escapeplan-update.log
chmod 640 /var/log/escapeplan-update.log
```

### 11.3 Cleanup Policies

**Automated Cleanup:**
```typescript
interface CleanupPolicy {
  target: string;
  retention: number;  // Days
  condition?: (file: FileStats) => boolean;
}

const cleanupPolicies: CleanupPolicy[] = [
  {
    target: '/var/lib/escapeplan/updates/cache/',
    retention: 7,
    condition: (file) => file.name.endsWith('.deb')
  },
  {
    target: '/var/lib/escapeplan/updates/',
    retention: 1,
    condition: (file) => file.name.endsWith('.deb') && !isCached(file)
  },
  {
    target: '/tmp/',
    retention: 0,  // Immediate
    condition: (file) => file.name.startsWith('backup-') || file.name.startsWith('rollback-')
  },
  {
    target: '/var/log/escapeplan/',
    retention: 30,
    condition: (file) => file.name.startsWith('update-')
  },
  {
    target: '/var/lib/escapeplan/backups/',
    retention: 7,
    condition: (file) => file.name.endsWith('.tar.gz')
  }
];

async function enforceCleanupPolicies(): Promise<void> {
  for (const policy of cleanupPolicies) {
    await cleanupDirectory(policy);
  }
}

async function cleanupDirectory(policy: CleanupPolicy): Promise<void> {
  const files = await fs.readdir(policy.target, { withFileTypes: true });
  const now = Date.now();
  const retentionMs = policy.retention * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (!file.isFile()) continue;

    const filePath = path.join(policy.target, file.name);
    const stats = await fs.stat(filePath);

    // Check retention period
    const age = now - stats.mtime.getTime();

    if (age > retentionMs) {
      // Check optional condition
      if (policy.condition && !policy.condition({ name: file.name, ...stats })) {
        continue;
      }

      // Delete file
      await fs.unlink(filePath);
      console.log(`Cleaned up: ${filePath} (age: ${Math.floor(age / 1000 / 60 / 60)} hours)`);
    }
  }
}

// Schedule cleanup (runs daily at 4 AM)
function scheduleCleanup(): void {
  const now = new Date();
  const next4AM = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    4, 0, 0
  );

  const msUntil4AM = next4AM.getTime() - now.getTime();

  setTimeout(async () => {
    await enforceCleanupPolicies();
    scheduleCleanup(); // Reschedule for next day
  }, msUntil4AM);
}
```

---

## 12. Error Handling Strategy

### 12.1 Error Categories

**Error Classification:**
```typescript
enum ErrorSeverity {
  LOW = 'low',           // Retry automatically
  MEDIUM = 'medium',     // Retry with user confirmation
  HIGH = 'high',         // Rollback recommended
  CRITICAL = 'critical'  // Immediate rollback required
}

enum ErrorRecovery {
  RETRY = 'retry',
  SKIP = 'skip',
  ROLLBACK = 'rollback',
  MANUAL = 'manual'
}

interface ErrorClassification {
  code: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  recovery: ErrorRecovery;
  rollbackTrigger: boolean;
}

const errorClassifications: Record<string, ErrorClassification> = {
  // Download errors (recoverable)
  'DOWNLOAD_TIMEOUT': {
    code: 'DOWNLOAD_TIMEOUT',
    severity: ErrorSeverity.LOW,
    recoverable: true,
    recovery: ErrorRecovery.RETRY,
    rollbackTrigger: false
  },
  'NETWORK_ERROR': {
    code: 'NETWORK_ERROR',
    severity: ErrorSeverity.LOW,
    recoverable: true,
    recovery: ErrorRecovery.RETRY,
    rollbackTrigger: false
  },
  'CHECKSUM_MISMATCH': {
    code: 'CHECKSUM_MISMATCH',
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    recovery: ErrorRecovery.RETRY,
    rollbackTrigger: false
  },

  // Backup errors (abort update)
  'BACKUP_FAILED': {
    code: 'BACKUP_FAILED',
    severity: ErrorSeverity.HIGH,
    recoverable: false,
    recovery: ErrorRecovery.MANUAL,
    rollbackTrigger: false
  },
  'BACKUP_INTEGRITY_FAILED': {
    code: 'BACKUP_INTEGRITY_FAILED',
    severity: ErrorSeverity.HIGH,
    recoverable: false,
    recovery: ErrorRecovery.MANUAL,
    rollbackTrigger: false
  },

  // Installation errors (trigger rollback)
  'DPKG_INSTALL_FAILED': {
    code: 'DPKG_INSTALL_FAILED',
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
    recovery: ErrorRecovery.ROLLBACK,
    rollbackTrigger: true
  },
  'MIGRATION_FAILED': {
    code: 'MIGRATION_FAILED',
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
    recovery: ErrorRecovery.ROLLBACK,
    rollbackTrigger: true
  },
  'SERVICE_START_FAILED': {
    code: 'SERVICE_START_FAILED',
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
    recovery: ErrorRecovery.ROLLBACK,
    rollbackTrigger: true
  },
  'HEALTH_CHECK_FAILED': {
    code: 'HEALTH_CHECK_FAILED',
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
    recovery: ErrorRecovery.ROLLBACK,
    rollbackTrigger: true
  },

  // Rollback errors (manual intervention required)
  'ROLLBACK_FAILED': {
    code: 'ROLLBACK_FAILED',
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
    recovery: ErrorRecovery.MANUAL,
    rollbackTrigger: false
  }
};
```

### 12.2 Error Codes and Messages

**Error Code Reference Table:**

| Code | Stage | Severity | User Message | Recovery Action |
|------|-------|----------|--------------|-----------------|
| `UPDATE_CHECK_FAILED` | Check | Low | "Unable to check for updates. Please try again later." | Retry after 5 minutes |
| `GITHUB_API_ERROR` | Check | Low | "GitHub API is unavailable. Update check will retry automatically." | Retry with backoff |
| `DOWNLOAD_TIMEOUT` | Download | Low | "Download timed out. Retrying..." | Auto-retry (3x) |
| `NETWORK_ERROR` | Download | Low | "Network connection lost. Download will resume when connection is restored." | Wait for network |
| `CHECKSUM_MISMATCH` | Verify | Medium | "Package verification failed. Re-downloading..." | Re-download |
| `DISK_SPACE_INSUFFICIENT` | Download | High | "Insufficient disk space. Please free up space and try again." | Manual cleanup |
| `BACKUP_FAILED` | Backup | High | "Backup creation failed. Update aborted for safety." | Check disk/USB |
| `BACKUP_INTEGRITY_FAILED` | Backup | High | "Backup verification failed. Cannot proceed with update." | Manual backup |
| `ACTIVE_SESSIONS_TIMEOUT` | Install | Medium | "Active sessions did not complete in time. Force update?" | User decision |
| `DPKG_INSTALL_FAILED` | Install | Critical | "Package installation failed. Rolling back to previous version..." | Auto-rollback |
| `MIGRATION_FAILED` | Migrate | Critical | "Database migration failed. Rolling back..." | Auto-rollback |
| `SERVICE_START_FAILED` | Restart | Critical | "Service failed to start. Rolling back..." | Auto-rollback |
| `HEALTH_CHECK_FAILED` | Verify | Critical | "Health check failed. Rolling back to restore service..." | Auto-rollback |
| `ROLLBACK_FAILED` | Rollback | Critical | "Rollback failed. Manual intervention required. Contact support." | Manual recovery |
| `DATABASE_CORRUPTION` | Any | Critical | "Database corruption detected. Restoring from backup..." | Auto-restore |

### 12.3 User-Facing Error Messages

**Error Message Templates:**
```typescript
interface ErrorMessage {
  title: string;
  description: string;
  actions: ErrorAction[];
  technicalDetails?: string;
}

interface ErrorAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

function getUserFacingError(errorCode: string, details?: any): ErrorMessage {
  const classification = errorClassifications[errorCode];

  const messages: Record<string, ErrorMessage> = {
    'DOWNLOAD_TIMEOUT': {
      title: 'Download Timed Out',
      description: 'The update download took too long and was cancelled. This can happen with slow internet connections.',
      actions: [
        { label: 'Retry Download', action: () => retryDownload(), primary: true },
        { label: 'Cancel', action: () => cancelUpdate() }
      ]
    },
    'CHECKSUM_MISMATCH': {
      title: 'Package Verification Failed',
      description: 'The downloaded package failed integrity verification. This could indicate a corrupted download or network issue.',
      actions: [
        { label: 'Re-download', action: () => retryDownload(), primary: true },
        { label: 'Upload Manually', action: () => showManualUpload() },
        { label: 'Cancel', action: () => cancelUpdate() }
      ],
      technicalDetails: `Expected: ${details?.expected}\nActual: ${details?.actual}`
    },
    'BACKUP_FAILED': {
      title: 'Backup Creation Failed',
      description: 'Unable to create a backup before updating. The update has been cancelled to protect your data.',
      actions: [
        { label: 'Check Disk Space', action: () => navigateToStorage() },
        { label: 'Try USB Backup', action: () => promptUSBBackup(), primary: true },
        { label: 'Cancel Update', action: () => cancelUpdate() }
      ],
      technicalDetails: details?.error
    },
    'MIGRATION_FAILED': {
      title: 'Database Migration Failed',
      description: 'The database update failed. The system is automatically rolling back to the previous version to restore functionality.',
      actions: [
        { label: 'View Logs', action: () => showMigrationLogs() },
        { label: 'Contact Support', action: () => contactSupport() }
      ],
      technicalDetails: details?.migrationError
    },
    'HEALTH_CHECK_FAILED': {
      title: 'Update Verification Failed',
      description: 'The system failed health checks after updating. Rolling back to previous version...',
      actions: [
        { label: 'View Health Report', action: () => showHealthReport() },
        { label: 'Force Complete', action: () => forceComplete() }
      ],
      technicalDetails: JSON.stringify(details?.healthChecks, null, 2)
    },
    'ROLLBACK_FAILED': {
      title: 'Critical: Rollback Failed',
      description: 'The automatic rollback process failed. The system may be in an unstable state. Please contact support immediately.',
      actions: [
        { label: 'Manual Recovery Guide', action: () => showRecoveryGuide(), primary: true },
        { label: 'Contact Support', action: () => contactSupport() }
      ],
      technicalDetails: details?.rollbackError
    }
  };

  return messages[errorCode] || {
    title: 'Update Error',
    description: `An error occurred during the update process: ${errorCode}`,
    actions: [
      { label: 'Contact Support', action: () => contactSupport(), primary: true }
    ],
    technicalDetails: JSON.stringify(details)
  };
}
```

### 12.4 Logging Requirements

**Structured Logging:**
```typescript
interface UpdateLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'update' | 'download' | 'backup' | 'install' | 'rollback';
  event: string;
  updateId?: string;
  downloadId?: string;
  installId?: string;
  rollbackId?: string;
  message: string;
  metadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

class UpdateLogger {
  private logFile = '/var/log/escapeplan-update.log';

  async log(entry: UpdateLogEntry): Promise<void> {
    const logLine = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    });

    // Write to file
    await fs.appendFile(this.logFile, logLine + '\n');

    // Write to systemLogs table
    await db.insert(systemLogs).values({
      id: ulid(),
      timestamp: entry.timestamp || new Date().toISOString(),
      level: entry.level,
      category: entry.category,
      message: entry.message,
      metadata: JSON.stringify(entry.metadata || {}),
      source: 'update-system'
    });

    // Emit critical errors to Socket.IO
    if (entry.level === 'critical' || entry.level === 'error') {
      emitUpdateError({
        type: entry.category as any,
        id: entry.updateId || entry.downloadId || entry.installId || '',
        error: {
          code: entry.error?.code || 'UNKNOWN_ERROR',
          message: entry.message,
          retryable: false
        },
        timestamp: entry.timestamp || new Date().toISOString()
      });
    }
  }

  async logDownloadProgress(downloadId: string, progress: any): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'download',
      event: 'progress',
      downloadId,
      message: `Download progress: ${progress.percentage}%`,
      metadata: progress
    });
  }

  async logInstallStage(installId: string, stage: string, status: 'started' | 'completed' | 'failed'): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: status === 'failed' ? 'error' : 'info',
      category: 'install',
      event: `stage_${status}`,
      installId,
      message: `Install stage ${stage}: ${status}`,
      metadata: { stage, status }
    });
  }

  async logRollbackTrigger(installId: string, trigger: string, reason: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'critical',
      category: 'rollback',
      event: 'triggered',
      installId,
      message: `Rollback triggered: ${trigger}`,
      metadata: { trigger, reason }
    });
  }
}

export const updateLogger = new UpdateLogger();
```

### 12.5 Alert Integration

**Alert Rules for Updates:**
```typescript
interface UpdateAlert {
  ruleId: string;
  condition: (context: UpdateContext) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  notificationChannels: ('ui' | 'email' | 'sms')[];
}

const updateAlertRules: UpdateAlert[] = [
  {
    ruleId: 'update_available',
    condition: (ctx) => ctx.updateAvailable === true,
    severity: 'info',
    message: 'New EscapePlan version available: {version}',
    notificationChannels: ['ui']
  },
  {
    ruleId: 'update_failed',
    condition: (ctx) => ctx.installStatus === 'failed',
    severity: 'error',
    message: 'Update installation failed at stage: {stage}',
    notificationChannels: ['ui', 'email']
  },
  {
    ruleId: 'rollback_triggered',
    condition: (ctx) => ctx.rollbackTriggered === true,
    severity: 'critical',
    message: 'Update rollback triggered: {reason}',
    notificationChannels: ['ui', 'email', 'sms']
  },
  {
    ruleId: 'update_complete',
    condition: (ctx) => ctx.installStatus === 'completed',
    severity: 'info',
    message: 'Update successfully installed: {fromVersion} → {toVersion}',
    notificationChannels: ['ui']
  },
  {
    ruleId: 'backup_failed',
    condition: (ctx) => ctx.backupStatus === 'failed',
    severity: 'warning',
    message: 'Pre-update backup failed. Update aborted.',
    notificationChannels: ['ui', 'email']
  },
  {
    ruleId: 'disk_space_low',
    condition: (ctx) => ctx.diskSpaceAvailableGB < 5,
    severity: 'warning',
    message: 'Low disk space detected. Update may fail. Free up space before updating.',
    notificationChannels: ['ui']
  }
];

async function evaluateUpdateAlerts(context: UpdateContext): Promise<void> {
  for (const rule of updateAlertRules) {
    if (rule.condition(context)) {
      await createAlert({
        id: ulid(),
        rule_id: rule.ruleId,
        severity: rule.severity,
        message: interpolateMessage(rule.message, context),
        acknowledged: false,
        created_at: new Date().toISOString(),
        metadata: JSON.stringify(context)
      });

      // Emit to Socket.IO
      emitAlert({
        id: ulid(),
        severity: rule.severity,
        message: interpolateMessage(rule.message, context),
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

---

## Implementation Priorities

### Phase 1: Core Update Infrastructure (Week 1-2)
1. ✅ Database schema implementation
2. ✅ Download management system
3. ✅ Checksum verification
4. ✅ Backup integration

### Phase 2: Installation Process (Week 3-4)
1. ✅ dpkg wrapper implementation
2. ✅ Migration runner
3. ✅ Service restart coordination
4. ✅ Health check system

### Phase 3: Rollback & Recovery (Week 5-6)
1. ✅ Automatic rollback triggers
2. ✅ Database restoration
3. ✅ Package reinstallation
4. ✅ Verification system

### Phase 4: UI & Real-Time (Week 7-8)
1. ✅ Socket.IO event implementation
2. ✅ Update UI components
3. ✅ Progress tracking
4. ✅ Error handling UI

### Phase 5: Security & Testing (Week 9-10)
1. ✅ CSRF protection
2. ✅ Upload validation
3. ✅ Integration testing
4. ✅ Security audit

---

## Testing Strategy

### Unit Tests
- Checksum calculation
- Version comparison logic
- Error classification
- Backup validation

### Integration Tests
- Full update flow (check → download → install → verify)
- Rollback scenarios
- Manual upload workflow
- Session handling during updates

### System Tests
- End-to-end update on Raspberry Pi
- Network failure scenarios
- Disk space constraints
- Concurrent session handling

### Security Tests
- Package tampering detection
- CSRF token validation
- Privilege escalation testing
- Upload file validation

---

## Future Enhancements

1. **Automatic Update Scheduling**
   - Configurable maintenance windows
   - Smart update timing (avoid peak hours)

2. **Differential Updates**
   - Binary diff patches (smaller downloads)
   - Incremental schema migrations

3. **Multi-Device Sync**
   - Update status sync across devices
   - Coordinated updates for mobile kits

4. **GPG Signature Verification**
   - Package signing in CI/CD
   - Public key distribution

5. **Update Analytics**
   - Success rate tracking
   - Performance metrics
   - Failure pattern analysis

6. **A/B Testing**
   - Canary deployments
   - Feature flags for gradual rollout

---

## Appendix: File Tree Summary

```
/mnt/projects/escape-plan/escapeplan-app/
├── apps/
│   ├── escapeplan-api/
│   │   └── src/
│   │       ├── updates.ts (enhanced)
│   │       ├── updates/
│   │       │   ├── download.ts
│   │       │   ├── install.ts
│   │       │   ├── rollback.ts
│   │       │   ├── github.ts
│   │       │   └── health.ts
│   │       └── realtime.ts (add update events)
│   └── escapeplan-web/
│       └── src/
│           └── routes/
│               └── (app)/
│                   └── admin/
│                       └── system/
│                           └── UpdatesTab.svelte (new)
└── packages/
    └── contracts/
        └── src/
            ├── schema.ts (add update tables)
            ├── update-events.ts (new)
            └── update-types.ts (new)
```

---

**END OF DESIGN DOCUMENT**
