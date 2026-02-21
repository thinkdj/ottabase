# @ottabase/analytics

Cloudflare Workers Analytics Engine (WAE) wrapper — track events, query aggregated data, and analyze user behavior.

## Install

```json
{ "@ottabase/analytics": "workspace:*" }
```

## Write Events

### Low-level (positional slots)

```typescript
import { trackEvent } from '@ottabase/analytics';

trackEvent({
    dataset: env.OBCF_ANALYTICS_SHORTLINKS,
    index: shortCode,
    blobs: [country, userAgent, referer, fullUrl],
    doubles: [1],
});
```

### Structured (named fields)

```typescript
import { trackCoreEvent, extractRequestContext } from '@ottabase/analytics';
import { resolveVisitorId } from '@ottabase/analytics/identity';

trackCoreEvent({
    dataset: env.OBCF_ANALYTICS_CORE,
    event: 'button_click',
    appId: 'my-app',
    userId: session?.user?.id,
    visitorId: await resolveVisitorId(request),
    ...extractRequestContext(request),
    metadata: ['/pricing', 'cta-signup'],
});
```

**Core event slot mapping:**

| Slot     | Field             |
| -------- | ----------------- |
| index1   | event             |
| blob1    | appId             |
| blob2    | userId            |
| blob3    | country           |
| blob4    | userAgent         |
| blob5    | referer           |
| blob6    | visitorId         |
| blob7–11 | metadata[]        |
| double1  | value (default 1) |

## Visitor Identity

Pluggable visitor identification. Default: `SHA-256(IP + UA + weeklySalt)` → 16 hex chars, rotated every 7 days.

```typescript
import { resolveVisitorId, setVisitorIdResolver, defaultVisitorIdResolver } from '@ottabase/analytics/identity';

// Use the default (hashed IP+UA, stable for 7 days)
const visitorId = await resolveVisitorId(request);

// Swap strategy globally (e.g. use authenticated user)
setVisitorIdResolver(async (request) => {
    const session = await getSession(request);
    if (session?.user?.id) return session.user.id;
    return defaultVisitorIdResolver(request);
});
```

**How the default resolver works:**

1. Reads `cf-connecting-ip` (falls back to `x-forwarded-for`, then `"unknown"`)
2. Reads `user-agent` header
3. Appends an ISO week salt (`"2026-W08"`) — same value Mon–Sun
4. Hashes the concatenation with SHA-256 (Web Crypto API, available in Workers)
5. Returns first 16 hex chars (64-bit — sufficient for approximate unique counting)

**Trade-offs of the default (IP+UA hash):**

| Behavior                                                  | Impact                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Same IP + same UA = same visitor                          | Undercounts on shared networks (corporate NAT, public WiFi)            |
| Same person, different browser/device = different visitor | Overcounts multi-device users                                          |
| 7-day salt rotation (ISO week)                            | Same visitor is trackable within a week; cannot correlate across weeks |
| `COUNT(DISTINCT blob6)`                                   | Approximate due to WAE sampling (`_sample_interval` compensation)      |
| Incognito / private browsing                              | Still works — no cookies or localStorage needed                        |

**When to swap the resolver:**

- **Authenticated apps**: Use `session.user.id` for exact counts
- **Longer retention**: Use a cookie-based ID or authenticated ID (no weekly rotation)
- **Higher accuracy**: Combine IP+UA with `CF-Ray` or a first-party cookie
- **Sync-only contexts**: Use `fastVisitorHash(request)` (FNV-1a 32-bit, synchronous, same 7-day window)

## Query Events

### Standard aggregation

```typescript
import { queryEvents } from '@ottabase/analytics';

const result = await queryEvents(
    { accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_ANALYTICS_API_TOKEN },
    { dataset: 'core_events', groupBy: 'country', days: 7 },
);
// result.data = [{ dimension: 'US', value: 42 }, ...]
```

### Aggregate functions

```typescript
// AVG, MIN, MAX, SUM, COUNT supported
const avg = await queryEvents(config, {
    dataset: 'core_events',
    groupBy: 'day',
    days: 30,
    aggregate: 'AVG',
    aggregateColumn: 'double1',
});
```

### Top-K

```typescript
import { queryTopK } from '@ottabase/analytics';

const topCountries = await queryTopK(config, {
    dataset: 'core_events',
    column: 'blob3',
    k: 10,
    days: 7,
});
```

### Quantiles / Percentiles

```typescript
import { queryQuantile } from '@ottabase/analytics';

const p95 = await queryQuantile(config, {
    dataset: 'core_events',
    quantile: 0.95,
    column: 'double1',
});
```

### Funnel analysis

```typescript
import { queryFunnel } from '@ottabase/analytics';

const funnel = await queryFunnel(config, {
    dataset: 'core_events',
    steps: [
        { event: 'page_view', label: 'Landing' },
        { event: 'signup_click', label: 'Signup Click' },
        { event: 'signup_complete', label: 'Signed Up' },
    ],
    days: 30,
});
// [{ step: 0, count: 1000, dropOff: 0, conversionRate: 1 }, ...]
```

### Unique visitors

```typescript
import { queryUniqueVisitors } from '@ottabase/analytics';

const count = await queryUniqueVisitors(config, { dataset: 'core_events', days: 7 });
```

**`groupBy` shortcuts:**

| Shortcut    | SQL expression                     |
| ----------- | ---------------------------------- |
| `"index"`   | `index1` (event name)              |
| `"country"` | `blob1`                            |
| `"visitor"` | `blob6` (visitor ID)               |
| `"day"`     | `toStartOfDay(timestamp)`          |
| `"hour"`    | `toStartOfHour(timestamp)`         |
| `"week"`    | `toStartOfWeek(timestamp)`         |
| `"month"`   | `toStartOfMonth(timestamp)`        |
| anything    | Used verbatim as column expression |

## Server Endpoint

Drop-in `POST /api/analytics/track` handler for client-side event tracking:

```typescript
import { handleAnalyticsTrack } from '@ottabase/analytics/server';

// In your worker router:
if (route === '/api/analytics/track' && method === 'POST') {
    return handleAnalyticsTrack({
        request,
        dataset: env.OBCF_ANALYTICS_CORE,
        defaultAppId: 'my-app',
        userId: session?.user?.id,
    });
}
```

Client-side usage:

```typescript
// Fire-and-forget beacon
navigator.sendBeacon(
    '/api/analytics/track',
    JSON.stringify({
        event: 'page_view',
        metadata: [window.location.pathname],
    }),
);
```

## Wrangler Binding

```jsonc
// wrangler.jsonc
"analytics_engine_datasets": [
    { "binding": "OBCF_ANALYTICS_CORE", "dataset": "core_events" }
]
```

## Tree-shakeable Imports

```typescript
import { trackEvent, trackCoreEvent } from '@ottabase/analytics/track';
import { queryEvents, queryTopK, queryFunnel } from '@ottabase/analytics/query';
import { resolveVisitorId, setVisitorIdResolver } from '@ottabase/analytics/identity';
import { handleAnalyticsTrack } from '@ottabase/analytics/server';
```
