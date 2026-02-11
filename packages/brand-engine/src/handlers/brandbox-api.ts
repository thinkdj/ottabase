// ---------------------------------------------------------------------------
// Brand Engine – BrandBox API handlers
// GET/POST /api/brandbox, PUT/DELETE /api/brandbox/:id, POST /api/brand/apply, POST /api/brandbox/:id/duplicate
// RBAC: brand:edit for CRUD, brand:apply for apply
// ---------------------------------------------------------------------------

import { BrandBox } from '../persistence/BrandBox.model';
import { BrandSettings } from '../persistence/BrandSettings.model';
import { createBrandCache } from '../persistence/cache';
import { getLayoutData } from '../persistence/layoutData';
import { logBrandAudit } from './audit-helper';
import type { BrandApiEnv } from './brand-api';
import { jsonResponse } from '@ottabase/utils/http-response';
import { errorResponse } from '@ottabase/utils/http-errors';

/** Validate JSON field - returns parsed object or null if invalid */
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

/**
 * GET /api/brandbox - List BrandBoxes for org/app
 */
export async function handleGetBrandBoxes(
    _request: Request,
    _env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const boxes = (await BrandBox.where(
        { organizationId: organizationId ?? null, appId: appId ?? null },
        { orderBy: 'name' },
    )) as BrandBox[];

    const data = boxes.map((b) => ({
        id: b.get('id'),
        name: b.get('name'),
        slug: b.get('slug'),
        isActive: b.get('isActive'),
        identityJson: b.get('identityJson'),
        logosJson: b.get('logosJson'),
        tokensJson: b.get('tokensJson'),
        themeVariantId: b.get('themeVariantId'),
        routeMappingsJson: b.get('routeMappingsJson'),
        customCss: b.get('customCss'),
        hideOttabaseBranding: b.get('hideOttabaseBranding'),
        activeFrom: b.get('activeFrom'),
        activeUntil: b.get('activeUntil'),
        createdAt: b.get('createdAt'),
        updatedAt: b.get('updatedAt'),
    }));

    return jsonResponse(data, 200);
}

/**
 * POST /api/brandbox - Create BrandBox
 * When snapshotFromCurrent=true, snapshots current brand (active BrandBox or BrandSettings) into a new box.
 */
export async function handleCreateBrandBox(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;

    const name = body.name as string;
    if (!name || typeof name !== 'string') {
        return errorResponse('name is required', 400);
    }

    const cache = createBrandCache(env.OBCF_KV);

    if (body.snapshotFromCurrent === true) {
        const activeBox = await BrandBox.findActive(organizationId, appId);
        if (activeBox) {
            const box = (await BrandBox.create({
                organizationId,
                appId: appId || null,
                name,
                slug: null,
                isActive: false,
                identityJson: activeBox.get('identityJson'),
                logosJson: activeBox.get('logosJson'),
                tokensJson: activeBox.get('tokensJson'),
                themeVariantId: activeBox.get('themeVariantId'),
                routeMappingsJson: activeBox.get('routeMappingsJson'),
                layoutOverridesJson: activeBox.get('layoutOverridesJson'),
                layoutTemplatesSnapshotJson: activeBox.get('layoutTemplatesSnapshotJson'),
                customCss: activeBox.get('customCss'),
                customMetaJson: activeBox.get('customMetaJson'),
                hideOttabaseBranding: activeBox.get('hideOttabaseBranding'),
                activeFrom: activeBox.get('activeFrom'),
                activeUntil: activeBox.get('activeUntil'),
            })) as BrandBox;
            await cache.invalidate(organizationId, appId);
            return jsonResponse({ id: box.get('id'), ...serializeBox(box) }, 201);
        }

        const settings = await BrandSettings.resolve(organizationId, appId);
        if (settings) {
            const layoutData = await getLayoutData(organizationId, appId);
            const identityJson = JSON.stringify({
                brandName: settings.get('brandName') || 'My App',
                tagline: settings.get('tagline'),
            });
            const logosJson = JSON.stringify({
                logoKey: settings.get('logoKey'),
                logoDarkKey: settings.get('logoDarkKey'),
                iconKey: settings.get('iconKey'),
                ogImageKey: settings.get('ogImageKey'),
                emailLogoKey: settings.get('emailLogoKey'),
            });
            const routeMappingsJson = JSON.stringify(layoutData.routeMappings);
            const layoutTemplatesSnapshotJson = JSON.stringify(layoutData.layoutTemplatesMap);

            const box = (await BrandBox.create({
                organizationId,
                appId: appId || null,
                name,
                slug: null,
                isActive: false,
                identityJson,
                logosJson,
                tokensJson: settings.get('tokensJson'),
                themeVariantId: null,
                routeMappingsJson,
                layoutOverridesJson: settings.get('layoutJson'),
                layoutTemplatesSnapshotJson,
                customCss: settings.get('customCss'),
                customMetaJson: null,
                hideOttabaseBranding: (settings.get('hideOttabaseBranding') as boolean) ?? false,
                activeFrom: null,
                activeUntil: null,
            })) as BrandBox;
            await cache.invalidate(organizationId, appId);
            return jsonResponse({ id: box.get('id'), ...serializeBox(box) }, 201);
        }
    }

    // Validate JSON fields for manual create
    try {
        if (body.identityJson !== undefined) parseJsonField(body.identityJson, 'identityJson');
        if (body.logosJson !== undefined) parseJsonField(body.logosJson, 'logosJson');
        if (body.tokensJson !== undefined) parseJsonField(body.tokensJson, 'tokensJson');
        if (body.routeMappingsJson !== undefined) parseJsonField(body.routeMappingsJson, 'routeMappingsJson');
        if (body.layoutOverridesJson !== undefined) parseJsonField(body.layoutOverridesJson, 'layoutOverridesJson');
        if (body.customMetaJson !== undefined) parseJsonField(body.customMetaJson, 'customMetaJson');
    } catch (e) {
        return errorResponse((e as Error).message, 400);
    }

    const toJson = (v: unknown): string | null =>
        v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v);

    const box = (await BrandBox.create({
        organizationId,
        appId: appId || null,
        name,
        slug: (body.slug as string) ?? null,
        isActive: false,
        identityJson: toJson(body.identityJson),
        logosJson: toJson(body.logosJson),
        tokensJson: toJson(body.tokensJson),
        themeVariantId: (body.themeVariantId as string) ?? null,
        routeMappingsJson: toJson(body.routeMappingsJson),
        layoutOverridesJson: toJson(body.layoutOverridesJson),
        customCss: (body.customCss as string) ?? null,
        customMetaJson: toJson(body.customMetaJson),
        hideOttabaseBranding: (body.hideOttabaseBranding as boolean) ?? false,
        activeFrom: (body.activeFrom as number) ?? null,
        activeUntil: (body.activeUntil as number) ?? null,
    })) as BrandBox;

    await cache.invalidate(organizationId, appId);

    return jsonResponse({ id: box.get('id'), ...serializeBox(box) }, 201);
}

/**
 * PUT /api/brandbox/:id - Update BrandBox
 */
export async function handleUpdateBrandBox(
    request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const box = (await BrandBox.find(id)) as BrandBox | null;
    if (!box) return errorResponse('BrandBox not found', 404);

    const bOrg = box.get('organizationId') as string | null;
    const bApp = box.get('appId') as string | null;
    if (bOrg !== organizationId || bApp !== (appId ?? null)) {
        return errorResponse('BrandBox not found', 404);
    }

    const body = (await request.json()) as Record<string, unknown>;

    try {
        if (body.identityJson !== undefined) parseJsonField(body.identityJson, 'identityJson');
        if (body.logosJson !== undefined) parseJsonField(body.logosJson, 'logosJson');
        if (body.tokensJson !== undefined) parseJsonField(body.tokensJson, 'tokensJson');
        if (body.routeMappingsJson !== undefined) parseJsonField(body.routeMappingsJson, 'routeMappingsJson');
        if (body.layoutOverridesJson !== undefined) parseJsonField(body.layoutOverridesJson, 'layoutOverridesJson');
        if (body.customMetaJson !== undefined) parseJsonField(body.customMetaJson, 'customMetaJson');
    } catch (e) {
        return errorResponse((e as Error).message, 400);
    }

    const toJson = (v: unknown): string | null =>
        v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v);

    const cache = createBrandCache(env.OBCF_KV);
    const jsonFields = [
        'identityJson',
        'logosJson',
        'tokensJson',
        'routeMappingsJson',
        'layoutOverridesJson',
        'layoutTemplatesSnapshotJson',
        'customMetaJson',
    ] as const;
    const scalarFields = [
        'name',
        'slug',
        'themeVariantId',
        'customCss',
        'hideOttabaseBranding',
        'activeFrom',
        'activeUntil',
    ] as const;

    for (const field of jsonFields) {
        if (body[field] !== undefined) box.set(field, toJson(body[field]));
    }
    for (const field of scalarFields) {
        if (body[field] !== undefined) box.set(field, body[field]);
    }

    await box.save();
    await cache.invalidate(organizationId, appId, id);

    return jsonResponse({ id: box.get('id'), ...serializeBox(box) }, 200);
}

/**
 * DELETE /api/brandbox/:id - Delete BrandBox
 */
export async function handleDeleteBrandBox(
    _request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const box = (await BrandBox.find(id)) as BrandBox | null;
    if (!box) return errorResponse('BrandBox not found', 404);

    const bOrg = box.get('organizationId') as string | null;
    const bApp = box.get('appId') as string | null;
    if (bOrg !== organizationId || bApp !== (appId ?? null)) {
        return errorResponse('BrandBox not found', 404);
    }

    const cache = createBrandCache(env.OBCF_KV);
    await box.destroy();
    await cache.invalidate(organizationId, appId, id);

    return jsonResponse({ success: true }, 200);
}

/**
 * POST /api/brand/apply - Activate a BrandBox (one-click apply)
 */
export async function handleApplyBrandBox(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = (await request.json()) as { brandBoxId?: string };
    const brandBoxId = body?.brandBoxId as string | undefined;

    if (!brandBoxId) return errorResponse('brandBoxId is required', 400);

    const box = (await BrandBox.find(brandBoxId)) as BrandBox | null;
    if (!box) return errorResponse('BrandBox not found', 404);

    const bOrg = box.get('organizationId') as string | null;
    const bApp = box.get('appId') as string | null;
    if (bOrg !== organizationId || bApp !== (appId ?? null)) {
        return errorResponse('BrandBox not found', 404);
    }

    const cache = createBrandCache(env.OBCF_KV);
    await box.snapshot();
    await box.activate();
    await cache.invalidate(organizationId, appId);

    await logBrandAudit('brand.apply', request, { organizationId, appId, brandBoxId });

    return jsonResponse({ success: true, brandBoxId }, 200);
}

/**
 * POST /api/brandbox/:id/duplicate - Duplicate a BrandBox
 */
export async function handleDuplicateBrandBox(
    request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const source = (await BrandBox.find(id)) as BrandBox | null;
    if (!source) return errorResponse('BrandBox not found', 404);

    const sOrg = source.get('organizationId') as string | null;
    const sApp = source.get('appId') as string | null;
    if (sOrg !== organizationId || sApp !== (appId ?? null)) {
        return errorResponse('BrandBox not found', 404);
    }

    const body = (await request.json()) as { name?: string } | undefined;
    const newName = body?.name ?? `${source.get('name')} (Copy)`;

    const cache = createBrandCache(env.OBCF_KV);
    const box = (await BrandBox.create({
        organizationId,
        appId: appId || null,
        name: newName,
        slug: null,
        isActive: false,
        identityJson: source.get('identityJson'),
        logosJson: source.get('logosJson'),
        tokensJson: source.get('tokensJson'),
        themeVariantId: source.get('themeVariantId'),
        routeMappingsJson: source.get('routeMappingsJson'),
        layoutOverridesJson: source.get('layoutOverridesJson'),
        layoutTemplatesSnapshotJson: source.get('layoutTemplatesSnapshotJson'),
        customCss: source.get('customCss'),
        customMetaJson: source.get('customMetaJson'),
        hideOttabaseBranding: source.get('hideOttabaseBranding'),
        activeFrom: source.get('activeFrom'),
        activeUntil: source.get('activeUntil'),
    })) as BrandBox;

    await cache.invalidate(organizationId, appId);

    return jsonResponse({ id: box.get('id'), ...serializeBox(box) }, 201);
}

function serializeBox(box: BrandBox): Record<string, unknown> {
    return {
        name: box.get('name'),
        slug: box.get('slug'),
        isActive: box.get('isActive'),
        identityJson: box.get('identityJson'),
        logosJson: box.get('logosJson'),
        tokensJson: box.get('tokensJson'),
        themeVariantId: box.get('themeVariantId'),
        routeMappingsJson: box.get('routeMappingsJson'),
        layoutOverridesJson: box.get('layoutOverridesJson'),
        layoutTemplatesSnapshotJson: box.get('layoutTemplatesSnapshotJson'),
        customCss: box.get('customCss'),
        customMetaJson: box.get('customMetaJson'),
        hideOttabaseBranding: box.get('hideOttabaseBranding'),
        activeFrom: box.get('activeFrom'),
        activeUntil: box.get('activeUntil'),
        createdAt: box.get('createdAt'),
        updatedAt: box.get('updatedAt'),
    };
}
