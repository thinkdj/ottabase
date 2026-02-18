// ---------------------------------------------------------------------------
// Brand API routes – Brand Kits, layouts, mappings, GET /api/brand (path-aware)
// v2: All scoped by appId only – no organizationId.
// ---------------------------------------------------------------------------

import type { AdminContext, ApiRouteContext } from '@ottabase/api/types';
import {
    handleCloneBrandKit,
    handleCreateBrandKit,
    handleDeleteBrandKit,
    handleGetBrand,
    handleGetBrandKit,
    handleGetBrandKits,
    handleGetLayouts,
    handleGetMappings,
    handleGetPresets,
    handlePutLayout,
    handlePutMappings,
    handleUpdateBrandKit,
    handleUploadBrandKitLogo,
} from '@ottabase/brand-engine/handlers';
import { requireBrandEditAccess } from '../lib/admin-guard';
import { brandEnv, getAppId } from '../lib/brand-utils';

function toAuditUser(guard: AdminContext): { userId?: string; userEmail?: string } | undefined {
    const u = guard.user;
    if (!u) return undefined;
    return {
        userId: (typeof u.get === 'function' ? u.get('id') : u.id) ?? undefined,
        userEmail: (typeof u.get === 'function' ? u.get('email') : u.email) ?? undefined,
    };
}

export async function handleBrandApi(context: ApiRouteContext): Promise<Response | null> {
    const { route, request, url, env, method } = context;
    const envBrand = brandEnv(env);
    const appId = getAppId(url, request);

    // GET /api/brand - path required (client passes ?path=/current/path)
    if (route === '/api/brand' && method === 'GET') {
        return handleGetBrand(request, envBrand, appId);
    }

    // GET /api/brand/presets - available theme presets
    if (route === '/api/brand/presets' && method === 'GET') {
        return handleGetPresets();
    }

    // Brand Kits CRUD
    if (route === '/api/brand/kits' && method === 'GET') {
        return handleGetBrandKits(request, envBrand, appId);
    }
    if (route === '/api/brand/kits' && method === 'POST') {
        const guard = await requireBrandEditAccess(context, null, appId);
        if (guard instanceof Response) return guard;
        return handleCreateBrandKit(request, envBrand, appId, toAuditUser(guard));
    }

    const kitByIdMatch = route.match(/^\/api\/brand\/kits\/([^/]+)$/);
    if (kitByIdMatch) {
        const id = kitByIdMatch[1];
        if (method === 'GET') {
            return handleGetBrandKit(request, envBrand, id, appId);
        }
        if (method === 'PUT') {
            const guard = await requireBrandEditAccess(context, null, appId);
            if (guard instanceof Response) return guard;
            return handleUpdateBrandKit(request, envBrand, id, appId, toAuditUser(guard));
        }
        if (method === 'DELETE') {
            const guard = await requireBrandEditAccess(context, null, appId);
            if (guard instanceof Response) return guard;
            return handleDeleteBrandKit(request, envBrand, id, appId);
        }
    }

    const kitCloneMatch = route.match(/^\/api\/brand\/kits\/([^/]+)\/clone$/);
    if (kitCloneMatch && method === 'POST') {
        const guard = await requireBrandEditAccess(context, null, appId);
        if (guard instanceof Response) return guard;
        return handleCloneBrandKit(request, envBrand, kitCloneMatch[1], appId, toAuditUser(guard));
    }

    const kitLogoMatch = route.match(/^\/api\/brand\/kits\/([^/]+)\/logo\/(logo|logo-dark|icon|og-image|email-logo)$/);
    if (kitLogoMatch && method === 'POST') {
        const guard = await requireBrandEditAccess(context, null, appId);
        if (guard instanceof Response) return guard;
        return handleUploadBrandKitLogo(
            request,
            envBrand,
            kitLogoMatch[1],
            appId,
            kitLogoMatch[2] as 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo',
            toAuditUser(guard),
        );
    }

    // Layouts & Mappings
    if (route === '/api/brand/layouts' && method === 'GET') {
        return handleGetLayouts(request, envBrand, appId);
    }
    if (route === '/api/brand/layouts' && method === 'PUT') {
        const guard = await requireBrandEditAccess(context, null, appId);
        if (guard instanceof Response) return guard;
        return handlePutLayout(request, envBrand, appId);
    }
    if (route === '/api/brand/mappings' && method === 'GET') {
        return handleGetMappings(request, envBrand, appId);
    }
    if (route === '/api/brand/mappings' && method === 'PUT') {
        const guard = await requireBrandEditAccess(context, null, appId);
        if (guard instanceof Response) return guard;
        return handlePutMappings(request, envBrand, appId);
    }

    return null;
}
