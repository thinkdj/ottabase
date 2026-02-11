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
    handleApplyBrandBox,
} from '@ottabase/brand-engine/handlers';
import type { ApiRouteContext } from './router';
import type { CloudflareEnv } from '../cloudflare-env';
import { requireBrandEditAccess } from '../lib/admin-guard';

const brandEnv = (env: CloudflareEnv) => ({
    OBCF_D1: env.OBCF_D1,
    OBCF_KV: env.OBCF_KV,
    OBCF_R2: env.OBCF_R2,
    R2_PUBLIC_URL: (env as CloudflareEnv & { R2_PUBLIC_URL?: string }).R2_PUBLIC_URL,
});

function getOrgApp(context: ApiRouteContext) {
    const orgId = context.url.searchParams.get('organizationId') ?? null;
    const appId = context.url.searchParams.get('appId') ?? null;
    return { orgId, appId };
}

export async function handleBrandApi(context: ApiRouteContext): Promise<Response | null> {
    const { route, request, env, method } = context;
    const envBrand = brandEnv(env);
    const { orgId, appId } = getOrgApp(context);

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
        return handleApplyBrandBox(request, envBrand, guard.organizationId, guard.appId);
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
