# @ottabase/analytics — agent notes

Cloudflare Workers Analytics Engine wrapper: track events, query aggregates via WAE SQL. Full docs: ./README.md

## Use when

- Recording product/usage events in a Worker, or reading them back (aggregates, topK, quantiles, funnels, unique visitors).
- NOT for app logs (`@ottabase/logger`) or audit trails (`@ottabase/audit`). Requires Cloudflare Workers (WAE binding for writes; edge runtime, no Node APIs).

## Imports

```ts
// All except handleAnalyticsTrack are also re-exported from '@ottabase/analytics'
import { trackEvent, trackCoreEvent, extractRequestContext } from '@ottabase/analytics/track';
import { queryEvents, queryTopK, queryQuantile, queryFunnel, queryUniqueVisitors, executeRawQuery, validateAnalyticsConfig, AnalyticsQueryError } from '@ottabase/analytics/query';
import { resolveVisitorId, setVisitorIdResolver, defaultVisitorIdResolver, fastVisitorHash } from '@ottabase/analytics/identity';
import { handleAnalyticsTrack } from '@ottabase/analytics/server';
```

## Canonical usage

```ts
// Write (fire-and-forget, never throws). Slot map: index1=event, blob1=appId, blob2=userId,
// blob3=country, blob4=UA, blob5=referer, blob6=visitorId, blob7-11=metadata, double1=value.
trackCoreEvent({
    dataset: env.OBCF_ANALYTICS_CORE,
    event: 'button_click',
    appId: 'my-app',
    visitorId: await resolveVisitorId(request),
    ...extractRequestContext(request),
    metadata: ['/pricing', 'cta-signup'],
});
```

```ts
// Read (throws AnalyticsQueryError on failure); result.data = [{ dimension, value }]
const config = { accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN };
const result = await queryEvents(config, { dataset: 'core_events', groupBy: 'day', days: 7 });
// Drop-in POST /api/analytics/track endpoint for a worker router:
return handleAnalyticsTrack({ request, dataset: env.OBCF_ANALYTICS_CORE, defaultAppId: env.APP_ID });
```

## Gotchas

- Query API needs `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_ANALYTICS_API_TOKEN` (Analytics Read token); tracking only needs the WAE binding.
- `groupBy: 'country'` maps to blob1, but core events store country in blob3 — pass `groupBy: 'blob3'` for core-event country breakdowns.
- Default visitor ID = IP+UA hashed with an ISO-week salt: rotates weekly, no cross-week correlation. `queryUniqueVisitors` counts distinct blob6.
- WAE does not work on localhost; counts are sampled/approximate (queries compensate via `_sample_interval`).
