# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
NEVER WRITE CODE WITHOUT REFERENCING THIS FILE.
Never do direct Sql queries without using the Drizzle ORM.
Always reference our @API_CONTRACTS_SCHEMA_MANAGEMENT.md file when making schema changes.
Always reference our @DATABASE_SYSTEM.md file when making database changes.

## Project Overview

EscapePlan is an offline-first escape room management system running on Raspberry Pi. The system consists of:
- **Fastify API** (`apps/escapeplan-api`) - Backend service with WebSocket support
- **SvelteKit PWA** (`apps/escapeplan-web`) - Operator console and public timer pages
- **Shared Contracts** (`packages/contracts`) - TypeScript types and RBAC definitions shared between API and web

The platform runs on a Pi-hosted Wi-Fi network (10.10.10.0/24) accessible via mDNS at `escapeplan.local`. It manages games, bookings, live sessions, real-time hints, camera streams (RTSP→HLS), and supports both fixed storefronts and mobile escape room kits.

## Common Commands

### Workspace Root
```bash
pnpm install              # Install all workspace dependencies
pnpm build               # Build all packages (contracts → API → web)
pnpm test                # Run all test suites
pnpm lint                # Type-check all packages
```

### API Development (`apps/escapeplan-api`)
```bash
pnpm --filter escapeplan-api dev        # Start API dev server (port 4000)
pnpm --filter escapeplan-api build      # Build API with tsup
pnpm --filter escapeplan-api lint       # Type-check API
pnpm --filter escapeplan-api test       # Run Vitest tests
pnpm --filter escapeplan-api db:seed    # Seed database with initial data
```

### Web Development (`apps/escapeplan-web`)
```bash
pnpm --filter escapeplan-web dev        # Start SvelteKit dev server (port 5173)
pnpm --filter escapeplan-web build      # Build SvelteKit PWA
pnpm --filter escapeplan-web preview    # Preview production build
pnpm --filter escapeplan-web check      # Type-check Svelte components
```

### Testing Individual Files
```bash
# API tests
cd apps/escapeplan-api && pnpm test src/state.test.ts

# Run specific test with pattern
cd apps/escapeplan-api && pnpm test -t "booking validation"
```

### Database Management
```bash
cd apps/escapeplan-api

# Apply schema changes to database (push-only workflow, NO migrations)
npx drizzle-kit push

# Seed database
pnpm db:seed
```

## Architecture

### Authentication & Authorization
- Uses **Better Auth v1.3.24+** with Drizzle SQLite adapter
- Session tokens stored in HttpOnly cookies (`better-auth.session_token`)
- Database-driven RBAC system with `user_type` separation ('operator' | 'customer')
- **System Roles:** `admin`, `manager`, `game_master` (operators) and `customer`
- Permissions derived from role relationships via `roles` → `role_permissions` → `permissions` tables
- Roles and permissions scoped by `user_type_scope` ('operator' | 'customer' | 'both')
- API routes protected via `requirePermission()` helper functions
- SvelteKit enforces auth + user_type in `hooks.server.ts`
- Database triggers enforce user_type/role boundaries automatically

### Database Layer
- **SQLite** with WAL mode at `apps/escapeplan-api/data/escapeplan.db`
- **Drizzle ORM** schema in `packages/contracts/src/schema.ts`
- Migrations managed via `drizzle-kit push` (direct schema sync)
- **Core Auth Tables:** `user`, `session`, `account`, `verification` (singular names per Better Auth v1.3+)
- **RBAC Tables:** `roles`, `permissions`, `role_permissions`
- **User Segmentation:** `user` table includes `user_type` field for operator/customer separation
- **Security:** Database triggers in `drizzle/triggers.sql` enforce user_type immutability and role scope validation
- All tables use TEXT UUID primary keys
- Custom adapter wrapper serializes Date objects to ISO strings for Better Auth compatibility

### Real-Time Communication
- **Socket.IO** attached to Fastify server on `/socket.io`
- Events: `session:update`, `dashboard:update`, `timer:update`, `bookings:update`, `session:command`
- Server-side emitters in `apps/escapeplan-api/src/realtime.ts`
- Client-side listeners in `apps/escapeplan-web/src/lib/realtime/index.ts`
- Offline command queueing: commands stored in Svelte stores when disconnected, replayed on reconnect

### State Management
- API business logic centralized in `apps/escapeplan-api/src/state.ts`
- SvelteKit uses Svelte 5 stores in `apps/escapeplan-web/src/lib/realtime/stores.ts`
- Stores: `dashboardStore`, `sessionsStore`, `bookingsStore`, `offlineCommandQueue`, `commandAcks`

### API Surface
- Base URL: `/api` (proxied by nginx in production)
- Auth endpoints: `/api/auth/*` (handled by Better Auth)
- **Users:** `/api/admin/users`, `/api/admin/users/me`
- Games: `/api/admin/games`, `/api/admin/games/:id`
- Bookings: `/api/bookings?date=YYYY-MM-DD&scope=all|mobile`
- Sessions: `/api/sessions`, `/api/sessions/:id/commands`
- Network: `/api/admin/network` (PATCH to update SSID/channel)
- Public timer: `/api/public/timer/:slug` (unauthenticated)
- Dashboard: `/api/dashboard` (aggregated session/booking status)

### Client-Side Routing
- `(auth)` group: `/login`, `/logout` (public)
- `(app)` group: protected routes requiring authentication
  - `/dashboard` - Active sessions grid with camera tiles
  - `/bookings` - Calendar view with pricing
  - `/games` - Game library management
  - `/games/[sessionId]` - Game Runner (timer, hints, puzzle checklist)
  - `/account/profile` - Self-service profile editor
  - `/admin/users` - Operator management (admin/manager only)
  - `/admin/network` - Network configuration (admin only)
- Root layout (`+layout.server.ts`) redirects unauthenticated users to `/login`

## Key Patterns

### Error Handling
- API returns JSON envelopes: `{ error: { code, message, details? } }`
- Client-side fetch wrapper (`$lib/api/client.ts`) throws on non-2xx with error details
- Use `try/catch` in SvelteKit `+page.server.ts` to surface errors in `form.message`

### Validation
- Use **Zod** schemas for API request validation
- Contracts package exports TypeScript types but validation logic stays in API
- Example: `createUserSchema` in `apps/escapeplan-api/src/index.ts`

### Session Lifecycle
1. Booking created with `PENDING` status
2. Operator starts session → `RUNNING`, timer begins
3. Hints sent via `/sessions/:id/commands` with `{ command: 'send_hint' }`
4. Timer can be paused/resumed with commands
5. Session ends → `COMPLETED`, timer frozen

### Adding New Permissions
1. Add to `OperatorPermission` union in `packages/contracts/src/index.ts`
2. Add to `PERMISSION_LABELS` and `ROLE_PERMISSIONS` in `packages/contracts/src/rbac.ts`
3. Rebuild contracts: `pnpm --filter @escapeplan/contracts build`
4. Use in API guards: check `user.permissions.includes('new_permission')`

### PWA Updates
- Workbox configured in `vite.config.ts` with `registerType: 'autoUpdate'`
- App shell cached for offline use
- New builds trigger update prompt automatically

## Platform Deployment (Reference)

Production system runs on Raspberry Pi OS with:
- **hostapd** - WPA2 access point on SSID `EscapePlan`
- **dnsmasq** - DHCP/DNS for 10.10.10.0/24 subnet
- **nginx** - Reverse proxy with self-signed TLS, serves static PWA
- **systemd** units:
  - `escapeplan-api.service` - Fastify server on port 4000
  - `escapeplan-ffmpeg@.service` - Camera stream workers (RTSP→HLS)

Platform automation is in separate `escapeplan-base` repository using pi-gen to build bootable OS images. This repo builds to `.deb` package for installation. See `project-docs/project-overview.md` for full deployment architecture.

## Development Workflow

1. **Make schema changes**: Edit `apps/escapeplan-api/src/db/schema.ts`
2. **Rebuild contracts**: `pnpm --filter @escapeplan/contracts build` (required before API/web can import)
3. **Apply schema changes**: `cd apps/escapeplan-api && npx drizzle-kit push` (NO migrations - push only!)
4. **Test changes**: `pnpm --filter escapeplan-api test`
5. **Update API handlers**: Modify `state.ts` and route definitions in `index.ts`
6. **Update client stores/pages**: Adjust Svelte components and API fetch calls
7. **Test real-time flow**: Verify WebSocket events fire correctly in browser console

## Important Constraints

- **Offline-first**: All features must work without internet; clock sync via chrony
- **No hardcoded data**: Seed scripts must provision realistic baseline records
- **Pi resource limits**: Avoid heavy video transcoding; prefer H.264 copy mode
- **Mobile escape rooms**: `is_mobile` flag changes booking workflow (location notes, kit readiness)
- **RBAC strictness**: Never bypass permission checks; audit all mutating endpoints
- **Date serialization**: Better Auth expects ISO strings; custom adapter handles conversion
- **Session cookies only**: No localStorage for auth tokens; HttpOnly cookies required for security

## Testing Philosophy

- Unit tests for business logic (validation, pricing, RBAC)
- Integration tests for full CRUD flows (create game → assign room → book → start session)
- Vitest for API tests; consider Playwright for E2E SvelteKit flows
- No mocking of database in critical paths; use real SQLite file or in-memory DB

## Documentation

See `project-docs/` for:
- `project-overview.md` - Full PRD with API contract, UX wireframes, deployment specs
- `project-tracking/TODO.json` - Development backlog
- `project-tracking/USER_STORIES.json` - Feature requirements
- `project-tracking/sessions/SESSION_*_NOTES.md` - Implementation session logs