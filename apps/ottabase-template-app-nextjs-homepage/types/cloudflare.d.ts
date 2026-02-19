/**
 * Cloudflare Worker bindings type definitions
 * These types match the bindings configured in wrangler.jsonc
 */

import type {
    D1Database,
    DurableObjectNamespace,
    KVNamespace,
    Queue,
    R2Bucket,
    RateLimiter,
} from '@cloudflare/workers-types';

/**
 * Cloudflare environment bindings with OBCF_* naming convention
 * OBCF = Ottabase Cloudflare
 *
 * Add all your Cloudflare bindings here to get type safety
 *
 * Note: All bindings are optional to support local development builds.
 * At runtime on Cloudflare, these will be available.
 */
export interface CloudflareEnv {
    // D1 Database (OBCF = Ottabase Cloudflare)
    OBCF_D1?: D1Database;

    // KV Namespace
    OBCF_KV?: KVNamespace;

    // R2 Bucket
    OBCF_R2?: R2Bucket;

    // Queue
    OBCF_QUEUE?: Queue;

    // Hyperdrive (uncomment when configured)
    // OBCF_HYPERDRIVE?: Hyperdrive;

    // Rate Limiter
    OBCF_RATE_LIMITER?: RateLimiter;

    // Durable Objects
    OBCF_REALTIME?: DurableObjectNamespace;

    // Environment Variables
    ENVIRONMENT?: string;
    NODE_ENV?: string;

    // Secrets (set via wrangler secret put)
    CF_ACCOUNT_ID?: string;
    CF_API_TOKEN?: string;

    // Assets binding (OBCF = Ottabase Cloudflare)
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
 * const db = env.OBCF_D1;
 * const kv = env.OBCF_KV;
 * const r2 = env.OBCF_R2;
 * ```
 */
declare global {
    namespace NodeJS {
        interface ProcessEnv extends CloudflareEnv {}
    }
}

export {};
