# CI/CD Pipeline Setup Complete ✅

## Repository Structure

### `/mnt/projects/escape-plan/escapeplan-app/` (Application Repo)
- **Purpose**: TypeScript/Node.js monorepo for API + Web app
- **Output**: `escapeplan_0.1.0_arm64.deb`
- **Versioning**: Semantic (`v0.1.0`, `v0.2.0`, etc.)

### `/mnt/projects/escape-plan/escapeplan-base/` (Platform Repo)
- **Purpose**: pi-gen based OS image builder
- **Output**: `escapeplan-base-2024.10.01.img`
- **Versioning**: Date-based

---

## ✅ Completed Setup

### 1. **Repository Separation**
- ✅ Initialized `escapeplan-base` as separate git repo
- ✅ Updated `CLAUDE.md` to remove platform references
- ✅ Proper `.gitignore` for both repos

### 2. **Build Scripts**
- ✅ Created `scripts/build-deb.sh` - Builds `.deb` package
- ✅ Updated `package.json` with build commands:
  - `pnpm run dev` - Run API + Web concurrently
  - `pnpm run build` - Build all packages
  - `pnpm run build:deb` - Create `.deb`
  - `pnpm run release` - Alias for `build:deb`

### 3. **GitHub Actions Workflows**

#### `.github/workflows/ci.yml` (Continuous Integration)
- **Triggers**: Push/PR to `main` or `develop`
- **Jobs**:
  - Lint (TypeScript type check)
  - Build (contracts → API → web)
  - Test (Vitest)

#### `.github/workflows/release.yml` (Release Automation)
- **Triggers**: Git tag `v*.*.*`
- **Jobs**:
  - Build `.deb` package
  - Create GitHub Release
  - Upload `.deb` as release asset
  - Auto-generate release notes

### 4. **Auto-Update System**
- ✅ API endpoint: `GET /api/updates/check`
  - Checks GitHub Releases API
  - Compares semantic versions
  - Returns download URL if update available
- ✅ API endpoint: `GET /api/updates/version`
  - Returns current version + build date

### 5. **RBAC Migration Complete**
- ✅ 27 permissions (added 4 view permissions for CRUD)
- ✅ Database-driven (roles, permissions, role_permissions tables)
- ✅ Removed all hardcoded constants
- ✅ Deleted legacy `rbac.ts`
- ✅ Fixed Drizzle client API (`drizzle({ client: sqlite, schema })`)

---

## 🚀 Release Workflow

### Creating a Release

```bash
# 1. Bump version in package.json
npm version patch  # 0.1.0 → 0.1.1
# or
npm version minor  # 0.1.0 → 0.2.0

# 2. Push tag to GitHub
git push origin main --tags

# 3. GitHub Actions automatically:
#    - Builds .deb package
#    - Creates GitHub Release
#    - Uploads .deb asset
```

### Installing Update on Pi

```bash
# Check for updates
curl http://localhost:4000/api/updates/check

# Download latest .deb
wget https://github.com/yourorg/escapeplan/releases/download/v0.1.1/escapeplan_0.1.1_arm64.deb

# Install
sudo dpkg -i escapeplan_0.1.1_arm64.deb
sudo systemctl restart escapeplan-api escapeplan-web
```

---

## 📦 Package Contents

The `.deb` package includes:

### Files Installed:
- `/opt/escapeplan/api/` - Built API (dist/index.js)
- `/opt/escapeplan/web/` - Built SvelteKit (.svelte-kit/output)
- `/etc/systemd/system/escapeplan-api.service`
- `/etc/systemd/system/escapeplan-web.service`

### Post-Install Actions:
1. Creates `escapeplan` user
2. Installs production dependencies (`npm ci --production`)
3. Sets file ownership
4. Enables systemd services (doesn't start)

---

## 🔐 Environment Variables

### GitHub Actions (Required)
- `GITHUB_TOKEN` - Auto-provided by GitHub

### Runtime (Optional)
- `GITHUB_REPO` - Repo for update checks (default: `yourorg/escapeplan`)
- `PORT` - API port (default: `4000`)
- `NODE_ENV` - Environment (default: `production`)

---

## 🧪 Testing Locally

```bash
# 1. Build .deb package
cd /mnt/projects/escape-plan/escapeplan-app
pnpm run build:deb

# 2. Check output
ls -lh dist/escapeplan_*.deb

# 3. Inspect package contents
dpkg-deb --contents dist/escapeplan_0.1.0_arm64.deb

# 4. Test installation (requires Ubuntu/Debian)
sudo dpkg -i dist/escapeplan_0.1.0_arm64.deb
```

---

## ✅ Next Steps

### For escapeplan-app:
1. Push to GitHub to trigger CI
2. Create `v0.1.0` tag to test release workflow
3. Configure `GITHUB_REPO` environment variable

### For escapeplan-base:
1. Add pi-gen build scripts
2. Configure download of `.deb` from releases
3. Create separate GitHub repo
4. Setup release workflow for OS images

---

## 📝 Summary

**Your setup works perfectly!** The nested folder structure (`escape-plan/escapeplan-app/`) is fine as long as:
1. ✅ `escapeplan-app` has `.git` (confirmed)
2. ✅ `pnpm-workspace.yaml` exists (confirmed)
3. ✅ `package.json` paths are correct (confirmed)
4. ✅ Build/lint/test all pass (confirmed)

The monorepo is fully functional and ready for development + deployment.
