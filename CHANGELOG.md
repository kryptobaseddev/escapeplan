# Changelog

All notable changes to EscapePlan will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned Features
- WebSocket support for real-time updates
- Mobile app (React Native)
- Advanced reporting and analytics
- Multi-currency support
- Equipment management module
- Staff scheduling system

---

## [1.0.0] - TBD

Initial public release of EscapePlan escape room management system.

### Added - Base OS Image

#### Network & Access
- NetworkManager-based WiFi access point configuration
- Pre-configured AP: SSID "EscapePlan", password "escapeplan2024"
- Automatic AP creation on first boot
- IP range: 10.10.10.0/24, gateway: 10.10.10.1
- DHCP server (dnsmasq) for client IP assignment
- DNS resolution for local services

#### Web Server & Security
- nginx 1.22+ with reverse proxy configuration
- Automatic TLS certificate generation (self-signed)
- HTTPS redirect for all traffic
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Rate limiting and request size restrictions
- Modern TLS 1.2+ only with strong cipher suites

#### Database
- PostgreSQL 15 with optimized configuration
- Database initialization on first boot
- Peer authentication for system access
- Password authentication for application
- Automatic backup scripts

#### System
- Debian 12 Bookworm base (Raspberry Pi OS Lite)
- 100% Debian Policy compliance
- systemd service management
- Log rotation configured
- Firewall rules (iptables)
- Automatic security updates (optional)

### Added - Application Package

#### Game Library Management
- Multi-location franchise support
- Game profiles with metadata:
  - Name, description, and story
  - Difficulty rating (1-5 stars)
  - Duration and player capacity
  - Categories and custom tags
- Asset management:
  - Image uploads (game photos, logos)
  - Video attachments (trailers, intros)
  - Document storage (waivers, rules)
- Game archiving and restoration
- Bulk operations and filtering

#### Booking System
- Online booking interface
- Walk-in booking support
- Calendar and list views
- Booking status tracking:
  - Pending, confirmed, cancelled
  - No-show handling
- Customer management:
  - Contact information
  - Booking history
  - Notes and preferences
- Email confirmation (optional)
- Payment tracking integration

#### Session Management
- Real-time session tracking
- Session states:
  - Scheduled, in-progress, completed
  - Paused, cancelled
- Session timer with countdown
- Team management:
  - Player names and roles
  - Team size validation
- Session notes and ratings
- Success/failure tracking
- Game master controls:
  - Start/end session
  - Pause/resume
  - Emergency stop

#### Point-of-Sale
- Flexible pricing models:
  - Per-person pricing
  - Flat rate pricing
  - Weekday/weekend rates
  - Time-based pricing
- Discounts and promotions:
  - Percentage or fixed amount
  - Coupon codes
  - Group discounts
- Add-ons and extras:
  - Additional time
  - Photos/videos
  - Merchandise
- Payment processing:
  - Cash, card, gift certificates
  - Split payments
  - Partial payments
- Receipt generation
- Transaction history

#### Dashboard & Monitoring
- Real-time dashboard with:
  - Today's schedule
  - Active sessions
  - Revenue metrics
  - Quick stats
- Live camera feed integration:
  - RTSP stream support
  - MJPEG stream support
  - Multi-camera views
  - Camera status monitoring
- Session countdown timers
- Quick action buttons
- Alert notifications

#### Reporting & Analytics
- Revenue reports:
  - Daily, weekly, monthly
  - By game, by location
  - Payment method breakdown
- Booking analytics:
  - Booking trends
  - Occupancy rates
  - Peak times analysis
- Game performance:
  - Success rates
  - Average duration
  - Customer ratings
- Customer insights:
  - Repeat customers
  - Group sizes
  - Booking sources
- Export to CSV/PDF

#### User Management & RBAC
- Role-based access control:
  - Administrator (full access)
  - Manager (operations, reports)
  - Operator (bookings, sessions)
  - Customer (view bookings - planned)
- User authentication:
  - JWT token-based
  - Secure password hashing (bcrypt)
  - Session management
- Multi-location permissions
- User activity logging
- Password reset functionality

#### Progressive Web App (PWA)
- Installable on all devices:
  - iOS (Safari)
  - Android (Chrome)
  - Desktop (Chrome, Edge)
- Offline-first architecture:
  - Service worker caching
  - Background sync (planned)
  - Offline data access
- Mobile-optimized UI:
  - Touch-friendly controls
  - Responsive design
  - Portrait and landscape modes
- App-like experience:
  - No browser chrome
  - Full-screen mode
  - Native feel

#### Settings & Configuration
- Location settings:
  - Business information
  - Operating hours
  - Timezone configuration
  - Currency settings
- System preferences:
  - Booking defaults
  - Session settings
  - Email templates
  - Camera configuration
- Backup and restore:
  - Database backup
  - Configuration export
  - One-click restore
- User management:
  - Add/edit users
  - Role assignment
  - Permission management

### Technical Details

#### Architecture
- **Frontend**: React 18 with TypeScript
- **Backend**: Node.js 20 LTS with Fastify 4
- **Database**: PostgreSQL 15 with Drizzle ORM
- **Styling**: Tailwind CSS 3
- **Build**: Vite 5 with optimizations
- **Package Manager**: npm 10

#### API
- RESTful API design
- JSON request/response
- JWT authentication
- CORS configured for local access
- Rate limiting per endpoint
- Request validation (Zod schemas)
- Error handling and logging

#### Database Schema
- Normalized relational design
- UUID primary keys
- Timestamp tracking (created/updated)
- Soft deletes (archived flag)
- Foreign key constraints
- Indexes for performance
- Migration system (Drizzle Kit)

#### Deployment
- systemd service management:
  - escapeplan-api.service
  - escapeplan-web.service (static files)
- Debian package (.deb) distribution
- Post-install configuration scripts
- Automatic database migrations
- Log rotation configured
- Backup automation

#### Performance
- Optimized for Raspberry Pi 4/5
- Database query optimization
- Frontend code splitting
- Asset compression (gzip)
- CDN-less operation
- Low memory footprint (<512MB typical)

#### Security
- HTTPS everywhere
- Security headers enabled
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting
- Input validation
- Output encoding
- Secure session management

### Known Limitations

- **No cloud sync**: Fully offline, no multi-site sync
- **Single instance**: One location per device
- **Self-signed certs**: Browser warnings on first access
- **Limited camera support**: RTSP/MJPEG only
- **No mobile app**: PWA only (native app planned)
- **Basic reporting**: Advanced analytics planned
- **Email optional**: Requires external SMTP server

### System Requirements

#### Hardware
- Raspberry Pi 4B (4GB RAM minimum) or Raspberry Pi 5
- 16GB+ microSD card (32GB+ recommended)
- Official 5V/3A power supply

#### Network
- WiFi access point mode (default)
- Ethernet connection (optional)
- No internet required (offline-first)

#### Client Devices
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- JavaScript enabled
- 1024x768 minimum resolution

### Upgrade Notes

**First Release**: No upgrade path from previous versions.

For future upgrades:
- Always backup database before upgrading
- Follow [UPGRADE.md](docs/UPGRADE.md) instructions
- Check changelog for breaking changes
- Test in staging environment if available

---

## Release Versioning

### Version Number Format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes, major new features
- **MINOR**: New features, backwards-compatible
- **PATCH**: Bug fixes, security updates

### Release Types

- **Base OS Image**: `escapeplan-base-vX.Y.Z.img.xz`
  - Major: OS upgrade, system-level changes
  - Minor: New system features, package updates
  - Patch: Security fixes, configuration tweaks

- **Application Package**: `escapeplan-app-vX.Y.Z.deb`
  - Major: Breaking API changes, schema changes
  - Minor: New features, UI improvements
  - Patch: Bug fixes, security patches

### Support Policy

- **Current version**: Full support and updates
- **Previous minor version**: Security updates only
- **Older versions**: Unsupported, upgrade recommended

---

## Links

- [Unreleased]: https://github.com/kryptobaseddev/escapeplan/compare/v1.0.0...HEAD
- [1.0.0]: https://github.com/kryptobaseddev/escapeplan/releases/tag/v1.0.0

---

**Note**: This changelog is for the public release repository containing binary distributions only. Source code changes are tracked in the private development repositories (escapeplan-base, escapeplan-app).
