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
