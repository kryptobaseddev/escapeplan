---
"escapeplan": patch
---

refactor: remove NetworkManager AP configuration from application layer (BASE-APP-OPTIMIZATION Phase 2)

Remove NetworkManager WiFi Access Point setup from application scripts. WiFi AP configuration is now exclusively managed by the base OS (escapeplan-base >= 1.0.0).

**BREAKING CHANGE**: Application no longer creates or configures the WiFi Access Point. The base OS must provide a pre-configured NetworkManager connection named "escapeplan-ap" with SSID "EscapePlan" on the 10.10.10.0/24 network.

**Changes:**
- `scripts/pi-post-install.sh`: Removed `setup_networkmanager_ap()` function entirely (94 lines)
- `scripts/pi-post-install.sh`: Added optional `verify_wifi_ap()` function (non-fatal check)
- Added warning if NetworkManager AP connection "escapeplan-ap" is not found
- Installation proceeds even if WiFi AP is not configured (allows testing without network)
- Updated script header documentation to reflect new focused scope

**Benefits:**
- Prevents NetworkManager configuration conflicts during package upgrades
- Allows base OS to manage network topology independently
- Enables different network configurations without application changes
- Reduces application installation time by ~30 seconds
- Follows principle of single responsibility

**WiFi AP Verification:**
- Application checks for `nmcli connection show escapeplan-ap`
- Logs non-fatal warning if not found
- Continues installation to allow testing scenarios
- Base OS is responsible for ensuring AP exists in production

**Migration Guide:**
1. Ensure base OS provides NetworkManager AP configuration before upgrading
2. Verify AP connection exists: `nmcli connection show escapeplan-ap`
3. If manually configuring, ensure SSID="EscapePlan" and IP=10.10.10.1/24
4. Application will work without AP but escapeplan.local mDNS may not resolve

**Refs:** BASE-APP-OPTIMIZATION.md Phase 2
**Depends:** escapeplan-base (>= 1.0.0) with NetworkManager AP pre-configured
