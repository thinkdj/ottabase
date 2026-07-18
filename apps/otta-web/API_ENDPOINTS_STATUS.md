# API Endpoints Status for RBAC UI

## Overview

This document tracks the status of API endpoints required by the new Organizations and RBAC UI components.

## Endpoints Handled by Generic CRUD (@ottabase/ottaorm)

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
    - Status: ❌ **Intentionally disabled**
    - Used by: Not used by OrganizationMembersPage
    - Query params: `page`, `per_page`, `organizationId` (filter)

- **GET** `/api/ottaorm/organization_members/:id`
    - Status: ❌ **Intentionally disabled**
    - Used by: Not used by OrganizationMembersPage

- **POST** `/api/ottaorm/organization_members`
    - Status: ❌ **Intentionally disabled**
    - Used by: Not used by OrganizationMembersPage
    - Body: `{ userId, organizationId, role, status, invitedBy, invitedAt }`

- **PATCH** `/api/ottaorm/organization_members/:id`
    - Status: ❌ **Intentionally disabled**
    - Used by: Not used by OrganizationMembersPage
    - Body: `{ role, status }`

- **DELETE** `/api/ottaorm/organization_members/:id`
    - Status: ❌ **Intentionally disabled**
    - Used by: Not used by OrganizationMembersPage

## ✅ Custom Admin Endpoints (Implemented)

### Admin Users

These endpoints bypass the disabled `/api/ottaorm/users` CRUD and provide admin-level user management:

- **GET** `/api/admin/users`
    - Status: ✅ **Implemented**
    - Used by: UserManagementPage (list all users)
    - Auth: Requires system admin access
    - Response: Paginated envelope (`{ data, pagination, meta? }`)

- **GET** `/api/admin/users/:id`
    - Status: ✅ **Implemented**
    - Used by: UserRBACPage (user details + memberships)
    - Auth: Requires system admin access
    - Response: `{ data: { ...User, memberships: OrganizationMember[] } }`

- **GET** `/api/admin/users/search`
    - Status: ✅ **Implemented**
    - Used by: InviteMemberForm user picker
    - Auth: Requires admin access
    - Tenant-safety behavior:
        - System admins can search by name/email/id.
        - Organization-scoped admins are restricted to exact email lookup only.

### Admin Organization Members

- **GET** `/api/admin/organizations/:organizationId/members`
    - Status: ✅ **Implemented**
    - Used by: OrganizationMembersPage (paginated member list)

- **POST** `/api/admin/organizations/:organizationId/members/invite`
    - Status: ✅ **Implemented**
    - Used by: OrganizationMembersPage (invite member)

- **PATCH** `/api/admin/organizations/:organizationId/members/:userId`
    - Status: ✅ **Implemented**
    - Used by: OrganizationMembersPage (role/status updates)
    - Guardrail: Cannot demote or deactivate the last active owner (returns `409 LAST_ACTIVE_OWNER_GUARD`)

- **DELETE** `/api/admin/organizations/:organizationId/members/:userId`
    - Status: ✅ **Implemented**
    - Used by: OrganizationMembersPage (member removal)
    - Guardrail: Cannot remove the last active owner (returns `409 LAST_ACTIVE_OWNER_GUARD`)

## ✅ Admin Roles Endpoints (Implemented)

### RBAC Roles

Implemented in `worker/routes/admin-roles.ts` using the Role ORM model:

- **GET** `/api/admin/roles`
    - Status: ✅ **Implemented**
    - Used by: Admin/system role management APIs (RBACRolesPage currently calls `/api/rbac/roles`)
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

- **POST** `/api/admin/roles`
    - Status: ✅ **Implemented**
    - Used by: Admin/system role management APIs (RBACRolesPage currently calls `/api/rbac/roles`)
    - Auth: Requires system admin access
    - Body: `{ name, description?, permissions? }`

- **PATCH** `/api/admin/roles/:id`
    - Status: ✅ **Implemented**
    - Used by: Admin/system role management APIs (RBACRolesPage currently calls `/api/rbac/roles`)
    - Auth: Requires system admin access
    - Body: `{ name?, description?, permissions? }`

- **DELETE** `/api/admin/roles/:id`
    - Status: ✅ **Implemented**
    - Used by: Admin/system role management APIs (RBACRolesPage currently calls `/api/rbac/roles`)
    - Auth: Requires system admin access
    - Prevents deletion of system roles (returns 403)

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

### RBAC Roles

- [x] Implement `/api/admin/roles` endpoints (GET, POST, PATCH, DELETE)
- [ ] Navigate to `/admin/access/rbac/roles`
- [ ] View system roles (platform_owner, owner, admin, member)
- [ ] Create custom role
- [ ] Edit custom role permissions
- [ ] Delete custom role
- [ ] Verify system roles cannot be deleted

## Quick Start

**Minimum to get working**:

1. Run database migrations
2. Test organizations CRUD (should work out-of-the-box)
3. Test members CRUD (should work out-of-the-box)
4. Test RBAC roles API endpoints (implemented via `/api/admin/roles`)
