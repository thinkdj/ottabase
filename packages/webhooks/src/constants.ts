// ============================================================
// @ottabase/webhooks — shared identifiers
// ============================================================
// One module so the manifest, the routes, the dispatcher and the React components all
// name the same strings. They appear in customer config, so renaming one is a breaking change.
// ============================================================

/** Package key. */
export const WEBHOOKS_PACKAGE_KEY = 'webhooks';

/** Where the package's routes are mounted in the host app. */
export const WEBHOOKS_BASE_PATH = '/api/webhooks';

/** How many delivery rows one page of the log returns. */
export const WEBHOOKS_DELIVERY_PAGE_SIZE = 25;

/** Endpoints one tenant may register. Each event goes to every subscribed endpoint in turn. */
export const DEFAULT_MAX_ENDPOINTS = 10;

/** Cron handler that deletes delivery log rows past the retention window. */
export const WEBHOOKS_PRUNE_HANDLER = 'webhooks:prune-deliveries';

/** Days of delivery log kept. Endpoint health (last status) lives on the endpoint and is never pruned. */
export const DEFAULT_DELIVERY_RETENTION_DAYS = 30;
