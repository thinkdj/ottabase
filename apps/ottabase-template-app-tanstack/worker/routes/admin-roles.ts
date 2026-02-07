import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getSession } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import { registerConnection } from '@ottabase/ottaorm';
import { Role } from '@ottabase/ottaorm/models';
import type { ApiRouteContext } from './router';

async function requireAdmin(context: ApiRouteContext) {
    const { request, env } = context;
    if (!env.OBCF_D1) return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    registerConnection('default', createD1Driver(env.OBCF_D1));
    const session = await getSession(request, env as any, getAuthOptions(env));
    if (!session?.user?.id) return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    return null;
}

/**
 * GET /api/admin/roles - List all roles
 */
export async function handleAdminRolesList(context: ApiRouteContext): Promise<Response> {
    const err = await requireAdmin(context);
    if (err) return err;
    const roles = await Role.all({ orderBy: 'name', orderDirection: 'asc' });
    return jsonResponse({ data: roles.map((r) => r.toJson()) });
}

/**
 * POST /api/admin/roles - Create a new role
 */
export async function handleAdminRoleCreate(context: ApiRouteContext): Promise<Response> {
    const err = await requireAdmin(context);
    if (err) return err;
    const body = (await context.request.json()) as any;
    if (!body.name) return errorResponse('Role name is required', 400, { code: 'VALIDATION_ERROR' });
    const role = await Role.create({
        name: body.name,
        description: body.description || null,
        permissions: Array.isArray(body.permissions) ? JSON.stringify(body.permissions) : body.permissions || '[]',
        isSystem: false,
    });
    return jsonResponse({ data: role.toJson() });
}

/**
 * PATCH /api/admin/roles/:id - Update a role
 */
export async function handleAdminRoleUpdate(context: ApiRouteContext, roleId: string): Promise<Response> {
    const err = await requireAdmin(context);
    if (err) return err;
    const role = await Role.find(roleId);
    if (!role) return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    const body = (await context.request.json()) as any;
    if (body.name !== undefined) role.set('name', body.name);
    if (body.description !== undefined) role.set('description', body.description);
    if (body.permissions !== undefined) {
        role.set('permissions', Array.isArray(body.permissions) ? JSON.stringify(body.permissions) : body.permissions);
    }
    await role.save();
    return jsonResponse({ data: role.toJson() });
}

/**
 * DELETE /api/admin/roles/:id - Delete a role (system roles protected)
 */
export async function handleAdminRoleDelete(context: ApiRouteContext, roleId: string): Promise<Response> {
    const err = await requireAdmin(context);
    if (err) return err;
    const role = await Role.find(roleId);
    if (!role) return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    if (role.get('isSystem')) return errorResponse('Cannot delete system roles', 403, { code: 'FORBIDDEN' });
    await role.delete();
    return jsonResponse({ success: true });
}
