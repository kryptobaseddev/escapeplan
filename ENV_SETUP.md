# Environment Variables - Auto-Detection System

## 🎯 Zero-Config Philosophy

**You don't need to set environment variables!** The app auto-detects everything based on `NODE_ENV`.

## How It Works

### API (`apps/escapeplan-api/src/env.ts`)

```typescript
// Automatically detects:
- NODE_ENV (development | production | test)
- Base URLs (localhost:4000 vs https://escapeplan.local)
- GitHub repo from package.json
- Version from package.json
- Build date
```

**Detection Logic:**
1. **Development** (`NODE_ENV=development`):
   - `BASE_URL` → `http://localhost:4000`
   - `AUTH_BASE_URL` → `http://localhost:4000/api/auth`
   - `WEB_APP_ORIGIN` → `http://localhost:5173`

2. **Production** (`NODE_ENV=production`):
   - `BASE_URL` → `https://escapeplan.local`
   - `AUTH_BASE_URL` → `https://escapeplan.local/api/auth`
   - `WEB_APP_ORIGIN` → `https://escapeplan.local`

3. **GitHub Repo**:
   - Reads from `package.json` repository field
   - Fallback to `GITHUB_REPO` env var
   - Default: `escapeplan/escapeplan`

### Web (`apps/escapeplan-web/src/lib/api/client.ts`)

```typescript
// Automatically detects API URL:
- Development: http://localhost:4000/api
- Production: https://escapeplan.local/api (same-origin)
```

## 📝 When to Override

### Custom Domain
```bash
# API
BASE_URL=https://my-custom-domain.com
AUTH_BASE_URL=https://my-custom-domain.com/api/auth
WEB_APP_ORIGIN=https://my-custom-domain.com

# Web
PUBLIC_API_BASE_URL=https://my-custom-domain.com/api
```

### Different GitHub Org
```bash
GITHUB_REPO=myorg/escapeplan
```

### Disable Auto-Update
```bash
ENABLE_AUTO_UPDATE=false
```

## 🔧 .env Files

### Development (auto-configured)
No `.env` needed! Defaults work out-of-the-box.

### Production
Only override what's different:

```bash
# /etc/escapeplan/api.env (systemd only)
NODE_ENV=production
NGINX_PROXY=true  # Set by systemd
```

## ✅ What's Synced

Both `.env` and `.env.example` are now identical with auto-detection comments.

**No more manual URL configuration in 2025!** 🚀
