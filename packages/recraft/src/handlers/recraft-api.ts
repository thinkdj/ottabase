// ============================================================
// Recraft API — Main Route Handler
// ============================================================
// Dispatches all /api/recraft/* routes to the appropriate handler.
// Follows the same pattern as brand-api.ts and shortlinks.ts.
// ============================================================

import type { RecraftRouteContext } from './types';
import { handleGetPresets, handleGetPresetBySlug, handleSeedPresets } from './presets-api';
import {
    handleCreateSet,
    handleDeleteSet,
    handleGetSet,
    handleListSets,
    handleUpdateSet,
} from './sets-api';
import {
    handleDeleteGeneration,
    handleGetGeneration,
    handleListGenerations,
    handleToggleFavorite,
} from './generations-api';
import { handleGenerate } from './generate-api';

/**
 * Main route dispatcher for all Recraft API routes.
 * Returns a Response or null (to fall through to next handler).
 */
export async function handleRecraftApi(context: RecraftRouteContext): Promise<Response | null> {
    const { route, method } = context;

    // ── Style Presets ───────────────────────────────────────
    if (route === '/api/recraft/presets' && method === 'GET') {
        return handleGetPresets(context);
    }
    if (route === '/api/recraft/presets/seed' && method === 'POST') {
        return handleSeedPresets(context);
    }
    const presetSlugMatch = route.match(/^\/api\/recraft\/presets\/([^/]+)$/);
    if (presetSlugMatch && method === 'GET') {
        return handleGetPresetBySlug(context, presetSlugMatch[1]);
    }

    // ── Sets CRUD ───────────────────────────────────────────
    if (route === '/api/recraft/sets' && method === 'GET') {
        return handleListSets(context);
    }
    if (route === '/api/recraft/sets' && method === 'POST') {
        return handleCreateSet(context);
    }
    const setByIdMatch = route.match(/^\/api\/recraft\/sets\/([^/]+)$/);
    if (setByIdMatch) {
        const setId = setByIdMatch[1];
        if (method === 'GET') return handleGetSet(context, setId);
        if (method === 'PATCH') return handleUpdateSet(context, setId);
        if (method === 'DELETE') return handleDeleteSet(context, setId);
    }

    // ── Generation (create image) ───────────────────────────
    const generateMatch = route.match(/^\/api\/recraft\/sets\/([^/]+)\/generate$/);
    if (generateMatch && method === 'POST') {
        return handleGenerate(context, generateMatch[1]);
    }

    // ── Generations (list/detail) ───────────────────────────
    const setGenerationsMatch = route.match(/^\/api\/recraft\/sets\/([^/]+)\/generations$/);
    if (setGenerationsMatch && method === 'GET') {
        return handleListGenerations(context, setGenerationsMatch[1]);
    }

    const generationByIdMatch = route.match(/^\/api\/recraft\/generations\/([^/]+)$/);
    if (generationByIdMatch) {
        const genId = generationByIdMatch[1];
        if (method === 'GET') return handleGetGeneration(context, genId);
        if (method === 'DELETE') return handleDeleteGeneration(context, genId);
    }

    const favoriteMatch = route.match(/^\/api\/recraft\/generations\/([^/]+)\/favorite$/);
    if (favoriteMatch && method === 'PATCH') {
        return handleToggleFavorite(context, favoriteMatch[1]);
    }

    return null;
}
