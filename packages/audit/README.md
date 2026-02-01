# @ottabase/audit

Audit logging utilities and middleware for Ottabase applications.

## Features

- ✅ Automatic audit logging for API routes
- ✅ Manual audit logging utilities
- ✅ Database persistence via @ottabase/ottaorm
- ✅ Change tracking (before/after values)
- ✅ Request context capture (IP, user agent)
- ✅ Integration with @ottabase/logger
- ✅ Support for success/failure/error status

## Installation

```bash
pnpm add @ottabase/audit
```

## Quick Start

### 1. Automatic Audit Logging (Middleware)

```typescript
// app/api/users/route.ts
import { withAudit } from '@ottabase/audit/middleware';
import { User } from '@ottabase/ottaorm/models';

export const POST = withAudit(
  async (request) => {
    const body = await request.json();
    const user = await User.create(body);
    return Response.json({ user });
  },
  {
    resourceType: 'user',
    action: 'create',
    includeRequestBody: true
  }
);

export const PATCH = withAudit(
  async (request, { params }) => {
    const body = await request.json();
    const user = await User.find(params.id);
    user.set('name', body.name);
    await user.save();
    return Response.json({ user });
  },
  {
    resourceType: 'user',
    action: 'update',
    getResourceId: (req, params) => params.id,
    getChanges: async (req, params) => {
      const body = await req.clone().json();
      return { name: { from: 'old', to: body.name } };
    }
  }
);
```

### 2. Manual Audit Logging

```typescript
import { logCreate, logUpdate, logDelete, logAuth } from '@ottabase/audit/utils';

// Log creation
await logCreate('user', userId, userData, {
  userId: currentUserId,
  userEmail: currentUserEmail,
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0'
});

// Log update with changes
await logUpdate('user', userId, {
  name: { from: 'Old Name', to: 'New Name' },
  email: { from: 'old@example.com', to: 'new@example.com' }
}, context);

// Log deletion
await logDelete('user', userId, context);

// Log authentication
await logAuth('login', userId, userEmail, context, true);
```

### 3. Extract Request Context

```typescript
import { extractRequestContext } from '@ottabase/audit/utils';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const userEmail = request.headers.get('x-user-email');

  const context = extractRequestContext(request, userId, userEmail);
  // context contains: userId, userEmail, ipAddress, userAgent, url, method

  await logCreate('resource', 'resource-id', data, context);
}
```

## Audit Actions

The package supports the following audit actions:

| Action | Description |
|--------|-------------|
| `create` | Resource creation |
| `read` | Resource access/read |
| `update` | Resource modification |
| `delete` | Resource deletion |
| `login` | User login |
| `logout` | User logout |
| `signup` | User registration |
| `password_change` | Password changed |
| `password_reset` | Password reset |
| `email_verify` | Email verification |
| `role_assign` | Role assigned to user |
| `role_remove` | Role removed from user |
| `permission_grant` | Permission granted |
| `permission_revoke` | Permission revoked |
| `export` | Data export |
| `import` | Data import |
| `custom` | Custom action |

## API Reference

### Middleware

#### `withAudit(handler, options)`

Wraps an API route handler with automatic audit logging.

```typescript
withAudit(handler, {
  resourceType: string,
  action?: string,
  getResourceId?: (request, params) => string | Promise<string>,
  getChanges?: (request, params) => Record<string, any> | Promise<Record<string, any>>,
  includeRequestBody?: boolean,
  includeResponseBody?: boolean
})
```

### Utilities

#### `logAudit(data)`

Low-level audit logging function.

```typescript
await logAudit({
  userId?: string,
  userEmail?: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  changes?: Record<string, { from?: any, to?: any }>,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string,
  status?: 'success' | 'failure' | 'error',
  errorMessage?: string
});
```

#### `logCreate(resourceType, resourceId, data, context?)`

Log resource creation.

#### `logUpdate(resourceType, resourceId, changes, context?)`

Log resource update with before/after changes.

#### `logDelete(resourceType, resourceId, context?)`

Log resource deletion.

#### `logRead(resourceType, resourceId, context?)`

Log resource access.

#### `logAuth(action, userId, userEmail, context?, success?)`

Log authentication action (login/logout/signup).

#### `logRoleAssign(userId, roleId, roleName, assignedBy?, context?)`

Log role assignment.

#### `logRoleRemove(userId, roleId, roleName, removedBy?, context?)`

Log role removal.

#### `logFailure(action, resourceType, error, context?, resourceId?)`

Log failed action.

#### `extractRequestContext(request, userId?, userEmail?)`

Extract audit context from request.

#### `detectChanges(oldData, newData)`

Detect changes between two objects.

```typescript
const changes = detectChanges(
  { name: 'Old', email: 'old@example.com' },
  { name: 'New', email: 'new@example.com' }
);
// Returns: { name: { from: 'Old', to: 'New' }, email: { from: 'old@example.com', to: 'new@example.com' } }
```

#### `sanitizeData(data, sensitiveFields?)`

Remove sensitive data before logging.

```typescript
const sanitized = sanitizeData(
  { name: 'John', password: 'secret', apiKey: 'key123' },
  ['password', 'apiKey', 'token']
);
// Returns: { name: 'John', password: '[REDACTED]', apiKey: '[REDACTED]' }
```

## Querying Audit Logs

```typescript
import { AuditLog } from '@ottabase/ottaorm/models';

// Get all audit logs for a user
const logs = await AuditLog.getByUser('user-id');

// Get audit logs for a resource
const resourceLogs = await AuditLog.getByResource('user', 'user-id');

// Get audit logs by action
const createLogs = await AuditLog.getByAction('create');

// Get recent audit logs
const recentLogs = await AuditLog.getRecent(100);

// Get failed actions
const failures = await AuditLog.getFailures();

// Get audit logs in date range
const logs = await AuditLog.getByDateRange(
  new Date('2024-01-01'),
  new Date('2024-12-31')
);
```

## Database Transport (Logger Integration)

Use audit logging with @ottabase/logger:

```typescript
import { createLogger } from '@ottabase/logger';
import { AuditDbTransport } from '@ottabase/logger/audit-transport';

const logger = createLogger({
  transports: [
    new AuditDbTransport({
      getUserContext: () => ({
        userId: 'user-123',
        userEmail: 'user@example.com'
      }),
      getRequestContext: () => ({
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0'
      }),
      minLevel: 1, // INFO and above
      bufferSize: 10,
      flushInterval: 5000
    })
  ]
});

// Log with audit context
logger.info('User created', {
  action: 'create',
  resourceType: 'user',
  resourceId: 'user-123',
  changes: { name: 'John Doe' }
});
```

## Best Practices

1. **Always sanitize sensitive data** before logging
2. **Use middleware for automatic logging** when possible
3. **Include request context** for compliance and debugging
4. **Log both successes and failures**
5. **Use structured changes** for updates (before/after)
6. **Set appropriate buffer sizes** for high-traffic applications

## License

MIT
