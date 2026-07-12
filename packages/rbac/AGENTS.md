# @ottabase/rbac — agent notes

Multi-tenant RBAC: org-scoped roles, wildcard permissions (`users:*`, `*:*`), two-level cache (request + KV), route middleware, admin guards. Full docs: ./README.md

## Use when

- Checking roles/permissions, guarding API routes (`withRBAC`), admin-only endpoints, or building tenant > app > user context.
- NOT for authentication (login/sessions) — that's @ottabase/auth. Roles/permissions tables + seeding live in @ottabase/ottaorm.

## Imports

    import { hasPermission, hasRole, isAdmin, createRBACContext, RBACError } from '@ottabase/rbac';
    import { withRBAC, requirePermission, requireRole, checkPermission, checkRole } from '@ottabase/rbac/middleware';
    import { initRBACCache, getRBACCache, clearRBACCache } from '@ottabase/rbac';
    import { buildAppContext, contextHasPermission, hasAnyRole, isOwnerOrAdmin } from '@ottabase/rbac';
    import { assertAdmin, requireAdminAccess } from '@ottabase/rbac/admin-guard';
    import { getRequestContext, SYSTEM_ORGANIZATION_ID } from '@ottabase/rbac/request-context';

## Canonical usage

    // Worker startup: KV-backed cache (skip this and every check hits the DB)
    import { initRBACCache } from '@ottabase/rbac';
    import { createKVClient } from '@ottabase/cf';
    initRBACCache({ kv: createKVClient({ namespace: env.RBAC_KV }), ttl: 300, prefix: 'rbac:' });

    // Protect a Next.js route handler
    import { withRBAC } from '@ottabase/rbac/middleware';
    export const GET = withRBAC(async (request) => Response.json({ ok: true }), {
        permissions: ['users:read'],
        cache: true, // true = global cache from initRBACCache
    });

    // Admin guard from request context
    const ctx = await getRequestContext(request, env);
    const guard = assertAdmin(ctx, { scope: 'organization' });
    if (guard instanceof Response) return guard; // 401/403 Response, else { user, organizationId }

## Gotchas

- Two `hasPermission`s: root export (utils, takes `RBACContext`) vs `contextHasPermission` (app-context, takes `AppContext`); admin-guard also exports its own taking `RequestContext`.
- `organizationId` is required for multi-tenant checks — same user has different roles per org; system scope uses `SYSTEM_ORGANIZATION_ID` ('system').
- Tables (`roles`, `permissions`, `user_roles`) and default rows are created by ottaorm's core runtime migrations (packages/ottaorm/src/migrations/index.ts) — no schema here, no Wiring needed. There is no seed script; `seedRBAC`/`seedRoles`/`seedPermissions` (packages/ottaorm/src/seed/rbac.ts) exist but must be called from code.
- `assertAdmin` returns a `Response` on failure (not a throw) — always check `instanceof Response`.
