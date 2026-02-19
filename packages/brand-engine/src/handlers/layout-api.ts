// ---------------------------------------------------------------------------
// Brand Engine – Layout API handlers (v2: per-app scoping)
// GET/PUT /api/brand/layouts, GET/PUT /api/brand/mappings
// All scoped by appId only.
// ---------------------------------------------------------------------------

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { LayoutRouteMapping } from '../persistence/LayoutRouteMapping.model';
import { LayoutTemplate } from '../persistence/LayoutTemplate.model';
import { getLayoutData } from '../persistence/layoutData';
import type { BrandApiEnv } from './brand-api';
import { warmBrandCache } from './warm-cache';

/**
 * GET /api/brand/layouts - List layout templates for app
 */
export async function handleGetLayouts(_request: Request, _env: BrandApiEnv, appId?: string | null): Promise<Response> {
    const templates = await LayoutTemplate.where({ appId: appId ?? null }, { orderBy: 'name' });
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
export async function handlePutLayout(request: Request, env: BrandApiEnv, appId?: string | null): Promise<Response> {
    const body = (await request.json()) as { id?: string; name: string; componentKey: string; config: object };
    try {
        JSON.stringify(body.config);
    } catch {
        return errorResponse('Invalid config object', 400);
    }

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
            appId: appId || null,
            name: body.name,
            componentKey: body.componentKey,
            configJson: JSON.stringify(body.config),
        })) as LayoutTemplate;
    }

    await warmBrandCache(env, { appId: appId ?? null });
    return jsonResponse({ id: template.get('id'), ...body }, 200);
}

/**
 * GET /api/brand/mappings - List route mappings for app.
 * When no DB mappings exist, returns effective defaults from getLayoutData so users can view and edit them.
 */
export async function handleGetMappings(
    _request: Request,
    _env: BrandApiEnv,
    appId?: string | null,
): Promise<Response> {
    const mappings = await LayoutRouteMapping.where(
        { appId: appId ?? null },
        { orderBy: 'priority', orderDirection: 'desc' },
    );
    const data =
        mappings.length > 0
            ? (mappings as LayoutRouteMapping[]).map((m) => ({
                  id: m.get('id'),
                  pathPattern: m.get('pathPattern'),
                  layoutTemplateId: m.get('layoutTemplateId'),
                  brandKitId: m.get('brandKitId'),
                  priority: m.get('priority') ?? 0,
                  tokenOverridesJson: (m.get('tokenOverridesJson') as string | null) ?? null,
              }))
            : (await getLayoutData(appId)).routeMappings.map((m) => ({
                  pathPattern: m.pathPattern,
                  layoutTemplateId: m.layoutTemplateId,
                  brandKitId: m.brandKitId,
                  priority: m.priority,
                  tokenOverridesJson: m.tokenOverridesJson ?? null,
              }));
    return jsonResponse(data, 200);
}

/**
 * PUT /api/brand/mappings - Replace route mappings for app.
 * Each mapping must include brandKitId.
 */
export async function handlePutMappings(request: Request, env: BrandApiEnv, appId?: string | null): Promise<Response> {
    const body = (await request.json()) as {
        mappings: Array<{
            pathPattern: string;
            layoutTemplateId: string;
            brandKitId: string;
            priority?: number;
            tokenOverridesJson?: string | null;
        }>;
    };

    const existing = await LayoutRouteMapping.where({
        appId: appId ?? null,
    });
    for (const m of existing as LayoutRouteMapping[]) {
        await m.destroy();
    }

    for (const m of body.mappings ?? []) {
        if (!m.brandKitId) return errorResponse('brandKitId is required for each mapping', 400);
        // Validate tokenOverridesJson is valid JSON if provided
        if (m.tokenOverridesJson) {
            try {
                JSON.parse(m.tokenOverridesJson);
            } catch {
                return errorResponse(`Invalid JSON in tokenOverridesJson for pattern "${m.pathPattern}"`, 400);
            }
        }
        await LayoutRouteMapping.create({
            appId: appId || null,
            pathPattern: m.pathPattern,
            layoutTemplateId: m.layoutTemplateId,
            brandKitId: m.brandKitId,
            priority: m.priority ?? 0,
            tokenOverridesJson: m.tokenOverridesJson || null,
        });
    }

    await warmBrandCache(env, { appId: appId ?? null });
    return jsonResponse({ success: true }, 200);
}
