/**
 * @ottabase/analytics — Types
 *
 * Core type definitions for the Analytics Engine wrapper.
 * WAE supports up to 1 index, 20 blobs (strings), and 20 doubles (numbers).
 */

// ── Write types ──────────────────────────────────────────────────────

/** Options for {@link trackEvent}. */
export interface TrackEventOptions {
    /** Analytics Engine dataset binding (e.g. `env.OBCF_ANALYTICS_CORE`). */
    dataset: AnalyticsEngineDataset;

    /** Primary lookup key stored in WAE `index1` (e.g. event name, short code). */
    index: string;

    /**
     * String dimensions stored in WAE blob slots.
     * Mapped positionally: blobs[0] → blob1, blobs[1] → blob2, etc.
     * Max 20 blobs; each truncated to 256 chars by WAE.
     */
    blobs?: string[];

    /**
     * Numeric values stored in WAE double slots.
     * Mapped positionally: doubles[0] → double1, etc.
     * Defaults to `[1]` (single count) when omitted.
     */
    doubles?: number[];
}

/**
 * Structured event payload — a higher-level wrapper that maps
 * well-known fields into the positional blob/double slots.
 *
 * Slot mapping:
 * - index1  = event name
 * - blob1   = appId
 * - blob2   = userId
 * - blob3   = country
 * - blob4   = userAgent (truncated to 200 chars)
 * - blob5   = referer
 * - blob6   = visitorId (hashed visitor fingerprint)
 * - blob7–blob11 = metadata[0]–metadata[4]
 * - double1 = value (default 1)
 */
export interface CoreEventOptions {
    /** Analytics Engine dataset binding. */
    dataset: AnalyticsEngineDataset;

    /** Event name / action identifier (stored as index1). */
    event: string;

    /** Application identifier (blob1). */
    appId?: string;

    /** Authenticated user ID (blob2). */
    userId?: string;

    /** ISO country code from `cf-connecting-country` header (blob3). */
    country?: string;

    /** Truncated user-agent (blob4, max 200 chars). */
    userAgent?: string;

    /** HTTP referer (blob5). */
    referer?: string;

    /**
     * Visitor identifier for unique counting (blob6).
     * Use `resolveVisitorId(request)` or `fastVisitorHash(request)` from `@ottabase/analytics/identity`.
     */
    visitorId?: string;

    /**
     * Up to 5 free-form metadata strings (blob7 – blob11).
     * Use for page URL, button ID, campaign, etc.
     */
    metadata?: string[];

    /** Numeric value (double1). Defaults to `1`. */
    value?: number;
}

// ── Query types ──────────────────────────────────────────────────────

/** Credentials needed for the WAE SQL API. */
export interface AnalyticsQueryConfig {
    /** Cloudflare account ID (32-char hex). */
    accountId: string;

    /** API token with Account Analytics Read permission. */
    apiToken: string;
}

/** Supported aggregate functions. */
export type AggregateFunction = 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';

/**
 * Built-in groupBy shortcuts.
 * - `"index"` → index1
 * - `"country"` → blob1 (core event slot)
 * - `"day"` / `"hour"` / `"week"` / `"month"` → time-series
 * - `"visitor"` → blob6 (visitor ID, core events only)
 * - anything else → used verbatim
 */
export type GroupByPreset = 'index' | 'country' | 'day' | 'hour' | 'week' | 'month' | 'visitor' | (string & {});

/** Filters for {@link queryEvents}. */
export interface AnalyticsQueryFilters {
    /** WAE dataset name (e.g. `"shortlink_clicks"`, `"core_events"`). */
    dataset: string;

    /** Filter on index1 (exact match). Alphanumeric + dash/underscore only. */
    indexFilter?: string;

    /** Lookback window in days (1–90, default 7). */
    days?: number;

    /**
     * Column expression to `GROUP BY` and `SELECT` as `dimension`.
     * Built-in shortcuts: `"index"`, `"country"`, `"day"`, `"hour"`, `"week"`, `"month"`, `"visitor"`.
     * Any other string is used verbatim as a SQL expression.
     */
    groupBy?: GroupByPreset;

    /**
     * Aggregate function applied to `_sample_interval` (default: `"SUM"`).
     * - `SUM` → total count (compensated for sampling)
     * - `COUNT` → raw row count
     * - `AVG` / `MIN` / `MAX` → applied to double1
     */
    aggregate?: AggregateFunction;

    /**
     * Which double column to aggregate (default: `"_sample_interval"` for SUM/COUNT, `"double1"` for AVG/MIN/MAX).
     */
    aggregateColumn?: string;

    /** Maximum rows to return (default 100, max 1000). */
    limit?: number;

    /** Optional extra WHERE clause fragment (AND-ed). **Must be pre-sanitized.** */
    extraWhere?: string;
}

/** Options for {@link queryTopK}. */
export interface TopKQueryOptions {
    /** WAE dataset name. */
    dataset: string;

    /** Blob column to find top values for (e.g. `"blob1"` for country). */
    column: string;

    /** Number of top values to return (default 10). */
    k?: number;

    /** Lookback window in days (1–90, default 7). */
    days?: number;

    /** Filter on index1 (exact match). */
    indexFilter?: string;

    /** Extra WHERE clause. */
    extraWhere?: string;
}

/** Options for {@link queryQuantile}. */
export interface QuantileQueryOptions {
    /** WAE dataset name. */
    dataset: string;

    /** Percentile (0–1, e.g. 0.95 for p95, 0.5 for median). */
    quantile: number;

    /** Double column to compute percentile on (default: `"double1"`). */
    column?: string;

    /** Lookback window in days (1–90, default 7). */
    days?: number;

    /** Filter on index1. */
    indexFilter?: string;

    /** Extra WHERE clause. */
    extraWhere?: string;
}

/** A single step in a funnel analysis. */
export interface FunnelStep {
    /** Event name (matched against index1). */
    event: string;

    /** Human-readable label for display. */
    label?: string;
}

/** Options for {@link queryFunnel}. */
export interface FunnelQueryOptions {
    /** WAE dataset name (all steps must be in the same dataset). */
    dataset: string;

    /** Ordered funnel steps — each is an event name. */
    steps: FunnelStep[];

    /** Lookback window in days (1–90, default 7). */
    days?: number;

    /** Extra WHERE clause applied to all steps. */
    extraWhere?: string;
}

/** Single step result in a funnel. */
export interface FunnelStepResult {
    /** Step index (0-based). */
    step: number;

    /** Event name. */
    event: string;

    /** Display label. */
    label: string;

    /** Total events for this step. */
    count: number;

    /** Drop-off rate from previous step (0 for first step). */
    dropOff: number;

    /** Conversion rate from first step (1.0 for first step). */
    conversionRate: number;
}

/** Single row returned from a WAE SQL query. */
export interface AnalyticsRow {
    dimension: string;
    value: number;
    [key: string]: unknown;
}

/** Full response from {@link queryEvents}. */
export interface AnalyticsQueryResult {
    /** Aggregated rows. */
    data: AnalyticsRow[];

    /** WAE response metadata (column types, elapsed, etc.). */
    meta: Record<string, unknown>;
}

/** Body accepted by `POST /api/analytics/track`. */
export interface TrackEndpointBody {
    /** Event name (required). */
    event: string;

    /** App identifier (defaults to APP_ID env var). */
    appId?: string;

    /** Free-form metadata strings. */
    metadata?: string[];

    /** Numeric value. */
    value?: number;
}
