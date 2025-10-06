# Release vX.Y.Z

**Release Date**: YYYY-MM-DD

---

## Download

### Base OS Image (Raspberry Pi)
- **File**: `escapeplan-base-vX.Y.Z.img.xz`
- **Size**: ~X.XGB compressed
- **SHA256**: `[checksum]`

### Application Package
- **File**: `escapeplan-app-vX.Y.Z.deb`
- **Size**: ~XXX MB
- **SHA256**: `[checksum]`

**Quick Install**:
```bash
# Flash image to microSD card
xzcat escapeplan-base-vX.Y.Z.img.xz | sudo dd of=/dev/sdX bs=4M status=progress

# Or use Raspberry Pi Imager
```

---

## What's New

### New Features
- Feature 1 description
- Feature 2 description
- Feature 3 description

### Improvements
- Improvement 1
- Improvement 2
- Improvement 3

### Bug Fixes
- Fix for issue #XX
- Fix for issue #YY
- Fix for issue #ZZ

### Security Updates
- Security fix 1
- Security fix 2

---

## Breaking Changes

> **Important**: This section lists breaking changes that require action during upgrade.

- **Change 1**: Description and migration instructions
- **Change 2**: Description and migration instructions

---

## System Requirements

### Hardware
- Raspberry Pi 4B (4GB+ RAM) or Raspberry Pi 5
- 16GB+ microSD card (32GB+ recommended)
- 5V/3A power supply

### Network
- WiFi or Ethernet connection
- No internet required (offline-first)

### Client Devices
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

---

## Installation

### New Installation

1. **Download the base OS image** (above)
2. **Flash to microSD card** using Raspberry Pi Imager or `dd`
3. **Insert card and power on** Raspberry Pi
4. **Connect to WiFi**: SSID `EscapePlan`, password `escapeplan2024`
5. **Open browser**: Navigate to `https://10.10.10.1`
6. **Complete setup wizard**: Create your first account

See [Installation Guide](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/INSTALLATION.md) for detailed instructions.

### Upgrading from Previous Version

**Important**: Always backup your database before upgrading!

```bash
# Backup database
sudo /opt/escapeplan/scripts/backup.sh

# Download new package
wget https://github.com/kryptobaseddev/escapeplan/releases/download/vX.Y.Z/escapeplan-app-vX.Y.Z.deb

# Verify checksum
sha256sum escapeplan-app-vX.Y.Z.deb

# Install upgrade
sudo dpkg -i escapeplan-app-vX.Y.Z.deb

# Restart services
sudo systemctl restart escapeplan-api escapeplan-web
```

See [Upgrade Guide](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/UPGRADE.md) for detailed upgrade instructions.

---

## Verification

### Verify Download Integrity

```bash
# Check SHA256 sum
sha256sum -c escapeplan-base-vX.Y.Z.img.xz.sha256
sha256sum -c escapeplan-app-vX.Y.Z.deb.sha256
```

### Verify Installation

```bash
# Check installed version
dpkg -l | grep escapeplan-app

# Check service status
sudo systemctl status escapeplan-api
sudo systemctl status escapeplan-web

# Test API
curl -k https://localhost/api/health
```

---

## Known Issues

- Issue 1: Description and workaround
- Issue 2: Description and workaround
- Issue 3: Description and workaround

See [GitHub Issues](https://github.com/kryptobaseddev/escapeplan/issues) for complete list.

---

## Documentation

- [README](https://github.com/kryptobaseddev/escapeplan/blob/main/README.md) - Project overview
- [Installation Guide](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/INSTALLATION.md) - Setup instructions
- [Quick Start](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/QUICKSTART.md) - 5-minute setup
- [Upgrade Guide](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/UPGRADE.md) - Upgrade instructions
- [Troubleshooting](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/TROUBLESHOOTING.md) - Common issues
- [Security Guide](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/SECURITY.md) - Security best practices
- [Changelog](https://github.com/kryptobaseddev/escapeplan/blob/main/CHANGELOG.md) - Complete version history

---

## Technical Details

### Component Versions

**Base OS Image**:
- Debian 12 Bookworm (Raspberry Pi OS Lite)
- PostgreSQL 15.X
- nginx 1.22.X
- Node.js 20.X LTS
- NetworkManager 1.42.X

**Application**:
- EscapePlan API vX.Y.Z (Node.js/Fastify)
- EscapePlan Web vX.Y.Z (React/TypeScript)
- Drizzle ORM 0.XX.X
- React 18.X.X

### Database Schema

**Schema Version**: vX.Y.Z

Database migrations included:
- Migration 1: Description
- Migration 2: Description
- Migration 3: Description

Migrations run automatically during package installation.

### API Changes

**New Endpoints**:
- `GET /api/v1/endpoint1` - Description
- `POST /api/v1/endpoint2` - Description

**Modified Endpoints**:
- `PUT /api/v1/endpoint3` - Changes description

**Deprecated Endpoints**:
- `DELETE /api/v1/old-endpoint` - Use `/api/v1/new-endpoint` instead

---

## Security

### Security Fixes in This Release

- **CVE-YYYY-XXXXX**: Description and impact
- **Security Issue #XX**: Description and fix

### Security Notes

- All HTTP traffic redirected to HTTPS
- Self-signed certificate generated on first boot
- JWT token authentication for API
- bcrypt password hashing (cost factor 12)
- Rate limiting enabled

See [Security Guide](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/SECURITY.md) for comprehensive security information.

---

## Performance

### Performance Improvements

- Improvement 1: X% faster
- Improvement 2: X% less memory
- Improvement 3: X% smaller bundle size

### Benchmarks (Raspberry Pi 4B 4GB)

- API response time: XX ms average
- Database query time: XX ms average
- Web page load time: X.X seconds
- Memory usage: XXX MB typical
- CPU usage: XX% idle, XX% under load

---

## Testing

This release has been tested on:

- Raspberry Pi 4B (2GB, 4GB, 8GB)
- Raspberry Pi 5 (4GB, 8GB)
- Various microSD cards (SanDisk, Samsung, Kingston)
- Client browsers (Chrome, Firefox, Safari, Edge)
- Multiple network configurations

**Test Coverage**:
- Unit tests: XX% coverage
- Integration tests: XX% coverage
- End-to-end tests: XX scenarios

---

## Credits

### Contributors

Thanks to all contributors for this release:
- @contributor1 - Feature/fix description
- @contributor2 - Feature/fix description

### Dependencies

This release uses these open-source projects:
- React, Node.js, PostgreSQL, nginx, Debian

---

## Support

### Getting Help

- **Documentation**: Check [docs/](https://github.com/kryptobaseddev/escapeplan/tree/main/docs) directory
- **Troubleshooting**: See [TROUBLESHOOTING.md](https://github.com/kryptobaseddev/escapeplan/blob/main/docs/TROUBLESHOOTING.md)
- **Discussions**: Use [GitHub Discussions](https://github.com/kryptobaseddev/escapeplan/discussions)
- **Issues**: Report bugs via [GitHub Issues](https://github.com/kryptobaseddev/escapeplan/issues)

### Reporting Issues

When reporting issues, please include:
- EscapePlan version (`dpkg -l | grep escapeplan`)
- Raspberry Pi model and RAM
- Error messages and logs
- Steps to reproduce

---

## Roadmap

### Upcoming Features (vX.Y+1.0)

- Feature 1 planned
- Feature 2 planned
- Feature 3 planned

See [GitHub Milestones](https://github.com/kryptobaseddev/escapeplan/milestones) for complete roadmap.

---

## License

Proprietary License - Binary distributions for licensed customers only.

Copyright (c) 2024-2025 EscapePlan Platform Team. All rights reserved.

See [LICENSE](https://github.com/kryptobaseddev/escapeplan/blob/main/LICENSE) for full terms.

---

## Checksums

### SHA256 Checksums

```
[checksum]  escapeplan-base-vX.Y.Z.img.xz
[checksum]  escapeplan-app-vX.Y.Z.deb
```

### Verify Checksums

```bash
# Linux/macOS
sha256sum -c checksums.txt

# Windows (PowerShell)
Get-FileHash escapeplan-base-vX.Y.Z.img.xz -Algorithm SHA256
Get-FileHash escapeplan-app-vX.Y.Z.deb -Algorithm SHA256
```

---

**Questions?** Join the discussion in [GitHub Discussions](https://github.com/kryptobaseddev/escapeplan/discussions)

**Found a Bug?** Report it in [GitHub Issues](https://github.com/kryptobaseddev/escapeplan/issues)
