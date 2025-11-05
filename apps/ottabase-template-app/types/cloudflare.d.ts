/**
 * Cloudflare Worker bindings type definitions
 * These types match the bindings configured in wrangler.jsonc
 */

import type {
  D1Database,
  KVNamespace,
  R2Bucket,
  Queue,
  Hyperdrive,
  RateLimiter,
  DurableObjectNamespace,
} from '@cloudflare/workers-types';

/**
 * Cloudflare environment bindings
 * Add all your Cloudflare bindings here to get type safety
 */
export interface CloudflareEnv {
  // D1 Database
  DB: D1Database;

  // KV Namespace
  MY_KV: KVNamespace;

  // R2 Bucket
  MY_BUCKET: R2Bucket;

  // Queue
  MY_QUEUE: Queue;

  // Hyperdrive (uncomment when configured)
  // HYPERDRIVE: Hyperdrive;

  // Rate Limiter (uncomment when configured)
  // RATE_LIMITER: RateLimiter;

  // Durable Objects
  REALTIME: DurableObjectNamespace;

  // Environment Variables
  ENVIRONMENT: string;
  NODE_ENV: string;

  // Secrets (set via wrangler secret put)
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;

  // Assets binding (automatically added by OpenNext)
  ASSETS: Fetcher;
}

/**
 * Get Cloudflare bindings in Next.js App Router
 *
 * Usage in Server Components or Route Handlers:
 * ```typescript
 * import { getCloudflareContext } from '@opennextjs/cloudflare';
 *
 * const { env } = await getCloudflareContext();
 * const db = env.DB;
 * ```
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv extends CloudflareEnv {}
  }
}

export {};
