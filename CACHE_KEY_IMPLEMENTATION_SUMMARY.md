# Cache Key Prefixing System - Implementation Summary

## Overview

This PR implements a comprehensive, type-safe cache key prefixing system for the Ottabase monorepo. The system ensures
cache integrity by enforcing consistent, namespaced keys across all KV cache operations, preventing accidental
overwrites and cross-tenant data leaks.

## Problem Statement

Before this implementation:

- Cache keys were manually constructed with string concatenation
- No consistent prefixing strategy across packages
- Risk of cache key collisions between different scopes (org, user, app)
- Potential for cross-tenant data leaks in multi-tenant environments
- No validation or sanitization of cache key components

## Solution

### 1. Cache Key Builder (`@ottabase/cf/cache-keys`)

A centralized, type-safe utility for building cache keys with:

- **Namespaces**: `rbac`, `brand`, `ratelimit`, `dedupe`, `session`, `config`, `cache`, `system`, `temp`
- **Scopes**: `org`, `user` (u), `app`, `global`, `system`
- **Automatic sanitization**: Removes colons and whitespace
- **Validation**: Required IDs throw errors if empty
- **Type safety**: TypeScript ensures correct types

### 2. Helper Functions

```typescript
import { orgKey, userKey, appKey, orgAppKey, orgUserKey, versionedOrgKey, globalKey } from '@ottabase/cf/cache-keys';

// Organization-scoped
orgKey('brand', 'acme', 'brandkit');
// → brand:org:acme:brandkit

// User-scoped
userKey('session', 'user-123', 'active');
// → session:u:user-123:active

// App-scoped
appKey('config', 'web', 'settings');
// → config:app:web:settings

// Composite org+app
orgAppKey('brand', 'acme', 'web', 'layout', 'header');
// → brand:org:acme:app:web:layout:header

// Versioned (O(1) invalidation)
versionedOrgKey('rbac', 'acme', 2, 'cache');
// → rbac:org:acme:v2:cache
```

## Changes Made

### 1. Core Package (`@ottabase/cf`)

**New Files:**

- `src/cache-keys.ts` - Cache key builder implementation
- `src/__tests__/cache-keys.test.ts` - Comprehensive tests (46 tests)

**Updated Files:**

- `src/index.ts` - Export cache key utilities
- `package.json` - Add cache-keys to build and exports

### 2. Brand Engine (`@ottabase/brand-engine`)

**Updated Files:**

- `src/persistence/cache.ts` - Use `orgAppKey()` for brand cache
- `package.json` - Add `@ottabase/cf` dependency

**Before:**

```typescript
const key = `brand:resolved:${orgId}:${appId}:${mode}`;
```

**After:**

```typescript
import { orgAppKey } from '@ottabase/cf/cache-keys';
const key = orgAppKey('brand', orgId, appId, 'resolved', mode);
```

### 3. Rate Limiting

**Updated Files:**

- `apps/ottabase-template-app-tanstack/worker/lib/rate-limiting.ts`

**Before:**

```typescript
const rateLimitKey = `ratelimit:${key}`;
```

**After:**

```typescript
import { userKey, globalKey } from '@ottabase/cf/cache-keys';
const rateLimitKey = buildRateLimitKey(key, scope);
// Supports both user-scoped and global scoping
```

### 4. Queue Deduplication (`@ottabase/queue`)

**Updated Files:**

- `src/types.ts` - Add `organizationId` to DispatchOptions
- `src/job.ts` - Implement scoped deduplication keys

**Before:**

```typescript
const key = `dedupe:${type}:${options.uniqueKey}`;
```

**After:**

```typescript
function buildDedupeKey(type: string, uniqueKey: string, organizationId?: string): string {
    if (organizationId) {
        return `dedupe:org:${sanitize(organizationId)}:${sanitize(type)}:${sanitize(uniqueKey)}`;
    }
    return `dedupe:${sanitize(type)}:${sanitize(uniqueKey)}`;
}
```

**Usage:**

```typescript
// Org-scoped deduplication
dispatcher.dispatch('send-email', payload, {
    uniqueKey: 'welcome-email',
    organizationId: 'acme',
});
// → dedupe:org:acme:send-email:welcome-email

// Global deduplication
dispatcher.dispatch('send-email', payload, {
    uniqueKey: 'welcome-email',
});
// → dedupe:send-email:welcome-email
```

## Documentation

**New Documentation:**

- `docs/CACHE_KEYS.md` - Comprehensive usage guide with:
    - Format specification
    - Usage examples for each helper
    - Real-world scenarios
    - Best practices and anti-patterns
    - Migration guide
    - Security benefits

## Security Benefits

1. **Namespace Isolation**: Each cache domain has its own prefix preventing collisions
2. **Scope Enforcement**: Organization/user/app scoping prevents cross-tenant data leaks
3. **Input Sanitization**: Automatic removal of colons and whitespace prevents key injection
4. **Required Validation**: Empty IDs throw errors, preventing invalid keys
5. **Type Safety**: TypeScript ensures correct namespace and scope types at compile time

## Test Coverage

**Cache Keys Tests:** 46 tests, all passing ✅

- Basic construction
- Organization/user/app scoping
- Version support
- Composite scopes
- Sanitization
- Validation
- Helper functions
- Parsing
- Real-world examples

**Queue Tests:** 39 tests, all passing ✅

- Deduplication with organizationId
- All existing functionality maintained

## Build Status

✅ `@ottabase/cf` - Builds successfully ✅ `@ottabase/brand-engine` - Builds successfully  
✅ `@ottabase/queue` - Builds successfully  
✅ Type checking passes for all updated packages

## Breaking Changes

**None.** This is a non-breaking addition:

- All changes are additive (new utilities)
- Existing cache implementations continue to work
- RBAC cache already had good scoping (no changes)
- Updated implementations are backwards compatible

## Migration Path

For existing caches using manual string construction:

1. **Identify the scope** (org, user, app, composite)
2. **Choose the appropriate helper** (`orgKey`, `userKey`, etc.)
3. **Update the key construction**
4. **Test cache hits/misses**

Example:

```typescript
// Before
const key = `brand:${orgId}:${appId}:layout`;

// After
import { orgAppKey } from '@ottabase/cf/cache-keys';
const key = orgAppKey('brand', orgId, appId, 'layout');
```

## Future Enhancements

Potential improvements:

1. Cache key metrics tracking (hit/miss rates by namespace)
2. Default TTLs by namespace type
3. Runtime validation of key structure
4. Key compression for very long IDs
5. Predefined templates for common patterns

## Rollout Plan

1. ✅ Implement core cache key builder
2. ✅ Add comprehensive tests
3. ✅ Update Brand Engine cache
4. ✅ Update rate limiting
5. ✅ Update queue deduplication
6. ✅ Add documentation
7. ⏳ Code review and approval
8. ⏳ Monitor cache behavior post-merge
9. ⏳ Gradually migrate remaining manual cache keys

## Monitoring

After deployment, monitor:

- Cache hit/miss rates remain stable
- No unexpected cache invalidations
- No cross-tenant data leaks
- Key lengths stay within KV limits (512 bytes)

## Related Issues

Closes: #[issue-number]

## Reviewers

This PR touches cache layer infrastructure. Please review:

- Cache key format and structure
- Security implications (scoping, sanitization)
- Impact on existing cache implementations
- Documentation completeness

---

**Summary:** This implementation provides a robust, type-safe foundation for all future KV cache operations in the
Ottabase monorepo, ensuring cache integrity and preventing cross-tenant data leaks.
