/**
 * @ottabase/analytics
 *
 * Cloudflare Workers Analytics Engine wrapper for event tracking and querying.
 *
 * Modules:
 * - **Track** (write): Fire-and-forget event recording via `writeDataPoint`
 * - **Query** (read): Aggregated analytics, topK, quantiles, funnels via WAE SQL API
 * - **Identity**: Pluggable visitor identification (hashed IP+UA default)
 * - **Server**: Drop-in `POST /api/analytics/track` endpoint handler
 *
 * @example
 * ```ts
 * // Write — fire-and-forget
 * import { trackCoreEvent, extractRequestContext } from '@ottabase/analytics';
 * import { resolveVisitorId } from '@ottabase/analytics/identity';
 *
 * trackCoreEvent({
 *   dataset: env.OBCF_ANALYTICS_CORE,
 *   event: 'button_click',
 *   appId: 'my-app',
 *   userId: session?.user?.id,
 *   visitorId: await resolveVisitorId(request),
 *   ...extractRequestContext(request),
 *   metadata: ['/pricing', 'cta-signup'],
 * });
 *
 * // Read — query aggregated data
 * import { queryEvents, queryFunnel, queryTopK } from '@ottabase/analytics';
 *
 * const result = await queryEvents(config, {
 *   dataset: 'core_events', groupBy: 'hour', days: 7, aggregate: 'AVG',
 * });
 * ```
 */

// Track (write)
export { extractRequestContext, trackCoreEvent, trackEvent } from './track';

// Query (read)
export {
    AnalyticsQueryError,
    buildAnalyticsQuery,
    buildQuantileQuery,
    buildTopKQuery,
    executeRawQuery,
    queryEvents,
    queryFunnel,
    queryQuantile,
    queryTopK,
    queryUniqueVisitors,
    resolveGroupByColumn,
    sanitizeIndexFilter,
    validateAnalyticsConfig,
} from './query';

// Identity
export {
    defaultVisitorIdResolver,
    fastVisitorHash,
    resetVisitorIdResolver,
    resolveVisitorId,
    setVisitorIdResolver,
} from './identity';

// Types
export type {
    AggregateFunction,
    AnalyticsQueryConfig,
    AnalyticsQueryFilters,
    AnalyticsQueryResult,
    AnalyticsRow,
    CoreEventOptions,
    FunnelQueryOptions,
    FunnelStep,
    FunnelStepResult,
    GroupByPreset,
    QuantileQueryOptions,
    TopKQueryOptions,
    TrackEndpointBody,
    TrackEventOptions,
} from './types';

export type { VisitorIdResolver } from './identity';
