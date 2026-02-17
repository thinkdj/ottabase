import { Organization, OrganizationMember, Role } from '@ottabase/ottaorm/models';
import { makeSlug } from '@ottabase/utils/url';

type ProvisionRoleName = 'owner' | 'admin' | 'member' | 'viewer';
type UserLike = {
    get: (key: string) => unknown;
    assignRole: (roleId: string, assignedBy?: string, organizationId?: string) => Promise<void>;
};

export async function provisionDefaultOrganizationForUser(params: {
    user: UserLike;
    email?: string | null;
    name?: string | null;
    organizationRole?: 'owner' | 'member';
    assignedBy?: string;
    roleFallbacks?: ProvisionRoleName[];
}): Promise<{ organizationId: string; organizationRole: 'owner' | 'member'; assignedRole: string | null }> {
    const {
        user,
        email = null,
        name = null,
        organizationRole = 'owner',
        assignedBy,
        roleFallbacks = ['member', 'viewer'],
    } = params;

    const userId = String(user.get('id') || '');
    if (!userId) {
        throw new Error('Missing user id for organization provisioning');
    }

    let organizationId: string | null = null;
    let resolvedOrganizationRole: 'owner' | 'member' = organizationRole;

    const existingMembership = await OrganizationMember.first({ userId, status: 'active' });
    if (existingMembership) {
        organizationId = String(existingMembership.get('organizationId') || '');
        const existingRole = existingMembership.get('role');
        if (existingRole === 'owner' || existingRole === 'member') {
            resolvedOrganizationRole = existingRole;
        }
    }

    if (!organizationId) {
        const baseName = (name || email?.split('@')[0] || 'Workspace').trim();
        const orgName = `${baseName}'s Workspace`;
        const baseSlug = makeSlug(orgName) || `org-${userId.slice(0, 8)}`;

        let slug = baseSlug;
        let attempt = 0;
        while (await Organization.findBySlug(slug)) {
            attempt += 1;
            slug = `${baseSlug}-${attempt}`;
            if (attempt > 8) {
                slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
                break;
            }
        }

        const organization = await Organization.create({
            name: orgName,
            slug,
            ownerId: userId,
        });

        organizationId = String(organization.get('id') || '');

        await OrganizationMember.create({
            userId,
            organizationId,
            role: resolvedOrganizationRole,
            status: 'active',
        });
    }

    await Role.ensureDefaultRoles();

    let assignedRole: string | null = null;
    for (const roleName of roleFallbacks) {
        const role = await Role.findByName(roleName);
        if (role) {
            await user.assignRole(String(role.get('id')), assignedBy, organizationId);
            assignedRole = String(role.get('name'));
            break;
        }
    }

    if (!organizationId) {
        throw new Error('Failed to resolve organization id for user provisioning');
    }

    return {
        organizationId,
        organizationRole: resolvedOrganizationRole,
        assignedRole,
    };
}
