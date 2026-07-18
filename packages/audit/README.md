# @ottabase/audit

Audit logging for multi-tenant applications with RBAC context integration.

## Features

- **Multi-tenant support** - Organization + App context tracking via `logAudit()`
- **RBAC integration** - Automatic context from @ottabase/rbac
- **Change tracking** - Before/after value capture
- **Request metadata** - IP, user agent, URL, method
- **Database persistence** - Auto-save to audit_logs table
- **Structured logging** - Uses @ottabase/logger
- **Compliance ready** - Queryable audit trail
- **Route middleware** - Auto-log Next.js/Workers API handlers with `withAudit()`, or annotate class methods with the `@Audit` decorator

## Installation

```bash
pnpm add @ottabase/audit @ottabase/ottaorm @ottabase/logger
```

## Entry Points

- `@ottabase/audit` - everything below (utils + middleware)
- `@ottabase/audit/utils` - logging utilities only (`log`, `logAudit`, `logCreate`, etc.)
- `@ottabase/audit/middleware` - `withAudit`, `createAuditMiddleware`, and the `@Audit` decorator for auto-logging API routes/handlers

## Quick Start

### 1. Simple Logging

```typescript
import { log } from '@ottabase/audit';

// Basic: who did what
await log('user-123', 'updated_profile');

// With metadata
await log('user-123', 'deleted_post', {
    postId: 'post-456',
    reason: 'spam',
});

// With user email
await log(
    'user-123',
    'changed_password',
    {
        method: '2fa',
    },
    'user@example.com',
);
```

### 2. Detailed Logging

```typescript
import { logCreate, logUpdate, logDelete } from '@ottabase/audit';

// Log creation with context
await logCreate('post', postId, postData, {
    userId: currentUser.id,
    userEmail: currentUser.email,
    ipAddress: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
});

// Log update with changes
await logUpdate(
    'post',
    postId,
    {
        title: { from: 'Old Title', to: 'New Title' },
        status: { from: 'draft', to: 'published' },
    },
    context,
);

// Log deletion
await logDelete('post', postId, context);
```

> **Note:** `logCreate`, `logUpdate`, `logDelete`, `logRead`, `logAuth`, `logRoleAssign`, `logRoleRemove`, and `logFailure` only forward `userId`, `userEmail`, `ipAddress`, `userAgent`, `url`, and `method` from the `context` you pass them — they do **not** persist `organizationId` or `appId`. For multi-tenant records, call `logAudit(data)` directly with a full `AuditLogData` object, as shown next.

### 3. RBAC Integration

```typescript
import { buildAppContext, createAuditData } from '@ottabase/rbac';
import { logAudit } from '@ottabase/audit';

// Build RBAC context
const context = await buildAppContext({
    organizationId: 'org-123',
    appId: 'web',
    user,
    cache,
    ipAddress: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
});

// Create audit data from RBAC context (includes organizationId + appId)
const auditData = createAuditData(context, 'create', 'organization', orgId, { name: 'Acme Corp' });

// Log with full multi-tenant context
await logAudit(auditData);
```

## Multi-Tenant Architecture

### Context Structure

`AuditLogData` is the full record persisted by `logAudit()` — the low-level function used above for multi-tenant logging. It's also the shape returned by `@ottabase/rbac`'s `createAuditData()`.

```typescript
interface AuditLogData {
    userId?: string; // Who performed the action
    userEmail?: string; // User email for readability
    organizationId?: string; // Tenant context (required for multi-tenant)
    appId?: string; // App context (web, admin, api)
    action: string; // What happened
    resourceType: string; // Resource being modified
    resourceId?: string; // Specific resource ID
    changes?: Record<string, { from?: any; to?: any }>; // What changed
    metadata?: Record<string, any>; // Additional context
    ipAddress?: string; // Client IP
    userAgent?: string; // Client user agent
    status?: 'success' | 'failure' | 'error'; // Result status
    errorMessage?: string; // Error if failed
}
```

### Organization-Scoped Queries

```typescript
import { AuditLog } from '@ottabase/ottaorm/models';

// Get all logs for an organization
const orgLogs = await AuditLog.where(
    {
        organizationId: 'org-123',
    },
    {
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: 100,
    },
);

// Filter by action
const deletions = await AuditLog.where({
    organizationId: 'org-123',
    action: 'delete',
});

// Filter by user
const userActions = await AuditLog.where({
    organizationId: 'org-123',
    userId: 'user-456',
});

// Filter by resource type
const postChanges = await AuditLog.where({
    organizationId: 'org-123',
    resourceType: 'post',
});
```

## Audit Actions

| Action              | Description           |
| ------------------- | --------------------- |
| `create`            | Resource creation     |
| `read`              | Resource access       |
| `update`            | Resource modification |
| `delete`            | Resource deletion     |
| `login`             | User login            |
| `logout`            | User logout           |
| `signup`            | User registration     |
| `password_change`   | Password changed      |
| `password_reset`    | Password reset        |
| `email_verify`      | Email verification    |
| `role_assign`       | Role assigned         |
| `role_remove`       | Role removed          |
| `permission_grant`  | Permission granted    |
| `permission_revoke` | Permission revoked    |
| `export`            | Data export           |
| `import`            | Data import           |
| `custom`            | Custom action         |

## API Reference

### Core Functions

#### `logAudit(data)`

Low-level logging function — persists a complete `AuditLogData` object directly, including `organizationId` and `appId`. All other functions in this section are convenience wrappers around it; use `logAudit` directly whenever you need full multi-tenant context:

```typescript
await logAudit({
    userId: user.id,
    organizationId: 'org-123',
    appId: 'web',
    action: 'create',
    resourceType: 'organization',
    resourceId: orgId,
    changes: { name: 'Acme Corp' },
});
```

#### `log(userId, action, metadata?, userEmail?)`

Simple audit logging:

```typescript
await log('user-123', 'updated_settings', { setting: 'theme', value: 'dark' }, 'user@example.com');
```

#### `logCreate(resourceType, resourceId, data, context?)`

Log resource creation:

```typescript
await logCreate(
    'organization',
    orgId,
    {
        name: 'Acme Corp',
        plan: 'pro',
    },
    {
        userId: user.id,
        userEmail: user.email,
    },
);
```

#### `logUpdate(resourceType, resourceId, changes, context?)`

Log resource updates with change tracking:

```typescript
await logUpdate(
    'member',
    memberId,
    {
        role: { from: 'member', to: 'admin' },
        status: { from: 'invited', to: 'active' },
    },
    context,
);
```

#### `logDelete(resourceType, resourceId, context?)`

Log resource deletion:

```typescript
await logDelete('organization', orgId, context);
```

#### `logRead(resourceType, resourceId, context?)`

Log resource access (for sensitive data):

```typescript
await logRead('user', userId, context);
```

#### `logAuth(action, userId, userEmail, context?, success?)`

Log authentication events:

```typescript
await logAuth('login', userId, userEmail, context, true);
await logAuth('logout', userId, userEmail, context);
```

#### `logRoleAssign(userId, roleId, roleName, assignedBy?, context?)`

Log role assignment:

```typescript
await logRoleAssign('user-123', 'role-456', 'admin', currentUser.id, context);
```

#### `logRoleRemove(userId, roleId, roleName, removedBy?, context?)`

Log role removal:

```typescript
await logRoleRemove('user-123', 'role-456', 'admin', currentUser.id, context);
```

#### `logFailure(action, resourceType, error, context?, resourceId?)`

Log failed operations:

```typescript
try {
    // Operation that might fail
} catch (error) {
    await logFailure('delete', 'organization', error, context, orgId);
    throw error;
}
```

### Utility Functions

#### `extractRequestContext(request, userId?, userEmail?)`

Extract audit context from HTTP request:

```typescript
const context = extractRequestContext(request, user?.id, user?.email);

// Returns:
// {
//   userId: '...',
//   userEmail: '...',
//   ipAddress: '...',  // from cf-connecting-ip or x-forwarded-for
//   userAgent: '...',
//   url: '...',
//   method: '...',
// }
```

#### `detectChanges(oldData, newData)`

Detect changes between two objects:

```typescript
const changes = detectChanges({ name: 'Old Name', status: 'draft' }, { name: 'New Name', status: 'published' });

// Returns:
// {
//   name: { from: 'Old Name', to: 'New Name' },
//   status: { from: 'draft', to: 'published' },
// }
```

#### `sanitizeData(data, sensitiveFields?)`

Remove sensitive fields before logging:

```typescript
const safe = sanitizeData({ name: 'John', password: 'secret123', apiKey: 'key' }, ['password', 'apiKey']);

// Returns:
// { name: 'John', password: '[REDACTED]', apiKey: '[REDACTED]' }
```

### Middleware Functions

Imported from `@ottabase/audit/middleware` (Next.js / Cloudflare Workers).

#### `withAudit(handler, options)`

Higher-order wrapper for API route handlers. Calls the handler, then logs the request as a success or failure (via `logAudit`/`logFailure`), inferring the action from the HTTP method unless `options.action` is set:

```typescript
import { withAudit } from '@ottabase/audit/middleware';

export const POST = withAudit(
    async (request) => {
        // Your handler code
        return Response.json({ success: true });
    },
    {
        resourceType: 'user',
        action: 'create',
        getResourceId: async (req) => {
            const body = await req.json();
            return body.id;
        },
    },
);
```

#### `createAuditMiddleware(defaultOptions)`

Factory that returns a `withAudit`-like wrapper pre-configured with default options, useful for sharing `resourceType`/`action` defaults across routes.

#### `Audit(options)`

Method decorator that logs success/failure around a class method, assuming the first argument carries `user`/`resourceId` context:

```typescript
class OrganizationService {
    @Audit({ resourceType: 'organization', action: 'update' })
    async updateOrganization(context, orgId, data) {
        // ...
    }
}
```

## Integration Examples

### With RBAC Context

```typescript
import { buildAppContext } from '@ottabase/rbac';
import { logAudit } from '@ottabase/audit';

// Build context from request
const context = await buildAppContext({
    organizationId: extractOrgId(request),
    appId: 'web',
    user: await getCurrentUser(request),
    cache,
    ipAddress: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
});

// Update resource
const old = await Resource.find(resourceId);
await Resource.update(resourceId, newData);

// Log with full multi-tenant context (logUpdate would drop organizationId/appId)
await logAudit({
    userId: context.userId,
    userEmail: context.userEmail,
    organizationId: context.organizationId,
    appId: context.appId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    action: 'update',
    resourceType: 'resource',
    resourceId,
    changes: {
        name: { from: old.name, to: newData.name },
    },
});
```

### Worker Integration

```typescript
// Cloudflare Worker
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const user = await getCurrentUser(request, env);
        const orgId = await extractOrganizationId({ request });

        // Build context
        const context = {
            userId: user?.id,
            userEmail: user?.email,
            organizationId: orgId,
            appId: 'web',
            ipAddress: request.headers.get('cf-connecting-ip'),
            userAgent: request.headers.get('user-agent'),
        };

        try {
            // Perform operation
            const result = await someOperation();

            // Log success (logAudit persists organizationId/appId directly)
            await logAudit({
                ...context,
                action: 'create',
                resourceType: 'resource',
                resourceId: result.id,
                changes: { created: result },
                status: 'success',
            });

            return Response.json({ success: true, result });
        } catch (error) {
            // Log failure
            await logAudit({
                ...context,
                action: 'create',
                resourceType: 'resource',
                status: 'failure',
                errorMessage: error instanceof Error ? error.message : String(error),
            });

            return Response.json({ error: error.message }, { status: 500 });
        }
    },
};
```

### Compliance Queries

```typescript
// Export audit logs for compliance
const auditExport = await AuditLog.where(
    {
        organizationId: 'org-123',
        createdAt: { $gte: startDate, $lte: endDate },
    },
    {
        orderBy: 'createdAt',
        orderDirection: 'asc',
    },
);

const exportData = auditExport.map((log) => ({
    timestamp: log.createdAt,
    user: log.userEmail || log.userId,
    action: log.action,
    resource: `${log.resourceType}:${log.resourceId}`,
    changes: log.changes,
    ip: log.ipAddress,
}));

// Write to CSV or send to compliance system
```

## Related Packages

- **@ottabase/rbac** - RBAC context integration
- **@ottabase/ottaorm** - AuditLog model and database persistence
- **@ottabase/logger** - Structured logging

## Documentation

- **RBAC_MULTI_TENANT_GUIDE.md** - Complete multi-tenant guide
- **packages/rbac/README.md** - RBAC package reference
- **packages/ottaorm/README.md** - ORM and model usage

## License

MIT
