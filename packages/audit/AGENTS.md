# @ottabase/audit — agent notes

Audit-trail logging (who did what) persisted via the ottaorm `AuditLog` model, plus route middleware. Full docs: ./README.md

## Use when

- Recording user actions — CRUD, auth, role changes — to `audit_logs`, or auto-auditing API route handlers with `withAudit`.
- NOT for app/debug logging — use `@ottabase/logger`.

## Imports

```ts
import { log, logAudit, logCreate, logUpdate, logDelete, logRead, logAuth, logRoleAssign, logRoleRemove, logFailure, extractRequestContext, detectChanges, sanitizeData, withAudit, createAuditMiddleware, Audit } from '@ottabase/audit';
import type { AuditAction, AuditStatus, AuditLogData, AuditRequestContext, AuditMiddlewareOptions } from '@ottabase/audit';
// Subpath exports: '@ottabase/audit/utils' (helpers), '@ottabase/audit/middleware' (withAudit, createAuditMiddleware, Audit)
```

## Canonical usage

```ts
// Simple: log(userId, action, metadata?, userEmail?)
await log('user-123', 'updated_profile', { field: 'name' });

// CRUD helper with request context
const context = extractRequestContext(request, userId, userEmail);
await logUpdate('post', postId, detectChanges(oldData, newData), context);
```

```ts
// Auto-audit a Next.js/Worker route handler
import { withAudit } from '@ottabase/audit/middleware';

export const POST = withAudit(
    async (request) => Response.json({ success: true }),
    { resourceType: 'user', action: 'create' },
);
```

## Gotchas

- `logAudit` rethrows on DB failure — a broken audit write crashes your handler; wrap if audit is best-effort.
- `sanitizeData` is NOT applied automatically — call it on bodies/changes before logging (redacts password/token/secret/apiKey by default).
- `withAudit` reads the user from the `x-user-id` header and runs `User.find` per request; without `action` it infers from the HTTP method.
- Persistence goes through `@ottabase/ottaorm` `AuditLog` — DB must be configured; pass `organizationId`/`appId` in `AuditLogData` for tenant/RLS context.
- Edge-runtime safe (Web `Request`, no Node-only APIs).
