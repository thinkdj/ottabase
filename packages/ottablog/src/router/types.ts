/**
 * Blog HTTP surface — shared types.
 *
 * The router/handlers in this directory are framework-agnostic Cloudflare Worker
 * code: everything app-specific (DB driver wiring, auth guards, cron secrets,
 * config lookups) is injected via {@link BlogRouterConfig}. The package never
 * imports an app's auth or config modules, so the same surface mounts in any
 * Ottabase app (or a bare Worker) unchanged.
 */

import type { BlogExportPost } from '../import-export';
import type { BlogViewer } from '../lock-key';
import type { BlogLanguageConfig, ContentType, HeroImage, SeoMeta } from '../types';
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

/**
 * A static, trusted post used to populate an empty demo deployment.
 *
 * The same shape as one post in an import file, so a seed can do anything an import can: any
 * content type, tags, categories and a series by name, footnotes, an original date, and an
 * editorial `publishedAt` (defaults to now). Seeds always publish, so status, schedule and
 * protection do not apply. Media must be public absolute URLs or app-served paths: a fresh
 * install has no uploaded media to point at.
 */
export type BlogDemoPostSeed = Omit<BlogExportPost, 'status' | 'publishAt' | 'isProtected' | 'slug' | 'contentType'> & {
    slug: string;
    contentType: ContentType;
};

export interface BlogTranslationBody {
    language?: unknown;
    title?: unknown;
    slug?: unknown;
    excerpt?: unknown;
    blurbText?: unknown;
    photoNote?: unknown;
    photoAlbum?: unknown;
    content?: unknown;
    heroImage?: HeroImage | null;
    seoMeta?: SeoMeta | null;
    footnotes?: unknown;
    status?: unknown;
    publishAt?: unknown;
}

export interface BlogTranslationSettingsResponse {
    languageConfig: BlogLanguageConfig;
    translations: Record<string, unknown>[];
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
     * Serve organization blogs publicly (features.ottablog.orgBlogs). Every app has the site blog
     * (organizationId NULL, at /blog); with this on, `?blog=<orgSlug>` reads that organization's
     * blog (at /blogs/<orgSlug>). Off: `?blog=` answers 404 and only the site blog is public.
     */
    orgBlogs?: boolean | ((env: Env) => boolean);

    /**
     * The blog an editorial request works on (Studio, imports, preview links): the caller's active
     * organization, or null for the site blog. A REQUEST, not an authorization: every handler that
     * uses it re-checks the caller against that blog (requireScopedStudioAdmin, RLS). Defaults to
     * the site blog.
     */
    resolveEditorialScope?: (ctx: BlogRequestContext<Env>) => Promise<string | null> | string | null;

    /** Trusted server-configured appId for this router instance. */
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
     * SCOPED Studio guard: may this caller administer the given blog? null = the site blog
     * (platform admin required), an id = that organization's blog (its org admin, or a platform
     * admin). Lets each organization run its own blog's Studio. Falls back to {@link requireAdmin}
     * (platform-only) when not provided.
     */
    requireScopedStudioAdmin?: (
        ctx: BlogRequestContext<Env>,
        target: { organizationId: string | null },
    ) => Promise<BlogAdminResult | Response>;

    /**
     * Who is reading, for LOCKED (invite-only) categories: the signed-in user (null when signed
     * out) and whether they are the blog's staff, who read every locked post. Evaluate staff IN
     * the blog's scope, never the caller's own workspace (every signup owns one): system-scoped
     * grants for the site blog (null), that organization's grants for an org blog. otta-web checks
     * `posts:read_locked`. Everyone else opens what their audiences are given. Absent, or
     * failing: every reader is signed out, so locked posts stay closed (teased or hidden).
     */
    resolveViewer?: (ctx: BlogRequestContext<Env>, target: { organizationId: string | null }) => Promise<BlogViewer>;

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
 * The full set of blog route handlers. Every handler takes the request context
 * first, then any path parameter.
 */
export interface BlogHandlers<Env = unknown> {
    handleBlogStudioState(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioBlog(ctx: BlogRequestContext<Env>): Promise<Response>;
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
    handleBlogSeriesList(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogCategoryBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogSeriesBySlug(ctx: BlogRequestContext<Env>, slug: string): Promise<Response>;
    handleBlogAuthorById(ctx: BlogRequestContext<Env>, authorId: string): Promise<Response>;
    handleBlogExport(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogImport(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogRelatedPosts(ctx: BlogRequestContext<Env>, postId: string): Promise<Response>;
    handleBlogRssFeed(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogSitemap(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPublishScheduled(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogDemoSeed(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogPreviewTokenMint(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioThemeTokens(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioLanguages(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioAccess(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioAudienceCreate(ctx: BlogRequestContext<Env>): Promise<Response>;
    handleBlogStudioAudienceUpdate(ctx: BlogRequestContext<Env>, audienceId: string): Promise<Response>;
    handleBlogStudioAudienceDelete(ctx: BlogRequestContext<Env>, audienceId: string): Promise<Response>;
    handleBlogStudioAudienceMemberAdd(ctx: BlogRequestContext<Env>, audienceId: string): Promise<Response>;
    handleBlogStudioAudienceMemberRemove(
        ctx: BlogRequestContext<Env>,
        audienceId: string,
        userId: string,
    ): Promise<Response>;
    handleBlogStudioCategoryAudiences(ctx: BlogRequestContext<Env>, categoryId: string): Promise<Response>;
    handleBlogPostTranslations(ctx: BlogRequestContext<Env>, postId: string): Promise<Response>;
    handleBlogPostTranslationCreate(ctx: BlogRequestContext<Env>, postId: string): Promise<Response>;
    handleBlogPostTranslationUpdate(ctx: BlogRequestContext<Env>, postId: string, language: string): Promise<Response>;
    handleBlogPostTranslationDelete(ctx: BlogRequestContext<Env>, postId: string, language: string): Promise<Response>;
}
