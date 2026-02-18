# @ottabase/rbac

Production-ready Role-Based Access Control with multi-tenant support and optimized caching.

## Features

- ✅ **Multi-tenant isolation** - Per-organization role scoping
- ✅ **Wildcard permissions** - `users:*`, `*:read`, `*:*`
- ✅ **Two-level caching** - Request + Cloudflare KV
- ✅ **Per-org cache versioning** - O(1) cache invalidation
- ✅ **App context support** - Tenant > App > User hierarchy
- ✅ **Type-safe** - Full TypeScript support
- ⚡ **Zero DB queries on cache hits**

## Installation

```bash
pnpm add @ottabase/rbac @ottabase/cf @ottabase/logger
```

## Quick Start

### 1. Database Setup

```bash
# Run migration (auto-applied or manual)
curl -X POST http://localhost:3004/api/ottaorm/init

# Seed default roles
pnpm --filter @ottabase/ottaorm seed:rbac
```

Creates tables: `roles`, `permissions`, `user_roles` Default roles: `owner`, `admin`, `member`

### 2. Initialize Cache

```typescript
import { initRBACCache } from '@ottabase/rbac';
import { createKVClient } from '@ottabase/cf';

// In your worker
const cache = initRBACCache({
    kv: createKVClient({ namespace: env.RBAC_KV }),
    ttl: 300, // 5 minutes
    prefix: 'rbac:', // Cache key prefix
});

// Cache keys are automatically tenant-scoped:
// rbac:org:org-123:v1:user:user-456
```

### 3. Assign Roles

```typescript
import { User, Role } from '@ottabase/ottaorm/models';

const user = await User.find('user-id');
const adminRole = await Role.findByName('admin');

// Assign role (org-scoped)
await user.assignRole(
    adminRole.id,
    currentUserId,
    organizationId, // Required for multi-tenant
);

// Verify
const isAdmin = await user.hasRole('admin', organizationId);
```

### 4. Check Permissions

```typescript
// Check permission (with cache)
const canEdit = await user.hasPermission('posts:edit', {
    cache,
    organizationId: 'org-123', // Tenant context
});

// Get all permissions
const permissions = await user.getPermissions({
    cache,
    organizationId: 'org-123',
});

// Get user roles
const roles = await user.roles({
    cache,
    organizationId: 'org-123',
});
```

## Multi-Tenant Architecture

### Hierarchy

```
System (Global)
├─ Roles: owner, admin, member
└─ Organization (Tenant)
   ├─ Custom Roles (org-scoped)
   ├─ Members with Roles
   └─ Apps (Optional)
      └─ Users + Permissions
```

### Organization-Scoped Roles

```typescript
// Create org-scoped role
const editorRole = await Role.create({
    name: 'editor',
    displayName: 'Content Editor',
    description: 'Can create and edit content',
    organizationId: 'org-123', // Scoped to org (null = system)
    permissions: ['posts:*', 'tags:read'],
});

// Assign to user in this org
await user.assignRole(editorRole.id, adminId, 'org-123');

// Check permission in org context
const canEditInOrgA = await user.hasPermission('posts:edit', {
    organizationId: 'org-123',
}); // true

// Same user, different org
const canEditInOrgB = await user.hasPermission('posts:edit', {
    organizationId: 'org-456',
}); // false (different permissions per org)
```

### App Context Integration

```typescript
import { buildAppContext, hasPermission } from '@ottabase/rbac';

// Build complete context
const context = await buildAppContext({
    organizationId: 'org-123',
    appId: 'web',
    user,
    cache,
});

// Context includes:
// {
//   organizationId: 'org-123',
//   tenantId: 'org-123',  // Alias
//   appId: 'web',
//   user: User,
//   roles: ['editor'],
//   permissions: ['posts:*', 'tags:read'],
//   isAuthenticated: true
// }

// Check permission from context
if (hasPermission(context, 'posts:edit')) {
    // User can edit posts
}
```

## Performance & Caching

### Two-Level Cache

1. **Request-level cache** - In-memory, 60s TTL
    - Zero latency on cache hits
    - Prevents duplicate queries in same request

2. **KV cache** - Cloudflare KV, 5min TTL
    - Shared across requests/workers
    - Per-organization versioning

**Performance:**

- First request: 2-3 DB queries
- Cached requests: **0 DB queries** ⚡

### Per-Org Cache Versioning

```typescript
// Cache keys include org ID and version:
// rbac:org:org-123:v1:user:user-456
// rbac:org:org-456:v1:user:user-456

// Invalidate ONE org's cache (O(1))
await cache.invalidateOrganization('org-123');
// Only increments version for org-123, not org-456
// New cache keys: rbac:org:org-123:v2:user:user-456
```

### Manual Cache Control

```typescript
// Invalidate specific user
await cache.invalidateUser('user-id');

// Invalidate all users with role (after permission changes)
await cache.invalidateRole('admin');

// Clear entire cache
await cache.clear();
```

## Permission Format

```typescript
// Format: resource:action
'users:read'; // Read users
'users:create'; // Create users
'users:update'; // Update users
'users:delete'; // Delete users
'users:*'; // All user operations

// Wildcards
'*:read'; // Read all resources
'*:*'; // Full access (superadmin)
```

## User Model Extensions

```typescript
const user = await User.find('user-id');

// Role management (org-scoped)
await user.assignRole(roleId, assignedBy?, organizationId?);
await user.removeRole(roleId, organizationId?);

// Role checks
await user.hasRole('admin', organizationId);
await user.hasAnyRole(['admin', 'editor'], organizationId);
await user.hasAllRoles(['editor', 'viewer'], organizationId);
await user.isAdmin(organizationId);

// Permission checks
await user.hasPermission('users:read', { organizationId, cache });
await user.hasAnyPermission(['users:read', 'posts:read'], { organizationId });
await user.hasAllPermissions(['users:read', 'users:create'], { organizationId });

// Get data
const permissions = await user.getPermissions({ organizationId, cache });
const roles = await user.roles({ organizationId, cache });
```

## Context Utilities

```typescript
import {
    buildAppContext,
    extractOrganizationId,
    extractAppId,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
    isOwnerOrAdmin,
} from '@ottabase/rbac';

// Extract tenant ID from request
const orgId = await extractOrganizationId({
    request,
    headerName: 'X-Org-Id', // Default
    queryParam: 'organizationId', // Default
    subdomainPrefix: 'org-', // acme.app.com → org-acme
});

// Extract app ID from request
const appId = extractAppId({
    request,
    headerName: 'X-App-Id',
    queryParam: 'appId',
    env,
    defaultAppId: 'web',
});

// Build context
const context = await buildAppContext({
    organizationId: orgId,
    appId,
    user,
    cache,
    ipAddress: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
});

// Use context helpers
if (hasPermission(context, 'posts:edit')) {
}
if (hasAnyRole(context, ['admin', 'editor'])) {
}
if (isOwnerOrAdmin(context)) {
}
```

## Default Roles

| Role     | Permissions        | Description                     |
| -------- | ------------------ | ------------------------------- |
| `owner`  | `*:*`              | Full organization control       |
| `admin`  | `*:*` (org-scoped) | Manage org members and settings |
| `member` | `*:read`           | Basic read access               |

Create custom roles:

```typescript
const role = await Role.create({
    name: 'content-manager',
    displayName: 'Content Manager',
    description: 'Manage all content',
    organizationId: 'org-123', // null = system role
    permissions: ['posts:*', 'tags:*', 'media:*'],
});
```

## Two Modes

### Multi-Tenant SaaS

```typescript
// Each org is isolated
await user.hasPermission('posts:edit', {
    organizationId: 'org-acme', // Required
});
```

### Single Founder

```typescript
// No org required (set organizationId: null or omit)
await user.hasPermission('posts:edit', {
    organizationId: null, // Global context
});
```

## Integration Examples

### Worker Route

```typescript
// Cloudflare Worker
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // Build context
        const orgId = await extractOrganizationId({ request });
        const user = await getCurrentUser(request, env);

        const context = await buildAppContext({
            organizationId: orgId,
            appId: 'web',
            user,
            cache: initRBACCache({ kv: createKVClient({ namespace: env.RBAC_KV }) }),
        });

        // Check permission
        if (!hasPermission(context, 'posts:create')) {
            return new Response('Forbidden', { status: 403 });
        }

        // ... handle request
    },
};
```

### Audit Integration

```typescript
import { logCreate } from '@ottabase/audit';
import { createAuditData } from '@ottabase/rbac';

// Create audit log from context
const auditData = createAuditData(context, 'create', 'post', postId, { title: 'New Post' });

await logCreate('post', postId, postData, {
    ...auditData,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
});
```

## Related Packages

- **@ottabase/audit** - Audit logging with RBAC context
- **@ottabase/ottaorm** - Models (User, Role, Permission, Organization)
- **@ottabase/cf** - KVClient for caching
- **@ottabase/logger** - Structured logging

## Documentation

- **RBAC_MULTI_TENANT_GUIDE.md** - Complete guide with UI examples
- **TENANT_ISOLATION.md** - Security and isolation details
- **packages/ottaorm/README.md** - Model usage and patterns

## License

MIT
