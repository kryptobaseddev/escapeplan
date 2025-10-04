# Version Control Strategy Design Document

**Project:** EscapePlan
**Document Version:** 1.0
**Last Updated:** 2025-10-04
**Status:** Design - Ready for Implementation

---

## Table of Contents

1. [Versioning Strategy Decision](#1-versioning-strategy-decision)
2. [Changesets Configuration](#2-changesets-configuration)
3. [VERSION File Synchronization](#3-version-file-synchronization)
4. [Package.json Scripts Design](#4-packagejson-scripts-design)
5. [Developer Workflow](#5-developer-workflow)
6. [Maintainer Workflow](#6-maintainer-workflow)
7. [File Changes Required](#7-file-changes-required)
8. [Integration Points](#8-integration-points)
9. [Success Criteria](#9-success-criteria)
10. [Migration Plan](#10-migration-plan)

---

## 1. Versioning Strategy Decision

### Decision: Unified Versioning with Fixed Packages

**Rationale:**
- EscapePlan is deployed as a single `.deb` package on Raspberry Pi
- All packages (contracts, API, web) are tightly coupled and deployed together
- Current VERSION file (0.1.0) serves as single source of truth for the entire system
- Users interact with EscapePlan as a monolithic system, not individual packages
- Simplifies debugging and support (one version = entire system state)

### Versioning Approach

```yaml
Strategy: Unified Versioning
Mode: Fixed Packages (all packages share same version)
Source of Truth: /VERSION file
Synchronization: Bidirectional (Changesets ↔ VERSION file)
Format: SemVer (MAJOR.MINOR.PATCH)
```

### Version Synchronization Rules

1. **VERSION file** is authoritative for production deployments
2. **package.json versions** automatically sync with VERSION file on version bump
3. **Changesets** manages version bump logic based on changeset types
4. **All packages** (root, contracts, API, web) maintain identical version numbers

### Current State Analysis

```
Root package.json:     0.1.0
contracts package.json: 0.1.0
API package.json:      0.1.0
Web package.json:      0.0.1  ← OUT OF SYNC (needs immediate fix)
VERSION file:          0.1.0
```

---

## 2. Changesets Configuration

### Complete .changeset/config.json

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    {
      "repo": "kryptobaseddev/escapeplan-app"
    }
  ],
  "commit": false,
  "fixed": [
    [
      "escapeplan",
      "@escapeplan/contracts",
      "escapeplan-api",
      "escapeplan-web"
    ]
  ],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": {
    "version": true,
    "tag": false
  }
}
```

### Configuration Breakdown

**`fixed` (Critical):**
- Ensures all 4 packages always have identical versions
- `escapeplan` = root workspace package
- `@escapeplan/contracts` = shared types/schema
- `escapeplan-api` = Fastify backend
- `escapeplan-web` = SvelteKit frontend

**`changelog`:**
- Uses GitHub changelog generator for automatic PR/issue linking
- Generates human-readable CHANGELOG.md in each package

**`commit: false`:**
- Changesets CLI won't auto-commit (we control git workflow manually)
- Allows custom commit messages with conventional commits format

**`updateInternalDependencies: "patch"`:**
- When contracts updates, API/web workspace dependencies bump to patch
- Ensures strict version alignment across workspace

**`privatePackages.version: true`:**
- Private packages (all of ours) participate in versioning
- Essential since we don't publish to npm

---

## 3. VERSION File Synchronization

### Approach Selection: Custom Script with Pre-Version Hook

**Decision:** Custom Node.js script triggered before Changesets version command

**Why Not Alternatives:**
- ❌ **Changesets Plugin:** No official plugin for custom file sync
- ❌ **Build-time Injection:** VERSION file needed at .deb build, not runtime
- ✅ **Pre-version Script:** Guaranteed execution, simple implementation

### Synchronization Script Design

**File:** `/scripts/sync-version.js`

```javascript
#!/usr/bin/env node
/**
 * Synchronizes VERSION file with root package.json
 * Direction: package.json → VERSION (authoritative source is package.json after changeset)
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function syncVersion() {
  // Read version from root package.json (updated by changesets)
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf-8')
  );
  const version = packageJson.version;

  // Write to VERSION file
  writeFileSync(join(rootDir, 'VERSION'), version + '\n', 'utf-8');

  console.log(`✅ Synced VERSION file to ${version}`);
}

syncVersion();
```

### Integration Point

**Execution Flow:**
```
1. Developer runs: pnpm changeset version
2. Changesets updates all package.json files (via fixed config)
3. Post-version script automatically runs: node scripts/sync-version.js
4. VERSION file updated to match package.json
5. Developer commits all changes together
```

---

## 4. Package.json Scripts Design

### Root Package.json Scripts (Complete)

```json
{
  "scripts": {
    "dev": "pnpm --filter escapeplan-api dev & pnpm --filter escapeplan-web dev",
    "lint": "pnpm -r run lint",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",

    "changeset": "changeset",
    "changeset:add": "changeset add",
    "changeset:status": "changeset status",

    "version": "changeset version && node scripts/sync-version.js",
    "version:check": "node scripts/check-version-sync.js",

    "build:deb": "pnpm run build && bash scripts/build-deb.sh",
    "release": "pnpm run version:check && pnpm run build:deb"
  }
}
```

### Script Execution Order

**Development Flow:**
```bash
# 1. Add changeset for PR
pnpm changeset:add
  → Interactive prompt (patch/minor/major)
  → Creates .changeset/{random-name}.md
  → Commit changeset with PR

# 2. Check changeset status
pnpm changeset:status
  → Shows pending version bumps
  → Validates no conflicts
```

**Release Flow (Maintainer):**
```bash
# 1. Bump versions
pnpm version
  → Reads all pending changesets
  → Updates all package.json (via fixed config)
  → Generates CHANGELOG.md files
  → Syncs VERSION file (via post-script)

# 2. Validate sync
pnpm version:check
  → Ensures VERSION matches package.json
  → Exits 1 if mismatch (blocks CI)

# 3. Build release
pnpm release
  → Runs version:check (safety)
  → Builds all packages
  → Creates .deb with correct version
```

### Error Handling Approach

**Version Check Script (`scripts/check-version-sync.js`):**
```javascript
#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

const packageVersion = JSON.parse(
  readFileSync(join(rootDir, 'package.json'), 'utf-8')
).version;

const versionFile = readFileSync(join(rootDir, 'VERSION'), 'utf-8').trim();

if (packageVersion !== versionFile) {
  console.error('❌ VERSION MISMATCH!');
  console.error(`   package.json: ${packageVersion}`);
  console.error(`   VERSION file: ${versionFile}`);
  console.error('\nRun: pnpm version (to sync)');
  process.exit(1);
}

console.log(`✅ Version synchronized: ${packageVersion}`);
```

---

## 5. Developer Workflow

### Step-by-Step Changeset Creation

```
┌─────────────────────────────────────────────────┐
│  DEVELOPER WORKFLOW: Feature Implementation     │
└─────────────────────────────────────────────────┘

1. CREATE FEATURE BRANCH
   $ git checkout -b feat/add-game-templates

2. IMPLEMENT CHANGES
   - Write code in packages/contracts, apps/*, etc.
   - Write tests (≥80% coverage required)
   - Update documentation

3. ADD CHANGESET (before committing)
   $ pnpm changeset:add

   Interactive Prompts:
   ┌─────────────────────────────────────────────┐
   │ Which packages should be bumped?            │
   │ ◉ escapeplan                                │
   │ ◉ @escapeplan/contracts                     │
   │ ◉ escapeplan-api                            │
   │ ◉ escapeplan-web                            │
   │                                              │
   │ (All selected via fixed config)             │
   └─────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────┐
   │ What kind of change is this?                │
   │   ○ major (breaking change)                 │
   │   ● minor (new feature)                     │
   │   ○ patch (bugfix/chore)                    │
   └─────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────┐
   │ Summary of changes (for CHANGELOG):         │
   │                                              │
   │ > Add game template system for quick setup  │
   │ > - Predefined puzzle configurations       │
   │ > - Template library in admin panel         │
   └─────────────────────────────────────────────┘

   Result: Creates `.changeset/clever-words-dance.md`

4. COMMIT CHANGESET WITH CODE
   $ git add .
   $ git commit -m "feat: add game template system

   - Implement template CRUD in API
   - Add template picker in game creation UI
   - Update contracts with template types

   🤖 Generated with Claude Code
   Co-Authored-By: Claude <noreply@anthropic.com>"

5. PUSH AND CREATE PR
   $ git push -u origin feat/add-game-templates
   $ gh pr create --title "Add game template system"

6. PR VALIDATION (GitHub Actions)
   ✅ Changeset present (.changeset/*.md exists)
   ✅ All tests pass
   ✅ Type checking passes
   ✅ No version file conflicts
```

### Commit Message Guidelines

**Format:** Conventional Commits (enforced via PR review, not git hooks)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature (triggers minor bump via changeset)
- `fix`: Bug fix (triggers patch bump)
- `perf`: Performance improvement (patch)
- `refactor`: Code refactoring (patch)
- `docs`: Documentation only (no version bump)
- `test`: Test additions (no version bump)
- `chore`: Maintenance (no version bump)

**Example:**
```
feat(api): add game template endpoints

Implement CRUD operations for game templates:
- GET /api/admin/game-templates (list)
- POST /api/admin/game-templates (create)
- PUT /api/admin/game-templates/:id (update)
- DELETE /api/admin/game-templates/:id (delete)

Refs: #142

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

### PR Requirements and Checks

**Required for Merge:**
1. ✅ At least one changeset file present (`.changeset/*.md`)
2. ✅ All CI checks pass (tests, lint, type-check)
3. ✅ Code review approval from maintainer
4. ✅ No merge conflicts with main

**Changeset Validation (GitHub Action):**
```yaml
# .github/workflows/changeset-check.yml
name: Changeset Check
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm changeset status --since=origin/main
```

---

## 6. Maintainer Workflow

### Version Bump Process

```
┌─────────────────────────────────────────────────┐
│  MAINTAINER WORKFLOW: Version Bump & Release    │
└─────────────────────────────────────────────────┘

1. REVIEW PENDING CHANGESETS
   $ pnpm changeset:status

   Output:
   ┌─────────────────────────────────────────────┐
   │ 🦋 Pending changesets:                       │
   │                                              │
   │ clever-words-dance (minor)                  │
   │   - Add game template system                │
   │                                              │
   │ brave-lions-jump (patch)                    │
   │   - Fix timer pause bug                     │
   │                                              │
   │ Expected bump: MINOR (0.1.0 → 0.2.0)        │
   └─────────────────────────────────────────────┘

2. CHECKOUT MAIN & PULL LATEST
   $ git checkout main
   $ git pull origin main

3. RUN VERSION BUMP
   $ pnpm version

   This executes:
   a) changeset version
      - Reads all .changeset/*.md files
      - Calculates highest bump (major > minor > patch)
      - Updates all 4 package.json files to 0.2.0
      - Generates CHANGELOG.md in each package
      - Deletes consumed changeset files

   b) node scripts/sync-version.js
      - Reads root package.json (now 0.2.0)
      - Writes "0.2.0\n" to VERSION file

   Result:
   ✅ 4 package.json files updated
   ✅ 4 CHANGELOG.md files updated
   ✅ VERSION file synced
   ✅ Changeset files removed

4. REVIEW CHANGES
   $ git diff

   Expected changes:
   - package.json (x4) version bump
   - CHANGELOG.md (x4) new entries
   - VERSION file updated
   - .changeset/*.md files deleted

5. COMMIT VERSION BUMP
   $ git add .
   $ git commit -m "chore: release v0.2.0

   - Add game template system (minor)
   - Fix timer pause bug (patch)

   🤖 Generated with Claude Code
   Co-Authored-By: Claude <noreply@anthropic.com>"

6. TAG RELEASE
   $ git tag v0.2.0
   $ git push origin main --tags
```

### Release Creation Process

```
7. BUILD .DEB PACKAGE
   $ pnpm release

   Executes:
   a) pnpm version:check
      - Validates VERSION == package.json
      - Exits if mismatch

   b) pnpm build
      - pnpm -r run build
      - contracts → API → web (in order)

   c) bash scripts/build-deb.sh
      - Reads VERSION file for .deb name
      - Creates escapeplan_0.2.0_arm64.deb
      - Includes systemd units
      - Adds postinst scripts

   Output:
   ✅ Built: dist/escapeplan_0.2.0_arm64.deb
   📦 12.4MB

8. CREATE GITHUB RELEASE
   $ gh release create v0.2.0 \
       --title "EscapePlan v0.2.0" \
       --notes-file CHANGELOG.md \
       dist/escapeplan_0.2.0_arm64.deb

9. ANNOUNCE RELEASE
   - Update project README with latest version
   - Notify team in Slack/Discord
   - Update documentation site (if applicable)
```

### Emergency Hotfix Workflow

```
┌─────────────────────────────────────────────────┐
│  EMERGENCY HOTFIX: Critical Production Bug      │
└─────────────────────────────────────────────────┘

1. CREATE HOTFIX BRANCH FROM MAIN
   $ git checkout main
   $ git pull
   $ git checkout -b hotfix/fix-critical-auth-bypass

2. IMPLEMENT FIX
   - Write minimal fix (single responsibility)
   - Add regression test
   - Verify fix locally

3. ADD PATCH CHANGESET
   $ pnpm changeset:add

   Select: patch
   Summary: "Fix critical authentication bypass in session validation"

4. COMMIT & PUSH
   $ git add .
   $ git commit -m "fix(api): patch critical auth bypass

   CVE-2025-XXXX: Session tokens not validated in /api/admin routes

   🤖 Generated with Claude Code
   Co-Authored-By: Claude <noreply@anthropic.com>"

   $ git push -u origin hotfix/fix-critical-auth-bypass

5. CREATE EMERGENCY PR
   $ gh pr create \
       --title "🚨 HOTFIX: Critical auth bypass" \
       --label "security,hotfix" \
       --assignee @maintainer

6. FAST-TRACK REVIEW
   - Security review (required)
   - Automated tests (required)
   - Manual verification (required)
   - Merge immediately upon approval

7. EMERGENCY RELEASE (same day)
   $ git checkout main
   $ git pull
   $ pnpm version       # 0.2.0 → 0.2.1
   $ git add .
   $ git commit -m "chore: emergency release v0.2.1"
   $ git tag v0.2.1
   $ git push origin main --tags
   $ pnpm release
   $ gh release create v0.2.1 --prerelease \
       --title "🚨 Security Hotfix v0.2.1" \
       dist/escapeplan_0.2.1_arm64.deb
```

---

## 7. File Changes Required

### Files to Create

```
📁 escapeplan-app/
├── 📄 .changeset/
│   ├── config.json                    ← NEW (changesets config)
│   └── README.md                      ← NEW (developer guide)
├── 📄 scripts/
│   ├── sync-version.js                ← NEW (VERSION file sync)
│   └── check-version-sync.js          ← NEW (validation script)
└── 📄 .github/
    └── workflows/
        ├── changeset-check.yml        ← NEW (PR validation)
        └── release.yml                ← NEW (automated release)
```

### Files to Modify

```
📁 escapeplan-app/
├── 📝 package.json                    ← MODIFY (add version scripts)
├── 📝 apps/escapeplan-web/package.json ← MODIFY (fix version to 0.1.0)
├── 📝 scripts/build-deb.sh            ← MODIFY (read from VERSION file)
└── 📝 .gitignore                      ← MODIFY (ignore .changeset/*.md in releases)
```

### Configuration File Contents

#### `.changeset/config.json`
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "kryptobaseddev/escapeplan-app" }
  ],
  "commit": false,
  "fixed": [
    ["escapeplan", "@escapeplan/contracts", "escapeplan-api", "escapeplan-web"]
  ],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": {
    "version": true,
    "tag": false
  }
}
```

#### `.changeset/README.md`
```markdown
# Changesets

This directory contains pending version bumps for the next release.

## Developer Usage

When making changes, always add a changeset:

```bash
pnpm changeset:add
```

This creates a new file here describing your changes. Commit it with your PR.

## Maintainer Usage

To release a new version:

```bash
pnpm version  # Bumps versions, updates CHANGELOG
git add .
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
pnpm release  # Builds .deb package
```

## Files Here

- `config.json` - Changesets configuration
- `*.md` files - Pending changesets (auto-deleted on version bump)
```

#### `scripts/sync-version.js`
```javascript
#!/usr/bin/env node
/**
 * Synchronizes VERSION file with root package.json
 * Run after: changeset version
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function syncVersion() {
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf-8')
  );
  const version = packageJson.version;

  writeFileSync(join(rootDir, 'VERSION'), version + '\n', 'utf-8');

  console.log(`✅ Synced VERSION file to ${version}`);
}

syncVersion();
```

#### `scripts/check-version-sync.js`
```javascript
#!/usr/bin/env node
/**
 * Validates VERSION file matches package.json
 * Exits 1 if mismatch (blocks CI/release)
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

const packageVersion = JSON.parse(
  readFileSync(join(rootDir, 'package.json'), 'utf-8')
).version;

const versionFile = readFileSync(join(rootDir, 'VERSION'), 'utf-8').trim();

if (packageVersion !== versionFile) {
  console.error('❌ VERSION MISMATCH!');
  console.error(`   package.json: ${packageVersion}`);
  console.error(`   VERSION file: ${versionFile}`);
  console.error('\nRun: pnpm version (to sync)');
  process.exit(1);
}

console.log(`✅ Version synchronized: ${packageVersion}`);
```

#### `.github/workflows/changeset-check.yml`
```yaml
name: Changeset Check

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10.12.4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check for changesets
        run: pnpm changeset status --since=origin/main
```

#### `.github/workflows/release.yml`
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-deb:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10.12.4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check version sync
        run: pnpm version:check

      - name: Build all packages
        run: pnpm build

      - name: Build .deb package
        run: bash scripts/build-deb.sh

      - name: Upload .deb artifact
        uses: actions/upload-artifact@v4
        with:
          name: debian-package
          path: dist/*.deb

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*.deb
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Modified `scripts/build-deb.sh`

**Change on line 5:**
```bash
# OLD:
VERSION=$(node -p "require('./package.json').version")

# NEW:
VERSION=$(cat VERSION | tr -d '\n')
```

**Rationale:** VERSION file is source of truth for .deb packaging

---

## 8. Integration Points

### GitHub Actions Integration

```
┌─────────────────────────────────────────────────┐
│  CI/CD PIPELINE INTEGRATION                      │
└─────────────────────────────────────────────────┘

PR Workflow (.github/workflows/changeset-check.yml):
  ├─ Trigger: pull_request to main
  ├─ Validate: changeset status --since=origin/main
  ├─ Result: ✅ Pass if changeset present, ❌ Fail if missing
  └─ Blocks: PR merge on failure

Release Workflow (.github/workflows/release.yml):
  ├─ Trigger: git tag push (v*)
  ├─ Steps:
  │   1. pnpm version:check (validate sync)
  │   2. pnpm build (build all packages)
  │   3. bash scripts/build-deb.sh (create .deb)
  │   4. gh release create (publish GitHub release)
  └─ Artifacts: .deb package attached to release
```

### .deb Build Pipeline Integration

```
┌─────────────────────────────────────────────────┐
│  DEBIAN PACKAGE BUILD FLOW                       │
└─────────────────────────────────────────────────┘

Execution Order:
  1. Developer: pnpm version
     ├─ Updates all package.json (0.1.0 → 0.2.0)
     ├─ Generates CHANGELOG.md
     └─ Syncs VERSION file (via scripts/sync-version.js)

  2. Developer: git commit & tag
     ├─ Commit: "chore: release v0.2.0"
     └─ Tag: v0.2.0

  3. Developer: pnpm release
     ├─ Validates: pnpm version:check
     ├─ Builds: pnpm build (contracts → API → web)
     └─ Packages: bash scripts/build-deb.sh
         ├─ Reads: VERSION file (0.2.0)
         ├─ Creates: escapeplan_0.2.0_arm64.deb
         └─ Embeds: systemd units, postinst scripts

  4. CI/CD: GitHub Actions (on tag push)
     ├─ Rebuilds: .deb package (reproducible)
     ├─ Uploads: artifacts to GitHub release
     └─ Publishes: release notes from CHANGELOG.md
```

### Database Migration Coordination

**Challenge:** Drizzle push-only workflow (no migration files)

**Solution:** Version-aware migration tracking

```typescript
// apps/escapeplan-api/src/db/migrations.ts

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Checks if database schema version matches app version
 * Run on startup to detect schema drift
 */
export async function validateSchemaVersion(db: Database) {
  const appVersion = readFileSync(
    join(__dirname, '../../../VERSION'),
    'utf-8'
  ).trim();

  const schemaVersion = await db
    .select({ version: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'schema_version'))
    .get();

  if (!schemaVersion) {
    // First run - initialize schema version
    await db.insert(systemSettings).values({
      id: ulid(),
      key: 'schema_version',
      value: appVersion,
      category: 'system',
      data_type: 'string',
    });
    return;
  }

  if (schemaVersion.value !== appVersion) {
    console.warn(
      `⚠️  Schema version mismatch!\n` +
      `   App version: ${appVersion}\n` +
      `   Schema version: ${schemaVersion.value}\n` +
      `   Run: drizzle-kit push (to sync schema)`
    );
  }
}
```

**Integration in startup:**
```typescript
// apps/escapeplan-api/src/index.ts

import { validateSchemaVersion } from './db/migrations.js';

const db = await initializeDatabase();
await validateSchemaVersion(db); // Check schema sync on boot
```

**Release Notes Guidance:**
```markdown
## EscapePlan v0.2.0 Release Notes

### Database Changes
This release includes schema changes. After installing:

```bash
sudo systemctl stop escapeplan-api
cd /opt/escapeplan/api
npx drizzle-kit push  # Apply schema updates
sudo systemctl start escapeplan-api
```

### Breaking Changes
- Camera configuration now requires `stream_profile` field
- Old bookings missing `customer_email` will show as "Unknown"
```

---

## 9. Success Criteria

### Validation Checklist

**Phase 1: Initial Setup (Atomic Task 1)**
- [ ] `.changeset/config.json` created with fixed packages
- [ ] `pnpm changeset:add` creates `.md` file successfully
- [ ] All 4 packages show identical versions in changeset status
- [ ] `scripts/sync-version.js` runs without errors

**Phase 2: Version Bump Flow (Atomic Task 2)**
- [ ] `pnpm version` updates all 4 package.json to same version
- [ ] VERSION file automatically syncs with package.json
- [ ] CHANGELOG.md generated in all 4 packages
- [ ] Consumed changesets deleted from `.changeset/`

**Phase 3: Release Flow (Atomic Task 3)**
- [ ] `pnpm version:check` passes when synced
- [ ] `pnpm version:check` fails (exit 1) when mismatched
- [ ] `pnpm release` builds .deb with correct version from VERSION file
- [ ] .deb filename matches VERSION: `escapeplan_X.Y.Z_arm64.deb`

**Phase 4: CI/CD Integration (Atomic Task 4)**
- [ ] GitHub Actions validates changesets on PR
- [ ] PR without changeset fails CI check
- [ ] Git tag push triggers automated .deb build
- [ ] GitHub release created with .deb artifact

**Phase 5: Developer Experience (Atomic Task 5)**
- [ ] Developer can add changeset in <2 minutes
- [ ] Changeset CLI prompts are clear and intuitive
- [ ] CHANGELOG entries are human-readable
- [ ] Conventional commit format documented

### Key Metrics to Track

```yaml
Metrics:
  changeset_adoption_rate:
    target: 100%
    measurement: "PRs with changesets / Total PRs"

  version_sync_accuracy:
    target: 100%
    measurement: "Releases with VERSION == package.json"

  release_automation_success:
    target: 95%
    measurement: "Automated releases / Total releases"

  average_release_time:
    target: <15 minutes
    measurement: "Time from tag push to .deb published"

  changeset_clarity_score:
    target: 4.5/5
    measurement: "Team survey on CHANGELOG readability"
```

### Testing Approach

**Unit Tests:**
```bash
# Test sync-version.js
node scripts/sync-version.js
assert VERSION == package.json.version

# Test check-version-sync.js
echo "0.9.9" > VERSION
node scripts/check-version-sync.js
assert exit_code == 1
```

**Integration Tests:**
```bash
# Test full version bump flow
pnpm changeset:add  # Create test changeset (patch)
pnpm version        # Bump 0.1.0 → 0.1.1
assert package.json == "0.1.1"
assert VERSION == "0.1.1"
assert CHANGELOG.md contains "Patch Changes"

# Test .deb build with VERSION
pnpm release
assert exists dist/escapeplan_0.1.1_arm64.deb
```

**End-to-End Test:**
```bash
# Simulate full release cycle
1. git checkout -b test/changeset-flow
2. touch test.txt
3. pnpm changeset:add (minor, "Test changeset flow")
4. git add . && git commit -m "test: validate changeset flow"
5. git checkout main && git merge test/changeset-flow
6. pnpm version  # 0.1.0 → 0.2.0
7. git add . && git commit -m "chore: test release v0.2.0"
8. git tag v0.2.0
9. pnpm release
10. Validate: dist/escapeplan_0.2.0_arm64.deb exists
11. Rollback: git reset --hard HEAD~1 && git tag -d v0.2.0
```

---

## 10. Migration Plan

### Step-by-Step Migration from Current State

**Current State Analysis:**
```
✅ Root package.json: 0.1.0
✅ contracts package.json: 0.1.0
✅ API package.json: 0.1.0
❌ Web package.json: 0.0.1 (OUT OF SYNC)
✅ VERSION file: 0.1.0
❌ No changesets configured
❌ Manual version bumps (error-prone)
```

**Migration Steps (5 Atomic Tasks):**

#### Task 1: Fix Version Inconsistency (30 min)
```bash
# Immediate fix for web package
cd apps/escapeplan-web
# Edit package.json: "version": "0.0.1" → "0.1.0"
git add apps/escapeplan-web/package.json
git commit -m "fix: sync web package version to 0.1.0"
git push origin main
```

**Acceptance Criteria:**
- All 4 package.json files show "0.1.0"
- No version conflicts in workspace

#### Task 2: Install & Configure Changesets (1 hour)
```bash
# Install changesets
pnpm add -Dw @changesets/cli @changesets/changelog-github

# Initialize changesets
pnpm changeset init

# Replace .changeset/config.json with fixed config (see Section 2)
# Create .changeset/README.md (see Section 7)

# Add scripts to root package.json
# "changeset": "changeset"
# "changeset:add": "changeset add"
# "changeset:status": "changeset status"
# "version": "changeset version && node scripts/sync-version.js"

git add .changeset package.json
git commit -m "chore: configure changesets with fixed versioning"
git push origin main
```

**Acceptance Criteria:**
- `pnpm changeset:add` creates `.changeset/*.md` file
- Fixed config ensures all packages selected
- No errors on `pnpm changeset:status`

#### Task 3: Create Sync Scripts (1 hour)
```bash
# Create scripts/sync-version.js (see Section 7)
# Create scripts/check-version-sync.js (see Section 7)
chmod +x scripts/sync-version.js scripts/check-version-sync.js

# Add to package.json scripts:
# "version:check": "node scripts/check-version-sync.js"
# "version": "changeset version && node scripts/sync-version.js"

# Test sync
pnpm version:check  # Should pass (all at 0.1.0)

git add scripts/ package.json
git commit -m "chore: add VERSION file sync scripts"
git push origin main
```

**Acceptance Criteria:**
- `pnpm version:check` exits 0 when synced
- `pnpm version:check` exits 1 when mismatched
- `scripts/sync-version.js` writes to VERSION file

#### Task 4: Update Build Scripts (30 min)
```bash
# Modify scripts/build-deb.sh line 5:
# OLD: VERSION=$(node -p "require('./package.json').version")
# NEW: VERSION=$(cat VERSION | tr -d '\n')

# Update package.json:
# "release": "pnpm version:check && pnpm run build:deb"

# Test build
pnpm release
# Should create: dist/escapeplan_0.1.0_arm64.deb

git add scripts/build-deb.sh package.json
git commit -m "chore: update build scripts to use VERSION file"
git push origin main
```

**Acceptance Criteria:**
- .deb filename matches VERSION file
- `pnpm release` fails if version mismatch
- Build script reads VERSION (not package.json)

#### Task 5: Setup CI/CD Workflows (1.5 hours)
```bash
# Create .github/workflows/changeset-check.yml (see Section 7)
# Create .github/workflows/release.yml (see Section 7)

# Test locally with act (optional)
act pull_request -j check

git add .github/workflows/
git commit -m "ci: add changeset validation and automated releases"
git push origin main
```

**Acceptance Criteria:**
- PR without changeset fails CI check
- PR with changeset passes CI check
- Tag push triggers .deb build and release
- GitHub release contains .deb artifact

### Rollback Plan

**If Issues Occur After Migration:**

**Rollback Step 1: Revert to Manual Versioning**
```bash
# Remove changesets dependency
pnpm remove -Dw @changesets/cli @changesets/changelog-github

# Revert package.json scripts
git checkout HEAD~5 -- package.json  # Before migration

# Remove changeset files
rm -rf .changeset/

# Keep VERSION file (still useful)
git add .
git commit -m "revert: rollback changesets migration"
git push origin main
```

**Rollback Step 2: Emergency Version Sync**
```bash
# If VERSION and package.json diverge
VERSION_VALUE=$(cat VERSION)

# Manually update all package.json
echo "Updating to: $VERSION_VALUE"

# Use jq or manual edit
jq --arg ver "$VERSION_VALUE" '.version = $ver' package.json > tmp.json
mv tmp.json package.json

# Repeat for all 4 packages
cd apps/escapeplan-api && <same>
cd apps/escapeplan-web && <same>
cd packages/contracts && <same>

git add .
git commit -m "fix: emergency version sync to $VERSION_VALUE"
```

**Rollback Step 3: Disable CI Checks**
```bash
# Temporarily disable changeset-check workflow
mv .github/workflows/changeset-check.yml \
   .github/workflows/changeset-check.yml.disabled

git add .
git commit -m "ci: disable changeset checks (temporary)"
git push origin main
```

### Team Training Requirements

**Training Session 1: Developer Onboarding (30 min)**
- How to add changesets with `pnpm changeset:add`
- Changeset types: patch/minor/major
- Writing good changeset summaries
- Commit message conventions

**Training Session 2: Maintainer Onboarding (45 min)**
- Review pending changesets with `pnpm changeset:status`
- Bump versions with `pnpm version`
- Create releases with `pnpm release`
- Emergency hotfix workflow

**Training Session 3: CI/CD Understanding (30 min)**
- GitHub Actions workflows
- PR validation requirements
- Automated release process
- Troubleshooting failed builds

**Training Materials:**
- `.changeset/README.md` (quick reference)
- This design document (detailed guide)
- Video walkthrough (record first release)
- Troubleshooting FAQ (build from issues)

### Post-Migration Validation

**Week 1 Checklist:**
- [ ] 3+ successful PRs with changesets merged
- [ ] 1+ successful version bump completed
- [ ] 1+ .deb package built and tested on Pi
- [ ] No version sync issues reported
- [ ] Developer feedback collected

**Week 2 Checklist:**
- [ ] First production release using new workflow
- [ ] CHANGELOG.md reviewed for clarity
- [ ] CI/CD reliability ≥95%
- [ ] Team comfortable with changeset CLI
- [ ] No rollback triggers encountered

**Month 1 Goals:**
- [ ] 100% changeset adoption on PRs
- [ ] Zero manual version bumps
- [ ] Automated releases for all versions
- [ ] Documentation updated based on lessons learned
- [ ] Metrics tracking established

---

## File Tree: All New/Modified Files

```
escapeplan-app/
├── .changeset/
│   ├── config.json                    ← NEW (changesets configuration)
│   └── README.md                      ← NEW (developer guide)
│
├── .github/
│   └── workflows/
│       ├── changeset-check.yml        ← NEW (PR changeset validation)
│       └── release.yml                ← NEW (automated .deb release)
│
├── scripts/
│   ├── build-deb.sh                   ← MODIFIED (read VERSION file)
│   ├── sync-version.js                ← NEW (package.json → VERSION sync)
│   └── check-version-sync.js          ← NEW (validation script)
│
├── package.json                       ← MODIFIED (add version scripts)
├── apps/escapeplan-web/package.json   ← MODIFIED (fix version to 0.1.0)
└── VERSION                            ← EXISTING (unchanged)
```

---

## Command Sequences for Common Operations

### Add Feature with Changeset
```bash
# 1. Create branch
git checkout -b feat/new-feature

# 2. Implement feature
# ... make code changes ...

# 3. Add changeset
pnpm changeset:add
# Select: minor (new feature)
# Summary: "Add awesome new feature"

# 4. Commit everything
git add .
git commit -m "feat: add awesome new feature"

# 5. Push and create PR
git push -u origin feat/new-feature
gh pr create --title "Add awesome new feature"
```

### Fix Bug with Changeset
```bash
# 1. Create branch
git checkout -b fix/bug-description

# 2. Fix bug + add test
# ... make code changes ...

# 3. Add changeset
pnpm changeset:add
# Select: patch (bugfix)
# Summary: "Fix bug in X component"

# 4. Commit
git add .
git commit -m "fix: resolve bug in X component"

# 5. Push and create PR
git push -u origin fix/bug-description
gh pr create --title "Fix bug in X component"
```

### Release New Version
```bash
# 1. Checkout main
git checkout main
git pull origin main

# 2. Check pending changes
pnpm changeset:status

# 3. Bump versions
pnpm version

# 4. Review changes
git diff

# 5. Commit version bump
git add .
git commit -m "chore: release vX.Y.Z"

# 6. Tag release
git tag vX.Y.Z

# 7. Push with tags
git push origin main --tags

# 8. Build .deb
pnpm release

# 9. Create GitHub release
gh release create vX.Y.Z \
  --title "EscapePlan vX.Y.Z" \
  --notes "See CHANGELOG.md for details" \
  dist/escapeplan_X.Y.Z_arm64.deb
```

### Emergency Hotfix
```bash
# 1. Branch from main
git checkout main
git pull
git checkout -b hotfix/critical-fix

# 2. Implement fix
# ... make minimal changes ...

# 3. Add patch changeset
pnpm changeset:add
# Select: patch
# Summary: "Fix critical issue X"

# 4. Commit & push
git add .
git commit -m "fix: critical issue X"
git push -u origin hotfix/critical-fix

# 5. Create PR with urgency
gh pr create --title "🚨 HOTFIX: Critical issue X" --label hotfix

# 6. After merge: immediate release
git checkout main
git pull
pnpm version      # Patch bump
git add .
git commit -m "chore: emergency release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
pnpm release
gh release create vX.Y.Z --prerelease dist/*.deb
```

### Check Version Sync Status
```bash
# Quick check
pnpm version:check

# Detailed check
echo "Root:      $(jq -r .version package.json)"
echo "Contracts: $(jq -r .version packages/contracts/package.json)"
echo "API:       $(jq -r .version apps/escapeplan-api/package.json)"
echo "Web:       $(jq -r .version apps/escapeplan-web/package.json)"
echo "VERSION:   $(cat VERSION)"
```

---

## Workflow Diagrams (ASCII)

### Developer PR Flow
```
┌─────────────┐
│  Developer  │
│   Creates   │
│   Branch    │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ Implements  │
│   Feature   │
└──────┬──────┘
       │
       ↓
┌─────────────────────┐
│ pnpm changeset:add  │
│ (Creates .md file)  │
└──────┬──────────────┘
       │
       ↓
┌─────────────────┐
│  Git Commit     │
│  (with .md)     │
└──────┬──────────┘
       │
       ↓
┌─────────────┐
│  Push & PR  │
└──────┬──────┘
       │
       ↓
┌──────────────────┐
│  GitHub Actions  │
│  (Check .md?)    │
└──────┬───────────┘
       │
   ┌───┴───┐
   │  Yes  │ → ✅ Pass → Merge
   └───────┘
   ┌───┴───┐
   │   No  │ → ❌ Fail → Add changeset
   └───────┘
```

### Maintainer Release Flow
```
┌──────────────────┐
│  Maintainer on   │
│   Main Branch    │
└────────┬─────────┘
         │
         ↓
┌─────────────────────┐
│ pnpm changeset:     │
│      status         │
│ (Review pending)    │
└────────┬────────────┘
         │
         ↓
┌─────────────────────┐
│   pnpm version      │
│ ┌─────────────────┐ │
│ │ changeset bump  │ │
│ │ sync VERSION    │ │
│ │ update CHANGELOG│ │
│ └─────────────────┘ │
└────────┬────────────┘
         │
         ↓
┌─────────────────────┐
│  Git Commit & Tag   │
│ "chore: release v*" │
└────────┬────────────┘
         │
         ↓
┌─────────────────────┐
│  pnpm release       │
│ ┌─────────────────┐ │
│ │ version:check   │ │
│ │ build packages  │ │
│ │ build .deb      │ │
│ └─────────────────┘ │
└────────┬────────────┘
         │
         ↓
┌─────────────────────┐
│  gh release create  │
│ (Upload .deb)       │
└─────────────────────┘
```

### Version Sync Flow
```
┌──────────────────────────┐
│   changeset version      │
│ (Updates package.json)   │
└────────────┬─────────────┘
             │
             ↓
┌──────────────────────────┐
│  scripts/sync-version.js │
│                          │
│  1. Read package.json    │
│  2. Extract version      │
│  3. Write to VERSION     │
└────────────┬─────────────┘
             │
             ↓
┌──────────────────────────┐
│   VERSION file updated   │
│   (package.json synced)  │
└──────────────────────────┘
```

---

## Appendix A: Changesets CLI Reference

### Quick Commands
```bash
# Add changeset
pnpm changeset           # alias for 'add'
pnpm changeset:add       # explicit add

# Check status
pnpm changeset:status    # show pending changes
pnpm changeset status --verbose  # detailed output

# Bump versions
pnpm version             # our custom script (with sync)
pnpm changeset version   # base changesets command

# Pre-release
pnpm changeset pre enter beta   # enter pre-release mode
pnpm changeset pre exit          # exit pre-release mode
```

### Changeset File Format
```markdown
---
"escapeplan": minor
"@escapeplan/contracts": minor
"escapeplan-api": minor
"escapeplan-web": minor
---

Add game template system for quick room setup

This adds a new template library in the admin panel, allowing operators to create games from predefined puzzle configurations. Includes:
- Template CRUD endpoints in API
- Template picker UI component
- 5 starter templates (Mystery, Sci-Fi, Horror, Adventure, Kids)
```

---

## Appendix B: Troubleshooting Guide

### Issue: Changeset CLI not selecting all packages
```bash
# Symptom
pnpm changeset:add only shows 1-2 packages in selection

# Cause
Fixed config not loaded

# Fix
1. Verify .changeset/config.json has "fixed": [[...all 4 packages]]
2. Delete node_modules/.cache
3. Run: pnpm install
4. Try again: pnpm changeset:add
```

### Issue: VERSION file not syncing
```bash
# Symptom
VERSION file shows old version after 'pnpm version'

# Diagnosis
pnpm run version --loglevel=silly  # Show script execution

# Fix
1. Check scripts/sync-version.js has execute permission
2. Verify package.json has: "version": "changeset version && node scripts/sync-version.js"
3. Run manually: node scripts/sync-version.js
4. Check output for errors
```

### Issue: .deb build has wrong version
```bash
# Symptom
escapeplan_0.1.0_arm64.deb created but VERSION shows 0.2.0

# Cause
build-deb.sh using package.json instead of VERSION

# Fix
1. Edit scripts/build-deb.sh line 5
2. Change to: VERSION=$(cat VERSION | tr -d '\n')
3. Test: pnpm release
4. Verify: ls dist/  # Should show 0.2.0
```

### Issue: GitHub Actions changeset check failing
```bash
# Symptom
PR shows "changeset status" error in CI

# Diagnosis
Check GitHub Actions logs for error message

# Common Causes & Fixes

1. No changeset added
   Fix: pnpm changeset:add (commit .changeset/*.md)

2. Wrong base branch
   Fix: Ensure PR targets 'main' branch

3. Changesets not installed in CI
   Fix: Add to .github/workflows/changeset-check.yml:
        - run: pnpm add -Dw @changesets/cli

4. pnpm not setup correctly
   Fix: Ensure pnpm/action-setup@v3 before changeset check
```

---

## Appendix C: Atomic Task Breakdown

### Task 1: Fix Version Sync (30 min)
**Input:** Current codebase with version mismatch
**Output:** All package.json files at 0.1.0
**Commands:**
```bash
# Edit apps/escapeplan-web/package.json: "version": "0.1.0"
git add apps/escapeplan-web/package.json
git commit -m "fix: sync web package version to 0.1.0"
git push origin main
```

### Task 2: Install Changesets (1 hour)
**Input:** Clean repository
**Output:** Changesets configured with fixed versioning
**Files Created:** `.changeset/config.json`, `.changeset/README.md`
**Commands:**
```bash
pnpm add -Dw @changesets/cli @changesets/changelog-github
pnpm changeset init
# Edit .changeset/config.json (use Section 7 content)
# Create .changeset/README.md (use Section 7 content)
# Update package.json scripts
git add . && git commit -m "chore: configure changesets"
```

### Task 3: Create Sync Scripts (1 hour)
**Input:** Changesets installed
**Output:** VERSION sync automation working
**Files Created:** `scripts/sync-version.js`, `scripts/check-version-sync.js`
**Validation:**
```bash
node scripts/sync-version.js  # Should print success
pnpm version:check             # Should exit 0
```

### Task 4: Update Build Pipeline (30 min)
**Input:** Sync scripts working
**Output:** .deb build uses VERSION file
**Files Modified:** `scripts/build-deb.sh`, `package.json`
**Validation:**
```bash
pnpm release
ls dist/escapeplan_0.1.0_arm64.deb  # Should exist
```

### Task 5: Setup CI/CD (1.5 hours)
**Input:** Local workflow validated
**Output:** GitHub Actions automating checks
**Files Created:** `.github/workflows/changeset-check.yml`, `.github/workflows/release.yml`
**Validation:**
- Create test PR without changeset → CI fails
- Add changeset → CI passes
- Push tag → .deb builds automatically

---

**End of Design Document**

This comprehensive strategy ensures EscapePlan maintains unified versioning across its monorepo while leveraging Changesets for automated version management and CHANGELOG generation. The design prioritizes the VERSION file as the source of truth for production deployments while maintaining synchronization with package.json for development workflows.

Implementation can proceed in 5 atomic tasks totaling approximately 4.5 hours of development time.
