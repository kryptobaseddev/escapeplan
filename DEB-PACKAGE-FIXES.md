# .deb Package Fixes Required for v0.2.0

**Created:** 2025-10-05
**Updated:** 2025-10-05 02:45 BST
**Current Version:** v0.1.0 (BROKEN - DO NOT USE)
**Target Version:** v0.2.0
**Status:** 🔴 v0.1.0 IS COMPLETELY NON-FUNCTIONAL

## ⚠️ CRITICAL WARNING

**v0.1.0 CANNOT BE INSTALLED ON RASPBERRY PI**

The v0.1.0 release has multiple **CRITICAL BREAKING BUGS** that make it completely unusable:
1. Native modules compiled for wrong architecture (x86-64 instead of ARM64)
2. Missing package dependencies (contracts dist/ folder structure broken)
3. Missing pnpm symlinks (drizzle-zod not linked)
4. No database initialization (seed scripts not included)
5. Systemd services fail to start

**Time to Manual Fix:** 2-3 hours of expert troubleshooting
**Recommendation:** DO NOT attempt to install v0.1.0. Wait for v0.2.0.

---

## Summary of ALL Issues Found (9 Critical Bugs)

| # | Issue | Severity | Impact | User Hours Lost |
|---|-------|----------|--------|-----------------|
| 1 | Contracts `dist/` folder missing | CRITICAL | API won't start | 0.5h |
| 2 | better-sqlite3 wrong architecture | CRITICAL | Native module failure | 1.5h |
| 3 | drizzle-zod missing symlinks | CRITICAL | Module resolution fails | 0.5h |
| 4 | Seed scripts not included | CRITICAL | No database | 0.5h |
| 5 | Backup timer missing | HIGH | No automated backups | 0.2h |
| 6 | Post-install incomplete | HIGH | Manual setup required | Variable |
| 7 | systemd ExecStart wrong | MEDIUM | Confusion | 0.1h |
| 8 | nginx config missing | LOW | Manual config | 0.2h |
| 9 | Package dependencies | LOW | apt-get -f needed | 0.1h |

**Total User Time Lost:** ~4 hours per installation attempt

---

## Issue 1: @escapeplan/contracts Missing `dist/` Folder Structure ⚠️ CRITICAL

**Severity:** CRITICAL - Prevents API from starting
**Impact:** Application completely non-functional

### Problem
The `build-deb.sh` script copies contracts package files to the wrong location:

**Current (BROKEN):**
```
/opt/escapeplan/api/node_modules/@escapeplan/contracts/
├── index.js
├── runtime.js
├── schema.js
└── validation.js
```

**Expected (CORRECT):**
```
/opt/escapeplan/api/node_modules/@escapeplan/contracts/
├── dist/
│   ├── index.js
│   ├── runtime.js
│   ├── schema.js
│   └── validation.js
└── package.json
```

### Root Cause
`scripts/build-deb.sh` lines 39-47 use this pattern:

```bash
rm -rf "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts"
mkdir -p "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts"
cp -r packages/contracts/dist/* "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts/"
cp packages/contracts/package.json "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts/"
```

This copies `dist/*` to the contracts root instead of preserving the `dist/` folder.

### Fix Required
Change the copy command to preserve directory structure:

```bash
# WRONG (current):
cp -r packages/contracts/dist/* "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts/"

# CORRECT (fix):
mkdir -p "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts/dist"
cp -r packages/contracts/dist/* "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts/dist/"
cp packages/contracts/package.json "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts/"
```

### Files to Update
- `scripts/build-deb.sh` (lines 39-47 for API, similar for Web)

### Testing Checklist
- [ ] Build .deb package with fix
- [ ] Install on clean Raspberry Pi
- [ ] Verify contracts files exist at `/opt/escapeplan/api/node_modules/@escapeplan/contracts/dist/`
- [ ] API service starts without module errors
- [ ] Run: `node -e "import('@escapeplan/contracts').then(console.log)"` (should succeed)

---

## Issue 2: better-sqlite3 Compiled for Wrong Architecture ⚠️ CRITICAL

**Severity:** CRITICAL - Native module won't load
**Impact:** API crashes on startup with "cannot open shared object file"

### Problem
The `.deb` package was built on an **x86-64** machine, and the `better-sqlite3` native module was compiled for x86-64 instead of ARM64 (aarch64). When the Pi tries to load it:

```
Error: /opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@9.6.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node: cannot open shared object file: No such file or directory
```

**Verification:**
```bash
# Shows x86-64 (WRONG):
file better_sqlite3.node
# Output: ELF 64-bit LSB shared object, x86-64, version 1 (SYSV)

# Pi is ARM:
uname -m
# Output: aarch64
```

### Root Cause
1. The .deb was built using `pnpm deploy` on an x86-64 development machine
2. better-sqlite3 is a **native module** that must be compiled for the target architecture
3. The build script doesn't cross-compile or rebuild native modules for ARM

### Fix Required

**Option A: Cross-compile during build (RECOMMENDED)**

Update `scripts/build-deb.sh` to use Docker with ARM emulation:

```bash
# Use Docker with ARM64 emulation
docker run --platform linux/arm64 -v $(pwd):/workspace node:22 bash -c "
  cd /workspace
  pnpm install
  pnpm build
  pnpm --filter escapeplan-api deploy --prod build/deb/opt/escapeplan/api
"
```

**Option B: Post-install rebuild (FALLBACK)**

Add to `DEBIAN/postinst`:

```bash
#!/bin/bash
set -e

# Rebuild native modules for current architecture
cd /opt/escapeplan/api
npm rebuild better-sqlite3

echo "Native modules rebuilt for $(uname -m)"
```

**Recommendation:** Use Option A (Docker cross-compile) to avoid requiring build tools on the Pi.

### Files to Update
- `scripts/build-deb.sh` - Add Docker ARM64 build
- OR `.github/workflows/publish.yml` - Use ARM64 runner
- OR `DEBIAN/postinst` - Add npm rebuild step

### Testing Checklist
- [ ] Build .deb on x86-64 machine with ARM cross-compile
- [ ] Install on ARM Raspberry Pi
- [ ] Verify better_sqlite3.node is ARM64: `file better_sqlite3.node | grep aarch64`
- [ ] API starts without "cannot open shared object" error
- [ ] Database operations work

### Manual Workaround (For v0.1.0 Users)

```bash
# Install build tools
sudo apt-get install -y build-essential python3

# Clean old build
sudo rm -rf /opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@9.6.0/node_modules/better-sqlite3/build

# Rebuild for ARM
cd /opt/escapeplan/api
sudo -u escapeplan npm rebuild better-sqlite3

# Restart service
sudo systemctl restart escapeplan-api
```

**Time Required:** 5-10 minutes (module takes ~2 min to compile on Pi)

---

## Issue 3: drizzle-zod Missing pnpm Symlinks ⚠️ CRITICAL

**Severity:** CRITICAL - Module resolution fails
**Impact:** API crashes with "Cannot find package 'drizzle-zod'"

### Problem
The contracts package imports `drizzle-zod` but pnpm didn't create the necessary symlinks in the deployed package:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'drizzle-zod' imported from
/opt/escapeplan/api/node_modules/@escapeplan/contracts/dist/validation.js
```

**What's Missing:**
- `/opt/escapeplan/api/node_modules/drizzle-zod` → should symlink to `.pnpm/drizzle-zod@.../node_modules/drizzle-zod`
- `/opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/drizzle-zod` → same

### Root Cause
The `pnpm deploy --legacy` command in `build-deb.sh` converts symlinks to real files but doesn't create all necessary module resolution paths for nested dependencies.

Specifically:
1. Contracts package depends on `drizzle-zod`
2. `pnpm deploy` copies contracts to `node_modules/@escapeplan/contracts`
3. But doesn't create `contracts/node_modules/drizzle-zod` symlink
4. Node.js ESM loader can't resolve the dependency

### Fix Required

**Option A: Include contracts dependencies (RECOMMENDED)**

```bash
# In build-deb.sh, when copying contracts:
mkdir -p "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules"

# Symlink all contracts dependencies
for dep in drizzle-zod drizzle-orm zod; do
  src=$(find node_modules/.pnpm -name "${dep}" -type d | grep "node_modules/${dep}$" | head -1)
  ln -s "../../.pnpm/$(basename $(dirname $(dirname $src)))/node_modules/${dep}" \
    "${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/${dep}"
done
```

**Option B: Bundle contracts as standalone (ALTERNATIVE)**

Build contracts with all dependencies bundled (use tsup/esbuild to inline dependencies).

### Files to Update
- `scripts/build-deb.sh` (lines 39-47) - Add symlink creation loop

### Testing Checklist
- [ ] Build .deb with fix
- [ ] Install on Pi
- [ ] Verify symlinks exist: `ls -la /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/`
- [ ] API imports contracts without errors
- [ ] Run: `node -e "import('@escapeplan/contracts').then(console.log)"` succeeds

### Manual Workaround (For v0.1.0 Users)

```bash
# Create contracts node_modules directory
sudo -u escapeplan mkdir -p /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules

# Symlink drizzle-zod
sudo -u escapeplan ln -s \
  /opt/escapeplan/api/node_modules/.pnpm/drizzle-zod@0.8.3_drizzle-orm@0.44.5_@types+better-sqlite3@7.6.13_better-sqlite3@9.6.0_kysely@0.28.7__zod@3.25.76/node_modules/drizzle-zod \
  /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/drizzle-zod

# Symlink zod
sudo -u escapeplan ln -s \
  /opt/escapeplan/api/node_modules/.pnpm/zod@3.25.76/node_modules/zod \
  /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/zod

# Symlink drizzle-orm
sudo -u escapeplan ln -s \
  /opt/escapeplan/api/node_modules/.pnpm/drizzle-orm@0.44.5_@types+better-sqlite3@7.6.13_better-sqlite3@9.6.0_kysely@0.28.7/node_modules/drizzle-orm \
  /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/drizzle-orm
```

---

## Issue 4: Seed Scripts Not Included in Package ⚠️ CRITICAL

**Severity:** CRITICAL - No database initialization
**Impact:** API crashes with "no such table: session_puzzles"

### Problem
The package doesn't include database seed scripts, so there's no way to initialize the database on first install:

```
SqliteError: no such table: session_puzzles
    at Database.prepare (/opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@9.6.0/node_modules/better-sqlite3/lib/methods/wrappers.js:5:21)
```

**What's Missing:**
- `src/db/seed.ts` - Not compiled or included
- `src/db/seeds/*.ts` - Seed modules not in package
- No automated database initialization on first boot

**What IS Included:**
- `drizzle/0000_perfect_jasper_sitwell.sql` - Schema migration (✓)
- `drizzle/triggers.sql` - Database triggers (✓)

### Root Cause
1. The build script only includes compiled `dist/` JavaScript
2. Seed scripts are TypeScript in `src/db/seeds/`
3. tsup build doesn't compile seed scripts (they're not imported by index.ts)
4. postinst doesn't run any database initialization

### Fix Required

**Option A: Compile seed scripts (RECOMMENDED)**

```bash
# Update tsup.config.ts to include seeds
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/db/seeds/index.ts'  // ADD THIS
  ],
  // ...
})
```

Then in postinst:

```bash
if [ ! -f /var/lib/escapeplan/escapeplan.db ]; then
  cd /opt/escapeplan/api
  node dist/db/seeds/index.js
fi
```

**Option B: Use SQL migrations (SIMPLER)**

```bash
# In DEBIAN/postinst
if [ ! -f /var/lib/escapeplan/escapeplan.db ]; then
  sqlite3 /var/lib/escapeplan/escapeplan.db < /opt/escapeplan/api/drizzle/0000_perfect_jasper_sitwell.sql
  sqlite3 /var/lib/escapeplan/escapeplan.db < /opt/escapeplan/api/drizzle/triggers.sql

  # Insert essential seed data (RBAC + admin user) via SQL
  sqlite3 /var/lib/escapeplan/escapeplan.db < /opt/escapeplan/api/drizzle/seed-essential.sql
fi
```

**Recommendation:** Use Option B (SQL) to avoid Node.js dependency during postinst.

### Files to Update
- `apps/escapeplan-api/drizzle/seed-essential.sql` - NEW FILE with RBAC + admin INSERT statements
- `scripts/build-deb.sh` - Copy drizzle/*.sql to package
- `DEBIAN/postinst` - Add database initialization

### Testing Checklist
- [ ] Build .deb with seed SQL
- [ ] Install on clean Pi
- [ ] Database created at `/var/lib/escapeplan/escapeplan.db`
- [ ] Tables exist: `sqlite3 escapeplan.db ".tables"`
- [ ] Admin user exists: `SELECT * FROM user WHERE email='admin@escapeplan.local';`
- [ ] API starts without "no such table" errors

### Manual Workaround (For v0.1.0 Users)

```bash
# Create database with schema
cd /opt/escapeplan/api
sqlite3 /var/lib/escapeplan/escapeplan.db < drizzle/0000_perfect_jasper_sitwell.sql
sqlite3 /var/lib/escapeplan/escapeplan.db < drizzle/triggers.sql

# Set ownership
sudo chown escapeplan:escapeplan /var/lib/escapeplan/escapeplan.db*

# NOTE: Database has NO SEED DATA (no admin user, no RBAC)
# You'll need to manually insert an admin user or the app won't be usable
```

**CRITICAL:** Without seed data, the application is unusable (no login possible). This is a **BLOCKER**.

---

## Issue 5: Missing Backup Timer systemd Files ⚠️ MEDIUM

**Severity:** MEDIUM - Automated backups don't work
**Impact:** Users must manually create backup timer

### Problem
The backup timer files exist in `apps/escapeplan-api/systemd/` but are NOT copied to the `.deb` package.

**Files Missing from Package:**
- `escapeplan-backup.service`
- `escapeplan-backup.timer`

### Root Cause
`build-deb.sh` creates API/Web service files inline (lines 50-86) but doesn't copy the backup timer files from the source tree.

### Fix Required
Add these sections to `build-deb.sh` after the API/Web service creation:

```bash
# Copy backup timer files
cp apps/escapeplan-api/systemd/escapeplan-backup.service "${BUILD_DIR}/etc/systemd/system/"
cp apps/escapeplan-api/systemd/escapeplan-backup.timer "${BUILD_DIR}/etc/systemd/system/"
```

OR update the postinst script to copy them during installation.

### Files to Update
- `scripts/build-deb.sh` (add backup timer file copy)
- OR `DEBIAN/postinst` script (add backup timer installation)

### Testing Checklist
- [ ] Build .deb package with fix
- [ ] Install on clean Raspberry Pi
- [ ] Verify `/etc/systemd/system/escapeplan-backup.service` exists
- [ ] Verify `/etc/systemd/system/escapeplan-backup.timer` exists
- [ ] Run: `systemctl enable escapeplan-backup.timer` (should succeed)
- [ ] Run: `systemctl list-timers escapeplan-backup.timer` (should show next run time)

---

## Issue 3: Missing Post-Install Script in Package ⚠️ HIGH

**Severity:** HIGH - Manual setup required
**Impact:** Users must manually run database initialization

### Problem
The comprehensive `scripts/pi-post-install.sh` script exists but is NOT included in the `.deb` package.

**Currently Missing:**
- Database seeding automation
- First-run detection
- Service health checks
- User-friendly installation summary

### Root Cause
`build-deb.sh` doesn't copy `scripts/pi-post-install.sh` into the package or reference it in the postinst script.

### Fix Required

**Option A: Include script in package (RECOMMENDED)**
```bash
# Add to build-deb.sh
mkdir -p "${BUILD_DIR}/opt/escapeplan/scripts"
cp scripts/pi-post-install.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
chmod +x "${BUILD_DIR}/opt/escapeplan/scripts/pi-post-install.sh"
```

**Option B: Inline the logic in DEBIAN/postinst**
Merge `scripts/pi-post-install.sh` logic into the `DEBIAN/postinst` script (lines 103-134).

### Files to Update
- `scripts/build-deb.sh` (add script copy)
- `DEBIAN/postinst` (call the script or inline the logic)

### Testing Checklist
- [ ] Build .deb package with fix
- [ ] Install on clean Raspberry Pi
- [ ] Verify database is created automatically at `/var/lib/escapeplan/escapeplan.db`
- [ ] Verify admin user exists (can login with escapeplan/escapeplan)
- [ ] Verify services start automatically
- [ ] Verify installation summary is shown to user

---

## Issue 4: Incomplete DEBIAN/postinst Script ⚠️ HIGH

**Severity:** HIGH - Services don't start after install
**Impact:** Requires manual service startup

### Problem
Current `DEBIAN/postinst` (lines 103-134 in `build-deb.sh`) is minimal:
- Creates user and directories
- Enables services
- Does NOT start services
- Does NOT initialize database
- Does NOT generate required secrets

### Missing Functionality
1. **Secret Generation** - `BETTER_AUTH_SECRET` and `CAMERA_ENCRYPTION_KEY` must be created
2. **Database Initialization** - Seed script must run on first install
3. **Service Startup** - Services should start automatically
4. **First-Run Detection** - Don't re-seed on package upgrade

### Fix Required

Update `DEBIAN/postinst` to include:

```bash
#!/bin/bash
set -e

# ... existing user/directory creation ...

# Generate secrets if not present
if [ ! -f /etc/escapeplan/api.env ]; then
    echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" > /etc/escapeplan/api.env
    echo "CAMERA_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> /etc/escapeplan/api.env
    chmod 600 /etc/escapeplan/api.env
    chown escapeplan:escapeplan /etc/escapeplan/api.env
fi

# Initialize database on first install
if [ ! -f /var/lib/escapeplan/escapeplan.db ]; then
    sudo -u escapeplan sh -c "cd /opt/escapeplan/api && node src/db/seed.ts"
fi

# Reload systemd
systemctl daemon-reload

# Enable and start services
systemctl enable escapeplan-api.service
systemctl enable escapeplan-web.service
systemctl enable escapeplan-backup.timer

systemctl start escapeplan-api.service
systemctl start escapeplan-web.service
systemctl start escapeplan-backup.timer

echo "EscapePlan installed successfully!"
echo "Default credentials: escapeplan / escapeplan"
echo "Access at: http://10.10.10.1:5173 (or https://escapeplan.local)"
```

### Files to Update
- `scripts/build-deb.sh` (DEBIAN/postinst section, lines 103-134)

### Testing Checklist
- [ ] Build .deb package with fix
- [ ] Install on clean Raspberry Pi
- [ ] Verify `/etc/escapeplan/api.env` is created with secrets
- [ ] Verify database is created and seeded
- [ ] Verify all 3 services start automatically
- [ ] Verify API is accessible at `http://localhost:4000/api/health`
- [ ] Verify web UI is accessible

---

## Issue 5: systemd Service Files Use Wrong ExecStart Path ⚠️ MEDIUM

**Severity:** MEDIUM - Services fail if systemd start.sh missing
**Impact:** Depends on presence of optional start.sh script

### Problem
Current systemd service files (generated in `build-deb.sh`):

```ini
ExecStart=/usr/bin/node index.js  # escapeplan-api.service
ExecStart=/usr/bin/node .svelte-kit/output/server/index.js  # escapeplan-web.service
```

**Issue:** The API service file also references a conditional start.sh:
```ini
ConditionPathExists=/opt/escapeplan/api/systemd/start.sh
```

But then doesn't use it in ExecStart.

### Fix Required

**Option A: Use the start.sh script (if it does something important)**
```ini
[Service]
ExecStart=/opt/escapeplan/api/systemd/start.sh
```

**Option B: Remove the ConditionPathExists (if start.sh is unnecessary)**
```ini
[Service]
ExecStart=/usr/bin/node index.js
# Remove: ConditionPathExists=/opt/escapeplan/api/systemd/start.sh
```

### Investigation Needed
- [ ] Check contents of `/opt/escapeplan/api/systemd/start.sh`
- [ ] Determine if it sets required env vars or does other setup
- [ ] If yes: use it in ExecStart
- [ ] If no: remove the condition

### Files to Update
- `scripts/build-deb.sh` (systemd service file generation, lines 50-86)

---

## Issue 6: Missing nginx Configuration in Package ⚠️ LOW

**Severity:** LOW - Workaround available
**Impact:** Users must manually create nginx config

### Problem
The package doesn't include nginx configuration, requiring users to:
1. Manually create `/etc/escapeplan/nginx.conf`
2. Manually symlink to `/etc/nginx/sites-enabled/`

### Fix Required
Add nginx config file to package:

```bash
# Add to build-deb.sh
mkdir -p "${BUILD_DIR}/etc/escapeplan"
cp scripts/nginx/escapeplan.conf "${BUILD_DIR}/etc/escapeplan/nginx.conf"
```

Update postinst to enable it:

```bash
# Create symlink
ln -sf /etc/escapeplan/nginx.conf /etc/nginx/sites-enabled/escapeplan
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### Files to Update
- `scripts/build-deb.sh` (add nginx config copy)
- `DEBIAN/postinst` (add nginx setup)

### Testing Checklist
- [ ] Build .deb package with fix
- [ ] Install on clean Raspberry Pi
- [ ] Verify `/etc/escapeplan/nginx.conf` exists
- [ ] Verify symlink `/etc/nginx/sites-enabled/escapeplan` exists
- [ ] Verify nginx config is valid (`nginx -t`)
- [ ] Verify web UI accessible at `http://escapeplan.local`

---

## Issue 7: Package Doesn't Handle Dependencies ⚠️ LOW

**Severity:** LOW - Standard apt workflow
**Impact:** Requires `apt-get install -f` after dpkg install

### Problem
The `DEBIAN/control` file (lines 89-100) lists dependencies:

```
Depends: nodejs (>= 20), nginx, sqlite3
```

But users report needing to run `apt-get install -f` after `dpkg -i`.

### Investigation Needed
- [ ] Verify if this is expected dpkg behavior
- [ ] Check if adding `Pre-Depends` helps
- [ ] Consider creating a wrapper script that runs `apt-get install -f` automatically

### Recommendation
This may be normal `.deb` behavior. Document it clearly in installation instructions rather than trying to fix.

---

## Summary of Required Changes

### Critical (Must Fix Before v0.2.0)
1. ✅ Fix contracts `dist/` folder structure (`build-deb.sh`)
2. ✅ Include backup timer files (`build-deb.sh`)
3. ✅ Enhance `DEBIAN/postinst` with secrets, db init, service start

### High Priority (Should Fix Before v0.2.0)
4. ✅ Include `pi-post-install.sh` in package
5. ✅ Fix systemd service ExecStart paths

### Medium Priority (Nice to Have)
6. ⚠️ Include nginx config in package

### Low Priority (Document or Defer)
7. ⚠️ Investigate dependency installation flow

---

## Testing Plan for v0.2.0

### Pre-Release Testing
1. Build v0.2.0 .deb package with all fixes
2. Flash fresh Raspberry Pi OS to SD card
3. Install package: `sudo dpkg -i escapeplan_0.2.0_arm64.deb`
4. Verify:
   - No errors during installation
   - Database created and seeded
   - All services start automatically
   - API responds at `http://localhost:4000/api/health`
   - Web UI loads at `http://10.10.10.1:5173`
   - Can login with escapeplan/escapeplan
   - Backup timer is scheduled

### Regression Testing
5. Test package upgrade (v0.1.0 → v0.2.0)
   - Verify existing database is NOT overwritten
   - Verify existing secrets are preserved
   - Verify user data remains intact

---

## Files Requiring Changes

1. `scripts/build-deb.sh` - Primary build script
   - Fix contracts dist/ copy (lines 39-47)
   - Add backup timer copy
   - Add nginx config copy
   - Add pi-post-install.sh copy

2. `DEBIAN/postinst` (inline in build-deb.sh)
   - Add secret generation
   - Add database initialization
   - Add service startup
   - Add nginx configuration

3. `docs/RASPBERRY_PI_INSTALLATION.md`
   - Update installation steps to reflect automatic setup
   - Remove manual workarounds that are now handled by package

---

## Related Issues

- See `apps/DOCS/RASPBERRY_PI_SETUP_REQUIREMENTS.md` for full system requirements
- See `scripts/systemd/README.md` for backup timer documentation
- See `scripts/nginx/README.md` for nginx configuration details

---

## Complete Manual Fix Script (For v0.1.0 Emergency Recovery)

If you MUST get v0.1.0 working, run this complete fix script:

```bash
#!/bin/bash
set -euo pipefail

echo "=== EscapePlan v0.1.0 Emergency Fix Script ==="
echo "This will take 10-15 minutes..."

# 1. Fix contracts dist/ folder
echo "[1/6] Fixing contracts package structure..."
sudo -u escapeplan mkdir -p /opt/escapeplan/api/node_modules/@escapeplan/contracts/dist
sudo -u escapeplan mv /opt/escapeplan/api/node_modules/@escapeplan/contracts/*.js /opt/escapeplan/api/node_modules/@escapeplan/contracts/dist/ 2>/dev/null || true
sudo -u escapeplan mv /opt/escapeplan/api/node_modules/@escapeplan/contracts/*.d.ts /opt/escapeplan/api/node_modules/@escapeplan/contracts/dist/ 2>/dev/null || true

# 2. Rebuild better-sqlite3 for ARM
echo "[2/6] Installing build tools..."
sudo apt-get update
sudo apt-get install -y build-essential python3 sqlite3

echo "[3/6] Rebuilding better-sqlite3 for ARM64 (this takes ~2 minutes)..."
sudo rm -rf /opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@9.6.0/node_modules/better-sqlite3/build
cd /opt/escapeplan/api
sudo -u escapeplan npm rebuild better-sqlite3

# 3. Fix drizzle-zod symlinks
echo "[4/6] Creating pnpm symlinks for drizzle-zod..."
sudo -u escapeplan mkdir -p /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules
sudo -u escapeplan ln -sf /opt/escapeplan/api/node_modules/.pnpm/drizzle-zod@0.8.3_drizzle-orm@0.44.5_@types+better-sqlite3@7.6.13_better-sqlite3@9.6.0_kysely@0.28.7__zod@3.25.76/node_modules/drizzle-zod /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/drizzle-zod
sudo -u escapeplan ln -sf /opt/escapeplan/api/node_modules/.pnpm/zod@3.25.76/node_modules/zod /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/zod
sudo -u escapeplan ln -sf /opt/escapeplan/api/node_modules/.pnpm/drizzle-orm@0.44.5_@types+better-sqlite3@7.6.13_better-sqlite3@9.6.0_kysely@0.28.7/node_modules/drizzle-orm /opt/escapeplan/api/node_modules/@escapeplan/contracts/node_modules/drizzle-orm

# 4. Initialize database
echo "[5/6] Creating database..."
if [ ! -f /var/lib/escapeplan/escapeplan.db ]; then
  cd /opt/escapeplan/api
  sqlite3 /var/lib/escapeplan/escapeplan.db < drizzle/0000_perfect_jasper_sitwell.sql
  sqlite3 /var/lib/escapeplan/escapeplan.db < drizzle/triggers.sql
  sudo chown escapeplan:escapeplan /var/lib/escapeplan/escapeplan.db*
  echo "⚠️  WARNING: Database has NO seed data (no admin user, no RBAC)"
  echo "⚠️  You will need to manually create an admin user or the app won't work"
fi

# 5. Restart services
echo "[6/6] Restarting services..."
sudo systemctl restart escapeplan-api
sudo systemctl restart escapeplan-web

sleep 3

# 6. Verify
echo ""
echo "=== Verification ==="
if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
  echo "✅ API is running!"
else
  echo "❌ API failed to start. Check logs: sudo journalctl -u escapeplan-api -n 50"
  exit 1
fi

echo ""
echo "=== CRITICAL NEXT STEPS ==="
echo "1. Database has no seed data - you MUST manually create an admin user"
echo "2. Run seed data manually (instructions in DEB-PACKAGE-FIXES.md)"
echo "3. Access UI at http://10.10.10.1:5173"
echo ""
echo "⚠️  IMPORTANT: This is a temporary fix. Install v0.2.0 when available."
```

**Save as:** `/tmp/fix-v010.sh`
**Run:** `sudo bash /tmp/fix-v010.sh`
**Time:** 10-15 minutes

---

## Development Team Action Items

### Immediate (v0.2.0 - MUST FIX BEFORE NEXT RELEASE)

1. **Build System**
   - [ ] Add ARM64 cross-compilation (Docker or GitHub Actions ARM runner)
   - [ ] Fix contracts package dist/ folder structure in build-deb.sh
   - [ ] Create pnpm symlinks for contracts dependencies
   - [ ] Include backup timer files in package
   - [ ] Test .deb build on ARM64 before release

2. **Database Initialization**
   - [ ] Create `drizzle/seed-essential.sql` with RBAC + admin user
   - [ ] Add database init to DEBIAN/postinst
   - [ ] Test first-boot database creation

3. **Post-Install Script**
   - [ ] Add secret generation (BETTER_AUTH_SECRET, CAMERA_ENCRYPTION_KEY)
   - [ ] Add service startup
   - [ ] Add first-run validation

### High Priority (v0.2.1)

4. **Systemd Services**
   - [ ] Fix ExecStart paths (use start.sh or direct node command consistently)
   - [ ] Verify ConditionPathExists directives

5. **Nginx Configuration**
   - [ ] Include nginx config in package
   - [ ] Auto-configure during postinst

### Documentation

6. **Installation Docs**
   - [ ] Update RASPBERRY_PI_INSTALLATION.md with v0.2.0 simplified steps
   - [ ] Add troubleshooting section
   - [ ] Document system requirements clearly

---

## Lessons Learned

1. **Always test on target architecture** - v0.1.0 was never tested on actual Raspberry Pi ARM64
2. **Include database initialization** - Seed scripts must be part of deployment
3. **Test the .deb package** - Install on clean system before release
4. **Use CI/CD properly** - GitHub Actions should build for ARM64 and test on ARM
5. **Version control matters** - Better testing would have caught these issues pre-release

---

**Last Updated:** 2025-10-05 02:45 BST
**Status:** COMPLETE - All v0.1.0 issues documented with fixes
**Next Steps:** Developer team must implement fixes for v0.2.0
