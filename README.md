# EscapePlan Application

Offline-first escape room management system for Raspberry Pi.

## 📦 Repository Structure

```
escapeplan-app/
├── apps/
│   ├── escapeplan-api/     # Fastify backend (port 4000)
│   └── escapeplan-web/     # SvelteKit PWA (port 5173)
├── packages/
│   └── contracts/          # Shared TypeScript types
├── scripts/
│   └── build-deb.sh        # Debian package builder
└── .github/workflows/      # CI/CD pipelines
```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Development (runs API + Web concurrently)
pnpm run dev

# Build all packages
pnpm run build

# Run tests
pnpm run test

# Type check
pnpm run lint
```

## 📦 Building for Production

### Local `.deb` Package Build

```bash
# Build .deb package
pnpm run build:deb

# Output: dist/escapeplan_0.1.0_arm64.deb
```

### GitHub Actions (Automated)

**On every push to `main`:**
- ✅ Lint & type check
- ✅ Run tests
- ✅ Build packages

**On version tag (`v*.*.*`):**
- ✅ Build `.deb` package
- ✅ Create GitHub Release
- ✅ Upload `.deb` to release assets

```bash
# Create release
git tag v0.1.1
git push origin v0.1.1
```

## 🔄 Auto-Update System

### API Endpoints

- `GET /api/updates/check` - Check for new releases
- `GET /api/updates/version` - Get current version

### Configuration

Set `GITHUB_REPO` environment variable:

```bash
export GITHUB_REPO="yourorg/escapeplan"
```

### How It Works

1. App checks GitHub Releases API for latest version
2. Compares semantic versions (current vs latest)
3. Returns `.deb` download URL if update available
4. User downloads and installs: `sudo dpkg -i escapeplan_*.deb`

## 🔐 RBAC System

Database-driven role-based access control with 27 permissions across 4 roles:

- **Admin** (27 perms): Full system access
- **Manager** (17 perms): Operations + user management
- **Game Master** (7 perms): Session control only
- **Customer** (2 perms): View-only dashboard

## 📚 Development Guides

See `CLAUDE.md` for:
- Architecture overview
- API routes reference
- Database schema
- Real-time WebSocket events
- Development workflow

## 🐛 Troubleshooting

**Port 4000 already in use:**
```bash
lsof -ti:4000 | xargs kill -9
```

**Module not found errors:**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Build failures:**
```bash
pnpm run lint  # Check TypeScript errors
pnpm run test  # Run tests
```

## 📄 License

Proprietary - All rights reserved
