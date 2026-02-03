# @ottabase/audit

Audit logging for multi-tenant applications with RBAC context integration.

## Features

- ✅ **Multi-tenant support** - Organization + App context tracking
- ✅ **RBAC integration** - Automatic context from @ottabase/rbac
- ✅ **Change tracking** - Before/after value capture
- ✅ **Request metadata** - IP, user agent, URL, method
- ✅ **Database persistence** - Auto-save to audit_logs table
- ✅ **Structured logging** - Uses @ottabase/logger
- ✅ **Compliance ready** - Queryable audit trail

## Installation

```bash
pnpm add @ottabase/audit @ottabase/ottaorm @ottabase/logger
```

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
await log('user-123', 'changed_password', {
  method: '2fa',
}, 'user@example.com');
```

### 2. Detailed Logging

```typescript
import { logCreate, logUpdate, logDelete } from '@ottabase/audit';

// Log creation with context
await logCreate('post', postId, postData, {
  userId: currentUser.id,
  userEmail: currentUser.email,
  organizationId: 'org-123',  // Multi-tenant context
  appId: 'web',                // App context
  ipAddress: request.headers.get('cf-connecting-ip'),
  userAgent: request.headers.get('user-agent'),
});

// Log update with changes
await logUpdate('post', postId, {
  title: { from: 'Old Title', to: 'New Title' },
  status: { from: 'draft', to: 'published' },
}, context);

// Log deletion
await logDelete('post', postId, context);
```

### 3. RBAC Integration

```typescript
import { buildAppContext, createAuditData } from '@ottabase/rbac';
import { logCreate } from '@ottabase/audit';

// Build RBAC context
const context = await buildAppContext({
  organizationId: 'org-123',
  appId: 'web',
  user,
  cache,
  ipAddress: request.headers.get('cf-connecting-ip'),
  userAgent: request.headers.get('user-agent'),
});

// Create audit data from RBAC context
const auditData = createAuditData(
  context,
  'create',
  'organization',
  orgId,
  { name: 'Acme Corp' }
);

// Log with full context
await logCreate('organization', orgId, orgData, auditData);
```

## Multi-Tenant Architecture

### Context Structure

```typescript
interface AuditLogData {
  userId?: string;          // Who performed the action
  userEmail?: string;       // User email for readability
  organizationId?: string;  // Tenant context (required for multi-tenant)
  appId?: string;           // App context (web, admin, api)
  action: string;           // What happened
  resourceType: string;     // Resource being modified
  resourceId?: string;      // Specific resource ID
  changes?: Record<string, { from?: any; to?: any }>;  // What changed
  metadata?: Record<string, any>;   // Additional context
  ipAddress?: string;       // Client IP
  userAgent?: string;       // Client user agent
  status?: 'success' | 'failure' | 'error';  // Result status
  errorMessage?: string;    // Error if failed
}
```

### Organization-Scoped Queries

```typescript
import { AuditLog } from '@ottabase/ottaorm/models';

// Get all logs for an organization
const orgLogs = await AuditLog.where({
  organizationId: 'org-123',
}, {
  orderBy: 'timestamp',
  orderDirection: 'desc',
  limit: 100,
});

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

| Action | Description |
|--------|-------------|
| `create` | Resource creation |
| `read` | Resource access |
| `update` | Resource modification |
| `delete` | Resource deletion |
| `login` | User login |
| `logout` | User logout |
| `signup` | User registration |
| `password_change` | Password changed |
| `password_reset` | Password reset |
| `email_verify` | Email verification |
| `role_assign` | Role assigned |
| `role_remove` | Role removed |
| `permission_grant` | Permission granted |
| `permission_revoke` | Permission revoked |
| `export` | Data export |
| `import` | Data import |
| `custom` | Custom action |

## API Reference

### Core Functions

#### `log(userId, action, metadata?, userEmail?)`

Simple audit logging:

```typescript
await log(
  'user-123',
  'updated_settings',
  { setting: 'theme', value: 'dark' },
  'user@example.com'
);
```

#### `logCreate(resourceType, resourceId, data, context?)`

Log resource creation:

```typescript
await logCreate('organization', orgId, {
  name: 'Acme Corp',
  plan: 'pro',
}, {
  userId: user.id,
  organizationId: org.id,
  appId: 'web',
});
```

#### `logUpdate(resourceType, resourceId, changes, context?)`

Log resource updates with change tracking:

```typescript
await logUpdate('member', memberId, {
  role: { from: 'member', to: 'admin' },
  status: { from: 'invited', to: 'active' },
}, context);
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
await logRoleAssign(
  'user-123',
  'role-456',
  'admin',
  currentUser.id,
  context
);
```

#### `logRoleRemove(userId, roleId, roleName, removedBy?, context?)`

Log role removal:

```typescript
await logRoleRemove(
  'user-123',
  'role-456',
  'admin',
  currentUser.id,
  context
);
```

#### `logFailure(action, resourceType, error, context?, resourceId?)`

Log failed operations:

```typescript
try {
  // Operation that might fail
} catch (error) {
  await logFailure(
    'delete',
    'organization',
    error,
    context,
    orgId
  );
  throw error;
}
```

### Utility Functions

#### `extractRequestContext(request, userId?, userEmail?)`

Extract audit context from HTTP request:

```typescript
const context = extractRequestContext(
  request,
  user?.id,
  user?.email
);

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
const changes = detectChanges(
  { name: 'Old Name', status: 'draft' },
  { name: 'New Name', status: 'published' }
);

// Returns:
// {
//   name: { from: 'Old Name', to: 'New Name' },
//   status: { from: 'draft', to: 'published' },
// }
```

#### `sanitizeData(data, sensitiveFields?)`

Remove sensitive fields before logging:

```typescript
const safe = sanitizeData(
  { name: 'John', password: 'secret123', apiKey: 'key' },
  ['password', 'apiKey']
);

// Returns:
// { name: 'John', password: '[REDACTED]', apiKey: '[REDACTED]' }
```

## Integration Examples

### With RBAC Context

```typescript
import { buildAppContext } from '@ottabase/rbac';
import { logUpdate } from '@ottabase/audit';

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

// Log with full context
await logUpdate('resource', resourceId, {
  name: { from: old.name, to: newData.name },
}, {
  userId: context.userId,
  userEmail: context.userEmail,
  organizationId: context.organizationId,
  appId: context.appId,
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
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

      // Log success
      await logCreate('resource', result.id, result, context);

      return Response.json({ success: true, result });
    } catch (error) {
      // Log failure
      await logFailure('create', 'resource', error, context);

      return Response.json({ error: error.message }, { status: 500 });
    }
  }
};
```

### Compliance Queries

```typescript
// Export audit logs for compliance
const auditExport = await AuditLog.where({
  organizationId: 'org-123',
  timestamp: { $gte: startDate, $lte: endDate },
}, {
  orderBy: 'timestamp',
  orderDirection: 'asc',
});

const exportData = auditExport.map(log => ({
  timestamp: log.timestamp,
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
