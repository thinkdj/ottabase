import { Role } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import { invalidateRBACCache } from './admin-roles';
import type { ApiRouteContext } from './router';

function serializeRole(role: Role) {
    return {
        id: role.get('id'),
        name: role.get('name'),
        description: role.get('description'),
        permissions: role.getPermissions(),
        isSystem: role.get('isSystem'),
        createdAt: role.get('createdAt'),
        updatedAt: role.get('updatedAt'),
    };
}

/**
 * GET /api/rbac/roles — list all roles.
 * Read access only; no auth required (used by Permissions Matrix page).
 */
export async function handleRBACRolesList(_context: ApiRouteContext): Promise<Response> {
    try {
        const roles = await Role.all({ orderBy: 'name', orderDirection: 'asc' });
        return jsonResponse({ data: roles.map(serializeRole) });
    } catch (err) {
        return errorResponse('Failed to load roles', 500, {
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

/**
 * POST /api/rbac/roles — create a custom role. Requires system admin.
 */
export async function handleRBACRoleCreate(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const body = (await context.request.json()) as any;
    if (!body.name) return errorResponse('Role name is required', 400, { code: 'VALIDATION_ERROR' });

    const existing = await Role.first({ name: body.name });
    if (existing) return errorResponse('Role name already exists', 409, { code: 'CONFLICT' });

    const role = await Role.create({
        name: String(body.name).toLowerCase().trim(),
        description: body.description || null,
        permissions: Array.isArray(body.permissions) ? JSON.stringify(body.permissions) : '[]',
        isSystem: false,
    });

    await invalidateRBACCache(context.env);
    return jsonResponse({ data: serializeRole(role as Role) }, 201);
}

/**
 * PATCH /api/rbac/roles/:id — update name/description/permissions. System roles are protected.
 * Requires system admin.
 */
export async function handleRBACRoleUpdate(context: ApiRouteContext, roleId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const role = (await Role.find(roleId)) as Role | null;
    if (!role) return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    if (role.get('isSystem')) return errorResponse('System roles cannot be modified', 403, { code: 'FORBIDDEN' });

    const body = (await context.request.json()) as any;
    if (body.description !== undefined) role.set('description', body.description);
    if (Array.isArray(body.permissions)) role.set('permissions', JSON.stringify(body.permissions));
    await role.save();

    await invalidateRBACCache(context.env);
    return jsonResponse({ data: serializeRole(role) });
}

/**
 * DELETE /api/rbac/roles/:id — delete a custom role. System roles are protected.
 * Requires system admin.
 */
export async function handleRBACRoleDelete(context: ApiRouteContext, roleId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const role = (await Role.find(roleId)) as Role | null;
    if (!role) return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    if (role.get('isSystem')) return errorResponse('System roles cannot be deleted', 403, { code: 'FORBIDDEN' });

    await role.destroy();
    await invalidateRBACCache(context.env);
    return jsonResponse({ success: true });
}
