# EscapePlan Technology Stack - Quick Reference

**Last Updated:** 2025-10-03
**Schema Validated:** ✅ Valid against techstack-schema.json

---

## 🎯 Core Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Language** | TypeScript | 5.5.0+ | Full-stack type safety |
| **Runtime** | Node.js | 24 LTS | Server runtime |
| **Package Manager** | pnpm | 10.12.4 | Monorepo workspace |
| **Backend Framework** | Fastify | 5.6.1+ | High-performance API |
| **Frontend Framework** | SvelteKit | 2.43.0+ | SSR + PWA |
| **UI Framework** | Tailwind CSS + DaisyUI | 4.1.13+ / 5.1.25+ | Responsive design |
| **Database** | SQLite (WAL mode) | better-sqlite3 9.6.0+ | Embedded offline DB |
| **ORM** | Drizzle ORM | 0.44.5+ | Type-safe queries |
| **Auth** | Better Auth | 1.3.24+ | Session + RBAC |
| **Real-Time** | Socket.IO | 4.8.1+ | WebSocket events |

---

## 📦 Monorepo Structure

```
escapeplan-app/
├── packages/
│   └── contracts/           # @escapeplan/contracts
│       ├── Drizzle schema (31+ tables)
│       ├── Zod validation
│       ├── Runtime detection (dev/prod)
│       └── Path resolution
│
├── apps/
│   ├── escapeplan-api/      # Fastify backend
│   │   ├── Better Auth + Drizzle
│   │   ├── Socket.IO server
│   │   └── Media processing (ffmpeg, Sharp)
│   │
│   └── escapeplan-web/      # SvelteKit PWA
│       ├── Svelte 5 runes
│       ├── Tailwind + DaisyUI
│       └── Socket.IO client
│
└── Build Order: contracts → api → web
```

---

## 🔑 Key Technologies by Category

### Authentication & Security
- **Better Auth v1.3.24+** - Session management, RBAC
- **Argon2id** - Password hashing (argon2 0.40.3)
- **libsodium** - Credential encryption (sodium-native 5.0.9+)
- **HttpOnly cookies** - Session storage (no localStorage)

### Database & ORM
- **SQLite WAL mode** - Embedded database
- **Drizzle ORM v0.44.5+** - Type-safe queries
- **drizzle-kit v0.31.5+** - Migrations
- **Zod v3.23.8** - Runtime validation

### Real-Time & Offline
- **Socket.IO v4.8.1+** - WebSocket events
- **Vite PWA for SvelteKit v1.0.0+** - Service workers
- **Workbox v7.3.0+** - Offline caching
- **Command queueing** - Svelte stores for offline replay

### Media Processing
- **ffmpeg v7.x** - RTSP→HLS camera streams
- **Sharp v0.34.4+** - Image optimization
- **fluent-ffmpeg v2.1.3+** - Video metadata

### Logging & Observability
- **Winston v3.18.3+** - Structured logging
- **winston-daily-rotate-file v5.0.0+** - Log rotation
- **Database-backed** - systemLogs, alerts, alertRules tables

### Testing
- **Vitest** - Unit tests (1.5.0+ API, 1.6.1+ Web)
- **Testing Library** - Component tests (Svelte 5.2.8+)
- **Playwright** - E2E tests (planned Phase 6)

---

## 🚀 Development Commands

### Workspace Root
```bash
pnpm install              # Install all dependencies
pnpm build               # Build all packages (contracts → api → web)
pnpm dev                 # Start API + Web dev servers
pnpm test                # Run all tests
pnpm lint                # Type-check all packages
```

### Individual Packages
```bash
# Contracts
pnpm --filter @escapeplan/contracts build

# API
pnpm --filter escapeplan-api dev        # tsx watch (port 4000)
pnpm --filter escapeplan-api build      # tsup bundle
pnpm --filter escapeplan-api db:seed    # Seed database

# Web
pnpm --filter escapeplan-web dev        # Vite dev (port 5173)
pnpm --filter escapeplan-web build      # SvelteKit build
pnpm --filter escapeplan-web check      # svelte-check
```

---

## 🏗️ Build & Deployment

### Development
- **Environment:** pnpm workspace with hot-reload
- **Database:** `apps/escapeplan-api/data/escapeplan.db`
- **API:** http://localhost:4000
- **Web:** http://localhost:5173

### Production (Raspberry Pi 5)
- **Platform:** Raspberry Pi OS Bookworm 64-bit
- **Package:** .deb with systemd services
- **Database:** `/var/lib/escapeplan/escapeplan.db` (WAL mode)
- **Domain:** escapeplan.local (mDNS)
- **Web Server:** nginx 1.29.1+ with self-signed TLS
- **Services:**
  - `escapeplan-api.service` (port 4000)
  - `escapeplan-ffmpeg@.service` (camera workers)
- **Networking:** NetworkManager (10.10.10.0/24)

---

## 📏 Code Quality Standards

| Standard | Requirement |
|----------|-------------|
| **Test Coverage** | Minimum 80% |
| **Type Hints** | Required (TypeScript strict mode) |
| **Docstrings** | Recommended |
| **Max Line Length** | 120 characters |
| **Formatting** | Prettier + ESLint (project defaults) |
| **Svelte Check** | Required before commit |

---

## 🔒 Hard Rules for Agents

### Database & Schema
- ✅ **ALWAYS** use Drizzle ORM (no raw SQL except specific helpers)
- ✅ **ALWAYS** reference @escapeplan/contracts for types
- ✅ **ALWAYS** use singular table names (user, session, account, verification)
- ✅ **NEVER** use mock/placeholder data (load from DB or seeds)

### Authentication & Authorization
- ✅ **ALWAYS** use Better Auth session enrichment (permissions, role, user_type)
- ✅ **ALWAYS** check `user_type` field for operator/customer separation
- ✅ **ALWAYS** use database-driven RBAC (roles → role_permissions → permissions)
- ✅ **ALWAYS** use HttpOnly cookies (no localStorage tokens)
- ✅ **NEVER** bypass permission checks with hardcoded roles

### Frontend (Svelte)
- ✅ **ALWAYS** use Svelte 5 runes ($state, $derived, $effect)
- ✅ **NEVER** use legacy Svelte stores (use runes instead)
- ✅ **ALWAYS** handle offline scenarios (command queueing)

### Environment & Config
- ✅ **ALWAYS** use environment auto-detection (@escapeplan/contracts/runtime)
- ✅ **NEVER** use NODE_ENV (use runtime detection instead)
- ✅ **NEVER** commit .env files or credentials

### Validation & Security
- ✅ **ALWAYS** validate with Zod before database operations
- ✅ **ALWAYS** test database triggers enforce user_type/role boundaries
- ✅ **NEVER** bypass security layers

---

## 📦 Core Dependencies (Exact Versions)

### Backend API
```json
{
  "fastify": "^5.6.1",
  "better-auth": "^1.3.24",
  "drizzle-orm": "^0.44.5",
  "better-sqlite3": "^9.6.0",
  "socket.io": "^4.8.1",
  "argon2": "^0.40.3",
  "zod": "^3.23.8",
  "winston": "^3.18.3",
  "sharp": "^0.34.4"
}
```

### Frontend Web
```json
{
  "svelte": "^5.39.0",
  "@sveltejs/kit": "^2.43.0",
  "tailwindcss": "^4.1.13",
  "daisyui": "^5.1.25",
  "socket.io-client": "^4.8.1",
  "better-auth": "^1.3.24"
}
```

### Shared Contracts
```json
{
  "drizzle-orm": "^0.44.5",
  "drizzle-zod": "^0.8.3",
  "zod": "^3.23.8"
}
```

---

## 🔗 Related Documentation

- **Full Details:** `techstack.yaml`
- **Schema Validation:** `schemas/techstack-schema.json`
- **Project Overview:** `../project-overview.md`
- **CLAUDE Guidelines:** `../../CLAUDE.md`
- **Database System:** `../DOCS/DATABASE_SYSTEM.md`

---

## 🎓 Agent Quick Start

When starting a new task:

1. **Read** `techstack.yaml` for technology decisions
2. **Reference** hard rules for non-negotiable constraints
3. **Follow** code quality standards
4. **Use** exact dependency versions from package.json files
5. **Validate** against schema before proposing tech changes

**Schema Validation Command:**
```bash
cd project-docs/project-tracking
npx ajv-cli validate -s schemas/techstack-schema.json -d techstack.yaml --spec=draft7
```

---

**Last Validated:** 2025-10-03 ✅
