# Multi-Tenant RBAC System - Complete Guide

**Last Updated:** 2026-02-03
**Status:** Production Ready ✅
**Architecture:** Tenant > App > User (RBAC)

---

## 🎯 Overview

Ottabase includes a complete multi-tenant RBAC (Role-Based Access Control) system with:

- ✅ **Database-level tenant isolation** - Automatic cross-tenant data leak prevention
- ✅ **Flexible hierarchy** - Supports multi-tenant SaaS OR single-founder multi-app
- ✅ **Organization management** - Full CRUD for tenants and members
- ✅ **Role management** - System roles + custom org-scoped roles
- ✅ **Permission matrix** - Visual permission management across hierarchy
- ✅ **Audit logging** - Complete compliance and security tracking
- ✅ **Per-org caching** - O(1) cache invalidation, no cross-tenant pollution
- ✅ **UI components** - Ready-to-use admin interfaces (TanStack app)

---

## 📐 Architecture

### Hierarchy

```
System Roles (Global)
    ├─ owner   - Full control
    ├─ admin   - Manage members and settings
    └─ member  - Basic access

Organization (Tenant)           organizationId OR null
    ├─ Custom Roles (Org-scoped)
    ├─ Members with Roles
    └─ Apps (Optional)          appId: "web", "admin", "api"
        └─ Users + Permissions
```

### Two Modes

**Multi-Tenant SaaS:**
```typescript
// Each organization is isolated
organizationId: "org-acme"    // Acme Corp
organizationId: "org-startup" // Startup Inc
```

**Single Founder:**
```typescript
// No organization required
organizationId: null  // Run multiple apps without tenants
allowNullTenant: true // Enable in config
```

---

## 🚀 Quick Start

### 1. Database Setup

```bash
# Migrations are auto-applied, or run manually:
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite \
  < packages/ottaorm/migrations/001_add_rbac_and_audit.sql
```

**Tables Created:**
- `organizations` - Tenant entities
- `organization_members` - User memberships with roles
- `roles` - System + custom roles
- `permissions` - Permission definitions
- `user_roles` - User-role assignments (org-scoped)
- `audit_logs` - Audit trail (org-scoped)

### 2. Seed Data (Optional)

```bash
pnpm --filter @ottabase/ottaorm seed:rbac
```

Creates default system roles: `owner`, `admin`, `member`

### 3. Enable Tenant Isolation in Worker

```typescript
// apps/your-worker/src/index.ts
import { tenantAwareCrudMiddleware } from '@ottabase/ottaorm';

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
        allowNullTenant: true, // Single-founder mode
      });
    }

    // ... other routes
  }
};
```

**What this does:**
- ✅ Automatically injects `organizationId` into all queries
- ✅ Prevents cross-tenant data access (403 Forbidden)
- ✅ Logs security violations
- ✅ Validates ownership on updates/deletes

### 4. Access Admin UI

```
http://localhost:5173/admin/rbac          # RBAC Admin Dashboard
http://localhost:5173/admin/rbac/roles    # Roles Management
http://localhost:5173/admin/rbac/permissions  # Permissions Matrix
http://localhost:5173/organizations       # Organization Management
http://localhost:5173/admin/audit         # Audit Log Viewer
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
  plan: 'pro',        // 'free' | 'pro' | 'enterprise'
  status: 'active',   // 'active' | 'suspended' | 'deleted'
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
  role: 'admin',      // 'owner' | 'admin' | 'member'
  status: 'invited',  // 'invited' | 'active' | 'suspended'
  invitedBy: currentUser.id,
  invitedAt: new Date(),
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

// Custom org-scoped role
const editorRole = await Role.create({
  name: 'editor',
  displayName: 'Content Editor',
  description: 'Can create and edit content',
  organizationId: org.id, // null = system role
  permissions: ['posts:*', 'tags:read'],
});

// Assign role to user
await user.assignRole(editorRole.id, currentUser.id, org.id);

// Check permission (org-scoped)
const canEdit = await user.hasPermission('posts:edit', {
  organizationId: org.id,
});

// Check role
const hasRole = await user.hasRole('editor', org.id);

// Get all roles in org
const roles = await user.roles({
  organizationId: org.id,
});
```

### Permissions Format

```typescript
// Format: resource:action
'users:read'     // Read users
'users:write'    // Create/update users
'users:delete'   // Delete users
'users:*'        // All user operations

// Wildcards
'*:read'         // Read all resources
'*:*'            // Full access (admin)
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
await logUpdate('member', member.id, {
  role: { from: 'admin', to: 'member' },
}, context);

// Log delete
await logDelete('organization', org.id, context);

// Query audit logs (org-scoped)
import { AuditLog } from '@ottabase/ottaorm/models';

const logs = await AuditLog.where({
  organizationId: org.id,
  action: 'delete',
}, { orderBy: 'timestamp', orderDirection: 'desc', limit: 100 });
```

### RBAC Cache

```typescript
import { initRBACCache } from '@ottabase/rbac';
import { createKVClient } from '@ottabase/cf';

// Initialize cache (in worker)
const cache = initRBACCache({
  kv: createKVClient({ namespace: env.RBAC_KV }),
  ttl: 300, // 5 minutes
});

// Cache keys are automatically org-scoped:
// rbac:org:org-123:v1:user:user-456

// Check permissions with cache
const canEdit = await user.hasPermission('posts:edit', {
  cache,
  organizationId: org.id,
});

// Invalidate org cache (O(1))
await cache.invalidateOrganization(org.id);
```

---

## 🔒 Security Features

### Automatic Tenant Isolation

The `tenantAwareCrudMiddleware` prevents cross-tenant data leaks:

```typescript
// ❌ User tries to access another org's data
GET /api/ottaorm/organization_members/member-123
Headers: X-Organization-Id: org-acme

// member-123 belongs to org-beta
// ✅ Server returns 403 Forbidden
// ✅ Logs security violation
```

### Scoped Models

**Tenant-Scoped (automatic filtering):**
- organizations
- organization_members
- roles (if organizationId present)
- permissions (if organizationId present)
- user_roles
- audit_logs

**Admin-Only (blocked from generic CRUD):**
- users
- accounts
- sessions
- verification_tokens

### Organization Extraction

Extracts tenant context from:
1. Header: `X-Organization-Id: org-acme`
2. Subdomain: `acme.yourapp.com` → `org-acme`
3. Query: `?organizationId=org-acme`
4. JWT: `token.organizationId`

---

## 📱 UI Components

### Organizations Page

**Route:** `/organizations`
**File:** `apps/ottabase-template-app-tanstack/src/pages/organizations/OrganizationsPage.tsx`

Features:
- List all user's organizations
- Create new organization
- Edit organization details
- Delete organization
- Pagination (15/25/50/100 per page)
- Search and filtering
- Error handling with retry

### Organization Members

**Route:** `/organizations/:orgId/members`
**File:** `apps/ottabase-template-app-tanstack/src/pages/organizations/OrganizationMembersPage.tsx`

Features:
- List org members with roles
- Invite new members
- **Quick role assignment** - Click role badge to change
- Remove members
- Pagination and filtering
- Real-time updates

### RBAC Admin

**Route:** `/admin/rbac`
**File:** `apps/ottabase-template-app-tanstack/src/pages/admin/rbac/RBACAdminPage.tsx`

Dashboard with links to:
- Roles Management
- Permissions Matrix
- Audit Logs

### Roles Management

**Route:** `/admin/rbac/roles`
**File:** `apps/ottabase-template-app-tanstack/src/pages/admin/rbac/RBACRolesPage.tsx`

Features:
- Create custom roles
- Edit role permissions
- Delete roles (except system roles)
- View role hierarchy (System/Org/App)

### Permissions Matrix

**Route:** `/admin/rbac/permissions`
**File:** `apps/ottabase-template-app-tanstack/src/pages/admin/rbac/PermissionsMatrixPage.tsx`

Features:
- Visual matrix: Roles × Permissions
- Tab filtering: All / System / Org / App
- Click checkboxes to grant/revoke permissions
- Color-coded badges for role types
- Groups permissions by category

### Audit Log Viewer

**Route:** `/admin/audit`
**File:** `apps/ottabase-template-app-tanstack/src/pages/admin/audit/AuditLogViewerPage.tsx`

Features:
- Advanced filtering (action, entity, user, org)
- Search functionality
- Pagination (10/25/50/100 per page)
- Export for compliance
- Real-time updates

---

## 🛠️ Package Reference

### @ottabase/rbac

```typescript
import {
  initRBACCache,
  buildAppContext,
  extractOrganizationId,
  extractAppId,
  hasPermission,
  hasAnyRole,
  hasAllRoles,
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
import {
  Organization,
  OrganizationMember,
  User,
  Role,
  Permission,
  UserRole,
  AuditLog,
} from '@ottabase/ottaorm/models';

import {
  tenantAwareCrudMiddleware,
  handleTenantAwareCrud,
} from '@ottabase/ottaorm';
```

---

## 📚 Additional Documentation

- **TENANT_ISOLATION.md** - Deep dive on database-level isolation
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
// Middleware
export async function requirePermission(
  permission: string,
  organizationId: string,
) {
  const user = await getCurrentUser();
  const hasAccess = await user.hasPermission(permission, {
    organizationId,
  });

  if (!hasAccess) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}

// Usage in route
app.post('/api/posts', async (req, res) => {
  await requirePermission('posts:create', req.organizationId);
  // ... create post
});
```

### Audit Trail Query

```typescript
// Get recent changes for compliance
const auditTrail = await AuditLog.where({
  organizationId: org.id,
  resourceType: 'member',
  action: 'update',
}, {
  orderBy: 'timestamp',
  orderDirection: 'desc',
  limit: 50,
});

// Export for compliance
const exportData = auditTrail.map(log => ({
  timestamp: log.timestamp,
  user: log.userEmail,
  action: log.action,
  resource: `${log.resourceType}:${log.resourceId}`,
  changes: log.changes,
}));
```

---

## ✅ Production Checklist

- [ ] Run database migrations
- [ ] Seed system roles
- [ ] Enable `tenantAwareCrudMiddleware` in worker
- [ ] Configure KV namespace for caching
- [ ] Set up organization extraction (header/subdomain)
- [ ] Test cross-tenant access prevention
- [ ] Configure audit log retention policy
- [ ] Set up monitoring for security violations
- [ ] Document custom roles and permissions
- [ ] Train admins on RBAC UI

---

## 🤝 Support

For issues or questions:
1. Check package READMEs in `packages/rbac/` and `packages/audit/`
2. Review TENANT_ISOLATION.md for security details
3. Examine example implementations in `apps/ottabase-template-app-tanstack/`
