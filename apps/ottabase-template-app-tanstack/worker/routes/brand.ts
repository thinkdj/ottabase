// ---------------------------------------------------------------------------
// Brand API routes – GET /api/brand, GET/POST /api/brand/themes, PUT/DELETE /api/brand/themes/:id
// ---------------------------------------------------------------------------

import {
    handleGetBrand,
    handleGetThemeVariants,
    handleCreateThemeVariant,
    handleUpdateThemeVariant,
    handleDeleteThemeVariant,
    handleApplyBrandBox,
} from '@ottabase/brand-engine/handlers';
import type { ApiRouteContext } from './router';
import type { CloudflareEnv } from '../cloudflare-env';

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

    if (route === '/api/brand/apply' && method === 'POST') {
        return handleApplyBrandBox(request, envBrand, orgId, appId);
    }

    if (route === '/api/brand/themes' && method === 'GET') {
        return handleGetThemeVariants(request, envBrand, orgId, appId);
    }

    if (route === '/api/brand/themes' && method === 'POST') {
        return handleCreateThemeVariant(request, envBrand, orgId, appId);
    }

    const themeByIdMatch = route.match(/^\/api\/brand\/themes\/([^/]+)$/);
    if (themeByIdMatch) {
        const id = themeByIdMatch[1];
        if (method === 'PUT') return handleUpdateThemeVariant(request, envBrand, id, orgId, appId);
        if (method === 'DELETE') return handleDeleteThemeVariant(request, envBrand, id, orgId, appId);
    }

    return null;
}
