/**
 * TypeScript types for database backup system
 * Used by BackupManager to create, verify, and manage SQLite backups
 */

/**
 * Backup trigger type - indicates what triggered the backup
 */
export type BackupTrigger = 'pre-update' | 'scheduled-daily' | 'manual' | 'pre-migration' | 'on-demand';

/**
 * Metadata for a backup operation
 * Stored in manifest.json within backup directory
 */
export interface BackupMetadata {
  /** Unique backup identifier (ULID) */
  id: string;

  /** What triggered this backup */
  trigger: BackupTrigger;

  /** When backup was created (ISO 8601) */
  createdAt: string;

  /** Path to backup directory */
  backupPath: string;

  /** Path to backed up database file */
  databasePath: string;

  /** SHA-256 checksum of database file */
  checksumSha256: string;

  /** Size of database file in bytes */
  sizeBytes: number;

  /** Total size of backup directory in bytes (including WAL/SHM) */
  totalSizeBytes: number;

  /** Original database path that was backed up */
  sourceDatabasePath: string;

  /** Application version at time of backup */
  appVersion?: string;

  /** Associated update version (for pre-update backups) */
  updateVersion?: string;

  /** Associated install ID (for pre-update backups) */
  installId?: string;

  /** Whether backup verification passed */
  verified: boolean;

  /** Whether backup includes WAL file */
  includesWal: boolean;

  /** Whether backup includes SHM file */
  includesShm: boolean;

  /** Number of tables in database at backup time */
  tableCount?: number;

  /** Additional notes about the backup */
  notes?: string;
}

/**
 * Options for creating a backup
 */
export interface BackupOptions {
  /** What triggered this backup */
  trigger: BackupTrigger;

  /** Whether to checkpoint WAL before backup (recommended) */
  checkpointWal?: boolean;

  /** Associated update version (for pre-update backups) */
  updateVersion?: string;

  /** Associated install ID (for pre-update backups) */
  installId?: string;

  /** Application version to store in metadata */
  appVersion?: string;

  /** Additional notes to store with backup */
  notes?: string;

  /** Whether to verify backup immediately after creation */
  verifyAfterCreate?: boolean;
}

/**
 * Result of backup verification
 */
export interface BackupVerificationResult {
  /** Whether verification passed all checks */
  success: boolean;

  /** Whether checksum matches manifest */
  checksumValid: boolean;

  /** Whether database integrity check passed */
  integrityCheckPassed: boolean;

  /** Whether database can be opened readonly */
  canOpenDatabase: boolean;

  /** Whether manifest.json is valid */
  manifestValid: boolean;

  /** Number of errors found during PRAGMA integrity_check */
  integrityErrors?: number;

  /** Error message if verification failed */
  errorMessage?: string;

  /** Detailed error information */
  details?: string;
}

/**
 * Retention rule for a backup type
 */
export interface RetentionRule {
  /** Number of backups to keep */
  count: number;

  /** Maximum age in days (optional) */
  ageInDays?: number;
}

/**
 * Disk space information
 */
export interface DiskSpaceInfo {
  /** Total disk size in bytes */
  size: number;

  /** Used disk space in bytes */
  used: number;

  /** Available disk space in bytes */
  available: number;

  /** Usage percentage (0-100) */
  usagePercent: number;
}

/**
 * Grandfather-Father-Son (GFS) retention policies
 *
 * Strategy:
 * - Daily: Keep last 7 (for week recovery)
 * - Weekly: Keep last 4 (for month recovery)
 * - Monthly: Keep last 3 (for quarter recovery)
 * - Pre-update: Keep last 10, max 180 days (for rollback scenarios)
 * - Manual: Keep last 5, max 14 days (user-triggered backups)
 */
export const RETENTION_POLICIES: Record<BackupTrigger, RetentionRule> = {
  'scheduled-daily': { count: 7 },
  'pre-update': { count: 10, ageInDays: 180 },
  'manual': { count: 5, ageInDays: 14 },
  'pre-migration': { count: 10, ageInDays: 180 },
  'on-demand': { count: 5, ageInDays: 14 },
};
