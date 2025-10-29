# @ottabase/cf-data

Production-ready Cloudflare KV and D1 data layer with advanced caching support for edge applications.

## Features

- **Cloudflare KV Support**: Type-safe wrapper for Cloudflare KV storage
- **Cloudflare D1 Support**: Full D1 database support with Prisma adapter
- **Multi-Level Caching**: Memory + KV caching with TTL and refresh strategies
- **Stale-While-Revalidate**: Background revalidation for optimal performance
- **TypeScript First**: Complete type safety and IntelliSense support
- **Production Ready**: Error handling, logging, and edge-optimized
- **Modular Design**: Use only what you need with tree-shakeable exports

## Installation

```bash
pnpm add @ottabase/cf-data @cloudflare/workers-types
```

For D1 with Prisma support:

```bash
pnpm add @ottabase/cf-data @cloudflare/workers-types @prisma/client
```

## Quick Start

### Complete Data Layer

```typescript
import { createDataLayer } from '@ottabase/cf-data';

// In your Cloudflare Worker
export default {
  async fetch(request: Request, env: Env) {
    const dataLayer = createDataLayer({
      kv: env.MY_KV_NAMESPACE,
      d1: env.MY_D1_DATABASE,
      defaultCacheTtl: 3600,
      debug: true,
    });

    // Use KV
    await dataLayer.kv?.put('user:123', JSON.stringify({ id: 123, name: 'John' }));
    const user = await dataLayer.kv?.get('user:123', { type: 'json' });

    // Use Cache
    const cachedData = await dataLayer.cache?.getOrSet(
      'expensive-data',
      async () => {
        // Expensive operation
        return await fetchExpensiveData();
      },
      { ttl: 3600 }
    );

    // Use D1
    const result = await dataLayer.d1?.query(
      'SELECT * FROM users WHERE id = ?',
      [123]
    );

    return new Response(JSON.stringify({ user, cachedData, result }));
  },
};
```

## KV Store Usage

### Basic Operations

```typescript
import { createKVStore } from '@ottabase/cf-data/kv';

const kvStore = createKVStore(env.MY_KV_NAMESPACE);

// Put a value
await kvStore.put('user:123', JSON.stringify({ name: 'John' }), {
  expirationTtl: 3600, // 1 hour
  metadata: { version: 1 },
});

// Get a value
const user = await kvStore.get<{ name: string }>('user:123', {
  type: 'json',
});

// Get with metadata
const { value, metadata } = await kvStore.getWithMetadata('user:123');

// Delete a value
await kvStore.delete('user:123');

// List keys
const { keys, cursor } = await kvStore.list({
  prefix: 'user:',
  limit: 100,
});
```

### Batch Operations

```typescript
// Get multiple keys
const users = await kvStore.getMultiple(['user:1', 'user:2', 'user:3']);

// Put multiple keys
await kvStore.putMultiple([
  { key: 'user:1', value: JSON.stringify({ name: 'John' }) },
  { key: 'user:2', value: JSON.stringify({ name: 'Jane' }) },
]);

// Delete multiple keys
await kvStore.deleteMultiple(['user:1', 'user:2']);
```

## D1 Database Usage

### Basic Queries

```typescript
import { createD1Database } from '@ottabase/cf-data/d1';

const db = createD1Database(env.MY_D1_DATABASE);

// Execute a query
const result = await db.query<{ id: number; name: string }>(
  'SELECT * FROM users WHERE id = ?',
  [123]
);

// Get first result
const user = await db.queryFirst<{ id: number; name: string }>(
  'SELECT * FROM users WHERE id = ?',
  [123]
);

// Execute a non-query statement
await db.execute('INSERT INTO users (name) VALUES (?)', ['John']);
```

### Prepared Statements

```typescript
// Create a prepared statement
const stmt = db.prepare<{ id: number; name: string }>(
  'SELECT * FROM users WHERE id = ?'
);

// Bind parameters and execute
const result = await stmt.bind(123).all();
const firstUser = await stmt.bind(123).first();

// Execute without results
await db.prepare('DELETE FROM users WHERE id = ?').bind(123).run();
```

### Batch Operations

```typescript
const statements = [
  db.prepare('INSERT INTO users (name) VALUES (?)').bind('John'),
  db.prepare('INSERT INTO users (name) VALUES (?)').bind('Jane'),
  db.prepare('UPDATE users SET active = ? WHERE id = ?').bind(true, 1),
];

const results = await db.batch(statements);
```

### Transactions

```typescript
await db.transaction(async (tx) => {
  await tx.execute('INSERT INTO users (name) VALUES (?)', ['John']);
  await tx.execute('UPDATE accounts SET balance = balance - 100 WHERE id = ?', [1]);
  await tx.execute('UPDATE accounts SET balance = balance + 100 WHERE id = ?', [2]);
});
```

## Cache Usage

### KV Cache

```typescript
import { createKVCache } from '@ottabase/cf-data/cache';

const cache = createKVCache(kvStore, {
  defaultTtl: 3600,
  staleWhileRevalidate: true,
  staleTime: 60,
  keyPrefix: 'app:cache:',
  debug: true,
});

// Get or set with factory function
const data = await cache.getOrSet(
  'expensive-data',
  async () => {
    return await fetchExpensiveData();
  },
  { ttl: 3600 }
);

// Get with stale-while-revalidate
const dataWithSWR = await cache.getWithSWR(
  'user-profile',
  async () => {
    return await fetchUserProfile();
  },
  { ttl: 3600 }
);

// Manual cache operations
await cache.put('key', { data: 'value' }, { ttl: 1800 });
const value = await cache.get('key');
await cache.refresh('key', 3600);
await cache.delete('key');
```

### Memory Cache

```typescript
import { createMemoryCache } from '@ottabase/cf-data/cache';

const memCache = createMemoryCache({
  defaultTtl: 300, // 5 minutes
  keyPrefix: 'mem:',
});

await memCache.put('session:123', { userId: 123 }, { ttl: 600 });
const session = await memCache.get('session:123');
await memCache.clear(); // Clear all entries
```

### Multi-Level Cache

```typescript
import { createMultiLevelCache } from '@ottabase/cf-data/cache';

// Combines memory (L1) and KV (L2) caching
const mlCache = createMultiLevelCache(kvStore, {
  defaultTtl: 3600,
  staleWhileRevalidate: true,
});

// L1 (memory) is checked first, then L2 (KV)
// Both layers are populated on cache misses
const data = await mlCache.get('key');
await mlCache.put('key', data, { ttl: 3600 });
```

## Prisma Integration

### Setup Prisma with D1

```typescript
import { PrismaClient } from '@prisma/client';
import { createPrismaD1Adapter } from '@ottabase/cf-data/d1';

const adapter = createPrismaD1Adapter(env.MY_D1_DATABASE);
const prisma = new PrismaClient({
  adapter,
});

// Use Prisma as normal
const user = await prisma.user.findUnique({
  where: { id: 123 },
});

const users = await prisma.user.findMany({
  where: { active: true },
});
```

## Advanced Patterns

### Cache-Aside Pattern

```typescript
async function getUser(id: number) {
  const cacheKey = `user:${id}`;

  // Try cache first
  let user = await cache.get(cacheKey);
  if (user) return user;

  // Cache miss - fetch from database
  user = await db.queryFirst('SELECT * FROM users WHERE id = ?', [id]);

  // Store in cache
  if (user) {
    await cache.put(cacheKey, user, { ttl: 3600 });
  }

  return user;
}
```

### Write-Through Cache

```typescript
async function updateUser(id: number, data: UserData) {
  // Update database
  await db.execute(
    'UPDATE users SET name = ?, email = ? WHERE id = ?',
    [data.name, data.email, id]
  );

  // Update cache
  const cacheKey = `user:${id}`;
  await cache.put(cacheKey, data, { ttl: 3600 });
}
```

### Stale-While-Revalidate

```typescript
// Returns stale data immediately and revalidates in background
const data = await cache.getWithSWR(
  'api-response',
  async () => {
    const response = await fetch('https://api.example.com/data');
    return await response.json();
  },
  { ttl: 300 } // 5 minutes
);
```

## Type Definitions

The package exports all necessary TypeScript types:

```typescript
import type {
  ICache,
  IKVStore,
  ID1Database,
  CacheOptions,
  CacheEntry,
  KVGetOptions,
  KVPutOptions,
  D1Result,
  D1Params,
  DataLayerConfig,
  CacheConfig,
} from '@ottabase/cf-data';
```

## Configuration

### Data Layer Config

```typescript
interface DataLayerConfig {
  kv?: KVNamespace;
  d1?: D1Database;
  defaultCacheTtl?: number; // Default: 3600 seconds
  debug?: boolean; // Default: false
}
```

### Cache Config

```typescript
interface CacheConfig {
  defaultTtl?: number; // Default: 3600 seconds
  staleWhileRevalidate?: boolean; // Default: false
  staleTime?: number; // Default: 60 seconds
  keyPrefix?: string; // Default: 'cache:'
  debug?: boolean; // Default: false
}
```

## Best Practices

1. **Use Multi-Level Cache**: For frequently accessed data, use multi-level caching to minimize KV reads
2. **Set Appropriate TTLs**: Balance freshness with performance by setting appropriate cache TTLs
3. **Enable SWR for APIs**: Use stale-while-revalidate for external API calls to improve response times
4. **Namespace Your Keys**: Use key prefixes to organize and manage cache entries
5. **Handle Errors Gracefully**: All methods handle errors internally and log them for debugging
6. **Use Batch Operations**: When working with multiple keys, use batch operations for better performance
7. **Monitor Cache Hit Rates**: Enable debug mode during development to understand cache behavior

## Environment Variables

Define your Cloudflare bindings in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MY_KV_NAMESPACE"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "MY_D1_DATABASE"
database_name = "your-d1-database"
database_id = "your-d1-database-id"
```

## Performance Tips

- Use memory cache for hot data (frequently accessed within a single request)
- Use KV cache for warm data (accessed across multiple requests)
- Use D1 for cold data (long-term storage)
- Enable stale-while-revalidate for acceptable eventual consistency
- Batch KV operations when possible to reduce latency
- Use appropriate TTLs based on data freshness requirements

## License

MIT
