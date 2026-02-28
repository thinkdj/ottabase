import type { KVNamespace } from '@cloudflare/workers-types';
import { invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { Role } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

/** Invalidate all RBAC cache entries when system roles change */
async function invalidateRBACCache(env: { OBCF_KV?: KVNamespace }): Promise<void> {
    if (!env.OBCF_KV) return;
    try {
        await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
    } catch {
        // Cache invalidation failure is non-fatal
    }
}

/**
 * GET /api/admin/roles - List all roles
 */
export async function handleAdminRolesList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;
    const roles = await Role.all({ orderBy: 'name', orderDirection: 'asc' });
    return jsonResponse({ data: roles.map((r) => r.toJson()) });
}

/**
 * POST /api/admin/roles - Create a new role
 */
export async function handleAdminRoleCreate(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;
    const body = (await context.request.json()) as any;
    if (!body.name) return errorResponse('Role name is required', 400, { code: 'VALIDATION_ERROR' });
    const role = await Role.create({
        name: body.name,
        description: body.description || null,
        permissions: Array.isArray(body.permissions) ? JSON.stringify(body.permissions) : body.permissions || '[]',
        isSystem: false,
    });
    await invalidateRBACCache(context.env);
    return jsonResponse({ data: role.toJson() });
}

/**
 * PATCH /api/admin/roles/:id - Update a role
 */
export async function handleAdminRoleUpdate(context: ApiRouteContext, roleId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;
    const role = await Role.find(roleId);
    if (!role) return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
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
 * DELETE /api/admin/roles/:id - Delete a role (system roles protected)
 */
export async function handleAdminRoleDelete(context: ApiRouteContext, roleId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;
    const role = await Role.find(roleId);
    if (!role) return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    if (role.get('isSystem')) return errorResponse('Cannot delete system roles', 403, { code: 'FORBIDDEN' });
    await role.delete();
    await invalidateRBACCache(context.env);
    return jsonResponse({ success: true });
}
