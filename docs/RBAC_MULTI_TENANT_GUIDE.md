# Multi-Tenant RBAC System - Complete Guide

**Last Updated:** 2026-10-02 **Status:** Production Ready ✅ **Architecture:** Tenant > App > User (RBAC)

---

## 🎯 Overview

Ottabase includes a complete multi-tenant RBAC (Role-Based Access Control) system with:

- **Database-level tenant isolation** - Automatic cross-tenant data leak prevention
- **Flexible hierarchy** - Supports multi-tenant SaaS OR single-founder multi-app
- **Organization management** - Full CRUD for tenants and members
- **Role management** - System roles + custom org-scoped roles
- **Permission matrix** - Visual permission management across hierarchy
- **Audit logging** - Complete compliance and security tracking
- **Per-org caching** - O(1) cache invalidation, no cross-tenant pollution
- **UI components** - Ready-to-use admin interfaces (Vite app)

---

## 📐 Architecture

### Hierarchy

```
System Roles (Global)
    ├─ platform_owner - Bootstrapped app owner (system-scoped, *:* → holds platform:admin)
    ├─ owner          - Organization owner (org-scoped bundle incl. org:admin, no *:*)
    ├─ admin          - Organization administrator (same org-scoped bundle, no *:*)
    └─ member         - Basic access

Organization (Tenant)           organizationId OR null
    ├─ Custom Roles (Org-scoped)
    ├─ Members with Roles
    └─ Apps (Optional)          appId: "web", "admin", "api"
        └─ Users + Permissions
```

### Authorization is permission + scope, never role NAME

A role is a **bundle of permissions**; its NAME is a label, never an authorization token. Every gate asks "does a grant
**at the required scope** carry the required permission":

- **Platform admin** (SaaS control plane): a **system-scoped** (`organization_id = 'system'`) grant carrying
  `platform:admin` (or `*:*`). Only `platform_owner` gets this, via the bootstrap. Checked by
  `assertAdmin(..., { scope: 'system' })`, `ProtectedRoute requirePlatformAdmin`, and RLS `requirePlatformAdmin`: all
  reading the scope-aware `platformAdmin`/`systemPermissions`, never a name.
- **Org admin** (own tenant: blog, media, members, settings): an **org-scoped** grant carrying `org:admin`. Held by
  `owner`/`admin`. A platform owner also passes (their `*:*` matches `org:admin`).

This is why a self-registered user, who receives the RBAC role _named_ `owner` in their personal org, can administer
their own workspace but can NEVER reach the control plane: `org:admin` is not `platform:admin`, and their grant is not
system-scoped. Renaming a role, or a tenant creating a role named `admin`, changes nothing about what it can do.

**Self-healing system roles:** `Role.ensureDefaultRoles({ heal: true })` reconciles existing `isSystem` role rows to the
canonical permission sets, correcting a role seeded under an older definition (e.g. a legacy `owner = ['*:*']`) without
a manual re-seed or DB wipe. The reconcile runs on the deliberate seed path (`/__bootstrap__/seed`); the
signup/provisioning hot path only creates missing roles and never rewrites existing ones. Customize by creating NEW
roles, never by editing system ones (the admin API rejects edits to `isSystem` roles).

### Two Modes

**Multi-Tenant SaaS:**

```typescript
// Each organization is isolated
organizationId: 'org-acme'; // Acme Corp
organizationId: 'org-startup'; // Startup Inc
```

**Single Founder:**

```typescript
// No organization required
organizationId: null; // Run multiple apps without tenants
allowNullTenant: true; // Enable in config
```

---

## 🚀 Quick Start

### 1. Database Setup

```bash
# Migrations are auto-applied, or run manually:
curl -X POST http://localhost:3004/api/ottaorm/init
```

**Tables Created:**

- `organizations` - Tenant entities
- `organization_members` - User memberships with roles
- `roles` - System + custom roles
- `permissions` - Permission definitions
- `user_roles` - User-role assignments (org-scoped)
- `audit_logs` - Audit trail (org-scoped)

### 2. Seed Data

Default system roles are seeded automatically via `Role.ensureDefaultRoles()` when the platform owner is created during
bootstrap. To reconcile them to the canonical definitions after a framework upgrade, run the secret-gated seed step,
open `/__bootstrap__/seed` or `POST /__bootstrap__/api/seed`.

Creates default system roles: `platform_owner` (bootstrapped app owner), `owner`, `admin`, `editor`, `author`, `viewer`,
`member`

### 3. Enable Row-Level Security in Worker

Isolation is enforced automatically by the RLS engine. Call `initRLS()` once at startup, then route CRUD through
`rlsMiddleware` with an explicit `getContext` that derives the `SecurityContext` from a **verified session/JWT**: never
from raw client headers.

```typescript
// apps/your-worker/src/index.ts
import { initRLS, rlsMiddleware } from '@ottabase/ottaorm';

initRLS(); // Register all pre-configured model policies once

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // RLS-enforced CRUD endpoints
        if (url.pathname.startsWith('/api/ottaorm/')) {
            return rlsMiddleware(request, env, async (req) => {
                const session = await getSession(req, env); // your verified auth
                return {
                    userId: session?.user?.id,
                    organizationId: session?.user?.organizationId ?? null, // null = single-founder mode
                    appId: 'web',
                    roles: session?.user?.roles,
                    permissions: session?.user?.permissions,
                };
            });
        }

        // ... other routes
    },
};
```

> Already parsed the request elsewhere? Call `executeSecureCrudRequest(crudRequest, context)` directly instead of
> `rlsMiddleware`. (The older `tenantAwareCrudMiddleware` has been removed, it only scoped a hardcoded model list and
> was fail-open for everything else; RLS is fail-closed and covers every registered model.)

**What this does:**

- ✅ Automatically injects `organizationId` into all queries
- ✅ Prevents cross-tenant data access (403 Forbidden)
- ✅ Logs security violations
- ✅ Validates ownership on updates/deletes

### 4. Access Admin UI

```
# Core Admin Pages
http://localhost:3003/admin                                      # Admin Dashboard
http://localhost:3003/admin/access/users                         # User Management
http://localhost:3003/admin/access/users/:userId/rbac            # User RBAC Assignment

# RBAC Management
http://localhost:3003/admin/access/rbac                          # Roles and their permissions

# Organization Management
http://localhost:3003/admin/access/organizations                 # Organizations List
http://localhost:3003/admin/access/organizations/new             # Create Organization
http://localhost:3003/admin/access/organizations/:id/settings    # Organization Settings
http://localhost:3003/admin/access/organizations/:id/members     # Organization Members

# User Profile
http://localhost:3003/profile                                    # User Profile Page

# Audit & Security
http://localhost:3003/admin/security/audit                       # Audit log
http://localhost:3003/admin/security/rls                         # Row-level security inspector
```

---

## 💡 Core Concepts

### Organizations (Tenants)

Create and manage tenant entities:

```typescript
import { Organization } from '@ottabase/ottaorm/models';

// Create organization
const org = await Organization.create({
    name: 'Acme Corp',
    slug: 'acme-corp',
    ownerId: user.id,
    plan: 'pro', // 'free' | 'pro' | 'enterprise'
    status: 'active', // 'active' | 'suspended' | 'cancelled'
    settings: {
        maxMembers: 50,
        features: ['rbac', 'audit', 'api'],
    },
});
```

### Organization Members

Manage user memberships:

```typescript
import { OrganizationMember } from '@ottabase/ottaorm/models';

// Invite member
const member = await OrganizationMember.create({
    userId: invitee.id,
    organizationId: org.id,
    role: 'admin', // 'owner' | 'admin' | 'member'
    status: 'invited', // 'invited' | 'active' | 'suspended'
    invitedBy: currentUser.id,
    invitedAt: Date.now(),
});

// Update role
await OrganizationMember.update(member.id, { role: 'member' });

// List org members
const members = await OrganizationMember.where({
    organizationId: org.id,
    status: 'active',
});
```

### Roles & Permissions

```typescript
import { Role, User } from '@ottabase/ottaorm/models';

// System roles (pre-seeded)
const adminRole = await Role.findByName('admin');

// Custom role. A role is a platform-wide permission bundle (`name` is unique across the
// platform); the org scope lives on the GRANT (`user_roles.organization_id`), not on the role.
const reviewerRole = await Role.create({
    name: 'content-reviewer',
    description: 'Can review and edit content',
    permissions: ['posts:*', 'tags:read'],
});

// Assign role to user: organizationId is required (the tenant this grant applies in)
await user.assignRole(reviewerRole.id, currentUser.id, org.id);

// Check permission (org-scoped)
const canEdit = await user.hasPermission('posts:edit', {
    organizationId: org.id,
});

// Check role
const hasRole = await user.hasRole('content-reviewer', org.id);

// Get all roles in org
const roles = await user.roles({
    organizationId: org.id,
});
```

### Permissions Format

```typescript
// Format: resource:action
'users:read'; // Read users
'users:write'; // Create/update users
'users:delete'; // Delete users
'users:*'; // All user operations

// Wildcards
'*:read'; // Read all resources
'*:*'; // Full access (admin)
```

### Audit Logging

```typescript
import { logCreate, logUpdate, logDelete } from '@ottabase/audit';

// Log creation
await logCreate('organization', org.id, org, {
    userId: currentUser.id,
    userEmail: currentUser.email,
    organizationId: org.id,
    appId: 'web',
    ipAddress: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
});

// Log update
await logUpdate(
    'member',
    member.id,
    {
        role: { from: 'admin', to: 'member' },
    },
    context,
);

// Log delete
await logDelete('organization', org.id, context);

// Query audit logs (org-scoped)
import { AuditLog } from '@ottabase/ottaorm/models';

const logs = await AuditLog.where(
    {
        organizationId: org.id,
        action: 'delete',
    },
    { orderBy: 'createdAt', orderDirection: 'desc', limit: 100 },
);
```

### RBAC Cache

```typescript
import { initRBACCache } from '@ottabase/rbac';
import { createKVClient } from '@ottabase/cf';

// Initialize cache (in worker)
const cache = initRBACCache({
    kv: createKVClient({ namespace: env.OBCF_KV }),
    ttl: 300, // 5 minutes
});

// Cache keys are automatically org-scoped and versioned:
// rbac:org:org-123:v1:usr:user-456:perms

// Check permissions with cache
const canEdit = await user.hasPermission('posts:edit', {
    cache,
    organizationId: org.id,
});

// Invalidate org cache (O(1))
await cache.invalidateOrganization(org.id);
```

### Membership Cache (Security Context)

The otta-web template also caches the **security-context membership lookups** (org + group memberships resolved by
`getSecurityContext` on every authenticated request) behind a 5-minute KV read-through cache
(`auth:usr:{userId}:member-orgs`, `auth:usr:{userId}:member-groups:{orgId|none}`), same TTL as the RBAC cache.

- **Invalidation is eager** on every in-app membership mutation: sign-in invite activation, admin member
  invite/update/remove, organization creation, and generic CRUD on `user_groups`/`user_group_members`: via
  `invalidateMembershipCache(kv, userId)` in `worker/lib/auth-utils.ts`. Call it from any custom route that mutates
  memberships. (`organization_members` is blocked from generic CRUD entirely, the admin routes are the only path.)
- **Fail-safe:** a KV failure falls back to the direct D1 query, caching can never weaken membership enforcement.
- **Propagation bound:** only for mutations made outside the instrumented paths (custom code, direct D1 edits): the 300s
  TTL plus KV eventual consistency (~6 minutes worst case cross-colo).

---

## 🔒 Security Features

### Automatic Tenant Isolation

`rlsMiddleware` / `executeSecureCrudRequest` prevent cross-tenant data leaks. RLS is **fail-closed**: a model with no
policy is denied, and if a policy's filter field isn't a real column on the model the request is rejected outright
(rather than silently running an unscoped query).

```typescript
// ❌ Caller in org-acme tries to read another org's record
GET / api / ottaorm / organization_members / member - 123; // member-123 belongs to org-beta

// ✅ Not visible under the caller's RLS filter → 404 Not Found
// ❌ Cross-tenant WRITE (body sets a different organizationId) → 403 Forbidden
// ✅ Either way, a security violation is logged to audit_logs
```

### Scoped Models

Policies live in `packages/ottaorm/src/rls/registry.ts`; the hard blocks live in otta-web
`worker/routes/ottaorm-crud.ts`.

**Tenant/membership-scoped (automatic filtering):**

- organizations, organization_members (membership-scoped)
- user_groups, user_group_members (group-membership-scoped)
- audit_logs (org-scoped, platform-admin gated)

**User-scoped:** users (self only), accounts, sessions

**Blocked from generic `/api/ottaorm` CRUD** (dedicated routes instead):

- `users` → `/api/users/me`
- `organization_members` → `/api/admin/organizations/:id/members` (last-owner guardrails, cache invalidation)
- `roles`, `permissions`, `user_roles` → `/api/admin/roles` and the member / promote-owner endpoints. Roles have no
  `organizationId` column; the RLS policies on these three are platform-admin gated as defence in depth.
- `verification_tokens` (consumed only by the auth flows; RLS also denies reads)

### Organization Selection

The active organization comes from the **verified session** (`session.user.organizationId`). A client may _request_ a
different one (e.g. an `X-Org-Id` header from the organization switcher), but that is a request, not an answer:
`getSecurityContext` (otta-web `worker/lib/auth-utils.ts`) uses it only if it is in the user's active memberships and
otherwise drops it to `null`. If memberships cannot be resolved the request fails closed with
`503 SECURITY_CONTEXT_UNAVAILABLE`. Never feed a header, query parameter or subdomain into RLS without that check (see
AGENTS.MD "Security Context: what may be trusted").

---

## 📱 UI Components

### Organizations Page

**Route:** `/admin/access/organizations` **File:**
`apps/otta-web/src/pages/admin/access/organizations/OrganizationsPage.tsx`

Features:

- List all user's organizations
- Create new organization
- Edit organization details
- Delete organization
- Pagination (25/50/100 per page)
- Search and filtering
- Error handling with retry

### Organization Members

**Route:** `/admin/access/organizations/:orgId/members` **File:**
`apps/otta-web/src/pages/admin/access/organizations/OrganizationMembersPage.tsx`

Features:

- List org members with roles
- Invite new members
- **Quick role assignment** - Click role badge to change
- Remove members
- Pagination and filtering

### Roles

**Route:** `/admin/access/rbac` **File:** `apps/otta-web/src/pages/admin/access/rbac/RolesPage.tsx`

One screen: the role list on the left (custom roles, then system roles), the selected role on the right.

- Tick the permissions the server actually checks (`PERMISSION_CATALOG` in `@ottabase/utils/permissions`), grouped by
  area. A permission already covered by a wildcard grant (`posts:*`, `*:*`) shows ticked and says which grant includes
  it.
- Nothing saves until you press **Save changes**; the bar at the bottom counts what is being added and removed, and
  **Discard** puts it back. Leaving with unsaved edits asks first.
- Wildcard grants are listed as chips and can be added for the rare case that needs one.
- System roles are read-only (they are defined in code and reconciled on deploy); create a custom role instead.
- `?role=<id>` selects a role, `?role=new` starts a new one, so links into a specific role work.

### Audit log

**Route:** `/admin/security/audit` **File:** `apps/otta-web/src/pages/admin/security/audit/AuditLogViewerPage.tsx`

Features:

- Advanced filtering (action, entity, user, org)
- Search functionality
- Grouped by day, newest first, with the filters in the URL so a view can be shared
- Export for compliance

### Organization Registration

**Route:** `/admin/access/organizations/new` **File:**
`apps/otta-web/src/pages/admin/access/organizations/OrganizationRegistrationPage.tsx`

Features:

- First-time organization creation flow
- Form validation (name, slug, plan)
- Auto-slug generation from name
- Plan selection (free/pro/enterprise)
- Centered card layout for onboarding
- Navigates to members page on success

### Organization Settings

**Route:** `/admin/access/organizations/:id/settings` **File:**
`apps/otta-web/src/pages/admin/access/organizations/OrganizationSettingsPage.tsx`

Features:

- Full organization CRUD interface
- Copy organization ID to clipboard
- Edit name, slug, plan, status
- Organization metadata display
- **Danger Zone** section for deletion
- Confirmation dialog for destructive actions

### User Profile

**Route:** `/profile` **File:** `apps/otta-web/src/pages/user/UserProfilePage.tsx`

Features:

- Current user account management
- Avatar with initials fallback
- Edit name and email
- Copyable user ID
- Email verification badge
- Member since date display
- Security section (password, active sessions, linked providers)
- Dark mode support

### User Management

**Route:** `/admin/access/users` **File:** `apps/otta-web/src/pages/admin/access/users/UserManagementPage.tsx`

Features:

- Admin-level system-wide user management
- Search functionality
- User table with avatars, roles, status
- Links to individual user RBAC page
- GitHub-like minimal design

### User RBAC Assignment

**Route:** `/admin/access/users/:userId/rbac` **File:** `apps/otta-web/src/pages/admin/access/users/UserRBACPage.tsx`

Features:

- Assign users to organizations with roles
- View user's current organization memberships
- Add to organization dialog
- Quick role change dropdown with color-coded badges
- Remove from organization
- User profile display with avatar

### Organization Switcher Component

**File:** `apps/otta-web/src/components/OrganizationSwitcher.tsx`

A reusable dropdown component for switching between organizations:

```typescript
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';

<OrganizationSwitcher
  currentOrgId={currentOrgId}
  onOrgChange={(orgId) => {
    setCurrentOrgId(orgId);
    localStorage.setItem('currentOrgId', orgId);
  }}
/>
```

Features:

- Dropdown menu with all user's organizations
- Current organization indicator (checkmark)
- "Create Organization" option
- Integrated in main application header
- Persists selection to localStorage
- GitHub-like minimal styling

---

## ⚡ TanStack Query Hooks (Optimized)

**File:** `apps/otta-web/src/hooks/useRBAC.ts`

All RBAC operations go through the framework cache (`createModelHooks`, `useApiQuery`, and `useMutation` for the
optimistic ones):

- ✅ **Caching** - shared TanStack Query cache, scoped per org by `OttaQueryProvider`
- ✅ **Optimistic updates** - organization update/delete, role update, permission toggle
- ✅ **Explicit invalidation** - every mutation invalidates the query families it affects
- ✅ **Error handling** - optimistic writes roll back on failure

### Organizations Hooks

```typescript
import {
    useOrganizations,
    useOrganization,
    useCreateOrganization,
    useUpdateOrganization,
    useDeleteOrganization,
} from '@/hooks/useRBAC';

// List organizations
const { data: orgs, isLoading, error, refetch } = useOrganizations();

// Single organization
const { data: org } = useOrganization(orgId);

// Create with optimistic update
const createMutation = useCreateOrganization();
createMutation.mutate({ name: 'New Org', slug: 'new-org' });

// Update with optimistic update
const updateMutation = useUpdateOrganization();
updateMutation.mutate({
    id: orgId,
    data: { name: 'Updated Name' },
});

// Delete with optimistic update
const deleteMutation = useDeleteOrganization();
deleteMutation.mutate(orgId);
```

### Members Hooks

```typescript
import { useOrganizationMembers, useInviteMember, useUpdateMemberRole, useRemoveMember } from '@/hooks/useRBAC';

// List members (paginated: page, perPage)
const { data: members } = useOrganizationMembers(orgId);

// Invite member
const inviteMutation = useInviteMember();
inviteMutation.mutate({
    organizationId: orgId,
    userId: 'resolved-from-admin-user-search',
    role: 'member',
    status: 'invited',
});

// In the admin invite dialog, the user picker searches by name, email, or user ID
// and submits the resolved users.id value to a dedicated admin invite endpoint.

// Quick role change with optimistic update
const updateRoleMutation = useUpdateMemberRole();
updateRoleMutation.mutate({
    memberId: 'member-123',
    role: 'admin',
    organizationId: orgId,
});

// Remove member
const removeMutation = useRemoveMember();
removeMutation.mutate({
    memberId: 'member-123',
    organizationId: orgId,
});
```

### Roles & Permissions Hooks

```typescript
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, useTogglePermission } from '@/hooks/useRBAC';

// List roles (GET /api/admin/roles)
const { data: roles } = useRoles();

// Create role (POST /api/admin/roles: platform-admin only; roles are platform-wide bundles)
const createMutation = useCreateRole();
createMutation.mutate({
    name: 'content-reviewer',
    description: 'Reviews and edits posts',
    permissions: ['posts:write', 'posts:read'],
});

// Toggle permission with optimistic update
const toggleMutation = useTogglePermission();
toggleMutation.mutate({
    roleId: 'role-123',
    permissionId: 'posts:write',
    hasPermission: true, // current state
});
```

### Audit Logs Hook

```typescript
import { useAuditLogs } from '@/hooks/useRBAC';

// Fetch with filters (1 min staleTime)
const { data: response } = useAuditLogs({
    page: '1',
    per_page: '25',
    action: 'create',
    entityType: 'organization',
    organizationId: orgId,
});

const { data: logs, pagination } = response || {};
```

### Utility Hooks

```typescript
import {
    usePrefetchOrganizations,
    useInvalidateRBAC,
} from '@/hooks/useRBAC';

// Prefetch for faster navigation
const prefetch = usePrefetchOrganizations();
<Link onMouseEnter={prefetch} to="/admin/access/organizations">
    Organizations
</Link>

// Invalidate all RBAC caches
const invalidateAll = useInvalidateRBAC();
invalidateAll(); // After major changes
```

### Cache Strategies

- Organizations and roles use the `createModelHooks` keys for their entity; members use
  `['admin-organization-members', orgId, page, perPage]`.
- Audit logs: 1 min `staleTime`; everything else uses the provider defaults.
- `useInvalidateRBAC()` invalidates all of the above after a bulk change.

### Optimistic Updates

Organization update/delete, role update and permission toggle are optimistic; member mutations invalidate and refetch:

```typescript
// Example: Role assignment with instant UI feedback
const updateRoleMutation = useUpdateMemberRole();

updateRoleMutation.mutate(
    { memberId, role: 'admin', organizationId },
    {
        // UI updates immediately (before server responds)
        onSuccess: () => toast.rbac.memberUpdated(),
        // If server fails, UI rolls back automatically
        onError: (err) => toast.error('Failed', err.message),
    },
);
```

**Benefits:**

- Users see changes instantly
- Automatic rollback on errors
- Network failures don't break UI
- Reduced perceived latency

---

## 🔐 Authentication Integration (@ottabase/auth)

The RBAC system seamlessly integrates with the `@ottabase/auth` module (a lightweight, dependency-free custom auth
implementation) to automatically enforce security policies based on the authenticated user's session.

### How It Works

1. **User Authentication** - User signs in via OAuth, Magic Link, or Credentials
2. **Session Creation** - A signed session (JWT + KV registry record) is created with user data
3. **Security Context Extraction** - Worker extracts userId, organizationId, roles, permissions from session
4. **RLS Enforcement** - All CRUD operations automatically filtered by security context
5. **Automatic Isolation** - Cross-tenant data access is impossible by design

### Worker Integration

otta-web wires auth into RLS in `worker/lib/auth-utils.ts` (`getSecurityContext`) and `worker/routes/ottaorm-crud.ts`.
The shape of it:

```typescript
import { getSession } from '@ottabase/auth/backend';
import { executeSecureCrudRequest, initRLS, type SecurityContext } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';

// 1. Initialize RLS once (initDbConnection in worker/lib/db-utils.ts)
initRLS();

// 2. Derive the security context from the VERIFIED session only
async function getSecurityContext(request: Request, env: CloudflareEnv): Promise<SecurityContext> {
    const session = await getSession(request, env);
    const userId = session?.user?.id;

    // Active memberships come from D1 (KV-cached); if they cannot be resolved, fail closed (503)
    const memberOrganizationIds = userId ? await loadActiveMembershipOrgIds(env, userId) : [];

    // X-Org-Id is a REQUEST to switch org. Honour it only if the user is a member of that org.
    const requestedOrgId = request.headers.get('x-org-id');
    const organizationId =
        requestedOrgId && memberOrganizationIds.includes(requestedOrgId)
            ? requestedOrgId
            : (session?.user?.organizationId ?? null);

    return {
        userId,
        organizationId,
        memberOrganizationIds,
        appId: getOttabaseConfig(env).appId, // server config, never an x-app-id header
        roles: session?.user?.roles,
        permissions: session?.user?.permissions,
    };
}

// 3. Generic CRUD runs through RLS with that context
const result = await executeSecureCrudRequest(crudRequest, await getSecurityContext(request, env));
return result.success
    ? jsonResponse(result.data, result.status)
    : errorResponse(result.error ?? 'Request failed', result.status);
```

(`loadActiveMembershipOrgIds` stands in for the membership lookup in `auth-utils.ts`.)

### Auth Routes

Every `/api/auth/*` sub-route the package owns is handled automatically:

```typescript
// Handles: /api/auth/csrf, /api/auth/session, /api/auth/callback/credentials,
// /api/auth/signin/:provider, /api/auth/callback/:provider, /api/auth/signin/email,
// /api/auth/callback/email, /api/auth/signout
if (url.pathname.startsWith('/api/auth/')) {
    return handleAuthRequest(request, env);
}
```

Routes the app implements itself (registration, email verification, password reset/change) stay outside this package --
see `packages/auth/README.md` for the full route table.

### Organization ID Sources

1. **Session**: `session.user.organizationId`, resolved server-side at sign-in (the default).
2. **`X-Org-Id` header**: sent by the API client when the user picks an org in the switcher. It is only a request: the
   server uses it if it is in the user's active memberships and ignores it otherwise.

Never derive the organization from an unvalidated header, query parameter or subdomain, RLS trusts whatever
`organizationId` it is given. See AGENTS.MD "Security Context: what may be trusted".

### Frontend Integration

Use the `useSession` hook from `@/lib/auth.ts` to access the current user:

```typescript
import { useSession } from '@/lib/auth';

function MyComponent() {
    const { isAuthenticated, user } = useSession();

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <div>
            <p>Welcome, {user.name}</p>
            <p>Organization: {user.organizationId}</p>
        </div>
    );
}
```

### Client-Side Organization Switching

`OrganizationSwitcher` (`apps/otta-web/src/components/OrganizationSwitcher.tsx`) writes the chosen org to the global
`organizationIdAtom` (`@/ottabase/state/appState`). The one API client built in `src/lib/api.ts` reads that atom and
adds `X-Org-Id` to every request, and `OttaQueryProvider` keys its cache by the org, so switching orgs drops the
previous org's cached rows. Do not build a second client or call `fetch()` directly (see AGENTS.MD "Client Data Layer").

### Session Customization

Organization ID, roles, and permissions are embedded in the session automatically -- `@ottabase/auth` resolves the
user's active organization membership and RBAC roles/permissions once, at session-creation time, and stores them in the
signed session JWT (see `session.user.organizationId/roles/permissions`). No callback wiring is required.

Note this embedded snapshot only drives optimistic client-side UI gating (e.g. `ProtectedRoute`). Real authorization
decisions are re-derived live on every request by `getRequestContext()` above, which loads the user's current
roles/permissions from the database -- so a role change takes effect immediately server-side even though the client's
cached session copy only refreshes on next sign-in.

### Benefits of Auth + RLS Integration

✅ **Zero-trust security** - Every request authenticated AND authorized ✅ **Automatic tenant isolation** - No manual
filtering required ✅ **Session-aware** - Security context derived from real user session ✅ **Multi-source
flexibility** - Support subdomain, header, JWT-based org selection ✅ **Frontend integration** - OrganizationSwitcher
works seamlessly ✅ **Audit-ready** - All violations logged with full user context

---

## 🛡️ Row-Level Security (RLS)

**NEW:** Automatic database-level tenant isolation that makes data leaks **impossible**.

### What is RLS?

Row-Level Security (RLS) automatically enforces data isolation at the database level. Every query is filtered based on
your security context (user, organization, app) **without any manual filtering required**.

**Where it applies:** RLS runs on the **secure CRUD path**: `executeSecureCrudRequest` / `rlsMiddleware`, which
otta-web's generic `/api/ottaorm/{model}` route uses. Direct model calls in server code (`Post.where(...)`) are trusted
code and are **not** filtered: when a custom route reads tenant data, pass the tenant filter yourself (from the verified
security context) or route the request through `executeSecureCrudRequest`.

```http
# Caller's verified context: organizationId = org-123
GET /api/ottaorm/posts
→ only rows with organizationId = 'org-123'

POST /api/ottaorm/posts   { "title": "x", "organizationId": "org-456" }
→ 403 (cross-tenant write), logged to audit_logs
```

### Core Concepts

#### Security Levels

```typescript
import { RLSPolicies } from '@ottabase/ottaorm';

// Tenant-scoped: Filters by organizationId
RLSPolicies.TenantScoped(allowNull);

// User-scoped: Filters by userId
RLSPolicies.UserScoped();

// App-scoped: Filters by appId
RLSPolicies.AppScoped();

// Public read-only: No filtering, but no writes
RLSPolicies.PublicReadOnly();

// Platform-admin-only: requires a system-scoped platform admin (scope-aware `platformAdmin`
// flag, NOT role names). Use for app-global / control-plane tables with no tenant column.
RLSPolicies.AdminOnly();

// Permission-based: Requires specific permissions
RLSPolicies.PermissionBased(['posts:write']);

// Owner-only: User must own the record
RLSPolicies.OwnerOnly('userId');

// Hierarchical: Tenant + User scoped
RLSPolicies.Hierarchical(allowNullTenant);
```

#### Model Registration

```typescript
import { registerPolicy, RLSPolicies } from '@ottabase/ottaorm';

// Register your models with RLS policies
registerPolicy({
    model: 'posts',
    policy: RLSPolicies.TenantScoped(false), // Must have org
    auditEnabled: true,
});

registerPolicy({
    model: 'comments',
    policy: RLSPolicies.Hierarchical(false), // Tenant + User
    auditEnabled: true,
});

registerPolicy({
    model: 'system_config',
    policy: RLSPolicies.AdminOnly(), // Admin access only
    auditEnabled: true,
});
```

### Worker Integration

See [Quick Start → Enable Row-Level Security](#3-enable-row-level-security-in-worker) and
[Authentication Integration → Worker Integration](#worker-integration). `rlsMiddleware` has no default context builder
on purpose: deriving the context from raw headers would be spoofable, so `getContext` is required.

### Pre-Configured Models

`initRLS()` registers these (`packages/ottaorm/src/rls/registry.ts`, abridged):

| Model                               | Policy                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| `organizations`                     | Membership-scoped (`memberOrganizationIds`, else own rows)     |
| `organization_members`              | Membership-scoped                                              |
| `user_groups`, `user_group_members` | Group-membership-scoped                                        |
| `roles`, `permissions`              | Platform admin only (and blocked from generic CRUD)            |
| `user_roles`                        | Tenant-scoped + platform admin (and blocked from generic CRUD) |
| `audit_logs`                        | Tenant-scoped + platform admin                                 |
| `users`                             | Owner-only (`id`)                                              |
| `accounts`, `sessions`              | User-scoped (`userId`)                                         |
| `verification_tokens`               | Deny all reads, read-only                                      |
| `posts`                             | Tenant + app scoped; authors limited to their own posts        |

A model with no registered policy is denied.

### Security Context

The security context determines what data a user can access:

```typescript
interface SecurityContext {
    userId?: string; // Current user ID (from the verified session)
    organizationId?: string | null; // Active org, membership-validated (null for single-founder)
    appId?: string; // From server config (getOttabaseConfig), never a request header
    roles?: string[]; // User roles in the active org
    permissions?: string[]; // User permissions in the active org
    platformAdmin?: boolean; // System-scoped platform:admin grant, never inferred from a role name
    memberOrganizationIds?: string[]; // Orgs with an active membership
    memberGroupIds?: string[]; // Accessible user groups
}
```

### Security Violations

A blocked write or a policy denial on the secure CRUD path is logged to `audit_logs` (for models with
`auditEnabled: true`) and answered with a generic 403 (401 when unauthenticated); the response never echoes the policy
or the attempted data.

### Custom Policies

Create custom policies for app-specific needs:

```typescript
// Complex multi-condition policy
registerPolicy({
    model: 'documents',
    policy: {
        level: 'custom',
        filter: (context) => {
            // Return null to deny. Otherwise: the caller's org's documents OR public ones.
            if (!context.organizationId) return null;
            return {
                $or: [{ organizationId: context.organizationId }, { isPublic: true }],
            };
        },
    },
    auditEnabled: true,
});
```

### Benefits

✅ **Automatic on the CRUD path** - generic CRUD cannot skip the filter ✅ **Single source of truth** - All policies in
one registry ✅ **Compliance ready** - Violations logged ✅ **Fail-closed** - No model accessible without an explicit
policy ✅ **Performance** - Filters compile into the SQL WHERE clause

### Demo Page

Visit `/admin/security/rls` to see RLS in action:

- Live security tests
- Model policy overview
- Interactive examples
- Security violation logs

---

## 🛠️ Package Reference

### @ottabase/rbac

```typescript
import {
    initRBACCache,
    buildAppContext,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
    requireAdminAccess,
    getRequestContext,
} from '@ottabase/rbac';
```

### @ottabase/audit

```typescript
import {
    logCreate,
    logUpdate,
    logDelete,
    logRead,
    logAuth,
    logRoleAssign,
    logRoleRemove,
    logFailure,
    extractRequestContext,
} from '@ottabase/audit';
```

### @ottabase/ottaorm

```typescript
import { Organization, OrganizationMember, User, Role, Permission, UserRole, AuditLog } from '@ottabase/ottaorm/models';

import { rlsMiddleware, executeSecureCrudRequest, initRLS, registerPolicy, RLSPolicies } from '@ottabase/ottaorm';
```

---

## 📚 Additional Documentation

- **AGENTS.MD → "Security Context: what may be trusted"** - provenance rules for the RLS context
- **packages/rbac/README.md** - RBAC package API reference
- **packages/audit/README.md** - Audit package API reference
- **packages/ottaorm/README.md** - ORM models and multi-tenant patterns

---

## 🎯 Common Patterns

### Organization Switcher

```typescript
// Get user's organizations
const orgs = await OrganizationMember.where({
    userId: user.id,
    status: 'active',
});

// Switch context
const switchOrg = (orgId: string) => {
    // Update session or context
    // Reload permissions for new org
};
```

### Permission Guards

```typescript
import { getSession } from '@ottabase/auth/backend';
import { User } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';

// Worker route: permission + scope, never a role name
export async function handleCreatePost(request: Request, env: CloudflareEnv): Promise<Response> {
    const session = await getSession(request, env);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) return errorResponse('Unauthorized', 401);

    const user = await User.find(session.user.id);
    if (!(await user?.hasPermission('posts:create', { organizationId }))) {
        return errorResponse('Forbidden', 403); // generic, never name the missing permission
    }
    // ... create post
}
```

For admin surfaces use `requireAdminAccess(context, { scope: 'system' })` (or `scope: 'organization'`) from
`@ottabase/rbac`.

### Audit Trail Query

```typescript
// Get recent changes for compliance
const auditTrail = await AuditLog.where(
    {
        organizationId: org.id,
        resourceType: 'member',
        action: 'update',
    },
    {
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: 50,
    },
);

// Export for compliance
const exportData = auditTrail.map((log) => ({
    timestamp: log.get('createdAt'),
    user: log.get('userEmail'),
    action: log.get('action'),
    resource: `${log.get('resourceType')}:${log.get('resourceId')}`,
    changes: log.get('changes'),
}));
```

---

## ✅ Production Checklist

- [ ] Run database migrations
- [ ] Seed system roles
- [ ] Enable `rlsMiddleware` in worker (with an explicit, trusted `getContext`)
- [ ] Configure KV namespace for caching
- [ ] Confirm the active org is session-derived and any requested org is membership-validated
- [ ] Test cross-tenant access prevention
- [ ] Configure audit log retention policy
- [ ] Set up monitoring for security violations
- [ ] Document custom roles and permissions
- [ ] Train admins on RBAC UI

---

## 🤝 Support

For issues or questions:

1. Check package READMEs in `packages/rbac/` and `packages/audit/`
2. Review AGENTS.MD "Security Context: what may be trusted"
3. Examine example implementations in `apps/otta-web/`
