import type { KVNamespace } from '@cloudflare/workers-types';
import { invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { Role } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess, SYSTEM_ORGANIZATION_ID } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

/** Invalidate all RBAC cache entries when roles change */
async function invalidateRBACCache(env: { OBCF_KV?: KVNamespace }): Promise<void> {
    if (!env.OBCF_KV) return;
    try {
        await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
    } catch {
        // Cache invalidation failure is non-fatal
    }
}

/**
 * Map the admin-guard's resolved active org to the role storage convention:
 * system-scope admins ('system' sentinel) manage GLOBAL roles (organizationId = NULL); an org
 * admin manages their own organization's roles (organizationId = their org id).
 */
function roleScopeOrgId(authOrgId: string | null): string | null {
    return !authOrgId || authOrgId === SYSTEM_ORGANIZATION_ID ? null : authOrgId;
}

/** Normalize a role row's owning org to null (global) | string (tenant). */
function roleOrgOf(role: { get: (k: string) => unknown }): string | null {
    return (role.get('organizationId') as string | null) ?? null;
}

/**
 * GET /api/rbac/roles - List roles visible to the caller.
 * Global/system roles (organizationId NULL) are visible to everyone; an org admin additionally
 * sees their own organization's custom roles.
 */
export async function handleAdminRolesList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const scopeOrg = roleScopeOrgId(auth.organizationId);
    const [globalRoles, ownRoles] = await Promise.all([
        Role.where({ organizationId: null }, { orderBy: 'name', orderDirection: 'asc' }),
        scopeOrg
            ? Role.where({ organizationId: scopeOrg }, { orderBy: 'name', orderDirection: 'asc' })
            : Promise.resolve([]),
    ]);

    return jsonResponse({ data: [...globalRoles, ...ownRoles].map((r) => r.toJson()) });
}

/**
 * POST /api/rbac/roles - Create a role in the caller's scope.
 * System admins create global roles; org admins create roles owned by their organization.
 */
export async function handleAdminRoleCreate(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const scopeOrg = roleScopeOrgId(auth.organizationId);
    const body = (await context.request.json()) as any;
    if (!body.name) return errorResponse('Role name is required', 400, { code: 'VALIDATION_ERROR' });

    // Reject a duplicate name within the same scope. Org-scoped roles are also DB-unique via the
    // composite index; this additionally guards global roles (NULL org is distinct in SQLite).
    const existing = await Role.findByName(String(body.name), scopeOrg);
    if (existing) {
        return errorResponse('A role with this name already exists', 409, {
            code: 'ROLE_ALREADY_EXISTS',
            fieldErrors: { name: ['A role with this name already exists'] },
        });
    }

    const role = await Role.create({
        name: body.name,
        // Server-controlled scope — never trust a client-supplied organizationId.
        organizationId: scopeOrg,
        description: body.description || null,
        permissions: Array.isArray(body.permissions) ? JSON.stringify(body.permissions) : body.permissions || '[]',
        isSystem: false,
    });
    await invalidateRBACCache(context.env);
    return jsonResponse({ data: role.toJson() });
}

/**
 * PATCH /api/rbac/roles/:id - Update a role the caller owns (same scope only).
 */
export async function handleAdminRoleUpdate(context: ApiRouteContext, roleId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const scopeOrg = roleScopeOrgId(auth.organizationId);
    const role = await Role.find(roleId);
    // Out-of-scope roles are reported as not-found so an org admin cannot probe another tenant's roles.
    if (!role || roleOrgOf(role) !== scopeOrg) {
        return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    }

    const body = (await context.request.json()) as any;
    if (body.name !== undefined) role.set('name', body.name);
    if (body.description !== undefined) role.set('description', body.description);
    if (body.permissions !== undefined) {
        role.set('permissions', Array.isArray(body.permissions) ? JSON.stringify(body.permissions) : body.permissions);
    }
    await role.save();
    await invalidateRBACCache(context.env);
    return jsonResponse({ data: role.toJson() });
}

/**
 * DELETE /api/rbac/roles/:id - Delete a role the caller owns (same scope, non-system only).
 */
export async function handleAdminRoleDelete(context: ApiRouteContext, roleId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const scopeOrg = roleScopeOrgId(auth.organizationId);
    const role = await Role.find(roleId);
    if (!role || roleOrgOf(role) !== scopeOrg) {
        return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    }
    if (role.get('isSystem')) return errorResponse('Cannot delete system roles', 403, { code: 'FORBIDDEN' });
    // Instance delete is `destroy()` — `role.delete()` is not a method (delete is a static on the
    // model), so the previous call would have thrown at runtime.
    await role.destroy();
    await invalidateRBACCache(context.env);
    return jsonResponse({ success: true });
}
