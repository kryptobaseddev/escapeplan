# EscapePlan - Escape Room Management System

<div align="center">

**Complete Escape Room Management & Point-of-Sale Solution**

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-c51a4a.svg)](https://www.raspberrypi.org/)
[![Debian](https://img.shields.io/badge/based%20on-Debian%2012-d70a53.svg)](https://www.debian.org/)

[Quick Start](#quick-start) • [Features](#features) • [Installation](#installation) • [Documentation](#documentation) • [Support](#support)

</div>

---

## Overview

EscapePlan is a comprehensive escape room management system designed specifically for Raspberry Pi appliances. It provides a complete solution for managing games, bookings, sessions, and daily operations with an offline-first architecture and real-time monitoring capabilities.

### Key Highlights

- **Turnkey Appliance**: Pre-configured Raspberry Pi OS image with WiFi access point
- **Offline-First**: Runs entirely on-premises with no cloud dependencies
- **Real-Time Dashboard**: Live camera feeds and session monitoring
- **Mobile-Optimized**: Progressive Web App (PWA) for tablets and phones
- **Secure by Default**: Automatic TLS certificates, hardened nginx, RBAC authentication
- **100% Compliant**: Debian Policy compliant, production-ready

---

## Features

### Game Library Management
- Multi-location support with franchise capabilities
- Game profiles with difficulty ratings and pricing tiers
- Asset management (images, videos, documents)
- Custom tags and categorization

### Booking & Session Management
- Online and walk-in booking support
- Real-time session tracking and timers
- Team management and player tracking
- Session history and analytics

### Point-of-Sale
- Flexible pricing with discounts and add-ons
- Payment processing (cash, card, gift certificates)
- Receipt generation and transaction history
- Revenue tracking and reporting

### Real-Time Monitoring
- Live camera feed integration (RTSP/MJPEG)
- Session status dashboard
- Team communication tools
- Emergency controls and game reset

### User & Access Control
- Role-based access control (RBAC)
- Operator and customer user types
- Multi-location permissions
- Secure authentication with JWT tokens

---

## System Requirements

### Hardware
- **Raspberry Pi 4B** (4GB+ RAM recommended) or **Raspberry Pi 5**
- **16GB+ microSD card** (32GB+ recommended for logs/media)
- **Ethernet connection** (for initial setup) or WiFi
- **Optional**: External storage for camera recordings

### Network
- **For Online Setup**: Internet connection for initial download
- **For Offline Setup**: USB drive with downloaded releases
- **Access Point Mode**: Automatic WiFi AP created on first boot
  - SSID: `EscapePlan`
  - Password: `escapeplan2024`
  - IP Range: `10.10.10.0/24`
  - Gateway: `10.10.10.1`

### Client Devices
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- JavaScript enabled
- Recommended: Tablet or desktop for optimal experience

---

## Quick Start

### Online Installation

1. **Download the Latest Release**
   ```bash
   # Download base OS image
   wget https://github.com/kryptobaseddev/escapeplan/releases/latest/download/escapeplan-base-v1.0.0.img.xz

   # Verify checksum
   sha256sum -c escapeplan-base-v1.0.0.img.xz.sha256
   ```

2. **Flash to microSD Card**
   ```bash
   # Using Raspberry Pi Imager (recommended)
   # Or using dd:
   xzcat escapeplan-base-v1.0.0.img.xz | sudo dd of=/dev/sdX bs=4M status=progress
   ```

3. **Boot and Connect**
   - Insert microSD card into Raspberry Pi
   - Power on the device
   - Connect to WiFi network `EscapePlan` (password: `escapeplan2024`)
   - Navigate to: `https://10.10.10.1`

4. **Complete Setup**
   - Accept self-signed certificate warning (first time only)
   - Create your first operator account
   - Configure your location and games
   - Start managing bookings!

### Offline Installation

See [docs/INSTALLATION.md](docs/INSTALLATION.md#offline-installation) for USB-based installation without internet access.

---

## Installation

For complete installation instructions, see:
- **[Installation Guide](docs/INSTALLATION.md)** - Full setup instructions
- **[Quick Start Guide](docs/QUICKSTART.md)** - 5-minute setup
- **[Upgrade Guide](docs/UPGRADE.md)** - Upgrading existing installations

### What's Included

#### Base OS Image (`escapeplan-base-*.img.xz`)
- Raspberry Pi OS Lite (Debian 12 Bookworm)
- Pre-configured WiFi access point (NetworkManager)
- nginx web server with TLS
- PostgreSQL 15 database
- Automatic security hardening
- System monitoring and logging

#### Application Package (`escapeplan-app-*.deb`)
- EscapePlan API server (Node.js/Fastify)
- EscapePlan Web UI (React PWA)
- Database migrations and seed data
- systemd service configuration
- Log rotation and maintenance scripts

---

## Documentation

### Getting Started
- [Quick Start Guide](docs/QUICKSTART.md) - Get running in 5 minutes
- [Installation Guide](docs/INSTALLATION.md) - Detailed setup instructions
- [Upgrade Guide](docs/UPGRADE.md) - Update to new versions

### Operations
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Security Best Practices](docs/SECURITY.md) - Hardening and maintenance

### Development
- **Base OS Repository**: [github.com/kryptobaseddev/escapeplan-base](https://github.com/kryptobaseddev/escapeplan-base) (private)
- **Application Repository**: [github.com/kryptobaseddev/escapeplan-app](https://github.com/kryptobaseddev/escapeplan-app) (private)

### Release Notes
- [Changelog](CHANGELOG.md) - Version history and changes

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Devices                          │
│          (Tablets, Phones, Desktops, Laptops)              │
│                  WiFi: 10.10.10.0/24                        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS (TLS)
┌────────────────────┴────────────────────────────────────────┐
│               Raspberry Pi Appliance                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                nginx (Reverse Proxy)                   │ │
│  │              - TLS termination                         │ │
│  │              - Security headers                        │ │
│  │              - Rate limiting                           │ │
│  └─────────────────┬──────────────────────────────────────┘ │
│                    │                                         │
│  ┌─────────────────┴──────────┬─────────────────────────┐   │
│  │   EscapePlan API (Fastify) │  EscapePlan Web (React) │   │
│  │   - REST API               │  - PWA                  │   │
│  │   - WebSocket (planned)    │  - Offline-first        │   │
│  │   - JWT auth               │  - Mobile-optimized     │   │
│  └────────────┬───────────────┴─────────────────────────┘   │
│               │                                              │
│  ┌────────────┴────────────────────┐                        │
│  │      PostgreSQL 15              │                        │
│  │      - RBAC data                │                        │
│  │      - Game library             │                        │
│  │      - Bookings & sessions      │                        │
│  └─────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Security

### Default Security Features
- Automatic TLS certificate generation (self-signed)
- nginx security hardening (CSP, HSTS, X-Frame-Options)
- PostgreSQL authentication (local peer, no network exposure)
- JWT-based API authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Rate limiting and DDoS protection

### Security Best Practices
- Change default WiFi password immediately after first boot
- Use strong passwords for operator accounts
- Regularly update to latest releases
- Backup database regularly
- Monitor logs for suspicious activity
- Consider custom TLS certificates for production

See [docs/SECURITY.md](docs/SECURITY.md) for comprehensive security guidance.

---

## Support

### Getting Help
- **Documentation**: Check [docs/](docs/) directory
- **Troubleshooting**: See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **Discussions**: Use [GitHub Discussions](https://github.com/kryptobaseddev/escapeplan/discussions)
- **Issues**: Report bugs via [GitHub Issues](https://github.com/kryptobaseddev/escapeplan/issues)

### Community
- Share your setup and experiences
- Request features and enhancements
- Contribute documentation improvements
- Help other users in discussions

---

## License

**Proprietary License**

Copyright (c) 2024-2025 EscapePlan Platform Team. All rights reserved.

This software and associated documentation files (the "Software") are the proprietary and confidential property of the EscapePlan Platform Team.

Binary distributions are provided to licensed customers only. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited and may result in severe civil and criminal penalties.

See [LICENSE](LICENSE) for full terms.

---

## About

EscapePlan is designed and built specifically for escape room operators who need a reliable, secure, and offline-capable management system. The platform is built on proven open-source technologies (Debian, PostgreSQL, nginx, Node.js, React) with a focus on simplicity, security, and performance.

### Technology Stack
- **OS**: Debian 12 Bookworm (Raspberry Pi OS Lite)
- **Database**: PostgreSQL 15
- **Web Server**: nginx 1.22+
- **API**: Node.js 20 LTS, Fastify 4
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Auth**: JWT tokens, bcrypt password hashing
- **Network**: NetworkManager, dnsmasq, hostapd

---

<div align="center">

**[Download Latest Release](https://github.com/kryptobaseddev/escapeplan/releases/latest)**

Made with care for escape room operators

</div>
