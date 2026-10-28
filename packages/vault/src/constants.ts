// ============================================================
// @ottabase/vault — shared identifiers
// ============================================================
// One module so the manifest, the routes, the cron job and the React components name the
// same strings. These appear in app config: renaming one is a breaking change.
// ============================================================

/** Package key. */
export const VAULT_PACKAGE_KEY = 'vault';

/** Where the package's routes are mounted in the host app. */
export const VAULT_BASE_PATH = '/api/vault';

/** Cron handler name; seeded as a scheduled task on install. */
export const VAULT_BACKUP_HANDLER = 'vault:backup';

export const DEFAULT_SCHEDULE = '23 2 * * *';
export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_STALE_AFTER_HOURS = 48;
