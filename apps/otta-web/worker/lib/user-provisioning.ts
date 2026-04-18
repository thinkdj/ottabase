import { DEFAULT_ROUTE_MAPPINGS } from '@ottabase/brand-engine';
import { BrandKit, LayoutRouteMapping } from '@ottabase/brand-engine/persistence';
import { Organization, OrganizationMember, Role } from '@ottabase/ottaorm/models';
import { makeSlug } from '@ottabase/utils/url';

type ProvisionRoleName = 'owner' | 'admin' | 'member' | 'viewer';
type UserLike = {
    get: (key: string) => unknown;
    assignRole: (roleId: string, assignedBy?: string, organizationId?: string) => Promise<void>;
};

/**
 * Ensure brand defaults exist for the given app.
 * Uses BrandKit + DEFAULT_ROUTE_MAPPINGS — saves to DB via ORM.
 * Call after tables exist and ORM connection is registered.
 *
 * @param fallbackBrandName — Used when creating a new kit
 * @param appId — App to seed. When provided, creates app-scoped kit + mappings.
 *               When null, creates system fallback (appId=null). Pass env.APP_ID for current app.
 */
export async function ensureAppBrandDefaults(fallbackBrandName: string, appId: string | null = null): Promise<void> {
    const targetAppId = appId ?? null;

    let kit = (await BrandKit.first({ appId: targetAppId, isDefault: true })) as BrandKit | null;
    if (!kit) {
        kit = (await BrandKit.first({ appId: targetAppId })) as BrandKit | null;
    }

    if (!kit) {
        kit = (await BrandKit.create({
            appId: targetAppId,
            isDefault: true,
            name: 'Default',
            brandName: fallbackBrandName || 'My App',
            themePresetId: 'default',
            defaultColorScheme: 'system',
            allowDarkModeToggle: true,
        })) as BrandKit;
    }

    const existingMappings = (await LayoutRouteMapping.where({
        appId: targetAppId,
    })) as LayoutRouteMapping[];

    if (existingMappings.length === 0) {
        const brandKitId = String(kit.get('id') || '');
        if (!brandKitId) {
            throw new Error('Failed to resolve default brand kit id');
        }

        for (const mapping of DEFAULT_ROUTE_MAPPINGS) {
            await LayoutRouteMapping.create({
                appId: targetAppId,
                pathPattern: mapping.pathPattern,
                layoutTemplateId: mapping.layoutTemplateId,
                brandKitId,
                priority: mapping.priority,
            });
        }
    }
}

export async function provisionDefaultOrganizationForUser(params: {
    user: UserLike;
    email?: string | null;
    name?: string | null;
    organizationRole?: 'owner' | 'member';
    assignedBy?: string;
    roleFallbacks?: ProvisionRoleName[];
    /** App ID for brand kit seeding — when provided, ensures app-scoped default kit exists */
    appId?: string | null;
}): Promise<{
    organizationId: string;
    organizationRole: 'owner' | 'member';
    assignedRole: string | null;
    brandSetupError?: string;
}> {
    const {
        user,
        email = null,
        name = null,
        organizationRole = 'owner',
        assignedBy,
        roleFallbacks = ['member', 'viewer'],
        appId = null,
    } = params;

    const userId = String(user.get('id') || '');
    if (!userId) {
        throw new Error('Missing user id for organization provisioning');
    }

    let organizationId: string | null = null;
    let resolvedOrganizationRole: 'owner' | 'member' = organizationRole;
    const fallbackBrandName = (name || email?.split('@')[0] || 'My App').trim() || 'My App';

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

        // Resolve a unique slug, then create with retry on unique-constraint conflict (TOCTOU guard)
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

        let organization: InstanceType<typeof Organization>;
        try {
            organization = await Organization.create({
                name: orgName,
                slug,
                ownerId: userId,
            });
        } catch (err: unknown) {
            // Handle unique-constraint race: another request may have taken the slug between findBySlug and create
            const msg = err instanceof Error ? err.message : String(err);
            if (/unique|constraint|duplicate/i.test(msg)) {
                slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
                organization = await Organization.create({
                    name: orgName,
                    slug,
                    ownerId: userId,
                });
            } else {
                throw err;
            }
        }

        organizationId = String(organization.get('id') || '');

        await OrganizationMember.create({
            userId,
            organizationId,
            role: resolvedOrganizationRole,
            status: 'active',
        });
    }

    let brandSetupError: string | undefined;

    if (organizationId) {
        try {
            await ensureAppBrandDefaults(fallbackBrandName, appId ?? null);
        } catch (brandError) {
            brandSetupError = brandError instanceof Error ? brandError.message : String(brandError);
            console.error('[user-provisioning] Default brand setup failed:', brandError);
        }
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
        brandSetupError,
    };
}
