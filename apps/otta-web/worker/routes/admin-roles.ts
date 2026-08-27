import { invalidateCacheByPrefix } from '@ottabase/cf/kv-cache';
import { Role, UserRole } from '@ottabase/ottaorm/models';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import { bumpProfileVersion } from '../lib/auth-utils';
import type { ApiRouteContext } from './router';

/** Invalidate all RBAC cache entries when system roles change */
async function invalidateRBACCache(env: ApiRouteContext['env']): Promise<void> {
    if (!env.OBCF_KV) return;
    try {
        await invalidateCacheByPrefix(env.OBCF_KV, 'rbac:');
    } catch {
        // Cache invalidation failure is non-fatal
    }
}

/**
 * Refresh the live sessions of everyone holding a role after its permission set changes (or the
 * role is deleted), so the new permissions take effect immediately instead of persisting in each
 * holder's session snapshot until their JWT expires. Role edits are rare admin actions, so
 * enumerating holders and bumping each is acceptable. Best-effort.
 */
async function getRoleHolderUserIds(roleId: string): Promise<string[]> {
    const userRoles = await UserRole.where({ roleId });
    return [...new Set(userRoles.map((ur) => String(ur.get('userId'))).filter(Boolean))];
}

async function refreshRoleHolderSessions(context: ApiRouteContext, userIds: string[]): Promise<void> {
    await Promise.allSettled(userIds.map((userId) => bumpProfileVersion(context.env, userId)));
}

/**
 * GET /api/admin/roles - List all roles
 */
export async function handleAdminRolesList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;
    const roles = [] as InstanceType<typeof Role>[];
    for await (const page of Role.pages({ perPage: 100 })) roles.push(...page);
    roles.sort((left, right) => String(left.get('name')).localeCompare(String(right.get('name'))));
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
    // System roles are framework-owned: their permissions are defined in code and are reconciled by
    // Role.ensureDefaultRoles() (the seed self-heal), so an edit here would be silently reverted on
    // the next seed. Reject it (mirrors DELETE) — customize by creating a NEW role instead.
    if (role.get('isSystem')) {
        return errorResponse('Cannot edit system roles (create a custom role instead)', 403, { code: 'FORBIDDEN' });
    }
    const body = (await context.request.json()) as any;
    let holderUserIds: string[] = [];
    if (body.permissions !== undefined) {
        try {
            holderUserIds = await getRoleHolderUserIds(roleId);
        } catch (error) {
            console.error(
                JSON.stringify({
                    event: 'role_holder_enumeration_failed',
                    roleId: roleId.slice(0, 128),
                    error: redactErrorForLog(error),
                }),
            );
            return errorResponse('Could not safely update role holders', 500, { code: 'ROLE_HOLDER_LOOKUP_FAILED' });
        }
    }
    if (body.name !== undefined) role.set('name', body.name);
    if (body.description !== undefined) role.set('description', body.description);
    if (body.permissions !== undefined) {
        role.set('permissions', Array.isArray(body.permissions) ? JSON.stringify(body.permissions) : body.permissions);
    }
    await role.save();
    await invalidateRBACCache(context.env);
    // A changed permission set only reaches live sessions on a snapshot refresh.
    if (body.permissions !== undefined) {
        await refreshRoleHolderSessions(context, holderUserIds);
    }
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
    // Capture holders before deletion, but bump their profile versions only AFTER the role and
    // grants are gone. Bumping first lets an intervening request cache the old role under the new
    // version and keep it until another natural refresh.
    let holderUserIds: string[];
    try {
        holderUserIds = await getRoleHolderUserIds(roleId);
    } catch (error) {
        console.error(
            JSON.stringify({
                event: 'role_holder_enumeration_failed',
                roleId: roleId.slice(0, 128),
                error: redactErrorForLog(error),
            }),
        );
        return errorResponse('Could not safely delete role', 500, { code: 'ROLE_HOLDER_LOOKUP_FAILED' });
    }
    await Role.delete(roleId);
    await invalidateRBACCache(context.env);
    await refreshRoleHolderSessions(context, holderUserIds);
    return jsonResponse({ success: true });
}
