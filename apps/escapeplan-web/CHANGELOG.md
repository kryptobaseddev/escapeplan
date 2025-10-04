# escapeplan-web

## 0.1.1

### Patch Changes

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

- Updated dependencies []:
  - @escapeplan/contracts@0.1.1
