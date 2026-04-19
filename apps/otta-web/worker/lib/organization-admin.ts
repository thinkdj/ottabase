import { Role, User } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { ApiRouteContext } from '../routes/router';
import { requireAdminAccess, SYSTEM_ORGANIZATION_ID, type AdminContext } from './admin-guard';

const TENANT_SYNC_ROLE_NAMES = ['owner', 'admin', 'member', 'viewer'] as const;

export function canAccessOrganization(auth: AdminContext, organizationId: string): boolean {
    return (
        auth.organizationId === SYSTEM_ORGANIZATION_ID ||
        auth.organizationId === organizationId ||
        auth.rbac.organizationId === organizationId
    );
}

export function resolveTenantOrganizationId(auth: Pick<AdminContext, 'organizationId' | 'rbac'>): string | null {
    const scopedOrganizationId = auth.rbac.organizationId ?? auth.organizationId ?? null;
    if (!scopedOrganizationId || scopedOrganizationId === SYSTEM_ORGANIZATION_ID) {
        return null;
    }

    return scopedOrganizationId;
}

/**
 * Shared helper for "current-organization" handlers: authenticate as admin,
 * resolve the tenant org from context, and return either the org id or an
 * appropriate error Response.
 */
export async function resolveCurrentOrgForAdmin(context: ApiRouteContext): Promise<string | Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const organizationId = resolveTenantOrganizationId(auth);
    if (!organizationId) {
        return errorResponse('Select an organization to manage first', 400, { code: 'ORG_CONTEXT_REQUIRED' });
    }
    return organizationId;
}

export async function syncMembershipRoleToTenantRBAC(params: {
    userId: string;
    organizationId: string;
    membershipRole: 'owner' | 'admin' | 'member';
    membershipStatus: 'active' | 'invited' | 'suspended';
    assignedBy?: string;
}): Promise<void> {
    const { userId, organizationId, membershipRole, membershipStatus, assignedBy } = params;
    const user = await User.find(userId);
    if (!user) {
        throw new Error('User not found for tenant RBAC sync');
    }

    await Role.ensureDefaultRoles();

    const resolvedRoles = await Promise.all(
        TENANT_SYNC_ROLE_NAMES.map(async (roleName) => {
            const role = await Role.findByName(roleName);
            return [roleName, role] as const;
        }),
    );

    for (const [, role] of resolvedRoles) {
        if (!role) continue;
        await user.removeRole(String(role.get('id')), organizationId);
    }

    if (membershipStatus !== 'active') {
        return;
    }

    const targetRoleName = membershipRole === 'owner' || membershipRole === 'admin' ? membershipRole : 'member';
    const targetRole = resolvedRoles.find(([roleName]) => roleName === targetRoleName)?.[1];

    if (!targetRole) {
        throw new Error(`Role ${targetRoleName} not found for tenant RBAC sync`);
    }

    await user.assignRole(String(targetRole.get('id')), assignedBy, organizationId);
}
