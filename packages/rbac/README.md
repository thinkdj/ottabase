# @ottabase/rbac

Role-Based Access Control (RBAC) package for Ottabase with middleware and utilities.

## Features

- ✅ Role and permission-based access control
- ✅ Wildcard permission matching (`users:*`, `*:read`, `*:*`)
- ✅ Next.js API route middleware
- ✅ Decorator support for class methods
- ✅ Organization/tenant scoping support
- ✅ Integration with @ottabase/ottaorm models

## Installation

```bash
pnpm add @ottabase/rbac
```

## Quick Start

### 1. Setup Roles and Permissions

```typescript
import { Role, Permission, User } from '@ottabase/ottaorm/models';

// Create default roles (run once during setup)
await Role.ensureDefaultRoles();

// Seed permissions
await Permission.seedDefaultPermissions();

// Assign role to user
const user = await User.find('user-id');
const adminRole = await Role.findByName('admin');
await user.assignRole(adminRole.get('id'));
```

### 2. Protect API Routes with Middleware

```typescript
// app/api/users/route.ts
import { withRBAC } from '@ottabase/rbac/middleware';
import { User } from '@ottabase/ottaorm/models';

export const GET = withRBAC(
  async (request) => {
    // Only users with 'users:read' permission can access
    const users = await User.all();
    return Response.json({ users });
  },
  {
    permissions: ['users:read'],
    getUserFromRequest: async (request) => {
      const userId = request.headers.get('x-user-id');
      return userId ? await User.find(userId) : null;
    }
  }
);

export const POST = withRBAC(
  async (request) => {
    // Only admins can create users
    const body = await request.json();
    const user = await User.create(body);
    return Response.json({ user });
  },
  {
    roles: ['admin']
  }
);
```

### 3. Check Permissions in Code

```typescript
import { checkPermission, checkRole } from '@ottabase/rbac/middleware';

// Check permission (throws RBACError if denied)
await checkPermission(user, 'users:create');

// Check role
await checkRole(user, 'admin');

// Check multiple permissions (any)
await checkPermission(user, ['users:read', 'users:update']);

// Check multiple permissions (all required)
await checkPermission(user, ['users:read', 'users:update'], { requireAll: true });
```

### 4. Use RBAC Context

```typescript
import { createRBACContext, hasPermission, hasRole, isAdmin } from '@ottabase/rbac';

const user = await User.find('user-id');
const context = await createRBACContext(user);

// Check permissions
const canRead = hasPermission(context, 'users:read');
const canManageUsers = hasPermission(context, 'users:*');

// Check roles
const isEditor = hasRole(context, 'editor');
const isAdminUser = isAdmin(context);

// Get allowed actions
const actions = getAllowedActions(context, 'users');
// Returns: ['create', 'read', 'update', 'delete']
```

## Permission Format

Permissions follow the format `resource:action`:

- `users:read` - Read users
- `users:create` - Create users
- `users:update` - Update users
- `users:delete` - Delete users
- `users:*` - All actions on users
- `*:read` - Read all resources
- `*:*` - All permissions (admin)

## Default Roles

The package includes three default roles:

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | Full system access | `*:*` |
| `editor` | Create and edit content | `*:read`, `*:create`, `*:update` |
| `viewer` | Read-only access | `*:read` |

## API Reference

### Middleware

#### `withRBAC(handler, config)`

Wraps an API route handler with RBAC checks.

```typescript
withRBAC(handler, {
  permissions?: string | string[],
  roles?: string | string[],
  requireAll?: boolean,
  getUserFromRequest?: (request: Request) => Promise<User | null>
})
```

#### `checkPermission(user, permission, options?)`

Checks if user has permission (throws on failure).

#### `checkRole(user, role, options?)`

Checks if user has role (throws on failure).

### Utilities

#### `createRBACContext(user)`

Creates an RBAC context from a user.

#### `hasPermission(context, permission, options?)`

Returns permission check result.

#### `hasRole(context, role, options?)`

Returns role check result.

#### `isAdmin(context)`

Checks if user is admin.

#### `getAllowedActions(context, resource)`

Gets all allowed actions for a resource.

## User Model Methods

The User model is extended with RBAC methods:

```typescript
const user = await User.find('user-id');

// Assign/remove roles
await user.assignRole(roleId, assignedBy?, organizationId?);
await user.removeRole(roleId, organizationId?);

// Check roles
await user.hasRole('admin');
await user.hasAnyRole(['admin', 'editor']);
await user.hasAllRoles(['editor', 'viewer']);

// Check permissions
await user.hasPermission('users:read');
await user.hasAnyPermission(['users:read', 'posts:read']);
await user.hasAllPermissions(['users:read', 'users:create']);

// Get permissions
const permissions = await user.getPermissions();

// Get roles
const roles = await user.roles();

// Check if admin
await user.isAdmin();
```

## Organization/Tenant Scoping

RBAC supports multi-tenant applications with organization scoping:

```typescript
// Assign role to user in specific organization
await user.assignRole(roleId, assignedBy, 'org-123');

// Check role in organization
await user.hasRole('admin', 'org-123');

// Remove role from organization
await user.removeRole(roleId, 'org-123');
```

## Error Handling

```typescript
import { RBACError } from '@ottabase/rbac';

try {
  await checkPermission(user, 'users:delete');
} catch (error) {
  if (error instanceof RBACError) {
    console.log(error.code); // 'UNAUTHORIZED' | 'FORBIDDEN'
    console.log(error.message);
    console.log(error.details);
  }
}
```

## License

MIT
