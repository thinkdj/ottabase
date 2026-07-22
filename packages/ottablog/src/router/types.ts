/**
 * Blog HTTP surface — shared types.
 *
 * The router/handlers in this directory are framework-agnostic Cloudflare Worker
 * code: everything app-specific (DB driver wiring, auth guards, cron secrets,
 * config lookups) is injected via {@link BlogRouterConfig}. The package never
 * imports an app's auth or config modules, so the same surface mounts in any
 * Ottabase app (or a bare Worker) unchanged.
 */

/** The minimal request context every blog handler receives. */
export interface BlogRequestContext<Env = unknown> {
    request: Request;
    env: Env;
    url: URL;
}

/**
 * Result of a successful admin-guard check. Mirrors the shape otta-web's
 * `requireAdminAccess` resolves to; only the fields the blog handlers actually
 * read are typed. A failed check returns a `Response` instead.
 */
export interface BlogAdminResult {
    session?: {
        user?: {
            id?: string | null;
            organizationId?: string | null;
        } | null;
    } | null;
}

/** App-injected dependencies for the blog HTTP surface. */
export interface BlogRouterConfig<Env = unknown> {
    /**
     * Verify DB availability and register the OttaORM connection for this request.
     * Return an error `Response` to abort (e.g. missing D1 binding), or null to proceed.
     * Called at the top of every handler that touches the database — must be idempotent.
     */
    connect: (env: Env) => Response | null;

    /**
     * Blog tenancy mode (features.ottablog.mode). Defaults to 'platform': one blog per
     * app, no org dimension — today's behavior, unchanged. In 'org' mode every public
     * read is scoped to the organization resolved by {@link resolveOrganizationId};
     * an unresolved tenant (null) scopes to platform-owned content (organizationId IS NULL).
     * Pass a function to resolve per request from env (e.g. an OTTABLOG_MODE env override).
     */
    mode?: 'platform' | 'org' | ((env: Env) => 'platform' | 'org');

    /**
     * org mode only: resolve the tenant for a request (subdomain, path prefix, header —
     * the app decides). Return the organizationId, or null for "no tenant" (platform
     * content). Never called in platform mode.
     */
    resolveOrganizationId?: (ctx: BlogRequestContext<Env>) => Promise<string | null> | string | null;

    /** Default appId when the request carries no `?appId=` or `x-app-id` header. */
    defaultAppId: (env: Env) => string;

    /**
     * Admin guard for Studio mutations, kitchensink seeding, and default-row seeding.
     * Resolve to a {@link BlogAdminResult} on success or a `Response` (401/403) on denial.
     */
    requireAdmin: (ctx: BlogRequestContext<Env>) => Promise<BlogAdminResult | Response>;

    /** Cron-secret check for POST /publish-scheduled. */
    checkCronAuth: (request: Request, env: Env) => boolean;

    /** Password verifier for protected posts (e.g. `verifyPassword` from @ottabase/auth/backend). */
    verifyPassword: (password: string, hash: string) => Promise<boolean>;

    /**
     * Secret for signed draft-preview tokens. When absent, `?preview=` on the
     * by-slug route is ignored and the mint endpoint responds 404.
     */
    previewTokenSecret?: (env: Env) => string | null;

    /**
     * Guard for the preview-token mint endpoint — an EDITORIAL gate (someone
     * allowed to edit posts), typically looser than {@link requireAdmin}.
     * Falls back to `requireAdmin` when not provided.
     */
    requireContentEditor?: (ctx: BlogRequestContext<Env>) => Promise<BlogAdminResult | Response>;

    /**
     * EditorJS content for the demo kitchensink post. When omitted, POST /kitchensink
     * responds 404 — apps opt into the demo by supplying content.
     */
    kitchensinkContent?: Record<string, unknown>;
}

/**
 * The full set of blog route handlers. Signatures intentionally match the
 * pre-extraction otta-web handlers so existing imports, mocks, and dispatch
 * tests keep working: context first, then any path parameter.
 */
export interface BlogHandlers<Env = unknown> {
    handleBlogStudioState(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioActivateTheme(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioPluginEnable(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioPluginConfig(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPostsList(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPostBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogPostUnlock(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogTagBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogCategoryBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogSeriesBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogRelatedPosts(ctx: BlogRequestContext<Env>, postId: string): Promise<Response>;
    handleBlogRssFeed(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogSitemap(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPublishScheduled(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogKitchensink(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPreviewTokenMint(ctx: BlogRequestContext<Env>): Promise<Response>;
}
