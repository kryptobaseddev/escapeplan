# escapeplan-api

## 0.1.1

### Patch Changes

- **Security & Deployment Critical Fixes (v0.1.0)**

  This changeset resolves 6 critical blockers preventing production deployment:

  **Pi Deployment Fixes:**

  - Fix systemd service ExecStart path (dist/index.js → index.js)
  - Bundle all node_modules in .deb package (eliminates npm ci requirement)
  - Create required data directories in postinst (/var/lib/escapeplan, /var/log/escapeplan, /etc/escapeplan)

  **Security Hardening:**

  - Add rate limiting with @fastify/rate-limit (5 req/min for auth, 100 req/min for others)
  - Enable CSRF protection with @fastify/csrf-protection and secure cookie configuration
  - Add comprehensive .env.example with 21 documented variables (BETTER_AUTH_SECRET, CAMERA_ENCRYPTION_KEY required)

  **Dependencies Added:**

  - @fastify/rate-limit@^10.3.0
  - @fastify/csrf-protection@^7.0.1
  - @fastify/cookie@^10.0.1

  **Package Changes:**

  - .deb package now 523 MB (includes bundled dependencies)
  - Zero external network requirements during installation
  - Production-ready security configuration

- Initial production release of EscapePlan - Escape Room Management System

  Core Features:

  - Game management (create, edit, archive games with difficulty levels)
  - Room and booking management with calendar view
  - Session control system with real-time game state
  - Camera system with ONVIF discovery and PTZ/IR/Audio controls
  - Asset management with image upload and storage tracking
  - User authentication via Better Auth with role-based permissions
  - System dashboard with health monitoring and alerts
  - Backup system with local storage and restore capabilities
  - Multi-language support (English, Spanish, French, German)

  Technical Stack:

  - Fastify API with Socket.IO real-time communication
  - SvelteKit web interface with DaisyUI components
  - SQLite database with Drizzle ORM
  - TypeScript throughout with strict type checking
  - Monorepo managed with pnpm workspaces

  Deployment:

  - Debian package (.deb) for Raspberry Pi 4/5
  - Systemd services for API and web application
  - Production-ready CI/CD pipeline with GitHub Actions
