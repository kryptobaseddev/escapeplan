# Phase 2 - System Package Installation Audit

**Agent**: 78
**Phase**: 2 Wave 1
**Date**: 2025-10-06
**Task**: Audit all system package installations (apt-get, apt install, dpkg)

---

## Executive Summary

**Total apt-get Instances**: 19
**Total apt install Instances**: 0
**Total dpkg Instances**: 10 (9 non-build related)
**Files Affected**: 7 active scripts + 2 backup/documentation files
**Removal Priority**: High (Phase 1 BASE-APP-OPTIMIZATION requirement)

---

## Detailed Findings

### 1. apt-get Instances (19 total)

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/validate-dependencies.sh`
**Category**: Dependency Validation Script
**Instances**: 4

| Line | Type | Code |
|------|------|------|
| 223 | Info Message | `log_info "  sudo apt-get update"` |
| 224 | Info Message | `log_info "  sudo apt-get install -y ${missing_packages[*]}"` |
| 257 | System Call | `if ! apt-get update -qq 2>&1 \| tee -a "${LOG_FILE}"; then` |
| 264 | System Call | `if ! apt-get install -y "${packages[@]}" 2>&1 \| tee -a "${LOG_FILE}"; then` |

**Action Required**: Remove lines 257 and 264 (actual system calls). Update info messages at 223-224.

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/pi-post-install.sh`
**Category**: Post-Installation Script
**Instances**: 6

| Line | Type | Code |
|------|------|------|
| 225 | Info Message | `log "Install with: sudo apt-get install -y build-essential python3"` |
| 280 | System Call | `if timeout 300 apt-get update -qq >> "${LOG_FILE}" 2>&1; then` |
| 285 | Error Message | `log_error "apt-get update timed out after 300 seconds"` |
| 328 | System Call | `if timeout 600 env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${packages_to_install[@]}" >> "${LOG_FILE}" 2>&1; then` |
| 333 | Error Message | `log_error "apt-get install timed out after 600 seconds"` |
| 358 | Warning Message | `log_warning "  sudo apt-get install -y nodejs"` |

**Action Required**: Remove lines 280 and 328 (actual system calls). Update messages at 225, 285, 333, 358.

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/postinst-orchestrator.sh`
**Category**: Orchestrator Script
**Instances**: 2

| Line | Type | Code |
|------|------|------|
| 132 | System Call | `if ! retry_command "APT package index update" apt-get update -qq; then` |
| 141 | System Call | `env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \` |

**Action Required**: Remove lines 132-141 (complete package installation block).

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/build-deb.sh`
**Category**: Build Script
**Instances**: 1

| Line | Type | Code |
|------|------|------|
| 1117 | Info Message | `echo "  sudo apt-get install --reinstall escapeplan" >&2` |

**Action Required**: Update message - this is informational only.

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/tests/test-arm64-emulated.sh`
**Category**: Test Script
**Instances**: 3

| Line | Type | Code |
|------|------|------|
| 182 | Info Message | `log_info "  - QEMU: sudo apt-get install -y qemu-user-static"` |
| 276 | System Call | `apt-get update -qq &&` |
| 277 | System Call | `apt-get install -y -qq \` |

**Action Required**: Remove lines 276-277 (actual system calls in Docker test environment). Update message at 182.

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/build-deb.sh.backup`
**Category**: Backup File (Inactive)
**Instances**: 3

| Line | Type | Code |
|------|------|------|
| 402 | System Call | `apt-get update -qq` |
| 403 | System Call | `DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \` |
| 494 | Info Message | `echo "[postinst]   sudo apt-get install -y build-essential python3"` |

**Action Required**: None - this is a backup file. Consider deletion during cleanup phase.

---

### 2. apt install Instances (0 total)

No instances of `apt install` found. All package management uses `apt-get`.

---

### 3. dpkg Instances (10 total)

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/postinst-orchestrator.sh`
**Category**: Orchestrator Script
**Instances**: 4

| Line | Type | Code | Purpose |
|------|------|------|---------|
| 122 | Comment | `# Step 1: Install system packages (skip if dpkg is locked)` | Documentation |
| 125 | System Call | `if fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; then` | Lock detection |
| 126 | Info Message | `log_warning "dpkg lock detected - skipping package installation"` | User feedback |
| 145 | Info Message | `log_warning "They may already be installed - verify with: dpkg -l \| grep <package-name>"` | User guidance |
| 160 | Error Message | `log_error "Reinstall package: sudo dpkg -i --force-all escapeplan_*.deb"` | Recovery guidance |

**Action Required**: Remove lock detection (line 125) as part of package installation removal. Update messages.

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/build-deb.sh`
**Category**: Build Script
**Instances**: 1

| Line | Type | Code | Purpose |
|------|------|------|---------|
| 1338 | System Call | `dpkg-deb --build "${BUILD_DIR}" "${DEB_FILE}"` | Package building |

**Action Required**: KEEP - This is legitimate package building, not installation.

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/pi-post-install.sh`
**Category**: Post-Installation Script
**Instances**: 1

| Line | Type | Code | Purpose |
|------|------|------|---------|
| 312 | System Call | `if dpkg -l \| grep -qw "^ii.*${package}"; then` | Package verification |

**Action Required**: Remove - part of package installation verification logic.

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/tests/test-arm64-emulated.sh`
**Category**: Test Script
**Instances**: 1

| Line | Type | Code | Purpose |
|------|------|------|---------|
| 297 | System Call | `dpkg -i /workspace/${DEB_PATH} 2>&1 \|\| true` | Test installation |

**Action Required**: EVALUATE - This is test infrastructure. May need to remain for testing.

---

#### File: `/mnt/projects/escape-plan/escapeplan-app/scripts/build-deb.sh.backup`
**Category**: Backup File (Inactive)
**Instances**: 1

| Line | Type | Code | Purpose |
|------|------|------|---------|
| 527 | System Call | `dpkg-deb --build "${BUILD_DIR}" "${DEB_FILE}"` | Package building |

**Action Required**: None - backup file.

---

#### Files: Documentation/Reference (2 instances)
- `/mnt/projects/escape-plan/escapeplan-app/scripts/HEALTH_CHECK_QUICKREF.md` (lines 77, 81)
- `/mnt/projects/escape-plan/escapeplan-app/scripts/tests/HEALTH_CHECK_REPORT.md` (line 138)

**Action Required**: Update documentation to reflect new approach (no system package installations).

---

## Categorization by Script

### Active Scripts Requiring Changes (5)

1. **postinst-orchestrator.sh** - 2 apt-get + 4 dpkg (6 total)
   - Lines: 122-160 (entire package installation section)
   - Priority: CRITICAL - Main orchestrator

2. **pi-post-install.sh** - 6 apt-get + 1 dpkg (7 total)
   - Lines: 225, 280-285, 312, 328-333, 358
   - Priority: CRITICAL - Post-install logic

3. **validate-dependencies.sh** - 4 apt-get (4 total)
   - Lines: 223-224, 257, 264
   - Priority: HIGH - Dependency validation

4. **build-deb.sh** - 1 apt-get + 1 dpkg (2 total, 1 to keep)
   - Line 1117: Update message
   - Line 1338: KEEP (dpkg-deb for building)
   - Priority: LOW - Mostly informational

5. **test-arm64-emulated.sh** - 3 apt-get + 1 dpkg (4 total)
   - Lines: 182, 276-277, 297
   - Priority: MEDIUM - Test infrastructure

### Inactive Files (2)

6. **build-deb.sh.backup** - 3 apt-get + 1 dpkg (4 total)
   - Consider deletion in cleanup phase

7. **Documentation files** (2)
   - Update to reflect new approach

---

## Removal Line Ranges

### Critical Removals (System Calls)

| File | Lines | Type | Notes |
|------|-------|------|-------|
| postinst-orchestrator.sh | 122-160 | Complete section | Package installation block |
| pi-post-install.sh | 280-290 | apt-get update | Update logic with timeout |
| pi-post-install.sh | 312-340 | apt-get install + dpkg | Installation and verification |
| validate-dependencies.sh | 257-260 | apt-get update | Update call |
| validate-dependencies.sh | 264-270 | apt-get install | Package installation |
| test-arm64-emulated.sh | 276-277 | apt-get calls | Docker test setup |

### Message Updates (Informational)

| File | Lines | Type | Notes |
|------|-------|------|-------|
| postinst-orchestrator.sh | 125-126, 145, 160 | Messages | Update guidance messages |
| pi-post-install.sh | 225, 285, 333, 358 | Messages | Update error/info messages |
| validate-dependencies.sh | 223-224 | Messages | Update info messages |
| build-deb.sh | 1117 | Message | Update reinstall message |
| test-arm64-emulated.sh | 182 | Message | Update QEMU info message |

---

## QA Checklist

- [x] All grep searches complete (apt-get, apt install, dpkg)
- [x] All locations documented with file:line
- [x] Files categorized by script type
- [x] Line numbers accurate and verified
- [x] System calls vs messages differentiated
- [x] Build commands (dpkg-deb) identified as KEEP
- [x] Test infrastructure evaluated separately
- [x] Removal priorities assigned

---

## Recommendations for Phase 2

1. **Immediate Actions**:
   - Remove all apt-get system calls from active scripts
   - Remove dpkg lock detection and package verification
   - Update all user-facing messages to reflect new approach

2. **Preserve**:
   - dpkg-deb commands in build-deb.sh (line 1338)
   - Evaluate test-arm64-emulated.sh dpkg usage separately

3. **Follow-up**:
   - Delete build-deb.sh.backup in cleanup phase
   - Update documentation files
   - Create dependency management documentation for users

4. **Testing Required**:
   - Verify postinst-orchestrator.sh works without package installation
   - Verify pi-post-install.sh handles missing dependencies gracefully
   - Ensure build process still works with dpkg-deb

---

## Acceptance Criteria Status

- [x] Grep searches complete
- [x] All instances documented
- [x] Files categorized
- [x] Line numbers provided
- [x] Audit saved to `.orchestrator/phase2-apt-get-audit.md`

---

**Report Complete**: Ready for Phase 2 removal agents.
