---
"escapeplan": patch
---

refactor: remove user and directory creation from application package (BASE-APP-OPTIMIZATION Phase 3)

Remove system user and directory creation from application postinst script. The escapeplan user and directory structure are now exclusively managed by the base OS (escapeplan-base >= 1.0.0).

**BREAKING CHANGE**: Application package no longer creates the escapeplan system user or data directories (/var/lib/escapeplan, /var/log/escapeplan, /etc/escapeplan, /var/backups/escapeplan). The base OS must provide these before application installation.

**Changes:**
- `scripts/build-deb.sh` (DEBIAN/postinst template): Removed `useradd` commands for escapeplan user
- `scripts/build-deb.sh` (DEBIAN/postinst template): Removed `mkdir -p` commands for data directories
- `scripts/build-deb.sh` (DEBIAN/postinst template): Added verification checks for user existence
- `scripts/build-deb.sh` (DEBIAN/postinst template): Added verification checks for all required directories
- Fail fast with clear error if user or directories are missing
- Kept `chown` commands to set ownership on /opt/escapeplan (required for .deb extraction)

**Required Directories (must exist before install):**
- `/var/lib/escapeplan` - Database and application data
- `/var/log/escapeplan` - Application logs
- `/etc/escapeplan` - Configuration files (api.env, secrets)
- `/var/backups/escapeplan` - Database backups
- `/opt/escapeplan` - Application installation (created by .deb)

**Required User (must exist before install):**
- `escapeplan` system user with nologin shell
- Member of appropriate groups (www-data for nginx, etc.)
- Ownership of all data directories

**Benefits:**
- Prevents user/directory conflicts during package upgrades
- Allows base OS to manage permissions and SELinux contexts
- Enables atomic rollback at base OS level (directories persist across package versions)
- Follows Debian policy (system-level resources managed by platform)
- Clear separation of concerns (base OS = infrastructure, app = application)

**Error Messages:**
If prerequisites are missing, postinst will fail with clear guidance:
```
ERROR: System user 'escapeplan' does not exist
This package requires the EscapePlan base OS which provides system users
Please install on a system configured with the escapeplan-base image
```

**Migration Guide:**
1. Ensure base OS creates escapeplan user before upgrading
2. Ensure all required directories exist with correct ownership
3. Verify with: `id escapeplan && ls -ld /var/lib/escapeplan /var/log/escapeplan /etc/escapeplan /var/backups/escapeplan`
4. If manually creating, use: `useradd -r -s /bin/false escapeplan && mkdir -p /var/{lib,log}/escapeplan /etc/escapeplan /var/backups/escapeplan && chown -R escapeplan:escapeplan /var/{lib,log}/escapeplan /etc/escapeplan /var/backups/escapeplan`

**Refs:** BASE-APP-OPTIMIZATION.md Phase 3
**Depends:** escapeplan-base (>= 1.0.0) with escapeplan user and directories pre-created
