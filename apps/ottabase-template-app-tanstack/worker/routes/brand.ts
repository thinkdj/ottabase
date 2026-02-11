// ---------------------------------------------------------------------------
// Brand API routes – GET /api/brand
// ---------------------------------------------------------------------------

import { handleGetBrand } from '@ottabase/brand-engine/handlers';
import type { ApiRouteContext } from './router';
import type { CloudflareEnv } from '../cloudflare-env';

export async function handleBrandApi(context: ApiRouteContext): Promise<Response | null> {
    const { route, request, env } = context;

    if (route !== '/api/brand' || context.method !== 'GET') {
        return null;
    }

    const brandEnv = {
        OBCF_D1: env.OBCF_D1,
        OBCF_KV: env.OBCF_KV,
        OBCF_R2: env.OBCF_R2,
        R2_PUBLIC_URL: (env as CloudflareEnv & { R2_PUBLIC_URL?: string }).R2_PUBLIC_URL,
    };

    return handleGetBrand(request, brandEnv);
}
