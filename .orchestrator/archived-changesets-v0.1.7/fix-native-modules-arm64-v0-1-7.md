---
"escapeplan-api": patch
---

**Fix native module ARM64 binaries in production builds (v0.1.7 emergency fix)**

## Problem
The better-sqlite3 and argon2 native modules were packaged with x86-64 binaries when building the .deb package on a development machine, causing module load failures on ARM64 Raspberry Pi devices.

**Errors:**
```
Error [ERR_DLOPEN_FAILED]: Module did not self-register: better_sqlite3.node
Cannot find package 'sharp' imported from /opt/escapeplan/api/index.js
```

## Root Cause
- `.deb` package built on x86-64 machine
- `pnpm deploy` packages the native modules from local node_modules
- Native binaries are architecture-specific (x64 vs ARM64)
- Pi attempted to load x64 binaries on ARM64 architecture

## Emergency Fix (Applied in Production)

### Better-sqlite3
```bash
# Rebuild for ARM64 on the device
cd /opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@12.4.1/node_modules/better-sqlite3
sudo npm run build-release

# Verify architecture
file build/Release/better_sqlite3.node
# Output: ELF 64-bit LSB shared object, ARM aarch64
```

### Sharp
```bash
# Completely reinstall all node_modules to get ARM64 binaries
cd /opt/escapeplan/api
sudo rm -rf node_modules
sudo pnpm install --no-frozen-lockfile

# Verified packages installed:
# - @img/sharp-linux-arm64@0.34.4
# - @img/sharp-libvips-linux-arm64@1.2.3
```

### Argon2
```bash
# Rebuild for ARM64
cd /opt/escapeplan/api/node_modules/.pnpm/argon2@0.40.3/node_modules/argon2
sudo npm run install
```

## Proper Source Code Fix

Update `scripts/build-deb.sh` to download pre-built ARM64 binaries for all native modules:

```bash
# After pnpm deploy, download ARM64 binaries

# 1. better-sqlite3
echo "Downloading better-sqlite3 ARM64 binary..."
SQLITE_VERSION="12.4.1"
NODE_VERSION="127"  # Node v22.x uses napi v127
SQLITE_URL="https://github.com/WiseLibs/better-sqlite3/releases/download/v${SQLITE_VERSION}/better-sqlite3-v${SQLITE_VERSION}-napi-v${NODE_VERSION}-linux-arm64.tar.gz"

curl -L "${SQLITE_URL}" -o /tmp/better-sqlite3-arm64.tar.gz
SQLITE_MODULE_PATH="${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/better-sqlite3@${SQLITE_VERSION}/node_modules/better-sqlite3"
mkdir -p "${SQLITE_MODULE_PATH}/build/Release"
tar -xzf /tmp/better-sqlite3-arm64.tar.gz -C "${SQLITE_MODULE_PATH}"
chmod +x "${SQLITE_MODULE_PATH}/build/Release/better_sqlite3.node"

# Verify architecture
file "${SQLITE_MODULE_PATH}/build/Release/better_sqlite3.node" | grep -q "ARM aarch64" || {
  echo "ERROR: better-sqlite3 binary is not ARM64!"
  exit 1
}

# 2. argon2
echo "Downloading argon2 ARM64 binary..."
ARGON2_VERSION="0.40.3"
# Note: argon2 may need to be built in qemu-arm64 environment
# Alternatively, include build step in postinst script

# 3. sharp - already handled in existing build script (lines 177-190)
# Verify it's complete with all libvips dependencies
```

## Alternative Approach: Cross-Compilation

Use Docker with ARM64 emulation for consistent builds:

```dockerfile
# Dockerfile.arm64-build
FROM --platform=linux/arm64 node:22-bookworm-slim

WORKDIR /build
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile

# Verify architectures
RUN file node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

## Files Modified
- **Production:** Rebuilt binaries in `/opt/escapeplan/api/node_modules/`
- **Source (pending):** `scripts/build-deb.sh`
- **Documentation (pending):** Update build instructions in README

## Testing Checklist
- [x] better-sqlite3 loads correctly on ARM64
- [x] sharp processes images without errors
- [x] argon2 password hashing works
- [x] API starts without module load errors
- [x] Database queries execute successfully

## Impact
- **Severity:** CRITICAL - Prevented API from starting
- **Affected Versions:** v0.1.6, v0.1.7 (before this fix)
- **Production Status:** Fixed on device via manual rebuild
- **Build Process:** Needs update to prevent recurrence
