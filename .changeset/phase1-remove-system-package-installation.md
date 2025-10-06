---
"escapeplan": patch
---

refactor: remove system package installation from application layer (BASE-APP-OPTIMIZATION Phase 1)

Remove all apt-get/apt install commands from application postinst scripts. System packages are now exclusively managed by the base OS (escapeplan-base >= 1.0.0).

**BREAKING CHANGE**: Application package now requires escapeplan-base (>= 1.0.0) to be installed first. The application will no longer install system packages like nodejs, nginx, network-manager, or build-essential.

**Changes:**
- `scripts/postinst-orchestrator.sh`: Replaced package installation logic (lines 122-149) with base OS verification checks
- `scripts/pi-post-install.sh`: Removed `install_system_packages()` function entirely
- Added command existence checks for: gcc, g++, make, python3, node, npm, nginx, sqlite3, openssl
- Added clear error messages guiding users to install base OS first
- Fail fast if required commands are missing

**Benefits:**
- 2-5 minute faster installation (no redundant apt-get operations)
- Eliminates dpkg lock conflicts during package installation
- Follows Debian packaging best practices (separation of concerns)
- Clear separation of platform vs application responsibilities
- Prevents version conflicts between base OS and application expectations

**Migration Guide:**
1. Ensure escapeplan-base >= 1.0.0 is installed before upgrading application package
2. If installing on non-base OS system, manually install required packages first
3. Verify all required commands are available before installation

**Refs:** BASE-APP-OPTIMIZATION.md Phase 1
**Depends:** escapeplan-base (>= 1.0.0)
