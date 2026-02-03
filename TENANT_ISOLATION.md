# Tenant Isolation Strategy

## Overview

This document describes the multi-tenant security architecture that prevents cross-tenant data leaks.

**Hierarchy**: Tenant (Organization) > App > User

The system supports two modes:
1. **Multi-tenant SaaS**: Multiple organizations with strict tenant isolation
2. **Single founder**: One user running multiple apps (organizationId = null)

## Database-Level Isolation

### Automatic Tenant Scoping (NEW)

**Package**: `@ottabase/ottaorm/crud/tenant-aware`

The tenant-aware CRUD wrapper automatically enforces tenant isolation:

```typescript
import { tenantAwareCrudMiddleware } from '@ottabase/ottaorm';

// In your worker:
if (url.pathname.startsWith('/api/ottaorm/')) {
  return tenantAwareCrudMiddleware({
    request,
    url,
    getUser: async () => {
      const session = await getSession(request, env);
      return session?.user || null;
    },
    env,
    allowNullTenant: true, // Enable single-founder mode
  });
}
```

### Features

1. **Automatic organizationId Injection**
   - GET queries: Adds `organizationId` to `where` clause
   - POST requests: Adds `organizationId` to body
   - PATCH/PUT: Validates resource belongs to user's org
   - DELETE: Validates resource belongs to user's org

2. **Cross-Tenant Access Prevention**
   - Blocks attempts to access other organizations' data
   - Logs security violations
   - Returns 403 Forbidden for unauthorized access

3. **Model-Based Scoping**
   - Tenant-scoped models: organizations, organization_members, roles, permissions, user_roles, audit_logs
   - Admin-only models: users, accounts, sessions (blocked from generic CRUD)
   - Customizable per-model rules

4. **Organization Extraction**
   - Header: `X-Organization-Id`
   - Subdomain: `acme.yourapp.com` → `org-acme`
   - Query param: `?organizationId=org-123`
   - JWT claim: `token.organizationId`

## Cache Isolation

### RBAC Cache (Already Implemented)

**Package**: `@ottabase/rbac`

The RBAC cache enforces per-organization isolation:

```typescript
import { initRBACCache } from '@ottabase/rbac';

const cache = initRBACCache({
  kv: createKVClient({ namespace: env.RBAC_KV }),
  ttl: 300,
});

// All cache operations require organizationId
const context = await cache.getUserContext(userId, organizationId, appId);
```

**Features**:
- Cache keys include org ID: `rbac:org:org-123:v1:app:web:user:user-456`
- Per-organization cache versioning (O(1) invalidation)
- Request-level in-memory cache + KV cache
- Invalidate one org without affecting others

## Security Checklist

### ✅ Implemented

- [x] RBAC cache with per-org versioning
- [x] Tenant-aware CRUD middleware
- [x] organizationId validation on all queries
- [x] Cross-tenant access logging
- [x] Audit logs with organizationId
- [x] Cache key prefixing with org ID
- [x] Extract org ID from headers/subdomain/query/JWT

### 📋 TODO (Integration)

- [ ] Update worker to use `tenantAwareCrudMiddleware`
- [ ] Update audit utils to always include organizationId/appId
- [ ] Add integration tests for cross-tenant access attempts
- [ ] Document org extraction strategy for deployment

## API Security Model

### Tenant-Scoped Models

These models automatically get `organizationId` injected:

```typescript
// organizations - Tenant entities
// organization_members - User memberships
// roles - Can be org-scoped or system-wide
// permissions - Can be org-scoped or system-wide
// user_roles - User role assignments (always org-scoped)
// audit_logs - Audit trail (always org-scoped)
```

### Admin-Only Models

These models are blocked from generic CRUD endpoints:

```typescript
// users - Use dedicated auth endpoints
// accounts - OAuth accounts
// sessions - Active sessions
// verification_tokens - Email verification
// authenticators - 2FA/passkeys
```

## Example: Multi-Tenant vs Single Founder

### Multi-Tenant SaaS

```typescript
// User belongs to organization "acme"
// Request includes: X-Organization-Id: org-acme

// GET /api/ottaorm/organizations → Only returns user's orgs
// GET /api/ottaorm/organization_members?organizationId=org-acme → Members of acme
// POST /api/ottaorm/roles { name: "editor" } → Role scoped to org-acme
```

### Single Founder Mode

```typescript
// allowNullTenant: true
// No organizationId required

// GET /api/ottaorm/apps → User's apps (no org context)
// POST /api/ottaorm/apps { name: "my-app" } → Create app (organizationId = null)
```

## Configuration

### Worker Integration

```typescript
// apps/your-worker/src/index.ts
import { tenantAwareCrudMiddleware } from '@ottabase/ottaorm';
import { extractOrganizationId } from '@ottabase/rbac';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Tenant-aware CRUD endpoints
    if (url.pathname.startsWith('/api/ottaorm/')) {
      return tenantAwareCrudMiddleware({
        request,
        url,
        getUser: async () => {
          const session = await getSession(request, env);
          return session?.user || null;
        },
        env,
        allowNullTenant: env.ALLOW_NULL_TENANT === 'true',
      });
    }

    // ... other routes
  }
};
```

### Environment Variables

```bash
# .env
ALLOW_NULL_TENANT=true  # Enable single-founder mode
```

## Audit Logging

All operations are logged with tenant context:

```typescript
import { logCreate, logUpdate, logDelete } from '@ottabase/audit';
import { extractRequestContext } from '@ottabase/audit';

// Extract context with org ID
const context = {
  ...extractRequestContext(request, user?.id, user?.email),
  organizationId,
  appId,
};

// Log operations
await logCreate('organization', orgId, data, context);
await logUpdate('role', roleId, changes, context);
await logDelete('member', memberId, context);
```

## Testing

### Cross-Tenant Access Test

```typescript
// User in org-acme tries to access org-beta's data
const response = await fetch('/api/ottaorm/organization_members/member-123', {
  headers: {
    'X-Organization-Id': 'org-acme', // User's org
  },
});

// member-123 belongs to org-beta
// Expected: 403 Forbidden or 404 Not Found
```

### Cache Isolation Test

```typescript
// User A in org-acme
const contextA = await cache.getUserContext('user-a', 'org-acme');

// User B in org-beta
const contextB = await cache.getUserContext('user-b', 'org-beta');

// Cache keys are different:
// rbac:org:org-acme:v1:user:user-a
// rbac:org:org-beta:v1:user:user-b

// Invalidating org-acme doesn't affect org-beta
await cache.invalidateOrganization('org-acme');
```

## Migration Path

If you're upgrading from the basic CRUD handler:

1. **Update imports**:
   ```typescript
   // Before
   import { parseCrudRequest, handleCrud } from '@ottabase/ottaorm';

   // After
   import { tenantAwareCrudMiddleware } from '@ottabase/ottaorm';
   ```

2. **Update route handler**:
   ```typescript
   // Before
   const crudRequest = await parseCrudRequest(request, url);
   const result = await handleCrud(crudRequest);
   return new Response(JSON.stringify(result.data));

   // After
   return tenantAwareCrudMiddleware({
     request,
     url,
     getUser: async () => getAuthenticatedUser(request),
     env,
     allowNullTenant: true,
   });
   ```

3. **Test cross-tenant access**:
   - Attempt to access another org's data
   - Verify 403 responses
   - Check audit logs for violations

## Security Best Practices

1. **Always use tenantAwareCrudMiddleware** for generic CRUD endpoints
2. **Never trust client-provided organizationId** - extract from auth context
3. **Log all security violations** for monitoring
4. **Use per-org cache keys** for all cached data
5. **Validate org ownership** before PATCH/DELETE operations
6. **Include organizationId** in all audit logs
7. **Test cross-tenant scenarios** in integration tests

## References

- `packages/ottaorm/src/crud/tenant-aware.ts` - Tenant-aware CRUD implementation
- `packages/rbac/src/cache.ts` - Per-org cache implementation
- `packages/rbac/src/app-context.ts` - Organization extraction utilities
- `packages/audit/src/types.ts` - Audit log types with org/app context
