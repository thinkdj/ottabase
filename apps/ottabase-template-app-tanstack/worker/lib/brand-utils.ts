// ---------------------------------------------------------------------------
// Brand Engine – Shared route helpers for worker (v2: per-app scoping)
// ---------------------------------------------------------------------------

import type { CloudflareEnv } from '../../cloudflare-env';

export interface BrandEnv {
    OBCF_D1: CloudflareEnv['OBCF_D1'];
    OBCF_KV: CloudflareEnv['OBCF_KV'];
    OBCF_R2: CloudflareEnv['OBCF_R2'];
    R2_PUBLIC_URL?: string;
}

export function brandEnv(env: CloudflareEnv): BrandEnv {
    return {
        OBCF_D1: env.OBCF_D1,
        OBCF_KV: env.OBCF_KV,
        OBCF_R2: env.OBCF_R2,
        R2_PUBLIC_URL: (env as CloudflareEnv & { R2_PUBLIC_URL?: string }).R2_PUBLIC_URL,
    };
}

/**
 * Extract appId from request.
 * Checks query params first, then X-App-Id header.
 */
export function getAppId(url: URL, request?: Request): string | null {
    return url.searchParams.get('appId') ?? request?.headers.get('x-app-id') ?? null;
}
