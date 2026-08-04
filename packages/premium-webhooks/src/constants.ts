// ============================================================
// @ottabase/premium-webhooks — shared identifiers
// ============================================================
// One module so the manifest, the routes, the dispatcher and the React components all
// name the same strings. These appear in license claims and in customer config, so they
// are part of the package's public contract: renaming one is a breaking change.
// ============================================================

/** Package key. Appears in the license `pkg` claim and in `PREMIUM_LICENSE_WEBHOOKS`. */
export const WEBHOOKS_PACKAGE_KEY = 'webhooks';

/** Delivery history retention — the paid half of the package. */
export const WEBHOOKS_FEATURE_DELIVERY_LOG = 'deliveries.log';
/** Per-endpoint custom request headers. */
export const WEBHOOKS_FEATURE_CUSTOM_HEADERS = 'custom-headers';
/** Registering and editing endpoints — available on the free tier, up to the limit. */
export const WEBHOOKS_FEATURE_MANAGE = 'endpoints.manage';

/** Limit key for the number of endpoints a tenant may register. */
export const WEBHOOKS_LIMIT_ENDPOINTS = 'endpoints';

/** Endpoints a free (unlicensed) install still gets. The free tier is deliberately usable. */
export const WEBHOOKS_FREE_ENDPOINT_LIMIT = 1;

/** Where the package's routes are mounted in the host app. */
export const WEBHOOKS_BASE_PATH = '/api/webhooks';

/** How many delivery rows one page of the log returns. */
export const WEBHOOKS_DELIVERY_PAGE_SIZE = 25;
