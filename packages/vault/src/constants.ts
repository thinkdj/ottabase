// ============================================================
// @ottabase/vault — shared identifiers
// ============================================================
// One module so the manifest, the routes, the cron job and the React components name the
// same strings. These appear in license claims and in app config: renaming one is a
// breaking change.
// ============================================================

/** Package key. Appears in the license `pkg` claim and in `PREMIUM_LICENSE_VAULT`. */
export const VAULT_PACKAGE_KEY = 'vault';

/** Where the package's routes are mounted in the host app. */
export const VAULT_BASE_PATH = '/api/vault';

/** Cron handler name; seeded as a scheduled task on install. */
export const VAULT_BACKUP_HANDLER = 'vault:backup';

/** Manual backup, list, restore, delete: the free tier. Always on. */
export const VAULT_FEATURE_BACKUP = 'backup';
/** The nightly schedule, retention pruning and the staleness health check. */
export const VAULT_FEATURE_SCHEDULE = 'schedule';
/** Operator export of any tenant's rows (`GET /export?organizationId=`). A user's own `/export/me` is always free. */
export const VAULT_FEATURE_EXPORT = 'export';

/** Limit key: how many backups may exist at once. */
export const VAULT_LIMIT_BACKUPS = 'backups';
/** Backups an unlicensed install may keep. Enough to cover a risky migration and a bad week. */
export const VAULT_FREE_BACKUP_LIMIT = 5;

export const DEFAULT_SCHEDULE = '23 2 * * *';
export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_STALE_AFTER_HOURS = 48;
