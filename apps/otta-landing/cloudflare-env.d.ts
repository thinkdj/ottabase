/**
 * Cloudflare Worker bindings — keep in sync with wrangler.jsonc (`pnpm cf-typegen` regenerates this file).
 *
 * Declared as the global `CloudflareEnv` interface that @opennextjs/cloudflare's
 * getCloudflareContext() returns.
 */

import type { D1Database, Fetcher, ImagesBinding, R2Bucket } from '@cloudflare/workers-types';

declare global {
    interface CloudflareEnv {
        ENVIRONMENT?: string;
        NODE_ENV?: string;
        /** Which app's landing content to render — must match otta-web's config.appId. */
        APP_ID?: string;
        /** The D1 database shared with otta-web (it writes, this app reads). */
        OBCF_D1?: D1Database;
        /** The R2 bucket shared with otta-web: serves images uploaded in its admin. */
        OBCF_R2?: R2Bucket;
        /**
         * Base URL of that public bucket, the same as otta-web's: its custom domain in production.
         * Unset: this app's own /api/files/public route.
         */
        R2_PUBLIC_URL?: string;
        /** Cloudflare Turnstile's site key for the lead form (a var). Empty: no bot check. */
        TURNSTILE_SITE_KEY?: string;
        /** Its secret (`wrangler secret put TURNSTILE_SECRET_KEY`). The check runs only when both are set. */
        TURNSTILE_SECRET_KEY?: string;
        OBCF_ASSETS?: Fetcher;
        /** Cloudflare Images, required by the OpenNext worker bundle. */
        IMAGES?: ImagesBinding;
    }
}

export {};
