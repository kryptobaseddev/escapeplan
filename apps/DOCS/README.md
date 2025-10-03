# EscapePlan Documentation Index

**Last Updated:** 2025-10-03

Welcome to the EscapePlan technical documentation. This directory contains comprehensive guides for all major systems and features.

---

## Core System Documentation

### [Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)
**Zero-configuration deployment with smart environment detection**

- Automatic dev/prod environment detection (no NODE_ENV required)
- Dynamic path resolution for all environments
- Database-backed system settings (editable via Admin UI)
- File size limits, backup retention, update settings

**Key Topics:** Environment detection, path resolution, system settings, Drizzle integration

---

### [Database System](./DATABASE_SYSTEM.md)
**Complete SQLite schema specification with Drizzle ORM**

- 20+ interconnected tables
- UUID strategy, foreign keys, indexes
- Schema architecture and migration history
- JSON column handling

**Key Topics:** Table schemas, relationships, migrations, best practices

---

### [API Contracts & Schema Management](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)
**The "BIBLE" for schema changes and API patterns**

- Single source of truth: Drizzle + Zod
- Step-by-step schema change workflow
- Adding fields, entities, and relationships
- Validation best practices

**Key Topics:** Drizzle schema, Zod validation, API endpoints, type safety

---

## Feature-Specific Documentation

### [Asset Storage Architecture](./ASSET_STORAGE_ARCHITECTURE.md)
**File upload and asset management system**

- Dynamic path resolution (dev vs prod)
- File naming conventions (slug-based)
- Upload pipeline: validation → processing → storage → metrics
- Storage monitoring and backup

**Key Topics:** File uploads, asset paths, image/video processing, storage metrics

---

### [Network & WiFi System](./NETWORK_WIFI_SYSTEM.md)
**Dual WiFi architecture: Internal AP + External client**

- Broadcast WiFi (hostapd + dnsmasq)
- WiFi client mode (nmcli)
- Network configuration API
- Database schema for network profiles

**Key Topics:** WiFi AP, client connection, network management, mDNS

---

### [RBAC System](./RBAC_SYSTEM.md)
**Database-driven role-based access control**

- 27 permissions across 10 categories
- 4 system roles (admin, manager, game_master, customer)
- Custom role management API
- Permission-based UI rendering

**Key Topics:** Roles, permissions, access control, session enrichment

---

### [Logging & Alerting System](./LOGGING_ALERTING_SYSTEM.md)
**Winston logger with database-driven alert rules**

- Structured logging (Winston + daily rotation)
- Alert rule engine (template-based)
- Database schema: system_logs, alerts, alert_rules
- Implementation phases and status

**Key Topics:** Logging, alerts, Winston, rule engine

---

### [Dashboard System](./DASHBOARD_SYSTEM.md)
**Admin panel with unified tabbed interface**

- User management, camera management, system dashboard
- Permission-based access control
- Implementation roadmap (8 phases)
- User stories and wireframes

**Key Topics:** Admin UI, camera streams, system health, user management

---

### [Media Modal Component](./MEDIA_MODAL.md)
**Reusable media player modal (images, audio, video)**

- Native HTML5 media controls
- Responsive scaling and positioning
- Props reference and usage examples
- Accessibility features

**Key Topics:** Modal component, media playback, responsive design

---

## Quick Navigation by Topic

### Environment & Configuration
- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Environment detection, paths, settings
- **[Database System](./DATABASE_SYSTEM.md)** - Database configuration and Drizzle setup

### Database & Schema
- **[Database System](./DATABASE_SYSTEM.md)** - Complete table reference
- **[API Contracts & Schema Management](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)** - Schema workflow and patterns

### File Storage
- **[Asset Storage Architecture](./ASSET_STORAGE_ARCHITECTURE.md)** - File uploads and storage
- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Storage paths and file size limits

### Access Control
- **[RBAC System](./RBAC_SYSTEM.md)** - Roles and permissions
- **[Database System](./DATABASE_SYSTEM.md)** - RBAC table schemas

### Networking
- **[Network & WiFi System](./NETWORK_WIFI_SYSTEM.md)** - WiFi configuration and management
- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Network config paths

### System Monitoring
- **[Logging & Alerting System](./LOGGING_ALERTING_SYSTEM.md)** - Logs and alerts
- **[Dashboard System](./DASHBOARD_SYSTEM.md)** - System health dashboard

---

## Documentation Standards

### Cross-Referencing
All documentation should include a "Related Documentation" section linking to:
- **Core System Docs** - Foundational systems (Runtime, Database, API Contracts)
- **Integration Docs** - Related feature documentation

### Code References
Use absolute file paths from repository root:
```
apps/escapeplan-api/src/state.ts
packages/contracts/src/schema.ts
```

### Version Tracking
Each document should include:
```markdown
**Document Version:** X.Y
**Last Updated:** YYYY-MM-DD
**Status:** ✅ Production Ready / 🚧 Planning / 🔄 In Progress
```

---

## Contributing to Documentation

When updating these docs:
1. **Update cross-references** if adding new systems
2. **Maintain consistent formatting** (headers, code blocks, tables)
3. **Include version/date** in document header
4. **Link to source code** for implementation details
5. **Update this README** if adding new documentation files

---

**For questions or documentation improvements, see the project's main README.md**
