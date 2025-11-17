# @ottabase/auditlog

> Auditing & changelog system for Ottabase applications using Cloudflare D1

A comprehensive, Cloudflare-first audit logging system that makes it easy to track user actions, data changes, and system events in your Ottabase applications.

## Features

- **Cloudflare D1 First**: Built specifically for Cloudflare D1 database
- **Easy to Use**: Simple API for logging actions - `auditlog(model, user, ...)`
- **Flexible**: Supports both standalone logging and model-based tracking
- **Type-Safe**: Full TypeScript support with comprehensive types
- **Powerful Querying**: Filter and search audit logs with ease
- **Configurable**: Control what gets captured (IP, user agent, changes, etc.)
- **Multi-Tenant Ready**: Built-in support for organization/tenant isolation

## Installation

```bash
pnpm add @ottabase/auditlog @ottabase/cf
```

## Quick Start

### 1. Initialize the Database Schema

First, create the audit log table in your Cloudflare D1 database:

```typescript
import { D1Client } from '@ottabase/cf';
import { initAuditLogSchema } from '@ottabase/auditlog/schema';

// In your Cloudflare Worker
export default {
  async fetch(request: Request, env: Env) {
    const d1Client = new D1Client({ database: env.DB });

    // Initialize schema (run this once during setup)
    await initAuditLogSchema(d1Client);

    return new Response('Schema initialized!');
  },
};
```

### 2. Basic Usage - Simple Function API

The quickest way to add audit logging:

```typescript
import { createAuditLogger } from '@ottabase/auditlog';
import { D1Client } from '@ottabase/cf';

const d1Client = new D1Client({ database: env.DB });
const auditlog = createAuditLogger(d1Client);

// Log an action
await auditlog({
  userId: 'user_123',
  userName: 'John Doe',
  action: 'CREATE',
  model: 'Post',
  modelId: 'post_456',
  description: 'Created a new blog post',
  metadata: { title: 'My First Post', tags: ['tech', 'ai'] }
});
```

### 3. Class-Based API

For more control and advanced features:

```typescript
import { AuditLog } from '@ottabase/auditlog';
import { D1Client } from '@ottabase/cf';

const d1Client = new D1Client({ database: env.DB });
const audit = new AuditLog(d1Client, {
  enabled: true,
  captureIp: true,
  captureUserAgent: true,
  storeChanges: true,
  defaultOrganizationId: 'org_123'
});

// Log an action
const result = await audit.log({
  userId: 'user_123',
  userName: 'Jane Smith',
  action: 'UPDATE',
  model: 'User',
  modelId: 'user_123',
  ipAddress: request.headers.get('CF-Connecting-IP'),
  userAgent: request.headers.get('User-Agent'),
  changes: {
    before: { email: 'old@example.com' },
    after: { email: 'new@example.com' }
  },
  description: 'Updated email address'
});

if (result.success) {
  console.log(`Audit log created with ID: ${result.id}`);
}
```

### 4. Model-Based Logging

Convenient helper for tracking model changes:

```typescript
import { auditModel } from '@ottabase/auditlog';

await auditModel(d1Client, {
  model: 'Order',
  modelId: 'order_789',
  action: 'UPDATE',
  user: { id: 'user_123', name: 'John Doe' },
  changes: {
    before: { status: 'pending' },
    after: { status: 'shipped' }
  },
  description: 'Order status updated to shipped',
  metadata: { trackingNumber: 'TRACK123' }
});
```

## Querying Audit Logs

### Query with Filters

```typescript
const audit = new AuditLog(d1Client);

// Get all CREATE actions for a user
const result = await audit.query({
  userId: 'user_123',
  action: 'CREATE',
  limit: 50,
  sortOrder: 'DESC'
});

if (result.success) {
  console.log(`Found ${result.total} audit logs`);
  result.entries?.forEach(entry => {
    console.log(`${entry.timestamp}: ${entry.action} on ${entry.model}`);
  });
}
```

### Get Model History

Track all changes to a specific record:

```typescript
const history = await audit.getModelHistory('Post', 'post_456');

if (history.success) {
  history.entries?.forEach(entry => {
    console.log(`${entry.timestamp}: ${entry.action} by ${entry.userName}`);
    if (entry.changes) {
      console.log('Changes:', entry.changes);
    }
  });
}
```

### Get User Activity

View all actions by a specific user:

```typescript
const userActivity = await audit.getUserHistory('user_123', 100);

if (userActivity.success) {
  console.log(`User performed ${userActivity.total} actions`);
}
```

### Advanced Filtering

```typescript
const result = await audit.query({
  model: 'Order',
  action: 'UPDATE',
  organizationId: 'org_123',
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-12-31T23:59:59Z',
  limit: 100,
  offset: 0,
  sortOrder: 'DESC'
});
```

## Supported Actions

The following actions are supported out of the box:

- `CREATE` - Creating new records
- `UPDATE` - Updating existing records
- `DELETE` - Deleting records
- `READ` - Reading/viewing records (if you want to track access)
- `LOGIN` - User login events
- `LOGOUT` - User logout events
- `EXPORT` - Data export operations
- `IMPORT` - Data import operations
- `CUSTOM` - Custom actions specific to your app

## Configuration Options

```typescript
const audit = new AuditLog(d1Client, {
  // Enable or disable audit logging globally
  enabled: true,

  // Automatically capture IP address
  captureIp: true,

  // Automatically capture user agent
  captureUserAgent: true,

  // Store before/after changes
  storeChanges: true,

  // Default organization ID for multi-tenant setups
  defaultOrganizationId: 'org_123'
});
```

## Data Retention

Delete old audit logs to comply with data retention policies:

```typescript
// Delete logs older than 90 days
const date = new Date();
date.setDate(date.getDate() - 90);

const result = await audit.deleteOlderThan(date.toISOString());

if (result.success) {
  console.log('Old audit logs deleted successfully');
}
```

## Type Definitions

### AuditLogEntry

```typescript
interface AuditLogEntry {
  id?: string;
  timestamp: string;
  userId: string;
  userName?: string;
  action: AuditAction;
  model?: string;
  modelId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  description?: string;
  sessionId?: string;
  organizationId?: string;
}
```

### AuditLogFilter

```typescript
interface AuditLogFilter {
  userId?: string;
  model?: string;
  modelId?: string;
  action?: AuditAction;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  sortOrder?: 'ASC' | 'DESC';
}
```

## Complete Example with Cloudflare Worker

```typescript
import { D1Client } from '@ottabase/cf';
import { AuditLog } from '@ottabase/auditlog';

interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const d1Client = new D1Client({ database: env.DB });
    const audit = new AuditLog(d1Client);

    const url = new URL(request.url);

    // Example: Log a user action
    if (url.pathname === '/api/posts' && request.method === 'POST') {
      const body = await request.json();

      // Your business logic here...
      const post = { id: 'post_123', title: body.title };

      // Audit the creation
      await audit.log({
        userId: 'user_123',
        userName: 'John Doe',
        action: 'CREATE',
        model: 'Post',
        modelId: post.id,
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        description: `Created post: ${post.title}`,
        metadata: { title: post.title }
      });

      return Response.json({ success: true, post });
    }

    // Example: Query audit logs
    if (url.pathname === '/api/audit-logs') {
      const userId = url.searchParams.get('userId');
      const result = await audit.query({
        userId: userId || undefined,
        limit: 50
      });

      return Response.json(result);
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

## Database Schema

The package automatically creates the following table structure in Cloudflare D1:

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  model TEXT,
  model_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  changes TEXT,
  description TEXT,
  session_id TEXT,
  organization_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

With indexes on: `user_id`, `model`, `model_id`, `action`, `timestamp`, `organization_id`, `session_id`

## Best Practices

1. **Initialize Schema Once**: Run `initAuditLogSchema()` during your deployment or setup phase
2. **Capture Context**: Always include IP address and user agent for security auditing
3. **Store Changes**: For critical data, enable `storeChanges` to track before/after states
4. **Use Descriptions**: Add human-readable descriptions for better audit trail clarity
5. **Implement Retention**: Set up automated cleanup of old logs based on your compliance needs
6. **Multi-Tenancy**: Use `organizationId` to isolate audit logs in multi-tenant systems
7. **Error Handling**: Always check the `success` flag in results and handle errors appropriately

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
