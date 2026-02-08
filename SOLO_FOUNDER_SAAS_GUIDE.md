# Solo Founder's SaaS Platform Guide

**Build production-ready multi-tenant SaaS from your home office**

Welcome to Ottabase - the all-batteries-included monorepo for solo founders who want to ship fast without compromising
on quality.

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
git clone https://github.com/your-user/ottabase.git
cd ottabase

# 2. Install dependencies
pnpm install

# 3. Start development
pnpm dev

# 4. Initialize database
curl -X POST http://localhost:3004/api/ottaorm/init

# 5. Seed database (optional)
pnpm --filter @ottabase/ottaorm seed
```

**You now have:**

- ✅ Multi-tenant organization system
- ✅ Role-based access control (RBAC)
- ✅ Audit logging
- ✅ User authentication
- ✅ Database with ORM
- ✅ Type-safe API

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
    (Organizations)               (web, admin, api)
          │                             │
          └──────────────┬──────────────┘
                         │
                   USER LAYER
                   (RBAC + Audit)
```

### What This Means

**Tenant (Organization):**

- Your customers (e.g., Acme Corp, Startup Inc)
- Data is isolated per tenant
- Each tenant has its own members, roles, and data

**App:**

- Different applications sharing the same database (web, admin, api)
- Users can have different permissions in different apps
- Example: User is admin in web app, viewer in admin dashboard

**User:**

- Global user accounts (same login across all tenants)
- Users can belong to multiple organizations
- Permissions are scoped per tenant + app

---

## Core Concepts

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

Users belong to organizations with a membership role (owner, admin, member).

```typescript
import { OrganizationMember } from '@ottabase/ottaorm/models';

// Add user to organization
await OrganizationMember.addMember({
    userId: user.id,
    organizationId: org.id,
    role: 'admin',
    status: 'active',
});

// Check membership
const isMember = await OrganizationMember.isMember(user.id, org.id);
const isAdmin = await OrganizationMember.hasRole(user.id, org.id, 'admin');

// Get user's organizations
const orgs = await OrganizationMember.getUserOrganizations(user.id);
```

### 3. RBAC (Roles + Permissions)

Permissions are assigned via roles, scoped by organization (and optionally by app).

```typescript
import { User, Role, UserRole } from '@ottabase/ottaorm/models';

// Assign role to user in organization
await user.assignRole(
    adminRoleId,
    assignedBy.id,
    'org-acme', // organizationId (REQUIRED)
    'web', // appId (OPTIONAL - null means all apps)
);

// Check permissions
const canEdit = await user.hasPermission('posts:edit', {
    organizationId: 'org-acme',
    cache: rbacCache,
});

// Get user roles
const roles = await user.roles({
    organizationId: 'org-acme',
    cache: rbacCache,
});
```

### 4. AppContext (The Glue)

AppContext unifies tenant + app + user context in one place.

```typescript
import { buildAppContext, hasPermission } from '@ottabase/rbac';

// Build context from request
const context = await buildAppContext({
    organizationId: 'org-acme', // From subdomain/header
    appId: 'web', // From env/header
    user: currentUser, // From session
    ipAddress: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
    cache: rbacCache,
});

// Now you have everything:
console.log(context.organizationId); // 'org-acme'
console.log(context.appId); // 'web'
console.log(context.user.email); // 'john@acme.com'
console.log(context.roles); // ['admin', 'editor']
console.log(context.permissions); // ['posts:*', 'users:read', ...]

// Check permissions easily
if (hasPermission(context, 'posts:edit')) {
    // Allow edit
}
```

### 5. Audit Logging

Every action is logged with full context.

```typescript
import { logCreate, logUpdate } from '@ottabase/audit';
import { createAuditData } from '@ottabase/rbac';

// Log action using context
await logCreate('post', post.id, post, createAuditData(context, 'create', 'post', post.id));

// Query logs
const logs = await AuditLog.getByOrganization('org-acme', 100);
const userLogs = await AuditLog.getByUserInOrganization(user.id, 'org-acme', 50);
```

---

## Setup from Scratch

### Step 1: Initialize Database

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

**What you get:**

- `organizations` - Tenant entities
- `organization_members` - User ↔ Organization
- `roles` - System roles (admin, editor, viewer)
- `permissions` - System permissions (users:\*, posts:read, etc.)
- `user_roles` - User role assignments (per organization + app)
- `audit_logs` - Complete audit trail

### Step 2: Seed Data (Optional)

```bash
pnpm --filter @ottabase/ottaorm seed
```

Or manually:

```typescript
import { Role, Permission } from '@ottabase/ottaorm/models';

// Create roles
const adminRole = await Role.create({
    name: 'admin',
    description: 'Full access to all resources',
});

// Create permissions
const permissions = ['users:*', 'posts:*', 'roles:*', 'audit:read'];

for (const perm of permissions) {
    await Permission.create({
        name: perm,
        description: `Permission for ${perm}`,
    });
}

// Link permissions to roles
await adminRole.assignPermission(permission.id);
```

### Step 3: Setup RBAC Cache (Production)

```typescript
import { initRBACCache } from '@ottabase/rbac';

// Initialize with Cloudflare KV
const cache = initRBACCache({
    kv: env.KV_NAMESPACE, // Cloudflare KV
    ttl: 300, // 5 minutes
    prefix: 'rbac:',
    enabled: true,
});
```

### Step 4: Create Your First Organization

```typescript
import { Organization, OrganizationMember } from '@ottabase/ottaorm/models';

// Create organization
const org = await Organization.create({
    name: 'Your Company',
    slug: 'your-company',
    ownerId: user.id,
    plan: 'pro',
});

// Add owner as admin
await OrganizationMember.addMember({
    userId: user.id,
    organizationId: org.id,
    role: 'owner',
    status: 'active',
});

// Assign RBAC role
await user.assignRole(
    adminRoleId,
    user.id,
    org.id,
    null, // All apps
);
```

---

## Building Your First Feature

Let's build a blog post CRUD with full multi-tenant support and RBAC.

### 1. Create the Model

```typescript
// packages/ottaorm/src/models/Post.schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const postsTable = sqliteTable('posts', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id').notNull(), // Tenant scoping
    appId: text('app_id'), // App scoping (optional)
    title: text('title').notNull(),
    content: text('content').notNull(),
    authorId: text('author_id').notNull(),
    status: text('status').default('draft'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

### 2. Create the API Route

```typescript
// app/api/posts/route.ts
import { buildAppContext, hasPermission, createAuditData } from '@ottabase/rbac';
import { Post } from '@ottabase/ottaorm/models';
import { logCreate } from '@ottabase/audit';

export async function POST(request: Request) {
    // 1. Build context (tenant + app + user + RBAC)
    const context = await buildAppContext({
        organizationId: extractOrgFromRequest(request),
        appId: 'web',
        user: await getAuthUser(request),
        ipAddress: request.headers.get('cf-connecting-ip'),
        cache: rbacCache,
    });

    // 2. Check permission
    if (!hasPermission(context, 'posts:create')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Parse request
    const data = await request.json();

    // 4. Create post (tenant-scoped)
    const post = await Post.create({
        ...data,
        organizationId: context.organizationId, // Tenant isolation
        appId: context.appId, // App scoping
        authorId: context.userId!,
    });

    // 5. Log action
    await logCreate('post', post.id, post, createAuditData(context, 'create', 'post', post.id));

    return Response.json(post);
}
```

### 3. List Posts (Tenant-Scoped)

```typescript
export async function GET(request: Request) {
    const context = await buildAppContext({
        organizationId: extractOrgFromRequest(request),
        appId: 'web',
        user: await getAuthUser(request),
    });

    if (!hasPermission(context, 'posts:read')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query posts for THIS organization only
    const posts = await Post.where({
        organizationId: context.organizationId,
        appId: context.appId, // Optional: filter by app
    });

    return Response.json(posts);
}
```

**Key Points:**

1. ✅ Context built once, used everywhere
2. ✅ Permissions checked before operations
3. ✅ Data scoped by organizationId (tenant isolation)
4. ✅ Actions logged to audit trail
5. ✅ Type-safe with TypeScript

---

## Multi-Tenancy

### Extracting Organization from Request

```typescript
import { extractOrganizationId } from '@ottabase/rbac';

// Strategy 1: Subdomain (recommended)
// acme.yourapp.com → 'org-acme'
const orgId = await extractOrganizationId({
    request,
    subdomainPrefix: 'org-',
});

// Strategy 2: Header
// X-Organization-Id: org-acme
const orgId = await extractOrganizationId({
    request,
    headerName: 'X-Organization-Id',
});

// Strategy 3: Query parameter
// ?organizationId=org-acme
const orgId = await extractOrganizationId({
    request,
    queryParam: 'organizationId',
});

// Strategy 4: JWT claim
const orgId = await extractOrganizationId({
    request,
    jwtClaim: 'organizationId',
    getJWT: async (req) => {
        const token = req.headers.get('Authorization')?.replace('Bearer ', '');
        return jwt.verify(token, secret);
    },
});
```

### Organization Switching

```typescript
// User switches organization
async function switchOrganization(userId: string, newOrgId: string) {
    // 1. Check membership
    const isMember = await OrganizationMember.isMember(userId, newOrgId);
    if (!isMember) {
        throw new Error('Not a member of this organization');
    }

    // 2. Update session/JWT with new organizationId
    const session = await updateSession({
        userId,
        organizationId: newOrgId,
    });

    // 3. Clear cache for this user in new org
    await rbacCache.invalidateUser(userId, newOrgId);

    return session;
}
```

### Inviting Users to Organization

```typescript
async function inviteUserToOrganization(email: string, organizationId: string, invitedById: string) {
    // 1. Check inviter has permission
    const inviter = await User.find(invitedById);
    const canInvite = await OrganizationMember.isOwnerOrAdmin(invitedById, organizationId);

    if (!canInvite) {
        throw new Error('Insufficient permissions to invite');
    }

    // 2. Find or create user
    let user = await User.first({ email });
    if (!user) {
        user = await User.create({ email, name: email.split('@')[0] });
    }

    // 3. Add to organization as invited
    await OrganizationMember.addMember({
        userId: user.id,
        organizationId,
        role: 'member',
        status: 'invited',
        invitedBy: invitedById,
        invitedAt: Date.now(),
    });

    // 4. Send invitation email
    await sendInvitationEmail(user.email, organizationId);

    // 5. Log action
    await logCreate(
        'organization_member',
        user.id,
        { email },
        {
            userId: invitedById,
            organizationId,
            appId: 'web',
            action: 'invite_user',
            resourceType: 'organization_member',
            resourceId: user.id,
        },
    );

    return user;
}
```

---

## RBAC (Permissions)

### Permission Format

Permissions use the format: `resource:action`

```
users:read       - Read users
users:write      - Create/update users
users:delete     - Delete users
users:*          - All actions on users
*:read           - Read all resources
*:*              - Super admin (all permissions)
```

### Checking Permissions

```typescript
import { hasPermission } from '@ottabase/rbac';

// Method 1: Using context
if (hasPermission(context, 'posts:edit')) {
    // Allow
}

// Method 2: Using user model
const canDelete = await user.hasPermission('posts:delete', {
    organizationId: 'org-acme',
    cache: rbacCache,
});

// Method 3: Multiple permissions (OR)
const canManageUsers = hasPermission(context, 'users:*') || hasPermission(context, '*:*');
```

### Creating Custom Roles

```typescript
// Create custom role
const editorRole = await Role.create({
    name: 'blog_editor',
    description: 'Can edit blog posts only',
});

// Assign specific permissions
const permissions = ['posts:read', 'posts:write', 'posts:edit'];

for (const permName of permissions) {
    const perm = await Permission.first({ name: permName });
    if (perm) {
        await editorRole.assignPermission(perm.id);
    }
}

// Assign role to user
await user.assignRole(
    editorRole.id,
    adminUser.id,
    'org-acme',
    'web', // Only in web app
);
```

### App-Specific Permissions

```typescript
// User is admin in web app
await user.assignRole(adminRoleId, assignerId, orgId, 'web');

// User is viewer in admin dashboard
await user.assignRole(viewerRoleId, assignerId, orgId, 'admin');

// Check permissions in specific app
const context = await buildAppContext({
    organizationId: orgId,
    appId: 'admin', // Admin dashboard
    user,
});

// This will use permissions for admin app only
const canEditSettings = hasPermission(context, 'settings:edit');
```

---

## Audit Logging

### What Gets Logged

Every action creates an audit log entry with:

- Who: userId, userEmail
- What: action (create/update/delete), resourceType, resourceId
- When: createdAt timestamp
- Where: organizationId, appId
- How: ipAddress, userAgent
- Changes: before/after values

### Logging Actions

```typescript
import { logCreate, logUpdate, logDelete } from '@ottabase/audit';

// Create
await logCreate('post', post.id, post, {
    userId: context.userId,
    organizationId: context.organizationId,
    appId: context.appId,
    ipAddress: context.ipAddress,
});

// Update
await logUpdate(
    'post',
    post.id,
    { before, after },
    {
        userId: context.userId,
        organizationId: context.organizationId,
        appId: context.appId,
    },
);

// Delete
await logDelete('post', post.id, post, {
    userId: context.userId,
    organizationId: context.organizationId,
    appId: context.appId,
});

// Custom action
await AuditLog.create({
    userId: context.userId,
    organizationId: context.organizationId,
    appId: context.appId,
    action: 'export_data',
    resourceType: 'organization',
    resourceId: orgId,
    status: 'success',
    metadata: JSON.stringify({ format: 'csv', rowCount: 1000 }),
});
```

### Querying Audit Logs

```typescript
// All logs for organization
const logs = await AuditLog.getByOrganization('org-acme', 100);

// User actions in organization
const userLogs = await AuditLog.getByUserInOrganization(user.id, 'org-acme', 50);

// Resource-specific logs
const postLogs = await AuditLog.getByResourceInOrganization('post', post.id, 'org-acme', 20);

// Advanced queries
const recentDeletes = await AuditLog.where({
    organizationId: 'org-acme',
    action: 'delete',
    createdAt: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 },
});
```

---

## Production Deployment

### 1. Environment Variables

```env
# App
APP_ID=web
APP_NAME=Your SaaS
DATABASE_URL=file:./prod.db

# Cloudflare KV (for RBAC cache)
KV_NAMESPACE_ID=your-kv-namespace

# Auth (Auth.js)
AUTH_SECRET=your-secret-key
AUTH_URL=https://yourapp.com

# Multi-tenant
DEFAULT_ORG_ID=default-org
```

### 2. Initialize Cache

```typescript
// app/lib/rbac-cache.ts
import { initRBACCache } from '@ottabase/rbac';

export function getRBACCache(env: any) {
    return initRBACCache({
        kv: env.KV_NAMESPACE,
        ttl: 300, // 5 minutes
        prefix: 'rbac:',
        enabled: !!env.KV_NAMESPACE,
    });
}
```

### 3. Middleware

```typescript
// middleware.ts
import { buildAppContext, extractOrganizationId, extractAppId } from '@ottabase/rbac';

export async function middleware(request: Request) {
    // Extract tenant
    const organizationId = await extractOrganizationId({ request });

    if (!organizationId) {
        return Response.redirect('/select-organization');
    }

    // Extract app
    const appId = extractAppId({
        request,
        env: process.env,
        defaultAppId: 'web',
    });

    // Get user from session
    const user = await getSessionUser(request);

    // Build context
    const context = await buildAppContext({
        organizationId,
        appId,
        user,
        ipAddress: request.headers.get('cf-connecting-ip'),
        userAgent: request.headers.get('user-agent'),
        cache: rbacCache,
    });

    // Attach to request
    (request as any).context = context;

    return NextResponse.next();
}
```

### 4. Production Checklist

- [ ] Run migrations on production database
- [ ] Setup Cloudflare KV for RBAC caching
- [ ] Configure Auth.js with production secrets
- [ ] Setup subdomain routing (\*.yourapp.com)
- [ ] Configure CORS for API
- [ ] Enable audit log archival (optional)
- [ ] Setup monitoring for cache hit rates
- [ ] Test multi-tenant isolation (CRITICAL)
- [ ] Setup backup strategy
- [ ] Configure rate limiting per organization

---

## Common Patterns

### Pattern 1: Middleware with AppContext

```typescript
export function withContext(handler: (req: Request, ctx: AppContext) => Promise<Response>) {
    return async (request: Request) => {
        const context = await buildAppContext({
            organizationId: await extractOrganizationId({ request }),
            appId: extractAppId({ request, env: process.env }),
            user: await getAuthUser(request),
            ipAddress: request.headers.get('cf-connecting-ip'),
            cache: rbacCache,
        });

        return handler(request, context);
    };
}

// Usage
export const POST = withContext(async (request, context) => {
    if (!hasPermission(context, 'posts:create')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Your logic here
});
```

### Pattern 2: Tenant-Scoped Queries

```typescript
// Base model extension
class TenantScopedModel extends BaseModel {
    static scopeToOrganization(organizationId: string) {
        return this.where({ organizationId });
    }
}

// Usage
const posts = await Post.scopeToOrganization('org-acme').where({
    status: 'published',
});
```

### Pattern 3: Organization Switcher UI

```typescript
function OrganizationSwitcher({ user }: { user: User }) {
    const [orgs, setOrgs] = useState([]);
    const [current, setCurrent] = useState(null);

    useEffect(() => {
        // Load user's organizations
        fetch('/api/user/organizations')
            .then(res => res.json())
            .then(setOrgs);
    }, []);

    const switchOrg = async (orgId: string) => {
        await fetch('/api/user/switch-organization', {
            method: 'POST',
            body: JSON.stringify({ organizationId: orgId })
        });

        // Reload page with new subdomain
        const newUrl = `https://${orgSlug}.yourapp.com${window.location.pathname}`;
        window.location.href = newUrl;
    };

    return (
        <select onChange={(e) => switchOrg(e.target.value)}>
            {orgs.map(org => (
                <option key={org.id} value={org.id}>
                    {org.name}
                </option>
            ))}
        </select>
    );
}
```

---

## Troubleshooting

### Issue: "organizationId is required" Error

**Problem:** RBAC cache throws error

**Solution:** Always pass organizationId to all RBAC operations

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

**Problem:** User sees data from different organization

**Solution:**

1. Always filter queries by organizationId
2. Validate organizationId in middleware
3. Check user membership before operations

```typescript
// Verify membership
const isMember = await OrganizationMember.isMember(userId, orgId);
if (!isMember) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
}

// Scope query
const posts = await Post.where({
    organizationId: orgId, // CRITICAL
});
```

### Issue: Cache Not Working

**Problem:** RBAC queries still hitting database

**Solution:**

1. Check KV is configured
2. Verify cache is initialized
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

**Problem:** User has role but permission check fails

**Solution:**

1. Check role has permissions assigned
2. Verify organizationId matches
3. Check role is assigned in correct app

```typescript
// Debug permissions
const role = await Role.first({ name: 'admin' });
const permissions = await role.permissions();
console.log(
    'Role permissions:',
    permissions.map((p) => p.name),
);

const userPerms = await user.getPermissions({
    organizationId: 'org-acme',
    cache: rbacCache,
});
console.log('User permissions:', userPerms);
```

---

## What Makes This "Solo Founder's Delight"

✅ **Zero Boilerplate** - Everything pre-configured and ready ✅ **Production-Ready** - Security, performance, and
scalability built-in ✅ **Type-Safe** - Full TypeScript support with inference ✅ **Batteries Included** - Auth, RBAC,
Audit, Multi-tenancy out of the box ✅ **DRY** - Reusable packages, no code duplication ✅ **KISS** - Simple patterns,
easy to understand ✅ **Well-Documented** - This guide + inline docs + examples ✅ **Scalable** - From MVP to millions
of users ✅ **Maintainable** - Clear architecture, easy to extend

---

## Next Steps

1. **Read the architecture docs:**
    - `MULTI_APP_MULTI_TENANT_ARCHITECTURE.md` - Deep dive into design decisions
    - `RBAC_AUDIT_SETUP_GUIDE.md` - Detailed RBAC setup
    - `OPTIMIZATION_SUMMARY.md` - Performance tips

2. **Explore examples:**
    - `packages/ottaorm/examples/rbac-audit-demo.ts` - Complete working example
    - Look at existing feature packages (shortlinks, blog, referrals)

3. **Build your MVP:**
    - Create your first organization
    - Add RBAC to your routes
    - Deploy to production

4. **Join the community:**
    - Star the repo
    - Share your feedback
    - Contribute improvements

---

## Support

**Need help?**

- GitHub Issues: https://github.com/your-user/ottabase/issues
- Documentation: ./docs
- Examples: ./packages/ottaorm/examples

**Pro tip:** Check `MULTI_APP_MULTI_TENANT_ARCHITECTURE.md` for architectural decisions and trade-offs.

---

Built with ❤️ by solo founders, for solo founders.

**Now go build something amazing!** 🚀
