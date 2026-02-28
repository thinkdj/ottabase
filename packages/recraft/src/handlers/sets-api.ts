// ============================================================
// Sets API Handlers — CRUD for RecraftSet
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { RecraftSet } from '../ottaorm-models/RecraftSet';
import type { RecraftRouteContext } from './types';
import { readJson } from './types';

/** GET /api/recraft/sets — List sets with pagination */
export async function handleListSets(context: RecraftRouteContext): Promise<Response> {
    const { env, url } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') ?? '15', 10) || 15));
    const search = url.searchParams.get('search') || url.searchParams.get('q');
    const userId = url.searchParams.get('userId');

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;

    let result;
    if (search) {
        result = await RecraftSet.searchPaginate(search, ['name', 'description'], page, perPage, where, {
            orderBy: 'updatedAt',
            orderDirection: 'desc',
        });
    } else {
        result = await RecraftSet.paginate(page, perPage, Object.keys(where).length > 0 ? where : undefined, {
            orderBy: 'updatedAt',
            orderDirection: 'desc',
        });
    }

    return json({
        data: result.data.map((s) => s.toJson()),
        pagination: {
            page: result.page,
            perPage: result.perPage,
            total: result.total,
            totalPages: result.totalPages,
            next: result.hasNextPage ? `/api/recraft/sets?page=${result.page + 1}&per_page=${perPage}` : null,
            prev: result.hasPrevPage ? `/api/recraft/sets?page=${result.page - 1}&per_page=${perPage}` : null,
        },
    });
}

/** POST /api/recraft/sets — Create a new set */
export async function handleCreateSet(context: RecraftRouteContext): Promise<Response> {
    const { env, request } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const body = await readJson<{
        name?: string;
        description?: string;
        stylePresetId?: string;
        customStyleJson?: Record<string, unknown>;
        settingsJson?: Record<string, unknown>;
        userId?: string;
        appId?: string;
    }>(request);

    if (!body.name) {
        return error('Name is required', 400, 'VALIDATION_ERROR');
    }

    try {
        const set = await RecraftSet.create({
            name: body.name,
            description: body.description ?? null,
            stylePresetId: body.stylePresetId ?? null,
            customStyleJson: body.customStyleJson ? JSON.stringify(body.customStyleJson) : null,
            settingsJson: body.settingsJson ? JSON.stringify(body.settingsJson) : null,
            userId: body.userId ?? null,
            appId: body.appId ?? null,
        });

        return json({ success: true, data: set.toJson() }, 201);
    } catch (err) {
        return error(err instanceof Error ? err.message : 'Failed to create set', 400, 'VALIDATION_ERROR');
    }
}

/** GET /api/recraft/sets/:id — Get a single set with its preset info */
export async function handleGetSet(context: RecraftRouteContext, id: string): Promise<Response> {
    const { env } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const set = await RecraftSet.find(id);
    if (!set) return error('Set not found', 404, 'NOT_FOUND');

    const preset = await (set as RecraftSet).stylePreset();
    const resolvedStyle = await (set as RecraftSet).getResolvedStyle();

    return json({
        ...set.toJson(),
        preset: preset ? preset.toJson() : null,
        resolvedStyle,
    });
}

/** PATCH /api/recraft/sets/:id — Update a set */
export async function handleUpdateSet(context: RecraftRouteContext, id: string): Promise<Response> {
    const { env, request } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const set = await RecraftSet.find(id);
    if (!set) return error('Set not found', 404, 'NOT_FOUND');

    const body = await readJson<{
        name?: string;
        description?: string;
        stylePresetId?: string;
        customStyleJson?: Record<string, unknown>;
        settingsJson?: Record<string, unknown>;
        coverImageKey?: string;
    }>(request);

    if (body.name !== undefined) set.set('name', body.name);
    if (body.description !== undefined) set.set('description', body.description);
    if (body.stylePresetId !== undefined) set.set('stylePresetId', body.stylePresetId);
    if (body.customStyleJson !== undefined) set.set('customStyleJson', JSON.stringify(body.customStyleJson));
    if (body.settingsJson !== undefined) set.set('settingsJson', JSON.stringify(body.settingsJson));
    if (body.coverImageKey !== undefined) set.set('coverImageKey', body.coverImageKey);

    try {
        await set.save();
        return json({ success: true, data: set.toJson() });
    } catch (err) {
        return error(err instanceof Error ? err.message : 'Failed to update set', 400, 'VALIDATION_ERROR');
    }
}

/** DELETE /api/recraft/sets/:id — Delete a set and its generations */
export async function handleDeleteSet(context: RecraftRouteContext, id: string): Promise<Response> {
    const { env } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const set = await RecraftSet.find(id);
    if (!set) return error('Set not found', 404, 'NOT_FOUND');

    // Delete associated generations and their R2 images
    const { RecraftGeneration } = await import('../ottaorm-models/RecraftGeneration');
    const generations = await RecraftGeneration.forSet(id);

    if (env.OBCF_R2) {
        for (const gen of generations) {
            const imageKey = gen.get('imageKey') as string | null;
            const thumbKey = gen.get('thumbnailKey') as string | null;
            if (imageKey) {
                try { await env.OBCF_R2.delete(imageKey); } catch { /* ignore */ }
            }
            if (thumbKey) {
                try { await env.OBCF_R2.delete(thumbKey); } catch { /* ignore */ }
            }
        }
    }

    // Delete generations
    for (const gen of generations) {
        await RecraftGeneration.delete(gen.get('id') as string);
    }

    // Delete the set itself
    await RecraftSet.delete(id);

    return json({ success: true, message: 'Set and all generations deleted' });
}

// ── Helpers ─────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function error(message: string, status = 400, code?: string): Response {
    return new Response(JSON.stringify({ error: message, code: code || 'BAD_REQUEST' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
