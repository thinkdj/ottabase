// ---------------------------------------------------------------------------
// Ottamenu – Public sidebar only. Menus/menu_items CRUD via OttaORM.
// ---------------------------------------------------------------------------
// GET /api/menus/sidebar (public) – resolved sidebar for SidebarNav.
// List/create/update/delete use /api/ottaorm/menus and /api/ottaorm/menu_items.
// ---------------------------------------------------------------------------

import { handleGetMenuSidebar } from '@ottabase/ottamenu/handlers';
import { initDbConnection } from '../lib/db-utils';
import { getAppId } from '../lib/brand-utils';
import type { ApiRouteContext } from './router';

function getAppIdFromContext(context: ApiRouteContext): string | null {
    return getAppId(context.url, context.request);
}

export async function handleMenusApi(context: ApiRouteContext): Promise<Response | null> {
    const { route, request, env, method } = context;

    if (!env?.OBCF_D1) return null;
    initDbConnection(env);

    // Public: GET /api/menus/sidebar – resolved sidebar for SidebarNav
    if (route === '/api/menus/sidebar' && method === 'GET') {
        const appId = getAppIdFromContext(context);
        return handleGetMenuSidebar(request, { OBCF_D1: env.OBCF_D1 }, appId);
    }

    return null;
}
