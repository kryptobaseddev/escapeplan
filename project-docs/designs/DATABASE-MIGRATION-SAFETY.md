# Database Migration Safety System - Design Document

**Version:** 1.0
**Date:** 2025-10-04
**Author:** System Architecture Team
**Status:** Design Phase

---

## Executive Summary

This document defines the architecture for a production-safe database migration system for EscapePlan. The current implementation uses `drizzle-kit push` (direct schema sync) which is **dangerous for production** as it can result in data loss and lacks proper versioning. This design transitions to a migration-based workflow with clear separation between schema changes (migrations) and data seeding, with robust safety checks and rollback capabilities.

**Key Objectives:**
- Separate migrations from seeds
- Preserve all user data during schema changes
- Enable migration review before production deployment
- Support atomic rollbacks
- Provide comprehensive safety checks
- Maintain SQLite WAL mode compatibility with better-sqlite3

---

## Table of Contents

1. [Migration vs Seed Separation](#1-migration-vs-seed-separation)
2. [Seed Refactoring Design](#2-seed-refactoring-design)
3. [First-Run Detection](#3-first-run-detection)
4. [Production Data Preservation](#4-production-data-preservation)
5. [Migration Workflow](#5-migration-workflow)
6. [Safe Migration Execution](#6-safe-migration-execution)
7. [Migration File Structure](#7-migration-file-structure)
8. [Drizzle Configuration Updates](#8-drizzle-configuration-updates)
9. [Migration Safety Checks](#9-migration-safety-checks)
10. [Seed Data Management](#10-seed-data-management)
11. [Database Schema Changes](#11-database-schema-changes)
12. [Testing Strategy](#12-testing-strategy)
13. [Error Handling](#13-error-handling)
14. [Documentation Requirements](#14-documentation-requirements)

---

## 1. Migration vs Seed Separation

### 1.1 Migration Definition

**Migrations** are schema-only changes that modify the database structure. They are:
- **Versioned**: Each migration has a unique timestamp-based identifier
- **Immutable**: Once applied to production, migrations cannot be changed
- **Reversible**: Where possible, include rollback logic
- **Ordered**: Applied sequentially in creation order
- **DDL-focused**: CREATE, ALTER, DROP statements only

**Migrations include:**
- Table creation/deletion
- Column additions/modifications/deletions
- Index creation/removal
- Foreign key constraint changes
- Trigger installation/updates
- Data type changes
- Default value changes

**Migrations NEVER include:**
- Business data insertion (users, games, bookings)
- System configuration data (settings, alert rules)
- Demo/fixture data

### 1.2 Seed Definition

**Seeds** are data-only operations that populate tables with necessary records. They are:
- **Idempotent**: Safe to run multiple times without duplicates
- **Environment-aware**: Different seeds for dev/staging/prod
- **Conditional**: Can check for existing data before inserting
- **Non-versioned**: Can be updated without migration-like constraints
- **DML-focused**: INSERT statements only (with conflict handling)

**Seeds include:**
- RBAC system (roles, permissions, role_permissions)
- System administrator user
- Default system settings
- Alert rule templates
- Network profile defaults
- Demo data (dev/test environments only)

### 1.3 Clear Separation Rules

| Concern | Migrations | Seeds |
|---------|-----------|-------|
| **Location** | `apps/escapeplan-api/drizzle/` | `apps/escapeplan-api/src/db/seeds/` |
| **Format** | `.sql` files | `.ts` TypeScript modules |
| **Execution** | `drizzle-kit migrate` | npm script `db:seed` |
| **Timing** | On deployment/startup | After migrations, first-run or manual |
| **Versioning** | Immutable, sequential | Mutable, idempotent |
| **Rollback** | SQL-based or manual | N/A (idempotent design) |

### 1.4 Trigger Execution Logic

```
Application Startup Flow:
┌─────────────────────────────────────────┐
│ 1. Initialize database connection       │
│    - Enable WAL mode                    │
│    - Enable foreign keys                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 2. Run Drizzle migrations               │
│    - Apply pending .sql files           │
│    - Update __drizzle_migrations table  │
│    - Apply custom triggers.sql          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 3. Check first-run status               │
│    - Query isFirstRun()                 │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
    YES  │                │  NO
         ▼                ▼
┌────────────────┐   ┌──────────────────┐
│ Run essential  │   │ Skip seed        │
│ seeds          │   │ (data exists)    │
│ - 01-essential │   └──────────────────┘
│ - 02-defaults  │
└────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 4. Start application                    │
│    - Fastify server on port 4000        │
│    - Socket.IO attachment               │
└─────────────────────────────────────────┘
```

---

## 2. Seed Refactoring Design

### 2.1 Current State Analysis

**Current Implementation:**
- Single monolithic file: `src/db/seed.ts` (~589 lines)
- Mixes essential RBAC with demo game data
- Uses `clearAll()` function that wipes ALL data
- Some idempotent checks, but inconsistent
- No environment detection (dev vs prod)
- Admin user password reset on every run

**Problems:**
- Cannot run seeds in production safely
- Demo data pollutes production environments
- No granular seed execution
- Seed vs migration logic conflated

### 2.2 New Seed File Structure

```
apps/escapeplan-api/src/db/seeds/
├── index.ts                    # Seed orchestrator
├── 01-essential.ts             # RBAC + admin user
├── 02-system-defaults.ts       # Settings + alert rules + network
├── 03-demo-fixtures.ts         # Pirate game (dev only)
└── utils/
    ├── first-run-detector.ts   # isFirstRun() implementation
    └── seed-logger.ts          # Structured logging helper
```

### 2.3 Seed File Specifications

#### **01-essential.ts** (RBAC + Admin User)

**Purpose:** Seed minimum viable data required for authentication and authorization.

**Data Included:**
- 27 permissions (view_dashboard, manage_bookings, etc.)
- 4 system roles (admin, manager, game_master, customer)
- Role-permission mappings via `role_permissions` table
- Admin user (`admin@escapeplan.local` / `escapeplan`)

**Idempotency Strategy:**
```typescript
// Permissions: INSERT OR IGNORE by primary key
db.prepare(`
  INSERT OR IGNORE INTO permissions (id, name, label, category, user_type_scope)
  VALUES (?, ?, ?, ?, ?)
`).run(permId, name, label, category, scope);

// Roles: INSERT OR IGNORE by primary key
db.prepare(`
  INSERT OR IGNORE INTO roles (id, name, description, user_type_scope, is_system)
  VALUES (?, ?, ?, ?, 1)
`).run(roleId, name, desc, scope);

// Role-Permissions: CHECK then INSERT
const exists = db.prepare(`
  SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_id = ?
`).get(roleId, permId);
if (!exists) {
  db.prepare(`
    INSERT INTO role_permissions (id, role_id, permission_id)
    VALUES (?, ?, ?)
  `).run(uuid(), roleId, permId);
}

// Admin User: Drizzle onConflictDoNothing
await db.insert(user)
  .values(adminUser)
  .onConflictDoNothing();
```

**Execution Conditions:**
- **First-run:** ALWAYS execute
- **Subsequent runs:** Safe to re-run (idempotent)
- **Production:** REQUIRED

**Dependencies:**
- Requires migrations to have created tables: `permissions`, `roles`, `role_permissions`, `user`, `account`

---

#### **02-system-defaults.ts** (Settings, Alert Rules, Network)

**Purpose:** Seed system configuration and operational defaults.

**Data Included:**
- System settings (~20 entries in `system_settings` table)
  - Storage limits (max image/audio/video size)
  - Backup retention days
  - GitHub update repository
  - Business rules (min/max game duration, booking buffer)
  - User validation rules (password length, email required)
  - System info (install path, version, build date)
- Alert rules (4 rules: game_paused, low_time, excessive_hints, network_offline)
- Network profile (default SSID configuration)

**Idempotency Strategy:**
```typescript
// System Settings: Drizzle onConflictDoNothing
await db.insert(systemSettings)
  .values(settingDefaults)
  .onConflictDoNothing();

// Alert Rules: INSERT OR REPLACE (allow updates)
db.prepare(`
  INSERT OR REPLACE INTO alert_rules
  (id, name, description, category, level, enabled, conditions, title_template, message_template)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(...ruleData);

// Network Profile: INSERT OR IGNORE
db.prepare(`
  INSERT OR IGNORE INTO network_profiles (id, name, ssid, password, status)
  VALUES ('primary', 'EscapePlan Control Network', 'escapeplan_net', 'escape2024', 'offline')
`).run();
```

**Execution Conditions:**
- **First-run:** ALWAYS execute
- **Subsequent runs:** Safe to re-run
  - Settings: Only inserts missing keys (preserves user edits)
  - Alert rules: REPLACES to allow template updates
  - Network: Preserves existing configuration
- **Production:** REQUIRED

**Update Strategy for System Data:**
- **Settings:** Add new keys, never overwrite existing values
- **Alert rules:** Use `INSERT OR REPLACE` to update templates (rules can be disabled by users, respect that)
- **Network:** Never overwrite SSID/password after first run

**Dependencies:**
- Requires tables: `system_settings`, `alert_rules`, `network_profiles`

---

#### **03-demo-fixtures.ts** (Pirate Game - Dev Only)

**Purpose:** Seed realistic demo data for development and testing.

**Data Included:**
- Pirate Mutiny game (`games` table)
- 9 game puzzles (`game_puzzles` table)
- Optional: Sample booking, sample session (for E2E testing)

**Idempotency Strategy:**
```typescript
// Check if game exists by slug
const existing = db.prepare(`
  SELECT id FROM games WHERE slug = ?
`).get('pirate-mutiny');

if (!existing) {
  // Insert game
  db.prepare(`INSERT INTO games (...) VALUES (...)`).run(gameData);

  // Insert puzzles
  for (const puzzle of puzzles) {
    db.prepare(`INSERT INTO game_puzzles (...) VALUES (...)`).run(puzzle);
  }
} else {
  console.log('Demo game already exists, skipping...');
}
```

**Execution Conditions:**
- **First-run:** Execute ONLY in development environment
- **Subsequent runs:** Skip if game exists
- **Production:** NEVER execute

**Environment Detection:**
```typescript
import { isProduction } from '@escapeplan/contracts/runtime';

export async function seedDemoFixtures() {
  if (isProduction()) {
    console.log('[Seed] Skipping demo fixtures in production');
    return;
  }

  // Seed demo data...
}
```

**Dependencies:**
- Requires tables: `games`, `game_puzzles`
- Requires essential seeds to have run first (no dependencies on demo data)

---

### 2.4 Seed Orchestrator (index.ts)

```typescript
/**
 * Seed Orchestrator
 * Coordinates execution of all seed files in dependency order
 */
import { isFirstRun } from './utils/first-run-detector.ts';
import { seedEssential } from './01-essential.ts';
import { seedSystemDefaults } from './02-system-defaults.ts';
import { seedDemoFixtures } from './03-demo-fixtures.ts';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from '../client.ts';
import { resolve } from 'node:path';

const migrationsPath = resolve(import.meta.dirname, '../../../drizzle');

/**
 * Main seed entry point
 * Safe to run in production (skips demo data)
 */
export async function runSeeds(options: { force?: boolean } = {}) {
  console.log('[Seed] Starting database seeding...');

  // 1. Ensure migrations applied first
  console.log('[Seed] Applying migrations...');
  migrate(db, { migrationsFolder: migrationsPath });

  // 2. Check if first run
  const isFirst = options.force || isFirstRun();

  if (isFirst) {
    console.log('[Seed] First run detected - seeding essential data');

    // 3. Seed in dependency order
    await seedEssential();
    await seedSystemDefaults();
    await seedDemoFixtures(); // Auto-skips in production

    console.log('[Seed] ✅ Database seeded successfully');
  } else {
    console.log('[Seed] Database already seeded, skipping...');
    console.log('[Seed] (Use --force to re-run seeds)');
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  await runSeeds({ force });
  process.exit(0);
}
```

---

## 3. First-Run Detection

### 3.1 Detection Strategy

**Sentinel Data Check:** Query for existence of critical data that should ALWAYS exist after first seed.

**Implementation Logic:**
```typescript
/**
 * Determines if this is the first run of the application
 * by checking for sentinel data that should exist after seeding
 */
export function isFirstRun(): boolean {
  // Check 1: Admin role exists
  const adminRole = db.prepare(`
    SELECT id FROM roles WHERE name = 'admin' LIMIT 1
  `).get();

  if (!adminRole) return true;

  // Check 2: Admin user exists
  const adminUser = db.prepare(`
    SELECT id FROM user WHERE email = 'admin@escapeplan.local' LIMIT 1
  `).get();

  if (!adminUser) return true;

  // Check 3: Any permissions exist
  const permCount = db.prepare(`
    SELECT COUNT(*) as count FROM permissions
  `).get() as { count: number };

  if (permCount.count === 0) return true;

  // All sentinel checks passed - not first run
  return false;
}
```

**Why This Approach:**
- **No additional table needed:** Uses existing data as indicators
- **Multi-point validation:** Checks multiple sentinel records (prevents false negatives)
- **Fast:** Simple COUNT and SELECT queries
- **Production-safe:** Never destructive, read-only checks

### 3.2 Edge Cases

#### **Case 1: Corrupted Database (Partial Tables)**

**Scenario:** Migrations partially applied, some tables missing.

**Handling:**
```typescript
export function isFirstRun(): boolean {
  try {
    // Wrap all checks in try-catch
    const adminRole = db.prepare(`SELECT id FROM roles WHERE name = 'admin'`).get();
    // ... other checks
  } catch (error) {
    // Table doesn't exist - definitely first run (or corrupted)
    console.warn('[First-Run] Detection failed, assuming first run:', error.message);
    return true;
  }
}
```

**Recovery:** Seeds will attempt to run, fail gracefully if tables missing, log error.

#### **Case 2: Partial Migrations (Admin User Deleted)**

**Scenario:** Tables exist, but admin user was accidentally deleted.

**Handling:**
- `isFirstRun()` returns `true`
- Seeds run again with idempotent logic
- Admin user re-created via `onConflictDoNothing`
- No data loss for other users

#### **Case 3: Fresh Database After Migration**

**Scenario:** All migrations applied, but no seeds run yet.

**Handling:**
- `isFirstRun()` correctly returns `true`
- All essential seeds execute
- Production starts with clean RBAC system

### 3.3 Reset Mechanism (Testing)

**Development Reset Script:**
```bash
# package.json script
"db:reset": "tsx src/db/reset.ts"
```

**reset.ts Implementation:**
```typescript
import { unlinkSync, existsSync } from 'node:fs';
import { getDatabasePath } from '@escapeplan/contracts/paths';

const dbPath = getDatabasePath();

console.log('[Reset] WARNING: Deleting database file...');
console.log(`[Reset] Path: ${dbPath}`);

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log('[Reset] ✅ Database deleted');
} else {
  console.log('[Reset] No database file found');
}

console.log('[Reset] Run "pnpm db:seed" to recreate');
```

**Testing Workflow:**
```bash
# Reset database
pnpm --filter escapeplan-api db:reset

# Re-run migrations + seeds
pnpm --filter escapeplan-api db:seed

# Verify first-run detection
pnpm --filter escapeplan-api db:seed  # Should skip
```

---

## 4. Production Data Preservation

### 4.1 User-Modifiable Data Inventory

**Critical User Data (NEVER overwrite):**

| Table | Description | Protection Strategy |
|-------|-------------|---------------------|
| `user` | Operator/customer accounts | `onConflictDoNothing` |
| `session` | Better Auth sessions | Never seeded |
| `account` | Better Auth credentials | `onConflictDoNothing` |
| `bookings` | Game reservations | Never seeded |
| `sessions` | Live game sessions | Never seeded |
| `games` | Custom games added by operators | Check before insert |
| `game_puzzles` | Custom puzzles | Check before insert |
| `assets` | Uploaded media files | Never seeded |
| `cameras` | Camera configurations | Never seeded |
| `system_logs` | Application logs | Never seeded |
| `alerts` | System alerts | Never seeded |

**System Configuration (Preserve edits, allow new keys):**

| Table | Description | Update Strategy |
|-------|-------------|-----------------|
| `system_settings` | Editable settings | `onConflictDoNothing` (respect edits) |
| `alert_rules` | Alert templates | `INSERT OR REPLACE` (allow template updates) |
| `network_profiles` | Wi-Fi config | `onConflictDoNothing` after first run |

**RBAC System (Seed-managed, allow extensions):**

| Table | Description | Update Strategy |
|-------|-------------|-----------------|
| `roles` | System + custom roles | `onConflictDoNothing` (system roles immutable) |
| `permissions` | System permissions | `onConflictDoNothing` (allow custom perms) |
| `role_permissions` | Permission grants | Check existence before insert |

### 4.2 Protection Mechanisms

#### **Drizzle ORM: onConflictDoNothing**

**Use Case:** Drizzle ORM insert operations.

```typescript
// Example: Admin user creation
await db.insert(user)
  .values({
    id: 'admin-user-id',
    email: 'admin@escapeplan.local',
    name: 'System Administrator',
    // ...
  })
  .onConflictDoNothing();  // If email/id exists, skip silently
```

**Benefits:**
- Type-safe
- Idempotent
- No exception thrown on conflict

**Limitations:**
- Cannot update existing rows
- Must use for entire insert set (no partial updates)

---

#### **Raw SQL: INSERT OR IGNORE**

**Use Case:** better-sqlite3 prepared statements.

```typescript
// Example: Permission seeding
db.prepare(`
  INSERT OR IGNORE INTO permissions (id, name, label, category)
  VALUES (?, ?, ?, ?)
`).run(permId, name, label, category);
```

**Benefits:**
- Works with raw SQL
- Atomic operation
- No conditional logic needed

**Limitations:**
- No type safety
- Silent failures (no feedback if row skipped)

---

#### **Check-Then-Insert Pattern**

**Use Case:** Complex logic requiring conditional updates.

```typescript
// Example: Role-permission mapping
const exists = db.prepare(`
  SELECT 1 FROM role_permissions
  WHERE role_id = ? AND permission_id = ?
`).get(roleId, permId);

if (!exists) {
  db.prepare(`
    INSERT INTO role_permissions (id, role_id, permission_id)
    VALUES (?, ?, ?)
  `).run(uuid(), roleId, permId);
  console.log(`✅ Granted ${permId} to ${roleId}`);
} else {
  console.log(`⏭️  Permission already granted`);
}
```

**Benefits:**
- Explicit control
- Logging opportunity
- Can handle complex conditions

**Limitations:**
- Not atomic (requires transaction wrapper)
- More verbose

---

### 4.3 Update Strategies for System Data

**Scenario 1: New System Setting Added**

**Problem:** Version 0.2.0 adds a new setting `SETTING_KEYS.STORAGE.MAX_BACKUP_SIZE_MB`.

**Strategy:**
```typescript
// In 02-system-defaults.ts
const newSetting = {
  key: 'storage.max_backup_size_mb',
  value: '500',
  type: 'number',
  category: 'storage',
  label: 'Max Backup Size (MB)',
  is_editable: true
};

await db.insert(systemSettings)
  .values(newSetting)
  .onConflictDoNothing();  // Inserts only if key doesn't exist
```

**Result:** New setting added, existing settings untouched.

---

**Scenario 2: Alert Rule Template Updated**

**Problem:** Version 0.3.0 improves the `low_time` alert message template.

**Strategy:**
```typescript
// In 02-system-defaults.ts
db.prepare(`
  INSERT OR REPLACE INTO alert_rules (id, name, message_template, ...)
  VALUES ('low_time', 'low_time', '⏱ {{gameName}}: {{remaining_minutes}} minutes left!', ...)
`).run();
```

**Result:** Template updated. If operator disabled the rule (`enabled = 0`), re-run will re-enable it. **Trade-off accepted** to ensure latest templates deployed.

**Alternative (Preserve User State):**
```typescript
const existing = db.prepare(`SELECT enabled FROM alert_rules WHERE id = 'low_time'`).get();

db.prepare(`
  INSERT OR REPLACE INTO alert_rules (id, name, message_template, enabled, ...)
  VALUES ('low_time', 'low_time', 'new template', ?, ...)
`).run(existing?.enabled ?? 1);  // Preserve enabled state if exists
```

---

**Scenario 3: Permission Label Changed**

**Problem:** Version 0.4.0 renames permission label from "View dashboard" to "View operator dashboard".

**Strategy:**
```typescript
// Migration approach: Use a migration, not a seed
// File: drizzle/0005_update_permission_labels.sql

UPDATE permissions
SET label = 'View operator dashboard'
WHERE name = 'view_dashboard';
```

**Why Migration?**
- Updating existing data = data transformation
- Migrations provide version control for data changes
- Ensures change applied exactly once

---

### 4.4 Migration Testing Against Production-Like Data

**Test Database Setup:**
```typescript
// tests/fixtures/production-like-db.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle({ client: sqlite, schema });

  // Apply all migrations
  migrate(db, { migrationsFolder: './drizzle' });

  // Seed with production-like data
  seedProductionLikeData(db);

  return { db, sqlite };
}

function seedProductionLikeData(db: any) {
  // Insert 50 users (mix of operators and customers)
  // Insert 10 games with 100+ puzzles
  // Insert 500 bookings spanning 6 months
  // Insert 100 completed sessions with hints
  // Insert 1000+ system logs
}
```

**Migration Test:**
```typescript
// tests/migrations/0005_add_game_tags.test.ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../fixtures/production-like-db.ts';

describe('Migration 0005: Add game_tags column', () => {
  it('should add column without data loss', () => {
    const { db, sqlite } = createTestDb();

    // Get pre-migration game count
    const beforeCount = sqlite.prepare(`SELECT COUNT(*) as count FROM games`).get().count;

    // Apply migration
    sqlite.exec(`
      ALTER TABLE games ADD COLUMN game_tags TEXT DEFAULT '[]';
    `);

    // Verify no data loss
    const afterCount = sqlite.prepare(`SELECT COUNT(*) as count FROM games`).get().count;
    expect(afterCount).toBe(beforeCount);

    // Verify column exists
    const columns = sqlite.prepare(`PRAGMA table_info(games)`).all();
    const tagsColumn = columns.find(col => col.name === 'game_tags');
    expect(tagsColumn).toBeDefined();
    expect(tagsColumn.dflt_value).toBe("'[]'");
  });
});
```

---

## 5. Migration Workflow

### 5.1 Current State: Dangerous Push Workflow

**Current Command:**
```bash
cd apps/escapeplan-api
npx drizzle-kit push
```

**Problems:**
- No migration files generated (no version history)
- Direct schema sync (no review opportunity)
- No rollback possible
- Production data at risk
- No CI/CD integration

**When Push is Acceptable:**
- Local development only
- Database can be wiped freely
- Rapid prototyping phase

---

### 5.2 Target State: Migration-Based Workflow

```
Developer Flow:
┌─────────────────────────────────────────┐
│ 1. Edit schema.ts                       │
│    - Add column, change type, etc.      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 2. Generate migration                   │
│    $ npx drizzle-kit generate           │
│    → Creates drizzle/NNNN_name.sql      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 3. Review migration SQL                 │
│    - Check for destructive changes      │
│    - Verify backward compatibility      │
│    - Add data transformations if needed │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 4. Test migration locally               │
│    $ npx drizzle-kit migrate            │
│    $ pnpm test                          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 5. Commit migration files               │
│    git add drizzle/NNNN_*.sql           │
│    git add drizzle/meta/*.json          │
│    git commit -m "migration: add tags"  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 6. PR Review + CI Tests                 │
│    - Migration SQL reviewed by team     │
│    - Tests run against migration        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 7. Merge to main                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 8. Production Deployment                │
│    - Pre-deployment backup triggered    │
│    - Migrations auto-applied on startup │
│    - Post-migration verification        │
└─────────────────────────────────────────┘
```

---

### 5.3 Development Workflow

**Step-by-Step:**

```bash
# 1. Make schema change
vim packages/contracts/src/schema.ts
# Add: export const gameTags = sqliteTable('game_tags', { ... });

# 2. Rebuild contracts (required before API can import)
pnpm --filter @escapeplan/contracts build

# 3. Generate migration
cd apps/escapeplan-api
npx drizzle-kit generate

# Output:
# ✅ Generated drizzle/0001_add_game_tags.sql
# ✅ Updated drizzle/meta/_journal.json

# 4. Review generated SQL
cat drizzle/0001_add_game_tags.sql
# Verify it's safe (no DROP without backup, no data loss)

# 5. Apply migration locally
npx drizzle-kit migrate

# 6. Test application
pnpm test
pnpm dev  # Manual testing

# 7. Commit migration
git add drizzle/0001_add_game_tags.sql
git add drizzle/meta/
git commit -m "migration: add game_tags table for categorization"
```

**Important:**
- NEVER edit generated `.sql` files directly
- If migration is wrong, delete it and regenerate
- Once committed to main, migrations are immutable

---

### 5.4 Staging Workflow

**Staging Environment Setup:**
```bash
# Staging server (pre-production Raspberry Pi)
DATABASE_PATH=/var/lib/escapeplan/staging.db
```

**Deployment Process:**
```bash
# 1. Pull latest code
git pull origin main

# 2. Backup staging database
node src/db/backup.ts --path /var/lib/escapeplan/staging.db

# 3. Apply migrations
npx drizzle-kit migrate

# 4. Run seeds (idempotent, safe)
pnpm db:seed

# 5. Restart API
systemctl restart escapeplan-api

# 6. Verify
curl http://localhost:4000/api/health
```

**Rollback on Failure:**
```bash
# Restore backup
cp /var/lib/escapeplan/backups/staging-20251004-120000.db /var/lib/escapeplan/staging.db

# Restart API
systemctl restart escapeplan-api
```

---

### 5.5 Production Workflow

**Pre-Deployment Checklist:**
- [ ] Migration tested in development
- [ ] Migration tested in staging
- [ ] Backup verified restorable
- [ ] Rollback plan documented
- [ ] Team notified of deployment window

**Deployment Script (safe-migrate.ts):**
```typescript
/**
 * Production-safe migration runner
 * 1. Creates backup
 * 2. Applies migrations
 * 3. Verifies success
 * 4. Auto-rollback on failure
 */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './client.ts';
import { createBackup } from './backup.ts';
import { resolve } from 'node:path';

const migrationsPath = resolve(import.meta.dirname, '../../drizzle');

export async function safeMigrate() {
  console.log('[Migration] Starting safe migration process...');

  try {
    // 1. Create pre-migration backup
    console.log('[Migration] Creating backup...');
    const backupPath = await createBackup({
      reason: 'pre-migration',
      includeAssets: false  // Schema backup only
    });
    console.log(`[Migration] Backup created: ${backupPath}`);

    // 2. Begin transaction
    sqlite.exec('BEGIN EXCLUSIVE TRANSACTION');

    try {
      // 3. Apply migrations
      console.log('[Migration] Applying migrations...');
      migrate(db, { migrationsFolder: migrationsPath });

      // 4. Verify migration success
      console.log('[Migration] Verifying database integrity...');
      const integrity = sqlite.prepare('PRAGMA integrity_check').get();
      if (integrity.integrity_check !== 'ok') {
        throw new Error(`Database integrity check failed: ${integrity.integrity_check}`);
      }

      // 5. Commit transaction
      sqlite.exec('COMMIT');
      console.log('[Migration] ✅ Migrations applied successfully');

    } catch (error) {
      // Rollback transaction on any error
      sqlite.exec('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    console.log('[Migration] Restore backup with: pnpm db:restore <backup-path>');
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  await safeMigrate();
  process.exit(0);
}
```

**Production Deployment:**
```bash
# 1. SSH to production Pi
ssh pi@escapeplan.local

# 2. Stop API (prevents writes during migration)
sudo systemctl stop escapeplan-api

# 3. Pull latest code
cd /opt/escapeplan/api
git pull origin main

# 4. Run safe migration
pnpm db:migrate:safe

# Output:
# [Migration] Creating backup...
# [Migration] Backup created: /var/lib/escapeplan/backups/db-20251004-143022.tar.gz
# [Migration] Applying migrations...
# [Migration] Verifying database integrity...
# [Migration] ✅ Migrations applied successfully

# 5. Restart API
sudo systemctl start escapeplan-api

# 6. Verify
curl http://localhost:4000/api/health
```

---

### 5.6 Emergency Hotfix Workflow

**Scenario:** Critical bug requires immediate schema change in production.

**Process:**
```bash
# 1. Create hotfix branch
git checkout -b hotfix/fix-session-timestamps

# 2. Make minimal schema change
vim packages/contracts/src/schema.ts

# 3. Generate migration
cd apps/escapeplan-api
npx drizzle-kit generate

# 4. Test locally with production backup
pnpm db:reset
# Restore production backup copy
sqlite3 data/escapeplan.db < prod-backup.sql
# Apply migration
npx drizzle-kit migrate
# Verify fix
pnpm test

# 5. Fast-track PR review
git commit -am "hotfix: correct session timestamp defaults"
git push origin hotfix/fix-session-timestamps
# Create PR, request urgent review

# 6. Merge after approval
git checkout main
git merge hotfix/fix-session-timestamps

# 7. Deploy to production immediately
# (Follow production workflow above)

# 8. Post-deployment monitoring
# Check logs for errors
journalctl -u escapeplan-api -f
```

**Hotfix Criteria:**
- Data corruption risk
- Authentication failures
- System crash loops
- Foreign key violations

**NOT Hotfix-Eligible:**
- Feature additions
- Performance optimizations
- UI changes
- Non-critical bugs

---

## 6. Safe Migration Execution

### 6.1 Pre-Migration Checklist

**Before running ANY migration:**

- [ ] **Backup exists:** Database backup created in last 24 hours
- [ ] **Migrations reviewed:** All pending `.sql` files reviewed by developer
- [ ] **Tests passing:** `pnpm test` shows 100% pass rate
- [ ] **Rollback plan:** Documented steps to restore from backup
- [ ] **Downtime acceptable:** If migration requires API shutdown, stakeholders notified
- [ ] **Disk space:** Sufficient space for backup + migration overhead (check `df -h`)
- [ ] **No active sessions:** Production: ensure no live game sessions running

**Automated Check Script (pre-migrate.ts):**
```typescript
export async function preMigrationChecks(): Promise<boolean> {
  const checks = [
    { name: 'Database file exists', fn: checkDatabaseExists },
    { name: 'Recent backup available', fn: checkRecentBackup },
    { name: 'Sufficient disk space', fn: checkDiskSpace },
    { name: 'Foreign keys enabled', fn: checkForeignKeys },
    { name: 'WAL mode enabled', fn: checkWalMode },
  ];

  for (const check of checks) {
    const result = await check.fn();
    if (!result) {
      console.error(`❌ ${check.name} FAILED`);
      return false;
    }
    console.log(`✅ ${check.name}`);
  }

  return true;
}
```

---

### 6.2 Backup Integration

**Automatic Backup on Migration:**
```typescript
// In safe-migrate.ts
import { createBackup } from './backup.ts';

const backupPath = await createBackup({
  reason: 'pre-migration',
  includeAssets: false,  // Only backup database, not media files
  compress: true
});

console.log(`Backup: ${backupPath}`);
// Proceed with migration...
```

**Backup Function (backup.ts):**
```typescript
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDatabasePath } from '@escapeplan/contracts/paths';
import tar from 'tar';

export interface BackupOptions {
  reason: string;
  includeAssets?: boolean;
  compress?: boolean;
}

export async function createBackup(options: BackupOptions): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const backupDir = resolve('/var/lib/escapeplan/backups');
  mkdirSync(backupDir, { recursive: true });

  const dbPath = getDatabasePath();
  const backupName = `db-${options.reason}-${timestamp}`;

  if (options.compress) {
    const tarPath = resolve(backupDir, `${backupName}.tar.gz`);

    await tar.create(
      { gzip: true, file: tarPath },
      [dbPath]
    );

    return tarPath;
  } else {
    const backupPath = resolve(backupDir, `${backupName}.db`);
    copyFileSync(dbPath, backupPath);
    return backupPath;
  }
}
```

---

### 6.3 Migration Execution Wrapper

**Wrapper Benefits:**
- Atomic transactions
- Automatic backup
- Integrity checks
- Rollback on failure
- Logging

**Implementation (safe-migrate.ts):**
```typescript
export async function safeMigrate(): Promise<void> {
  const logger = createLogger('migration');

  try {
    // Pre-checks
    logger.info('Running pre-migration checks...');
    const checksPass = await preMigrationChecks();
    if (!checksPass) {
      throw new Error('Pre-migration checks failed');
    }

    // Backup
    logger.info('Creating backup...');
    const backupPath = await createBackup({
      reason: 'pre-migration',
      includeAssets: false
    });
    logger.info(`Backup created: ${backupPath}`);

    // Migration
    logger.info('Applying migrations...');
    sqlite.exec('BEGIN EXCLUSIVE TRANSACTION');

    try {
      migrate(db, { migrationsFolder: migrationsPath });

      // Verify
      logger.info('Verifying integrity...');
      const integrity = sqlite.prepare('PRAGMA integrity_check').get();
      if (integrity.integrity_check !== 'ok') {
        throw new Error('Integrity check failed');
      }

      // Commit
      sqlite.exec('COMMIT');
      logger.info('✅ Migration successful');

    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    logger.error('Restore backup to recover');
    throw error;
  }
}
```

---

### 6.4 Post-Migration Verification

**Verification Steps:**
```typescript
export async function verifyMigration(): Promise<void> {
  // 1. Integrity check
  const integrity = sqlite.prepare('PRAGMA integrity_check').get();
  assert(integrity.integrity_check === 'ok', 'Database corrupted');

  // 2. Foreign key check
  const fkViolations = sqlite.prepare('PRAGMA foreign_key_check').all();
  assert(fkViolations.length === 0, `Foreign key violations: ${fkViolations.length}`);

  // 3. Table count (should match schema)
  const tables = sqlite.prepare(`
    SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table'
  `).get();
  assert(tables.count >= 30, 'Missing tables after migration');

  // 4. Critical data exists
  const adminUser = sqlite.prepare(`
    SELECT id FROM user WHERE email = 'admin@escapeplan.local'
  `).get();
  assert(adminUser, 'Admin user missing after migration');

  console.log('✅ All post-migration checks passed');
}
```

---

### 6.5 Rollback Triggers

**When to Rollback:**
1. `PRAGMA integrity_check` fails
2. Foreign key violations detected
3. Critical query fails (admin user missing, etc.)
4. Application fails to start after migration
5. User reports data loss

**Rollback Process:**
```bash
# 1. Stop API
sudo systemctl stop escapeplan-api

# 2. Restore backup
pnpm db:restore /var/lib/escapeplan/backups/db-pre-migration-20251004.tar.gz

# 3. Restart API
sudo systemctl start escapeplan-api

# 4. Verify restoration
curl http://localhost:4000/api/health
```

**Restore Script (restore.ts):**
```typescript
import { unlinkSync, copyFileSync } from 'node:fs';
import { getDatabasePath } from '@escapeplan/contracts/paths';
import tar from 'tar';

export async function restoreBackup(backupPath: string): Promise<void> {
  const dbPath = getDatabasePath();

  console.log(`[Restore] Restoring from ${backupPath}...`);

  // Delete current database
  unlinkSync(dbPath);

  // Extract backup
  if (backupPath.endsWith('.tar.gz')) {
    await tar.extract({ file: backupPath, cwd: dirname(dbPath) });
  } else {
    copyFileSync(backupPath, dbPath);
  }

  console.log('[Restore] ✅ Database restored successfully');
}
```

---

## 7. Migration File Structure

### 7.1 Naming Convention

**Format:** `NNNN_description.sql`

**Examples:**
```
drizzle/0001_initial_schema.sql
drizzle/0002_add_game_tags.sql
drizzle/0003_alter_user_bio_length.sql
drizzle/0004_create_audit_log.sql
drizzle/0005_add_booking_notes.sql
```

**Rules:**
- **NNNN**: 4-digit zero-padded sequential number
- **description**: Snake_case, descriptive, max 50 chars
- **Extension**: `.sql` only
- **Generated by:** `drizzle-kit generate` (DO NOT manually create)

---

### 7.2 Directory Organization

```
apps/escapeplan-api/drizzle/
├── meta/
│   ├── _journal.json           # Migration history (managed by Drizzle)
│   ├── 0001_snapshot.json      # Schema snapshot per migration
│   ├── 0002_snapshot.json
│   └── ...
├── triggers.sql                # Custom triggers (applied manually)
├── 0001_initial_schema.sql     # Generated migrations
├── 0002_add_game_tags.sql
├── 0003_alter_user_bio.sql
└── README.md                   # Migration documentation

apps/escapeplan-api/src/db/seeds/
├── index.ts                    # Seed orchestrator
├── 01-essential.ts             # RBAC + admin user
├── 02-system-defaults.ts       # Settings + alerts + network
├── 03-demo-fixtures.ts         # Demo game (dev only)
└── utils/
    ├── first-run-detector.ts   # isFirstRun() logic
    └── seed-logger.ts          # Structured logging
```

---

### 7.3 Custom Migration Scripts (Data Transforms)

**When Needed:**
- Migrating data between tables
- Backfilling computed columns
- Normalizing denormalized data
- Complex data transformations

**Example: Migrate game categories from JSON array to junction table**

**Generated Migration (0006_create_game_categories.sql):**
```sql
-- Auto-generated by drizzle-kit
CREATE TABLE game_categories (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_categories_game_id ON game_categories(game_id);
```

**Custom Data Migration (0006_migrate_categories_data.sql):**
```sql
-- Custom data transformation
-- Backfill game_categories from games.categories JSON

INSERT INTO game_categories (id, game_id, category)
SELECT
  hex(randomblob(16)) as id,
  games.id as game_id,
  json_each.value as category
FROM games, json_each(games.categories)
WHERE games.categories IS NOT NULL;

-- Verify migration
SELECT COUNT(*) FROM game_categories;
-- Expected: Sum of all category array lengths
```

**Execution:**
```bash
# Apply schema migration first
npx drizzle-kit migrate

# Apply data migration
sqlite3 data/escapeplan.db < drizzle/0006_migrate_categories_data.sql

# Verify
sqlite3 data/escapeplan.db "SELECT * FROM game_categories LIMIT 10;"
```

**Best Practice:**
- Keep custom migrations in same directory: `drizzle/0006_migrate_categories_data.sql`
- Document in migration README
- Include verification queries
- Test on production backup first

---

### 7.4 Trigger SQL File Management

**Current State:**
- Single file: `drizzle/triggers.sql`
- Contains 5 security triggers for user_type enforcement
- Manually applied (not managed by Drizzle migrations)

**Problem:**
- Triggers not versioned
- No automatic application
- Can be forgotten during setup

**Solution: Include triggers in migration workflow**

**Migration: 0001_initial_schema.sql**
```sql
-- Tables created by Drizzle...

-- Apply security triggers
-- Trigger 1: Prevent customers from having operator roles
CREATE TRIGGER prevent_customer_operator_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'customer'
  AND NEW.role_id IN (SELECT id FROM roles WHERE user_type_scope = 'operator')
BEGIN
  SELECT RAISE(ABORT, 'Customers cannot have operator-only roles');
END;

-- Trigger 2-5: (rest of triggers)
...
```

**Benefit:** Triggers applied atomically with schema creation.

**Alternative: Separate Trigger Migrations**
```
drizzle/0001_initial_schema.sql       # Tables only
drizzle/0002_add_user_triggers.sql    # Triggers only
drizzle/0003_add_booking_triggers.sql # Additional triggers
```

**Recommended Approach:**
- Include triggers in initial schema migration
- Update triggers via new migrations when logic changes
- Use `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER` to allow updates

---

## 8. Drizzle Configuration Updates

### 8.1 Current Configuration

**File:** `apps/escapeplan-api/drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit';
import { getDatabasePath } from '@escapeplan/contracts/paths';

export default defineConfig({
  schema: '../../packages/contracts/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabasePath()
  }
});
```

**Limitations:**
- No strict mode enforcement
- No verbose logging
- No migration table customization
- No introspection options

---

### 8.2 Enhanced Configuration

```typescript
import { defineConfig } from 'drizzle-kit';
import { getDatabasePath } from '@escapeplan/contracts/paths';

export default defineConfig({
  schema: '../../packages/contracts/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',

  dbCredentials: {
    url: getDatabasePath()
  },

  // Migration settings
  migrations: {
    table: '__drizzle_migrations',  // Default, explicit for clarity
    schema: 'public'                // Not applicable for SQLite, but documented
  },

  // Strict mode: fail on dangerous changes
  strict: true,

  // Verbose output for debugging
  verbose: true,

  // Introspection settings
  introspect: {
    casing: 'preserve'  // Keep original table/column names
  },

  // Breakpoints for manual review (pause on destructive changes)
  breakpoints: true
});
```

---

### 8.3 Migration Table Configuration

**Drizzle Migration Tracking Table:**
```sql
CREATE TABLE __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

**Purpose:**
- Tracks which migrations have been applied
- Prevents duplicate execution
- Stores hash of migration SQL for integrity checking

**Custom Table Name (if desired):**
```typescript
export default defineConfig({
  migrations: {
    table: 'schema_migrations'  // Custom name
  }
});
```

**Recommendation:** Keep default `__drizzle_migrations` for consistency with Drizzle conventions.

---

### 8.4 Strict Mode Settings

**What Strict Mode Does:**
- Warns on column type changes that may lose data (TEXT → INTEGER)
- Warns on column deletions without explicit DROP
- Requires explicit handling of NOT NULL constraints
- Fails on ambiguous schema changes

**Example Warning:**
```bash
$ npx drizzle-kit generate

⚠️  WARNING: Potential data loss detected
    Column 'games.categories' type change: TEXT → JSON
    This may result in data conversion errors.

    Add explicit migration step:
    1. Create new column 'categories_json'
    2. Migrate data with validation
    3. Drop old column 'categories'
```

**Override Strict Mode (not recommended):**
```typescript
export default defineConfig({
  strict: false  // Allows dangerous changes without warnings
});
```

---

### 8.5 Generate vs Push Usage Guidelines

| Command | Use Case | Safety | Output | Production-Safe? |
|---------|----------|--------|--------|------------------|
| `drizzle-kit push` | Local dev, rapid prototyping | ⚠️ Low | Direct DB changes | ❌ NO |
| `drizzle-kit generate` | Production, team workflows | ✅ High | .sql migration files | ✅ YES |
| `drizzle-kit migrate` | Apply generated migrations | ✅ High | Updates migration table | ✅ YES |

**Decision Tree:**
```
Need to change schema?
  │
  ├─ Local development, throwaway database?
  │  └─ Use: drizzle-kit push
  │
  └─ Staging/production, or team collaboration?
     └─ Use: drizzle-kit generate → review → drizzle-kit migrate
```

**Enforce in CI/CD:**
```yaml
# .github/workflows/ci.yml
- name: Check for uncommitted migrations
  run: |
    npx drizzle-kit generate --dry-run
    if [ -n "$(git status --porcelain drizzle/)" ]; then
      echo "❌ Uncommitted migrations detected. Run 'npx drizzle-kit generate' and commit."
      exit 1
    fi
```

---

## 9. Migration Safety Checks

### 9.1 Check 1: No Placeholders in Migrations

**Problem:** Generated migrations with `?` placeholders or `@param` syntax.

**Detection:**
```typescript
export function checkForPlaceholders(migrationSql: string): boolean {
  const placeholderPatterns = [
    /\?/,                    // Prepared statement placeholders
    /@\w+/,                  // Named parameters
    /\$\d+/,                 // Positional parameters
    /:\w+/                   // Colon-prefixed parameters
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(migrationSql)) {
      console.error(`❌ Migration contains placeholder: ${pattern}`);
      return false;
    }
  }

  return true;
}
```

**Why This Matters:**
- Migrations should be static SQL only
- Placeholders indicate parameterized queries (wrong context)
- Drizzle should generate complete DDL statements

**Example Bad Migration:**
```sql
-- ❌ BAD: Contains placeholder
INSERT INTO roles (id, name) VALUES (?, ?);
```

**Example Good Migration:**
```sql
-- ✅ GOOD: Static values or no data operations
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
```

---

### 9.2 Check 2: Foreign Key Integrity Preserved

**Problem:** Migration drops table with foreign key references, orphaning child records.

**Detection:**
```typescript
export function checkForeignKeyIntegrity(migrationSql: string): boolean {
  const dropTablePattern = /DROP TABLE (\w+)/gi;
  const matches = migrationSql.matchAll(dropTablePattern);

  for (const match of matches) {
    const tableName = match[1];

    // Check if any tables reference this table
    const references = sqlite.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
      AND sql LIKE '%REFERENCES ${tableName}%'
    `).all();

    if (references.length > 0) {
      console.error(`❌ Cannot drop ${tableName}: ${references.length} foreign key references exist`);
      return false;
    }
  }

  return true;
}
```

**Automated Fix:**
```sql
-- ❌ BAD: Drops parent table first
DROP TABLE roles;
DROP TABLE role_permissions;

-- ✅ GOOD: Drops child table first, or uses CASCADE
DROP TABLE role_permissions;
DROP TABLE roles;

-- OR with CASCADE (SQLite 3.6.19+)
PRAGMA foreign_keys = ON;
DROP TABLE roles CASCADE;
```

---

### 9.3 Check 3: Indexes Created for Performance

**Problem:** Foreign key columns without indexes cause slow queries.

**Detection:**
```typescript
export function checkForeignKeyIndexes(migrationSql: string): boolean {
  const fkPattern = /REFERENCES (\w+)\((\w+)\)/gi;
  const indexPattern = /CREATE INDEX \w+ ON \w+\((\w+)\)/gi;

  const foreignKeys = [...migrationSql.matchAll(fkPattern)];
  const indexes = [...migrationSql.matchAll(indexPattern)];

  for (const fk of foreignKeys) {
    const refColumn = fk[2];
    const hasIndex = indexes.some(idx => idx[1] === refColumn);

    if (!hasIndex) {
      console.warn(`⚠️  Foreign key on ${refColumn} missing index`);
      // Not critical, but recommended
    }
  }

  return true;
}
```

**Best Practice Migration:**
```sql
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES user(id)
);

-- Add indexes for foreign keys
CREATE INDEX idx_bookings_game_id ON bookings(game_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
```

---

### 9.4 Check 4: No Data Loss in Column Changes

**Problem:** Column type change causes data truncation or loss.

**Detection:**
```typescript
export function checkColumnTypeChanges(migrationSql: string): boolean {
  const alterPattern = /ALTER TABLE (\w+) ALTER COLUMN (\w+) (\w+)/gi;
  const matches = migrationSql.matchAll(alterPattern);

  for (const match of matches) {
    const [_, table, column, newType] = match;

    // Get current type
    const currentType = sqlite.prepare(`
      SELECT type FROM pragma_table_info('${table}') WHERE name = '${column}'
    `).get()?.type;

    // Check for dangerous conversions
    if (currentType === 'TEXT' && newType === 'INTEGER') {
      console.error(`❌ Dangerous conversion: ${table}.${column} TEXT → INTEGER may lose data`);
      return false;
    }
  }

  return true;
}
```

**Safe Migration Pattern:**
```sql
-- ❌ DANGEROUS: Direct type change
ALTER TABLE games ALTER COLUMN duration_minutes TEXT;

-- ✅ SAFE: Create new column, migrate, drop old
ALTER TABLE games ADD COLUMN duration_minutes_int INTEGER;
UPDATE games SET duration_minutes_int = CAST(duration_minutes AS INTEGER);
-- Verify all conversions succeeded
SELECT COUNT(*) FROM games WHERE duration_minutes_int IS NULL AND duration_minutes IS NOT NULL;
-- If 0, proceed:
ALTER TABLE games DROP COLUMN duration_minutes;
ALTER TABLE games RENAME COLUMN duration_minutes_int TO duration_minutes;
```

---

### 9.5 Check 5: Backwards Compatibility Verification

**Problem:** Migration breaks existing application code.

**Example:**
```sql
-- Migration renames column
ALTER TABLE user RENAME COLUMN name TO display_name;
```

**Impact:**
- All queries selecting `name` fail
- API endpoints return incorrect data
- Frontend displays undefined values

**Detection Strategy:**
1. **Schema Diff Tool:** Compare before/after schema
2. **Query Analysis:** Parse application SQL/ORM queries
3. **Integration Tests:** Run full test suite against migrated DB

**Backwards-Compatible Pattern:**
```sql
-- Step 1: Add new column (Migration 0008)
ALTER TABLE user ADD COLUMN display_name TEXT;
UPDATE user SET display_name = name WHERE display_name IS NULL;

-- Step 2: Update application code to use display_name (Deploy v0.3.0)

-- Step 3: Drop old column (Migration 0009, after deploy)
ALTER TABLE user DROP COLUMN name;
```

**Benefits:**
- Zero downtime deployment
- Rollback-friendly (old code still works with new schema)
- Gradual transition

---

### 9.6 Check 6: Rollback SQL Generated (Where Possible)

**Problem:** No automated way to undo migration.

**Solution: Generate inverse migrations**

**Example Forward Migration (0005_add_game_tags.sql):**
```sql
CREATE TABLE game_tags (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  tag TEXT NOT NULL
);

CREATE INDEX idx_game_tags_game_id ON game_tags(game_id);
```

**Rollback Migration (0005_add_game_tags.down.sql):**
```sql
DROP INDEX idx_game_tags_game_id;
DROP TABLE game_tags;
```

**Automated Generation:**
```typescript
export function generateRollback(forwardSql: string): string {
  const statements = parseSQL(forwardSql);
  const rollback: string[] = [];

  for (const stmt of statements.reverse()) {
    if (stmt.type === 'CREATE_TABLE') {
      rollback.push(`DROP TABLE ${stmt.tableName};`);
    } else if (stmt.type === 'CREATE_INDEX') {
      rollback.push(`DROP INDEX ${stmt.indexName};`);
    } else if (stmt.type === 'ALTER_TABLE_ADD_COLUMN') {
      rollback.push(`ALTER TABLE ${stmt.tableName} DROP COLUMN ${stmt.columnName};`);
    }
    // Note: Not all changes are reversible (data migrations)
  }

  return rollback.join('\n');
}
```

**Limitations:**
- Data migrations (UPDATE, DELETE) cannot be auto-reversed
- Column drops lose data permanently
- Complex transformations require manual rollback scripts

---

### 9.7 Check 7: Dry-Run Capability

**Problem:** No way to preview migration effects without applying.

**Implementation:**
```typescript
export async function dryRunMigration(migrationPath: string): Promise<void> {
  // Create in-memory copy of database
  const tempDb = new Database(':memory:');

  // Copy schema from production DB
  const schemaDump = sqlite.prepare(`
    SELECT sql FROM sqlite_master WHERE sql IS NOT NULL
  `).all();

  for (const { sql } of schemaDump) {
    tempDb.exec(sql);
  }

  // Copy data (sample only for performance)
  const tables = sqlite.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table'
  `).all();

  for (const { name } of tables) {
    const rows = sqlite.prepare(`SELECT * FROM ${name} LIMIT 1000`).all();
    // Insert into tempDb...
  }

  // Apply migration to temp DB
  const migrationSql = readFileSync(migrationPath, 'utf-8');
  try {
    tempDb.exec(migrationSql);
    console.log('✅ Dry-run successful');

    // Show schema diff
    const newSchema = tempDb.prepare(`
      SELECT sql FROM sqlite_master WHERE sql IS NOT NULL
    `).all();

    console.log('Schema changes:');
    // Diff logic...

  } catch (error) {
    console.error('❌ Dry-run failed:', error);
  } finally {
    tempDb.close();
  }
}
```

**Usage:**
```bash
pnpm db:migrate:dry-run drizzle/0008_add_audit_log.sql
```

---

### 9.8 Check 8: Production Data Simulation Test

**Problem:** Migration tested on empty DB, fails on production data.

**Solution: Load production backup into test environment**

**Test Setup:**
```typescript
// tests/migrations/0008_audit_log.test.ts
import { describe, it, beforeAll } from 'vitest';
import { loadProductionBackup } from '../fixtures/backup-loader.ts';

describe('Migration 0008: Add audit_log table', () => {
  beforeAll(async () => {
    // Load anonymized production backup
    await loadProductionBackup('prod-backup-20251001.db');
  });

  it('should apply without errors', async () => {
    const migrationSql = readFileSync('drizzle/0008_add_audit_log.sql', 'utf-8');

    expect(() => {
      testDb.exec(migrationSql);
    }).not.toThrow();
  });

  it('should preserve existing data', async () => {
    const beforeCount = testDb.prepare('SELECT COUNT(*) FROM bookings').get();

    // Apply migration
    testDb.exec(migrationSql);

    const afterCount = testDb.prepare('SELECT COUNT(*) FROM bookings').get();
    expect(afterCount).toBe(beforeCount);
  });

  it('should create audit_log table', async () => {
    const tables = testDb.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'
    `).all();

    expect(tables).toHaveLength(1);
  });
});
```

**Anonymize Production Backup:**
```typescript
export function anonymizeBackup(dbPath: string): void {
  const db = new Database(dbPath);

  // Anonymize user emails
  db.prepare(`
    UPDATE user SET email = 'user' || id || '@example.com'
  `).run();

  // Anonymize names
  db.prepare(`
    UPDATE user SET name = 'User ' || substr(id, 1, 8)
  `).run();

  // Clear sensitive fields
  db.prepare(`UPDATE user SET bio = NULL`).run();

  db.close();
}
```

---

## 10. Seed Data Management

### 10.1 Essential Production Data Inventory

**Must exist for system to function:**

| Category | Data | Seed File | Quantity |
|----------|------|-----------|----------|
| **RBAC** | Permissions | 01-essential.ts | 27 |
| **RBAC** | System roles | 01-essential.ts | 4 |
| **RBAC** | Role-permission mappings | 01-essential.ts | ~60 |
| **Auth** | Admin user | 01-essential.ts | 1 |
| **Settings** | System settings | 02-system-defaults.ts | ~20 |
| **Alerts** | Alert rules | 02-system-defaults.ts | 4 |
| **Network** | Default network profile | 02-system-defaults.ts | 1 |

**Total:** ~117 essential records

---

### 10.2 System Defaults Inventory

**Configuration data with sensible defaults:**

| Setting Key | Default Value | Category | Editable |
|-------------|---------------|----------|----------|
| `storage.max_image_size_mb` | 10 | storage | Yes |
| `storage.max_audio_size_mb` | 50 | storage | Yes |
| `storage.max_video_size_mb` | 500 | storage | Yes |
| `backup.retention_days` | 30 | backup | Yes |
| `updates.github_repo` | `kryptobaseddev/escapeplan-app` | updates | Yes |
| `updates.auto_update_enabled` | false | updates | Yes |
| `business.game_duration_min_minutes` | 15 | business | Yes |
| `business.game_duration_max_minutes` | 120 | business | Yes |
| `business.default_booking_buffer_minutes` | 15 | business | Yes |
| `user_validation.password_min_length` | 8 | user_validation | Yes |
| `system.version` | `0.1.0` (from package.json) | system | No |
| `system.install_path` | `/opt/escapeplan` | system | No |

---

### 10.3 Demo/Dev Data Inventory

**Non-production data for development:**

| Data Type | Description | Records | Seed File |
|-----------|-------------|---------|-----------|
| Demo game | Pirate Mutiny escape room | 1 | 03-demo-fixtures.ts |
| Game puzzles | 9 puzzles for Pirate game | 9 | 03-demo-fixtures.ts |
| Sample booking | Future booking for testing | 1 | 03-demo-fixtures.ts (optional) |
| Sample session | Completed session with hints | 1 | 03-demo-fixtures.ts (optional) |

**Environment Guard:**
```typescript
import { isProduction } from '@escapeplan/contracts/runtime';

export async function seedDemoFixtures() {
  if (isProduction()) {
    console.log('[Seed] Skipping demo data in production');
    return;
  }

  // Seed demo data...
}
```

---

### 10.4 Seed Execution Orchestration

**Dependency Graph:**
```
01-essential.ts (RBAC + Admin)
  └─ Requires: migrations applied
  └─ Creates: roles, permissions, role_permissions, admin user
        │
        ▼
02-system-defaults.ts (Settings + Alerts + Network)
  └─ Requires: 01-essential.ts (no dependencies, but logical order)
  └─ Creates: system_settings, alert_rules, network_profiles
        │
        ▼
03-demo-fixtures.ts (Demo Game)
  └─ Requires: 01-essential.ts (for RBAC), 02-system-defaults.ts (for settings)
  └─ Creates: games, game_puzzles
```

**Orchestrator (seeds/index.ts):**
```typescript
export async function runSeeds(options: { force?: boolean } = {}) {
  const isFirst = options.force || isFirstRun();

  if (!isFirst) {
    console.log('[Seed] Database already seeded');
    return;
  }

  // Execute in dependency order
  console.log('[Seed] Step 1/3: Essential data (RBAC + Admin)');
  await seedEssential();

  console.log('[Seed] Step 2/3: System defaults (Settings + Alerts)');
  await seedSystemDefaults();

  console.log('[Seed] Step 3/3: Demo fixtures (dev only)');
  await seedDemoFixtures();

  console.log('[Seed] ✅ Complete');
}
```

**Error Handling:**
```typescript
try {
  await seedEssential();
} catch (error) {
  console.error('[Seed] ❌ Essential seed failed:', error);
  console.error('[Seed] Cannot continue - RBAC system required');
  throw error;  // Fatal error, stop execution
}

try {
  await seedSystemDefaults();
} catch (error) {
  console.error('[Seed] ⚠️  System defaults seed failed:', error);
  console.error('[Seed] Application may work with degraded functionality');
  // Continue execution (non-fatal)
}
```

---

### 10.5 Seed Versioning Strategy

**Problem:** Seed data evolves over time (new permissions, updated alert templates).

**Solution: Version-aware seeding**

**Approach 1: Migration-Based Updates**
```sql
-- drizzle/0009_add_export_permissions.sql
INSERT OR IGNORE INTO permissions (id, name, label, category)
VALUES
  ('perm-export-sessions', 'export_sessions', 'Export session data', 'sessions'),
  ('perm-export-bookings', 'export_bookings', 'Export booking data', 'bookings');

-- Grant to admin role
INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id)
VALUES
  (hex(randomblob(16)), 'role-admin', 'perm-export-sessions'),
  (hex(randomblob(16)), 'role-admin', 'perm-export-bookings');
```

**Benefits:**
- Versioned with migrations
- Applied atomically
- No separate seed versioning needed

---

**Approach 2: Seed Version Tracking**
```typescript
// Track seed versions in database
const SEED_VERSION = '1.2.0';

export async function seedEssential() {
  const currentVersion = await getSeedVersion('essential');

  if (semver.gte(currentVersion, SEED_VERSION)) {
    console.log('[Seed] Essential data up to date');
    return;
  }

  // Run seed updates
  await updatePermissions_v1_2_0();

  // Update version
  await setSeedVersion('essential', SEED_VERSION);
}

async function getSeedVersion(seed: string): Promise<string> {
  const result = db.prepare(`
    SELECT version FROM seed_versions WHERE seed_name = ?
  `).get(seed);

  return result?.version || '0.0.0';
}
```

**Seed Versions Table:**
```sql
CREATE TABLE seed_versions (
  seed_name TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Recommendation:** Use **Approach 1** (migration-based) for simplicity. Seed versioning adds complexity without significant benefit if migrations handle schema + essential data updates.

---

## 11. Database Schema Changes

### 11.1 New Tables/Columns Needed

#### **Migration History Table (Built-in)**

**Table:** `__drizzle_migrations`

**Purpose:** Track applied migrations (managed by Drizzle).

**Schema:**
```sql
CREATE TABLE __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

**No action needed** - Drizzle creates automatically on first migration.

---

#### **Seed Execution Log (Optional)**

**Table:** `seed_execution_log`

**Purpose:** Track seed runs for debugging and audit purposes.

**Schema:**
```sql
CREATE TABLE seed_execution_log (
  id TEXT PRIMARY KEY,
  seed_name TEXT NOT NULL,  -- '01-essential', '02-system-defaults', etc.
  status TEXT NOT NULL,     -- 'success', 'failed', 'skipped'
  records_created INTEGER,
  records_updated INTEGER,
  error_message TEXT,
  executed_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Usage:**
```typescript
export async function logSeedExecution(
  seedName: string,
  status: 'success' | 'failed' | 'skipped',
  details: { created?: number; updated?: number; error?: string }
) {
  await db.insert(seedExecutionLog).values({
    id: nanoid(),
    seed_name: seedName,
    status,
    records_created: details.created || 0,
    records_updated: details.updated || 0,
    error_message: details.error || null,
    executed_at: new Date().toISOString()
  });
}
```

**Benefits:**
- Audit trail of seed runs
- Debug seed failures
- Track seed performance over time

**Recommendation:** Optional, add if debugging seed issues becomes common.

---

#### **Database Snapshots (Pre-Migration Backups)**

**Table:** `database_snapshots`

**Purpose:** Track pre-migration backups for quick rollback reference.

**Schema:**
```sql
CREATE TABLE database_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_path TEXT NOT NULL,
  reason TEXT NOT NULL,           -- 'pre-migration', 'manual', 'scheduled'
  migration_number TEXT,          -- '0008' if pre-migration snapshot
  database_size_bytes INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT                 -- Retention policy
);
```

**Usage:**
```typescript
export async function recordSnapshot(backupPath: string, reason: string, migrationNumber?: string) {
  const stats = statSync(backupPath);

  await db.insert(databaseSnapshots).values({
    id: nanoid(),
    snapshot_path: backupPath,
    reason,
    migration_number: migrationNumber || null,
    database_size_bytes: stats.size,
    created_at: new Date().toISOString(),
    expires_at: addDays(new Date(), 30).toISOString()  // 30-day retention
  });
}
```

**Cleanup Job:**
```typescript
export async function cleanupExpiredSnapshots() {
  const expired = await db
    .select()
    .from(databaseSnapshots)
    .where(sql`expires_at < datetime('now')`);

  for (const snapshot of expired) {
    unlinkSync(snapshot.snapshot_path);
    await db.delete(databaseSnapshots).where(eq(databaseSnapshots.id, snapshot.id));
  }

  console.log(`Cleaned up ${expired.length} expired snapshots`);
}
```

**Benefits:**
- Quick rollback reference (know which backup to restore)
- Automatic cleanup of old backups
- Migration audit trail

**Recommendation:** Implement for production systems.

---

## 12. Testing Strategy

### 12.1 Unit Tests for Seed Idempotency

**Goal:** Verify seeds can run multiple times without errors or duplicates.

**Test File:** `tests/seeds/idempotency.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { seedEssential } from '../../src/db/seeds/01-essential.ts';
import { seedSystemDefaults } from '../../src/db/seeds/02-system-defaults.ts';
import { createTestDb } from '../fixtures/test-db.ts';

describe('Seed Idempotency', () => {
  let testDb: any;

  beforeEach(() => {
    testDb = createTestDb();
  });

  it('should run essential seed twice without errors', async () => {
    await expect(seedEssential()).resolves.not.toThrow();
    await expect(seedEssential()).resolves.not.toThrow();
  });

  it('should not create duplicate permissions', async () => {
    await seedEssential();
    const count1 = testDb.prepare('SELECT COUNT(*) FROM permissions').get().count;

    await seedEssential();
    const count2 = testDb.prepare('SELECT COUNT(*) FROM permissions').get().count;

    expect(count2).toBe(count1);  // No duplicates
    expect(count2).toBe(27);      // Correct count
  });

  it('should not create duplicate admin user', async () => {
    await seedEssential();
    await seedEssential();

    const admins = testDb.prepare(`
      SELECT COUNT(*) FROM user WHERE email = 'admin@escapeplan.local'
    `).get().count;

    expect(admins).toBe(1);
  });
});
```

---

### 12.2 Integration Tests for Migrations

**Goal:** Verify migrations apply correctly in realistic scenarios.

**Test File:** `tests/migrations/full-workflow.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createFreshDb } from '../fixtures/test-db.ts';

describe('Migration Workflow', () => {
  it('should apply all migrations from scratch', () => {
    const db = createFreshDb();

    expect(() => {
      migrate(db, { migrationsFolder: './drizzle' });
    }).not.toThrow();

    // Verify all tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table'
    `).all();

    expect(tables.length).toBeGreaterThan(30);
  });

  it('should preserve data across migrations', () => {
    const db = createFreshDb();
    migrate(db, { migrationsFolder: './drizzle' });

    // Insert test data
    db.prepare(`
      INSERT INTO games (id, slug, name) VALUES ('test-game', 'test', 'Test Game')
    `).run();

    // Simulate new migration
    db.exec(`
      ALTER TABLE games ADD COLUMN featured INTEGER DEFAULT 0;
    `);

    // Verify data still exists
    const game = db.prepare(`SELECT * FROM games WHERE id = 'test-game'`).get();
    expect(game.name).toBe('Test Game');
    expect(game.featured).toBe(0);
  });
});
```

---

### 12.3 Production Data Simulation Approach

**Goal:** Test migrations against realistic data volumes.

**Fixture Generator:**
```typescript
// tests/fixtures/production-simulator.ts
export function generateProductionLikeData(db: any) {
  console.log('[Fixture] Generating production-like data...');

  // 1. Create 100 users (80 customers, 20 operators)
  for (let i = 0; i < 100; i++) {
    const userType = i < 80 ? 'customer' : 'operator';
    const roleId = userType === 'customer' ? 'role-customer' : 'role-game-master';

    db.prepare(`
      INSERT INTO user (id, email, name, user_type, role_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `user-${i}`,
      `user${i}@example.com`,
      `User ${i}`,
      userType,
      roleId
    );
  }

  // 2. Create 20 games
  for (let i = 0; i < 20; i++) {
    db.prepare(`
      INSERT INTO games (id, slug, name, duration_minutes, max_players)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `game-${i}`,
      `game-${i}`,
      `Escape Room ${i}`,
      60,
      6
    );
  }

  // 3. Create 1000 bookings (spanning 12 months)
  for (let i = 0; i < 1000; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 365));

    db.prepare(`
      INSERT INTO bookings (id, game_id, user_id, scheduled_at, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `booking-${i}`,
      `game-${i % 20}`,
      `user-${i % 100}`,
      date.toISOString(),
      Math.random() > 0.3 ? 'COMPLETED' : 'PENDING'
    );
  }

  console.log('[Fixture] ✅ Generated 100 users, 20 games, 1000 bookings');
}
```

**Usage in Tests:**
```typescript
describe('Migration on Large Dataset', () => {
  it('should complete within 5 seconds', () => {
    const db = createFreshDb();
    migrate(db, { migrationsFolder: './drizzle' });
    generateProductionLikeData(db);

    const start = Date.now();

    // Apply new migration
    db.exec(readFileSync('drizzle/0009_add_indexes.sql', 'utf-8'));

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);  // Must complete in <5s
  });
});
```

---

### 12.4 Rollback Testing

**Goal:** Verify rollback migrations restore original state.

**Test:**
```typescript
describe('Migration Rollback', () => {
  it('should rollback cleanly', () => {
    const db = createFreshDb();
    migrate(db, { migrationsFolder: './drizzle' });

    // Snapshot schema before migration
    const beforeSchema = db.prepare(`
      SELECT sql FROM sqlite_master WHERE type = 'table' ORDER BY name
    `).all();

    // Apply migration
    db.exec(readFileSync('drizzle/0010_add_tags.sql', 'utf-8'));

    // Rollback
    db.exec(readFileSync('drizzle/0010_add_tags.down.sql', 'utf-8'));

    // Verify schema restored
    const afterSchema = db.prepare(`
      SELECT sql FROM sqlite_master WHERE type = 'table' ORDER BY name
    `).all();

    expect(afterSchema).toEqual(beforeSchema);
  });
});
```

---

### 12.5 Performance Testing for Large Databases

**Goal:** Ensure migrations don't cause unacceptable downtime.

**Test:**
```typescript
describe('Migration Performance', () => {
  it('should handle 100k bookings without timeout', () => {
    const db = createFreshDb();
    migrate(db, { migrationsFolder: './drizzle' });

    // Generate 100k bookings
    db.exec('BEGIN TRANSACTION');
    for (let i = 0; i < 100000; i++) {
      db.prepare(`
        INSERT INTO bookings (id, game_id, user_id, scheduled_at)
        VALUES (?, 'game-1', 'user-1', datetime('now'))
      `).run(`booking-${i}`);
    }
    db.exec('COMMIT');

    // Time migration
    const start = Date.now();
    db.exec(readFileSync('drizzle/0011_add_booking_index.sql', 'utf-8'));
    const duration = Date.now() - start;

    console.log(`Migration completed in ${duration}ms`);
    expect(duration).toBeLessThan(10000);  // <10s acceptable
  });
});
```

**Acceptance Criteria:**
- Migrations on 100k records: <10 seconds
- Migrations on 1M records: <60 seconds
- Zero data loss

---

## 13. Error Handling

### 13.1 Migration Failure Scenarios

**Scenario 1: Syntax Error in Migration SQL**

**Error:**
```
[Migration] Error: near line 5: syntax error
```

**Handling:**
- Transaction auto-rolled back (no partial changes)
- Error logged with migration file name and line number
- Process exits with code 1
- Backup preserved

**Recovery:**
```bash
# Fix migration SQL
vim drizzle/0008_broken_migration.sql

# Delete migration from journal (if partially applied)
sqlite3 data/escapeplan.db "DELETE FROM __drizzle_migrations WHERE hash = 'xxx'"

# Re-apply
npx drizzle-kit migrate
```

---

**Scenario 2: Foreign Key Constraint Violation**

**Error:**
```
[Migration] Error: FOREIGN KEY constraint failed
```

**Example:**
```sql
-- Migration tries to add foreign key to non-existent table
ALTER TABLE bookings ADD COLUMN venue_id TEXT REFERENCES venues(id);
-- venues table doesn't exist yet
```

**Handling:**
- Transaction rolled back
- Error logged with table/column details
- Suggest fix: "Ensure venues table created in earlier migration"

**Prevention:**
- Migration order matters
- Create parent tables before child tables
- CI checks for dependency order

---

**Scenario 3: Disk Full During Migration**

**Error:**
```
[Migration] Error: database or disk is full
```

**Handling:**
```typescript
try {
  migrate(db, { migrationsFolder: migrationsPath });
} catch (error) {
  if (error.message.includes('disk is full')) {
    console.error('[Migration] ❌ Disk full - free up space and retry');
    console.error('[Migration] Backup preserved at:', backupPath);
    process.exit(1);
  }
  throw error;
}
```

**Recovery:**
1. Free up disk space
2. Restore from backup (migration didn't complete)
3. Re-run migration

---

### 13.2 Seed Failure Scenarios

**Scenario 1: Admin User Already Exists (Expected)**

**Error:** None (idempotent design handles this)

**Handling:**
```typescript
await db.insert(user)
  .values(adminUser)
  .onConflictDoNothing();

console.log('Admin user seed: OK (already exists or created)');
```

---

**Scenario 2: Permission Insert Fails (Unexpected)**

**Error:**
```
[Seed] Error: NOT NULL constraint failed: permissions.category
```

**Handling:**
```typescript
try {
  db.prepare(`
    INSERT INTO permissions (id, name, label, category)
    VALUES (?, ?, ?, ?)
  `).run(permId, name, label, category);
} catch (error) {
  console.error(`[Seed] Failed to create permission ${name}:`, error.message);
  // Continue with next permission (non-fatal)
}
```

**Impact:** System may function with degraded RBAC coverage.

**Recovery:** Fix seed data, re-run with `--force` flag.

---

**Scenario 3: Demo Fixtures Fail in Production**

**Error:**
```
[Seed] Error: Cannot insert demo game - production environment
```

**Handling:**
```typescript
export async function seedDemoFixtures() {
  if (isProduction()) {
    console.log('[Seed] ⏭️  Skipping demo fixtures (production)');
    return;  // Graceful skip
  }

  // Seed demo data...
}
```

**Impact:** None - expected behavior.

---

### 13.3 Partial Migration Handling

**Problem:** Migration partially applied before failure (e.g., 2 of 5 tables created).

**Detection:**
```typescript
export function detectPartialMigration(migrationHash: string): boolean {
  const applied = db.prepare(`
    SELECT hash FROM __drizzle_migrations WHERE hash = ?
  `).get(migrationHash);

  if (applied) {
    console.warn('[Migration] Hash found in journal, but tables missing');
    return true;
  }

  return false;
}
```

**Recovery:**
1. **Automatic (via transaction):** SQLite transactions ensure atomicity
   - If migration fails, ROLLBACK undoes all changes
   - No partial state possible

2. **Manual (if transaction bypassed):**
```bash
# Remove migration from journal
sqlite3 data/escapeplan.db "DELETE FROM __drizzle_migrations WHERE hash = 'xxx'"

# Manually drop partially created tables
sqlite3 data/escapeplan.db "DROP TABLE IF EXISTS partial_table"

# Re-run migration
npx drizzle-kit migrate
```

---

### 13.4 Corrupted Database Detection

**Symptoms:**
- `PRAGMA integrity_check` returns errors
- Foreign key violations after migration
- Table schemas don't match expected structure

**Detection:**
```typescript
export function checkDatabaseIntegrity(): boolean {
  const result = sqlite.prepare('PRAGMA integrity_check').get();

  if (result.integrity_check !== 'ok') {
    console.error('[Health] ❌ Database corrupted:', result.integrity_check);
    return false;
  }

  const fkViolations = sqlite.prepare('PRAGMA foreign_key_check').all();
  if (fkViolations.length > 0) {
    console.error('[Health] ❌ Foreign key violations:', fkViolations);
    return false;
  }

  return true;
}
```

**Recovery:**
1. **Stop application immediately**
2. **Restore from most recent backup**
3. **Re-apply migrations from restored point**
4. **Investigate root cause** (disk failure, manual SQL edits, etc.)

---

### 13.5 Recovery Procedures

**Standard Recovery Workflow:**

```
┌─────────────────────────────────────┐
│ 1. Detect failure                   │
│    - Migration error                │
│    - Integrity check failed         │
│    - Application crash              │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 2. Stop application                 │
│    systemctl stop escapeplan-api    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 3. Identify last good backup        │
│    ls -lh /var/lib/escapeplan/backups│
│    Check database_snapshots table   │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 4. Restore backup                   │
│    pnpm db:restore <backup-path>    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 5. Verify restoration               │
│    PRAGMA integrity_check           │
│    Check critical data exists       │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 6. Re-apply migrations (if needed)  │
│    npx drizzle-kit migrate          │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 7. Restart application              │
│    systemctl start escapeplan-api   │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 8. Monitor logs                     │
│    journalctl -u escapeplan-api -f  │
└─────────────────────────────────────┘
```

**Documentation:** Include this flowchart in `/project-docs/runbooks/DATABASE-RECOVERY.md`.

---

## 14. Documentation Requirements

### 14.1 Migration Writing Guidelines

**Document:** `/project-docs/guides/WRITING-MIGRATIONS.md`

**Contents:**
- How to generate migrations with `drizzle-kit generate`
- How to review generated SQL
- Common migration patterns (add column, create index, etc.)
- Dangerous operations to avoid (DROP TABLE, ALTER TYPE)
- How to write data migrations
- How to test migrations locally
- How to write rollback migrations

**Example Section:**
```markdown
## Adding a New Column

1. **Edit schema:**
   ```typescript
   export const games = sqliteTable('games', {
     // ... existing columns
     featured: integer('featured').default(0),
   });
   ```

2. **Rebuild contracts:**
   ```bash
   pnpm --filter @escapeplan/contracts build
   ```

3. **Generate migration:**
   ```bash
   cd apps/escapeplan-api
   npx drizzle-kit generate
   ```

4. **Review SQL:**
   ```bash
   cat drizzle/0008_add_featured_column.sql
   ```

5. **Apply locally:**
   ```bash
   npx drizzle-kit migrate
   pnpm test
   ```

6. **Commit:**
   ```bash
   git add drizzle/
   git commit -m "migration: add featured flag to games"
   ```
```

---

### 14.2 Seed Data Update Procedures

**Document:** `/project-docs/guides/UPDATING-SEEDS.md`

**Contents:**
- When to update seeds vs write migrations
- How to add new permissions
- How to update system settings defaults
- How to add demo data
- Testing seed idempotency
- Running seeds in production

**Example Section:**
```markdown
## Adding a New Permission

**Step 1:** Edit `src/db/seeds/01-essential.ts`

```typescript
const PERMISSION_LABELS: Record<string, string> = {
  // ... existing permissions
  export_data: 'Export system data to CSV/JSON',
};

const ROLE_PERM_MAP: Record<string, string[]> = {
  admin: [...Object.keys(PERMISSION_LABELS)],  // Auto-includes new permission
  manager: ['view_dashboard', ..., 'export_data'],  // Grant to manager
};
```

**Step 2:** Test locally

```bash
pnpm --filter escapeplan-api db:seed --force
```

**Step 3:** Verify permission created

```bash
sqlite3 data/escapeplan.db "SELECT * FROM permissions WHERE name = 'export_data'"
```

**Step 4:** Commit

```bash
git add src/db/seeds/01-essential.ts
git commit -m "seeds: add export_data permission"
```

**Production Impact:** Next deployment will add permission automatically (idempotent).
```

---

### 14.3 Troubleshooting Guide

**Document:** `/project-docs/guides/DATABASE-TROUBLESHOOTING.md`

**Contents:**
- Common migration errors and fixes
- How to check database integrity
- How to restore from backup
- How to manually fix foreign key violations
- How to reset local development database
- Who to contact for production issues

**Example Section:**
```markdown
## Error: Foreign Key Constraint Failed

**Symptom:**
```
Error: FOREIGN KEY constraint failed
```

**Cause:** Attempting to insert/update a record with a foreign key that references a non-existent parent record.

**Diagnosis:**
```bash
sqlite3 data/escapeplan.db "PRAGMA foreign_key_check"
```

**Fix 1: Insert parent record**
```sql
-- If referencing missing user
INSERT INTO user (id, email, name) VALUES ('missing-user-id', 'user@example.com', 'User');
```

**Fix 2: Remove orphaned child records**
```sql
-- Delete bookings referencing non-existent games
DELETE FROM bookings WHERE game_id NOT IN (SELECT id FROM games);
```

**Prevention:** Always create parent records before children in seeds/migrations.
```

---

### 14.4 Rollback Procedures

**Document:** `/project-docs/runbooks/MIGRATION-ROLLBACK.md`

**Contents:**
- When to rollback
- How to identify last good backup
- Step-by-step rollback process
- How to verify rollback success
- Post-rollback communication template
- Known limitations (irreversible migrations)

**Example:**
```markdown
# Migration Rollback Procedure

## When to Rollback

Rollback if:
- Application fails to start after migration
- Data integrity violations detected
- Critical functionality broken
- User data appears corrupted

Do NOT rollback if:
- Minor UI bug (unrelated to migration)
- Performance slower than expected (investigate first)

## Procedure

### Step 1: Stop API
```bash
sudo systemctl stop escapeplan-api
```

### Step 2: Identify Backup
```bash
# List recent backups
ls -lht /var/lib/escapeplan/backups/ | head -5

# Find pre-migration backup
# Look for filename containing "pre-migration" and recent timestamp
```

### Step 3: Restore
```bash
cd /opt/escapeplan/api
pnpm db:restore /var/lib/escapeplan/backups/db-pre-migration-20251004-143022.tar.gz
```

### Step 4: Verify
```bash
sqlite3 /var/lib/escapeplan/escapeplan.db "PRAGMA integrity_check"
# Should output: ok

sqlite3 /var/lib/escapeplan/escapeplan.db "SELECT COUNT(*) FROM user"
# Should show expected user count
```

### Step 5: Restart API
```bash
sudo systemctl start escapeplan-api
```

### Step 6: Monitor
```bash
journalctl -u escapeplan-api -f
```

### Step 7: Notify Team
```
Subject: Database Rollback - Migration 0008

Migration 0008 was rolled back at 14:45 UTC due to [reason].

Status: Database restored to backup from 14:30 UTC
Data Loss: [None / ~15 minutes of bookings]
Next Steps: [Fix migration SQL / Investigate root cause]

Contact: [Your Name]
```
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Create seed file structure (`seeds/` directory)
- [ ] Implement `isFirstRun()` detection
- [ ] Refactor `seed.ts` into 3 files (01-essential, 02-defaults, 03-demo)
- [ ] Add seed orchestrator (`seeds/index.ts`)
- [ ] Test seed idempotency locally

### Phase 2: Migration Infrastructure (Week 2)
- [ ] Update `drizzle.config.ts` with strict mode
- [ ] Generate initial migration from current schema (`0001_initial_schema.sql`)
- [ ] Implement `safe-migrate.ts` with backup integration
- [ ] Create backup/restore utilities
- [ ] Test migration workflow locally

### Phase 3: Safety Checks (Week 3)
- [ ] Implement 8 migration safety checks
- [ ] Add pre-migration checks script
- [ ] Add post-migration verification
- [ ] Create dry-run capability
- [ ] Write migration unit tests

### Phase 4: Documentation (Week 4)
- [ ] Write migration guidelines
- [ ] Write seed update procedures
- [ ] Write troubleshooting guide
- [ ] Write rollback runbook
- [ ] Create example migrations

### Phase 5: Staging Deployment (Week 5)
- [ ] Deploy to staging environment
- [ ] Run full migration workflow
- [ ] Test rollback procedure
- [ ] Test seed execution
- [ ] Performance testing with production-like data

### Phase 6: Production Deployment (Week 6)
- [ ] Create production backup
- [ ] Apply migrations to production
- [ ] Verify production functionality
- [ ] Monitor for 48 hours
- [ ] Team training on new workflows

---

## Appendix A: File Tree

**Complete seed file structure:**
```
apps/escapeplan-api/
├── src/
│   └── db/
│       ├── client.ts                    # Database connection (existing)
│       ├── backup.ts                    # NEW: Backup utilities
│       ├── restore.ts                   # NEW: Restore utilities
│       ├── safe-migrate.ts              # NEW: Production migration wrapper
│       ├── reset.ts                     # NEW: Development reset script
│       └── seeds/
│           ├── index.ts                 # NEW: Seed orchestrator
│           ├── 01-essential.ts          # NEW: RBAC + admin user
│           ├── 02-system-defaults.ts    # NEW: Settings + alerts + network
│           ├── 03-demo-fixtures.ts      # NEW: Demo game (dev only)
│           └── utils/
│               ├── first-run-detector.ts # NEW: isFirstRun() logic
│               └── seed-logger.ts        # NEW: Structured logging
└── drizzle/
    ├── meta/
    │   ├── _journal.json                # Drizzle migration journal
    │   └── NNNN_snapshot.json           # Schema snapshots
    ├── triggers.sql                     # Security triggers (existing)
    ├── 0001_initial_schema.sql          # Generated migrations
    ├── 0002_*.sql
    └── README.md                        # NEW: Migration documentation
```

---

## Appendix B: Migration Workflow Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                   MIGRATION LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

    DEVELOPMENT                REVIEW               PRODUCTION
    ───────────                ──────               ──────────

┌──────────────┐          ┌──────────────┐      ┌──────────────┐
│ Edit schema  │          │ Review SQL   │      │ Backup DB    │
│ (schema.ts)  │          │ migration    │      │              │
└──────┬───────┘          └──────┬───────┘      └──────┬───────┘
       │                         │                     │
       ▼                         │                     │
┌──────────────┐                 │                     │
│ Rebuild      │                 │                     │
│ contracts    │                 │                     │
└──────┬───────┘                 │                     │
       │                         │                     │
       ▼                         │                     │
┌──────────────┐                 │                     │
│ drizzle-kit  │                 │                     │
│ generate     │                 │                     │
└──────┬───────┘                 │                     │
       │                         │                     │
       │   Creates:              │                     │
       │   - 0008_add_tags.sql   │                     │
       │   - meta/*.json         │                     │
       │                         │                     │
       ▼                         │                     │
┌──────────────┐                 │                     │
│ Review SQL   │─────────────────┘                     │
│ locally      │                                       │
└──────┬───────┘                                       │
       │                                               │
       ▼                                               │
┌──────────────┐                                       │
│ Test locally │                                       │
│ (drizzle-kit │                                       │
│  migrate)    │                                       │
└──────┬───────┘                                       │
       │                                               │
       ▼                                               │
┌──────────────┐                                       │
│ Commit to    │                                       │
│ git          │                                       │
└──────┬───────┘                                       │
       │                                               │
       ▼                                               │
┌──────────────┐          ┌──────────────┐            │
│ Create PR    │─────────▶│ CI Tests     │            │
└──────────────┘          └──────┬───────┘            │
                                 │                    │
                                 ▼                    │
                          ┌──────────────┐            │
                          │ Team Review  │            │
                          └──────┬───────┘            │
                                 │                    │
                                 ▼                    │
                          ┌──────────────┐            │
                          │ Merge to     │            │
                          │ main         │            │
                          └──────┬───────┘            │
                                 │                    │
                                 │                    │
                                 ├────────────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ Deploy       │
                          │ (safe-migrate│
                          │  .ts)        │
                          └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ Verify       │
                          │ Production   │
                          └──────────────┘
```

---

## Appendix C: Decision Tree - Seed Execution

```
Application Startup
        │
        ▼
  Run migrations
  (drizzle-kit migrate)
        │
        ▼
   isFirstRun()?
        │
    ┌───┴────┐
    │        │
   YES      NO
    │        │
    ▼        └──────────▶ Skip seeds
┌─────────────────┐       (data exists)
│ Seed Essential  │
│ (RBAC + Admin)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Seed System Defaults│
│ (Settings + Alerts) │
└────────┬────────────┘
         │
         ▼
   isProduction()?
         │
     ┌───┴────┐
     │        │
    YES      NO
     │        │
     ▼        ▼
   Skip   ┌─────────────────┐
   Demo   │ Seed Demo       │
          │ Fixtures        │
          └─────────────────┘
```

---

## Appendix D: Idempotent SQL Patterns

### Pattern 1: INSERT OR IGNORE (Raw SQL)
```sql
-- Safe for static data (won't update existing)
INSERT OR IGNORE INTO permissions (id, name, label)
VALUES ('perm-admin', 'admin', 'Full system access');
```

### Pattern 2: INSERT OR REPLACE (Update Allowed)
```sql
-- Updates existing records (useful for templates)
INSERT OR REPLACE INTO alert_rules (id, name, message_template)
VALUES ('low_time', 'low_time', 'New template: {{time}} remaining');
```

### Pattern 3: onConflictDoNothing (Drizzle ORM)
```typescript
// Type-safe, no exception on conflict
await db.insert(user)
  .values({ id: 'admin', email: 'admin@example.com' })
  .onConflictDoNothing();
```

### Pattern 4: Check-Then-Insert
```typescript
// Explicit control, can log
const exists = db.prepare(`SELECT 1 FROM roles WHERE id = ?`).get(roleId);
if (!exists) {
  db.prepare(`INSERT INTO roles (id, name) VALUES (?, ?)`).run(roleId, name);
  console.log(`✅ Created role: ${name}`);
}
```

### Pattern 5: Upsert with ON CONFLICT DO UPDATE
```sql
-- SQLite 3.24+: Update specific columns on conflict
INSERT INTO system_settings (key, value, updated_at)
VALUES ('version', '0.2.0', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = CURRENT_TIMESTAMP;
```

---

## Appendix E: Drizzle Configuration Diff

**Before (Current):**
```typescript
export default defineConfig({
  schema: '../../packages/contracts/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabasePath()
  }
});
```

**After (Enhanced):**
```typescript
export default defineConfig({
  schema: '../../packages/contracts/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',

  dbCredentials: {
    url: getDatabasePath()
  },

  // NEW: Migration configuration
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public'
  },

  // NEW: Strict mode - warn on dangerous changes
  strict: true,

  // NEW: Verbose logging for debugging
  verbose: true,

  // NEW: Preserve original casing
  introspect: {
    casing: 'preserve'
  },

  // NEW: Pause on destructive operations
  breakpoints: true
});
```

---

## Appendix F: Test Case Specifications

### Test Suite 1: Seed Idempotency
- **Test 1.1:** Run essential seed twice, verify no duplicates
- **Test 1.2:** Run system defaults seed twice, verify counts unchanged
- **Test 1.3:** Run demo fixtures twice, verify single game exists
- **Test 1.4:** Seed after deleting admin user, verify re-creation
- **Test 1.5:** Seed with existing permissions, verify no errors

### Test Suite 2: Migration Integrity
- **Test 2.1:** Apply all migrations from empty DB
- **Test 2.2:** Apply migrations with existing data, verify no loss
- **Test 2.3:** Foreign key check after migrations
- **Test 2.4:** Integrity check after migrations
- **Test 2.5:** Table count matches schema definition

### Test Suite 3: First-Run Detection
- **Test 3.1:** Fresh database returns true
- **Test 3.2:** Seeded database returns false
- **Test 3.3:** Missing admin user returns true
- **Test 3.4:** Partial RBAC data returns true
- **Test 3.5:** Corrupted tables return true (error handling)

### Test Suite 4: Backup/Restore
- **Test 4.1:** Backup creates valid file
- **Test 4.2:** Restore from backup succeeds
- **Test 4.3:** Restored data matches original
- **Test 4.4:** Compressed backup smaller than raw DB
- **Test 4.5:** Restore fails gracefully on corrupted backup

### Test Suite 5: Migration Safety Checks
- **Test 5.1:** Detect placeholders in migration SQL
- **Test 5.2:** Detect missing foreign key indexes
- **Test 5.3:** Detect dangerous type conversions
- **Test 5.4:** Verify rollback SQL reverses changes
- **Test 5.5:** Dry-run doesn't modify actual database

---

## Appendix G: SQL Examples for Idempotent Operations

### Example 1: Add Column with Default (Safe)
```sql
-- Safe: New column with default, existing data unaffected
ALTER TABLE games ADD COLUMN featured INTEGER DEFAULT 0;
```

### Example 2: Add Column (Unsafe - No Default)
```sql
-- ❌ UNSAFE: NOT NULL without default fails on existing rows
ALTER TABLE games ADD COLUMN featured INTEGER NOT NULL;

-- ✅ SAFE: Add default first
ALTER TABLE games ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
```

### Example 3: Rename Column (Backwards-Incompatible)
```sql
-- ❌ DANGEROUS: Breaks existing queries
ALTER TABLE user RENAME COLUMN name TO display_name;

-- ✅ SAFER: Two-step migration
-- Step 1: Add new column, keep old
ALTER TABLE user ADD COLUMN display_name TEXT;
UPDATE user SET display_name = name WHERE display_name IS NULL;

-- Step 2: After app deployment, drop old column (new migration)
ALTER TABLE user DROP COLUMN name;
```

### Example 4: Create Index (Idempotent)
```sql
-- Safe: IF NOT EXISTS prevents errors
CREATE INDEX IF NOT EXISTS idx_bookings_game_id ON bookings(game_id);
```

### Example 5: Insert Reference Data (Idempotent)
```sql
-- Safe: INSERT OR IGNORE skips if exists
INSERT OR IGNORE INTO permissions (id, name, label)
VALUES ('perm-export', 'export_data', 'Export system data');
```

---

## Conclusion

This design document establishes a robust, production-safe database migration system for EscapePlan. By separating migrations from seeds, implementing comprehensive safety checks, and providing clear rollback procedures, the system ensures data integrity and minimizes downtime during schema evolution.

**Key Takeaways:**
1. **Migrations** are immutable, versioned schema changes
2. **Seeds** are idempotent, environment-aware data operations
3. **Safety** is enforced through backups, checks, and transactions
4. **Testing** validates migrations against production-like data
5. **Documentation** guides developers through safe workflows

**Next Steps:**
- Review design with team
- Approve implementation roadmap
- Begin Phase 1 (Foundation) development
- Schedule staging deployment for Phase 5

---

**Document Status:** ✅ Ready for Review
**Last Updated:** 2025-10-04
**Reviewers:** [Team Lead, Database Admin, DevOps]
