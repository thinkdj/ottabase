// ---------------------------------------------------------------------------
// Brand Engine – API handlers for brand CRUD
// GET /api/brand, PUT /api/brand, POST /api/brand/logo
// RBAC: Route must enforce brand:edit or brand:* for PUT/POST
// ---------------------------------------------------------------------------

import { resolveBrandConfig } from '../persistence/resolveBrandConfig';
import { BrandSettings } from '../persistence/BrandSettings.model';
import { createBrandCache } from '../persistence/cache';
import { createBrandAssets, type LogoType } from '../persistence/assets';
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

    return jsonResponse(
        {
            key,
            url: assets.getPublicUrl(key),
        },
        200,
    );
}

// Re-export theme variant handlers for single entry point
export {
    handleGetThemeVariants,
    handleCreateThemeVariant,
    handleUpdateThemeVariant,
    handleDeleteThemeVariant,
} from './theme-variant-api';

// Re-export BrandBox handlers for single entry point
export {
    handleGetBrandBoxes,
    handleCreateBrandBox,
    handleUpdateBrandBox,
    handleDeleteBrandBox,
    handleApplyBrandBox,
    handleDuplicateBrandBox,
} from './brandbox-api';
