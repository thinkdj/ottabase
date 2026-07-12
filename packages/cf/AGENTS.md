# @ottabase/cf — agent notes

Type-safe wrappers for Cloudflare Worker bindings (D1, KV, R2, Images, Queues, secrets, rate limiting, KV caching). Full docs: ./README.md

## Use when

- Direct, framework-agnostic access to CF bindings: raw D1 SQL, KV JSON, R2 objects, Images REST API, Queues, Secret Store, rate limiting, or KV read-through caching.
- NOT for app database access — use `@ottabase/db/drizzle-d1` with `@ottabase/ottaorm` instead.

## Imports

```ts
import { createD1Client } from '@ottabase/cf/d1';
import { createKVClient } from '@ottabase/cf/kv';
import { createR2Client } from '@ottabase/cf/r2';
import { createImagesClient } from '@ottabase/cf/images';
import { createQueuesClient, processQueueBatch } from '@ottabase/cf/queues';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';
import { withCache, invalidateCache, invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { CacheKeyBuilder, globalKey, orgKey, userKey, appKey, orgAppUserKey } from '@ottabase/cf/cache-keys';
// Also '@ottabase/cf/hyperdrive' + '@ottabase/cf/secrets'; root '@ottabase/cf' re-exports all + Result/CloudflareError.
```

## Canonical usage

```ts
const d1 = createD1Client({ database: env.DB });
const rows = await d1.query<User>('SELECT * FROM users WHERE org_id = ?', [orgId]);
if (!rows.success) throw rows.error; // Result<T>, not thrown

const kv = createKVClient({ namespace: env.OBCF_KV });
await kv.putJSON(userKey('session', userId, 'profile'), profile, { expirationTtl: 300 });
const cached = await kv.getJSON<Profile>(userKey('session', userId, 'profile'));
// Read-through cache (returns the value directly; stores via JSON.stringify)
const profile = await withCache(env.OBCF_KV, userKey('auth', userId, 'profile'), 300, () => loadProfile(userId));
await invalidateCacheByPrefix(env.OBCF_KV, userKey('auth', userId));
```

## Gotchas

- Client methods return `Result<T>` objects (`{success, data} | {success, error}`) — always check `result.success`; D1 supports `{ throwOnError: true }`.
- `withCache` JSON-stringifies values; non-JSON-serializable types (Date, Map, class instances) silently degrade.
- `src/d1-prisma.ts` has no exports-map subpath and is not re-exported from index — unreachable as published.
- Images client calls the CF REST API (needs `{ accountId, apiToken }`), not a Worker binding.
- Cache-key helpers sanitize colons/whitespace; use them (not string concat) to avoid cross-tenant key collisions.
