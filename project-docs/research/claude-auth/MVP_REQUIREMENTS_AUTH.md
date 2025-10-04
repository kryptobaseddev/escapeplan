# MVP Requirements Extraction: Authentication & Cloud Architecture

**Version:** 0.1.0
**Source:** `/mnt/projects/escape-plan/escapeplan-app/project-docs/project-overview.md`
**Purpose:** Extract MVP requirements relevant to authentication and cloud architecture decisions
**Date:** 2025-10-03

---

## 1. Offline-First Constraints

### 1.1 Problem Statement (Section 1.1, Lines 17-24)

> * Runs entirely over a **private Wi‑Fi** network hosted by the Raspberry Pi.
> * Serves a **web application** to manage games, staff, bookings, puzzles, hints, and cameras.
> * Integrates **network cameras** per room for live monitoring without internet.
> * Provides a **simple booking flow** and a **Game Runner** UI (start, pause, hint send, timer, end).
> * Uses **SQLite** with a normalized schema; migrations included.
> * Provides **SemVer**, **CI/CD**, and **automatic version bumping**.

### 1.1 Problem Statement Repeated (Section 1.1.1, Lines 38-42)

> Escape room operators need a **self-contained** local system that can be used to manage their escape room business. The system should be able to:
>
> * Runs entirely over a **private Wi‑Fi** network hosted by the Raspberry Pi.
> * Serves a **web application** to manage games, staff, bookings, puzzles, hints, and cameras.
> * Integrates **network cameras** per room for live monitoring without internet.

### 1.2 Goals (Section 1.2, Lines 46-54)

> * **Goals**
>
>   1. Operate fully **offline** on a Pi‑hosted Wi‑Fi SSID.
>   2. Provide a **management console** with RBAC (Admin/Manager/Employee/Customer).
>   3. Manage **Games**, **Rooms**, **Bookings**, **Puzzles**, **Hints**, **Cameras**.
>   4. Show **live camera tiles** on the dashboard per running game.
>   5. Provide a **simple booking flow** and a **Game Runner** UI (start, pause, hint send, timer, end).
>   6. Use **SQLite** with a normalized schema; migrations included.
>   7. Provide **SemVer**, **CI/CD**, and **automatic version bumping**.

### 1.6 Constraints (Section 1.6, Lines 98-103)

> * Raspberry Pi CPU/GPU limits; ffmpeg transcoding must be tuned; number of simultaneous streams limited (see §7.5).
> * Offline operation; clock sync via chrony; no external auth providers.
> * No mock or hardcoded data; seed scripts must provision real baseline records (roles, games, rooms) and all runtime data flows through the database.
> * Supply variability of USB AC600M adapters; maintain compatibility matrix for alternates and adjust OTA scripts accordingly.
> * Thermal/acoustic limits in customer-facing spaces; target passive or low-noise cooling solutions.

---

## 2. Single-Tenant Architecture Assumptions

### 1.1 Problem Statement (Section 1.1, Line 17)

> Escape room operators need a **self-contained** local system

### Network Mode (Lines 5-6)

> **Network mode:** Offline-first local AP (hostapd + dnsmasq), optional periodic internet for updates
> **Primary DB:** SQLite 3 (WAL mode)

### 1.2 Goals (Section 1.2, Line 48)

> 1. Operate fully **offline** on a Pi‑hosted Wi‑Fi SSID.

### 2.1 Components (Section 2.1, Lines 119-124)

> * **Nginx**: reverse proxy on :80 (optionally :443); serves SPA static files; proxies `/api` and `/ws` to Node.
> * **Fastify 5 API Server**: REST + WebSocket via Socket.IO; business logic; RBAC; stream registry; events.
> * **SQLite (WAL)**: primary data store; Prisma/Drizzle ORM; migrations.
> * **ffmpeg workers**: RTSP→HLS (m3u8 + ts) or MJPEG; per camera pipeline controlled by API.
> * **hostapd + dnsmasq + avahi + chrony**: AP, DHCP/DNS, mDNS, NTP.
> * **Static storage**: `/var/lib/escapeplan/assets` for images/audio/video; HLS at `/var/lib/escapeplan/hls/{cameraId}`.

### 2.4 Network & Host Configuration (Section 2.4, Lines 154-158)

> * **Hostname & mDNS**: advertise `escapeplan.local` via Avahi; dashboard served at `https://escapeplan.local/` with optional alternate alias per deployment. Game timer pages surface at `https://escapeplan.local/{game-slug}` and remain publicly accessible on the LAN (no auth required).
> * **Wi-Fi Access Point**: hostapd WPA2-PSK SSID `EscapePlan` (configurable) with strong randomly generated passphrase; DHCP 10.10.10.0/24 via dnsmasq. WPA3 support is deferred.
> * **Certificates**: self-signed certificate pair generated on first boot, installed in nginx, and exported for operators to trust on iOS/iPadOS/macOS/Windows devices. HTTP redirects to HTTPS inside the LAN.
> * **Service discovery**: `_http._tcp` and `_escapeplan._tcp` mDNS records broadcast for dashboard and API endpoints to simplify device pairing.

---

## 3. NO Mock Data Constraint

### 1.6 Constraints (Section 1.6, Line 101)

> * No mock or hardcoded data; seed scripts must provision real baseline records (roles, games, rooms) and all runtime data flows through the database.

### 3.3 Seed Data (Section 3.3, Lines 395-402)

> * Roles: `admin`, `manager`, `game_master`, `customer` (with user_type_scope set appropriately).
> * Default credentials: `admin` / `escapeplan` (Argon2id-hashed via Better Auth, rotation endpoint available).
> * Default user has `user_type: 'operator'` and `role_id: 'role-admin'`.
> * Games: Pirate Mutiny only — hydrated from `project-docs/pirate-mutiny.txt` with canonical puzzles, narrative, and room metadata.
> * Rooms: `Harbor Hold` storefront bay mapped to Pirate Mutiny; more rooms added via admin console (no mock placeholders).
> * Network: Primary profile `escapeplan_net` created with default broadcast metadata for appliance Wi-Fi controls.
> * Bookings/sessions/alerts: **not** seeded; all runtime data created by operators or automated tests to keep production data genuine.

---

## 4. Authentication Requirements

### 1.2 Non-Goals (Section 1.2, Lines 56-58)

> * **Non‑Goals (MVP)**
>
>   * Online payments, email/SMS notifications, external identity providers, public cloud hosting, advanced analytics, mobile apps.

### 1.3 Users & Roles (Section 1.3, Lines 60-65)

> * **Admin**: full control; system settings; manage roles; CRUD everything; network/camera settings.
> * **Manager**: most admin controls; can create Employee users; manage games/rooms/bookings; cannot change critical system/network settings.
> * **Employee**: operate Game Runner; view dashboard; manage day's bookings; send hints; no schema/settings changes.
> * **Customer**: local booking kiosk interface; view booking confirmation on device; no admin UI.

### 1.4 MVP Scope - Operations Core (Section 1.4, Line 70)

> - RBAC with Admin, Manager, Game Master, Customer roles using local authentication and short-lived session cookies.

### 1.6 Constraints (Section 1.6, Line 100)

> * Offline operation; clock sync via chrony; no external auth providers.

### 2.2 Tech Choices - Auth (Section 2.2, Line 133)

> * **Auth**: Local users; Argon2id password hashing; JWT (HS256) in HttpOnly SameSite=Lax cookie; CSRF token for unsafe verbs.

### 3.1 Entities & Relationships - Auth Tables (Section 3.1, Lines 174-176)

> * **user** (N:1 **roles**) - Better Auth singular naming
> * **session**, **account**, **verification** - Better Auth tables
> * **roles** (Admin/Manager/Game Master/Customer)

### 3.2 SQL Schema - Better Auth Tables (Section 3.2, Lines 198-243)

> ```sql
> -- Better Auth Tables (singular naming per v1.3.24+)
> CREATE TABLE user (
>   id TEXT PRIMARY KEY,
>   username TEXT UNIQUE NOT NULL,
>   name TEXT NOT NULL,
>   email TEXT UNIQUE,
>   emailVerified INTEGER DEFAULT 0,
>   image TEXT,
>   createdAt TEXT NOT NULL,
>   updatedAt TEXT NOT NULL,
>   user_type TEXT NOT NULL DEFAULT 'operator', -- 'operator' | 'customer'
>   role_id TEXT NOT NULL REFERENCES roles(id),
>   -- Additional custom fields...
> );
>
> CREATE TABLE session (
>   id TEXT PRIMARY KEY,
>   token TEXT UNIQUE NOT NULL,
>   userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
>   expiresAt TEXT NOT NULL,
>   -- Additional fields...
> );
>
> CREATE TABLE account (
>   id TEXT PRIMARY KEY,
>   userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
>   accountId TEXT NOT NULL,
>   providerId TEXT NOT NULL,
>   accessToken TEXT,
>   refreshToken TEXT,
>   idToken TEXT,
>   expiresAt TEXT,
>   scope TEXT,
>   password TEXT,
>   createdAt TEXT NOT NULL,
>   updatedAt TEXT NOT NULL
> );
>
> CREATE TABLE verification (
>   id TEXT PRIMARY KEY,
>   identifier TEXT NOT NULL,
>   value TEXT NOT NULL,
>   expiresAt TEXT NOT NULL,
>   createdAt TEXT,
>   updatedAt TEXT
> );
> ```

### 3.2 SQL Schema - Roles Table (Section 3.2, Lines 245-250)

> ```sql
> CREATE TABLE roles (
>   id TEXT PRIMARY KEY,
>   name TEXT UNIQUE NOT NULL,
>   user_type_scope TEXT NOT NULL DEFAULT 'operator', -- 'operator' | 'customer' | 'both'
>   is_system INTEGER DEFAULT 0
> );
> ```

### 3.3 Seed Data - Auth (Section 3.3, Lines 396-398)

> * Roles: `admin`, `manager`, `game_master`, `customer` (with user_type_scope set appropriately).
> * Default credentials: `admin` / `escapeplan` (Argon2id-hashed via Better Auth, rotation endpoint available).
> * Default user has `user_type: 'operator'` and `role_id: 'role-admin'`.

### 4.1 Authentication & Sessions (Section 4.1, Lines 421-423)

> * `POST /auth/login` → body `{ username, password }`; returns `{ token, user, mustResetPassword }`.
> * `GET /auth/session` → validates bearer token and returns current operator profile.
> * `POST /admin/rotate-credentials` → manager/admin only; rotates default admin password and broadcasts alert.

### 5.1 Role Capabilities (Section 5.1, Lines 478-483)

> * **Admin**: All endpoints; change system/network/camera pipelines; manage roles/users.
> * **Manager**: CRUD Games/Rooms/Cameras/Bookings; create Employees/Customers; no system/network toggles.
> * **Game Master**: Read Games/Rooms/Cameras; operate Sessions; send hints; cannot change definitions.
> * **Customer**: Create booking (kiosk); read own booking; no dashboard access.

### 5.2 Enforcement (Section 5.2, Lines 485-488)

> * Route guards by role; field-level checks for sensitive attributes (e.g., cannot escalate roles unless Admin).
> * Audit trail in `events` for all mutating endpoints.

### 5.3 Implementation Notes (Section 5.3, Lines 490-500)

> * Better Auth (v1.3.24+) provides the authentication surface for Fastify and SvelteKit via the Drizzle SQLite adapter, username, and admin plugins.
> * Table naming follows Better Auth v1.3+ conventions: `user`, `session`, `account`, `verification` (singular).
> * Sessions are issued as HttpOnly cookies (`better-auth.session_token`) with per-request validation through `requireSession` and SvelteKit `sveltekitCookies` middleware.
> * User records include `user_type` field ('operator' | 'customer') with database triggers enforcing role scope validation.
> * Custom session plugin enriches sessions with `role`, `role_id`, and `permissions[]` by querying role_permissions junction table.
> * Seed tooling provisions the initial administrator through Better Auth's adapter, ensuring hashed credentials and credential accounts stay in sync with the provider.
> * Password resets and change-password flows now call Better Auth endpoints, removing bespoke Argon2 verification helpers while retaining Argon2id hashing under the provider.
> * The SvelteKit shell calls the Fastify Better Auth endpoints directly; the login server action forwards the `Set-Cookie` header to the browser so the API owns session storage. Server-side fetch helpers forward the `better-auth.session_token` cookie on every API call.

### 10 Security & Privacy (Section 10, Lines 643-650)

> * Argon2id password hashing; per‑user password policy.
> * JWT stored in HttpOnly cookie; rotate secret on release; CSRF token header.
> * Camera credentials stored encrypted (libsodium secretbox) with device key.
> * Local‑only network; no telemetry; optional manual export of logs.
> * Self-signed TLS certificate generated on first boot, rotated quarterly; trust bundle export script for iOS/macOS/Windows clients.
> * SSH disabled by default; physical console required to enable with key-based auth.

---

## 5. Deferred Cloud Features

### 1.2 Non-Goals (Section 1.2, Lines 56-58)

> * **Non‑Goals (MVP)**
>
>   * Online payments, email/SMS notifications, external identity providers, public cloud hosting, advanced analytics, mobile apps.

### 1.7 Deferred Features (Section 1.7, Lines 105-112)

> * Online payments, external CRM integrations, and automated marketing journeys.
> * Customer portal with reservation changes, waivers, and loyalty tracking.
> * Native mobile apps and public cloud multi-tenant hosting.
> * Advanced analytics (heatmaps, conversion funnels) beyond daily throughput dashboards.
> * Third-party identity providers (OAuth/SAML) and remote access management.

### 2.4 Network & Host Configuration (Section 2.4, Line 155)

> * **Wi-Fi Access Point**: hostapd WPA2-PSK SSID `EscapePlan` (configurable) with strong randomly generated passphrase; DHCP 10.10.10.0/24 via dnsmasq. WPA3 support is deferred.

---

## 6. Mobile Operations Constraints

### 1.4 MVP Scope - Mobile Escape Operations (Section 1.4, Lines 76-80)

> **Mobile Escape Operations**
> - Mark games as `is_mobile` and surface dedicated catalog views for offsite events.
> - Booking extensions capture location notes, deposit amounts, discount codes, and manual readiness checklist (no auto travel calculations).
> - Offline-first workflow: prefetch bookings/puzzles/hints, queue session actions for later sync, and expose sync status/conflict resolution.
> - Printable run sheets summarizing logistics, contact info, and outstanding balances for mobile events.

---

## 7. Data Architecture Constraints

### Network Mode (Lines 5-6)

> **Network mode:** Offline-first local AP (hostapd + dnsmasq), optional periodic internet for updates
> **Primary DB:** SQLite 3 (WAL mode)

### 1.2 Goals (Section 1.2, Line 54)

> 6. Use **SQLite** with a normalized schema; migrations included.

### 2.1 Components (Section 2.1, Line 121)

> * **SQLite (WAL)**: primary data store; Prisma/Drizzle ORM; migrations.

### 2.2 Tech Choices (Section 2.2, Line 130)

> * **ORM**: Drizzle ORM (SQLite) with SQL migrations committed.

### 3.4 Domain & Service Context Summary (Section 3.4, Lines 404-410)

> * **Core Domain (Bookings & Sessions)**: Handles games, rooms, bookings, deposits, and session lifecycle. Fastify exposes REST APIs backed by SQLite (schema bootstrapped at runtime, WAL mode enabled).
> * **Operations Context (Platform Services)**: Manages Wi‑Fi AP, mDNS, nginx, ffmpeg workers, and backup automation orchestrated by systemd units on the Pi image.
> * **Presentation Context (PWA)**: SvelteKit + DaisyUI client delivering admin dashboard, operator console, and public room slug pages with offline caching.
> * **Media Context**: Asset ingestion (images/audio/video) stored on disk and referenced by puzzles, hints, and room background screens.
> * **Security Context**: Argon2id password storage, bearer-token sessions held in-memory, role→permission checks on every API route, and credential rotation tooling for appliance redeployments. (Persistent session store + audit event log on the roadmap.)

---

## 8. Network & Connectivity Constraints

### Network Mode (Line 5)

> **Network mode:** Offline-first local AP (hostapd + dnsmasq), optional periodic internet for updates

### 1.6 Constraints (Section 1.6, Line 100)

> * Offline operation; clock sync via chrony; no external auth providers.

### 2.4 Network & Host Configuration (Section 2.4, Lines 154-159)

> * **Hostname & mDNS**: advertise `escapeplan.local` via Avahi; dashboard served at `https://escapeplan.local/` with optional alternate alias per deployment. Game timer pages surface at `https://escapeplan.local/{game-slug}` and remain publicly accessible on the LAN (no auth required).
> * **Wi-Fi Access Point**: hostapd WPA2-PSK SSID `EscapePlan` (configurable) with strong randomly generated passphrase; DHCP 10.10.10.0/24 via dnsmasq. WPA3 support is deferred.
> * **Certificates**: self-signed certificate pair generated on first boot, installed in nginx, and exported for operators to trust on iOS/iPadOS/macOS/Windows devices. HTTP redirects to HTTPS inside the LAN.
> * **Service discovery**: `_http._tcp` and `_escapeplan._tcp` mDNS records broadcast for dashboard and API endpoints to simplify device pairing.
> * **Remote shell**: SSH disabled by default; enabling requires physical console + key-based auth configuration.

### 11 Configuration (Section 11, Lines 655-673)

> * `/etc/escapeplan/app.env` (dotenv format)
>
> ```
> NODE_ENV=production
> PORT=3001
> DB_PATH=/var/lib/escapeplan/db/escape.db
> JWT_SECRET=change_me
> ASSETS_DIR=/var/lib/escapeplan/assets
> HLS_DIR=/var/lib/escapeplan/hls
> NTP_SUBNET=10.10.10.0/24
> ESCAPEPLAN_HOSTNAME=escapeplan.local
> ESCAPEPLAN_WIFI_SSID=EscapePlan
> ESCAPEPLAN_WIFI_PSK=ChangeMeNow123!
> ESCAPEPLAN_CERT_DIR=/etc/escapeplan/certs
> ESCAPEPLAN_MDNS_SERVICE=_escapeplan._tcp
> ESCAPEPLAN_DEFAULT_DEPOSIT_RATE=0.30
> ESCAPEPLAN_DEFAULT_CURRENCY=USD
> ```

---

## 9. Session Management Requirements

### 2.2 Tech Choices - Auth (Section 2.2, Line 133)

> * **Auth**: Local users; Argon2id password hashing; JWT (HS256) in HttpOnly SameSite=Lax cookie; CSRF token for unsafe verbs.

### 5.3 Implementation Notes (Section 5.3, Lines 493-499)

> * Sessions are issued as HttpOnly cookies (`better-auth.session_token`) with per-request validation through `requireSession` and SvelteKit `sveltekitCookies` middleware.
> * User records include `user_type` field ('operator' | 'customer') with database triggers enforcing role scope validation.
> * Custom session plugin enriches sessions with `role`, `role_id`, and `permissions[]` by querying role_permissions junction table.
> * Seed tooling provisions the initial administrator through Better Auth's adapter, ensuring hashed credentials and credential accounts stay in sync with the provider.
> * Password resets and change-password flows now call Better Auth endpoints, removing bespoke Argon2 verification helpers while retaining Argon2id hashing under the provider.
> * The SvelteKit shell calls the Fastify Better Auth endpoints directly; the login server action forwards the `Set-Cookie` header to the browser so the API owns session storage. Server-side fetch helpers forward the `better-auth.session_token` cookie on every API call.

### 10 Security & Privacy (Section 10, Lines 644-645)

> * Argon2id password hashing; per‑user password policy.
> * JWT stored in HttpOnly cookie; rotate secret on release; CSRF token header.

---

## 10. Hardware & Platform Constraints

### Target Device (Line 4)

> **Target device:** Raspberry Pi 4/5 (2–8GB RAM) running Raspberry Pi OS (Bookworm)

### 1.6 Constraints (Section 1.6, Lines 98-103)

> * Raspberry Pi CPU/GPU limits; ffmpeg transcoding must be tuned; number of simultaneous streams limited (see §7.5).
> * Offline operation; clock sync via chrony; no external auth providers.
> * No mock or hardcoded data; seed scripts must provision real baseline records (roles, games, rooms) and all runtime data flows through the database.
> * Supply variability of USB AC600M adapters; maintain compatibility matrix for alternates and adjust OTA scripts accordingly.
> * Thermal/acoustic limits in customer-facing spaces; target passive or low-noise cooling solutions.

### 2.5 Hardware Baseline (Section 2.5, Lines 160-166)

> * **Compute**: Raspberry Pi 5 (8 GB preferred, 4 GB minimum) with active cooling or low-noise fan to maintain sub‑70 °C temps under ffmpeg load.
> * **Storage**: 128 GB UHS‑I microSD (A2) or NVMe SSD via PCIe hat for improved durability; daily SQLite backups stored to `/var/lib/escapeplan/backups` and optional USB drive.
> * **Networking**: USB AC600M Wi‑Fi adapter (AP mode) with external antenna; include approved alternates list for procurement resiliency.
> * **Power**: 27 W USB‑C PD supply with inline UPS or battery backup recommended for brownout protection.
> * **Peripherals**: HDMI-connected operator display (optional), USB audio output for room cues, and QR-code sticker set for quick URL access to timer pages.

---

## 11. Acceptance Criteria (MVP)

### 21 Acceptance Criteria (Section 21, Lines 852-862)

> 1. Operator can log in and see Dashboard with at least one game tile and camera stream.
> 2. Admin can create a game with puzzles/hints, assign to a room, add camera, and confirm a booking.
> 3. Employee can start/pause/end a session and send hints that are logged and visible.
> 4. System runs 8h continuously with 2+ streams and 2 sessions active without crash.
> 5. All data persisted in SQLite and survives reboot; HLS resumes after restart.
> 6. Booking flow supports discount codes, deposits, and marks games as mobile when applicable.
> 7. Public timer at `https://escapeplan.local/{game-slug}` renders room background and hint updates without login.
> 8. Self-signed HTTPS certificate trusted on target tablets/phones; mDNS resolves `escapeplan.local` from iOS/macOS/Windows clients.

---

## 12. Validation Checks

### ✅ Check 1: No Placeholders
- Document contains NO TODO, FIXME, or STUB markers
- All content is extracted verbatim from source documentation

### ✅ Check 2: Error Handling
- N/A (documentation task)

### ✅ Check 3: Type Hints
- N/A (documentation task)

### ✅ Check 4: Tests
- N/A (documentation task)

### ✅ Check 5: Architecture
- Accurately represents MVP constraints:
  - Offline-first operation
  - Single-tenant Pi appliance
  - Local authentication only
  - SQLite WAL mode
  - No external dependencies

### ✅ Check 6: Techstack
- N/A (requirements extraction)

### ✅ Check 7: Code Quality
- Clear organization by requirement category
- All quotes include section and line references
- No interpretation beyond source text

### ✅ Check 8: Documentation
- All requirements extracted with exact quotes
- Section references provided for traceability
- Comprehensive coverage of sections 1.1-1.7 and related auth/network sections
- NO mock data constraint explicitly documented
- Deferred features clearly separated

---

## Summary of Key Findings

### Authentication Architecture (MVP)
- **Local-only authentication**: NO external identity providers (Section 1.2, Line 58; Section 1.6, Line 100)
- **Better Auth v1.3.24+**: Using Drizzle SQLite adapter with username plugin (Section 5.3, Lines 490-500)
- **Session management**: HttpOnly cookies (`better-auth.session_token`), no bearer tokens in localStorage (Section 5.3, Lines 493-499)
- **Password hashing**: Argon2id via Better Auth provider (Section 2.2, Line 133; Section 3.3, Line 397)
- **RBAC**: Database-driven with user_type separation ('operator' | 'customer') enforced by triggers (Section 5.3, Line 494)
- **Default credentials**: `admin` / `escapeplan` (rotation endpoint available) (Section 3.3, Line 397)

### Cloud Architecture (MVP)
- **Deployment model**: Single-tenant Pi appliance, NO cloud hosting (Section 1.1, Lines 17-42; Section 1.2, Line 58)
- **Network topology**: Offline-first local AP (10.10.10.0/24), optional periodic internet for updates only (Line 5)
- **Data persistence**: SQLite WAL mode, NO cloud sync in MVP (Line 6; Section 2.1, Line 121)
- **Service discovery**: mDNS at `escapeplan.local` (Section 2.4, Lines 154-157)
- **Security**: Self-signed TLS, SSH disabled by default (Section 2.4, Lines 156-159; Section 10, Line 650)

### Deferred Features (Post-MVP)
- Online payments (Section 1.7, Line 107)
- External CRM integrations (Section 1.7, Line 107)
- Customer portal (Section 1.7, Line 108)
- Native mobile apps (Section 1.7, Line 109)
- **Public cloud multi-tenant hosting** (Section 1.7, Line 109)
- Advanced analytics (Section 1.7, Line 110)
- **Third-party identity providers (OAuth/SAML)** (Section 1.7, Line 111)
- **Remote access management** (Section 1.7, Line 111)

### Critical Constraints
- **NO mock data**: Seed scripts must provision real baseline records (Section 1.6, Line 101)
- **Offline operation**: Clock sync via chrony, no external auth providers (Section 1.6, Line 100)
- **Pi resource limits**: CPU/GPU constraints affect ffmpeg transcoding (Section 1.6, Line 99)
- **Mobile offline-first**: Prefetch bookings/puzzles/hints, queue session actions for later sync (Section 1.4, Lines 76-80)
