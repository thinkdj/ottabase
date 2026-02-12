// ---------------------------------------------------------------------------
// Brand Engine – Brand Kit API handlers
// GET/POST /api/brand/kits, GET/PUT/DELETE /api/brand/kits/:id, POST /api/brand/kits/:id/clone, POST /api/brand/kits/:id/logo
// ---------------------------------------------------------------------------

import { BrandKit } from '../persistence/BrandKit.model';
import { createBrandCache } from '../persistence/cache';
import { createBrandAssets, type LogoType } from '../persistence/assets';
import type { BrandApiEnv } from './brand-api';
import type { BrandKitItem } from '../persistence/types';
import { jsonResponse } from '@ottabase/utils/http-response';
import { errorResponse } from '@ottabase/utils/http-errors';
import { logBrandAudit } from './audit-helper';

function serializeKit(kit: BrandKit): BrandKitItem {
    return {
        id: kit.get('id') as string,
        name: kit.get('name') as string,
        slug: (kit.get('slug') as string) ?? null,
        brandName: kit.get('brandName') as string,
        tagline: (kit.get('tagline') as string) ?? null,
        themePresetId: (kit.get('themePresetId') as string) ?? null,
        tokensJson: (kit.get('tokensJson') as string) ?? null,
        defaultColorScheme: (kit.get('defaultColorScheme') as string) ?? 'system',
        allowDarkModeToggle: (kit.get('allowDarkModeToggle') as boolean) ?? true,
        customCss: (kit.get('customCss') as string) ?? null,
        hideOttabaseBranding: (kit.get('hideOttabaseBranding') as boolean) ?? false,
        logoKey: (kit.get('logoKey') as string) ?? null,
        logoDarkKey: (kit.get('logoDarkKey') as string) ?? null,
        iconKey: (kit.get('iconKey') as string) ?? null,
        ogImageKey: (kit.get('ogImageKey') as string) ?? null,
        emailLogoKey: (kit.get('emailLogoKey') as string) ?? null,
        createdAt: kit.get('createdAt') as number,
        updatedAt: kit.get('updatedAt') as number,
    };
}

/** GET /api/brand/kits - List Brand Kits for org */
export async function handleGetBrandKits(
    _request: Request,
    _env: BrandApiEnv,
    organizationId: string | null,
): Promise<Response> {
    // Bootstrap default kit when listing system scope and none exist (ensures admin can edit default)
    if (organizationId === null) {
        await BrandKit.getOrCreateDefault();
    }
    const kits = (await BrandKit.where({ organizationId: organizationId ?? null }, { orderBy: 'name' })) as BrandKit[];
    const data = kits.map(serializeKit);
    return jsonResponse(data, 200);
}

/** GET /api/brand/kits/:id - Get one Brand Kit */
export async function handleGetBrandKit(
    _request: Request,
    _env: BrandApiEnv,
    id: string,
    organizationId: string | null,
): Promise<Response> {
    const kit = (await BrandKit.find(id)) as BrandKit | null;
    if (!kit) return errorResponse('Brand Kit not found', 404);
    const kOrg = kit.get('organizationId') as string | null;
    // System kits (org=null) are viewable by anyone; org-scoped kits require org match
    if (kOrg !== null && organizationId !== kOrg) return errorResponse('Brand Kit not found', 404);
    return jsonResponse(serializeKit(kit), 200);
}

/** POST /api/brand/kits - Create Brand Kit */
export async function handleCreateBrandKit(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;
    const name = body.name as string;
    if (!name || typeof name !== 'string') return errorResponse('name is required', 400);

    const kit = (await BrandKit.create({
        organizationId,
        name,
        slug: (body.slug as string) ?? null,
        brandName: (body.brandName as string) ?? 'My App',
        tagline: (body.tagline as string) ?? null,
        themePresetId: (body.themePresetId as string) ?? null,
        tokensJson:
            typeof body.tokensJson === 'string'
                ? body.tokensJson
                : body.tokensJson
                  ? JSON.stringify(body.tokensJson)
                  : null,
        defaultColorScheme: (body.defaultColorScheme as string) ?? 'system',
        allowDarkModeToggle: (body.allowDarkModeToggle as boolean) ?? true,
        customCss: (body.customCss as string) ?? null,
        hideOttabaseBranding: (body.hideOttabaseBranding as boolean) ?? false,
    })) as BrandKit;

    await createBrandCache(env.OBCF_KV).invalidate(organizationId, null);
    return jsonResponse(serializeKit(kit), 201);
}

/** PUT /api/brand/kits/:id - Update Brand Kit */
export async function handleUpdateBrandKit(
    request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
): Promise<Response> {
    const kit = (await BrandKit.find(id)) as BrandKit | null;
    if (!kit)
        return errorResponse('Brand Kit not found', 404, {
            details: `Requested ID: ${id}`,
            hint: 'If you restarted the dev server, refresh the Brand Kits list and try editing again.',
        });
    const kOrg = kit.get('organizationId') as string | null;
    // System kits (org=null) are editable by system-scoped users; org-scoped kits require org match
    if (kOrg !== null && organizationId !== kOrg) return errorResponse('Brand Kit not found', 404);

    const body = (await request.json()) as Record<string, unknown>;
    const fields = [
        'name',
        'slug',
        'brandName',
        'tagline',
        'themePresetId',
        'defaultColorScheme',
        'allowDarkModeToggle',
        'customCss',
        'hideOttabaseBranding',
    ] as const;
    for (const f of fields) {
        if (body[f] !== undefined) kit.set(f, body[f]);
    }
    if (body.tokensJson !== undefined) {
        kit.set('tokensJson', typeof body.tokensJson === 'string' ? body.tokensJson : JSON.stringify(body.tokensJson));
    }

    await kit.save();
    await createBrandCache(env.OBCF_KV).invalidate(organizationId, null);

    await logBrandAudit('brand.kit.update', request, { organizationId, kitId: id });
    return jsonResponse(serializeKit(kit), 200);
}

/** DELETE /api/brand/kits/:id */
export async function handleDeleteBrandKit(
    _request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
): Promise<Response> {
    const kit = (await BrandKit.find(id)) as BrandKit | null;
    if (!kit) return errorResponse('Brand Kit not found', 404);
    const kOrg = kit.get('organizationId') as string | null;
    if (kOrg !== null && organizationId !== kOrg) return errorResponse('Brand Kit not found', 404);

    await kit.destroy();
    await createBrandCache(env.OBCF_KV).invalidate(organizationId, null);
    return jsonResponse({ success: true }, 200);
}

/** POST /api/brand/kits/:id/clone - Clone Brand Kit */
export async function handleCloneBrandKit(
    request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
): Promise<Response> {
    const source = (await BrandKit.find(id)) as BrandKit | null;
    if (!source) return errorResponse('Brand Kit not found', 404);
    const sOrg = source.get('organizationId') as string | null;
    if (sOrg !== null && organizationId !== sOrg) return errorResponse('Brand Kit not found', 404);

    const body = (await request.json()) as { name?: string } | undefined;
    const newName = body?.name ?? `${source.get('name')} (Copy)`;

    const copy = (await BrandKit.create({
        organizationId,
        name: newName,
        slug: null,
        brandName: source.get('brandName'),
        tagline: source.get('tagline'),
        logoKey: source.get('logoKey'),
        logoDarkKey: source.get('logoDarkKey'),
        iconKey: source.get('iconKey'),
        ogImageKey: source.get('ogImageKey'),
        emailLogoKey: source.get('emailLogoKey'),
        themePresetId: source.get('themePresetId'),
        tokensJson: source.get('tokensJson'),
        defaultColorScheme: source.get('defaultColorScheme'),
        allowDarkModeToggle: source.get('allowDarkModeToggle'),
        customCss: source.get('customCss'),
        hideOttabaseBranding: source.get('hideOttabaseBranding'),
    })) as BrandKit;

    await createBrandCache(env.OBCF_KV).invalidate(organizationId, null);
    return jsonResponse(serializeKit(copy), 201);
}

/** POST /api/brand/kits/:id/logo - Upload logo for Brand Kit */
export async function handleUploadBrandKitLogo(
    request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    logoType: LogoType,
): Promise<Response> {
    const kit = (await BrandKit.find(id)) as BrandKit | null;
    if (!kit) return errorResponse('Brand Kit not found', 404);
    const kOrg = kit.get('organizationId') as string | null;
    if (kOrg !== null && organizationId !== kOrg) return errorResponse('Brand Kit not found', 404);

    const assets = createBrandAssets(env.OBCF_R2, env.R2_PUBLIC_URL || '');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return errorResponse('No file provided', 400);

    const buffer = await file.arrayBuffer();
    const key = await assets.uploadLogo(buffer, file.name, logoType);

    const fieldMap: Record<LogoType, string> = {
        logo: 'logoKey',
        'logo-dark': 'logoDarkKey',
        icon: 'iconKey',
        'og-image': 'ogImageKey',
        'email-logo': 'emailLogoKey',
    };
    kit.set(fieldMap[logoType], key);
    await kit.save();
    await createBrandCache(env.OBCF_KV).invalidate(organizationId, null);

    await logBrandAudit('brand.kit.logo.upload', request, { organizationId, kitId: id, logoType });
    return jsonResponse({ key, url: assets.getPublicUrl(key) }, 200);
}
