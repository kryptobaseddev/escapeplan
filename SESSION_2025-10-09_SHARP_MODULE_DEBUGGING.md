# Session Summary: Sharp Module Installation Issues (2025-10-09)

## Project Context

**Goal:** Deploy EscapePlan MVP .deb package to Raspberry Pi ARM64
- **Build Machine:** x86_64 (cross-compiling to ARM64)
- **Target Machine:** Raspberry Pi ARM64 (aarch64)
- **Package Format:** Debian .deb with bundled node_modules
- **Deployment:** `sudo dpkg -i escapeplan_VERSION_arm64.deb`

**Git Repositories:**
- **Private Repo:** `kryptobaseddev/escapeplan-app.git` (source code)
- **Public Repo:** `kryptobaseddev/escapeplan.git` (releases only)

**Workflow:**
1. Build .deb package: `bash scripts/build-deb-arm64.sh`
2. Release to public repo: `gh release create vX.X.X --repo kryptobaseddev/escapeplan`
3. Commit source changes to private repo: `git push origin main && git push origin vX.X.X`

## The Problem: Sharp Module Won't Load on ARM64

**Error Message (Persistent across v1.0.7 - v1.0.10):**
```
Error: Could not load the "sharp" module using the linux-arm64 runtime
    at Object.<anonymous> (/opt/escapeplan/api/node_modules/.pnpm/sharp@0.34.4/node_modules/sharp/lib/sharp.js:121:9)
```

**Current Version:** v1.0.10 (still failing)
**Installation Target:** /opt/escapeplan/api/

## Technical Background: Sharp v0.34+ Architecture

Sharp v0.34 uses **platform-specific optional dependencies**:

```
sharp@0.34.4
├── @img/sharp-linux-arm64@0.34.4 (optional)  ← ARM64 .node binary
│   └── optionalDependencies:
│       └── @img/sharp-libvips-linux-arm64@1.2.3  ← libvips shared library
├── @img/sharp-linux-x64@0.34.4 (optional)    ← x64 .node binary
└── @img/sharp-linuxmusl-x64@0.34.4 (optional) ← musl x64 .node binary
```

**Critical Understanding:**
- Sharp does NOT use node-gyp rebuilding like better-sqlite3
- Sharp loads prebuilt binaries from platform-specific packages
- The loader (sharp/lib/sharp.js:121) searches for platform binaries
- If wrong platform exists OR required dependencies missing, it fails

## Attempted Fixes (v1.0.7 → v1.0.10)

### v1.0.7: Initial SSL + Health Check Fixes
**Files Changed:**
- `scripts/nginx-configure.sh`: Auto-generate SSL certificates
- `scripts/pi-post-install.sh`: Remove premature health check

**Result:** Nginx fixed, Sharp issue first discovered

---

### v1.0.8: Nginx WebSocket + Sharp Rebuild Attempt
**Files Changed:**
- `scripts/nginx-configure.sh`: Add WebSocket upgrade map directive
- `scripts/pi-post-install.sh`: Validate both better-sqlite3 AND sharp before rebuild

**Issues:**
- Sharp validation used wrong path: `*/sharp*/build/Release/sharp-*.node`
- Sharp v0.34 doesn't use build/Release, it uses platform packages
- Rebuild attempted `npm rebuild better-sqlite3 sharp` but sharp doesn't support rebuilding

**Result:** Failed - Sharp validation never found the binary

---

### v1.0.9: Remove x64 Sharp Binaries
**Files Changed:**
- `scripts/build-deb-arm64.sh`: Remove x64 sharp binaries after pnpm deploy
- `scripts/pi-post-install.sh`: Check platform-specific binaries at correct paths

**Discovery:**
Found x64 binaries were being installed:
```bash
/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4/    ✓ ARM64
/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-x64@0.34.4/      ✗ x64
/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linuxmusl-x64@0.34.4/  ✗ musl
```

**Fix:** Remove non-ARM64 binaries during build

**Result:** Failed - Removed x64 binaries successfully, but libvips missing

---

### v1.0.10: Bundle sharp-libvips Package
**Files Changed:**
- `scripts/build-deb-arm64.sh`: Download and install `@img/sharp-libvips-linux-arm64@1.2.3`

**Discovery:**
```bash
ldd sharp-linux-arm64.node | grep "not found"
libvips-cpp.so.8.17.2 => not found
```

**Fix:**
Downloaded both packages:
1. `@img/sharp-linux-arm64@0.34.4` - Contains sharp-linux-arm64.node
2. `@img/sharp-libvips-linux-arm64@1.2.3` - Contains libvips-cpp.so.8.17.2

**Result:** BUILD SUCCEEDED (1 bundled library), but RUNTIME STILL FAILS

## Current State (v1.0.10 Installed)

**Verification Commands Run:**

```bash
# Package version
dpkg -l | grep escapeplan
# Output: ii  escapeplan  1.0.10  arm64

# Sharp binaries present
find /opt/escapeplan/api/node_modules/.pnpm -name "sharp*.node" -type f
# Output: ONLY sharp-linux-arm64.node (CORRECT)

# x64 binaries removed
ls -d /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-x64@*
# Output: None found (GOOD)

# ARM64 binary exists
ls -d /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@*
# Output: /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4

# Binary architecture
file /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-linux-arm64/lib/sharp-linux-arm64.node
# Output: ELF 64-bit LSB shared object, ARM aarch64 (CORRECT)

# Shared library dependencies
ldd /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-linux-arm64/lib/sharp-linux-arm64.node | grep "not found"
# Output: libvips-cpp.so.8.17.2 => not found (STILL MISSING!)
```

**Manual Test:**
```bash
cd /opt/escapeplan/api
node -e "console.log(require('sharp'))"
# Output: Error: Could not load the "sharp" module using the linux-arm64 runtime
```

## The Remaining Issue

**Despite bundling sharp-libvips package, ldd still shows "not found"!**

This means one of:
1. The libvips .so file was NOT actually installed to the package
2. The libvips .so file is in the wrong location (Node can't find it)
3. The .so file has incorrect permissions
4. Sharp's loader is looking in the wrong place

**Need to verify on Pi:**
```bash
# Check if libvips package was actually installed
ls -lh /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@*/node_modules/@img/sharp-libvips-linux-arm64/lib/

# Check what .so files exist
find /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@* -name "*.so*" -type f

# Check if pnpm structure is correct
ls -la /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/
```

## Build Script Current State

**scripts/build-deb-arm64.sh (lines 201-238):**

```bash
# Remove x64 sharp binaries
rm -rf node_modules/.pnpm/@img+sharp-linux-x64@* 2>/dev/null || true
rm -rf node_modules/.pnpm/@img+sharp-linuxmusl-x64@* 2>/dev/null || true
# ... (other platforms)

# Download sharp ARM64 binary
curl -L https://registry.npmjs.org/@img/sharp-linux-arm64/-/sharp-linux-arm64-0.34.4.tgz -o /tmp/sharp-arm64.tgz
mkdir -p "${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-linux-arm64"
tar -xzf /tmp/sharp-arm64.tgz -C /tmp
cp -r /tmp/package/* "${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-linux-arm64/"

# Download sharp-libvips
curl -L https://registry.npmjs.org/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.2.3.tgz -o /tmp/sharp-libvips-arm64.tgz
mkdir -p "${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64"
tar -xzf /tmp/sharp-libvips-arm64.tgz -C /tmp
cp -r /tmp/package/* "${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/"

# Verify
LIBVIPS_LIB_DIR="${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/lib"
SHARED_LIBS=$(find "${LIBVIPS_LIB_DIR}" -name "*.so*" -type f 2>/dev/null | wc -l)
echo "✓ Sharp-libvips arm64 package installed with ${SHARED_LIBS} bundled libraries"
# Output during build: "1 bundled libraries"
```

**Build verification showed 1 library, but runtime can't find it!**

## Next Steps (MUST DO)

### 1. Verify sharp-libvips Was Actually Installed

On Raspberry Pi, run:
```bash
# Check if directory exists
ls -la /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/

# Check if lib directory exists
ls -la /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/

# List all .so files
find /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@* -type f -name "*.so*"

# If libvips-cpp.so.8.17.2 exists, check its full path and permissions
find /opt/escapeplan/api/node_modules/.pnpm -name "libvips-cpp.so.8.17.2" -exec ls -lh {} \;
```

### 2. Understand Sharp's Library Resolution

Sharp needs to find libvips. Check how it's looking:
```bash
# Check Sharp's package.json for library paths
cat /opt/escapeplan/api/node_modules/.pnpm/sharp@0.34.4/node_modules/sharp/package.json | grep -A10 optionalDependencies

# Check if Sharp expects a specific directory structure
cat /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/package.json
```

### 3. Check if pnpm Symlinks Are Broken

The pnpm structure requires symlinks. If sharp-libvips is installed but Sharp can't find it:
```bash
# Check if sharp has a symlink to sharp-libvips
ls -la /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/

# Check if @img namespace exists
ls -la /opt/escapeplan/api/node_modules/@img/
```

### 4. Possible Root Cause Hypotheses

**Hypothesis A: pnpm deploy doesn't preserve nested optional dependencies**
- `@img/sharp-linux-arm64` has optionalDependency on `@img/sharp-libvips-linux-arm64`
- We manually install both packages, but pnpm might not link them correctly
- **Test:** Check if symlink from sharp-linux-arm64 to sharp-libvips exists

**Hypothesis B: LD_LIBRARY_PATH not set**
- libvips-cpp.so.8.17.2 exists but is in non-standard location
- Node/Sharp can't find it because LD_LIBRARY_PATH doesn't include the path
- **Test:** Run `LD_LIBRARY_PATH=/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/lib node -e "require('sharp')"`

**Hypothesis C: Missing intermediate symlink**
- Sharp expects sharp-libvips to be accessible via node_modules resolution
- We install it to .pnpm/ but there's no top-level symlink
- **Test:** Check if `/opt/escapeplan/api/node_modules/@img/sharp-libvips-linux-arm64` exists

**Hypothesis D: Package.json missing from sharp-libvips**
- Sharp might discover libvips via package.json
- If we didn't copy package.json during build, resolution fails
- **Test:** `cat /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/package.json`

## Git Version History

- **v1.0.7:** SSL certificates + health check fixes
- **v1.0.8:** Nginx WebSocket + sharp validation (failed)
- **v1.0.9:** Remove x64 binaries (failed - missing libvips)
- **v1.0.10:** Bundle sharp-libvips (failed - runtime can't find libvips)

All versions committed to:
- Private: https://github.com/kryptobaseddev/escapeplan-app
- Public: https://github.com/kryptobaseddev/escapeplan/releases

## Files Modified This Session

1. `VERSION`: 1.0.7 → 1.0.8 → 1.0.9 → 1.0.10
2. `scripts/build-deb-arm64.sh`: Added sharp binary handling (lines 201-238)
3. `scripts/pi-post-install.sh`: Updated sharp validation (lines 188-311)
4. `scripts/nginx-configure.sh`: SSL + WebSocket fixes (lines 33-77)

## Key Commands for Next Session

```bash
# Check installed version
dpkg -l | grep escapeplan

# Verify sharp packages on Pi
find /opt/escapeplan/api/node_modules/.pnpm -name "*sharp*" -type d | grep "@img"

# Check libvips existence
find /opt/escapeplan/api/node_modules/.pnpm -name "libvips*.so*" -type f

# Test Sharp loading with verbose errors
cd /opt/escapeplan/api && NODE_DEBUG=module node -e "require('sharp')" 2>&1 | grep -i sharp

# Check ldd on both binaries
ldd /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-linux-arm64@*/node_modules/@img/sharp-linux-arm64/lib/sharp-linux-arm64.node

# Check pnpm structure integrity
ls -la /opt/escapeplan/api/node_modules/.pnpm/ | grep sharp
ls -la /opt/escapeplan/api/node_modules/@img/
```

## Critical Questions for Next Session

1. **Does sharp-libvips actually exist in the installed package?**
   - Path: `/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/`
   - Expected: lib/libvips-cpp.so.8.17.2

2. **Is the pnpm symlink structure correct?**
   - Sharp might need `/opt/escapeplan/api/node_modules/@img/sharp-libvips-linux-arm64/` symlink

3. **Does Sharp's package.json declare the dependency correctly?**
   - Check: `@img/sharp-linux-arm64/package.json` → optionalDependencies

4. **Can we manually set LD_LIBRARY_PATH as a workaround?**
   - systemd service env var: `Environment="LD_LIBRARY_PATH=..."`

## Alternative Solutions to Consider

### Option 1: Install system libvips
Instead of bundling, use Debian's libvips:
```bash
apt-get install libvips42
```
**Pros:** Known working path
**Cons:** Requires base OS changes (defeats bundled .deb goal)

### Option 2: Use Sharp's rebuild feature (WRONG)
Sharp v0.34+ doesn't support rebuilding - it's prebuilt only.

### Option 3: Manually set RPATH in .node file
Use patchelf to embed library search path:
```bash
patchelf --set-rpath '$ORIGIN/../../@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/lib' sharp-linux-arm64.node
```
**Pros:** Forces runtime linker to look in correct place
**Cons:** Hacky, fragile

### Option 4: Create symlink in standard location
```bash
ln -s /opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/lib/libvips-cpp.so.8.17.2 /usr/lib/aarch64-linux-gnu/
```
**Pros:** Standard ld.so search path
**Cons:** Pollutes system, requires root, not self-contained

## Success Criteria

Sharp module loads successfully:
```bash
cd /opt/escapeplan/api
node -e "console.log(require('sharp'))"
# Expected output: [Function (anonymous)] { ... }
# NO ERROR

systemctl status escapeplan-api
# Expected: active (running)
```

---

### v1.0.11: Fix pnpm Symlink Structure (ROOT CAUSE RESOLVED)

**Files Changed:**
- `scripts/build-deb-arm64.sh`:
  - Remove x64 libvips packages (lines 212-216)
  - Create top-level @img symlinks (lines 244-272)
- `VERSION`: 1.0.10 → 1.0.11

**Root Cause Identified via Diagnostics:**

Ran diagnostic commands on Pi v1.0.10 and found:
```bash
# libvips-cpp.so.8.17.2 EXISTS at correct location ✅
/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64/lib/libvips-cpp.so.8.17.2

# BUT top-level @img directory MISSING ❌
ls: /opt/escapeplan/api/node_modules/@img/ → No such file or directory

# AND x64 libvips still present ❌
@img+sharp-libvips-linux-x64@1.2.3
@img+sharp-libvips-linuxmusl-x64@1.2.3
```

**Why Sharp Failed:**
1. Sharp loaded sharp-linux-arm64.node successfully
2. sharp-linux-arm64.node tried to dynamically load libvips
3. Node's module resolution looked for `@img/sharp-libvips-linux-arm64`
4. **Without `node_modules/@img/` symlinks, resolution failed**
5. ldd showed "not found" because linker couldn't find the .so file via module paths

**The Fix:**
1. **Remove x64 libvips packages** during build:
   - Added rm commands for @img+sharp-libvips-linux-x64@*
   - Added rm commands for @img+sharp-libvips-linuxmusl-x64@*
   - (Plus win32, darwin variants)

2. **Create pnpm top-level symlinks** after installing packages:
   ```bash
   mkdir -p node_modules/@img
   ln -sf ../../.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-linux-arm64 \
          node_modules/@img/sharp-linux-arm64
   ln -sf ../../.pnpm/@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64 \
          node_modules/@img/sharp-libvips-linux-arm64
   ```

**Expected Result:**
- Sharp runtime loader will find sharp-linux-arm64.node
- sharp-linux-arm64.node will dynamically load libvips via module resolution
- Node resolves `@img/sharp-libvips-linux-arm64` via symlink
- Symlink points to .pnpm package containing libvips-cpp.so.8.17.2
- ldd will find the library and Sharp loads successfully

**Build Output Changes:**
```
✓ Non-ARM64 sharp binaries and libvips packages removed
✓ Sharp linux-arm64 binary installed
✓ Sharp-libvips linux-arm64 package installed with 1 bundled libraries
✓ Sharp binary symlink created: node_modules/@img/sharp-linux-arm64
✓ Sharp-libvips symlink created: node_modules/@img/sharp-libvips-linux-arm64
✓ Sharp module resolution structure complete
```

---

---

### v1.0.12: Fix Dynamic Linker RPATH (ACTUAL FIX)

**Files Changed:**
- `scripts/build-deb-arm64.sh`:
  - Add RPATH-compatible symlink inside sharp-linux-arm64 package (lines 272-285)
- `VERSION`: 1.0.11 → 1.0.12

**v1.0.11 Post-Mortem:**

Installed v1.0.11 on Pi and discovered it still failed:
```bash
ldd sharp-linux-arm64.node | grep libvips
# Output: libvips-cpp.so.8.17.2 => not found

node -e "require('sharp')"
# Error: Could not load the "sharp" module using the linux-arm64 runtime
```

**The REAL Problem - RPATH vs Module Resolution:**

v1.0.11 fixed **Node module resolution** (top-level symlinks), but Sharp still failed because of the **dynamic linker**.

RPATH inspection revealed:
```bash
readelf -d sharp-linux-arm64.node | grep RPATH
# Output: Library rpath: [$ORIGIN/../../sharp-libvips-linux-arm64/lib:...]
```

The .node binary has `$ORIGIN/../../sharp-libvips-linux-arm64/lib` in RPATH.

Where $ORIGIN = `.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-linux-arm64/lib/`

This resolves to:
`.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-libvips-linux-arm64/lib`

**BUT that symlink didn't exist in v1.0.11!**

v1.0.11 created:
- ✅ `node_modules/@img/sharp-linux-arm64` (for Node resolution)
- ✅ `node_modules/@img/sharp-libvips-linux-arm64` (for Node resolution)

But **NOT:**
- ❌ `.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-libvips-linux-arm64` (for RPATH/linker)

**The Fix:**

Added symlink inside sharp-linux-arm64's own node_modules directory:
```bash
mkdir -p node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img
ln -sf "../../../@img+sharp-libvips-linux-arm64@1.2.3/node_modules/@img/sharp-libvips-linux-arm64" \
       "node_modules/.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/sharp-libvips-linux-arm64"
```

This matches pnpm's standard structure where each package has its own `node_modules/` with symlinks to dependencies.

**Why Two Levels of Symlinks Are Required:**

1. **Top-level symlinks** (`node_modules/@img/...`) - For Node.js module resolution
   - Allows `require('@img/sharp-linux-arm64')` to work

2. **Package-internal symlinks** (`.pnpm/@img+sharp-linux-arm64@0.34.4/node_modules/@img/...`) - For dynamic linker RPATH
   - Allows `ld.so` to find libvips when loading the .node binary

**Build Output Changes:**
```
✓ Sharp binary symlink created: node_modules/@img/sharp-linux-arm64
✓ Sharp-libvips symlink created: node_modules/@img/sharp-libvips-linux-arm64
✓ RPATH symlink created for dynamic linker
✓ Sharp module resolution structure complete
```

---

## Session End State

- **Version:** v1.0.12 built and released
- **Status:** COMPLETE - Both Node module resolution AND dynamic linker fixed
- **Root Causes Resolved:**
  1. v1.0.11: Missing top-level symlinks (Node module resolution)
  2. v1.0.12: Missing package-internal symlinks (dynamic linker RPATH)
- **Next Action:** Install v1.0.12 on Pi, verify Sharp loads successfully
