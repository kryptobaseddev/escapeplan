# Database Migration Runner Documentation

## Overview

The EscapePlan database migration runner is a standalone tool that applies Drizzle ORM migrations to the SQLite database. It is designed to be safe, idempotent, and resilient to failures with automatic backup and rollback capabilities.

## Location

- **Migration Runner**: `/mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api/src/db/migrate.ts`
- **Migrations Directory**: `/mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api/drizzle/`
- **Migration Journal**: `/mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api/drizzle/meta/_journal.json`

## Features

### 1. **Idempotent Execution**
- Safe to run multiple times
- Only applies new migrations that haven't been applied yet
- Tracks applied migrations in `__drizzle_migrations` table

### 2. **Automatic Backup**
- Creates backup before applying migrations (upgrade scenarios)
- Skips backup for fresh installs (no database exists)
- Backup location: `${DB_PATH}.pre-migration-backup`

### 3. **Rollback on Failure**
- Automatically restores database from backup if migration fails
- Ensures database is never left in inconsistent state
- Detailed error reporting for troubleshooting

### 4. **Migration Verification**
- Verifies all core tables exist after migration
- Checks migration tracking table
- Validates foreign keys and WAL mode are enabled
- Reports schema version from migration journal

### 5. **Comprehensive Error Handling**
- Pre-migration checks (migrations directory, journal, SQL files)
- Transaction safety with proper cleanup
- Detailed logging with emoji indicators (✅ ❌ ⚠️  ℹ️)

### 6. **Support for Both Fresh Install and Upgrade**
- **Fresh Install**: Creates database from scratch, applies all migrations
- **Upgrade**: Detects existing database, creates backup, applies pending migrations

## Usage

### Development

```bash
# Apply migrations
cd apps/escapeplan-api
pnpm db:migrate

# Verify migrations without applying
pnpm db:migrate:verify
```

### Production (Pi Post-Install)

The migration runner is automatically executed during package installation via `/scripts/pi-post-install.sh`:

```bash
# Run migration as escapeplan user
sudo -u escapeplan sh -c "cd /opt/escapeplan/api && node src/db/migrate.ts"
```

### Manual Execution

```bash
# As escapeplan user
sudo -u escapeplan node /opt/escapeplan/api/src/db/migrate.ts

# Verify only (read-only, no changes)
sudo -u escapeplan node /opt/escapeplan/api/src/db/migrate.ts --verify
```

## Exit Codes

- **0**: Success (migrations applied successfully)
- **1**: Migration failure (database rolled back)
- **2**: Verification failure (verify mode only)
- **3**: Pre-migration checks failed

## Migration Process Flow

### Fresh Install Scenario

```
1. Pre-migration checks
   ├── Verify migrations directory exists
   ├── Verify migration journal exists
   ├── Verify migration SQL files exist
   └── Ensure data directory exists

2. Skip backup (no database exists)

3. Open database connection
   ├── Create new database file
   ├── Enable WAL mode
   └── Enable foreign keys

4. Apply migrations
   ├── Read migration files from drizzle/
   ├── Execute SQL statements
   └── Record in __drizzle_migrations table

5. Verify migration success
   ├── Check core tables exist
   ├── Verify migration tracking table
   ├── Count applied migrations
   ├── Verify foreign keys enabled
   └── Verify WAL mode enabled

6. Report results
   ├── Number of migrations applied
   ├── Schema version
   └── Exit code 0 (success)
```

### Upgrade Scenario

```
1. Pre-migration checks
   (same as fresh install)

2. Create backup
   ├── Copy escapeplan.db -> escapeplan.db.pre-migration-backup
   ├── Copy escapeplan.db-wal (if exists)
   └── Copy escapeplan.db-shm (if exists)

3. Open database connection
   (existing database)

4. Check current state
   └── List currently applied migrations

5. Apply pending migrations
   ├── Compare journal with applied migrations
   ├── Execute new migrations only
   └── Update migration tracking table

6. Verify migration success
   (same as fresh install)

7. Cleanup backup
   └── Remove backup files on success

8. Report results
   ├── Number of migrations applied
   ├── Schema version
   └── Exit code 0 (success)
```

### Failure Scenario (Upgrade)

```
1-5. (same as upgrade scenario)

6. Migration fails
   └── Error during SQL execution

7. Rollback
   ├── Close database connection
   ├── Restore from backup
   │   ├── Copy .pre-migration-backup -> escapeplan.db
   │   ├── Restore WAL file (if exists)
   │   └── Restore SHM file (if exists)
   └── Verify restore succeeded

8. Report failure
   ├── Error message and stack trace
   ├── Backup location (for manual recovery)
   └── Exit code 1 (failure)
```

## Database Schema Tracking

### Migration Tracking Table

Drizzle creates a tracking table to record applied migrations:

```sql
CREATE TABLE __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  created_at INTEGER
);
```

Each migration is recorded with:
- `hash`: SHA-256 hash of migration SQL
- `created_at`: Unix timestamp of application

### Schema Version

The schema version is determined from the migration journal (`drizzle/meta/_journal.json`):

```json
{
  "version": "5",
  "dialect": "sqlite",
  "entries": [
    {
      "idx": 0,
      "version": "5",
      "when": 1234567890,
      "tag": "0000_perfect_jasper_sitwell",
      "breakpoints": false
    }
  ]
}
```

The `tag` of the latest entry is reported as the schema version.

## Error Handling

### Pre-Migration Checks

**Error**: Migrations directory not found
```
[Migration] ❌ Migrations directory not found: /path/to/drizzle
```
**Resolution**: Ensure the drizzle directory exists and is in the correct location.

**Error**: Migration journal not found
```
[Migration] ❌ Migration journal not found: /path/to/drizzle/meta/_journal.json
```
**Resolution**: Ensure migrations have been generated with `drizzle-kit generate`.

**Error**: No migration SQL files found
```
[Migration] ❌ No migration SQL files found in migrations directory
```
**Resolution**: Generate migrations with `drizzle-kit generate`.

### Backup Failures

**Error**: Failed to create backup
```
[Migration] ❌ Failed to create backup: EACCES: permission denied
```
**Resolution**: Ensure the escapeplan user has write permissions to the data directory.

### Migration Failures

**Error**: Migration verification failed
```
[Migration] ❌ Required table 'user' not found after migration
```
**Resolution**: Database is automatically rolled back. Check migration SQL files for errors.

**Error**: Rollback failed
```
[Migration] ❌ Rollback failed - database may be in inconsistent state
Manual recovery required using backup at: /path/to/backup
```
**Resolution**: Manually restore from backup:
```bash
sudo -u escapeplan cp /var/lib/escapeplan/escapeplan.db.pre-migration-backup /var/lib/escapeplan/escapeplan.db
```

## Integration with Post-Install Script

The migration runner is integrated into `/scripts/pi-post-install.sh` via the `initialize_database()` function:

```bash
initialize_database() {
    # Step 1: Run migrations (creates schema)
    run_database_migrations

    # Step 2: Seed database content (creates essential data)
    seed_database_content
}
```

### Separation of Concerns

**Migration Runner** (`migrate.ts`):
- Creates database schema
- Applies DDL changes (CREATE TABLE, ALTER TABLE, etc.)
- Manages migration tracking
- Handles backups and rollbacks

**Seed Script** (`seed.ts`):
- Inserts initial data (RBAC, admin user, settings)
- Idempotent (checks for existing data)
- Environment-aware (skips demo data in production)

## Verification Mode

The migration runner includes a read-only verification mode:

```bash
pnpm db:migrate:verify
```

This mode:
- Opens database in read-only mode
- Verifies all core tables exist
- Checks migration tracking table
- Reports applied migrations and schema version
- Does NOT apply any migrations
- Does NOT create backups

**Use Cases**:
- Pre-deployment health checks
- Post-deployment validation
- CI/CD pipeline checks
- Troubleshooting migration issues

## Best Practices

### 1. **Always Run Migrations Before Seeds**

```bash
# Correct order
pnpm db:migrate   # Create schema
pnpm db:seed      # Insert data
```

### 2. **Test Migrations in Development First**

```bash
# Test with fresh database
rm -f data/escapeplan.db data/escapeplan.db-*
pnpm db:migrate
pnpm db:migrate:verify
```

### 3. **Backup Before Manual Migration**

```bash
# Create manual backup before applying migrations
cp /var/lib/escapeplan/escapeplan.db /var/backups/escapeplan/manual-backup-$(date +%Y%m%d-%H%M%S).db
```

### 4. **Verify Migrations After Deployment**

```bash
# After package deployment
sudo -u escapeplan node /opt/escapeplan/api/src/db/migrate.ts --verify
```

### 5. **Monitor Migration Logs**

```bash
# Check migration logs
tail -f /tmp/escapeplan-migration.log

# Check service logs
journalctl -u escapeplan-api.service -n 100
```

## Troubleshooting

### Issue: Migration fails with "table already exists"

**Cause**: Migration has already been applied but tracking table is out of sync.

**Solution**:
```bash
# Check applied migrations
sudo -u escapeplan sqlite3 /var/lib/escapeplan/escapeplan.db "SELECT * FROM __drizzle_migrations;"

# Compare with journal
cat /opt/escapeplan/api/drizzle/meta/_journal.json
```

### Issue: Database in inconsistent state after failed migration

**Cause**: Rollback failed or backup was corrupted.

**Solution**:
```bash
# Restore from latest automated backup
sudo -u escapeplan systemctl start escapeplan-backup.service

# Or restore from specific backup
sudo -u escapeplan /opt/escapeplan/api/scripts/restore.ts --backup-id <id>
```

### Issue: Permission denied errors

**Cause**: Incorrect file permissions on database or data directory.

**Solution**:
```bash
# Fix permissions
sudo chown -R escapeplan:escapeplan /var/lib/escapeplan
sudo chmod 750 /var/lib/escapeplan
sudo chmod 640 /var/lib/escapeplan/escapeplan.db
```

## Performance Considerations

### Migration Speed

- **Fresh Install**: ~100-200ms (creates all tables)
- **Upgrade (no new migrations)**: ~50-100ms (verification only)
- **Upgrade (with new migrations)**: ~200-500ms (depends on complexity)

### Backup Impact

- **Backup Creation**: ~50-100ms for typical database (1-2 MB)
- **Backup Cleanup**: ~10-20ms
- **Rollback**: ~100-200ms (restore + verify)

### Database Locking

- Migrations use WAL mode for minimal locking
- Read operations can continue during migration
- Write operations are blocked during schema changes

## Future Enhancements

### Planned Features

1. **Migration Dry-Run Mode**
   - Preview what will be applied without executing
   - Useful for pre-deployment validation

2. **Migration History Report**
   - Detailed report of all applied migrations
   - Include timestamps, duration, success/failure

3. **Schema Diff Tool**
   - Compare current schema with expected schema
   - Detect drift from migration definitions

4. **Multi-Version Upgrade Support**
   - Handle migrations spanning multiple major versions
   - Automatic intermediate migration detection

5. **Migration Performance Metrics**
   - Track migration execution time
   - Alert on slow migrations
   - Historical trend analysis

## Related Documentation

- **Database System**: `/escapeplan-app/project-docs/DATABASE_SYSTEM.md`
- **Schema Management**: `/escapeplan-app/project-docs/@API_CONTRACTS_SCHEMA_MANAGEMENT.md`
- **Post-Install Script**: `/scripts/pi-post-install.sh`
- **Seed Documentation**: `/escapeplan-app/apps/escapeplan-api/src/db/seeds/README.md`

## Support

For issues related to migrations:

1. Check migration logs: `/tmp/escapeplan-migration.log`
2. Verify database state: `pnpm db:migrate:verify`
3. Review recent backups: `ls -lah /var/backups/escapeplan/`
4. Check service status: `systemctl status escapeplan-api.service`

For critical failures:
- Database rollback failed: Check backup at `/var/lib/escapeplan/escapeplan.db.pre-migration-backup`
- Migration tracking corruption: Contact support with `__drizzle_migrations` table contents
- Schema version mismatch: Verify Drizzle version matches expected version in package.json
