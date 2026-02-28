// ============================================================
// Presets API Handlers
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { RecraftStylePreset } from '../ottaorm-models/RecraftStylePreset';
import { BUILT_IN_PRESETS, getPresetsByCategory } from '../presets';
import type { RecraftRouteContext } from './types';

/** GET /api/recraft/presets — List all style presets */
export async function handleGetPresets(context: RecraftRouteContext): Promise<Response> {
    const { env, url } = context;

    if (!env.OBCF_D1) {
        // Fallback: return built-in presets without DB
        return json({
            data: BUILT_IN_PRESETS.map((p) => ({
                slug: p.slug,
                name: p.name,
                description: p.description,
                category: p.category,
                styleConfig: p.styleConfig,
                thumbnailUrl: p.thumbnailUrl ?? null,
                isBuiltIn: true,
            })),
            grouped: getPresetsByCategory(),
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const category = url.searchParams.get('category');
    const presets = category
        ? await RecraftStylePreset.forCategory(category)
        : await RecraftStylePreset.all({ orderBy: 'category', orderDirection: 'asc' });

    return json({
        data: presets.map((p) => p.toJson()),
    });
}

/** GET /api/recraft/presets/:slug — Get a single preset by slug */
export async function handleGetPresetBySlug(context: RecraftRouteContext, slug: string): Promise<Response> {
    const { env } = context;

    if (!env.OBCF_D1) {
        const builtin = BUILT_IN_PRESETS.find((p) => p.slug === slug);
        if (!builtin) return error('Preset not found', 404);
        return json({
            slug: builtin.slug,
            name: builtin.name,
            description: builtin.description,
            category: builtin.category,
            styleConfig: builtin.styleConfig,
            isBuiltIn: true,
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const preset = await RecraftStylePreset.findBySlug(slug);
    if (!preset) return error('Preset not found', 404);

    return json(preset.toJson());
}

/** POST /api/recraft/presets/seed — Seed built-in presets to the database */
export async function handleSeedPresets(context: RecraftRouteContext): Promise<Response> {
    const { env } = context;

    if (!env.OBCF_D1) {
        return error('D1 database binding not configured', 500, 'CONFIG_ERROR');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1 as any));

    const created = await RecraftStylePreset.seedBuiltInPresets();
    return json({
        success: true,
        created,
        message: created.length > 0
            ? `Seeded ${created.length} preset(s): ${created.join(', ')}`
            : 'All presets already exist',
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
