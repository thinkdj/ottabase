// ---------------------------------------------------------------------------
// Brand Engine – Brand Kit API handlers (v2: per-app scoping)
// GET/POST /api/brand/kits, GET/PUT/DELETE /api/brand/kits/:id
// POST /api/brand/kits/:id/clone, POST /api/brand/kits/:id/logo
// All scoped by appId, not organizationId.
// ---------------------------------------------------------------------------

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { createBrandAssets, type LogoType } from '../persistence/assets';
import { BrandKit } from '../persistence/BrandKit.model';
import type { BrandKitItem } from '../persistence/types';
import { PRESET_MAP } from '../presets';
import { logBrandAudit } from './audit-helper';
import type { BrandApiEnv } from './brand-api';
import { warmBrandCache } from './warm-cache';

/**
 * Expand a preset to full theme tokens and merge with custom overrides.
 * This creates a self-contained tokensJson that doesn't need runtime resolution.
 */
function expandPresetToTokens(presetId: string | null, existingTokensJson: string | null | undefined): string {
    // Parse existing tokens
    let existing: Record<string, unknown> = {};
    try {
        if (existingTokensJson) {
            existing = JSON.parse(existingTokensJson) as Record<string, unknown>;
        }
    } catch {
        existing = {};
    }

    // If no preset selected, return existing tokens as-is
    if (!presetId || !PRESET_MAP[presetId]) {
        return JSON.stringify(existing);
    }

    const preset = PRESET_MAP[presetId];

    // Cursors: user overrides take precedence; fall back to preset cursors (e.g. artisan/funky have registry cursors)
    const effectiveCursors = existing.cursors ?? (preset as { cursors?: Record<string, string> }).cursors;

    // Build full tokens with preset colors as base
    const expanded: Record<string, unknown> = {
        // Preset colors (light + dark)
        color: {
            light: preset.colors.light,
            dark: preset.colors.dark,
        },
        // Keep existing typography, spacing, etc. or use preset defaults
        typography: existing.typography || preset.typography,
        spacing: existing.spacing || preset.spacing,
        radius: existing.radius || preset.radius,
        shadow: existing.shadow || preset.shadows,
        motion: existing.motion || preset.motion,
        // Cursors: user-configured or preset default (artisan/funky have registry cursors)
        ...(effectiveCursors !== undefined && { cursors: effectiveCursors }),
    };

    // Merge custom color overrides on top of preset
    if (existing.color && typeof existing.color === 'object') {
        const customColor = existing.color as Record<string, unknown>;
        const expandedColor = expanded.color as Record<string, unknown>;

        // Deep merge custom colors over preset colors
        if (customColor.light && typeof customColor.light === 'object') {
            expandedColor.light = {
                ...(expandedColor.light as Record<string, string>),
                ...(customColor.light as Record<string, string>),
            };
        }
        if (customColor.dark && typeof customColor.dark === 'object') {
            expandedColor.dark = {
                ...(expandedColor.dark as Record<string, string>),
                ...(customColor.dark as Record<string, string>),
            };
        }
    }

    return JSON.stringify(expanded, null, 2);
}

function serializeKit(kit: BrandKit): BrandKitItem {
    return {
        id: kit.get('id') as string,
        appId: (kit.get('appId') as string | null) ?? null,
        isDefault: (kit.get('isDefault') as boolean) ?? false,
        parentBrandKitId: (kit.get('parentBrandKitId') as string | null) ?? null,
        createdBy: (kit.get('createdBy') as string | null) ?? null,
        updatedBy: (kit.get('updatedBy') as string | null) ?? null,
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

/** GET /api/brand/kits - List Brand Kits for app */
export async function handleGetBrandKits(
    _request: Request,
    _env: BrandApiEnv,
    appId: string | null,
): Promise<Response> {
    // Bootstrap: System default kit auto-created by resolution pipeline when needed
    if (appId === null) {
        await BrandKit.getOrCreateDefault();
    }
    const appKits = (await BrandKit.where({ appId: appId ?? null }, { orderBy: 'name' })) as BrandKit[];
    // Include system default (appId=null) so it appears in the list — it's the fallback used by all apps
    let kits = appKits;
    if (appId !== null) {
        const systemDefault = (await BrandKit.first({ appId: null })) as BrandKit | null;
        if (systemDefault && !appKits.some((k) => k.get('id') === systemDefault.get('id'))) {
            kits = [systemDefault, ...appKits];
            kits.sort((a, b) => ((a.get('name') as string) || '').localeCompare((b.get('name') as string) || ''));
        }
    }
    const data = kits.map(serializeKit);
    // Resolve parent kit names for display
    const kitNameMap = new Map(data.map((k) => [k.id, k.name]));
    for (const item of data) {
        if (item.parentBrandKitId) {
            item.parentBrandKitName = kitNameMap.get(item.parentBrandKitId) ?? null;
        }
    }
    return jsonResponse(data, 200);
}

/** GET /api/brand/kits/:id - Get one Brand Kit */
export async function handleGetBrandKit(
    _request: Request,
    _env: BrandApiEnv,
    id: string,
    appId: string | null,
): Promise<Response> {
    const kit = (await BrandKit.find(id)) as BrandKit | null;
    if (!kit) return errorResponse('Brand Kit not found', 404);
    const kApp = kit.get('appId') as string | null;
    // System kits (appId=null) are viewable by anyone; app-scoped kits require app match
    if (kApp !== null && appId !== kApp) return errorResponse('Brand Kit not found', 404);
    return jsonResponse(serializeKit(kit), 200);
}

/** POST /api/brand/kits - Create Brand Kit */
export async function handleCreateBrandKit(
    request: Request,
    env: BrandApiEnv,
    appId: string | null,
    auditUser?: BrandAuditUser,
): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;
    const name = body.name as string;
    if (!name || typeof name !== 'string') return errorResponse('name is required', 400);

    const existing = (await BrandKit.where({ appId })) as BrandKit[];
    const isDefault = existing.length === 0;

    // Expand preset to full tokens if themePresetId is provided
    const tokensJsonInput =
        typeof body.tokensJson === 'string'
            ? body.tokensJson
            : body.tokensJson
              ? JSON.stringify(body.tokensJson)
              : null;
    const presetId = (body.themePresetId as string) ?? null;
    const expandedTokens = expandPresetToTokens(presetId, tokensJsonInput);

    const kit = (await BrandKit.create({
        appId,
        isDefault,
        parentBrandKitId: (body.parentBrandKitId as string) ?? null,
        createdBy: auditUser?.userId ?? auditUser?.userEmail ?? null,
        updatedBy: auditUser?.userId ?? auditUser?.userEmail ?? null,
        name,
        slug: (body.slug as string) ?? null,
        brandName: (body.brandName as string) ?? 'My App',
        tagline: (body.tagline as string) ?? null,
        themePresetId: presetId,
        tokensJson: expandedTokens,
        defaultColorScheme: (body.defaultColorScheme as string) ?? 'system',
        allowDarkModeToggle: (body.allowDarkModeToggle as boolean) ?? true,
        customCss: (body.customCss as string) ?? null,
        hideOttabaseBranding: (body.hideOttabaseBranding as boolean) ?? false,
    })) as BrandKit;

    await warmBrandCache(env, { appId });
    return jsonResponse(serializeKit(kit), 201);
}

/** User context for audit logging (logged-in user's id/email) */
export interface BrandAuditUser {
    userId?: string;
    userEmail?: string;
}

/** PUT /api/brand/kits/:id - Update Brand Kit */
export async function handleUpdateBrandKit(
    request: Request,
    env: BrandApiEnv,
    id: string,
    appId: string | null,
    auditUser?: BrandAuditUser,
): Promise<Response> {
    const kit = (await BrandKit.find(id)) as BrandKit | null;
    if (!kit)
        return errorResponse('Brand Kit not found', 404, {
            details: `Requested ID: ${id}`,
            hint: 'If you restarted the dev server, refresh the Brand Kits list and try editing again.',
        });
    const kApp = kit.get('appId') as string | null;
    // System kits (appId=null) are editable by system-scoped users; app-scoped kits require app match
    if (kApp !== null && appId !== kApp) return errorResponse('Brand Kit not found', 404);

    const body = (await request.json()) as Record<string, unknown>;
    // Handle parentBrandKitId – allow setting to null (detach) or to a valid ID
    if (body.parentBrandKitId !== undefined) {
        const parentId = (body.parentBrandKitId as string) || null;
        if (parentId) {
            const parent = (await BrandKit.find(parentId)) as BrandKit | null;
            if (!parent) return errorResponse('Parent Brand Kit not found', 400);
        }
        kit.set('parentBrandKitId', parentId);
    }
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
        // System default (appId=null): name is locked and cannot be edited
        if (f === 'name' && kApp === null) continue;
        if (body[f] !== undefined) kit.set(f, body[f]);
    }

    // Handle tokensJson with preset expansion
    if (body.tokensJson !== undefined || body.themePresetId !== undefined) {
        const tokensJsonInput =
            typeof body.tokensJson === 'string'
                ? body.tokensJson
                : body.tokensJson
                  ? JSON.stringify(body.tokensJson)
                  : (kit.get('tokensJson') as string | null);
        const presetId = (body.themePresetId as string | null) ?? (kit.get('themePresetId') as string | null);

        // Expand preset and merge with custom overrides
        const expandedTokens = expandPresetToTokens(presetId, tokensJsonInput);
        kit.set('tokensJson', expandedTokens);
    }

    kit.set('updatedBy', auditUser?.userId ?? auditUser?.userEmail ?? null);

    await kit.save();
    await warmBrandCache(env, { kitId: id, appId: kApp, requestAppId: appId });

    await logBrandAudit('brand.kit.update', request, { appId, kitId: id }, auditUser?.userId, auditUser?.userEmail);
    return jsonResponse(serializeKit(kit), 200);
}

/** DELETE /api/brand/kits/:id */
export async function handleDeleteBrandKit(
    _request: Request,
    env: BrandApiEnv,
    id: string,
    appId: string | null,
): Promise<Response> {
    const kit = (await BrandKit.find(id)) as BrandKit | null;
    if (!kit) return errorResponse('Brand Kit not found', 404);
    const kApp = kit.get('appId') as string | null;
    if (kApp !== null && appId !== kApp) return errorResponse('Brand Kit not found', 404);

    if ((kit.get('isDefault') as boolean) === true) {
        return errorResponse('Cannot delete the default Brand Kit', 400, { code: 'DEFAULT_KIT' });
    }

    // System default (appId=null) cannot be deleted
    if (kApp === null) return errorResponse('Cannot delete the default Brand Kit', 400, { code: 'DEFAULT_KIT' });

    // Check for kits that inherit from this one
    const children = (await BrandKit.where({ parentBrandKitId: id })) as BrandKit[];
    if (children.length > 0) {
        const childNames = children.map((c) => c.get('name') as string);
        return errorResponse(
            `Cannot delete: ${children.length} kit(s) inherit from this kit (${childNames.join(', ')})`,
            400,
            { code: 'HAS_CHILDREN', details: childNames.join(', ') },
        );
    }

    await kit.destroy();
    await warmBrandCache(env, { appId });
    return jsonResponse({ success: true }, 200);
}

/** POST /api/brand/kits/:id/clone - Clone Brand Kit */
export async function handleCloneBrandKit(
    request: Request,
    env: BrandApiEnv,
    id: string,
    appId: string | null,
    auditUser?: BrandAuditUser,
): Promise<Response> {
    const source = (await BrandKit.find(id)) as BrandKit | null;
    if (!source) return errorResponse('Brand Kit not found', 404);
    const sApp = source.get('appId') as string | null;
    if (sApp !== null && appId !== sApp) return errorResponse('Brand Kit not found', 404);

    const body = (await request.json()) as { name?: string; inheritFromSource?: boolean } | undefined;
    const newName = body?.name ?? `${source.get('name')} (Copy)`;

    const copy = (await BrandKit.create({
        appId,
        isDefault: false,
        parentBrandKitId: source.get('parentBrandKitId'),
        createdBy: auditUser?.userId ?? auditUser?.userEmail ?? null,
        updatedBy: auditUser?.userId ?? auditUser?.userEmail ?? null,
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

    await warmBrandCache(env, { appId });
    return jsonResponse(serializeKit(copy), 201);
}

/** POST /api/brand/kits/:id/logo - Upload logo for Brand Kit */
export async function handleUploadBrandKitLogo(
    request: Request,
    env: BrandApiEnv,
    id: string,
    appId: string | null,
    logoType: LogoType,
    auditUser?: BrandAuditUser,
): Promise<Response> {
    const kit = (await BrandKit.find(id)) as BrandKit | null;
    if (!kit) return errorResponse('Brand Kit not found', 404);
    const kApp = kit.get('appId') as string | null;
    if (kApp !== null && appId !== kApp) return errorResponse('Brand Kit not found', 404);

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
    kit.set('updatedBy', auditUser?.userId ?? auditUser?.userEmail ?? null);
    await kit.save();
    await warmBrandCache(env, { kitId: id, appId: kApp, requestAppId: appId });

    await logBrandAudit(
        'brand.kit.logo.upload',
        request,
        { appId, kitId: id, logoType },
        auditUser?.userId,
        auditUser?.userEmail,
    );
    return jsonResponse({ key, url: assets.getPublicUrl(key) }, 200);
}
