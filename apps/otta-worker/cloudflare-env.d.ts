// Hand-written for the template so it reads at a glance; `pnpm cf-typegen` regenerates it
// from wrangler.jsonc once you add bindings. Secrets (ADMIN_TOKEN) are set with `wrangler secret put`.
interface CloudflareEnv {
    OBCF_D1: D1Database;
    OBCF_KV?: KVNamespace;
    OBCF_R2?: R2Bucket;
    OBCF_QUEUE?: Queue;
    ENVIRONMENT?: string;
    APP_ID?: string;
    /** Bearer token for the operator routes (`/api/admin/*` and every package's admin routes). */
    ADMIN_TOKEN?: string;
    MIGRATION_ALLOW_DESTRUCTIVE?: string;
    OTTAORM_MAX_ALL_ROWS?: string;
}
