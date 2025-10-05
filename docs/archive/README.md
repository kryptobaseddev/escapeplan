# Archived Documentation

This directory contains **old and superseded documentation** that has been replaced by the canonical guides in the root of the repository.

## Archived Files

### RASPBERRY_PI_INSTALLATION_OLD.md
- **Replaced by:** `/INSTALLATION.md` (root)
- **Reason:** Too complex and detailed for end users
- **Date Archived:** 2025-10-05

### RASPBERRY_PI_SETUP_REQUIREMENTS.md
- **Replaced by:** `/INSTALLATION.md` (root)
- **Reason:** Developer-focused system requirements, now integrated into simpler user guide
- **Date Archived:** 2025-10-05

### SETUP_SUMMARY.md
- **Replaced by:** `/INSTALLATION.md` (root)
- **Reason:** Outdated summary, replaced by 4-step canonical guide
- **Date Archived:** 2025-10-05

## Why These Were Archived

The original documentation was:
- **Too complex** - Multiple overlapping guides created confusion
- **Too technical** - Assumed advanced Linux knowledge
- **Not user-friendly** - No clear step-by-step process
- **Conflicting information** - Different instructions in different files

## Current Documentation Structure

### User-Facing (Installation & Usage)
- **`/INSTALLATION.md`** - Canonical 4-step installation guide (START HERE)

### Developer-Facing (Technical Specs)
- **`apps/DOCS/NETWORK_WIFI_SYSTEM.md`** - WiFi architecture and API implementation
- **`apps/DOCS/DATABASE_SYSTEM.md`** - Database schema and RBAC system
- **`apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md`** - API contracts and schema changes
- **`CLAUDE.md`** - Development workflow and common commands

### Reference
- **`DEB-PACKAGE-FIXES.md`** - Known issues and fixes for .deb packaging
- **`TEST_VALIDATION_REPORT.md`** - Test suite status and validation

## Using Archived Documentation

These files are kept for **historical reference only**. They may contain:
- ✅ Useful background information
- ✅ Detailed system requirements
- ⚠️ **Outdated instructions** - Do not follow installation steps
- ⚠️ **Conflicting information** - Defer to current docs

**Always use `/INSTALLATION.md` for actual installation.**
