---
"escapeplan-api": patch
"escapeplan-web": patch
"@escapeplan/contracts": patch
---

Migrate from hostapd/dnsmasq to NetworkManager for dual WiFi management

Replaced hostapd and dnsmasq with NetworkManager-only architecture for managing both wlan0 (AP mode) and wlan1 (client mode). This simplifies configuration, eliminates service conflicts, and enables dynamic network control via the web UI.

**Key Changes:**
- Removed hostapd and dnsmasq service dependencies from all scripts
- Updated pi-post-install.sh to configure NetworkManager AP with `nmcli`
- NetworkManager's `ipv4.method=shared` handles DHCP/DNS automatically
- Platform API now returns `apConnection` status instead of `hostapd`/`dnsmasq`
- Contracts interface updated: removed `hostapd`/`dnsmasq` fields, added `apConnection`

**Migration Notes:**
- Existing Pi installations need NAT rule: `iptables -t nat -A POSTROUTING -s 10.10.10.0/24 -j MASQUERADE`
- Old hostapd/dnsmasq configs will be ignored (safe to leave in place)
- NetworkManager connection name: `escapeplan-ap`

**Breaking Changes:**
- `ApplyNetworkConfigResponse.services.hostapd` removed
- `ApplyNetworkConfigResponse.services.dnsmasq` removed
- `ApplyNetworkConfigResponse.services.apConnection` added
