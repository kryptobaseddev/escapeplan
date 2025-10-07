# EscapePlan Dependencies

This document provides a comprehensive overview of all dependencies required by the EscapePlan application.

## Base OS Platform Dependency

### escapeplan-base (>= 1.0.0)

The EscapePlan application requires the `escapeplan-base` platform to be installed first. This is enforced at the package manager level through Debian package dependencies.

**Relationship:**
```
Depends: escapeplan-base (>= 1.0.0) | escapeplan-platform
```

The base OS provides all system-level services and configuration, allowing the application package to focus solely on application code and architecture-specific tasks (native module compilation).

## System Dependencies (Provided by Base OS)

These dependencies are guaranteed to be present when `escapeplan-base` is installed:

### Node.js (>= 22)
- **Purpose:** JavaScript runtime for API and build tools
- **Version Required:** 22.x or newer
- **Provided By:** escapeplan-base
- **Usage:** Runs Fastify API server, executes build scripts, npm package management

### nginx (>= 1.18)
- **Purpose:** Web server and reverse proxy
- **Version Required:** 1.18 or newer
- **Provided By:** escapeplan-base
- **Configuration:** Pre-configured in base OS with TLS, proxy settings, and static file serving
- **Usage:** Serves SvelteKit PWA static files, proxies /api requests to Fastify backend

### SQLite (>= 3.34)
- **Purpose:** Embedded database engine
- **Version Required:** 3.34 or newer
- **Provided By:** escapeplan-base
- **Usage:** Application database storage (better-sqlite3 binding)

### NetworkManager
- **Purpose:** Network configuration daemon
- **Provided By:** escapeplan-base
- **Configuration:** Pre-configured Wi-Fi hotspot (SSID: EscapePlan, 10.10.10.0/24 subnet)
- **Usage:** Provides isolated network for escape room devices

### systemd
- **Purpose:** Service manager
- **Provided By:** escapeplan-base
- **Configuration:** Service units for escapeplan-api, nginx, and camera streaming
- **Usage:** Manages application lifecycle, auto-start on boot

## Recommended System Packages

### build-essential
- **Purpose:** C/C++ compiler toolchain
- **Required For:** Native module compilation (better-sqlite3, sharp, argon2, sodium-native)
- **When Needed:** Post-install native module rebuild for target architecture

### python3
- **Purpose:** Python runtime for node-gyp
- **Required For:** Native module build scripts
- **When Needed:** Post-install native module rebuild

## Node.js Application Dependencies

### API Dependencies (apps/escapeplan-api)

#### Production Dependencies

**Core Framework:**
- `fastify` (^5.6.1) - High-performance web framework
- `@fastify/cookie` (^10.0.1) - Cookie parsing support
- `@fastify/cors` (^10.0.1) - CORS handling
- `@fastify/csrf-protection` (^7.0.1) - CSRF security
- `@fastify/multipart` (^9.2.1) - File upload support
- `@fastify/rate-limit` (^10.3.0) - Rate limiting
- `@fastify/static` (^8.2.0) - Static file serving

**Real-Time Communication:**
- `socket.io` (^4.8.1) - WebSocket server for live updates

**Authentication & Security:**
- `better-auth` (^1.3.24) - Authentication library with Drizzle adapter
- `argon2` (^0.40.3) - Password hashing (native module)
- `sodium-native` (^5.0.9) - Cryptographic operations (native module)

**Database:**
- `better-sqlite3` (^12.4.1) - SQLite driver (native module)
- `drizzle-orm` (^0.44.5) - Type-safe ORM

**Media Processing:**
- `fluent-ffmpeg` (^2.1.3) - RTSP to HLS camera streaming
- `sharp` (^0.34.4) - Image processing (native module)

**Utilities:**
- `nanoid` (^5.0.7) - Unique ID generation
- `ulid` (^3.0.1) - Sortable unique IDs
- `winston` (^3.18.3) - Logging framework
- `winston-daily-rotate-file` (^5.0.0) - Log rotation
- `tar` (^7.5.1) - Backup compression
- `zod` (^3.23.8) - Schema validation
- `node-onvif` (^0.1.7) - Camera discovery

**Avatar Generation:**
- `@dicebear/core` (^9.2.4) - Avatar library
- `@dicebear/bottts` (^9.2.4) - Robot avatar style

**Workspace:**
- `@escapeplan/contracts` (workspace:*) - Shared types and RBAC

#### Development Dependencies

- `@types/better-sqlite3` (^7.6.5) - TypeScript types
- `@types/node` (^20.11.30) - Node.js types
- `@types/tar` (^6.1.13) - tar types
- `@types/fluent-ffmpeg` (^2.1.27) - ffmpeg types
- `drizzle-kit` (^0.31.5) - Database schema management
- `tsup` (^8.2.4) - TypeScript bundler
- `tsx` (^4.7.2) - TypeScript execution
- `typescript` (^5.5.0) - TypeScript compiler
- `vitest` (^1.5.0) - Test framework

### Web Dependencies (apps/escapeplan-web)

#### Production Dependencies

**Framework:**
- `@sveltejs/kit` (^2.43.0) - SvelteKit framework
- `svelte` (^5.39.0) - Svelte 5 compiler

**Authentication:**
- `better-auth` (^1.3.24) - Client-side authentication

**Real-Time:**
- `socket.io-client` (^4.8.1) - WebSocket client

**Media:**
- `hls.js` (^1.6.13) - HLS video player

**PWA:**
- `workbox-window` (^7.3.0) - Service worker management
- `@vite-pwa/sveltekit` (^1.0.0) - PWA plugin

**UI:**
- `daisyui` (^5.1.25) - Component library
- `tailwindcss` (^4.1.13) - Utility CSS framework
- `@tailwindcss/postcss` (^4.1.13) - PostCSS integration
- `@tailwindcss/vite` (^4.1.13) - Vite plugin

**Utilities:**
- `date-fns` (^3.6.0) - Date manipulation

**Avatar Generation:**
- `@dicebear/core` (^9.2.4) - Avatar library
- `@dicebear/bottts` (^9.2.4) - Robot avatar style

**Workspace:**
- `@escapeplan/contracts` (workspace:*) - Shared types and RBAC

#### Development Dependencies

- `@sveltejs/adapter-auto` (^6.0.0) - SvelteKit adapter
- `@sveltejs/vite-plugin-svelte` (^6.0.0) - Vite plugin
- `vite` (^7.1.0) - Build tool
- `typescript` (^5.5.0) - TypeScript compiler
- `svelte-check` (^4.0.0) - Type checker
- `@testing-library/svelte` (^5.2.8) - Testing utilities
- `@testing-library/jest-dom` (^6.9.0) - DOM matchers
- `@testing-library/user-event` (^14.6.1) - User interaction simulation
- `jsdom` (^27.0.0) - DOM implementation
- `vitest` (^1.6.1) - Test framework
- `@fontsource/fira-mono` (^5.0.0) - Monospace font
- `@neoconfetti/svelte` (^2.0.0) - Confetti effects

### Shared Contracts (packages/contracts)

Minimal package providing TypeScript types and RBAC definitions shared between API and web applications.

**No runtime dependencies** - types only package.

## Native Module Compilation

The following packages contain native C/C++ code that must be compiled for the target architecture:

1. **better-sqlite3** - SQLite bindings
2. **sharp** - Image processing (libvips bindings)
3. **argon2** - Password hashing
4. **sodium-native** - Cryptographic primitives

### Build Requirements

These native modules require:
- C++ compiler (g++ from build-essential)
- Python 3 (for node-gyp)
- Node.js development headers

### Post-Install Rebuild

The application package includes a `pi-post-install.sh` script that automatically rebuilds these modules for the target architecture (ARM64 or AMD64) during package installation.

## Package Manager Configuration

### pnpm Workspace (package.json)

```json
{
  "packageManager": "pnpm@10.12.4",
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild", "better-sqlite3"],
    "ignoredBuiltDependencies": ["argon2"],
    "overrides": {
      "esbuild@<=0.24.2": ">=0.25.0",
      "cookie@<0.7.0": ">=0.7.0"
    }
  }
}
```

**Configuration Notes:**
- `onlyBuiltDependencies`: Forces rebuild of these packages even with pre-built binaries
- `ignoredBuiltDependencies`: Prevents build errors if argon2 compilation fails (optional)
- `overrides`: Security and compatibility patches for transitive dependencies

## Dependency Architecture

```
escapeplan-base (OS Platform)
├── Node.js 22+
├── nginx 1.18+
├── SQLite 3.34+
├── NetworkManager (hotspot)
└── systemd (service units)

escapeplan (Application Package)
├── apps/escapeplan-api
│   ├── fastify + plugins
│   ├── better-auth + drizzle
│   ├── socket.io
│   ├── better-sqlite3 (native)
│   ├── sharp (native)
│   ├── argon2 (native)
│   └── sodium-native (native)
├── apps/escapeplan-web
│   ├── SvelteKit + Svelte 5
│   ├── socket.io-client
│   ├── hls.js
│   ├── workbox-window
│   └── tailwindcss + daisyui
└── packages/contracts
    └── TypeScript types only
```

## Version Management

All packages use synchronized versioning managed by Changesets:

- Workspace root version: `0.1.7`
- All subpackages inherit root version
- Debian package version matches workspace version
- Changesets automate version bumps and changelogs

## Security Considerations

1. **Native Module Verification**: All native modules rebuilt from source during installation
2. **Dependency Overrides**: Security patches applied via pnpm overrides
3. **Base OS Isolation**: System dependencies managed separately from application
4. **Minimal Attack Surface**: No internet connectivity required for operation

## References

- Main package.json: `/mnt/projects/escape-plan/escapeplan-app/package.json`
- API package.json: `/mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api/package.json`
- Web package.json: `/mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-web/package.json`
- Build script: `/mnt/projects/escape-plan/escapeplan-app/scripts/build-deb.sh`
- Native module rebuild: `/mnt/projects/escape-plan/escapeplan-app/scripts/pi-post-install.sh`
