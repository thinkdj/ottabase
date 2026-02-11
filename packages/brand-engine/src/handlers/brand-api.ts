// ---------------------------------------------------------------------------
// Brand Engine – API handlers for brand CRUD
// GET /api/brand, PUT /api/brand, POST /api/brand/logo
// RBAC: Route must enforce brand:edit or brand:* for PUT/POST
// ---------------------------------------------------------------------------

import { resolveBrandConfig } from '../persistence/resolveBrandConfig';
import { BrandSettings } from '../persistence/BrandSettings.model';
import { createBrandCache } from '../persistence/cache';
import { createBrandAssets, type LogoType } from '../persistence/assets';
import { logBrandAudit } from './audit-helper';
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { jsonResponse } from '@ottabase/utils/http-response';
import { errorResponse } from '@ottabase/utils/http-errors';

export interface BrandApiEnv {
    OBCF_D1: D1Database;
    OBCF_KV: KVNamespace;
    OBCF_R2: R2Bucket;
    R2_PUBLIC_URL?: string;
}

/**
 * GET /api/brand - Get resolved brand config
 * Resolution order: 1) brandPreview=box-id, 2) Active BrandBox, 3) BrandSettings
 * Query: ?organizationId=&appId=, ?brandPreview=box-id, ?themeVariant=id|active
 */
export async function handleGetBrand(
    request: Request,
    env: BrandApiEnv,
    organizationId?: string | null,
    appId?: string | null,
    userId?: string | null,
): Promise<Response> {
    const url = new URL(request.url);
    const config = await resolveBrandConfig(env, {
        organizationId: organizationId ?? url.searchParams.get('organizationId') ?? null,
        appId: appId ?? url.searchParams.get('appId') ?? null,
        brandPreview: url.searchParams.get('brandPreview') ?? undefined,
        themeVariant: url.searchParams.get('themeVariant') ?? undefined,
        userId,
    });
    if (!config) return errorResponse('Brand config not found', 404);
    return jsonResponse(config, 200);
}

/**
 * GET /api/brand/settings - Get raw settings for admin editing (tokensJson, layoutJson, etc.)
 */
export async function handleGetBrandSettings(
    _request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const settings = await BrandSettings.resolve(organizationId, appId);
    if (!settings) return errorResponse('Brand settings not found', 404);
    const raw = {
        brandName: settings.get('brandName'),
        tagline: settings.get('tagline'),
        tokensJson: settings.get('tokensJson') ?? '{}',
        layoutJson: settings.get('layoutJson') ?? '{}',
        defaultColorScheme: settings.get('defaultColorScheme') ?? 'system',
        allowDarkModeToggle: settings.get('allowDarkModeToggle') ?? true,
        customCss: settings.get('customCss') ?? '',
        hideOttabaseBranding: settings.get('hideOttabaseBranding') ?? false,
    };
    return jsonResponse(raw, 200);
}

/** Validate JSON - throws if invalid */
function validateJsonField(val: unknown, fieldName: string): void {
    if (val === undefined || val === null) return;
    if (typeof val === 'string') {
        try {
            JSON.parse(val);
        } catch {
            throw new Error(`Invalid JSON for ${fieldName}`);
        }
        return;
    }
    if (typeof val !== 'object') throw new Error(`Invalid type for ${fieldName}`);
}

/**
 * PUT /api/brand - Update brand settings
 * RBAC: Route must require brand:edit or brand:*
 */
export async function handleUpdateBrand(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;

    try {
        if (body.tokensJson !== undefined) validateJsonField(body.tokensJson, 'tokensJson');
        if (body.layoutJson !== undefined) validateJsonField(body.layoutJson, 'layoutJson');
    } catch (e) {
        return errorResponse((e as Error).message, 400);
    }

    const cache = createBrandCache(env.OBCF_KV);
    let settings = await BrandSettings.resolve(organizationId, appId);
    if (!settings) {
        settings = await BrandSettings.getOrCreateDefault();
    }
    // If we got default (null, null) but caller wants org/app specific, create new record
    const resolvedOrg = settings.get('organizationId');
    const resolvedApp = settings.get('appId');
    if (resolvedOrg !== organizationId || resolvedApp !== (appId || null)) {
        settings = await BrandSettings.create({
            organizationId,
            appId: appId || null,
            brandName: (body.brandName as string) || settings.get('brandName') || 'My App',
            tagline: (body.tagline as string) ?? settings.get('tagline'),
            tokensJson: (body.tokensJson as string) ?? settings.get('tokensJson'),
            layoutJson: (body.layoutJson as string) ?? settings.get('layoutJson'),
            defaultColorScheme: (body.defaultColorScheme as string) ?? settings.get('defaultColorScheme'),
            allowDarkModeToggle: (body.allowDarkModeToggle as boolean) ?? settings.get('allowDarkModeToggle'),
            customCss: (body.customCss as string) ?? settings.get('customCss'),
            hideOttabaseBranding: (body.hideOttabaseBranding as boolean) ?? settings.get('hideOttabaseBranding'),
        });
    }

    const updateableFields = [
        'brandName',
        'tagline',
        'tokensJson',
        'layoutJson',
        'defaultColorScheme',
        'allowDarkModeToggle',
        'customCss',
        'hideOttabaseBranding',
    ] as const;

    for (const field of updateableFields) {
        if (body[field] !== undefined) {
            settings.set(field, body[field]);
        }
    }

    await settings.save();
    await cache.invalidate(organizationId, appId);

    await logBrandAudit('brand.update', request, { organizationId, appId, fields: Object.keys(body) });

    return jsonResponse({ success: true }, 200);
}

/**
 * POST /api/brand/logo - Upload logo to R2, update settings
 * RBAC: Route must require brand:edit or brand:*
 * Body: multipart/form-data with 'file' field
 */
export async function handleUploadLogo(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId: string | null | undefined,
    logoType: LogoType,
): Promise<Response> {
    const assets = createBrandAssets(env.OBCF_R2, env.R2_PUBLIC_URL || '');
    const cache = createBrandCache(env.OBCF_KV);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
        return errorResponse('No file provided', 400);
    }

    const buffer = await file.arrayBuffer();
    const key = await assets.uploadLogo(buffer, file.name, logoType);

    const settings = await BrandSettings.resolve(organizationId, appId);
    if (settings) {
        const fieldMap: Record<LogoType, string> = {
            logo: 'logoKey',
            'logo-dark': 'logoDarkKey',
            icon: 'iconKey',
            'og-image': 'ogImageKey',
            'email-logo': 'emailLogoKey',
        };
        settings.set(fieldMap[logoType], key);
        await settings.save();
        await cache.invalidate(organizationId, appId);
    }

    await logBrandAudit('brand.logo.upload', request, { organizationId, appId, logoType, key });

    return jsonResponse(
        {
            key,
            url: assets.getPublicUrl(key),
        },
        200,
    );
}

// ---------------------------------------------------------------------------
// Preset handlers (BrandSettings with name != null)
// ---------------------------------------------------------------------------

function parseJsonField(val: unknown, fieldName: string): unknown {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch {
            throw new Error(`Invalid JSON for ${fieldName}`);
        }
    }
    if (typeof val === 'object') return val;
    throw new Error(`Invalid type for ${fieldName}`);
}

function serializePreset(s: BrandSettings): Record<string, unknown> {
    return {
        id: s.get('id'),
        name: s.get('name'),
        slug: s.get('slug'),
        isActive: s.get('isActive'),
        brandName: s.get('brandName'),
        tagline: s.get('tagline'),
        tokensJson: s.get('tokensJson'),
        themeVariantId: s.get('themeVariantId'),
        routeMappingsJson: s.get('routeMappingsJson'),
        layoutTemplatesSnapshotJson: s.get('layoutTemplatesSnapshotJson'),
        customCss: s.get('customCss'),
        hideOttabaseBranding: s.get('hideOttabaseBranding'),
        createdAt: s.get('createdAt'),
        updatedAt: s.get('updatedAt'),
    };
}

export async function handleGetBrandPresets(
    _request: Request,
    _env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const presets = (await BrandSettings.where(
        { organizationId: organizationId ?? null, appId: appId ?? null },
        { orderBy: 'name' },
    )) as BrandSettings[];
    const data = presets.filter((p) => p.get('name')).map(serializePreset);
    return jsonResponse(data, 200);
}

export async function handleCreateBrandPreset(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;
    const name = body.name as string;
    if (!name || typeof name !== 'string') return errorResponse('name is required', 400);

    const cache = createBrandCache(env.OBCF_KV);

    if (body.snapshotFromCurrent === true) {
        const active = await BrandSettings.findActive(organizationId, appId);
        const source = active ?? (await BrandSettings.resolve(organizationId, appId));
        if (source) {
            const { getLayoutData } = await import('../persistence/layoutData');
            const layoutData = await getLayoutData(organizationId, appId);
            const preset = (await BrandSettings.create({
                organizationId,
                appId: appId || null,
                name,
                slug: null,
                isActive: false,
                brandName: source.get('brandName'),
                tagline: source.get('tagline'),
                logoKey: source.get('logoKey'),
                logoDarkKey: source.get('logoDarkKey'),
                iconKey: source.get('iconKey'),
                ogImageKey: source.get('ogImageKey'),
                emailLogoKey: source.get('emailLogoKey'),
                tokensJson: source.get('tokensJson'),
                themeVariantId: source.get('themeVariantId'),
                routeMappingsJson: JSON.stringify(layoutData.routeMappings),
                layoutTemplatesSnapshotJson: JSON.stringify(layoutData.layoutTemplatesMap),
                customCss: source.get('customCss'),
                hideOttabaseBranding: source.get('hideOttabaseBranding'),
            })) as BrandSettings;
            await cache.invalidate(organizationId, appId);
            return jsonResponse({ ...serializePreset(preset) }, 201);
        }
    }

    try {
        if (body.tokensJson !== undefined) parseJsonField(body.tokensJson, 'tokensJson');
        if (body.routeMappingsJson !== undefined) parseJsonField(body.routeMappingsJson, 'routeMappingsJson');
        if (body.layoutTemplatesSnapshotJson !== undefined)
            parseJsonField(body.layoutTemplatesSnapshotJson, 'layoutTemplatesSnapshotJson');
    } catch (e) {
        return errorResponse((e as Error).message, 400);
    }

    const toJson = (v: unknown): string | null =>
        v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v);

    const preset = (await BrandSettings.create({
        organizationId,
        appId: appId || null,
        name,
        slug: (body.slug as string) ?? null,
        isActive: false,
        brandName: (body.brandName as string) ?? 'My App',
        tagline: (body.tagline as string) ?? null,
        tokensJson: toJson(body.tokensJson),
        themeVariantId: (body.themeVariantId as string) ?? null,
        routeMappingsJson: toJson(body.routeMappingsJson),
        layoutTemplatesSnapshotJson: toJson(body.layoutTemplatesSnapshotJson),
        customCss: (body.customCss as string) ?? null,
        hideOttabaseBranding: (body.hideOttabaseBranding as boolean) ?? false,
    })) as BrandSettings;
    await cache.invalidate(organizationId, appId);
    return jsonResponse({ ...serializePreset(preset) }, 201);
}

export async function handleUpdateBrandPreset(
    request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const preset = (await BrandSettings.find(id)) as BrandSettings | null;
    if (!preset || !preset.get('name')) return errorResponse('Preset not found', 404);

    const pOrg = preset.get('organizationId') as string | null;
    const pApp = preset.get('appId') as string | null;
    if (pOrg !== organizationId || pApp !== (appId ?? null)) return errorResponse('Preset not found', 404);

    const body = (await request.json()) as Record<string, unknown>;
    try {
        if (body.tokensJson !== undefined) parseJsonField(body.tokensJson, 'tokensJson');
        if (body.routeMappingsJson !== undefined) parseJsonField(body.routeMappingsJson, 'routeMappingsJson');
        if (body.layoutTemplatesSnapshotJson !== undefined)
            parseJsonField(body.layoutTemplatesSnapshotJson, 'layoutTemplatesSnapshotJson');
    } catch (e) {
        return errorResponse((e as Error).message, 400);
    }

    const toJson = (v: unknown): string | null =>
        v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v);

    const fields = [
        'name',
        'slug',
        'brandName',
        'tagline',
        'themeVariantId',
        'customCss',
        'hideOttabaseBranding',
    ] as const;
    const jsonFields = ['tokensJson', 'routeMappingsJson', 'layoutTemplatesSnapshotJson'] as const;

    for (const field of fields) {
        if (body[field] !== undefined) preset.set(field, body[field]);
    }
    for (const field of jsonFields) {
        if (body[field] !== undefined) preset.set(field, toJson(body[field]));
    }

    await preset.save();
    await createBrandCache(env.OBCF_KV).invalidate(organizationId, appId, id);
    return jsonResponse({ ...serializePreset(preset) }, 200);
}

export async function handleDeleteBrandPreset(
    _request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const preset = (await BrandSettings.find(id)) as BrandSettings | null;
    if (!preset || !preset.get('name')) return errorResponse('Preset not found', 404);

    const pOrg = preset.get('organizationId') as string | null;
    const pApp = preset.get('appId') as string | null;
    if (pOrg !== organizationId || pApp !== (appId ?? null)) return errorResponse('Preset not found', 404);

    await preset.destroy();
    await createBrandCache(env.OBCF_KV).invalidate(organizationId, appId, id);
    return jsonResponse({ success: true }, 200);
}

export async function handleApplyBrandPreset(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = (await request.json()) as { presetId?: string };
    const presetId = body?.presetId;
    if (!presetId) return errorResponse('presetId is required', 400);

    const preset = (await BrandSettings.find(presetId)) as BrandSettings | null;
    if (!preset || !preset.get('name')) return errorResponse('Preset not found', 404);

    const pOrg = preset.get('organizationId') as string | null;
    const pApp = preset.get('appId') as string | null;
    if (pOrg !== organizationId || pApp !== (appId ?? null)) return errorResponse('Preset not found', 404);

    await preset.snapshot();
    await preset.activate();
    await createBrandCache(env.OBCF_KV).invalidate(organizationId, appId);

    await logBrandAudit('brand.apply', request, { organizationId, appId, presetId });
    return jsonResponse({ success: true, presetId }, 200);
}

export async function handleDuplicateBrandPreset(
    request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const source = (await BrandSettings.find(id)) as BrandSettings | null;
    if (!source || !source.get('name')) return errorResponse('Preset not found', 404);

    const sOrg = source.get('organizationId') as string | null;
    const sApp = source.get('appId') as string | null;
    if (sOrg !== organizationId || sApp !== (appId ?? null)) return errorResponse('Preset not found', 404);

    const body = (await request.json()) as { name?: string } | undefined;
    const newName = body?.name ?? `${source.get('name')} (Copy)`;

    const preset = (await BrandSettings.create({
        organizationId,
        appId: appId || null,
        name: newName,
        slug: null,
        isActive: false,
        brandName: source.get('brandName'),
        tagline: source.get('tagline'),
        logoKey: source.get('logoKey'),
        logoDarkKey: source.get('logoDarkKey'),
        iconKey: source.get('iconKey'),
        ogImageKey: source.get('ogImageKey'),
        emailLogoKey: source.get('emailLogoKey'),
        tokensJson: source.get('tokensJson'),
        themeVariantId: source.get('themeVariantId'),
        routeMappingsJson: source.get('routeMappingsJson'),
        layoutTemplatesSnapshotJson: source.get('layoutTemplatesSnapshotJson'),
        customCss: source.get('customCss'),
        hideOttabaseBranding: source.get('hideOttabaseBranding'),
    })) as BrandSettings;

    await createBrandCache(env.OBCF_KV).invalidate(organizationId, appId);
    return jsonResponse({ ...serializePreset(preset) }, 201);
}

// Re-export layout handlers
export { handleGetLayouts, handlePutLayout, handleGetMappings, handlePutMappings } from './layout-api';

// Re-export theme variant handlers
export {
    handleGetThemeVariants,
    handleCreateThemeVariant,
    handleUpdateThemeVariant,
    handleDeleteThemeVariant,
} from './theme-variant-api';
