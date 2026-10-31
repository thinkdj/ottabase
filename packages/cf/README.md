# @ottabase/cf

Framework-agnostic Cloudflare bindings wrapper for TypeScript applications.

## Features

Type-safe wrappers for all major Cloudflare Worker bindings:

- **D1**: Raw SQLite database with query builder
- **KV**: Key-value storage
- **R2**: Object storage
- **Hyperdrive**: Database connection pooling
- **Queues**: Message queue processing
- **Secrets**: Environment variables and secrets management
- **Rate Limiting**: Request throttling and protection
- **Vectorize**: Similarity search over embeddings, namespaced per tenant
- **Workers AI**: `run()` any model, plus `embed()` and `generateText()`
- **Browser Rendering**: PDF, screenshot, Markdown, links and structured extraction without puppeteer
- **Workflows**: start, inspect and steer durable runs
- **Durable Object alarms**: many named timers over the one alarm

## Installation

```bash
pnpm add @ottabase/cf
```

## Usage

> **Note:** For database access in Ottabase apps, use `@ottabase/db/drizzle-d1` with `@ottabase/ottaorm` (the standard
> path). The raw D1 client and other helpers in this package are for direct Cloudflare binding access when OttaORM is
> not being used.

### D1 Raw SQL

```typescript
import { createD1Client } from '@ottabase/cf/d1';

const db = createD1Client({ database: env.OBCF_D1 });

// Query with type safety
const result = await db.query<User>('SELECT * FROM users WHERE id = ?', [userId]);

if (result.success) {
    console.log(result.data); // User[]
}

// Execute statements
await db.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['John', 'john@example.com']);

// Batch operations
await db.batch([
    { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
    { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
]);
```

### KV Storage

```typescript
import { createKVClient } from '@ottabase/cf/kv';

const kv = createKVClient({ namespace: env.MY_KV });

// Store JSON data
await kv.putJSON('user:123', { name: 'John', email: 'john@example.com' });

// Retrieve JSON data
const result = await kv.getJSON<User>('user:123');

// With expiration (TTL in seconds)
await kv.putJSON('session:abc', sessionData, { expirationTtl: 3600 });
```

### R2 Storage

```typescript
import { createR2Client } from '@ottabase/cf/r2';

const r2 = createR2Client({ bucket: env.MY_BUCKET });

// Upload file
await r2.put('files/document.pdf', fileBuffer, {
    httpMetadata: {
        contentType: 'application/pdf',
    },
});

// Download file
const result = await r2.get('files/document.pdf');
if (result.success && result.data) {
    const content = await result.data.arrayBuffer();
}

// List objects
const { data } = await r2.list({ prefix: 'files/' });
```

### Rate Limiting

```typescript
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';

const limiter = createRateLimitingClient({ rateLimiter: env.RATE_LIMITER });

// Check rate limit
const result = await limiter.limit({ key: `user:${userId}` });

if (!result.data.success) {
    return new Response('Too many requests', { status: 429 });
}
```

### Cache Keys (Multi-Tenant KV Scoping)

Type-safe, namespaced cache key builder for Cloudflare KV. Prevents cross-tenant collisions with consistent
`namespace:scope:id` formatting. All scope markers are 3-letter: `org`, `app`, `usr`.

```typescript
import { orgKey, userKey, orgAppUserKey } from '@ottabase/cf/cache-keys';

orgKey('brand', 'acme', 'brandkit'); // brand:org:acme:brandkit
userKey('session', 'user-123', 'active'); // session:usr:user-123:active
orgAppUserKey('rbac', 'acme', 'web', 'user-123', 'perms'); // rbac:org:acme:app:web:usr:user-123:perms
```

| Helper            | Key Pattern                            | Use case                |
| ----------------- | -------------------------------------- | ----------------------- |
| `globalKey`       | `ns:segments`                          | System-wide data        |
| `orgKey`          | `ns:org:{orgId}:segments`              | Tenant data             |
| `userKey`         | `ns:usr:{userId}:segments`             | User data               |
| `appKey`          | `ns:app:{appId}:segments`              | App configuration       |
| `orgAppKey`       | `ns:org:{orgId}:app:{appId}:segments`  | Tenant + app            |
| `orgUserKey`      | `ns:org:{orgId}:usr:{userId}:segments` | User within tenant      |
| `appUserKey`      | `ns:app:{appId}:usr:{userId}:segments` | User within app         |
| `orgAppUserKey`   | `ns:org:…:app:…:usr:…:segments`        | User in tenant's app    |
| `versionedOrgKey` | `ns:org:{orgId}:v{N}:segments`         | O(1) cache invalidation |

See [docs/CACHE_KEYS.md](../../docs/CACHE_KEYS.md) for full documentation.

### KV Read-Through Cache

`withCache` wraps an async fetcher with KV-backed caching — returns cached data on hit, calls the fetcher on miss:

```typescript
import { withCache, invalidateCache, invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { userKey } from '@ottabase/cf/cache-keys';

const profile = await withCache(env.OBCF_KV, userKey('auth', userId, 'profile'), 300, async () => {
    return db.query.users.findFirst({ where: eq(users.id, userId) });
});

// Invalidate single key or by prefix
await invalidateCache(env.OBCF_KV, key);
await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
```

### Vectorize

```typescript
import { createVectorizeClient } from '@ottabase/cf/vectorize';

const vectors = createVectorizeClient({ index: env.OBCF_VECTORIZE, namespace: orgId }); // one index, every tenant
await vectors.upsert([{ id: 'doc_1', values: embedding, metadata: { title: 'Pricing' } }]);
const hits = await vectors.query(queryEmbedding, { topK: 5, returnMetadata: 'all' }); // never another tenant's rows
```

### Workers AI

```typescript
import { createAiClient } from '@ottabase/cf/ai';

const ai = createAiClient({ ai: env.OBCF_AI, gateway: { id: 'my-gateway' } });
const embeddings = await ai.embed(['first chunk', 'second chunk']); // number[][] in input order
const answer = await ai.generateText('Summarise this ticket', { system: 'Be brief.' });
const raw = await ai.run('@cf/openai/whisper', { audio: bytes }); // anything else
```

For provider routing, customer keys and spend tracking use `@ottabase/ottaai`; this is the raw binding.

### Browser Rendering

```typescript
import { createBrowserClient } from '@ottabase/cf/browser';

const browser = createBrowserClient({ browser: env.OBCF_BROWSER });
const pdf = await browser.pdf({ html: invoiceHtml }, { pdfOptions: { format: 'a4', printBackground: true } });
const md = await browser.markdown({ url: 'https://example.com/docs' }); // what you feed a model
const data = await browser.json({ url }, { prompt: 'Extract the product name and price' });
```

Quick actions only; for a scripted session use `@cloudflare/puppeteer` against the same binding.

### Workflows

```typescript
import { createWorkflowsClient } from '@ottabase/cf/workflows';

const onboarding = createWorkflowsClient<{ userId: string }>({ workflow: env.ONBOARDING });
await onboarding.start({ userId }, { id: `onboarding-${userId}` }); // the id makes it idempotent
await onboarding.status(id);
await onboarding.sendEvent(id, 'email.verified');
```

### Durable Object alarms

```typescript
import { AlarmQueue } from '@ottabase/cf/durable-alarms';

class Ticket extends DurableObject {
    private alarms = new AlarmQueue<{ kind: 'sla' | 'reminder' }>(this.ctx.storage);
    async open() {
        await this.alarms.schedule('sla', Date.now() + 4 * 3_600_000, { kind: 'sla' });
        await this.alarms.schedule('reminder', Date.now() + 86_400_000, { kind: 'reminder' });
    }
    async alarm() {
        for (const due of await this.alarms.due()) await this.handle(due); // re-armed for the rest
    }
}
```

## Complete Documentation

For setup instructions, configuration, and Next.js integration, see the
[Cloudflare Features Documentation](../../docs/cloudflare-features.md).

## License

MIT
