/**
 * Cloudflare Worker bindings type definitions
 * These types match the bindings configured in wrangler.jsonc, keep the two in sync.
 */

import type { Fetcher } from '@cloudflare/workers-types';

/**
 * Cloudflare environment bindings with OBCF_* naming convention
 * OBCF = Ottabase Cloudflare
 *
 * Only bindings that wrangler.jsonc actually configures are declared here. To add one
 * (e.g. OBCF_D1, OBCF_KV), configure it in wrangler.jsonc first, then declare it here.
 *
 * Note: All bindings are optional to support local development builds.
 * At runtime on Cloudflare, these will be available.
 */
export interface CloudflareEnv {
    // Environment Variables
    ENVIRONMENT?: string;
    NODE_ENV?: string;

    // Static assets binding (OBCF = Ottabase Cloudflare)
    OBCF_ASSETS?: Fetcher;
}

/**
 * Get Cloudflare bindings in Next.js App Router
 *
 * Usage in Server Components or Route Handlers:
 * ```typescript
 * import { getCloudflareContext } from '@opennextjs/cloudflare';
 *
 * const { env } = await getCloudflareContext();
 * const environment = env.ENVIRONMENT;
 * ```
 */
declare global {
    namespace NodeJS {
        interface ProcessEnv extends CloudflareEnv {}
    }
}

export {};
