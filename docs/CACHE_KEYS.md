# Cache Key Prefixing System

## Overview

The Ottabase cache layer uses a systematic, type-safe approach to building cache keys for Cloudflare KV storage. This
ensures cache integrity and prevents accidental overwrites across different scopes (organizations, users, apps).

## Key Format

All cache keys follow a consistent structure:

```
namespace:scope:id[:scope:id]:segments
```

### Components

- **Namespace**: Identifies the cache domain (e.g., `rbac`, `brand`, `auth`). Extensible — any string is accepted.
- **Scope**: Identifies the level (`org`, `usr` (user), `app`)
- **ID**: The identifier for that scope (e.g., organization ID, user ID)
- **Segments**: Additional descriptive parts (e.g., `brandkit`, `roles`, `perms`)
- **Version**: Optional versioning for O(1) invalidation (e.g., `v1`, `v2`)

## Scope Combinations

The system provides helpers for every meaningful scope combination in a multi-tenant SaaS:

| Helper            | Pattern                                       | Use case                              |
| ----------------- | --------------------------------------------- | ------------------------------------- |
| `globalKey`       | `namespace:segments`                          | System-wide data                      |
| `orgKey`          | `namespace:org:{orgId}:segments`              | Tenant data                           |
| `userKey`         | `namespace:usr:{userId}:segments`             | User data                             |
| `appKey`          | `namespace:app:{appId}:segments`              | App configuration                     |
| `orgAppKey`       | `namespace:org:{orgId}:app:{appId}:segments`  | Tenant-specific app data              |
| `orgUserKey`      | `namespace:org:{orgId}:usr:{userId}:segments` | User data within a tenant             |
| `appUserKey`      | `namespace:app:{appId}:usr:{userId}:segments` | User data within an app               |
| `orgAppUserKey`   | `namespace:org:...:app:...:usr:...:segments`  | User perms in a tenant's specific app |
| `versionedOrgKey` | `namespace:org:{orgId}:v{N}:segments`         | O(1) cache invalidation per tenant    |

## Examples

### Organization-Level Cache

```typescript
import { orgKey } from '@ottabase/cf/cache-keys';

// Brand kit cache
const key = orgKey('brand', 'acme-corp', 'brandkit');
// Result: brand:org:acme-corp:brandkit
```

### User-Level Cache

```typescript
import { userKey } from '@ottabase/cf/cache-keys';

// User preferences
const key = userKey('cache', 'user-123', 'preferences');
// Result: cache:usr:user-123:preferences
```

### App-Level Cache

```typescript
import { appKey } from '@ottabase/cf/cache-keys';

// App configuration
const key = appKey('config', 'web', 'settings');
// Result: config:app:web:settings
```

### Composite Org+App Cache

```typescript
import { orgAppKey } from '@ottabase/cf/cache-keys';

// Brand layout per org and app
const key = orgAppKey('brand', 'acme', 'web', 'layout', 'header');
// Result: brand:org:acme:app:web:layout:header
```

### Composite Org+User Cache

```typescript
import { orgUserKey } from '@ottabase/cf/cache-keys';

// RBAC roles per org and user
const key = orgUserKey('rbac', 'acme', 'user-123', 'roles');
// Result: rbac:org:acme:usr:user-123:roles
```

### Composite App+User Cache

```typescript
import { appUserKey } from '@ottabase/cf/cache-keys';

// User theme in mobile app
const key = appUserKey('config', 'mobile', 'user-123', 'theme');
// Result: config:app:mobile:usr:user-123:theme
```

### Composite Org+App+User Cache

```typescript
import { orgAppUserKey } from '@ottabase/cf/cache-keys';

// User permissions in org's web app
const key = orgAppUserKey('rbac', 'acme', 'web', 'user-123', 'perms');
// Result: rbac:org:acme:app:web:usr:user-123:perms
```

### Versioned Cache (O(1) Invalidation)

```typescript
import { versionedOrgKey, orgKey } from '@ottabase/cf/cache-keys';

// Version key for organization
const versionKey = orgKey('rbac', 'acme', 'version');
// Result: rbac:org:acme:version

// Versioned cache key
const cacheKey = versionedOrgKey('rbac', 'acme', 2, 'user', 'user-123', 'perms');
// Result: rbac:org:acme:v2:user:user-123:perms
```

## Read-Through Cache (`withCache`)

The `withCache` helper wraps a fetcher function with KV-backed caching. On cache hit it returns the stored value; on
miss it calls the fetcher, stores the result in KV, and returns it.

```typescript
import { withCache, invalidateCache, invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { userKey } from '@ottabase/cf/cache-keys';

// Read-through cache — fetcher only called on cache miss
const profile = await withCache(env.OBCF_KV, userKey('auth', userId, 'profile'), 300, async () => {
    return db.query.users.findFirst({ where: eq(users.id, userId) });
});

// Explicit invalidation (single key)
await invalidateCache(env.OBCF_KV, userKey('auth', userId, 'profile'));

// Prefix-based invalidation (all keys matching prefix)
const deleted = await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
```

## Cache Invalidation Patterns

### 1. Version-Based Invalidation (RBAC)

RBAC uses per-organization cache versions for O(1) invalidation. When a role or permission changes, the version is
incremented — all old cache keys become misses instantly without scanning or deleting entries.

```typescript
// On role change (automatically handled by RBACCache.invalidateOrganization)
// Old keys: rbac:org:acme:v1:usr:user-123:roles  → stale (never read again)
// New keys: rbac:org:acme:v2:usr:user-123:roles  → computed on next access
```

### 2. Eager Rewrite (Brand Engine)

Brand data is performance-critical — after a mutation, the cache is invalidated **then immediately re-resolved** so the
next request is a cache hit:

```typescript
// After brand kit mutation (handled by warmBrandCache in brand-kit-api)
await cache.invalidate(orgId, appId);
await Promise.all([
    resolveFullBrandConfig(env, { organizationId: orgId, appId, mode: 'light' }),
    resolveFullBrandConfig(env, { organizationId: orgId, appId, mode: 'dark' }),
]);
```

### 3. Prefix-Based Invalidation (Bulk)

When a broad scope needs clearing (e.g., user signs out), use prefix-based deletion:

```typescript
import { invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
```

### 4. Auth Session Revocation

Auth uses a revocation key per user. When a user signs out, a timestamp is written; the JWT callback checks this
timestamp and rejects tokens issued before it:

```typescript
// On signOut (automatic via @ottabase/auth)
await kv.put(userKey('auth', userId, 'revoked'), String(revokedAt), {
    expirationTtl: sessionMaxAge,
});
```

The auth package also exposes an `onSignOut` hook so apps can extend signout behavior (e.g., clearing RBAC cache)
without overriding the core event.

## Builder API

For more complex scenarios, use the `CacheKeyBuilder` class:

```typescript
import { CacheKeyBuilder } from '@ottabase/cf/cache-keys';

const key = CacheKeyBuilder.create('rbac')
    .org('acme-corp')
    .version(1)
    .app('web')
    .user('user-123')
    .segment('context')
    .build();

// Result: rbac:org:acme-corp:v1:app:web:usr:user-123:context
```

## Extensible Namespaces

The `CacheNamespace` type provides autocomplete for common namespaces while accepting **any string**:

```typescript
import { orgKey, userKey } from '@ottabase/cf/cache-keys';

// Built-in namespaces (autocomplete): rbac, brand, ratelimit, dedupe, session,
// config, cache, auth, system, temp

// Custom namespaces work too:
const key = orgKey('billing', 'acme', 'invoices');
// Result: billing:org:acme:invoices
```

## Safety Features

### 1. Automatic Sanitization

Colons and whitespace in IDs are automatically sanitized to prevent key structure corruption:

```typescript
const key = orgKey('brand', 'org:with:colons', 'test');
// Result: brand:org:org-with-colons:test (colons replaced with dashes)
```

### 2. Required Validation

Required IDs throw errors if empty:

```typescript
// Throws Error: "Organization ID is required"
CacheKeyBuilder.create('brand').org('').build();
```

### 3. Key Length Limit

Keys are validated against Cloudflare KV's 512-byte limit at build time:

```typescript
// Throws if the resulting key exceeds 512 bytes (measured in UTF-8)
CacheKeyBuilder.create('ns').segment('a'.repeat(520)).build();
```

### 4. Type Safety

TypeScript ensures correct namespace usage with autocomplete:

```typescript
import type { CacheNamespace } from '@ottabase/cf/cache-keys';

const namespace: CacheNamespace = 'rbac'; // autocomplete works
const custom: CacheNamespace = 'my-pkg'; // custom strings also accepted
```

## Usage by Package

### 1. Brand Engine (`@ottabase/brand-engine`)

```typescript
import { orgAppKey } from '@ottabase/cf/cache-keys';

const key = orgAppKey('brand', orgId, appId, 'resolved', mode);
// brand:org:acme:app:web:resolved:light
```

### 2. RBAC (`@ottabase/rbac`)

```typescript
// Format: rbac:org:{orgId}:v{version}:app:{appId}:usr:{userId}:context
```

### 3. Rate Limiting

```typescript
import { userKey, globalKey } from '@ottabase/cf/cache-keys';

// User-scoped rate limit
const key = userKey('ratelimit', userId, endpoint);
// ratelimit:usr:user-123:api-posts-create

// Global rate limit
const key = globalKey('ratelimit', ipAddress);
// ratelimit:{ipAddress}
```

### 4. Queue Deduplication (`@ottabase/queue`)

```typescript
// Org-scoped deduplication
dispatch('send-email', payload, {
    uniqueKey: 'welcome-email',
    organizationId: 'acme',
});
// dedupe:org:acme:send-email:welcome-email
```

## Best Practices

### 1. Always Use Organization Scope for Tenant Data

```typescript
// Good: Org-scoped prevents cross-tenant leaks
const key = orgKey('cache', organizationId, 'settings');

// Bad: Global key could leak across tenants
const key = globalKey('cache', 'settings');
```

### 2. Use Version Keys for O(1) Invalidation

Instead of deleting individual keys, increment a version number:

```typescript
// Store current version
const version = (await kv.get(orgKey('rbac', orgId, 'version'))) || '1';

// Build versioned cache key
const cacheKey = versionedOrgKey('rbac', orgId, version, 'user', userId, 'perms');

// To invalidate all cache for an org: increment the version
await kv.put(orgKey('rbac', orgId, 'version'), String(parseInt(version) + 1));
```

### 3. Use Helper Functions for Common Patterns

```typescript
// Good: Clear intent, type-safe
const key = userKey('session', userId, 'active');

// Less clear: manual string concatenation
const key = `session:usr:${userId}:active`;
```

### 4. Use the Most Specific Scope

```typescript
// Good: Scoped to the exact context
const key = orgAppUserKey('rbac', orgId, appId, userId, 'perms');

// Less precise: Missing app scope
const key = orgUserKey('rbac', orgId, userId, 'perms');
```

## Available Namespaces

| Namespace   | Purpose                | Example                              |
| ----------- | ---------------------- | ------------------------------------ |
| `rbac`      | RBAC permissions/roles | `rbac:org:acme:usr:user-123:roles`   |
| `brand`     | Brand kits and layouts | `brand:org:acme:app:web:layout`      |
| `ratelimit` | Rate limiting          | `ratelimit:usr:user-123:api-create`  |
| `dedupe`    | Job deduplication      | `dedupe:org:acme:email-send:msg-123` |
| `session`   | User sessions          | `session:usr:user-123:active`        |
| `config`    | Configuration          | `config:app:web:settings`            |
| `cache`     | General caching        | `cache:org:acme:feature-flags`       |
| `auth`      | Authentication         | `auth:usr:user-123:revoked`          |
| `system`    | System operations      | `system:maintenance`                 |
| `temp`      | Temporary data         | `temp:upload-12345`                  |

Custom namespaces are also accepted — any string works.

## Testing

```bash
pnpm test --filter=@ottabase/cf cache-keys
```
