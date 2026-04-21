import { Role, User, UserRole } from '@ottabase/ottaorm/models';
import { getRBACCache } from '@ottabase/rbac';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { canAccessOrganization, requireAdminAccess } from '../lib/admin-guard';
import { invalidateRBACCache } from './admin-roles';
import type { ApiRouteContext } from './router';

/**
 * RBAC User-Role assignment — additive custom roles on top of the user's
 * organization-membership role. Scoped to the current tenant (org).
 *
 * Organization membership roles (owner/admin/member/viewer) are managed via
 * the Organization Members page (`admin-organization-members.ts`). This file
 * handles extra custom roles (e.g. `editor`, `analyst`).
 */

function resolveOrganizationId(url: URL, fallback: string): string | null {
    const requested = url.searchParams.get('organizationId');
    if (requested) return requested;
    return fallback || null;
}

async function serializeAssignment(userRole: UserRole) {
    const [role, assigner] = await Promise.all([userRole.role(), userRole.assigner()]);
    return {
        userId: userRole.get('userId'),
        roleId: userRole.get('roleId'),
        roleName: role?.get('name') ?? null,
        roleDescription: role?.get('description') ?? null,
        isSystemRole: !!role?.get('isSystem'),
        organizationId: userRole.get('organizationId'),
        appId: userRole.get('appId') ?? null,
        assignedAt: userRole.get('assignedAt') ?? null,
        assignedBy: userRole.get('assignedBy') ?? null,
        assignedByName: assigner?.get('name') ?? null,
    };
}

/**
 * GET /api/rbac/user-roles?userId=<id>&organizationId=<id>
 *
 * Lists role assignments for a single user within an organization. If
 * `organizationId` is omitted, the caller's current org is used.
 */
export async function handleRBACUserRolesList(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const url = new URL(context.request.url);
    const userId = url.searchParams.get('userId')?.trim();
    if (!userId) {
        return errorResponse('userId is required', 400, { code: 'VALIDATION_ERROR' });
    }

    const organizationId = resolveOrganizationId(url, auth.organizationId);
    if (!organizationId) {
        return errorResponse('organizationId is required', 400, { code: 'VALIDATION_ERROR' });
    }
    if (!canAccessOrganization(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const assignments = await UserRole.getUserRoles(userId, organizationId);
    const serialized = await Promise.all(assignments.map((a) => serializeAssignment(a as UserRole)));
    return jsonResponse({ data: serialized });
}

/**
 * POST /api/rbac/user-roles
 * Body: { userId, roleId, organizationId? }
 *
 * Assigns a role to a user in the current organization. Idempotent.
 */
export async function handleRBACUserRoleAssign(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    let body: { userId?: string; roleId?: string; organizationId?: string };
    try {
        body = (await context.request.json()) as typeof body;
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'BAD_REQUEST' });
    }

    const userId = body.userId?.trim();
    const roleId = body.roleId?.trim();
    if (!userId || !roleId) {
        return errorResponse('userId and roleId are required', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: {
                ...(userId ? {} : { userId: ['userId is required'] }),
                ...(roleId ? {} : { roleId: ['roleId is required'] }),
            },
        });
    }

    const organizationId = body.organizationId?.trim() || auth.organizationId;
    if (!organizationId) {
        return errorResponse('organizationId is required', 400, { code: 'VALIDATION_ERROR' });
    }
    if (!canAccessOrganization(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const [user, role] = await Promise.all([User.find(userId), Role.find(roleId)]);
    if (!user) return errorResponse('User not found', 404, { code: 'USER_NOT_FOUND' });
    if (!role) return errorResponse('Role not found', 404, { code: 'ROLE_NOT_FOUND' });

    // Security: the role must be a system role (organizationId is null) or belong to
    // the target org. Returning 404 to avoid disclosing the existence of custom roles
    // from other organizations. System roles pass because their organizationId is null.
    if (role.get('organizationId') !== null && role.get('organizationId') !== organizationId) {
        return errorResponse('Role not found', 404, { code: 'ROLE_NOT_FOUND' });
    }

    const cache = getRBACCache();
    await (user as User).assignRole(roleId, auth.user.id, organizationId, { cache });
    await invalidateRBACCache(context.env);

    const userRole = await UserRole.first({ userId, roleId, organizationId });
    if (!userRole) {
        return errorResponse('Failed to create role assignment', 500, { code: 'ASSIGNMENT_FAILED' });
    }
    return jsonResponse({ data: await serializeAssignment(userRole as UserRole) }, 201);
}

/**
 * DELETE /api/rbac/user-roles/:userId/:roleId?organizationId=<id>
 */
export async function handleRBACUserRoleRemove(
    context: ApiRouteContext,
    userId: string,
    roleId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const url = new URL(context.request.url);
    const organizationId = resolveOrganizationId(url, auth.organizationId);
    if (!organizationId) {
        return errorResponse('organizationId is required', 400, { code: 'VALIDATION_ERROR' });
    }
    if (!canAccessOrganization(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const user = (await User.find(userId)) as User | null;
    if (!user) return errorResponse('User not found', 404, { code: 'USER_NOT_FOUND' });

    const cache = getRBACCache();
    await user.removeRole(roleId, organizationId, { cache });
    await invalidateRBACCache(context.env);
    return jsonResponse({ success: true });
}
