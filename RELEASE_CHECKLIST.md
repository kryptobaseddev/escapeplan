# EscapePlan Release Checklist

Version: ___________
Release Date: ___________
Release Manager: ___________

---

## Pre-Release (Before Build)

### Code Quality
- [ ] All tests pass (run `pnpm test`)
- [ ] Test count verified: 173/173 tests passing
- [ ] TypeScript builds without errors (`pnpm lint`)
- [ ] No console errors in development mode
- [ ] All lint warnings addressed or documented

### Documentation
- [ ] VERSION_MANIFEST.json updated with new version
- [ ] CHANGELOG.md updated with release notes
- [ ] Breaking changes documented (if any)
- [ ] API changes documented in contracts
- [ ] README.md updated if needed

### Versioning
- [ ] Version bumped in `package.json` (root)
- [ ] Version bumped in `apps/escapeplan-api/package.json`
- [ ] Version bumped in `apps/escapeplan-web/package.json`
- [ ] Version synchronized between escapeplan-base and escapeplan-app
- [ ] Git tag created: `v<version>`

---

## Build Phase

### Application Build
- [ ] Frontend builds without errors (`pnpm --filter escapeplan-web build`)
- [ ] Backend builds without errors (`pnpm --filter escapeplan-api build`)
- [ ] Production build tested locally (`pnpm build`)
- [ ] Build artifacts verified in `dist/` directories

### Package Build
- [ ] .deb package builds successfully
- [ ] .deb package checksum generated (SHA256)
- [ ] Package metadata correct (version, dependencies, architecture)
- [ ] Package size reasonable (<100MB)
- [ ] Package installs on clean Raspberry Pi OS

### OS Image Build (escapeplan-base)
- [ ] OS image builds successfully via pi-gen
- [ ] OS image checksum generated (SHA256)
- [ ] Image file named correctly: `YYYY-MM-DD-escapeplan-os-lite.img.xz`
- [ ] Image size reasonable (<2GB compressed)

---

## Integration Testing

### Local Development Testing
- [ ] Secrets auto-generated on first run
- [ ] Database migrations apply successfully
- [ ] Login works with test credentials
- [ ] Dashboard loads and displays data
- [ ] Game creation works
- [ ] Session start/stop works
- [ ] Timer counts down correctly
- [ ] WebSocket connects and updates real-time

### New Features (v0.2.0)
- [ ] WiFi external adapter detection works
- [ ] WiFi network scanning returns results
- [ ] WiFi connection succeeds with valid credentials
- [ ] WiFi disconnection works
- [ ] Internet sharing enabled after WiFi connection
- [ ] Clients on AP can access internet via external WiFi
- [ ] WiFi UI conditionally shows based on adapter presence

### API Endpoints
- [ ] `/admin/network/wifi/detect` returns interface list
- [ ] `/admin/network/scan` returns available networks
- [ ] `/admin/network/client` (GET) returns connection status
- [ ] `/admin/network/client` (POST) connects to network
- [ ] `/admin/network/client` (DELETE) disconnects successfully
- [ ] All endpoints require proper authentication
- [ ] All endpoints enforce permission checks

### User Interface
- [ ] NetworkTab shows WiFi section when adapter present
- [ ] NetworkTab hides WiFi section when no adapter
- [ ] WiFi scan button triggers scan
- [ ] Network list displays with signal strength
- [ ] Connection modal shows for secured networks
- [ ] Connection status updates after connect/disconnect
- [ ] No console errors in browser

---

## Production Deployment Test (On Raspberry Pi)

### Prerequisites
- [ ] Raspberry Pi 4 (4GB+ RAM) available for testing
- [ ] SD card (32GB+) ready
- [ ] USB WiFi adapter available (for external WiFi testing)

### OS Image Deployment
- [ ] Flash OS image to SD card using Raspberry Pi Imager
- [ ] Pi boots successfully
- [ ] WiFi AP (SSID: EscapePlan) comes up
- [ ] Access via `https://escapeplan.local` works
- [ ] Self-signed certificate warning expected (normal)

### App Installation
- [ ] Copy .deb package to Pi
- [ ] Install: `sudo dpkg -i escapeplan-app_<version>_arm64.deb`
- [ ] Services start without errors
  - `sudo systemctl status escapeplan-api`
  - `sudo systemctl status escapeplan-web`
- [ ] Check logs: `journalctl -u escapeplan-api -n 50 --no-pager`
- [ ] No critical errors in logs

### Functional Testing on Pi
- [ ] Secrets auto-generated: `ls -la /etc/escapeplan/secrets/`
- [ ] Database created: `ls -la /var/lib/escapeplan/escapeplan.db`
- [ ] WebSocket connects from browser
- [ ] All CRUD operations work (games, users, sessions)
- [ ] Timer updates in real-time
- [ ] Logs UI displays system logs correctly

### WiFi Testing (if USB adapter present)
- [ ] Plug in USB WiFi adapter (wlan1 appears)
- [ ] Navigate to Admin → System → Network tab
- [ ] WiFi section visible
- [ ] Click "Scan Networks"
- [ ] Network list appears
- [ ] Connect to a test network
- [ ] Connection succeeds
- [ ] IP address displayed in status
- [ ] Ping 8.8.8.8 from Pi succeeds
- [ ] Client device connected to EscapePlan AP can access internet
- [ ] Disconnect works

### Performance Testing
- [ ] Dashboard loads in <2 seconds
- [ ] WebSocket latency <100ms
- [ ] Timer updates smooth (no lag)
- [ ] Memory usage stable (<500MB)
- [ ] CPU usage reasonable (<50% idle)

---

## GitHub Release

### Release Preparation
- [ ] Run release script: `./scripts/create-release.sh <version>`
- [ ] Release created as draft on GitHub
- [ ] .deb package attached to release
- [ ] OS image download link added (from escapeplan-base repo)
- [ ] Release notes comprehensive and clear
- [ ] Screenshots included (optional but recommended)

### Release Notes Content
- [ ] Version number prominent
- [ ] Release date included
- [ ] New features listed
- [ ] Bug fixes listed (if any)
- [ ] Breaking changes highlighted (if any)
- [ ] Installation instructions clear
- [ ] Upgrade path documented
- [ ] Known issues listed (if any)

### Final Checks
- [ ] All assets uploaded correctly
- [ ] Download links work
- [ ] Release is marked as "Latest"
- [ ] Pre-release flag set correctly (if beta)
- [ ] Release published (not draft)

### Post-Release
- [ ] Git tag pushed: `git push origin v<version>`
- [ ] Announcement prepared (if applicable)
- [ ] Documentation site updated (if exists)
- [ ] escapeplan-base repo release synchronized

---

## Communication

### Internal
- [ ] Team notified of release
- [ ] Known issues communicated
- [ ] Support team briefed on new features

### External (if applicable)
- [ ] Release announcement drafted
- [ ] Users notified of update availability
- [ ] Migration guide created (if breaking changes)

---

## Rollback Plan

### Emergency Rollback Procedure
- [ ] Previous version .deb package available
- [ ] Previous OS image available
- [ ] Database backup procedure documented
- [ ] Rollback tested in dev environment

### Rollback Steps (if needed)
1. Stop services: `sudo systemctl stop escapeplan-api escapeplan-web`
2. Backup current database: `sudo cp /var/lib/escapeplan/escapeplan.db /tmp/escapeplan.db.backup`
3. Install previous .deb: `sudo dpkg -i escapeplan-app_<prev-version>_arm64.deb`
4. Start services: `sudo systemctl start escapeplan-api escapeplan-web`
5. Verify functionality
6. Document issues that caused rollback

---

## Sign-Off

### Release Manager
- [ ] All checklist items completed
- [ ] Release ready for production
- [ ] No critical issues identified

**Signature:** ___________
**Date:** ___________

### QA Lead
- [ ] All tests passing
- [ ] Integration testing complete
- [ ] Production deployment validated

**Signature:** ___________
**Date:** ___________

---

## Notes

Use this section to document any issues, deviations, or special considerations for this release:

```
(Add notes here)
```

---

**Release Status:** ⬜ Draft | ⬜ Ready | ⬜ Published | ⬜ Rolled Back

**Final Approval Date:** ___________
