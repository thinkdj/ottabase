/**
 * Blog HTTP surface — shared types.
 *
 * The router/handlers in this directory are framework-agnostic Cloudflare Worker
 * code: everything app-specific (DB driver wiring, auth guards, cron secrets,
 * config lookups) is injected via {@link BlogRouterConfig}. The package never
 * imports an app's auth or config modules, so the same surface mounts in any
 * Ottabase app (or a bare Worker) unchanged.
 */

import type { ContentType, EditorJSData } from '../types';
import type { SecurityContext } from '@ottabase/ottaorm';

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
    /** Server-derived RLS context. Required by first-class editorial writes. */
    securityContext?: SecurityContext;
}

/**
 * Guard result for editorial WRITES (blurbs, photo journals).
 *
 * `securityContext` is REQUIRED here, unlike on BlogAdminResult: these handlers hand it straight to
 * the RLS engine as the row scope, so "the host forgot to supply one" must be a compile error in
 * the host's config, not a runtime 401 that reads like the user's session was bad.
 */
export interface BlogEditorialWriteResult extends BlogAdminResult {
    securityContext: SecurityContext;
}

/** A static, trusted post used to populate an empty demo deployment. */
export interface BlogDemoPostSeed {
    title: string;
    slug: string;
    excerpt: string;
    content: EditorJSData;
    contentType: ContentType;
    isFeatured?: boolean;
    /**
     * Optional hero/featured image, matching the `heroImage` column shape on Post.
     * Seeds are trusted, static app fixtures, so the URL must be a public absolute
     * URL (or an app-served path) that resolves on a fresh deployment — a demo
     * install has no uploaded media to point at.
     */
    heroImage?: { url: string; alt?: string; caption?: string };
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
     * Admin guard for Studio mutations, demo seeding, and default-row seeding.
     * Resolve to a {@link BlogAdminResult} on success or a `Response` (401/403) on denial.
     *
     * Wire this at SYSTEM scope: it gates POST /seed-demo, which writes content
     * into the app, so an org-scoped admin must not satisfy it.
     */
    requireAdmin: (ctx: BlogRequestContext<Env>) => Promise<BlogAdminResult | Response>;

    /**
     * SCOPED Studio guard: may this caller administer the studio of the given
     * blog scope? The target org is the RESOLVED tenant (never a request hint
     * trusted on its own): null = the platform blog (platform admin required),
     * an id = that organization's blog (its org admin — or a platform admin).
     * Enables org admins to run their own blog's Studio in org mode. Falls back
     * to {@link requireAdmin} (platform-only) when not provided.
     */
    requireScopedStudioAdmin?: (
        ctx: BlogRequestContext<Env>,
        target: { organizationId: string | null },
    ) => Promise<BlogAdminResult | Response>;

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
     * Update-grade EDITORIAL gate (someone allowed to edit posts), typically looser than
     * {@link requireAdmin}. Guards the preview-token mint and the blurb/photo-journal updates.
     *
     * The preview mint falls back to `requireAdmin` when this is absent; the editorial WRITE routes
     * do not — they need a `securityContext` for row scope, and `requireAdmin` has none to give.
     * An app that omits this simply does not serve /blurbs or /photo-journals.
     */
    requireContentEditor?: (ctx: BlogRequestContext<Env>) => Promise<BlogEditorialWriteResult | Response>;

    /** Create-grade editorial guard for quick blurb publishing. Falls back to requireContentEditor. */
    requireContentCreator?: (ctx: BlogRequestContext<Env>) => Promise<BlogEditorialWriteResult | Response>;

    /**
     * OBJECT-level authorization for the preview-token mint: may this caller
     * manage THIS post (e.g. an editor/org-admin grant IN THE POST'S org, or a
     * platform admin)? Consulted only when the caller is not the post's author.
     * When absent, minting is restricted to the caller's own posts — the safe
     * default. Never trust request-supplied org hints here; authorize against
     * the post row's own organizationId.
     */
    canManagePost?: (
        ctx: BlogRequestContext<Env>,
        post: { id: string; authorId: string | null; userId: string | null; organizationId: string | null },
    ) => Promise<boolean>;

    /**
     * Static trusted content for the platform-owner demo seed — sample articles,
     * release notes, and the block kitchensink. When omitted, POST /seed-demo
     * responds 404: apps opt into seeding by supplying content. The handler
     * creates only missing rows, so running it again never overwrites edits.
     */
    demoPosts?: readonly BlogDemoPostSeed[];
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
    handleBlogBlurbCreate(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogBlurbUpdate(ctx: BlogRequestContext<Env>, postId: string): Promise<Response>;
    handleBlogPhotoJournalCreate(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPhotoJournalUpdate(ctx: BlogRequestContext<Env>, postId: string): Promise<Response>;
    handleBlogPostBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogPostUnlock(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogTagBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogCategoryBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogSeriesBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogRelatedPosts(ctx: BlogRequestContext<Env>, postId: string): Promise<Response>;
    handleBlogRssFeed(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogSitemap(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPublishScheduled(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogDemoSeed(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPreviewTokenMint(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioThemeTokens(ctx: BlogRequestContext<Env>): Promise<Response>;
}
