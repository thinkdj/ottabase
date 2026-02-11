// ---------------------------------------------------------------------------
// BrandBox API – GET/POST /api/brandbox, PUT/DELETE /api/brandbox/:id, POST /api/brandbox/:id/duplicate
// ---------------------------------------------------------------------------

import {
    handleGetBrandBoxes,
    handleCreateBrandBox,
    handleUpdateBrandBox,
    handleDeleteBrandBox,
    handleDuplicateBrandBox,
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

export async function handleBrandboxApi(context: ApiRouteContext): Promise<Response | null> {
    const { route, request, method } = context;
    const envBrand = brandEnv(context.env);
    const { orgId, appId } = getOrgApp(context);

    if (route === '/api/brandbox' && method === 'GET') {
        return handleGetBrandBoxes(request, envBrand, orgId, appId);
    }

    if (route === '/api/brandbox' && method === 'POST') {
        return handleCreateBrandBox(request, envBrand, orgId, appId);
    }

    // POST /api/brandbox/:id/duplicate - more specific first
    const duplicateMatch = route.match(/^\/api\/brandbox\/([^/]+)\/duplicate$/);
    if (duplicateMatch && method === 'POST') {
        return handleDuplicateBrandBox(request, envBrand, duplicateMatch[1], orgId, appId);
    }

    // PUT/DELETE /api/brandbox/:id
    const boxByIdMatch = route.match(/^\/api\/brandbox\/([^/]+)$/);
    if (boxByIdMatch) {
        const id = boxByIdMatch[1];
        if (method === 'PUT') return handleUpdateBrandBox(request, envBrand, id, orgId, appId);
        if (method === 'DELETE') return handleDeleteBrandBox(request, envBrand, id, orgId, appId);
    }

    return null;
}
