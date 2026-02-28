/**
 * @ottabase/backups
 *
 * Automated D1→R2 database backup service for Cloudflare Workers.
 * Provides full SQL export backups with R2 storage, retention policies,
 * and admin setup status checking.
 */

export {
    BackupService,
    createBackupService,
    sha256,
    escapeSqlValue,
    formatBytes,
    isValidTableName,
    generateBackupFilename,
} from './backup-service';
export type { D1Like, R2Like } from './backup-service';
export * from './types';
