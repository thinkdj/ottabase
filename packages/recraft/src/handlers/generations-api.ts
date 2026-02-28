// ============================================================
// Generations API Handlers — Read/Delete/Favorite
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { RecraftGeneration } from '../ottaorm-models/RecraftGeneration';
import type { RecraftRouteContext } from './types';

/** GET /api/recraft/sets/:setId/generations — List generations for a set */
export async function handleListGenerations(context: RecraftRouteContext, setId: string): Promise<Response> {
    const { env, url } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') ?? '24', 10) || 24));
    const assetType = url.searchParams.get('assetType');
    const status = url.searchParams.get('status');
    const favoritesOnly = url.searchParams.get('favorites') === 'true';

    const where: Record<string, unknown> = { setId };
    if (assetType) where.assetType = assetType;
    if (status) where.status = status;
    if (favoritesOnly) where.isFavorite = true;

    const result = await RecraftGeneration.paginate(page, perPage, where, {
        orderBy: 'createdAt',
        orderDirection: 'desc',
    });

    const r2Url = env.R2_PUBLIC_URL || '/api/upload/file';

    return json({
        data: result.data.map((g) => {
            const data = g.toJson();
            // Append full image URL if key exists
            if (data.imageKey) {
                data.imageUrl = `${r2Url}/${data.imageKey}`;
            }
            if (data.thumbnailKey) {
                data.thumbnailUrl = `${r2Url}/${data.thumbnailKey}`;
            }
            return data;
        }),
        pagination: {
            page: result.page,
            perPage: result.perPage,
            total: result.total,
            totalPages: result.totalPages,
            next: result.hasNextPage
                ? `/api/recraft/sets/${setId}/generations?page=${result.page + 1}&per_page=${perPage}`
                : null,
            prev: result.hasPrevPage
                ? `/api/recraft/sets/${setId}/generations?page=${result.page - 1}&per_page=${perPage}`
                : null,
        },
    });
}

/** GET /api/recraft/generations/:id — Get a single generation */
export async function handleGetGeneration(context: RecraftRouteContext, id: string): Promise<Response> {
    const { env } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const gen = await RecraftGeneration.find(id);
    if (!gen) return error('Generation not found', 404, 'NOT_FOUND');

    const r2Url = env.R2_PUBLIC_URL || '/api/upload/file';
    const data = gen.toJson();
    if (data.imageKey) data.imageUrl = `${r2Url}/${data.imageKey}`;
    if (data.thumbnailKey) data.thumbnailUrl = `${r2Url}/${data.thumbnailKey}`;

    return json(data);
}

/** DELETE /api/recraft/generations/:id — Delete a generation (and its R2 image) */
export async function handleDeleteGeneration(context: RecraftRouteContext, id: string): Promise<Response> {
    const { env } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const gen = await RecraftGeneration.find(id);
    if (!gen) return error('Generation not found', 404, 'NOT_FOUND');

    // Clean up R2 images
    if (env.OBCF_R2) {
        const imageKey = gen.get('imageKey') as string | null;
        const thumbKey = gen.get('thumbnailKey') as string | null;
        if (imageKey) {
            try { await env.OBCF_R2.delete(imageKey); } catch { /* ignore */ }
        }
        if (thumbKey) {
            try { await env.OBCF_R2.delete(thumbKey); } catch { /* ignore */ }
        }
    }

    // Decrement parent set's generation count
    const { RecraftSet } = await import('../ottaorm-models/RecraftSet');
    const setId = gen.get('setId') as string;
    const parentSet = await RecraftSet.find(setId);
    if (parentSet) {
        const count = Math.max(0, ((parentSet.get('generationCount') as number) || 0) - 1);
        parentSet.set('generationCount', count);
        await parentSet.save();
    }

    await RecraftGeneration.delete(id);

    return json({ success: true, message: 'Generation deleted' });
}

/** PATCH /api/recraft/generations/:id/favorite — Toggle favorite */
export async function handleToggleFavorite(context: RecraftRouteContext, id: string): Promise<Response> {
    const { env } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const gen = await RecraftGeneration.find(id);
    if (!gen) return error('Generation not found', 404, 'NOT_FOUND');

    await (gen as RecraftGeneration).toggleFavorite();

    return json({
        success: true,
        isFavorite: gen.get('isFavorite'),
    });
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
