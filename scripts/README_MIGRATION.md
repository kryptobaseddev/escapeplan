# Database Migration - NULL Config Fixes

Quick access guide for the database migration to fix NULL values in the games table.

---

## Files in This Directory

### Migration Scripts
- **fix-null-configs.ts** - Primary TypeScript script using Drizzle ORM (RECOMMENDED)
- **fix-null-configs.sh** - Bash alternative with SQLite commands
- **fix-null-configs.sql** - Raw SQL for manual execution

### Deployment
- **DEPLOY_PRODUCTION.sh** - Automated production deployment script

### Documentation
- **DATABASE_MIGRATION_REPORT_20251006.md** - Full migration report (11KB)
- **MIGRATION_SUMMARY.md** - Quick summary (4KB)
- **QA_TEST_RESULTS.md** - Test results and validation (7KB)
- **README_MIGRATION.md** - This file

---

## Quick Start

### For Development
```bash
cd /mnt/projects/escape-plan/escapeplan-app
pnpm tsx scripts/fix-null-configs.ts --db=./apps/escapeplan-api/data/escapeplan.db
```

### For Production (Automated)
```bash
cd /mnt/projects/escape-plan/escapeplan-app/scripts
./DEPLOY_PRODUCTION.sh
```

### For Production (Manual)
```bash
# SSH to production
ssh escapeplan@10.0.10.138

# Run migration
cd /opt/escapeplan/api
pnpm tsx scripts/fix-null-configs.ts --db=/var/lib/escapeplan/escapeplan.db

# Restart service
sudo systemctl restart escapeplan-api
```

---

## What This Fixes

**Problem:** Pirate Mutiny game has NULL values in:
- `pricing_config` - Required for pricing calculations
- `media_config` - Required for media gallery
- `booking_rules_config` - Required for booking workflow

**Solution:** Replace NULL with valid JSON defaults

---

## Status

✅ **Development Testing:** COMPLETE (100% pass rate)
✅ **QA Validation:** COMPLETE (All tests passed)
✅ **Production Ready:** YES
⏳ **Production Deployment:** PENDING

---

## Key Features

- ✅ Automatic database backup before changes
- ✅ JSON validation before and after
- ✅ Rollback capability
- ✅ User confirmation prompt
- ✅ Detailed logging
- ✅ Zero data loss risk

---

## Risk Level: LOW

- Tested in development environment
- Automatic backup creation
- JSON validation
- Rollback procedure available
- < 5 minute downtime
- No schema changes required

---

## Documentation

| Document | Purpose | Size |
|----------|---------|------|
| DATABASE_MIGRATION_REPORT_20251006.md | Comprehensive report | 11KB |
| MIGRATION_SUMMARY.md | Quick summary | 4KB |
| QA_TEST_RESULTS.md | Test results | 7KB |
| README_MIGRATION.md | This guide | 2KB |

---

## Support

**Issue:** NULL configs in games table
**Game:** Pirate Mutiny (pirate-mutiny)
**Production Server:** 10.0.10.138
**Database:** /var/lib/escapeplan/escapeplan.db
**Backup Location:** /var/lib/escapeplan/backups/

---

## Quick Commands

```bash
# Check for NULL values
sqlite3 /var/lib/escapeplan/escapeplan.db "
SELECT slug,
  CASE WHEN pricing_config IS NULL THEN 'NULL' ELSE 'OK' END,
  CASE WHEN media_config IS NULL THEN 'NULL' ELSE 'OK' END,
  CASE WHEN booking_rules_config IS NULL THEN 'NULL' ELSE 'OK' END
FROM games WHERE slug='pirate-mutiny';
"

# Verify API is running
sudo systemctl status escapeplan-api

# Check API logs
sudo journalctl -u escapeplan-api -f

# Test API endpoint
curl http://localhost:4000/api/admin/games/431402af-463f-4173-b9a9-1b8d48efd273
```

---

**For detailed information, see:**
- Full report: `DATABASE_MIGRATION_REPORT_20251006.md`
- Quick summary: `MIGRATION_SUMMARY.md`
- Test results: `QA_TEST_RESULTS.md`
