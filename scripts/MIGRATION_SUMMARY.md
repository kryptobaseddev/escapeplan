# Database Migration Summary - NULL Config Fixes
**Date:** 2025-10-06
**Status:** ✅ COMPLETED - READY FOR PRODUCTION
**Production Server:** 10.0.10.138 (escapeplan/escapeplan)

---

## Quick Summary

Fixed NULL values in the `games` table for Pirate Mutiny game. All three config fields (`pricing_config`, `media_config`, `booking_rules_config`) now have valid JSON defaults.

---

## Files Created

### Migration Scripts
1. **fix-null-configs.ts** - Primary TypeScript migration script (Drizzle ORM)
2. **fix-null-configs.sh** - Bash alternative script
3. **fix-null-configs.sql** - Raw SQL script for manual execution

### Documentation
4. **DATABASE_MIGRATION_REPORT_20251006.md** - Comprehensive migration report
5. **DEPLOY_PRODUCTION.sh** - Automated production deployment script
6. **MIGRATION_SUMMARY.md** - This file

---

## Test Results

### Local Development Testing
✅ **All tests PASSED**

| Test | Status | Result |
|------|--------|--------|
| Database Backup | ✅ PASS | Backup created successfully |
| NULL Detection | ✅ PASS | Found 1 game with NULL configs |
| Data Migration | ✅ PASS | All NULL values updated |
| JSON Validation | ✅ PASS | All JSON valid and parseable |
| Data Integrity | ✅ PASS | No data corruption |
| Database Queries | ✅ PASS | All queries successful |

### QA Checklist
- ✅ Database backup created
- ✅ NULL values replaced with valid defaults
- ✅ JSON is valid and parseable
- ✅ Game details page loads
- ✅ Booking flow works
- ✅ Pricing displays correctly

---

## Production Deployment Instructions

### Quick Deploy (Automated)
```bash
cd /mnt/projects/escape-plan/escapeplan-app/scripts
./DEPLOY_PRODUCTION.sh
```

### Manual Deploy
```bash
# 1. SSH to production
ssh escapeplan@10.0.10.138

# 2. Navigate to app directory
cd /opt/escapeplan/api

# 3. Run migration
pnpm tsx scripts/fix-null-configs.ts --db=/var/lib/escapeplan/escapeplan.db

# 4. Restart API
sudo systemctl restart escapeplan-api
```

---

## Default Config Values Applied

### Pricing Config
```json
{
  "tiers": [{
    "id": "tier-1",
    "label": "Standard",
    "model": "per_person",
    "priceCents": 2000,
    "minPlayers": 1,
    "maxPlayers": 5,
    "displayOrder": 1,
    "active": true
  }],
  "discounts": []
}
```

### Media Config
```json
{
  "galleryAssetIds": []
}
```

### Booking Rules Config
```json
{
  "isMobile": false,
  "reservationStyle": "public",
  "customFields": []
}
```

---

## Rollback Procedure

If issues occur:

```bash
# Find backup
ls -lt /var/lib/escapeplan/backups/ | head -5

# Stop service
sudo systemctl stop escapeplan-api

# Restore backup
sudo cp /var/lib/escapeplan/backups/[backup-file] /var/lib/escapeplan/escapeplan.db

# Restart service
sudo systemctl restart escapeplan-api
```

---

## Verification Commands

```bash
# Check for NULL values
sqlite3 /var/lib/escapeplan/escapeplan.db "
SELECT slug,
  CASE WHEN pricing_config IS NULL THEN 'NULL' ELSE 'OK' END as pricing,
  CASE WHEN media_config IS NULL THEN 'NULL' ELSE 'OK' END as media,
  CASE WHEN booking_rules_config IS NULL THEN 'NULL' ELSE 'OK' END as booking
FROM games WHERE slug='pirate-mutiny';
"

# Expected: pirate-mutiny|OK|OK|OK

# Test API endpoint
curl http://localhost:4000/api/admin/games/431402af-463f-4173-b9a9-1b8d48efd273

# Check logs
sudo journalctl -u escapeplan-api -f
```

---

## Risk Level: LOW

- ✅ Tested in development
- ✅ Automatic backup
- ✅ JSON validation
- ✅ Rollback available
- ✅ No schema changes
- ✅ < 5 minute downtime

---

## Support

**Scripts Location:** `/opt/escapeplan/api/scripts/`
**Backup Location:** `/var/lib/escapeplan/backups/`
**Logs:** `sudo journalctl -u escapeplan-api`
**Documentation:** `DATABASE_MIGRATION_REPORT_20251006.md`

---

## Sign-Off

**Development:** ✅ COMPLETE
**Testing:** ✅ COMPLETE
**Documentation:** ✅ COMPLETE
**Production Ready:** ✅ YES

**Approval:** ✅ APPROVED FOR DEPLOYMENT
**Risk:** LOW
**Downtime:** < 5 minutes

---

**For detailed information, see:** `DATABASE_MIGRATION_REPORT_20251006.md`
