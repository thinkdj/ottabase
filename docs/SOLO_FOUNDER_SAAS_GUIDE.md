# Solo Founder's SaaS Platform Guide

**Build production-ready multi-tenant SaaS from your home office**

Welcome to Ottabase - the all-batteries-included monorepo for solo founders who want to ship fast without compromising
on quality. The app (`apps/otta-web`) is a Vite + React SPA served by a Cloudflare Worker, with OttaORM over D1 as the
only database layer.

---

## Table of Contents

1. [Quick Start (5 minutes)](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Core Concepts](#core-concepts)
4. [Setup from Scratch](#setup-from-scratch)
5. [Building Your First Feature](#building-your-first-feature)
6. [Multi-Tenancy](#multi-tenancy)
7. [RBAC (Permissions)](#rbac-permissions)
8. [Audit Logging](#audit-logging)
9. [Production Deployment](#production-deployment)
10. [Common Patterns](#common-patterns)
11. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/thinkdj/ottabase.git
cd ottabase

# 2. Install dependencies and build the shared packages
pnpm install
pnpm build:pkg

# 3. Local secrets: copy the example and set at least BOOTSTRAP_OWNER_SECRET
cp apps/otta-web/.env.example apps/otta-web/.env.local

# 4. Start development (Vite on :3003, Worker on :3004)
pnpm dev
```

Then open `http://localhost:3004/__bootstrap__` and run the four-step setup wizard (it asks for
`BOOTSTRAP_OWNER_SECRET`):

1. **Database**: creates every table and runs migrations
2. **Roles**: seeds the built-in roles and their permissions
3. **Owner**: creates your platform owner account and signs you in
4. **Launch**: pre-flight checks, then marks the platform `READY`

The same steps are available headless (`POST /__bootstrap__/api/{init,seed,create-owner,finalize}` with an
`X-Bootstrap-Secret` header), see `apps/otta-web/worker/bootstrap/README.MD`.

**You now have:**

- ✅ Multi-tenant organization system (every signup gets its own organization)
- ✅ Role-based access control (RBAC)
- ✅ Audit logging
- ✅ User authentication (credentials, OAuth, magic links)
- ✅ Database with ORM (OttaORM over Cloudflare D1)
- ✅ Type-safe API with a single, tenant-scoped client data layer

---

## Architecture Overview

### The Hierarchy: Tenant > App > User (RBAC)

```
┌─────────────────────────────────────────────────────────┐
│              Ottabase SaaS Monorepo                     │
└─────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
    TENANT LAYER                  APP LAYER
    (Organizations)               (appId from server config)
          │                             │
          └──────────────┬──────────────┘
                         │
                   USER LAYER
                   (RBAC + Audit)
```

### What This Means

**Tenant (Organization):**

- Your customers (e.g., Acme Corp, Startup Inc)
- Data is isolated per tenant by Row-Level Security (RLS) on `organizationId`
- Each tenant has its own members, role grants, and data

**App:**

- One deployment = one `appId`, resolved on the server by `getOttabaseConfig(env).appId` (`ottabase.config.ts` `appId`,
  overridable with the `APP_ID` var). Never taken from a request header.
- App-scoped tables (for example the blog in platform mode) are filtered by `appId` through the `AppScoped` RLS policy.
- Role grants are per **organization**, not per app.

**User:**

- Global user accounts (same login across all tenants)
- Users can belong to multiple organizations and switch the active one
- Permissions come from role grants in the active organization, plus any **system-scoped** grants (organization
  `'system'`), which is how the platform owner holds platform authority

---

## Core Concepts

All snippets below run on the server (a Worker route) after the DB connection is initialized, `initDbConnection(env)`
from `apps/otta-web/worker/lib/db-utils.ts` registers the D1 driver
(`registerConnection('default', createD1Driver(env.OBCF_D1))`), every model, and the RLS policies.

### 1. Organizations (Tenants)

Organizations are your customers. Each organization is completely isolated.

```typescript
import { Organization } from '@ottabase/ottaorm/models';

// Create organization
const org = await Organization.create({
    name: 'Acme Corp',
    slug: 'acme',
    plan: 'pro',
    status: 'active',
});

// Find by slug
const acme = await Organization.findBySlug('acme');
```

### 2. Organization Membership

Users belong to organizations with a roster role (`owner`, `admin`, `member`) and status (`active`, `invited`,
`suspended`).

```typescript
import { OrganizationMember } from '@ottabase/ottaorm/models';

// Add an existing user to an organization
await OrganizationMember.addMember({
    userId: user.get('id') as string,
    organizationId: org.get('id') as string,
    role: 'admin',
    status: 'active',
});

// Check membership
const isMember = await OrganizationMember.isMember(userId, orgId);
const isAdmin = await OrganizationMember.hasRole(userId, orgId, 'admin');

// Get user's organizations
const orgs = await OrganizationMember.getUserOrganizations(userId);
```

### 3. RBAC (Roles + Permissions)

Permissions are bundled on roles and granted per organization. `organizationId` is **required** on every role API, an
org-less call throws instead of merging grants from every tenant. Use `'system'` for platform-scoped grants.

```typescript
import { Role, User } from '@ottabase/ottaorm/models';

const user = await User.find(userId);
const editor = await Role.findByName('editor');
if (!user || !editor) throw new Error('User or role not found');

// Assign role to user in organization
await user.assignRole(
    editor.get('id') as string,
    assignedById, // who granted it (optional)
    'org-acme', // organizationId (REQUIRED)
);

// Check permissions
const canEdit = await user.hasPermission('posts:update', { organizationId: 'org-acme' });

// Get user roles
const roles = await user.roles({ organizationId: 'org-acme' });
```

### 4. Request Context (The Glue)

On the server, `getRequestContext` from `@ottabase/rbac` turns a request into the caller's verified identity, active
organization, and merged permissions. Everything comes from the signed session and server config; the requested
organization is kept only if the user is an active member of it.

```typescript
import { hasPermission } from '@ottabase/rbac/admin-guard';
import { getRequestContext } from '@ottabase/rbac/request-context';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAuthOptions } from '../lib/auth-utils';

const ctx = await getRequestContext(request, env, {
    getAuthOptions,
    appId: getOttabaseConfig(env).appId,
});

ctx.organizationId; // membership-verified active org, or null
ctx.appId; // from server config
ctx.permissions; // system-scoped ∪ active-org grants, e.g. ['*:read', 'posts:create']

if (hasPermission(ctx, 'posts:update')) {
    // Allow edit
}
```

### 5. Audit Logging

Actions are logged with tenant + app context to `audit_logs`.

```typescript
import { AuditLog } from '@ottabase/ottaorm/models';

// Log an action using the request context
await AuditLog.log({
    userId: ctx.sessionUser?.id,
    organizationId: ctx.organizationId ?? undefined,
    appId: ctx.appId,
    action: 'create',
    resourceType: 'project',
    resourceId: project.get('id') as string,
});

// Query logs
const logs = await AuditLog.getByOrganization('org-acme', 100);
const userLogs = await AuditLog.getByUserInOrganization(userId, 'org-acme', 50);
```

---

## Setup from Scratch

### Step 1: Initialize Database

The bootstrap wizard (Quick Start) does this for you. To re-run migrations later, for example after adding a model, call
the init endpoint. Outside `ENVIRONMENT=development` it requires `MIGRATION_SECRET`:

```bash
# Local dev
curl -X POST http://localhost:3004/api/ottaorm/init

# Any other environment
curl -X POST https://yourapp.com/api/ottaorm/init -H "Authorization: Bearer $MIGRATION_SECRET"
```

**What you get** (among the core tables):

- `organizations` - Tenant entities
- `organization_members` - User ↔ Organization roster
- `roles` - Roles with their permission bundles
- `permissions` - Permission catalog (`users:*`, `posts:read`, ...)
- `user_roles` - Role grants (per organization; `'system'` for platform grants)
- `audit_logs` - Audit trail

### Step 2: Seed Roles

The wizard's **Roles** step (`POST /__bootstrap__/api/seed`) seeds and heals the built-in roles:

| Role             | Scope        | Permissions                                                             |
| ---------------- | ------------ | ----------------------------------------------------------------------- |
| `platform_owner` | `'system'`   | `*:*`: the bootstrapped app owner                                       |
| `owner`, `admin` | organization | full org-level access, including `org:admin` (no system-level wildcard) |
| `editor`         | organization | `*:read`, `*:create`, `*:update`, `posts:publish`, `posts:manage`       |
| `author`         | organization | `*:read`, `posts:create`, `posts:update`, `media:create`, `media:read`  |
| `viewer`         | organization | `*:read`                                                                |
| `member`         | organization | `*:read`                                                                |

Re-running it is safe: `/__bootstrap__/seed` reconciles the built-in roles without touching your custom ones.

### Step 3: RBAC Cache (Optional)

Role and permission lookups can be cached in KV. Pass the cache to `getRequestContext` / the model role APIs via the
`cache` option.

```typescript
import { createKVClient } from '@ottabase/cf/kv';
import { initRBACCache } from '@ottabase/rbac';

const rbacCache = initRBACCache({
    kv: createKVClient({ namespace: env.OBCF_KV }),
    ttl: 300, // 5 minutes
    prefix: 'rbac:',
});
```

The cache is an optimization only: a miss or a KV failure never changes an authorization outcome.

### Step 4: Create Your First Organization

Every signup is provisioned with its own organization (owner membership + org-scoped `owner` grant), so there is nothing
to do for a new user. To create another organization from the UI or API, `POST /api/ottaorm/organizations` creates it
and makes the caller its owner. On the server, with models:

```typescript
import { Organization, OrganizationMember, Role, User } from '@ottabase/ottaorm/models';

const user = await User.find(userId);
const ownerRole = await Role.findByName('owner'); // seeded by the bootstrap wizard
if (!user || !ownerRole) throw new Error('User or owner role not found');

// Create organization
const org = await Organization.create({
    name: 'Your Company',
    slug: 'your-company',
    ownerId: userId,
    plan: 'pro',
});
const orgId = org.get('id') as string;

// Add the creator to the roster as owner
await OrganizationMember.addMember({
    userId,
    organizationId: orgId,
    role: 'owner',
    status: 'active',
});

// Grant the org-scoped RBAC role
await user.assignRole(ownerRole.get('id') as string, userId, orgId);
```

---

## Building Your First Feature

Let's build a tenant-scoped **Project** entity with CRUD, RBAC, and audit logging. Standard CRUD needs no custom
endpoint: a registered model is served by the generic `/api/ottaorm/{entity}` route, scoped by RLS.

### 1. Create the Table and Model

```typescript
// apps/otta-web/ottabase/models/Project.schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projectsTable = sqliteTable('projects', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id').notNull(), // Tenant scoping
    name: text('name').notNull(),
    status: text('status').default('active').notNull(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ProjectType = typeof projectsTable.$inferSelect;
```

```typescript
// apps/otta-web/ottabase/models/Project.ts
import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { projectsTable } from './Project.schema';

export { projectsTable, type ProjectType } from './Project.schema';

export class Project extends BaseModel {
    static entity = 'projects';
    static table = projectsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    // Fat model: domain logic lives here, not in routes
    async archive() {
        this.set('status', 'archived');
        return this.save();
    }
}
```

### 2. Register It

1. Export the table from `apps/otta-web/ottabase/db/schema.ts`: `export { projectsTable } from '../models/Project';`
2. Add `projectsTable` to the `appTables` maps in `apps/otta-web/ottabase/db/schemas-helper.ts` (`getAllSchemas()` and
   `getSchemaSummary()`).
3. In `apps/otta-web/worker/lib/db-utils.ts` `initDbConnection`, add `Project` to `appModels` and register a tenant
   policy **after** `initRLS()` (the registry is last-write-wins):

    ```typescript
    registerPolicy({
        model: 'projects',
        policy: RLSPolicies.TenantScoped(false), // rows filtered by the caller's organizationId
        auditEnabled: true,
    });
    ```

4. Add `'projects'` to `GENERIC_CRUD_ALLOWLIST` in `apps/otta-web/worker/routes/ottaorm-crud.ts`.
5. Run migrations: `curl -X POST http://localhost:3004/api/ottaorm/init`.

`GET/POST/PATCH/DELETE /api/ottaorm/projects` now works. On create, RLS injects the caller's `organizationId`; a body
that names another organization is rejected as a cross-tenant write. Generic CRUD enforces **tenant scope**, so any
active member of the organization can use it, add `requiredPermissions` to the policy, or write a custom route (step 4),
when an action needs a specific permission.

### 3. Use It from the Client

Never call `fetch()` in client code (lint-enforced). Generate hooks once:

```typescript
// apps/otta-web/src/hooks/useProjects.ts
import { createModelHooks } from '@ottabase/ottaorm/client';
import type { ProjectType } from '../../ottabase/models/Project.schema';

export const {
    useList: useProjects,
    useDetail: useProject,
    useCreate: useCreateProject,
    useUpdate: useUpdateProject,
    useDelete: useDeleteProject,
} = createModelHooks<ProjectType>({ entityName: 'projects' });
```

For an admin screen, `ModelCrud` from `@ottabase/forms/react` renders list + detail + create/edit/delete from the
model's field metadata.

### 4. A Custom, Permission-Gated Route

When an action is not plain CRUD, or needs a specific permission, add a route. Custom routes go in
`apps/otta-web/ottabase/config.routes.ts` (`handleCustomRoutes`), which receives the same `ApiRouteContext` as every
built-in route.

```typescript
// apps/otta-web/worker/routes/projects.ts
import { AuditLog } from '@ottabase/ottaorm/models';
import { hasPermission } from '@ottabase/rbac/admin-guard';
import { getRequestContext } from '@ottabase/rbac/request-context';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { Project } from '../../ottabase/models/Project';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import type { ApiRouteContext } from './router';

export async function handleArchiveProject(context: ApiRouteContext, projectId: string): Promise<Response> {
    const { request, env } = context;
    initDbConnection(env);

    // 1. Verified identity + membership-checked org + merged permissions
    const ctx = await getRequestContext(request, env, { getAuthOptions, appId: getOttabaseConfig(env).appId });
    if (!ctx.isAuthenticated) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    if (!ctx.organizationId) return errorResponse('Select an organization', 400, { code: 'NO_ORGANIZATION' });

    // 2. Check permission
    if (!hasPermission(ctx, 'projects:update')) return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });

    // 3. Direct model calls are NOT RLS-filtered: scope the query to the caller's org yourself
    const project = await Project.first({ id: projectId, organizationId: ctx.organizationId });
    if (!project) return errorResponse('Not found', 404, { code: 'NOT_FOUND' });

    // 4. Domain logic on the model
    await project.archive();

    // 5. Log action
    await AuditLog.log({
        userId: ctx.sessionUser?.id,
        organizationId: ctx.organizationId,
        appId: ctx.appId,
        action: 'archive',
        resourceType: 'project',
        resourceId: projectId,
    });

    return jsonResponse(project.toJson());
}
```

```typescript
// apps/otta-web/ottabase/config.routes.ts, inside handleCustomRoutes(context)
const match = context.route.match(/^\/api\/projects\/([^/]+)\/archive$/);
if (match && context.method === 'POST') {
    return handleArchiveProject(context, match[1]);
}
```

Call it from the client with a mutation hook:

```typescript
import { useApiMutation } from '@ottabase/ottaorm/client';

const archive = useApiMutation<unknown, { id: string }>({
    endpoint: ({ id }) => `/api/projects/${id}/archive`,
    method: 'POST',
    invalidateEntities: ['projects'],
});
// archive.mutate({ id: project.id });
```

**Key Points:**

1. ✅ Identity and org come from the verified session, never from headers
2. ✅ Generic CRUD is tenant-scoped by RLS; custom routes scope queries explicitly
3. ✅ Permissions checked before operations
4. ✅ Domain logic lives on the model
5. ✅ Actions logged to the audit trail

---

## Multi-Tenancy

### Resolving the Organization for a Request

Use `getRequestContext` from `@ottabase/rbac`. It verifies the session, takes the org from it (or from a requested
`X-Org-Id` / `?organizationId=`), and **keeps that org only if the user is an active member**: otherwise
`organizationId` is `null`. The `'system'` scope is kept only for a user holding a system-scoped grant. Never read the
org straight off a header: it is a request, not an answer (AGENTS.MD "Security Context: what may be trusted").

```typescript
import { getRequestContext } from '@ottabase/rbac/request-context';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAuthOptions } from '../lib/auth-utils';

const ctx = await getRequestContext(request, env, { getAuthOptions, appId: getOttabaseConfig(env).appId });
// ctx.organizationId, membership-verified, or null
// ctx.appId, from server config, never a header
// ctx.permissions, merged system + active-org grants
```

For OttaORM queries that go through RLS (`secureCrud` / the generic CRUD route), the app builds the `SecurityContext`
with `getSecurityContext(request, session, env)` from `worker/lib/auth-utils.ts`. It applies the same membership check
and fails closed with `503 SECURITY_CONTEXT_UNAVAILABLE` if membership cannot be resolved.

### Organization Switching

The active organization is stored on the user and validated server-side. The app ships `OrganizationSwitcher`
(`apps/otta-web/src/components/OrganizationSwitcher.tsx`), which persists the choice with a membership-checked
`PATCH /api/users/me`:

```typescript
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';

const { refreshSession } = useSession();

async function switchOrganization(organizationId: string) {
    // 400 with a field error if the caller is not an active member
    await api('/api/users/me', { method: 'PATCH', body: { activeOrganizationId: organizationId } });
    // Re-read the session so org-dependent UI (permissions, admin links) updates everywhere
    await refreshSession();
}
```

### Inviting Users to an Organization

Invites are email-only roster rows (`status: 'invited'`, no `userId`); they activate when that email signs up or signs
in. Use the admin members API, which enforces org-admin access and last-owner safety:

```bash
POST   /api/admin/organizations/:organizationId/members/invite   # { "email": "...", "role": "member" }
GET    /api/admin/organizations/:organizationId/members
PATCH  /api/admin/organizations/:organizationId/members/:memberId
DELETE /api/admin/organizations/:organizationId/members/:memberId
```

On the server, the same thing with models:

```typescript
import { OrganizationMember } from '@ottabase/ottaorm/models';

const existing = await OrganizationMember.findExistingInvite({ organizationId, invitedEmail: email });
if (!existing) {
    await OrganizationMember.addMember({
        organizationId,
        invitedEmail: email,
        role: 'member',
        status: 'invited',
        invitedBy: invitedById,
    });
}
// On sign-in: await OrganizationMember.activatePendingInvites(userId, email);
```

---

## RBAC (Permissions)

### Permission Format

Permissions use the format: `resource:action`

```
users:read       - Read users
users:create     - Create users
users:delete     - Delete users
users:*          - All actions on users
*:read           - Read all resources
org:admin        - Administer the active organization
platform:admin   - Platform administration (system-scoped grants only)
*:*              - Super admin (all permissions)
```

### Checking Permissions

```typescript
import { hasPermission, isOrgAdmin, isPlatformAdmin } from '@ottabase/rbac/admin-guard';

// Method 1: Using the request context (boolean)
if (hasPermission(ctx, 'posts:update')) {
    // Allow
}

// Method 2: Using the user model (organizationId is required)
const canDelete = await user.hasPermission('posts:delete', { organizationId: 'org-acme' });

// Method 3: Admin checks, permission + scope, never role names
isOrgAdmin(ctx); // org:admin in the active org (or the platform owner's *:*)
isPlatformAdmin(ctx); // platform:admin from a SYSTEM-scoped grant only
```

Admin-only routes in the app use `requireAdminAccess(context, { scope: 'system' | 'organization' | 'either' })` from
`apps/otta-web/worker/lib/admin-guard.ts`, which returns an admin context or a ready-made 401/403 `Response`.

### Creating Custom Roles

```typescript
import { Role } from '@ottabase/ottaorm/models';

// Create custom role
const projectManager = await Role.create({
    name: 'project_manager',
    description: 'Can manage projects',
});

// Add permissions (stored on the role)
for (const permission of ['projects:read', 'projects:create', 'projects:update']) {
    await projectManager.addPermission(permission);
}

// Grant the role to a user in one organization
await user.assignRole(projectManager.get('id') as string, adminUserId, 'org-acme');
```

Role and grant tables are not reachable through generic CRUD; manage them through the admin roles API
(`/api/admin/roles`) or the models.

---

## Audit Logging

### What Gets Logged

Every audit entry carries:

- Who: userId, userEmail
- What: action (create/update/delete/...), resourceType, resourceId
- When: createdAt timestamp
- Where: organizationId, appId
- How: ipAddress, userAgent
- Changes: before/after values

### Logging Actions

`AuditLog.log` (from `@ottabase/ottaorm/models`) is always available. The `@ottabase/audit` package adds typed helpers,
add `"@ottabase/audit": "workspace:*"` to your app's dependencies to use them:

```typescript
import { logCreate, logDelete, logUpdate } from '@ottabase/audit';

const auditContext = {
    userId: ctx.sessionUser?.id,
    organizationId: ctx.organizationId ?? undefined,
    appId: ctx.appId,
    ipAddress: request.headers.get('cf-connecting-ip') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
};

// Create
await logCreate('project', projectId, project.toJson(), auditContext);

// Update
await logUpdate('project', projectId, { status: { from: 'active', to: 'archived' } }, auditContext);

// Delete
await logDelete('project', projectId, auditContext);
```

For a custom action, call `AuditLog.log` directly:

```typescript
import { AuditLog } from '@ottabase/ottaorm/models';

await AuditLog.log({
    userId: ctx.sessionUser?.id,
    organizationId: ctx.organizationId ?? undefined,
    appId: ctx.appId,
    action: 'export_data',
    resourceType: 'organization',
    resourceId: orgId,
    status: 'success',
    metadata: { format: 'csv', rowCount: 1000 },
});
```

### Querying Audit Logs

```typescript
import { AuditLog } from '@ottabase/ottaorm/models';

// All logs for organization
const logs = await AuditLog.getByOrganization('org-acme', 100);

// User actions in organization
const userLogs = await AuditLog.getByUserInOrganization(userId, 'org-acme', 50);

// Resource-specific logs
const projectLogs = await AuditLog.getByResourceInOrganization('project', projectId, 'org-acme', 20);

// Advanced queries
const recentDeletes = await AuditLog.where({
    organizationId: 'org-acme',
    action: 'delete',
    createdAt: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 },
});
```

Over HTTP, `GET /api/audit/logs` serves the admin audit screen: admins see rows for the organizations they are active
members of (system admins also see platform-level rows); everyone else sees only their own entries.

---

## Production Deployment

Full walkthrough: [`CLOUDFLARE_DEPLOY.md`](./CLOUDFLARE_DEPLOY.md) (resources, secrets, CI/CD).

### 1. Configuration and Secrets

Worker code never reads `process.env`; it reads bindings and vars through `getOttabaseConfig(env)` / `env`. Bindings
(`OBCF_D1`, `OBCF_KV`, `OBCF_R2`, ...) are declared in `apps/otta-web/wrangler.jsonc` and typed in
`cloudflare-env.d.ts`, keep the two in sync. Plain vars live per environment in `wrangler.jsonc`; secrets are set with
`wrangler secret put`:

```bash
cd apps/otta-web
npx wrangler secret put AUTH_SECRET --env production             # signs sessions; required outside dev
npx wrangler secret put BOOTSTRAP_OWNER_SECRET --env production  # gates /__bootstrap__
npx wrangler secret put MIGRATION_SECRET --env production        # gates POST /api/ottaorm/init
npx wrangler secret put CRON_SECRET --env production             # gates scheduled blog publishing
```

Also set `AUTH_URL` (your public origin) and, if you serve the API cross-origin, `CORS_ALLOWED_ORIGINS`. Optional
providers (OAuth `GOOGLE_CLIENT_*` / `GITHUB_CLIENT_*`, email) are listed in `apps/otta-web/.env.example`.

### 2. Bootstrap the Production Database

After the first deploy, open `https://yourapp.com/__bootstrap__?secret=<BOOTSTRAP_OWNER_SECRET>` and run the wizard, or
call the `/__bootstrap__/api/*` endpoints with the `X-Bootstrap-Secret` header. Later schema changes:
`POST /api/ottaorm/init` with `MIGRATION_SECRET`.

### 3. Request Context in Routes

```typescript
import { hasPermission } from '@ottabase/rbac/admin-guard';
import { getRequestContext } from '@ottabase/rbac/request-context';
import { errorResponse } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import type { ApiRouteContext } from './router';

export async function handleCreateProject(context: ApiRouteContext): Promise<Response> {
    const { request, env } = context;
    initDbConnection(env);

    const ctx = await getRequestContext(request, env, { getAuthOptions, appId: getOttabaseConfig(env).appId });
    if (!ctx.isAuthenticated) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    if (!ctx.organizationId) return errorResponse('Select an organization', 400, { code: 'NO_ORGANIZATION' });
    if (!hasPermission(ctx, 'projects:create')) return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });

    // ... create the project with organizationId: ctx.organizationId
}
```

### 4. Production Checklist

- [ ] Create Cloudflare resources (`pnpm cf:setup`) and deploy
- [ ] Set `AUTH_SECRET`, `AUTH_URL`, `BOOTSTRAP_OWNER_SECRET`, `MIGRATION_SECRET`, `CRON_SECRET`
- [ ] Run the `/__bootstrap__` wizard on the production database
- [ ] Deploy with an explicit `--env` (the top-level `wrangler.jsonc` vars are the development defaults)
- [ ] Configure `CORS_ALLOWED_ORIGINS` if a different origin calls the API
- [ ] Test multi-tenant isolation (CRITICAL)
- [ ] Setup backup strategy (D1 Time Travel / exports)
- [ ] Review rate limits for auth and public endpoints

Analytics dashboards (`/api/analytics/core`, `/api/shortlinks/analytics`, `/api/referrals/analytics`) are **system-admin
only**: Analytics Engine rows carry no organization, so the totals are platform-wide.

---

## Common Patterns

### Pattern 1: Route Wrapper with Request Context

```typescript
import { getRequestContext, type RequestContext } from '@ottabase/rbac/request-context';
import { errorResponse } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import type { ApiRouteContext } from './router';

export function withContext(handler: (context: ApiRouteContext, ctx: RequestContext) => Promise<Response>) {
    return async (context: ApiRouteContext): Promise<Response> => {
        initDbConnection(context.env);
        const ctx = await getRequestContext(context.request, context.env, {
            getAuthOptions,
            appId: getOttabaseConfig(context.env).appId,
        });
        if (!ctx.isAuthenticated) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
        return handler(context, ctx);
    };
}
```

### Pattern 2: Tenant-Scoped Queries

Through generic CRUD, RLS scopes every query for you. In your own server code, scope explicitly, keep it on the model:

```typescript
export class Project extends BaseModel {
    // ...
    static forOrganization(organizationId: string) {
        return this.where({ organizationId }, { orderBy: 'createdAt', orderDirection: 'desc' });
    }
}

// Usage
const projects = await Project.forOrganization(ctx.organizationId);
```

### Pattern 3: Organization Switcher UI

Reuse the shipped component; it lists the caller's organizations (`useOrganizations()`, backed by
`/api/ottaorm/organizations`) and switches through `PATCH /api/users/me` (see
[Organization Switching](#organization-switching)):

```tsx
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';

<OrganizationSwitcher currentOrgId={currentOrgId} onOrgChange={setOrganization} />;
```

`apps/otta-web/src/ottabase/components/layout/ControlsSection.tsx` shows the full wiring (local state, server persist,
`refreshSession()`). The API client sends the active org as `X-Org-Id`; the worker re-validates it against membership on
every request.

---

## Troubleshooting

### Issue: "organizationId is required" Error

**Problem:** A role/permission call throws
`User.roles: organizationId is required (use 'system' for platform-scoped grants)`.

**Solution:** Always pass the organization to role APIs, grants are org-scoped.

```typescript
// ❌ Wrong
const roles = await user.roles({ cache });

// ✅ Correct
const roles = await user.roles({
    cache,
    organizationId: 'org-acme', // REQUIRED
});
```

### Issue: Cross-Tenant Data Leakage

**Problem:** User sees data from a different organization

**Solution:**

1. Serve entity CRUD through `/api/ottaorm/{entity}` with a `TenantScoped` policy
2. In custom routes, take the org from `getRequestContext` / `getSecurityContext`, never from a header or body
3. Direct model calls are not RLS-filtered, always include `organizationId` in the query

```typescript
const ctx = await getRequestContext(request, env, { getAuthOptions, appId: getOttabaseConfig(env).appId });
if (!ctx.organizationId) return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });

const projects = await Project.where({
    organizationId: ctx.organizationId, // CRITICAL
});
```

### Issue: Cache Not Working

**Problem:** RBAC queries still hitting the database

**Solution:**

1. Check `OBCF_KV` is bound
2. Verify the cache is passed via the `cache` option
3. Check cache stats

```typescript
const stats = await rbacCache.getOrgStats('org-acme');
console.log(stats);
// {
//   organizationId: 'org-acme',
//   version: 'v1',
//   requestCacheSize: 15,
//   enabled: true,
//   kvAvailable: true
// }
```

### Issue: Permissions Not Working

**Problem:** User has a role but the permission check fails

**Solution:**

1. Check the role carries the permission
2. Verify the grant is in the **active** organization (or `'system'` for platform permissions)
3. After changing roles or memberships, live sessions pick it up once the caches are invalidated and the user's profile
   version is bumped, the admin routes do both

```typescript
import { Role } from '@ottabase/ottaorm/models';

// Debug permissions
const role = await Role.findByName('admin');
console.log('Role permissions:', role?.getPermissions());

const userPerms = await user.getPermissions({ organizationId: 'org-acme' });
console.log('User permissions:', userPerms);
```

---

## What Makes This "Solo Founder's Delight"

- ✅ **Zero Boilerplate** - Everything pre-configured and ready
- ✅ **Production-Ready** - Security, performance, and scalability built-in
- ✅ **Type-Safe** - Full TypeScript support with inference
- ✅ **Batteries Included** - Auth, RBAC, Audit, Multi-tenancy out of the box
- ✅ **DRY** - Reusable packages, no code duplication
- ✅ **KISS** - Simple patterns, easy to understand
- ✅ **Well-Documented** - This guide + inline docs + examples
- ✅ **Scalable** - From MVP to millions of users
- ✅ **Maintainable** - Clear architecture, easy to extend

---

## Next Steps

1. **Read the docs:**
    - [`../AGENTS.MD`](../AGENTS.MD) - Architecture, rules, and conventions
    - [`RBAC_MULTI_TENANT_GUIDE.md`](./RBAC_MULTI_TENANT_GUIDE.md) - RBAC, RLS, and tenant isolation in depth
    - [`CLOUDFLARE_DEPLOY.md`](./CLOUDFLARE_DEPLOY.md) - Deployment
    - [`API_PAGINATION.md`](./API_PAGINATION.md), [`CACHE_KEYS.md`](./CACHE_KEYS.md) - API and caching details

2. **Explore working code:**
    - `apps/otta-web/ottabase/models/Todo.ts` - A complete app model
    - `apps/otta-web/worker/routes/` - Real routes (admin, audit, blog, shortlinks, referrals)
    - Feature packages: `packages/shortlinks`, `packages/ottablog`, `packages/referrals`

3. **Build your MVP:**
    - Add your first model
    - Gate custom routes with permissions
    - Deploy to production

4. **Join the community:**
    - Star the repo
    - Share your feedback
    - Contribute improvements

---

## Support

**Need help?**

- GitHub Issues: https://github.com/thinkdj/ottabase/issues
- Documentation: ./docs
- Architecture & conventions: ./AGENTS.MD

---

Built with ❤️ by a solo founder, for solo founders.

**Now go build something amazing!** 🚀
