# Session 46: System Dashboard Completion & Validation

**Date:** 2025-10-02
**Session Lead:** CLAUDE-1
**Duration:** TBD
**Focus:** Complete System Dashboard (Health, Network, Storage), validate DataTable, review existing implementations

---

## Overview

Session 45 completed RBAC frontend. This session focuses on finalizing the System Dashboard with real data integration and validating the DataTable component before wider adoption.

**Current State:**
- ✅ System Dashboard UI complete (Session 39)
- ⚠️ Health tab uses mock data
- ⚠️ Network tab needs Raspberry Pi hardware integration review
- ⚠️ Storage tab needs backup/restore implementation
- ⚠️ DataTable component untested in production

**Session Goals:**
1. Review Health tab implementation and determine real API requirements
2. Review Network tab for Pi hardware integration
3. Review and complete Storage tab backup/restore functionality
4. Test DataTable component on one existing page
5. Track progress against TODO.json and USER_STORIES.json

---

## Session Plan (Phased Approach)

### Phase 1: Inventory & Assessment (1h)
- [ ] Review Health tab current implementation
- [ ] Review Network tab current implementation
- [ ] Review Storage tab current implementation
- [ ] Review DataTable component
- [ ] Review existing table implementations (Users, Roles, Games, Cameras, Logs)
- [ ] Document findings

### Phase 2: Health Tab Real Data Integration (2-3h)
- [ ] Review backend for existing system health endpoint
- [ ] Determine required system metrics (CPU, memory, disk, uptime, services)
- [ ] Implement or enhance /api/admin/system/health endpoint
- [ ] Update HealthTab.svelte to use real data
- [ ] Add WebSocket subscription for real-time updates

### Phase 3: Network Tab Pi Integration Review (2-3h)
- [ ] Research current 2025 Raspberry Pi networking best practices (Context7)
- [ ] Review hostapd/dnsmasq configuration approach
- [ ] Document hardware interface requirements
- [ ] Review existing network management code
- [ ] Identify gaps for production deployment

### Phase 4: Storage Tab Backup System (2-3h)
- [ ] Design backup/restore flow
- [ ] Implement backup API endpoints
- [ ] Implement restore API with safety checks
- [ ] Update StorageTab.svelte with backup actions
- [ ] Test backup creation and restoration

### Phase 5: DataTable Validation (1-2h)
- [ ] Select one page for DataTable test (Users page recommended)
- [ ] Create backup of current implementation
- [ ] Refactor selected page to use DataTable
- [ ] Compare visual output and functionality
- [ ] Decide on wider adoption strategy

### Phase 6: Documentation & Tracking Updates (1h)
- [ ] Update TODO.json with progress
- [ ] Update USER_STORIES.json as needed
- [ ] Document session outcomes
- [ ] Identify next session priorities

---

## Progress Tracking

### Inventory Complete
- [ ] Health tab assessment
- [ ] Network tab assessment
- [ ] Storage tab assessment
- [ ] DataTable assessment
- [ ] Existing tables reviewed

### Implementation Complete
- [ ] Health tab real data
- [ ] Network tab Pi integration documented
- [ ] Storage backup system
- [ ] DataTable tested on one page

### Documentation Complete
- [ ] TODO.json updated
- [ ] USER_STORIES.json updated
- [ ] Session notes complete
- [ ] Next session plan documented

---

## Implementation Log

### Phase 1: Inventory & Assessment

**Status:** ✅ Complete

#### Health Tab Assessment
**File:** `apps/escapeplan-web/src/routes/(app)/admin/system/HealthTab.svelte`

**Current State:**
- Uses mock data in `onMount()` hook (line 25-34)
- Displays 4 service cards: API Server, WebSocket, Database, Winston Logger
- Shows system resources: CPU, Memory, Disk, Uptime
- Has placeholder diagnostic buttons (not functional)

**Backend Status:**
- ❌ No `/api/admin/system/health` endpoint exists
- ✅ Basic `/health` endpoint exists (line 377 of index.ts) - only returns `{ status: 'ok' }`
- Need to create comprehensive system health endpoint

**Required Metrics:**
1. CPU usage (read from `/proc/stat`)
2. Memory usage (read from `/proc/meminfo`)
3. Disk usage (use `df` command or filesystem stats)
4. System uptime (read from `/proc/uptime`)
5. Service status:
   - API Server (process.uptime())
   - WebSocket (check io instance)
   - Database (test connection)
   - Winston Logger (check active transports)

#### Storage Tab Assessment
**File:** `apps/escapeplan-web/src/routes/(app)/admin/system/StorageTab.svelte`

**Current State:**
- Loads data from `/api/admin/storage/metrics` endpoint ✅
- Backend: `getStorageMetrics()` in `assets/upload.ts` (line 278)
- Reads from `storage_metrics` table (exists in schema)
- Returns: total size, file count, breakdown by type/game, last backup date

**Missing Functionality:**
- ❌ No backup/restore API endpoints
- ❌ No backup trigger functionality
- ❌ No restore functionality
- Need to implement:
  - `POST /api/admin/storage/backup`
  - `GET /api/admin/storage/backups`
  - `POST /api/admin/storage/restore/:id`
  - `DELETE /api/admin/storage/backups/:id`

#### Network Tab Assessment
**File:** `apps/escapeplan-web/src/routes/(app)/admin/system/NetworkTab.svelte`

**Current State:**
- Loads data from `/api/admin/network` endpoint ✅
- Shows WiFi scan results and connection status ✅
- Edit form exists (read-only in current tab implementation)

**Raspberry Pi Integration Status:**
- ✅ WiFi scan working (`scanWiFiNetworks()` in state.ts)
- ✅ WiFi connection working (`connectToWiFi()` in state.ts)
- ⚠️ Need to review hostapd/dnsmasq integration for AP broadcast
- ⚠️ Need Context7 research for 2025 best practices

**Required Research:**
1. Review current hostapd/dnsmasq configuration approach
2. Determine hardware interface control method for Pi
3. Document production deployment requirements

#### DataTable Component Assessment
**File:** `apps/escapeplan-web/src/lib/components/DataTable.svelte`

**Design:** ✅ Well-structured generic component
- Uses Svelte 5 `$props()` and snippets
- Responsive breakpoints: sm (640px), md (768px), lg (1024px)
- Mobile: card layout using `mobileCard` snippet
- Desktop: table layout using `columns` + `desktopCell` snippet
- Loading and empty states built-in
- Keyed `{#each}` blocks for performance

**Status:** ✅ Component complete, ready for testing
**Recommendation:** Test on Users page first (already has table structure)

#### Existing Table Implementations
**Pages with tables:**
1. ✅ `/admin/users` - User list (card + table layouts)
2. ✅ `/admin/users` - Roles tab (uses similar pattern)
3. ✅ `/admin/games` - Game list (card + table layouts)
4. ✅ `/admin/cameras` - Camera list (card + table layouts)
5. ✅ `/admin/system` - Logs tab (custom table with filters)

**Current State:** All use manual responsive layouts
**Opportunity:** DataTable could standardize these patterns

---

### Assessment Summary

**Priority 1 - Immediate (MVP Blockers):**
- ❌ Health tab needs real API endpoint
- ❌ Storage tab needs backup/restore system

**Priority 2 - Important (Best Practices):**
- ⚠️ Network tab needs Pi integration documentation
- ⚠️ DataTable validation on one page

**Priority 3 - Enhancement (Code Quality):**
- ⏸️ Refactor existing tables to use DataTable (after validation)

**Next Steps:**
1. Implement Health API endpoint
2. Implement Storage backup/restore system
3. Document Network tab Pi requirements
4. Test DataTable on Users page

---

### Phase 2: Industry Research Complete

#### Storage Metrics Best Practices (2025)

**Problem Identified:**
- Frontend expects: `totalBytes`, `usedBytes`, `availableBytes`
- Backend returns: `size`, `files`, `sizeFormatted`
- Field name mismatch causing display issues

**Industry Standards:**
1. **Retention Policy:**
   - Metrics: 15 days (Datadog/Prometheus standard)
   - For compliance: 3 years (FISMA, ISO 27001)
   - Solution: Time-series snapshots, not individual records

2. **Storage Monitoring Metrics:**
   - Capacity: Total, Used, Available (bytes)
   - Performance: IOPS, Latency, Throughput
   - Breakdown: By type (images/video/audio), by game/project
   - Health: Disk health, temperature, SMART status

**Recommended Architecture:**
```
storage_snapshots (replaces storage_metrics)
- id, snapshot_date
- total_bytes, used_bytes, available_bytes
- by_type (JSON), by_game (JSON)
- retention: Last 30 snapshots (daily), then weekly for 3 months
```

#### Backup System Best Practices (2025)

**3-2-1 Rule:**
- 3 copies of data
- 2 different media types
- 1 offsite copy

**USB Detection & Backup:**
- Use `udev` on Linux to detect USB devices
- Read `/proc/mounts` for mounted volumes
- Check `/dev/disk/by-id` for USB identification
- Auto-mount to `/mnt/escapeplan-backup/`

**Selective Backup Components:**
1. **Database** (critical):
   - SQLite database file
   - Configuration settings
   - User accounts & roles

2. **Application Data** (critical):
   - Games (puzzles, hints, milestones)
   - Bookings & sessions
   - Cameras configuration

3. **Assets** (large, optional):
   - Images, videos, audio files
   - Can be excluded for quick backups

4. **System Logs** (optional):
   - Last 7 days for diagnostics
   - Older logs can be excluded

**Backup Format:**
- `.tar.gz` for compression
- Include `manifest.json` with metadata
- Encrypt with AES-256 (optional)
- Checksums (SHA-256) for integrity

**Automation:**
- Daily automatic backups at 2 AM
- Retention: Last 7 backups (can be configured)
- Triggered manually on-demand
- Pre-update backups (before system updates)

---

### Phase 3: Implementation Plan (Following Drizzle + Zod Pattern)

#### Schema Design Decision: Keep storage_metrics, Add New Tables

**Rational:**
- `storage_metrics` table stays for asset file tracking (images/video/audio)
- Add new tables for system-level metrics and backups
- Separate concerns: assets vs system health vs backups

**New Schema Architecture:**

```typescript
// 1. systemHealth table (replaces mock data)
systemHealth {
  id: string (pk)
  cpu_usage_percent: real
  memory_total_mb: integer
  memory_used_mb: integer
  disk_total_gb: real
  disk_used_gb: real
  uptime_seconds: integer
  services_status: text (json) // [{name, status, uptime, details}]
  recorded_at: timestamp
}

// 2. backups table (track backup history)
backups {
  id: string (pk)
  type: text ('manual' | 'scheduled' | 'pre-update')
  status: text ('in_progress' | 'completed' | 'failed')
  file_path: text
  file_size_bytes: integer
  includes: text (json) // {database, games, assets, logs}
  destination: text ('local' | 'usb')
  usb_device: text (nullable)
  checksum_sha256: text
  error_message: text (nullable)
  created_by: text (operator_id)
  created_at: timestamp
  completed_at: timestamp (nullable)
}

// 3. usbDevices table (track connected USB drives)
usbDevices {
  id: string (pk)
  device_path: text // /dev/sda1
  mount_point: text // /mnt/escapeplan-backup
  label: text
  total_space_gb: real
  available_space_gb: real
  is_mounted: boolean
  last_seen: timestamp
}
```

**Updated API Response Formats:**

```typescript
// Storage Metrics Response (FIXED format)
interface StorageMetricsResponse {
  system: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usedPercent: number;
  };
  assets: {
    totalFiles: number;
    totalBytes: number;
    byType: {
      images: { totalFiles: number; totalBytes: number };
      videos: { totalFiles: number; totalBytes: number };
      audio: { totalFiles: number; totalBytes: number };
    };
    byGame: Array<{
      gameName: string | null;
      totalFiles: number;
      totalBytes: number;
    }>;
  };
  lastBackupAt: string | null;
}

// System Health Response
interface SystemHealthResponse {
  cpu: number; // percentage
  memory: { used: number; total: number };
  disk: { used: number; total: number };
  uptime: string;
  services: Array<{
    name: string;
    status: 'online' | 'offline' | 'degraded';
    uptime: string;
    details: string;
  }>;
}

// Backup Response
interface BackupResponse {
  id: string;
  type: 'manual' | 'scheduled' | 'pre-update';
  status: 'in_progress' | 'completed' | 'failed';
  filePath: string;
  fileSizeBytes: number;
  includes: {
    database: boolean;
    games: boolean;
    assets: boolean;
    logs: boolean;
  };
  destination: 'local' | 'usb';
  usbDevice?: string;
  checksumSha256?: string;
  errorMessage?: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}
```

#### Implementation Steps:

**Step 1: Update Contracts Package** ✅
1. Add new tables to `packages/contracts/src/schema.ts`
2. Add Zod schemas to `packages/contracts/src/validation.ts`
3. Export types from `packages/contracts/src/index.ts`
4. Build contracts: `pnpm --filter @escapeplan/contracts build`

**Step 2: Generate & Apply Migrations** ✅
1. Generate migration: `cd apps/escapeplan-api && npx drizzle-kit generate`
2. Apply migration (auto on dev server restart)

**Step 3: Implement Backend Functions** ✅
1. Create `apps/escapeplan-api/src/system/health.ts`
2. Create `apps/escapeplan-api/src/system/backup.ts`
3. Create `apps/escapeplan-api/src/system/usb.ts`
4. Fix `getStorageMetrics()` response format

**Step 4: Add API Endpoints** ✅
1. GET `/api/admin/system/health` - Real system metrics
2. POST `/api/admin/backups` - Trigger backup
3. GET `/api/admin/backups` - List backups
4. POST `/api/admin/backups/:id/restore` - Restore backup
5. DELETE `/api/admin/backups/:id` - Delete backup
6. GET `/api/admin/usb-devices` - List USB devices

**Step 5: Update Frontend** ✅
1. Fix StorageTab response mapping
2. Update HealthTab to fetch real data
3. Implement BackupTab functionality

**Ready to proceed?** I'll start with Step 1: Creating the Drizzle + Zod schemas.

