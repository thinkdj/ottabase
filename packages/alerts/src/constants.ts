// ============================================================
// @ottabase/alerts: shared identifiers, defaults and ceilings
// ============================================================
// One module so the manifest, the engine, the routes, the cron jobs and the React console
// name the same strings. The handler names and the env channel id are stored in rows
// (`scheduled_tasks`, `alert_deliveries`): renaming one is a breaking change.
// ============================================================

/** Package key. */
export const ALERTS_PACKAGE_KEY = 'alerts';

/** Where the routes are mounted in the host app. */
export const ALERTS_BASE_PATH = '/api/alerts';

/** The console in the admin. */
export const ALERTS_ADMIN_PATH = '/admin/infrastructure/alerts';

/** Retries, held-back summaries and digests. Seeded as a scheduled task on install. */
export const ALERTS_SWEEP_HANDLER = 'alerts:sweep';
export const DEFAULT_SWEEP_SCHEDULE = '*/5 * * * *';

/** Drops old alerts with their deliveries, and idle de-duplication keys. */
export const ALERTS_PRUNE_HANDLER = 'alerts:prune';
export const DEFAULT_PRUNE_SCHEDULE = '20 4 * * *';

/** The channel the composition's `emailTo` describes. Not a row: its settings are fixed. */
export const ENV_EMAIL_CHANNEL_ID = 'env:email';

/** Severities, quietest first. A channel takes its minimum and everything above it. */
export const SEVERITIES = ['info', 'warning', 'critical'] as const;

/** The same alert key and state again within this window is counted, not sent. */
export const DEFAULT_COOLDOWN_MS = 30 * 60_000;
/** Unhandled errors repeat by the thousand: one alert per error shape per hour. */
export const DEFAULT_ERROR_COOLDOWN_MS = 60 * 60_000;

/** Non-critical messages a channel sends per rolling hour; the rest are held for one summary. */
export const DEFAULT_MAX_PER_HOUR = 30;
/** UTC hour a digest channel sends its digest. */
export const DEFAULT_DIGEST_HOUR = 8;
/** Alerts and their deliveries are kept this long. */
export const DEFAULT_RETENTION_DAYS = 30;

/** Wait before each retry of a failed delivery; one attempt more than there are delays. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
/** A delivery claimed this long ago and never finished is tried again. */
export const SENDING_STALE_MS = 10 * 60_000;
/** One outbound request may take this long. */
export const SEND_TIMEOUT_MS = 10_000;
/** Consecutive failures before a channel counts as failing in the health report. */
export const FAILING_AFTER = 3;

/** Deliveries one sweep retries at most, so a backlog never runs a cron tick out of time. */
export const SWEEP_BATCH = 50;
/** Alerts a digest or held-back summary lists by name; the rest are counted. */
export const DIGEST_LIST_LIMIT = 25;
/** Alerts the feed route returns at most. */
export const EVENTS_PAGE_CEILING = 200;
/** Channels an app may have. A console, not a fan-out service. */
export const MAX_CHANNELS = 50;

/** Field ceilings; everything raised is cut to these before it is stored. */
export const MAX_SOURCE = 48;
export const MAX_KIND = 64;
export const MAX_KEY = 200;
export const MAX_TITLE = 200;
export const MAX_BODY = 4000;
export const MAX_URL = 2048;
export const MAX_FIELDS = 10;
export const MAX_FIELD_LABEL = 60;
export const MAX_FIELD_VALUE = 500;
export const MAX_NAME = 80;
export const MAX_RECIPIENTS = 10;
/** Error text kept from a failed send. */
export const MAX_ERROR = 300;
/** Bytes the ingest route reads at most. */
export const INGEST_MAX_BYTES = 16 * 1024;
/** A shorter ingest token counts as unset: the door only opens for a token guessing cannot find. */
export const INGEST_TOKEN_MIN_LENGTH = 24;

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
