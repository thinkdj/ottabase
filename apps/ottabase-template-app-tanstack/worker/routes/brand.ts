// ---------------------------------------------------------------------------
// Brand API routes – Brand Kits, layouts, mappings, GET /api/brand (path-aware)
// ---------------------------------------------------------------------------

import {
    handleGetBrand,
    handleGetLayouts,
    handlePutLayout,
    handleGetMappings,
    handlePutMappings,
    handleGetBrandKits,
    handleGetBrandKit,
    handleCreateBrandKit,
    handleUpdateBrandKit,
    handleDeleteBrandKit,
    handleCloneBrandKit,
    handleUploadBrandKitLogo,
} from '@ottabase/brand-engine/handlers';
import type { ApiRouteContext } from './router';
import type { AdminContext } from '../lib/admin-guard';
import { requireBrandEditAccess } from '../lib/admin-guard';
import { brandEnv, getOrgApp } from '../lib/brand-utils';

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
    const { orgId, appId } = getOrgApp(url);

    // GET /api/brand - path required (client passes ?path=/current/path)
    if (route === '/api/brand' && method === 'GET') {
        return handleGetBrand(request, envBrand, orgId, appId);
    }

    // Brand Kits CRUD
    if (route === '/api/brand/kits' && method === 'GET') {
        return handleGetBrandKits(request, envBrand, orgId);
    }
    if (route === '/api/brand/kits' && method === 'POST') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleCreateBrandKit(request, envBrand, guard.organizationId);
    }

    const kitByIdMatch = route.match(/^\/api\/brand\/kits\/([^/]+)$/);
    if (kitByIdMatch) {
        const id = kitByIdMatch[1];
        if (method === 'GET') {
            return handleGetBrandKit(request, envBrand, id, orgId);
        }
        if (method === 'PUT') {
            const guard = await requireBrandEditAccess(context, orgId, appId);
            if (guard instanceof Response) return guard;
            return handleUpdateBrandKit(request, envBrand, id, guard.organizationId, toAuditUser(guard));
        }
        if (method === 'DELETE') {
            const guard = await requireBrandEditAccess(context, orgId, appId);
            if (guard instanceof Response) return guard;
            return handleDeleteBrandKit(request, envBrand, id, guard.organizationId);
        }
    }

    const kitCloneMatch = route.match(/^\/api\/brand\/kits\/([^/]+)\/clone$/);
    if (kitCloneMatch && method === 'POST') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleCloneBrandKit(request, envBrand, kitCloneMatch[1], guard.organizationId);
    }

    const kitLogoMatch = route.match(/^\/api\/brand\/kits\/([^/]+)\/logo\/(logo|logo-dark|icon|og-image|email-logo)$/);
    if (kitLogoMatch && method === 'POST') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleUploadBrandKitLogo(
            request,
            envBrand,
            kitLogoMatch[1],
            guard.organizationId,
            kitLogoMatch[2] as 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo',
            toAuditUser(guard),
        );
    }

    // Layouts & Mappings
    if (route === '/api/brand/layouts' && method === 'GET') {
        return handleGetLayouts(request, envBrand, orgId, appId);
    }
    if (route === '/api/brand/layouts' && method === 'PUT') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handlePutLayout(request, envBrand, guard.organizationId, guard.appId);
    }
    if (route === '/api/brand/mappings' && method === 'GET') {
        return handleGetMappings(request, envBrand, orgId, appId);
    }
    if (route === '/api/brand/mappings' && method === 'PUT') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handlePutMappings(request, envBrand, guard.organizationId, guard.appId);
    }

    return null;
}
