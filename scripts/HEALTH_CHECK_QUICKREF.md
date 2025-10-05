# Health Check Quick Reference

## Quick Start

```bash
# Run health check
sudo /opt/escapeplan/scripts/health-check.sh

# Run with verbose output
sudo /opt/escapeplan/scripts/health-check.sh --verbose
```

## What It Checks

1. **System User** - escapeplan user exists
2. **Node.js** - Node.js is installed
3. **Directories** - All required directories exist
4. **Permissions** - Correct ownership (escapeplan:escapeplan)
5. **Contracts** - Package dist files present
6. **Environment** - Secrets configured (not placeholders)
7. **Systemd** - Service files loaded
8. **API Service** - Enabled and running
9. **Web Service** - Enabled and running
10. **Database** - File exists and readable
11. **API Health** - HTTP endpoint responds (http://localhost:4000/api/health)
12. **Web Health** - HTTP endpoint responds (https://escapeplan.local/ or http://localhost:3000/)

## Exit Codes

- **0** = All checks passed
- **1** = One or more checks failed

## Common Issues & Fixes

### Services Not Running
```bash
sudo systemctl start escapeplan-api
sudo systemctl start escapeplan-web
```

### Missing Environment File
```bash
sudo cp /opt/escapeplan/api/.env.example /etc/escapeplan/api.env
sudo chown escapeplan:escapeplan /etc/escapeplan/api.env
sudo chmod 600 /etc/escapeplan/api.env
```

### Generate Secrets
```bash
# Better Auth Secret
openssl rand -base64 32

# Camera Encryption Key
openssl rand -hex 32
```

### Fix Permissions
```bash
sudo chown -R escapeplan:escapeplan /opt/escapeplan
sudo chown -R escapeplan:escapeplan /var/lib/escapeplan
sudo chown -R escapeplan:escapeplan /var/log/escapeplan
sudo chown -R escapeplan:escapeplan /etc/escapeplan
```

## Integration Points

- **Build Script:** `/mnt/projects/escape-plan/escapeplan-app/scripts/build-deb.sh`
- **Post-Install:** `/mnt/projects/escape-plan/escapeplan-app/build/deb/DEBIAN/postinst`
- **Test Suite:** `/mnt/projects/escape-plan/escapeplan-app/scripts/tests/test-health-check.sh`
- **Full Documentation:** `/mnt/projects/escape-plan/escapeplan-app/scripts/tests/HEALTH_CHECK_REPORT.md`

## Automatic Execution

The health check runs automatically after Debian package installation:

```bash
sudo dpkg -i escapeplan_*.deb
# Health check runs at the end
```

Failures are displayed but don't block installation (exit 0 to dpkg).
