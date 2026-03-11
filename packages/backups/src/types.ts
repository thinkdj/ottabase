/**
 * @ottabase/backups — Type definitions
 *
 * Types for D1→R2 automated backup operations.
 */

// ============================================================
// Backup metadata stored alongside each backup in R2
// ============================================================

export interface BackupMetadata {
    /** Unique backup ID */
    id: string;
    /** ISO timestamp of when the backup was created */
    createdAt: string;
    /** Backup size in bytes */
    sizeBytes: number;
    /** Number of tables included in the backup */
    tableCount: number;
    /** Total row count across all tables */
    totalRows: number;
    /** List of table names included */
    tables: string[];
    /** Whether this is a full or differential backup */
    type: BackupType;
    /** Optional label (e.g., "pre-migration", "daily-auto") */
    label?: string;
    /** ID of the base backup (for diff backups) */
    baseBackupId?: string;
    /** Duration of the backup operation in milliseconds */
    durationMs: number;
    /** SHA-256 hash of the backup content for integrity verification */
    contentHash: string;
    /** Filename in R2 (e.g., "2024-06-15-023000_myapp.sql") */
    filename?: string;
}

export type BackupType = 'full' | 'diff';

// ============================================================
// Backup configuration
// ============================================================

export interface BackupConfig {
    /** R2 key prefix for backups (default: "backups/d1") */
    prefix?: string;
    /** Maximum number of backups to retain (default: 30) */
    maxRetained?: number;
    /** Rolling window in days — backups older than this are deleted (default: 30) */
    retentionDays?: number;
    /** Tables to exclude from backup */
    excludeTables?: string[];
    /** App name used in backup filenames (default: "ottabase") */
    appName?: string;
}

export const DEFAULT_BACKUP_CONFIG: Required<BackupConfig> = {
    prefix: 'backups/d1',
    maxRetained: 30,
    retentionDays: 30,
    excludeTables: [],
    appName: 'ottabase',
};

// ============================================================
// Backup operation result
// ============================================================

export interface BackupResult {
    success: boolean;
    metadata?: BackupMetadata;
    error?: string;
}

export interface RestoreResult {
    success: boolean;
    tablesRestored?: number;
    rowsRestored?: number;
    error?: string;
}

// ============================================================
// Backup list response (for admin API)
// ============================================================

export interface BackupListResponse {
    backups: BackupMetadata[];
    stats: {
        totalBackups: number;
        totalSizeBytes: number;
        oldestBackup: string | null;
        newestBackup: string | null;
    };
}

// ============================================================
// Setup status (for admin UI pending setup detection)
// ============================================================

export interface BackupSetupStatus {
    /** Whether D1 binding is configured */
    d1Configured: boolean;
    /** Whether R2 binding is configured */
    r2Configured: boolean;
    /** Whether at least one backup exists */
    hasBackups: boolean;
    /** Whether a scheduled backup cron job exists */
    cronConfigured: boolean;
    /** List of issues that need admin attention */
    pendingItems: string[];
    /** Overall readiness */
    ready: boolean;
}
