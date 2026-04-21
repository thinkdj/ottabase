// ============================================================
// RBAC Roles — tenant-scoped role management
//
// All mutation endpoints require org-admin auth (scope: 'either').
// Custom roles are always bound to the caller's organization; system
// roles (isSystem=true, organizationId=null) are read-only from here.
//
// GET  /api/rbac/roles           — system roles + caller's org custom roles
// POST /api/rbac/roles           — create org-custom role (requires org admin)
// PATCH /api/rbac/roles/:id      — update org-custom role (requires org admin + ownership)
// DELETE /api/rbac/roles/:id     — delete org-custom role (requires org admin + ownership)
// ============================================================

import { Role } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { canAccessOrganization, requireAdminAccess, resolveTenantOrganizationId } from '../lib/admin-guard';
import { invalidateRBACCache } from './admin-roles';
import type { ApiRouteContext } from './router';

function serializeRole(role: Role) {
    return {
        id: role.get('id'),
        name: role.get('name'),
        organizationId: role.get('organizationId') ?? null,
        description: role.get('description'),
        permissions: role.getPermissions(),
        isSystem: role.get('isSystem'),
        createdAt: role.get('createdAt'),
        updatedAt: role.get('updatedAt'),
    };
}

/**
 * GET /api/rbac/roles
 *
 * Returns system roles + the current org's custom roles. Requires auth so that
 * org-specific role definitions are never exposed to a different tenant.
 *
 * When an org context is present, org-custom roles are appended after system
 * roles. When no tenant org is resolvable (e.g. platform-admin system scope),
 * only system roles are returned.
 */
export async function handleRBACRolesList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either', allowNullTenant: true });
    if (auth instanceof Response) return auth;

    try {
        const organizationId = resolveTenantOrganizationId(auth);
        const roles = organizationId
            ? await Role.findByOrg(organizationId)
            : ((await Role.where({ isSystem: true })) as Role[]);

        return jsonResponse({ data: roles.map(serializeRole) });
    } catch (err) {
        return errorResponse('Failed to load roles', 500, {
            code: 'ROLES_LIST_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

/**
 * POST /api/rbac/roles
 *
 * Create a custom role scoped to the caller's organization. System role names
 * (owner, admin, member, viewer) are reserved and cannot be reused as custom
 * role names to prevent accidental permission escalation.
 */
export async function handleRBACRoleCreate(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const organizationId = resolveTenantOrganizationId(auth);
    if (!organizationId) {
        return errorResponse('An organization context is required to create a custom role', 400, {
            code: 'ORG_CONTEXT_REQUIRED',
        });
    }

    const body = (await context.request.json()) as any;
    const name = typeof body.name === 'string' ? body.name.toLowerCase().trim() : '';
    if (!name) return errorResponse('Role name is required', 400, { code: 'VALIDATION_ERROR' });

    // Prevent shadowing system role names
    const SYSTEM_NAMES = new Set(['owner', 'admin', 'member', 'viewer']);
    if (SYSTEM_NAMES.has(name)) {
        return errorResponse(`"${name}" is a reserved system role name`, 409, { code: 'CONFLICT' });
    }

    // Enforce per-org uniqueness
    const existing = await Role.first({ name, organizationId });
    if (existing) {
        return errorResponse('A role with this name already exists in your organization', 409, { code: 'CONFLICT' });
    }

    const role = (await Role.create({
        name,
        organizationId,
        description: body.description || null,
        permissions: Array.isArray(body.permissions) ? JSON.stringify(body.permissions) : '[]',
        isSystem: false,
    })) as Role;

    await invalidateRBACCache(context.env);
    return jsonResponse({ data: serializeRole(role) }, 201);
}

/**
 * PATCH /api/rbac/roles/:id
 *
 * Update a custom role. The caller must be an org admin, the role must belong to
 * their organization, and system roles cannot be modified.
 */
export async function handleRBACRoleUpdate(context: ApiRouteContext, roleId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const role = (await Role.find(roleId)) as Role | null;
    if (!role) return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    if (role.get('isSystem')) return errorResponse('System roles cannot be modified', 403, { code: 'FORBIDDEN' });

    // Ownership check: the role must belong to the caller's org
    const roleOrgId = role.get('organizationId') as string | null;
    if (!roleOrgId || !canAccessOrganization(auth, roleOrgId)) {
        return errorResponse('You do not have permission to modify this role', 403, { code: 'FORBIDDEN' });
    }

    const body = (await context.request.json()) as any;
    if (body.description !== undefined) role.set('description', body.description);
    if (Array.isArray(body.permissions)) role.set('permissions', JSON.stringify(body.permissions));
    await role.save();

    await invalidateRBACCache(context.env);
    return jsonResponse({ data: serializeRole(role) });
}

/**
 * DELETE /api/rbac/roles/:id
 *
 * Delete a custom role. System roles and roles belonging to other orgs are
 * protected.
 */
export async function handleRBACRoleDelete(context: ApiRouteContext, roleId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const role = (await Role.find(roleId)) as Role | null;
    if (!role) return errorResponse('Role not found', 404, { code: 'NOT_FOUND' });
    if (role.get('isSystem')) return errorResponse('System roles cannot be deleted', 403, { code: 'FORBIDDEN' });

    // Ownership check
    const roleOrgId = role.get('organizationId') as string | null;
    if (!roleOrgId || !canAccessOrganization(auth, roleOrgId)) {
        return errorResponse('You do not have permission to delete this role', 403, { code: 'FORBIDDEN' });
    }

    await role.destroy();
    await invalidateRBACCache(context.env);
    return jsonResponse({ success: true });
}
