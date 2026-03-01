/**
 * Cloudflare environment bindings for the resumeme worker.
 *
 * This file is the single source of truth for the `CloudflareEnv` interface
 * that is shared between cloudflare-worker.ts, all files in worker/, and
 * ottabase/ helpers.
 *
 * It is kept manually in sync with wrangler.jsonc.
 * Run `pnpm cf-typegen` to regenerate from wrangler.jsonc if bindings change.
 */

export interface CloudflareEnv {
    // ─── CF Bindings ─────────────────────────────────────────────────────────

    /** D1 SQLite database */
    OBCF_D1: D1Database;
    /** KV key-value store */
    OBCF_KV: KVNamespace;
    /** R2 object storage */
    OBCF_R2: R2Bucket;
    /** Queue producer */
    OBCF_QUEUE: Queue;
    /** Static asset binding (SPA files from dist/) */
    OBCF_ASSETS: Fetcher;

    /** Analytics Engine datasets */
    OBCF_ANALYTICS_CORE?: AnalyticsEngineDataset;
    OBCF_ANALYTICS_SHORTLINKS?: AnalyticsEngineDataset;
    OBCF_ANALYTICS_REFERRALS?: AnalyticsEngineDataset;

    /** Rate limiter via unsafe bindings */
    OBCF_RATE_LIMITER?: any;

    /** Durable Object for real-time WebSocket pub/sub */
    OBCF_REALTIME?: DurableObjectNamespace;

    /** Workers AI binding */
    OBCF_AI?: Ai;

    /**
     * Browser Rendering API binding (Cloudflare's managed Puppeteer).
     * Add in wrangler.jsonc as: `"browser": { "binding": "OBCF_BROWSER" }`.
     * Enable in your Cloudflare dashboard: Workers > your-worker > Settings > Browser Rendering.
     *
     * @see https://developers.cloudflare.com/browser-rendering/
     */
    OBCF_BROWSER?: Fetcher;

    // ─── Environment Variables ────────────────────────────────────────────────

    AUTH_SECRET: string;
    APP_ID?: string;
    AUTH_URL?: string;
    NEXTAUTH_URL?: string;
    ENVIRONMENT?: string;
    NODE_ENV?: string;
    AUTH_DISABLE_CREDENTIALS?: string;
    AUTH_REQUIRE_EMAIL_VERIFIED?: string;
    AUTH_SESSION_MAX_AGE?: string;
    AUTH_VERBOSE?: string;
    ALLOW_NULL_TENANT?: string;
    MULTI_TENANT_ENABLED?: string;
    BOOTSTRAP_OWNER_SECRET?: string;
    MIGRATION_SECRET?: string;
    ADMIN_EMAIL?: string;
    RESEND_API_KEY?: string;
    R2_PUBLIC_URL?: string;

    // Analytics Engine SQL API
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_ANALYTICS_API_TOKEN?: string;

    EMAIL_RESEND_API_KEY?: string;
    EMAIL_SERVER?: string;
    EMAIL_FROM?: string;

    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;

    // AI Gateway
    CFAI_GATEWAY_NAME?: string;
    CFAI_CF_API_TOKEN?: string;
    CFAI_OPENAI_API_KEY?: string;
    CFAI_ANTHROPIC_API_KEY?: string;
    CFAI_GOOGLE_AI_API_KEY?: string;

    AWS_ACCESS_KEY_ID?: string;
    AWS_SECRET_ACCESS_KEY?: string;
    AWS_REGION?: string;
}
