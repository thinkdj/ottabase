// ---------------------------------------------------------------------------
// Brand Engine – Layout API handlers
// GET/PUT /api/brand/layouts, GET/PUT /api/brand/mappings
// ---------------------------------------------------------------------------

import { LayoutTemplate } from '../persistence/LayoutTemplate.model';
import { LayoutRouteMapping } from '../persistence/LayoutRouteMapping.model';
import { createBrandCache } from '../persistence/cache';
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { jsonResponse } from '@ottabase/utils/http-response';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { BrandApiEnv } from './brand-api';

/**
 * GET /api/brand/layouts - List layout templates for org/app
 */
export async function handleGetLayouts(
    _request: Request,
    _env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const templates = await LayoutTemplate.where(
        { organizationId: organizationId ?? null, appId: appId ?? null },
        { orderBy: 'name' },
    );
    const data = (templates as LayoutTemplate[]).map((t) => ({
        id: t.get('id'),
        name: t.get('name'),
        componentKey: t.get('componentKey'),
        config: t.getConfig(),
    }));
    return jsonResponse(data, 200);
}

/**
 * PUT /api/brand/layouts - Create or update layout template
 */
export async function handlePutLayout(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = (await request.json()) as { id?: string; name: string; componentKey: string; config: object };
    const cache = createBrandCache(env.OBCF_KV);

    let template: LayoutTemplate;
    if (body.id) {
        template = (await LayoutTemplate.find(body.id)) as LayoutTemplate;
        if (!template) return errorResponse('Layout template not found', 404);
        template.set('name', body.name);
        template.set('componentKey', body.componentKey);
        template.set('configJson', JSON.stringify(body.config));
        await template.save();
    } else {
        template = (await LayoutTemplate.create({
            organizationId,
            appId: appId || null,
            name: body.name,
            componentKey: body.componentKey,
            configJson: JSON.stringify(body.config),
        })) as LayoutTemplate;
    }

    await cache.invalidate(organizationId, appId);
    return jsonResponse({ id: template.get('id'), ...body }, 200);
}

/**
 * GET /api/brand/mappings - List route mappings for org/app
 */
export async function handleGetMappings(
    _request: Request,
    _env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const mappings = await LayoutRouteMapping.where(
        { organizationId: organizationId ?? null, appId: appId ?? null },
        { orderBy: 'priority', orderDirection: 'desc' },
    );
    const data = (mappings as LayoutRouteMapping[]).map((m) => ({
        id: m.get('id'),
        pathPattern: m.get('pathPattern'),
        layoutTemplateId: m.get('layoutTemplateId'),
        priority: m.get('priority') ?? 0,
    }));
    return jsonResponse(data, 200);
}

/**
 * PUT /api/brand/mappings - Replace route mappings for org/app
 */
export async function handlePutMappings(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = (await request.json()) as {
        mappings: Array<{ pathPattern: string; layoutTemplateId: string; priority?: number }>;
    };
    const cache = createBrandCache(env.OBCF_KV);

    // Delete existing
    const existing = await LayoutRouteMapping.where({
        organizationId: organizationId ?? null,
        appId: appId ?? null,
    });
    for (const m of existing as LayoutRouteMapping[]) {
        await m.destroy();
    }

    // Create new
    for (const m of body.mappings ?? []) {
        await LayoutRouteMapping.create({
            organizationId,
            appId: appId || null,
            pathPattern: m.pathPattern,
            layoutTemplateId: m.layoutTemplateId,
            priority: m.priority ?? 0,
        });
    }

    await cache.invalidate(organizationId, appId);
    return jsonResponse({ success: true }, 200);
}
