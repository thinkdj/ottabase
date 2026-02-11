// ---------------------------------------------------------------------------
// Brand Engine – Theme Variant API handlers
// GET/POST /api/brand/themes, PUT/DELETE /api/brand/themes/:id
// RBAC: brand:edit required for POST, PUT, DELETE
// ---------------------------------------------------------------------------

import { ThemeVariant } from '../persistence/ThemeVariant.model';
import { createBrandCache } from '../persistence/cache';
import type { BrandApiEnv } from './brand-api';
import { jsonResponse } from '@ottabase/utils/http-response';
import { errorResponse } from '@ottabase/utils/http-errors';

/**
 * GET /api/brand/themes - List theme variants for org/app
 */
export async function handleGetThemeVariants(
    _request: Request,
    _env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const variants = (await ThemeVariant.where(
        { organizationId: organizationId ?? null, appId: appId ?? null },
        { orderBy: 'name' },
    )) as ThemeVariant[];

    const data = variants.map((v) => ({
        id: v.get('id'),
        name: v.get('name'),
        slug: v.get('slug'),
        tokensJson: v.get('tokensJson'),
        activeFrom: v.get('activeFrom'),
        activeUntil: v.get('activeUntil'),
        description: v.get('description'),
        createdAt: v.get('createdAt'),
        updatedAt: v.get('updatedAt'),
    }));

    return jsonResponse(data, 200);
}

/**
 * POST /api/brand/themes - Create theme variant
 */
export async function handleCreateThemeVariant(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = (await request.json()) as {
        name: string;
        slug?: string;
        tokensJson: string;
        activeFrom?: number | null;
        activeUntil?: number | null;
        description?: string | null;
    };

    if (!body.name || typeof body.tokensJson !== 'string') {
        return errorResponse('name and tokensJson required', 400);
    }

    const cache = createBrandCache(env.OBCF_KV);
    const variant = (await ThemeVariant.create({
        organizationId,
        appId: appId || null,
        name: body.name,
        slug: body.slug ?? null,
        tokensJson: body.tokensJson,
        activeFrom: body.activeFrom ?? null,
        activeUntil: body.activeUntil ?? null,
        description: body.description ?? null,
    })) as ThemeVariant;

    await cache.invalidate(organizationId, appId);

    return jsonResponse(
        {
            id: variant.get('id'),
            name: variant.get('name'),
            slug: variant.get('slug'),
            tokensJson: variant.get('tokensJson'),
            activeFrom: variant.get('activeFrom'),
            activeUntil: variant.get('activeUntil'),
            description: variant.get('description'),
        },
        201,
    );
}

/**
 * PUT /api/brand/themes/:id - Update theme variant
 */
export async function handleUpdateThemeVariant(
    request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const variant = (await ThemeVariant.find(id)) as ThemeVariant | null;
    if (!variant) return errorResponse('Theme variant not found', 404);

    // Scope check: variant must belong to same org/app
    const vOrg = variant.get('organizationId') as string | null;
    const vApp = variant.get('appId') as string | null;
    if (vOrg !== organizationId || vApp !== (appId ?? null)) {
        return errorResponse('Theme variant not found', 404);
    }

    const body = (await request.json()) as {
        name?: string;
        slug?: string;
        tokensJson?: string;
        activeFrom?: number | null;
        activeUntil?: number | null;
        description?: string | null;
    };

    const cache = createBrandCache(env.OBCF_KV);

    if (body.name !== undefined) variant.set('name', body.name);
    if (body.slug !== undefined) variant.set('slug', body.slug);
    if (body.tokensJson !== undefined) variant.set('tokensJson', body.tokensJson);
    if (body.activeFrom !== undefined) variant.set('activeFrom', body.activeFrom);
    if (body.activeUntil !== undefined) variant.set('activeUntil', body.activeUntil);
    if (body.description !== undefined) variant.set('description', body.description);

    await variant.save();
    await cache.invalidate(organizationId, appId);

    return jsonResponse(
        {
            id: variant.get('id'),
            name: variant.get('name'),
            slug: variant.get('slug'),
            tokensJson: variant.get('tokensJson'),
            activeFrom: variant.get('activeFrom'),
            activeUntil: variant.get('activeUntil'),
            description: variant.get('description'),
        },
        200,
    );
}

/**
 * DELETE /api/brand/themes/:id - Delete theme variant
 */
export async function handleDeleteThemeVariant(
    _request: Request,
    env: BrandApiEnv,
    id: string,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const variant = (await ThemeVariant.find(id)) as ThemeVariant | null;
    if (!variant) return errorResponse('Theme variant not found', 404);

    const vOrg = variant.get('organizationId') as string | null;
    const vApp = variant.get('appId') as string | null;
    if (vOrg !== organizationId || vApp !== (appId ?? null)) {
        return errorResponse('Theme variant not found', 404);
    }

    const cache = createBrandCache(env.OBCF_KV);
    await variant.destroy();
    await cache.invalidate(organizationId, appId);

    return jsonResponse({ success: true }, 200);
}
