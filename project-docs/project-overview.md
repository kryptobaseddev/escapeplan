# EscapePlan - The Escape Room Manager Pi — PRD, Tech Spec, API Contract, and UX Design

**Version:** 0.1.0 (MVP Draft)
**Target device:** Raspberry Pi 4/5 (2–8GB RAM) running Raspberry Pi OS (Bookworm)
**Network mode:** Offline-first local AP (hostapd + dnsmasq), optional periodic internet for updates
**Primary DB:** SQLite 3 (WAL mode)
**Runtime:** Node.js 22 LTS (Fastify 5 API + WebSocket) + Nginx (reverse proxy/static)
**Frontend:** SvelteKit 2 + Vite + Tailwind CSS 4 with DaisyUI 5.1.25 (PWA-first)
**Streaming:** RTSP→HLS (ffmpeg) or MJPEG fallback; ONVIF discovery optional

---

## 1) Product Requirements Document (PRD)

### 1.1 Problem Statement

Escape room operators need a **self-contained** local system that can be used to manage their escape room business. The system should be able to:

* Runs entirely over a **private Wi‑Fi** network hosted by the Raspberry Pi.
* Serves a **web application** to manage games, staff, bookings, puzzles, hints, and cameras.
* Integrates **network cameras** per room for live monitoring without internet.
* Provides a **simple booking flow** and a **Game Runner** UI (start, pause, hint send, timer, end).
* Uses **SQLite** with a normalized schema; migrations included.
* Provides **SemVer**, **CI/CD**, and **automatic version bumping**.

### 1.1.1 Competitive Landscape Snapshot (2025)

| Platform | Strengths | Gaps relevant to EscapePlan |
| -------- | --------- | --------------------------- |
| OffTheCouch | Rich CRM + marketing automation, cloud dashboards | Requires continuous internet, no hardware bundling for local-only installs |
| Houdini MC | Flexible puzzle scripting, advanced analytics | Cloud-tethered services, limited mobile event tooling |
| Escape Room Master | Booking + POS integration, solid staffing tools | Focused on SaaS; lacks on-premise game runner with video control |
| Escape Room Admin | Budget-friendly operations tracker | Minimal camera integration, no mobile rig management |
| ClueMaster | Robust in-room clue system | Timer-centric; does not cover bookings, fleet operations, or offline fallback |

**EscapePlan Differentiators:** fully offline Pi appliance, unified booking → session workflow, live camera orchestration, and dedicated support for mobile escape room kits. MVP scope prioritizes these strengths over CRM add-ons.

Escape room operators need a **self-contained** local system that can be used to manage their escape room business. The system should be able to:

* Runs entirely over a **private Wi‑Fi** network hosted by the Raspberry Pi.
* Serves a **web application** to manage games, staff, bookings, puzzles, hints, and cameras.
* Integrates **network cameras** per room for live monitoring without internet.

### 1.2 Goals / Non‑Goals

* **Goals**

  1. Operate fully **offline** on a Pi‑hosted Wi‑Fi SSID.
  2. Provide a **management console** with RBAC (Admin/Manager/Employee/Customer).
  3. Manage **Games**, **Rooms**, **Bookings**, **Puzzles**, **Hints**, **Cameras**.
  4. Show **live camera tiles** on the dashboard per running game.
  5. Provide a **simple booking flow** and a **Game Runner** UI (start, pause, hint send, timer, end).
  6. Use **SQLite** with a normalized schema; migrations included.
  7. Provide **SemVer**, **CI/CD**, and **automatic version bumping**.

* **Non‑Goals (MVP)**

  * Online payments, email/SMS notifications, external identity providers, public cloud hosting, advanced analytics, mobile apps.

### 1.3 Users & Roles

* **Admin**: full control; system settings; manage roles; CRUD everything; network/camera settings.
* **Manager**: most admin controls; can create Employee users; manage games/rooms/bookings; cannot change critical system/network settings.
* **Employee**: operate Game Runner; view dashboard; manage day’s bookings; send hints; no schema/settings changes.
* **Customer**: local booking kiosk interface; view booking confirmation on device; no admin UI.

### 1.4 MVP Scope (Release 0.1.x)

**Operations Core – Physical Store**
- RBAC with Admin, Manager, Game Master, Customer roles using local authentication and short-lived session cookies.
- Booking calendar with pricing tiers, conflict prevention, daily printable run sheets, and quick reschedule tooling.
- Operator dashboard summarizing active sessions, timers, live camera mosaics, system health indicators, and quick actions.
- Game Runner view with synchronized timer, puzzle checklist, hint dispatch (text/image/audio/video), operator notes, and audit logging.
- Camera management for fixed rooms: encrypted credential storage, start/stop controls, auto-recovery workers, and status reporting.

**Mobile Escape Operations**
- Mark games as `is_mobile` and surface dedicated catalog views for offsite events.
- Booking extensions capture location notes, deposit amounts, discount codes, and manual readiness checklist (no auto travel calculations).
- Offline-first workflow: prefetch bookings/puzzles/hints, queue session actions for later sync, and expose sync status/conflict resolution.
- Printable run sheets summarizing logistics, contact info, and outstanding balances for mobile events.

**Shared Platform Deliverables**
- Raspberry Pi OS image (`escapeplan-base`) provisioning hostapd/dnsmasq AP, Avahi mDNS, nginx (HTTPS with self-signed cert), Fastify API + Socket.IO, ffmpeg workers, backups, OTA hooks.
- SQLite schema with Drizzle migrations and seed scripts covering Users, Roles, Rooms, Games, GameSessions, Bookings, Puzzles, Hints, PricingModels, PricingTiers, Cameras, Resources, Events, HintSends, Assets, MobileKits.
- SvelteKit PWA (`escapeplan-web`) themed via DaisyUI, responsive on tablets/phones, providing operator dashboard, admin consoles, mobile workflow, and public game slug timer pages.
- Observability and ops tooling: local health endpoint, journald log rotation, alerting for camera downtime/timer stalls, nightly backups with retention policies.

### 1.5 Success Metrics (initial)

* Live video tile initial load < 2 s; hint dispatch round-trip ≤ 500 ms under nominal load.
* Stability ≥ 8 h continuous operation with ≥ 4 concurrent sessions; session crash rate < 0.5% per week.
* Operator flow: Dashboard → Game start in ≤ 3 clicks; hint confirmation in ≤ 2 taps.
* Mobile readiness: Kit checklist completed ≥ 20 min before departure; travel buffer conflicts resolved ≥ 4 h before first mobile booking.
* Data protection: Nightly backup success ≥ 95%; restoration dry-run monthly with ≤ 15 min recovery window.
* Customer experience: Timer view drift ≤ 1 s from server clock; pilot NPS ≥ +40 for both store and mobile events.

### 1.6 Constraints

* Raspberry Pi CPU/GPU limits; ffmpeg transcoding must be tuned; number of simultaneous streams limited (see §7.5).
* Offline operation; clock sync via chrony; no external auth providers.
* No mock or hardcoded data; seed scripts must provision real baseline records (roles, games, rooms) and all runtime data flows through the database.
* Supply variability of USB AC600M adapters; maintain compatibility matrix for alternates and adjust OTA scripts accordingly.
* Thermal/acoustic limits in customer-facing spaces; target passive or low-noise cooling solutions.

### 1.7 Deferred Features (Post-MVP Backlog)

* Online payments, external CRM integrations, and automated marketing journeys.
* Customer portal with reservation changes, waivers, and loyalty tracking.
* Native mobile apps and public cloud multi-tenant hosting.
* Advanced analytics (heatmaps, conversion funnels) beyond daily throughput dashboards.
* Third-party identity providers (OAuth/SAML) and remote access management.

---

## 2) System Architecture & Tech Stack

### 2.1 Components

* **Nginx**: reverse proxy on :80 (optionally :443); serves SPA static files; proxies `/api` and `/ws` to Node.
* **Fastify 5 API Server**: REST + WebSocket via Socket.IO; business logic; RBAC; stream registry; events.
* **SQLite (WAL)**: primary data store; Prisma/Drizzle ORM; migrations.
* **ffmpeg workers**: RTSP→HLS (m3u8 + ts) or MJPEG; per camera pipeline controlled by API.
* **hostapd + dnsmasq + avahi + chrony**: AP, DHCP/DNS, mDNS, NTP.
* **Static storage**: `/var/lib/escapeplan/assets` for images/audio/video; HLS at `/var/lib/escapeplan/hls/{cameraId}`.

### 2.2 Tech Choices

* **Language**: TypeScript (Node.js 22 LTS).
* **Framework**: Fastify 5 + Zod validation; Socket.IO 5 for real‑time.
* **ORM**: Drizzle ORM (SQLite) with SQL migrations committed.
* **Front‑End**: SvelteKit 2 + Tailwind CSS 4 + DaisyUI 5.1.25 with `@vite-pwa/sveltekit`; Svelte stores for state; built-in routing.
* **Video**: HLS via `<video>` with MediaSource; fallback MJPEG via `<img>`; optional WebRTC later.
* **Auth**: Local users; Argon2id password hashing; JWT (HS256) in HttpOnly SameSite=Lax cookie; CSRF token for unsafe verbs.
* **Packaging**: `escapeplan-base` repo (pi-gen) builds OS image + systemd units (`escapeplan-api`, `escapeplan-ffmpeg@`, `nginx`); `escapeplan-web` repo ships API/PWA bundle and `.deb` for updates.
* **CI/CD**: GitHub Actions building ARM64 docker image + `.deb` installer; `changesets` or `semantic-release` for auto bump.

### 2.3 Deployment Layout

```
/etc/escapeplan/
  app.env
  nginx.conf.d/escapeplan.conf
/var/lib/escapeplan/
  db/escape.db
  assets/{images,audio,video}
  hls/{cameraId}/index.m3u8
/var/log/escapeplan/
  api/*.log
  ffmpeg/*.log
```

### 2.4 Network & Host Configuration

* **Hostname & mDNS**: advertise `escapeplan.local` via Avahi; dashboard served at `https://escapeplan.local/` with optional alternate alias per deployment. Game timer pages surface at `https://escapeplan.local/{game-slug}` and remain publicly accessible on the LAN (no auth required).
* **Wi-Fi Access Point**: hostapd WPA2-PSK SSID `EscapePlan` (configurable) with strong randomly generated passphrase; DHCP 10.10.10.0/24 via dnsmasq. WPA3 support is deferred.
* **Certificates**: self-signed certificate pair generated on first boot, installed in nginx, and exported for operators to trust on iOS/iPadOS/macOS/Windows devices. HTTP redirects to HTTPS inside the LAN.
* **Service discovery**: `_http._tcp` and `_escapeplan._tcp` mDNS records broadcast for dashboard and API endpoints to simplify device pairing.
* **Remote shell**: SSH disabled by default; enabling requires physical console + key-based auth configuration.

### 2.5 Hardware Baseline

* **Compute**: Raspberry Pi 5 (8 GB preferred, 4 GB minimum) with active cooling or low-noise fan to maintain sub‑70 °C temps under ffmpeg load.
* **Storage**: 128 GB UHS‑I microSD (A2) or NVMe SSD via PCIe hat for improved durability; daily SQLite backups stored to `/var/lib/escapeplan/backups` and optional USB drive.
* **Networking**: USB AC600M Wi‑Fi adapter (AP mode) with external antenna; include approved alternates list for procurement resiliency.
* **Power**: 27 W USB‑C PD supply with inline UPS or battery backup recommended for brownout protection.
* **Peripherals**: HDMI-connected operator display (optional), USB audio output for room cues, and QR-code sticker set for quick URL access to timer pages.

---

## 3) Data Model (SQLite)

### 3.1 Entities & Relationships

* **user** (N:1 **roles**) - Better Auth singular naming
* **session**, **account**, **verification** - Better Auth tables
* **roles** (Admin/Manager/Game Master/Customer)
* **permissions** (granular; role_permissions join)
* **rooms** (1:N **game_room_map**, 1:N **cameras**)
* **games** (1:N **game_room_map**, 1:N **puzzles**, 1:N **pricing_tiers**)
* **game_room_map** (binds game to room; a room can host multiple games over time but typically one active)
* **cameras** (N:1 room; credentials, RTSP URL)
* **puzzles** (N:1 game; 1:N **hints**)
* **hints** (N:1 puzzle; type: text/image/audio/video; asset ref)
* **bookings** (N:1 game, N:1 room, customer info, schedule)
* **game_sessions** (N:1 booking; runtime state: timer, status, current puzzle, etc.)
* **hint_sends** (N:1 session; log of hints delivered)
* **resources** (e.g., staff/props count per game; availability rules)
* **pricing_models** (per-person or flat)
* **pricing_tiers** (category rules, min/max participants, price)
* **events** (audit trail)
* **assets** (file metadata for images/audio/video)

### 3.2 SQL Schema (MVP)

```sql
PRAGMA journal_mode=WAL;

-- Better Auth Tables (singular naming per v1.3.24+)
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  emailVerified INTEGER DEFAULT 0,
  image TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'operator', -- 'operator' | 'customer'
  role_id TEXT NOT NULL REFERENCES roles(id),
  -- Additional custom fields...
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expiresAt TEXT NOT NULL,
  -- Additional fields...
);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  expiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  user_type_scope TEXT NOT NULL DEFAULT 'operator', -- 'operator' | 'customer' | 'both'
  is_system INTEGER DEFAULT 0
);

CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE games (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 5 AND 240),
  difficulty INTEGER NOT NULL CHECK(difficulty BETWEEN 1 AND 5),
  reservation_style TEXT NOT NULL CHECK(reservation_style IN ('PUBLIC','PRIVATE')),
  min_players INTEGER NOT NULL DEFAULT 1,
  max_players INTEGER NOT NULL DEFAULT 8,
  difficulty_toggle_on_booking INTEGER NOT NULL DEFAULT 0,
  resources_required INTEGER NOT NULL DEFAULT 1,
  pricing_model TEXT NOT NULL CHECK(pricing_model IN ('PER_PERSON','FLAT_ROOM')),
  is_mobile INTEGER NOT NULL DEFAULT 0,
  room_theme TEXT,
  room_screen_asset_id INTEGER REFERENCES assets(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE game_room_map (
  id INTEGER PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE(game_id, room_id)
);

CREATE TABLE cameras (
  id INTEGER PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rtsp_url TEXT NOT NULL,
  username TEXT,
  password TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE puzzles (
  id INTEGER PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  solution TEXT,
  image_asset_id INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(game_id, name)
);

CREATE TABLE assets (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('IMAGE','AUDIO','VIDEO','DOC')),
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE hints (
  id INTEGER PRIMARY KEY,
  puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('TEXT','IMAGE','AUDIO','VIDEO')),
  text TEXT,
  asset_id INTEGER REFERENCES assets(id),
  ordinal INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pricing_tiers (
  id INTEGER PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  min_participants INTEGER,
  max_participants INTEGER
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  participants INTEGER NOT NULL,
  discount_code TEXT,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  balance_due_cents INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  difficulty_override INTEGER,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_mobile INTEGER NOT NULL DEFAULT 0,
  location_notes TEXT,
  status TEXT NOT NULL CHECK(status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED')),
  created_by_user_id INTEGER REFERENCES user(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE game_sessions (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('SCHEDULED','RUNNING','PAUSED','COMPLETED','ABORTED')),
  started_at TEXT,
  paused_at TEXT,
  ended_at TEXT,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  current_puzzle_id INTEGER REFERENCES puzzles(id),
  notes TEXT
);

CREATE TABLE hint_sends (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  puzzle_id INTEGER REFERENCES puzzles(id),
  hint_id INTEGER REFERENCES hints(id),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  actor_user_id INTEGER REFERENCES user(id),
  kind TEXT NOT NULL,
  ref_type TEXT,
  ref_id INTEGER,
  data TEXT
);

CREATE INDEX idx_bookings_time ON bookings(start_time, end_time);
CREATE INDEX idx_sessions_status ON game_sessions(status);
```

### 3.3 Seed Data

* Roles: `admin`, `manager`, `game_master`, `customer` (with user_type_scope set appropriately).
* Default credentials: `admin` / `escapeplan` (Argon2id-hashed via Better Auth, rotation endpoint available).
* Default user has `user_type: 'operator'` and `role_id: 'role-admin'`.
* Games: Pirate Mutiny only — hydrated from `project-docs/pirate-mutiny.txt` with canonical puzzles, narrative, and room metadata.
* Rooms: `Harbor Hold` storefront bay mapped to Pirate Mutiny; more rooms added via admin console (no mock placeholders).
* Network: Primary profile `escapeplan_net` created with default broadcast metadata for appliance Wi-Fi controls.
* Bookings/sessions/alerts: **not** seeded; all runtime data created by operators or automated tests to keep production data genuine.

### 3.4 Domain & Service Context Summary

* **Core Domain (Bookings & Sessions)**: Handles games, rooms, bookings, deposits, and session lifecycle. Fastify exposes REST APIs backed by SQLite (schema bootstrapped at runtime, WAL mode enabled).
* **Operations Context (Platform Services)**: Manages Wi‑Fi AP, mDNS, nginx, ffmpeg workers, and backup automation orchestrated by systemd units on the Pi image.
* **Presentation Context (PWA)**: SvelteKit + DaisyUI client delivering admin dashboard, operator console, and public room slug pages with offline caching.
* **Media Context**: Asset ingestion (images/audio/video) stored on disk and referenced by puzzles, hints, and room background screens.
* **Security Context**: Argon2id password storage, bearer-token sessions held in-memory, role→permission checks on every API route, and credential rotation tooling for appliance redeployments. (Persistent session store + audit event log on the roadmap.)

---

## 4) API Contract (OpenAPI‑style Summary)

> Base URL: `http://10.10.10.1/api`
> Auth: Bearer tokens issued on login (stored client-side); include `Authorization: Bearer <token>` on every privileged request.

### 4.1 Authentication & Sessions

* `POST /auth/login` → body `{ username, password }`; returns `{ token, user, mustResetPassword }`.
* `GET /auth/session` → validates bearer token and returns current operator profile.
* `POST /admin/rotate-credentials` → manager/admin only; rotates default admin password and broadcasts alert.

### 4.2 Operator & Role Management

* `GET /admin/users` → list operators with metadata (admin/manager).
* `POST /admin/users` → create operator (role, password, mustReset flag).
* `PATCH /admin/users/:id` → update profile/role/reset flag.
* `POST /admin/users/:id/reset-password` → set Argon2id password, optional force reset.
* `DELETE /admin/users/:id` → remove operator (guarded against deleting final admin).
* `POST /users/me/password` → self-service password change for authenticated operator.

### 4.3 Games, Rooms, Puzzles

* `GET /admin/games` / `GET /admin/games/:id` → fetch detailed game metadata.
* `POST /admin/games` → create game with rooms/puzzles JSON payloads.
* `PUT /admin/games/:id` → upsert slug, rules, puzzles, rooms.
* `DELETE /admin/games/:id` → remove game (cascades puzzles/rooms).

### 4.4 Network Controls

* `GET /admin/network` → fetch primary network profile (`escapeplan_net`).
* `PATCH /admin/network` → update SSID, band, channel, status messaging, broadcast toggle.

### 4.5 Operations Runtime

* `GET /dashboard` → aggregated active sessions, upcoming bookings, network health.
* `GET /bookings?date=YYYY-MM-DD&scope=` → storefront/mobile scheduling view.
* `GET /sessions/active` / `GET /sessions/:sessionId` → live session payloads.
* `POST /sessions/:sessionId/commands` → timer/hint/puzzle commands (queue offline-safe).
* `GET /public/timer/:slug` → timer broadcast payload for room displays.
* `POST /sessions` { bookingId } → create session (SCHEDULED)
* `POST /sessions/:id/start` / `POST /sessions/:id/pause` / `POST /sessions/:id/end`
* `POST /sessions/:id/hints` { puzzleId, hintId, channel } → log + broadcast
* `WS /ws` → events: `session.update`, `camera.online`, `hint.sent`

### 4.7 Public Room Timer Pages

* `GET /:gameSlug` → unauthenticated timer/hint board with room background, theme colors, optional audio cue playback, and hint history.
* `GET /:gameSlug/theme.json` → theme manifest for TV browsers (optional).

### 4.8 Settings & Health

* `GET /health` → { ok: true, version }
* `GET /settings` / `PUT /settings`

### 4.9 Error Envelope

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {...} } }
```

---

## 5) Authorization Model (RBAC)

### 5.1 Role Capabilities (MVP)

* **Admin**: All endpoints; change system/network/camera pipelines; manage roles/users.
* **Manager**: CRUD Games/Rooms/Cameras/Bookings; create Employees/Customers; no system/network toggles.
* **Game Master**: Read Games/Rooms/Cameras; operate Sessions; send hints; cannot change definitions.
* **Customer**: Create booking (kiosk); read own booking; no dashboard access.

### 5.2 Enforcement

* Route guards by role; field-level checks for sensitive attributes (e.g., cannot escalate roles unless Admin).
* Audit trail in `events` for all mutating endpoints.

### 5.3 Implementation Notes

* Better Auth (v1.3.24+) provides the authentication surface for Fastify and SvelteKit via the Drizzle SQLite adapter, username, and admin plugins.
* Table naming follows Better Auth v1.3+ conventions: `user`, `session`, `account`, `verification` (singular).
* Sessions are issued as HttpOnly cookies (`better-auth.session_token`) with per-request validation through `requireSession` and SvelteKit `sveltekitCookies` middleware.
* User records include `user_type` field ('operator' | 'customer') with database triggers enforcing role scope validation.
* Custom session plugin enriches sessions with `role`, `role_id`, and `permissions[]` by querying role_permissions junction table.
* Seed tooling provisions the initial administrator through Better Auth's adapter, ensuring hashed credentials and credential accounts stay in sync with the provider.
* Password resets and change-password flows now call Better Auth endpoints, removing bespoke Argon2 verification helpers while retaining Argon2id hashing under the provider.
* The SvelteKit shell calls the Fastify Better Auth endpoints directly; the login server action forwards the `Set-Cookie` header to the browser so the API owns session storage. Server-side fetch helpers forward the `better-auth.session_token` cookie on every API call.

---

## 6) Pricing & Booking Rules (MVP)

* **Pricing models:**

  * `PER_PERSON`: `price = sum(category.price * count)` constrained by tier min/max.
  * `FLAT_ROOM`: `price = base_flat` ignoring participant categories.
* **Categories:** e.g., Adult, Youth, Private Buyout.
* **Discount codes:** optional percentage or flat amount per booking; validated against active catalog.
* **Deposits:** default 30% (configurable) collected upfront; `balance_due_cents` tracked for settlement.
* **Validation:** participants within game min/max; resource availability; room free in window; deposits applied before discount; booking flagged `is_mobile` when location is off-site.
* **Payments:** record deposit and manual balances; Square integration deferred to roadmap (store tokens only when feature shipped).

---

## 7) Camera Integration

### 7.1 Supported Patterns

* **Preferred:** RTSP → HLS using ffmpeg low-latency HLS (LL-HLS optional later). Example pipeline:

```
ffmpeg -rtsp_transport tcp -i rtsp://user:pass@CAM/stream \
  -an -c:v copy -f hls -hls_time 1 -hls_list_size 3 -hls_flags delete_segments+append_list \
  /var/lib/escapeplan/hls/<cameraId>/index.m3u8
```

* **Fallback:** MJPEG if camera supports snapshots/HTTP stream.

### 7.2 Limits & Performance

* On Pi 4/5, avoid heavy transcode. Prefer **copy** if H.264 baseline/MAIN. If transcode needed, use `-preset veryfast -tune zerolatency -b:v` conservative.
* Practical tiles: **3–6** simultaneous HLS streams at SD/720p. For more, stagger keyframes or use lower resolution.

### 7.3 ONVIF Discovery (Optional)

* Add discovery tool to probe ONVIF and populate RTSP URL; store credentials encrypted at rest.

### 7.4 Resilience

* Supervisor restarts ffmpeg workers on failure; health pings `/cameras/:id/test` nightly.

---

## 8) Front‑End UX / UI

### 8.1 Design Principles

* **Operator‑first**: Large tiles, high contrast, keyboard shortcuts.
* **One action away**: From dashboard to hint send ≤ 2 clicks.
* **Offline status**: Banner shows network/offline; camera health icons.
* **PWA-first**: App shell cached for offline use; update prompt when new build is available.
* **Palette**: Dark greys/black surfaces, off-white text, red accent `#C43131`, teal accent `#00D5C8`; DaisyUI theme tokens enforce consistency.

### 8.2 Screens

1. **Login**
2. **Dashboard** (default for Employee/Manager/Admin)

   * Grid of active GameSessions.
   * Each card: Game name, room, timer, status, **live camera mosaic** (select primary), quick actions: Start/Pause/End, Hints.
3. **Game Runner (Session View)**

   * Large countdown/up timer, puzzle list with states, hint button per puzzle.
   * Right rail: selected camera live view; swap between cameras.
4. **Bookings**

   * Calendar/list; create/confirm/cancel bookings; pricing breakdown.
5. **Games**

   * Game details; images; resource req; pricing model & tiers; puzzles & hints (CRUD with asset upload).
6. **Rooms & Cameras**

   * Rooms CRUD; assign games; add cameras; test stream; set default camera layout per room.
7. **Users & Roles**

   * Create Employee/Customer; reset passwords; role filter.
8. **Settings**

   * Difficulty toggle on booking; time format; branding; exporter.

### 8.3 Components

* **CameraTile** (HLS video element + health badge)
* **SessionTimer** (WS updates)
* **HintModal** (tabs: Text/Image/Audio/Video; send button)
* **PuzzleList** (status icons; reorder via drag)
* **BookingForm** (participants by category)
* **PriceBreakdown**

### 8.4 Navigation

* Top bar: Dashboard, Bookings, Games, Rooms, Cameras, Users, Settings.
* Role‑based visibility.

### 8.5 Accessibility

* Basic focus outlines and keyboard navigation; full WCAG support deferred post-MVP.

### 8.6 Theme & Assets

* DaisyUI theme tokens: `primary=#00D5C8`, `secondary=#C43131`, `neutral=#1A1D23`, `base-100=#0F1115`, `accent=#1E88E5`, `info=#2196F3`, `success=#4CAF50`, `warning=#FFB300`, `error=#F44336`.
* Typography: Inter → system UI fallback (San Francisco, Segoe UI, Roboto) with 1.0/1.25/1.5 rem scale for headings.
* Placeholder logo and app icon under `apps/escapeplan-web/static/brand/`; swap when final assets provided.
* Room screen backgrounds per game (image or looping video); apply 40% dark overlay for timer readability.
* Timer pages play configurable audio cue on hint send; default asset stored under `/brand/audio/hint-chime.mp3`.
* Breakpoints optimized for iPad (1024×768), iPhone (390×844), and desktop (≥1280 px). Keep offline cache ≤100 MB to satisfy iOS PWA constraints.

---

## 9) CI/CD, Versioning, and Packaging

### 9.1 Versioning

* **SemVer** (MAJOR.MINOR.PATCH)
* **Conventional Commits** drive **semantic‑release** for auto bump + changelog.

### 9.2 CI

* GitHub Actions:

  * Lint (ESLint), typecheck (tsc), unit tests (vitest), e2e smoke.
  * Build ARM64 Docker image (`linux/arm64/v8`) and attach `.deb` package artifact.
  * Run Prisma/Drizzle migrations on boot.

### 9.3 CD/Install

* Output:

  * `escapeplan-api.deb` (installs systemd service + config skeleton)
  * `escapeplan-ui.tar.gz` (static bundle)
  * `escapeplan-ap-setup.deb` (optional metapackage to install hostapd/dnsmasq/nginx configs)

### 9.4 Runtime Services (systemd)

* `escapeplan-api.service` (depends on nginx)
* `escapeplan-ffmpeg@.service` (templated per camera)
* `escapeplan-maint.timer` nightly health checks

---

## 10) Security & Privacy

* Argon2id password hashing; per‑user password policy.
* JWT stored in HttpOnly cookie; rotate secret on release; CSRF token header.
* Camera credentials stored encrypted (libsodium secretbox) with device key.
* Local‑only network; no telemetry; optional manual export of logs.
* Self-signed TLS certificate generated on first boot, rotated quarterly; trust bundle export script for iOS/macOS/Windows clients.
* SSH disabled by default; physical console required to enable with key-based auth.

---

## 11) Configuration

* `/etc/escapeplan/app.env` (dotenv format)

```
NODE_ENV=production
PORT=3001
DB_PATH=/var/lib/escapeplan/db/escape.db
JWT_SECRET=change_me
ASSETS_DIR=/var/lib/escapeplan/assets
HLS_DIR=/var/lib/escapeplan/hls
NTP_SUBNET=10.10.10.0/24
ESCAPEPLAN_HOSTNAME=escapeplan.local
ESCAPEPLAN_WIFI_SSID=EscapePlan
ESCAPEPLAN_WIFI_PSK=ChangeMeNow123!
ESCAPEPLAN_CERT_DIR=/etc/escapeplan/certs
ESCAPEPLAN_MDNS_SERVICE=_escapeplan._tcp
ESCAPEPLAN_DEFAULT_DEPOSIT_RATE=0.30
ESCAPEPLAN_DEFAULT_CURRENCY=USD
```

* Nginx site `/etc/nginx/conf.d/escapeplan.conf` (proxy `/api` and `/ws`, serve `/ui`)

---

## 12) Nginx (Sample)

```nginx
server {
  listen 80;
  server_name _;

  # UI
  location / {
    root /var/www/escapeplan-ui;
    try_files $uri /index.html;
  }

  # API
  location /api {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
  }

  # WebSocket
  location /ws {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # HLS
  location /hls/ {
    types {
      application/vnd.apple.mpegurl m3u8;
      video/mp2t ts;
    }
    root /var/lib/escapeplan;
    add_header Cache-Control no-cache;
  }
}
```

---

## 13) ffmpeg Worker Control

* Start: API spawns or enables `systemctl start escapeplan-ffmpeg@<cameraId>` using template:

```ini
[Unit]
Description=FFmpeg HLS worker for camera %i
After=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=3
ExecStart=/usr/bin/ffmpeg -rtsp_transport tcp -i %E(CAM_%i_URL) \
  -an -c:v copy -f hls -hls_time 1 -hls_list_size 3 -hls_flags delete_segments+append_list \
  /var/lib/escapeplan/hls/%i/index.m3u8
EnvironmentFile=-/etc/escapeplan/cameras.env

[Install]
WantedBy=multi-user.target
```

* `/etc/escapeplan/cameras.env` holds `CAM_<id>_URL=rtsp://...`

---

## 14) Game Runner Logic (Runtime Model)

* Session states: SCHEDULED → RUNNING ↔ PAUSED → COMPLETED/ABORTED.
* Timer stored server‑side; WS pushes ticks each second.
* Puzzle state per session (derived map: unsolved/solved). Hints sent logged with timestamp.
* Quick actions: send hint (records `hint_sends`, WS broadcast), mark puzzle solved, add note.

---

## 15) Test Plan (MVP)

* **Unit**: validation (Zod), pricing engine, booking overlap, RBAC guards.
* **Integration**: create Game→Room→Camera→Booking→Session lifecycle; hint sends.
* **E2E**: Cypress or Playwright: login, start session, view camera tile, send hint, end session.
* **Load**: Simulate 4 sessions, 4 HLS tiles, 2 operators.
* **Resilience**: Kill ffmpeg; expect auto-restart; verify HLS index updates.

---

## 16) Operator Runbook

* Start/stop services; view logs; add camera; verify stream; backup DB; restore.
* Nightly cron: compress logs > 14 days; vacuum db monthly.

---

## 17) Roadmap

| Version | Focus | Key Deliverables |
| ------- | ----- | ---------------- |
| **0.1.0** | MVP – "EscapePlan Launch" | Complete PHASE_1–PHASE_6 backlog: pi-gen base image, Wi-Fi AP automation, Fastify services, Drizzle schema + seeds, DaisyUI PWA dashboard & game runner, mobile catalog flag + logistics notes, analytics snapshots, QA/pilot, release packaging. |
| **0.1.1** | Stabilization | Bug fixes from pilot, stream performance tuning, expanded real seed catalog, UX polish on dashboard and bookings. |
| **0.2.0** | Streaming & Device Enhancements | ONVIF discovery, optional LL-HLS/WebRTC pipelines, multi-camera layout presets, HDMI control-room display support. |
| **0.3.0** | CRM & Integrations | Lead capture, lightweight CRM notes, optional email/SMS gateway when WAN available, calendar export/sync, basic customer portal. |
| **0.4.0** | Multi-site & Advanced Analytics | Multi-location management, deeper revenue/throughput analytics, automated maintenance schedules, differential OTA updates. |

---

## 18) UX Wireframe Notes (text)

* **Dashboard Card**: [Title][Status badge][Timer]

  * Camera mosaic (primary large, thumbnails below). Buttons: Start/Pause/End, Hints, View Runner
* **Hint Modal**: tabs (Text, Image, Audio, Video), list by ordinal; “Send” and “Preview”
* **Cameras Page**: table (Name, Room, Status, Actions: Test, Start/Stop, Set Primary)
* **Games Page**: sections (Details, Pricing, Puzzles & Hints, Cameras)

---

## 19) API Examples

### 19.1 Create Game

```http
POST /api/games
{
  "name": "Pharaoh's Tomb",
  "slug": "pharaohs-tomb",
  "description": "Ancient traps and riddles.",
  "duration_minutes": 60,
  "difficulty": 4,
  "reservation_style": "PUBLIC",
  "min_players": 2,
  "max_players": 8,
  "difficulty_toggle_on_booking": true,
  "resources_required": 1,
  "pricing_model": "PER_PERSON"
}
```

### 19.2 Add Camera

```http
POST /api/cameras
{
  "room_id": 1,
  "name": "Room1-Overhead",
  "rtsp_url": "rtsp://user:pass@10.10.10.60:554/h264Preview_01_main"
}
```

### 19.3 Start Session & Send Hint

```http
POST /api/sessions { "booking_id": 42 }
POST /api/sessions/55/start
POST /api/sessions/55/hints { "puzzleId": 9, "hintId": 27 }
```

---

## 20) Installation & Provisioning (Recap)

* Install OS, hostapd, dnsmasq, nginx, chrony as per network guide.
* Install app `.deb`, which:

  * Creates `/var/lib/escapeplan` and DB.
  * Seeds roles + admin.
  * Installs Nginx site and systemd services.
  * Provides CLI: `escapeplan add-camera`, `escapeplan seed`, `escapeplan backup`, `escapeplan cert-export`.
  * Configures hostapd/dnsmasq with SSID `EscapePlan` + WPA2 PSK and advertises `escapeplan.local` via Avahi.
  * Generates self-signed certificate bundle and prompts operator to trust on client devices.

---

## 21) Acceptance Criteria (MVP)

1. Operator can log in and see Dashboard with at least one game tile and camera stream.
2. Admin can create a game with puzzles/hints, assign to a room, add camera, and confirm a booking.
3. Employee can start/pause/end a session and send hints that are logged and visible.
4. System runs 8h continuously with 2+ streams and 2 sessions active without crash.
5. All data persisted in SQLite and survives reboot; HLS resumes after restart.
6. Booking flow supports discount codes, deposits, and marks games as mobile when applicable.
7. Public timer at `https://escapeplan.local/{game-slug}` renders room background and hint updates without login.
8. Self-signed HTTPS certificate trusted on target tablets/phones; mDNS resolves `escapeplan.local` from iOS/macOS/Windows clients.

---

## 22) Compliance & Licensing

* Code under **AGPL‑3.0** (or company-preferred). Third‑party licenses documented. Reolink trademarks respected.

---

## 23) Open Questions

* Battery‑powered Reolink models without RTSP: accept app‑only live view or add bridge?
* LL‑HLS vs WebRTC for sub‑second latency on Pi resources.
* Multi‑display wall mode (HDMI out from Pi vs browser client grid).
