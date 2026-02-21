/**
 * @ottabase/analytics — Query
 *
 * Query aggregated analytics from the Cloudflare Workers Analytics Engine SQL API.
 * Supports standard aggregation, topK, quantiles, and multi-step funnel analysis.
 */

import type {
    AnalyticsQueryConfig,
    AnalyticsQueryFilters,
    AnalyticsQueryResult,
    FunnelQueryOptions,
    FunnelStepResult,
    QuantileQueryOptions,
    TopKQueryOptions,
} from './types';

/** WAE SQL API base URL */
const WAE_SQL_API = 'https://api.cloudflare.com/client/v4/accounts';

/**
 * Validate that the WAE query config is present.
 * Returns an error string if misconfigured, or `null` if OK.
 */
export function validateAnalyticsConfig(config: Partial<AnalyticsQueryConfig>): string | null {
    if (!config.accountId || !config.apiToken) {
        return 'Analytics not configured: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ANALYTICS_API_TOKEN required';
    }
    return null;
}

/**
 * Sanitize a string for safe use in WAE SQL WHERE clauses.
 * Only allows alphanumeric, dash, and underscore characters.
 * Returns empty string for invalid input.
 */
export function sanitizeIndexFilter(value: string): string {
    if (!value) return '';
    return /^[a-zA-Z0-9_-]+$/.test(value) ? value.replace(/'/g, "''") : '';
}

/**
 * Resolve a `groupBy` shortcut to a SQL column expression.
 *
 * Built-in shortcuts:
 * - `"index"` → `index1 AS dimension`
 * - `"country"` → `blob1 AS dimension` (or blob3 for core events)
 * - `"visitor"` → `blob6 AS dimension` (core events visitor ID)
 * - `"day"` → `toStartOfDay(timestamp) AS dimension`
 * - `"hour"` → `toStartOfHour(timestamp) AS dimension`
 * - `"week"` → `toStartOfWeek(timestamp) AS dimension`
 * - `"month"` → `toStartOfMonth(timestamp) AS dimension`
 * - anything else → used verbatim
 */
export function resolveGroupByColumn(groupBy: string): { select: string; orderClause: string } {
    switch (groupBy) {
        case 'index':
            return { select: 'index1 AS dimension', orderClause: 'value DESC' };
        case 'country':
            return { select: 'blob1 AS dimension', orderClause: 'value DESC' };
        case 'visitor':
            return { select: 'blob6 AS dimension', orderClause: 'value DESC' };
        case 'day':
            return { select: 'toStartOfDay(timestamp) AS dimension', orderClause: 'dimension ASC' };
        case 'hour':
            return { select: 'toStartOfHour(timestamp) AS dimension', orderClause: 'dimension ASC' };
        case 'week':
            return { select: 'toStartOfWeek(timestamp) AS dimension', orderClause: 'dimension ASC' };
        case 'month':
            return { select: 'toStartOfMonth(timestamp) AS dimension', orderClause: 'dimension ASC' };
        default:
            return { select: `${groupBy} AS dimension`, orderClause: 'value DESC' };
    }
}

/** Build the common WHERE clause parts. */
function buildWhereParts(days: number, indexFilter?: string, extraWhere?: string): string[] {
    const safeDays = Math.min(90, Math.max(1, days));
    const parts: string[] = [`timestamp > now() - INTERVAL '${safeDays}' DAY`];

    if (indexFilter) {
        const safe = sanitizeIndexFilter(indexFilter);
        if (safe) parts.push(`index1 = '${safe}'`);
    }
    if (extraWhere) {
        parts.push(extraWhere);
    }
    return parts;
}

/**
 * Build a WAE SQL query from filters.
 *
 * Supports multiple aggregate functions: SUM (default), COUNT, AVG, MIN, MAX.
 * Uses `_sample_interval` for count-based aggregates to compensate for WAE sampling.
 */
export function buildAnalyticsQuery(filters: AnalyticsQueryFilters): string {
    const {
        dataset,
        indexFilter,
        days = 7,
        groupBy = 'country',
        limit = 100,
        extraWhere,
        aggregate = 'SUM',
        aggregateColumn,
    } = filters;

    const safeLimit = Math.min(1000, Math.max(1, limit));
    const { select, orderClause } = resolveGroupByColumn(groupBy);
    const whereParts = buildWhereParts(days, indexFilter, extraWhere);
    const whereClause = whereParts.join(' AND ');

    // Determine the column and expression for aggregation
    let aggExpr: string;
    if (aggregate === 'SUM' || aggregate === 'COUNT') {
        // For counting, always use _sample_interval to compensate for WAE sampling
        const col = aggregateColumn ?? '_sample_interval';
        aggExpr = `${aggregate}(${col})`;
    } else {
        // AVG, MIN, MAX — apply to the specified double column
        const col = aggregateColumn ?? 'double1';
        aggExpr = `${aggregate}(${col})`;
    }

    return `SELECT ${select}, ${aggExpr} AS value
FROM ${dataset}
WHERE ${whereClause}
GROUP BY dimension
ORDER BY ${orderClause}
LIMIT ${safeLimit}`;
}

/**
 * Build a topK query — find the K most frequent values in a column.
 * Uses WAE's built-in `topK` aggregate function.
 */
export function buildTopKQuery(options: TopKQueryOptions): string {
    const { dataset, column, k = 10, days = 7, indexFilter, extraWhere } = options;
    const safeK = Math.min(100, Math.max(1, k));
    const whereParts = buildWhereParts(days, indexFilter, extraWhere);
    const whereClause = whereParts.join(' AND ');

    return `SELECT ${column} AS dimension, SUM(_sample_interval) AS value
FROM ${dataset}
WHERE ${whereClause}
GROUP BY dimension
ORDER BY value DESC
LIMIT ${safeK}`;
}

/**
 * Build a quantile query — compute a percentile of a numeric column.
 * Uses `quantileWeighted` with `_sample_interval` for sampling compensation.
 */
export function buildQuantileQuery(options: QuantileQueryOptions): string {
    const { dataset, quantile, column = 'double1', days = 7, indexFilter, extraWhere } = options;
    const safeQ = Math.min(1, Math.max(0, quantile));
    const whereParts = buildWhereParts(days, indexFilter, extraWhere);
    const whereClause = whereParts.join(' AND ');

    return `SELECT quantileWeighted(${safeQ})(${column}, _sample_interval) AS value, SUM(_sample_interval) AS count
FROM ${dataset}
WHERE ${whereClause}`;
}

// ── Query execution ──────────────────────────────────────────────────

/**
 * Execute a WAE SQL query against the Cloudflare Analytics Engine API.
 *
 * @example
 * ```ts
 * const result = await queryEvents(
 *   { accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN },
 *   { dataset: 'shortlink_clicks', indexFilter: 'abc123', days: 7, groupBy: 'country' },
 * );
 * // result.data = [{ dimension: 'US', value: 42 }, ...]
 * ```
 */
export async function queryEvents(
    config: AnalyticsQueryConfig,
    filters: AnalyticsQueryFilters,
): Promise<AnalyticsQueryResult> {
    const sql = buildAnalyticsQuery(filters);
    return executeWaeQuery(config, sql);
}

/**
 * Find the top K values for a given column.
 *
 * @example
 * ```ts
 * const top = await queryTopK(config, {
 *   dataset: 'core_events', column: 'blob1', k: 10, days: 7,
 * });
 * // top.data = [{ dimension: 'US', value: 500 }, { dimension: 'DE', value: 300 }, ...]
 * ```
 */
export async function queryTopK(
    config: AnalyticsQueryConfig,
    options: TopKQueryOptions,
): Promise<AnalyticsQueryResult> {
    const sql = buildTopKQuery(options);
    return executeWaeQuery(config, sql);
}

/**
 * Compute a percentile of a numeric column.
 *
 * @example
 * ```ts
 * const p95 = await queryQuantile(config, {
 *   dataset: 'core_events', quantile: 0.95, column: 'double1',
 * });
 * // p95.data = [{ value: 4.2, count: 1500 }]
 * ```
 */
export async function queryQuantile(
    config: AnalyticsQueryConfig,
    options: QuantileQueryOptions,
): Promise<AnalyticsQueryResult> {
    const sql = buildQuantileQuery(options);
    return executeWaeQuery(config, sql);
}

/**
 * Run a multi-step funnel analysis.
 *
 * Queries each step independently (WAE doesn't support JOINs) and computes
 * drop-off / conversion rates. All steps must use the same dataset.
 *
 * @example
 * ```ts
 * const funnel = await queryFunnel(config, {
 *   dataset: 'core_events',
 *   steps: [
 *     { event: 'page_view', label: 'Landing' },
 *     { event: 'signup_click', label: 'Signup Click' },
 *     { event: 'signup_complete', label: 'Signup Done' },
 *   ],
 *   days: 30,
 * });
 * // funnel = [
 * //   { step: 0, event: 'page_view', label: 'Landing', count: 1000, dropOff: 0, conversionRate: 1 },
 * //   { step: 1, event: 'signup_click', label: 'Signup Click', count: 200, dropOff: 0.8, conversionRate: 0.2 },
 * //   { step: 2, event: 'signup_complete', label: 'Signup Done', count: 50, dropOff: 0.75, conversionRate: 0.05 },
 * // ]
 * ```
 */
export async function queryFunnel(
    config: AnalyticsQueryConfig,
    options: FunnelQueryOptions,
): Promise<FunnelStepResult[]> {
    const { dataset, steps, days = 7, extraWhere } = options;

    if (!steps.length) return [];

    // Query each step's total count in parallel
    const queries = steps.map((step) =>
        queryEvents(config, {
            dataset,
            indexFilter: step.event,
            days,
            groupBy: 'index',
            limit: 1,
            extraWhere,
        }),
    );

    const results = await Promise.all(queries);
    const firstCount = results[0]?.data?.[0]?.value ?? 0;

    return steps.map((step, i) => {
        const count = results[i]?.data?.[0]?.value ?? 0;
        const prevCount = i > 0 ? (results[i - 1]?.data?.[0]?.value ?? 0) : count;

        return {
            step: i,
            event: step.event,
            label: step.label ?? step.event,
            count,
            dropOff: i === 0 ? 0 : prevCount > 0 ? 1 - count / prevCount : 1,
            conversionRate: firstCount > 0 ? count / firstCount : 0,
        };
    });
}

/**
 * Count approximate unique visitors using the visitor ID blob slot.
 * Queries distinct blob6 values (core event schema).
 *
 * @example
 * ```ts
 * const uniques = await queryUniqueVisitors(config, {
 *   dataset: 'core_events', days: 7, indexFilter: 'page_view',
 * });
 * // uniques = 1234
 * ```
 */
export async function queryUniqueVisitors(
    config: AnalyticsQueryConfig,
    options: { dataset: string; days?: number; indexFilter?: string; extraWhere?: string },
): Promise<number> {
    const { dataset, days = 7, indexFilter, extraWhere } = options;
    const whereParts = buildWhereParts(days, indexFilter, extraWhere);
    const whereClause = whereParts.join(' AND ');

    const sql = `SELECT COUNT(DISTINCT blob6) AS value
FROM ${dataset}
WHERE ${whereClause}`;

    const result = await executeWaeQuery(config, sql);
    return (result.data?.[0]?.value as number) ?? 0;
}

// ── Internal ─────────────────────────────────────────────────────────

/** Execute raw SQL against the WAE API. */
async function executeWaeQuery(config: AnalyticsQueryConfig, sql: string): Promise<AnalyticsQueryResult> {
    const apiUrl = `${WAE_SQL_API}/${config.accountId}/analytics_engine/sql`;
    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiToken}` },
        body: sql,
    });

    if (!res.ok) {
        const text = await res.text();
        console.error('[analytics] WAE SQL API error:', res.status, text);
        throw new AnalyticsQueryError(`Analytics query failed (HTTP ${res.status})`, res.status, text);
    }

    const json = (await res.json()) as { data?: unknown[]; result?: unknown[]; meta?: Record<string, unknown> };

    return {
        data: (json.data ?? json.result ?? []) as AnalyticsQueryResult['data'],
        meta: json.meta ?? {},
    };
}

/**
 * Execute raw SQL against WAE. Exposed for advanced/custom queries.
 */
export async function executeRawQuery(config: AnalyticsQueryConfig, sql: string): Promise<AnalyticsQueryResult> {
    return executeWaeQuery(config, sql);
}

/**
 * Error thrown when a WAE SQL API request fails.
 */
export class AnalyticsQueryError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly detail: string,
    ) {
        super(message);
        this.name = 'AnalyticsQueryError';
    }
}
