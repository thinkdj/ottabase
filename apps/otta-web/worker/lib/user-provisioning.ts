import { DEFAULT_ROUTE_MAPPINGS } from '@ottabase/brand-engine';
import { BrandKit, LayoutRouteMapping } from '@ottabase/brand-engine/persistence';
import { Organization, Role } from '@ottabase/ottaorm/models';
import { getRBACCache } from '@ottabase/rbac';

type UserLike = {
    get: (key: string) => unknown;
};

/**
 * Ensure brand defaults exist for the given app.
 * Uses BrandKit + DEFAULT_ROUTE_MAPPINGS — saves to DB via ORM.
 * Call after tables exist and ORM connection is registered.
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

/**
 * Ensure the given user owns a personal organization and seed default brand
 * assets for the current app. Thin wrapper over `Organization.ensurePersonalOrg`
 * so callers (bootstrap, first-signin hook, onboarding) share one code path.
 */
export async function provisionDefaultOrganizationForUser(params: {
    user: UserLike;
    email?: string | null;
    name?: string | null;
    /** App ID for brand kit seeding — when provided, ensures app-scoped default kit exists */
    appId?: string | null;
}): Promise<{
    organizationId: string;
    brandSetupError?: string;
}> {
    const { user, email = null, name = null, appId = null } = params;

    const userId = String(user.get('id') || '');
    if (!userId) {
        throw new Error('Missing user id for organization provisioning');
    }

    await Role.ensureDefaults();

    const organization = await Organization.ensurePersonalOrg(
        {
            id: userId,
            name: name ?? (user.get('name') as string | null | undefined) ?? null,
            email: email ?? (user.get('email') as string | null | undefined) ?? null,
        },
        { cache: getRBACCache(), appId },
    );

    const organizationId = String(organization.get('id') || '');
    if (!organizationId) {
        throw new Error('Failed to resolve organization id for user provisioning');
    }

    const fallbackBrandName = (name || email?.split('@')[0] || 'My App').trim() || 'My App';
    let brandSetupError: string | undefined;
    try {
        await ensureAppBrandDefaults(fallbackBrandName, appId);
    } catch (brandError) {
        brandSetupError = brandError instanceof Error ? brandError.message : String(brandError);
        console.error('[user-provisioning] Default brand setup failed:', brandError);
    }

    return { organizationId, brandSetupError };
}
