// ============================================================
// CUSTOM ROUTE REGISTRATION  (User-zone)
// ============================================================
// Register API routes for your custom or premium packages here.
// This file is called by the framework router AFTER all built-in
// routes. Return a Response to handle a route, or null to skip.
// ============================================================

import { handleRecraftApi } from '@ottabase/recraft/handlers';
import type { ApiRouteContext } from '../worker/routes/router';

/**
 * Handle custom / premium package API routes.
 *
 * Called by the framework router after all built-in routes.
 * Return a Response to handle the route, or null to skip.
 */
export async function handleCustomRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route } = context;

    // ── @ottabase/recraft — AI brand asset generation ────────
    if (route.startsWith('/api/recraft')) {
        return handleRecraftApi(context as any);
    }

    return null;
}
