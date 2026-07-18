# @ottabase/rbac

Production-ready Role-Based Access Control with multi-tenant support and optimized caching.

## Features

- **Multi-tenant isolation** - Per-organization role scoping
- **Wildcard permissions** - `users:*`, `*:read`, `*:*`
- **Two-level caching** - Request + Cloudflare KV
- **Per-org cache versioning** - O(1) cache invalidation
- **App context support** - Tenant > App > User hierarchy
- **Route guards & middleware** - `withRBAC` for Next.js/Worker routes, plus request-context and admin-guard helpers for API handlers
- **Type-safe** - Full TypeScript support
- **Zero DB queries on cache hits**

## Installation

```bash
pnpm add @ottabase/rbac @ottabase/cf @ottabase/logger
```

## Quick Start

### 1. Database Setup

```bash
# Run migration (auto-applied or manual)
curl -X POST http://localhost:3004/api/ottaorm/init
```

Creates tables: `roles`, `permissions`, `user_roles` Default roles: `platform_owner`, `owner`, `admin`, `member`

The default roles/permissions seed logic (`seedRoles`, `seedPermissions`, or the combined `seedRBAC`) lives in
`packages/ottaorm/src/seed/rbac.ts`, but it isn't wired to a pnpm script or CLI yet. Until that's added, seed manually
by running that module directly or by creating roles yourself via `Role.create()` (see
[Default Roles](#default-roles) below).

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
├─ Roles: platform_owner, owner, admin, member
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
// Invalidate specific user (org-scoped)
await cache.invalidateUser('user-id', 'org-123');

// Invalidate all cached data for an org (e.g. after bulk role/permission changes) - O(1)
await cache.invalidateOrganization('org-123');

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

**Note:** [@ottabase/ottaorm](../ottaorm/README.md) RLS `requiredPermissions` uses the same wildcard semantics (`*:*`,
`brand:*`, `*:edit`), so admins with `*:*` pass RLS checks for models like menus that require `brand:edit`.

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
// Permission-based (platform:admin or org:admin, or *:*) — NOT a role-name check like hasAnyRole above
if (isOwnerOrAdmin(context)) {
}
```

## Middleware & Route Guards

Beyond the App Context helpers above, `@ottabase/rbac` ships a middleware layer for guarding Next.js/Worker API
routes directly, plus request-context and admin-guard utilities for building custom handlers.

### `withRBAC` (Next.js / Worker routes)

```typescript
import { withRBAC } from '@ottabase/rbac/middleware';

export const GET = withRBAC(
    async (request, context) => {
        return Response.json({ success: true });
    },
    { permissions: ['users:read'] }, // or { roles: ['admin'] }
);
// Returns 401 if unauthenticated, 403 if the permission/role check fails
```

For ad-hoc checks (throws `RBACError` instead of returning a Response), use `checkPermission` / `checkRole`, or the
`requirePermission` / `requireRole` method decorators — all exported from `@ottabase/rbac/middleware`.

### Request Context & Admin Guards

`getRequestContext` builds a full `RequestContext` (session user, resolved organization, merged system + org-scoped
roles/permissions) straight from a `Request`/`env`, resolving the org from session, header, query param, or subdomain:

```typescript
import { getRequestContext, SYSTEM_ORGANIZATION_ID } from '@ottabase/rbac/request-context';
import { assertAdmin, assertBrandEditAccess } from '@ottabase/rbac/admin-guard';

const context = await getRequestContext(request, env, { cache });

// Require org:admin for the org (or platform:admin/*:* for system scope) — permission + scope,
// never a role NAME; see "Default Roles" below for the platform-admin vs org-admin distinction
const admin = assertAdmin(context, { scope: 'organization' });
if (admin instanceof Response) return admin; // 401/403
const { user, organizationId } = admin;

// Permission check for scoped operations like brand editing — requires the permission from a
// SYSTEM-scoped grant specifically, so an org admin holding it only org-scoped is still denied
const access = assertBrandEditAccess(context, { permission: 'brand:edit', organizationId: context.organizationId });
if (access instanceof Response) return access;
```

`requireAdminAccess(buildContext, options)` wraps `getRequestContext` + `assertAdmin` in one call. For a plain
boolean instead of a Response-returning gate, `isPlatformAdmin(context)` / `isOrgAdmin(context)` (also exported from
`@ottabase/rbac`) expose the same two checks directly. `SYSTEM_ORGANIZATION_ID` marks the system (non-tenant) scope
used by system-scoped grants.

## Default Roles

| Role             | Permissions                             | Description                                             |
| ---------------- | --------------------------------------- | ------------------------------------------------------- |
| `platform_owner` | `*:*`                                   | Bootstrapped app owner (system-scoped → platform:admin) |
| `owner`          | org bundle incl. `org:admin` (no `*:*`) | Full org control (own tenant)                           |
| `admin`          | org bundle incl. `org:admin` (no `*:*`) | Organization administrator (own tenant)                 |
| `member`         | `*:read`                                | Basic read access                                       |

> **Authorization is permission + scope, never role NAME.** Platform authority requires a **system-scoped** grant
> carrying `platform:admin` (or `*:*`) — only `platform_owner` has it. Org admins hold `org:admin` **org-scoped**.
> `assertAdmin(ctx, { scope: 'system' | 'organization' | 'either' })` reads `ctx.systemPermissions` for platform scope
> and `ctx.permissions` for org scope; there is no role-name check. RLS `AdminOnly()` sets `requirePlatformAdmin`
> (checked against the scope-aware `platformAdmin` flag). `Role.ensureDefaultRoles()` is create-if-missing by default;
> `ensureDefaultRoles({ heal: true })` (run from `/__bootstrap__/seed`) additionally reconciles existing system-role
> permission sets to the canonical values and refreshes affected sessions.

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
