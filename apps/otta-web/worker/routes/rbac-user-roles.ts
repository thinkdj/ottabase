import { OrganizationMember, Role, User, UserRole } from '@ottabase/ottaorm/models';
import { getRBACCache } from '@ottabase/rbac';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { canAccessOrganization, requireAdminAccess } from '../lib/admin-guard';
import { auditOrganizationAction } from '../lib/org-audit';
import { enforceRateLimit } from '../lib/rate-limiting';
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

async function ensureActiveMember(userId: string, organizationId: string): Promise<boolean> {
    const membership = await OrganizationMember.first({
        userId,
        organizationId,
        status: 'active',
    });
    return !!membership;
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

    if (!(await ensureActiveMember(userId, organizationId))) {
        return errorResponse('Member not found', 404, { code: 'MEMBER_NOT_FOUND' });
    }

    const assignments = await UserRole.getUserRoles(userId, organizationId);

    // Batch fetch all related roles and users to avoid N+1 queries
    const roleIds = [...new Set(assignments.map((a) => a.get('roleId') as string))];
    const assignerIds = [...new Set(assignments.map((a) => a.get('assignedBy') as string).filter(Boolean))];

    const [roles, assigners] = await Promise.all([
        roleIds.length > 0 ? Role.whereIn('id', roleIds) : Promise.resolve([]),
        assignerIds.length > 0 ? User.whereIn('id', assignerIds) : Promise.resolve([]),
    ]);

    const rolesMap = new Map(roles.map((r) => [r.get('id'), r]));
    const assignersMap = new Map(assigners.map((u) => [u.get('id'), u]));

    const serialized = assignments.map((a) => {
        const roleId = a.get('roleId') as string;
        const assignedBy = a.get('assignedBy') as string;
        const role = rolesMap.get(roleId);
        const assigner = assignersMap.get(assignedBy);

        return {
            userId: a.get('userId'),
            roleId,
            roleName: role?.get('name') ?? null,
            roleDescription: role?.get('description') ?? null,
            isSystemRole: !!role?.get('isSystem'),
            organizationId: a.get('organizationId'),
            appId: a.get('appId') ?? null,
            assignedAt: a.get('assignedAt') ?? null,
            assignedBy,
            assignedByName: assigner?.get('name') ?? null,
        };
    });

    return jsonResponse({ data: serialized.filter((assignment) => !assignment.isSystemRole) });
}

/**
 * POST /api/rbac/user-roles
 * Body: { userId, roleId, organizationId? }
 *
 * Assigns a role to a user in the current organization. Idempotent.
 * Rate limited to 20 requests per minute per organization to prevent cache DOS.
 */
export async function handleRBACUserRoleAssign(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    // Rate limit: 20 role assignments per minute per organization
    const rateLimitKey = `rbac:role-assign:${auth.organizationId}`;
    const rateLimit = await enforceRateLimit(context.request, context.env, rateLimitKey, {
        limit: 20,
        period: 60,
    });
    if (rateLimit) return rateLimit;

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

    // This endpoint manages additive tenant custom roles only.
    // Membership/system roles are owned by OrganizationMember lifecycle methods.
    if (role.get('isSystem')) {
        return errorResponse('System role assignments must be managed via organization membership', 409, {
            code: 'SYSTEM_ROLE_ASSIGNMENT_FORBIDDEN',
        });
    }

    if (!(await ensureActiveMember(userId, organizationId))) {
        // Use generic error to avoid revealing org membership structure
        return errorResponse('Operation not permitted', 403, {
            code: 'FORBIDDEN',
        });
    }

    const cache = getRBACCache();
    await (user as User).assignRole(roleId, auth.user.id, organizationId, { cache });
    await invalidateRBACCache(context.env);

    // Audit trail for security-critical action
    await auditOrganizationAction(context.request, {
        userId: auth.user.id,
        userEmail: auth.user.email ?? null,
        organizationId,
        action: 'RBAC_ROLE_ASSIGNED',
        resourceType: 'user_role',
        resourceId: userId,
        metadata: { roleId, roleName: role.get('name') as string },
    });

    const userRole = await UserRole.first({ userId, roleId, organizationId });
    if (!userRole) {
        return errorResponse('Failed to create role assignment', 500, { code: 'ASSIGNMENT_FAILED' });
    }
    return jsonResponse({ data: await serializeAssignment(userRole as UserRole) }, 201);
}

/**
 * DELETE /api/rbac/user-roles/:userId/:roleId?organizationId=<id>
 * Rate limited to 20 requests per minute per organization to prevent abuse.
 */
export async function handleRBACUserRoleRemove(
    context: ApiRouteContext,
    userId: string,
    roleId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    // Rate limit: 20 role removals per minute per organization
    const rateLimitKey = `rbac:role-remove:${auth.organizationId}`;
    const rateLimit = await enforceRateLimit(context.request, context.env, rateLimitKey, {
        limit: 20,
        period: 60,
    });
    if (rateLimit) return rateLimit;

    const url = new URL(context.request.url);
    const organizationId = resolveOrganizationId(url, auth.organizationId);
    if (!organizationId) {
        return errorResponse('organizationId is required', 400, { code: 'VALIDATION_ERROR' });
    }
    if (!canAccessOrganization(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const [user, role] = (await Promise.all([User.find(userId), Role.find(roleId)])) as [User | null, Role | null];
    if (!user) return errorResponse('User not found', 404, { code: 'USER_NOT_FOUND' });
    if (!role) return errorResponse('Role not found', 404, { code: 'ROLE_NOT_FOUND' });

    if (role.get('organizationId') !== null && role.get('organizationId') !== organizationId) {
        return errorResponse('Role not found', 404, { code: 'ROLE_NOT_FOUND' });
    }

    if (role.get('isSystem')) {
        return errorResponse('System role assignments must be managed via organization membership', 409, {
            code: 'SYSTEM_ROLE_ASSIGNMENT_FORBIDDEN',
        });
    }

    if (!(await ensureActiveMember(userId, organizationId))) {
        // Use generic error to avoid revealing org membership structure
        return errorResponse('Operation not permitted', 403, { code: 'FORBIDDEN' });
    }

    const cache = getRBACCache();
    await user.removeRole(roleId, organizationId, { cache });
    await invalidateRBACCache(context.env);

    // Audit trail for security-critical action
    await auditOrganizationAction(context.request, {
        userId: auth.user.id,
        userEmail: auth.user.email ?? null,
        organizationId,
        action: 'RBAC_ROLE_REMOVED',
        resourceType: 'user_role',
        resourceId: userId,
        metadata: { roleId, roleName: role.get('name') as string },
    });

    return jsonResponse({ success: true });
}
