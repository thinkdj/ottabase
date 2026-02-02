# API Endpoints Status for RBAC UI

## Overview
This document tracks the status of API endpoints required by the new Organizations and RBAC UI components.

## ✅ Endpoints Handled by Generic CRUD (@ottabase/ottaorm)

The following endpoints should work automatically via the generic CRUD API:

### Organizations
- **GET** `/api/ottaorm/organizations`
  - Status: ✅ **Should work** (generic list endpoint)
  - Used by: OrganizationsPage (pagination support)
  - Query params: `page`, `per_page`

- **GET** `/api/ottaorm/organizations/:id`
  - Status: ✅ **Should work** (generic detail endpoint)
  - Used by: OrganizationsPage (editing)

- **POST** `/api/ottaorm/organizations`
  - Status: ✅ **Should work** (generic create endpoint)
  - Used by: OrganizationsPage (create form)
  - Body: `{ name, slug, plan, status, settings, metadata, ownerId }`

- **PATCH** `/api/ottaorm/organizations/:id`
  - Status: ✅ **Should work** (generic update endpoint)
  - Used by: OrganizationsPage (edit form)
  - Body: `{ name, plan, status, settings }`

- **DELETE** `/api/ottaorm/organizations/:id`
  - Status: ✅ **Should work** (generic delete endpoint)
  - Used by: OrganizationsPage (delete confirmation)

### Organization Members
- **GET** `/api/ottaorm/organization_members`
  - Status: ✅ **Should work** (generic list endpoint)
  - Used by: OrganizationMembersPage (pagination support)
  - Query params: `page`, `per_page`, `organizationId` (filter)

- **GET** `/api/ottaorm/organization_members/:id`
  - Status: ✅ **Should work** (generic detail endpoint)
  - Used by: OrganizationMembersPage (editing)

- **POST** `/api/ottaorm/organization_members`
  - Status: ✅ **Should work** (generic create endpoint)
  - Used by: OrganizationMembersPage (invite form)
  - Body: `{ userId, organizationId, role, status, invitedBy, invitedAt }`

- **PATCH** `/api/ottaorm/organization_members/:id`
  - Status: ✅ **Should work** (generic update endpoint)
  - Used by: OrganizationMembersPage (edit form)
  - Body: `{ role, status }`

- **DELETE** `/api/ottaorm/organization_members/:id`
  - Status: ✅ **Should work** (generic delete endpoint)
  - Used by: OrganizationMembersPage (remove member)

## ⚠️ Endpoints Requiring Custom Implementation

### RBAC Roles
These endpoints are NOT part of the generic CRUD and need custom implementation:

- **GET** `/api/rbac/roles`
  - Status: ❌ **Needs implementation**
  - Used by: RBACRolesPage (list roles)
  - Expected response:
    ```json
    {
      "data": [
        {
          "id": "role-123",
          "name": "editor",
          "displayName": "Editor",
          "description": "Can create and edit content",
          "permissions": ["posts:read", "posts:write"],
          "organizationId": "org-123",
          "appId": null,
          "isSystem": false,
          "createdAt": "2024-01-01T00:00:00Z",
          "updatedAt": "2024-01-01T00:00:00Z"
        }
      ]
    }
    ```

- **POST** `/api/rbac/roles`
  - Status: ❌ **Needs implementation**
  - Used by: RBACRolesPage (create role)
  - Expected body:
    ```json
    {
      "name": "editor",
      "displayName": "Editor",
      "description": "Can create and edit content",
      "permissions": ["posts:read", "posts:write"]
    }
    ```

- **PATCH** `/api/rbac/roles/:id`
  - Status: ❌ **Needs implementation**
  - Used by: RBACRolesPage (edit role)
  - Expected body:
    ```json
    {
      "displayName": "Editor",
      "description": "Can create and edit content",
      "permissions": ["posts:read", "posts:write", "posts:delete"]
    }
    ```

- **DELETE** `/api/rbac/roles/:id`
  - Status: ❌ **Needs implementation**
  - Used by: RBACRolesPage (delete role)
  - Should prevent deletion of system roles

## 🚀 Implementation Recommendations

### For Organizations & Members
**Action Required**: ✅ **NONE** - Generic CRUD should handle these automatically.

**To Verify**:
1. Start dev server: `pnpm dev`
2. Navigate to `/organizations`
3. Try creating a test organization
4. If 404 errors occur, check that:
   - Tables exist in D1 database (run `/api/ottaorm/init` if needed)
   - Models are exported from `@ottabase/ottaorm`
   - Generic CRUD route handler is registered

### For RBAC Roles
**Action Required**: ⚠️ **Create custom API route**

**Implementation Path**:

Create: `apps/ottabase-template-app-tanstack/ottabase/api/rbac/roles.ts`

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { setDriver, createD1Driver } from '@ottabase/db/drizzle-d1';
// Assuming there will be a Role model or direct DB access

export const runtime = 'edge';

export async function GET() {
    const { env } = await getCloudflareContext();
    setDriver(createD1Driver(env.OBCF_D1));

    // TODO: Query roles from database
    // For now, return system roles as mock data
    const roles = [
        {
            id: '1',
            name: 'owner',
            displayName: 'Owner',
            description: 'Full control over organization',
            permissions: ['*:*'],
            isSystem: true,
            organizationId: null,
            appId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: '2',
            name: 'admin',
            displayName: 'Admin',
            description: 'Manage members and settings',
            permissions: ['members:*', 'settings:*'],
            isSystem: true,
            organizationId: null,
            appId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: '3',
            name: 'member',
            displayName: 'Member',
            description: 'Basic access to organization',
            permissions: ['read:*'],
            isSystem: true,
            organizationId: null,
            appId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ];

    return NextResponse.json({ data: roles });
}

export async function POST(request: Request) {
    const { env } = await getCloudflareContext();
    setDriver(createD1Driver(env.OBCF_D1));

    const body = await request.json();
    // TODO: Validate and create role in database

    return NextResponse.json({
        data: {
            id: crypto.randomUUID(),
            ...body,
            isSystem: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
    });
}
```

Create: `apps/ottabase-template-app-tanstack/ottabase/api/rbac/roles/[id].ts`

```typescript
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    const { env } = await getCloudflareContext();
    setDriver(createD1Driver(env.OBCF_D1));

    const body = await request.json();
    // TODO: Update role in database

    return NextResponse.json({ data: { id: params.id, ...body } });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const { env } = await getCloudflareContext();
    setDriver(createD1Driver(env.OBCF_D1));

    // TODO: Delete role from database (check if system role first)

    return NextResponse.json({ success: true });
}
```

## 📊 Testing Checklist

### Organizations & Members (Generic CRUD)
- [ ] Run migrations: `curl -X POST http://localhost:3004/api/ottaorm/init`
- [ ] Navigate to `/organizations`
- [ ] Create test organization
- [ ] Edit organization
- [ ] Navigate to members page for organization
- [ ] Invite test member
- [ ] Edit member role
- [ ] Remove member
- [ ] Delete organization

### RBAC Roles (Custom Implementation)
- [ ] Implement `/api/rbac/roles` endpoints
- [ ] Navigate to `/admin/rbac/roles`
- [ ] View system roles (owner, admin, member)
- [ ] Create custom role
- [ ] Edit custom role permissions
- [ ] Delete custom role
- [ ] Verify system roles cannot be deleted

## 🎯 Quick Start

**Minimum to get working**:
1. Run database migrations
2. Test organizations CRUD (should work out-of-the-box)
3. Test members CRUD (should work out-of-the-box)
4. Implement RBAC roles API endpoints (custom implementation required)

**Estimated time to full functionality**: 30-60 minutes
