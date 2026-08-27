// ---------------------------------------------------------------------------
// Brand Engine – Shared route helpers for worker (v2: per-app scoping)
// ---------------------------------------------------------------------------

import type { BrandApiEnv } from '@ottabase/brand-engine/handlers';
import { getOttabaseConfig } from '../../ottabase/config.loader';

export type BrandEnv = BrandApiEnv;

export function brandEnv(env: CloudflareEnv): BrandEnv {
    return {
        // Cloudflare publishes separate ambient and importable declarations.
        // Adapt the identical runtime bindings once at the package boundary.
        OBCF_D1: env.OBCF_D1 as BrandApiEnv['OBCF_D1'],
        OBCF_KV: env.OBCF_KV as BrandApiEnv['OBCF_KV'],
        OBCF_R2: env.OBCF_R2 as unknown as BrandApiEnv['OBCF_R2'],
        R2_PUBLIC_URL: (env as CloudflareEnv & { R2_PUBLIC_URL?: string }).R2_PUBLIC_URL,
    };
}

/** Brand rows are scoped by the server-configured app, never by browser input. */
export function getAppId(env: CloudflareEnv): string {
    return getOttabaseConfig(env).appId;
}
