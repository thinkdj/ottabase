# Cache Key Prefixing System

## Overview

The Ottabase cache layer uses a systematic, type-safe approach to building cache keys for Cloudflare KV storage. This
ensures cache integrity and prevents accidental overwrites across different scopes (organizations, users, apps).

## Key Format

All cache keys follow a consistent structure:

```
namespace:scope:id:scope:id:...segments
```

### Components

- **Namespace**: Identifies the cache domain (e.g., `rbac`, `brand`, `ratelimit`, `dedupe`)
- **Scope**: Identifies the level (`org`, `u` (user), `app`, `global`)
- **ID**: The identifier for that scope (e.g., organization ID, user ID)
- **Segments**: Additional descriptive parts (e.g., `brandkit`, `roles`, `perms`)
- **Version**: Optional versioning for O(1) invalidation (e.g., `v1`, `v2`)

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
// Result: cache:u:user-123:preferences
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
// Result: rbac:org:acme:u:user-123:roles
```

### Versioned Cache (O(1) Invalidation)

```typescript
import { versionedOrgKey } from '@ottabase/cf/cache-keys';

// Version key for organization
const versionKey = orgKey('rbac', 'acme', 'version');
// Result: rbac:org:acme:version

// Versioned cache key
const cacheKey = versionedOrgKey('rbac', 'acme', 2, 'user', 'user-123', 'perms');
// Result: rbac:org:acme:v2:user:user-123:perms
```

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

// Result: rbac:org:acme-corp:v1:app:web:u:user-123:context
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
// ❌ Throws Error: "Organization ID is required for org scope"
CacheKeyBuilder.create('brand').org('').build();
```

### 3. Type Safety

TypeScript ensures correct namespace and scope types:

```typescript
import { CacheNamespace } from '@ottabase/cf/cache-keys';

const namespace: CacheNamespace = 'rbac'; // ✅ Valid
const namespace: CacheNamespace = 'invalid'; // ❌ Type error
```

## Usage by Package

### 1. Brand Engine (`@ottabase/brand-engine`)

```typescript
// packages/brand-engine/src/persistence/cache.ts
import { orgAppKey } from '@ottabase/cf/cache-keys';

const key = orgAppKey('brand', orgId, appId, 'resolved', mode);
// brand:org:acme:app:web:resolved:light
```

### 2. RBAC (`@ottabase/rbac`)

The RBAC cache already uses a comprehensive scoped system:

```typescript
// packages/rbac/src/cache.ts
// Format: rbac:org:{orgId}:v{version}:app:{appId}:u:{userId}:context
```

### 3. Rate Limiting

```typescript
// apps/*/worker/lib/rate-limiting.ts
import { userKey, globalKey } from '@ottabase/cf/cache-keys';

// User-scoped rate limit
const key = userKey('ratelimit', userId, endpoint);
// ratelimit:u:user-123:api-posts-create

// Global rate limit
const key = globalKey('ratelimit', ipAddress);
// ratelimit:{ipAddress}
```

### 4. Queue Deduplication (`@ottabase/queue`)

```typescript
// packages/queue/src/job.ts
// Org-scoped deduplication
dispatch('send-email', payload, {
    uniqueKey: 'welcome-email',
    organizationId: 'acme',
});
// dedupe:org:acme:send-email:welcome-email

// Global deduplication
dispatch('send-email', payload, {
    uniqueKey: 'welcome-email',
});
// dedupe:send-email:welcome-email
```

## Best Practices

### 1. Always Use Organization Scope for Tenant Data

```typescript
// ✅ Good: Org-scoped prevents cross-tenant leaks
const key = orgKey('cache', organizationId, 'settings');

// ❌ Bad: Global key could leak across tenants
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
// ✅ Good: Clear intent, type-safe
const key = userKey('session', userId, 'active');

// ❌ Less clear: manual string concatenation
const key = `session:u:${userId}:active`;
```

### 4. Scope Deduplication Keys

For multi-tenant systems, scope deduplication to prevent conflicts:

```typescript
// ✅ Good: Org-scoped deduplication
dispatch('send-email', payload, {
    uniqueKey: `user-${userId}`,
    organizationId: orgId,
});

// ❌ Bad: Could conflict across orgs
dispatch('send-email', payload, {
    uniqueKey: `user-${userId}`,
});
```

## Parsing Cache Keys

For debugging and monitoring, parse cache keys to extract components:

```typescript
import { parseKey } from '@ottabase/cf/cache-keys';

const parsed = parseKey('rbac:org:acme:v2:app:web:u:user-123:perms');

console.log(parsed);
// {
//   namespace: 'rbac',
//   scope: 'user', // Last scope in key
//   orgId: 'acme',
//   appId: 'web',
//   userId: 'user-123',
//   version: '2',
//   segments: ['perms']
// }
```

## Available Namespaces

| Namespace   | Purpose                | Example                              |
| ----------- | ---------------------- | ------------------------------------ |
| `rbac`      | RBAC permissions/roles | `rbac:org:acme:u:user-123:roles`     |
| `brand`     | Brand kits and layouts | `brand:org:acme:app:web:layout`      |
| `ratelimit` | Rate limiting          | `ratelimit:u:user-123:api-create`    |
| `dedupe`    | Job deduplication      | `dedupe:org:acme:email-send:msg-123` |
| `session`   | User sessions          | `session:u:user-123:active`          |
| `config`    | Configuration          | `config:app:web:settings`            |
| `cache`     | General caching        | `cache:org:acme:feature-flags`       |
| `temp`      | Temporary data         | `temp:upload-12345`                  |

## Migration Guide

### Updating Existing Cache Keys

When migrating existing code to use the new cache key builder:

1. **Identify the scope** (org, user, app, composite)
2. **Choose the appropriate helper** (`orgKey`, `userKey`, `appKey`, etc.)
3. **Update the key construction**
4. **Test thoroughly** to ensure cache hits/misses work correctly

#### Example Migration

Before:

```typescript
const key = `brand:resolved:${orgId}:${appId}:${mode}`;
```

After:

```typescript
import { orgAppKey } from '@ottabase/cf/cache-keys';

const key = orgAppKey('brand', orgId, appId, 'resolved', mode);
```

### Handling Default Values

The builder handles null/undefined by using 'default':

```typescript
const key = orgAppKey('brand', null, null, 'resolved', 'light');
// Result: brand:org:default:app:default:resolved:light
```

## Testing

Comprehensive tests are available in `packages/cf/src/__tests__/cache-keys.test.ts`:

```bash
pnpm test --filter=@ottabase/cf cache-keys
```

## Future Enhancements

Potential improvements to consider:

1. **Cache key metrics**: Track cache hit/miss rates by namespace and scope
2. **Automatic expiration**: Default TTLs by namespace type
3. **Key validation**: Runtime validation of key structure
4. **Key compression**: Shorten keys for very long IDs
5. **Key templates**: Predefined templates for common patterns

## Support

For questions or issues with the cache key system, please:

1. Review this documentation
2. Check the test file for examples
3. Open an issue in the repository
