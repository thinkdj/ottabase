/**
 * Cloudflare Worker bindings — keep in sync with wrangler.jsonc.
 *
 * Declared as the global `CloudflareEnv` interface that @opennextjs/cloudflare's
 * getCloudflareContext() returns.
 */

import type { D1Database, Fetcher } from '@cloudflare/workers-types';

declare global {
    interface CloudflareEnv {
        ENVIRONMENT?: string;
        NODE_ENV?: string;
        /** Which app's landing content to render — must match otta-web's config.appId. */
        APP_ID?: string;
        /** The D1 database shared with otta-web (it writes, this app reads). */
        OBCF_D1?: D1Database;
        OBCF_ASSETS?: Fetcher;
    }
}

export {};
