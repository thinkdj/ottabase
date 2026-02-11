// ---------------------------------------------------------------------------
// Brand API routes – GET /api/brand, GET/POST /api/brand/themes, PUT/DELETE /api/brand/themes/:id
// ---------------------------------------------------------------------------

import {
    handleGetBrand,
    handleGetBrandSettings,
    handleUpdateBrand,
    handleUploadLogo,
    handleGetLayouts,
    handlePutLayout,
    handleGetMappings,
    handlePutMappings,
    handleGetThemeVariants,
    handleCreateThemeVariant,
    handleUpdateThemeVariant,
    handleDeleteThemeVariant,
    handleGetBrandPresets,
    handleCreateBrandPreset,
    handleUpdateBrandPreset,
    handleDeleteBrandPreset,
    handleApplyBrandPreset,
    handleDuplicateBrandPreset,
} from '@ottabase/brand-engine/handlers';
import type { ApiRouteContext } from './router';
import { requireBrandEditAccess } from '../lib/admin-guard';
import { brandEnv, getOrgApp } from '../lib/brand-utils';

export async function handleBrandApi(context: ApiRouteContext): Promise<Response | null> {
    const { route, request, url, env, method } = context;
    const envBrand = brandEnv(env);
    const { orgId, appId } = getOrgApp(url);

    if (route === '/api/brand' && method === 'GET') {
        return handleGetBrand(request, envBrand, orgId, appId);
    }

    if (route === '/api/brand/settings' && method === 'GET') {
        return handleGetBrandSettings(request, envBrand, orgId, appId);
    }

    if (route === '/api/brand' && method === 'PUT') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleUpdateBrand(request, envBrand, guard.organizationId, guard.appId);
    }

    if (route === '/api/brand/apply' && method === 'POST') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleApplyBrandPreset(request, envBrand, guard.organizationId, guard.appId);
    }

    if (route === '/api/brand/presets' && method === 'GET') {
        return handleGetBrandPresets(request, envBrand, orgId, appId);
    }
    if (route === '/api/brand/presets' && method === 'POST') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleCreateBrandPreset(request, envBrand, guard.organizationId, guard.appId);
    }

    const presetDuplicateMatch = route.match(/^\/api\/brand\/presets\/([^/]+)\/duplicate$/);
    if (presetDuplicateMatch && method === 'POST') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleDuplicateBrandPreset(
            request,
            envBrand,
            presetDuplicateMatch[1],
            guard.organizationId,
            guard.appId,
        );
    }

    const presetByIdMatch = route.match(/^\/api\/brand\/presets\/([^/]+)$/);
    if (presetByIdMatch) {
        const id = presetByIdMatch[1];
        if (method === 'PUT') {
            const guard = await requireBrandEditAccess(context, orgId, appId);
            if (guard instanceof Response) return guard;
            return handleUpdateBrandPreset(request, envBrand, id, guard.organizationId, guard.appId);
        }
        if (method === 'DELETE') {
            const guard = await requireBrandEditAccess(context, orgId, appId);
            if (guard instanceof Response) return guard;
            return handleDeleteBrandPreset(request, envBrand, id, guard.organizationId, guard.appId);
        }
    }

    const logoMatch = route.match(/^\/api\/brand\/logo\/(logo|logo-dark|icon|og-image|email-logo)$/);
    if (logoMatch && method === 'POST') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleUploadLogo(
            request,
            envBrand,
            guard.organizationId,
            guard.appId,
            logoMatch[1] as 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo',
        );
    }

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

    if (route === '/api/brand/themes' && method === 'GET') {
        return handleGetThemeVariants(request, envBrand, orgId, appId);
    }

    if (route === '/api/brand/themes' && method === 'POST') {
        const guard = await requireBrandEditAccess(context, orgId, appId);
        if (guard instanceof Response) return guard;
        return handleCreateThemeVariant(request, envBrand, guard.organizationId, guard.appId);
    }

    const themeByIdMatch = route.match(/^\/api\/brand\/themes\/([^/]+)$/);
    if (themeByIdMatch) {
        const id = themeByIdMatch[1];
        if (method === 'PUT') {
            const guard = await requireBrandEditAccess(context, orgId, appId);
            if (guard instanceof Response) return guard;
            return handleUpdateThemeVariant(request, envBrand, id, guard.organizationId, guard.appId);
        }
        if (method === 'DELETE') {
            const guard = await requireBrandEditAccess(context, orgId, appId);
            if (guard instanceof Response) return guard;
            return handleDeleteThemeVariant(request, envBrand, id, guard.organizationId, guard.appId);
        }
    }

    return null;
}
