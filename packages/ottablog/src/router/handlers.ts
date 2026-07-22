/**
 * Blog route handlers — the package-owned HTTP surface.
 *
 * Bodies were moved verbatim from apps/otta-web/worker/routes/blog.ts; the only
 * changes are the injected seams in {@link BlogRouterConfig} (DB connect, admin
 * guard, cron auth, password verify, kitchensink content, default appId).
 */
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import {
    OttablogPlugin,
    OttablogTheme,
    Post,
    PostCategory,
    PostCategoryLink,
    PostSeries,
    PostTag,
    PostTagLink,
} from '../ottaorm-models';
import { signPreviewToken, verifyPreviewToken } from '../preview-token';
import { StudioManager } from '../studio';
import type { BlogHandlers, BlogRequestContext, BlogRouterConfig } from './types';

async function readJson<T>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        return {} as T;
    }
}

function resolveOrgId(request: Request, fallback: string | null = null): string | null {
    const fromSession = fallback?.trim();
    if (fromSession && fromSession !== 'null' && fromSession !== 'undefined') return fromSession;

    const fromHeader = request.headers.get('x-org-id')?.trim();
    if (fromHeader && fromHeader !== 'null' && fromHeader !== 'undefined') return fromHeader;

    return null;
}

/**
 * Public blog lookup by slug: always discriminates by appId.
 * Never queries by slug alone — the same slug can exist across apps (see Post schema indexes).
 * In org mode the lookup also discriminates by organizationId (null = platform-owned rows),
 * since org mode allows the same slug across orgs within one app.
 */
async function findPublishedPostBySlug(
    slug: string,
    appId: string,
    contentTypeParam: string | null,
    organizationId?: string | null,
): Promise<Post | null> {
    const primary: Record<string, unknown> = { slug, status: 'published', appId };
    if (contentTypeParam) primary.contentType = contentTypeParam;
    if (organizationId !== undefined) primary.organizationId = organizationId;
    return Post.first(primary);
}

/**
 * Convert a Post model to a public-safe JSON object.
 * Strips privateNotes. Strips content from protected posts unless explicitly included.
 * Optionally enriches with tags, category name, and author info.
 */
async function publicPostJson(
    record: Post,
    options?: {
        includeContent?: boolean;
        enrichTags?: boolean;
        enrichCategory?: boolean;
        enrichSeries?: boolean;
        enrichAuthor?: boolean;
    },
) {
    const j = record.toJson() as Record<string, unknown>;
    const { privateNotes, ...rest } = j;

    // Strip content from protected posts
    if (rest.isProtected && !options?.includeContent) {
        const { content, footnotes, ...restNoContent } = rest;
        Object.assign(rest, restNoContent);
        rest.content = null;
        rest.footnotes = null;
    }

    // Enrich with author info from User relationship
    if (options?.enrichAuthor && rest.authorId) {
        try {
            const author = await record.author(['id', 'name', 'email', 'image']);
            if (author) {
                rest.author = {
                    id: author.get('id'),
                    name: author.get('name'),
                    email: author.get('email'),
                    image: author.get('image'),
                };
            } else {
                rest.author = null;
            }
        } catch {
            rest.author = null;
        }
    }

    // Enrich with tags
    if (options?.enrichTags) {
        try {
            const tagModels = await record.tags();
            rest.tags = tagModels.map((t) => t.toJson());
        } catch {
            rest.tags = [];
        }
    }

    // Enrich with categories (many-to-many via PostCategoryLink)
    if (options?.enrichCategory) {
        try {
            const categoryLinks = await PostCategoryLink.where({ postId: rest.id as string });
            if (categoryLinks.length > 0) {
                const categoryIds = categoryLinks.map((cl) => cl.get('categoryId') as string);
                const categoryModels = await Promise.all(categoryIds.map((id) => PostCategory.find(id)));
                rest.categories = categoryModels
                    .filter(Boolean)
                    .map((c) => ({ id: c!.get('id'), name: c!.get('name'), slug: c!.get('slug') }));
            } else {
                rest.categories = [];
            }
            // Legacy: keep categoryName for backwards compatibility if single categoryId exists
            if (rest.categoryId) {
                const category = await PostCategory.find(rest.categoryId as string);
                rest.categoryName = category ? category.get('name') : null;
                rest.categorySlug = category ? category.get('slug') : null;
            }
        } catch {
            rest.categories = [];
        }
    }

    // Enrich with series title
    if (options?.enrichSeries && rest.seriesId) {
        try {
            const series = await PostSeries.find(rest.seriesId as string);
            rest.seriesTitle = series ? series.get('title') : null;
        } catch {
            rest.seriesTitle = null;
        }
    }

    return rest;
}

/**
 * Build the full set of blog handlers with app dependencies injected.
 * Handlers are self-contained closures; the returned object satisfies {@link BlogHandlers}.
 */
export function createBlogHandlers<Env = unknown>(config: BlogRouterConfig<Env>): BlogHandlers<Env> {
    type Ctx = BlogRequestContext<Env>;

    function resolveMode(env: Env): 'platform' | 'org' {
        if (typeof config.mode === 'function') return config.mode(env);
        return config.mode ?? 'platform';
    }

    function resolveAppId(context: Ctx): string {
        return (
            context.url.searchParams.get('appId') ||
            context.request.headers.get('x-app-id') ||
            config.defaultAppId(context.env)
        );
    }

    /**
     * Resolve the tenant dimension for this request.
     * Platform mode: undefined (queries carry no org filter — column is ignored).
     * Org mode: the app-resolved organizationId, or null for platform-owned content.
     */
    async function resolveTenant(context: Ctx): Promise<string | null | undefined> {
        if (resolveMode(context.env) !== 'org') return undefined;
        const resolved = await config.resolveOrganizationId?.(context);
        return resolved ?? null;
    }

    async function handleBlogStudioState(context: Ctx): Promise<Response> {
        // Public endpoint: the runtime needs active theme + enabled plugin config to render blog pages
        // for every visitor (BlogStudioProvider is mounted globally). Mutation endpoints below remain
        // admin-guarded. Default-row seeding is gated to admin callers to avoid public write side effects.
        const { env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const orgScope = organizationId !== undefined ? { organizationId } : {};
        const state = await StudioManager.getState(appId, organizationId);

        const needsSeeding = state.themes.length === 0 || state.plugins.length === 0;
        if (needsSeeding) {
            // Only seed default theme/plugin rows if the caller is an admin — avoids any unauthenticated
            // visitor triggering DB writes. Non-admins get the current (possibly empty) state; the client
            // falls back to in-memory defaults registered by registerBlogThemesAndPlugins().
            const admin = await config.requireAdmin(context);
            if (!(admin instanceof Response)) {
                if (state.themes.length === 0) {
                    await OttablogTheme.create({
                        themeId: 'default',
                        name: 'Default',
                        description: 'Clean, modern default theme with dark mode support',
                        version: '1.0.0',
                        appId,
                        ...orgScope,
                        isActive: true,
                    });
                    await OttablogTheme.create({
                        themeId: 'minimal',
                        name: 'Minimal',
                        description: 'Clean, minimalist theme focused on typography and readability',
                        version: '1.0.0',
                        author: 'Ottabase',
                        appId,
                        ...orgScope,
                        isActive: false,
                    });
                }
                if (state.plugins.length === 0) {
                    await OttablogPlugin.create({
                        pluginId: 'content-injector-plugin',
                        name: 'Content Injector Plugin',
                        description: 'Injects custom content into posts',
                        appId,
                        ...orgScope,
                        enabled: false,
                    });
                }
                const finalState = await StudioManager.getState(appId, organizationId);
                return jsonResponse(finalState);
            }
        }

        return jsonResponse(state);
    }

    async function handleBlogStudioActivateTheme(context: Ctx): Promise<Response> {
        const admin = await config.requireAdmin(context);
        if (admin instanceof Response) return admin;

        const { request, env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const orgScope = organizationId !== undefined ? { organizationId } : {};
        const body = await readJson<{ themeId: string }>(request);
        const themeId = body?.themeId;
        if (!themeId) {
            return errorResponse('themeId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        let themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined, organizationId });
        if (!themeRow) {
            await OttablogTheme.create({
                themeId,
                name: themeId,
                appId,
                ...orgScope,
                isActive: false,
            });
            themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined, organizationId });
        }
        if (themeRow) {
            await themeRow.activate({ appId: appId ?? undefined, organizationId });
        }
        return jsonResponse({ success: true });
    }

    async function handleBlogStudioPluginEnable(context: Ctx): Promise<Response> {
        const admin = await config.requireAdmin(context);
        if (admin instanceof Response) return admin;

        const { request, env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const orgScope = organizationId !== undefined ? { organizationId } : {};
        const body = await readJson<{ pluginId: string; enabled: boolean }>(request);
        const pluginId = body?.pluginId;
        const enabled = body?.enabled ?? true;

        if (!pluginId) {
            return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        let pluginRow = await OttablogPlugin.findByPluginId(pluginId, { appId: appId ?? undefined, organizationId });
        if (!pluginRow) {
            await OttablogPlugin.create({
                pluginId,
                name: pluginId,
                appId,
                ...orgScope,
                enabled,
            });
        } else {
            pluginRow.set('enabled', enabled);
            await pluginRow.save();
        }
        return jsonResponse({ success: true });
    }

    async function handleBlogStudioPluginConfig(context: Ctx): Promise<Response> {
        const admin = await config.requireAdmin(context);
        if (admin instanceof Response) return admin;

        const { request, env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const body = await readJson<{ pluginId: string; config: Record<string, unknown> }>(request);
        const pluginId = body?.pluginId;
        const pluginConfig = body?.config;

        if (!pluginId) {
            return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        const pluginRow = await OttablogPlugin.findByPluginId(pluginId, { appId: appId ?? undefined, organizationId });
        if (!pluginRow) {
            return errorResponse('Plugin not found', 404, { code: 'NOT_FOUND' });
        }

        await pluginRow.updateConfig(pluginConfig ?? {});
        return jsonResponse({ success: true });
    }

    async function handleBlogPostsList(context: Ctx): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') || '15', 10)));
        const appId = url.searchParams.get('appId') || null;
        const contentType = url.searchParams.get('contentType') || null;
        const seriesId = url.searchParams.get('seriesId') || null;
        const categoryId = url.searchParams.get('categoryId') || null;
        const tagId = url.searchParams.get('tagId') || null;
        const search = url.searchParams.get('search') || null;
        const orderBy = url.searchParams.get('orderBy') || 'publishedAt';
        const orderDirection = (url.searchParams.get('orderDirection') || 'desc') as 'asc' | 'desc';
        const organizationId = await resolveTenant(context);

        const where: Record<string, unknown> = { status: 'published' };
        if (appId) where.appId = appId;
        if (organizationId !== undefined) where.organizationId = organizationId;
        if (contentType) {
            where.contentType = contentType;
        } else {
            // By default, exclude changelog posts from the blog list (changelog has its own UI at /changelog)
            where.contentType = { $ne: 'changelog' };
        }
        if (seriesId) where.seriesId = seriesId;

        // Tag-based filtering: find post IDs that have this tag, then filter
        let tagFilterPostIds: string[] | null = null;
        if (tagId) {
            const links = await PostTagLink.where({ tagId });
            tagFilterPostIds = links.map((l) => l.get('postId') as string);
            if (tagFilterPostIds.length === 0) {
                // No posts have this tag — return empty
                return jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } });
            }
        }

        // Category-based filtering: find post IDs that have this category via junction table
        let categoryFilterPostIds: string[] | null = null;
        if (categoryId) {
            const links = await PostCategoryLink.where({ categoryId });
            categoryFilterPostIds = links.map((l) => l.get('postId') as string);
            if (categoryFilterPostIds.length === 0) {
                return jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } });
            }
        }

        // Combine junction-based filters (tag + category)
        const junctionFilter = (postId: string) => {
            if (tagFilterPostIds && !tagFilterPostIds.includes(postId)) return false;
            if (categoryFilterPostIds && !categoryFilterPostIds.includes(postId)) return false;
            return true;
        };
        const hasJunctionFilter = tagFilterPostIds !== null || categoryFilterPostIds !== null;

        let result;
        if (hasJunctionFilter) {
            // When filtering by junction tables, fetch all matching posts then paginate in-memory
            // to get correct total/totalPages (Post.paginate can't filter by junction IDs)
            let allMatching;
            if (search && search.trim()) {
                allMatching = await Post.search(search.trim(), ['title', 'slug', 'excerpt'], where, {
                    orderBy,
                    orderDirection,
                });
            } else {
                allMatching = await Post.where(where, { orderBy, orderDirection });
            }
            const filtered = allMatching.filter((p) => junctionFilter(p.get('id') as string));
            const total = filtered.length;
            const totalPages = Math.ceil(total / perPage);
            const paged = filtered.slice((page - 1) * perPage, page * perPage);
            result = { data: paged, page, perPage, total, totalPages };
        } else if (search && search.trim()) {
            // Text search without junction filter — paginate via limit/offset
            const searchResults = await Post.search(search.trim(), ['title', 'slug', 'excerpt'], where, {
                orderBy,
                orderDirection,
                limit: perPage,
                offset: (page - 1) * perPage,
            });
            // Count total matches for pagination metadata
            const allSearchResults = await Post.search(search.trim(), ['title', 'slug', 'excerpt'], where, {
                orderBy,
                orderDirection,
            });
            result = {
                data: searchResults,
                page,
                perPage,
                total: allSearchResults.length,
                totalPages: Math.ceil(allSearchResults.length / perPage),
            };
        } else {
            result = await Post.paginate(page, perPage, where, { orderBy, orderDirection });
        }

        // Enrich all posts with tags, category name, series, and author
        const data = await Promise.all(
            result.data.map((r) =>
                publicPostJson(r as Post, {
                    enrichTags: true,
                    enrichCategory: true,
                    enrichSeries: true,
                    enrichAuthor: true,
                }),
            ),
        );
        return jsonResponse({
            data,
            pagination: {
                page: result.page,
                perPage: result.perPage,
                total: result.total,
                totalPages: result.totalPages,
            },
        });
    }

    /**
     * Signed draft preview: when a valid, unexpired `?preview=` token matches this
     * slug + appId, load the post WITHOUT the published-status filter. The token's
     * own org scope drives the lookup (it was bound at mint time), so a token can
     * never reach across tenants. Returns null when preview does not apply.
     */
    async function findPostForPreview(context: Ctx, slug: string, appId: string): Promise<Post | null> {
        const token = context.url.searchParams.get('preview');
        if (!token) return null;
        const secret = config.previewTokenSecret?.(context.env);
        if (!secret) return null;

        const payload = await verifyPreviewToken(secret, token);
        if (!payload || payload.slug !== slug || payload.appId !== appId) return null;

        const where: Record<string, unknown> = { slug, appId };
        if (payload.organizationId !== undefined) where.organizationId = payload.organizationId;
        return Post.first(where);
    }

    async function handleBlogPostBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const preview = await findPostForPreview(context, slug, appId);
        const organizationId = preview ? undefined : await resolveTenant(context);
        const contentTypeParam = url.searchParams.get('contentType') || null;
        const record = preview ?? (await findPublishedPostBySlug(slug, appId, contentTypeParam, organizationId));

        if (!record) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Changelogs require explicit opt-in via contentType=changelog parameter.
        // Without it, changelog posts are hidden from the regular blog API.
        if (!contentTypeParam && record.get('contentType') === 'changelog') {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // View tracking disabled by default (D1 write cost per view).
        // Call POST /api/blog/posts/:slug/track-view explicitly when needed.

        const data = await publicPostJson(record, {
            // A preview link is the review artifact — the token grants content access
            // (password-protection stripping still applies to normal public reads).
            includeContent: !!preview,
            enrichTags: true,
            enrichCategory: true,
            enrichSeries: true,
            enrichAuthor: true,
        });
        return jsonResponse(preview ? { ...data, preview: true } : data);
    }

    async function handleBlogPostUnlock(context: Ctx): Promise<Response> {
        const { request, env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const body = await readJson<{ slug: string; password: string }>(request);
        const slug = body?.slug?.trim();
        const password = body?.password;

        if (!slug || password === undefined || password === null) {
            return errorResponse('slug and password are required', 400, { code: 'VALIDATION_ERROR' });
        }

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const contentTypeParam = url.searchParams.get('contentType') || null;
        const record = await findPublishedPostBySlug(slug, appId, contentTypeParam, organizationId);
        if (!record) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Changelogs require explicit opt-in via contentType=changelog parameter.
        // Without it, changelog posts are hidden from the regular blog API.
        if (!contentTypeParam && record.get('contentType') === 'changelog') {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        const isProtected = record.get('isProtected');
        const passwordHash = record.get('passwordHash');
        if (!isProtected || !passwordHash) {
            const data = await publicPostJson(record, {
                includeContent: true,
                enrichTags: true,
                enrichCategory: true,
                enrichSeries: true,
                enrichAuthor: true,
            });
            return jsonResponse(data);
        }

        const valid = await config.verifyPassword(String(password), String(passwordHash));
        if (!valid) {
            return errorResponse('Invalid password', 401, { code: 'INVALID_PASSWORD' });
        }

        const data = await publicPostJson(record, {
            includeContent: true,
            enrichTags: true,
            enrichCategory: true,
            enrichSeries: true,
            enrichAuthor: true,
        });
        return jsonResponse(data);
    }

    // ============================================================
    // ARCHIVE PAGES: tag, category, series by slug
    // ============================================================

    async function handleBlogTagBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const type = url.searchParams.get('type') || 'post';
        const tag = await PostTag.findBySlug(slug, { appId, type, organizationId });
        if (!tag) {
            return errorResponse('Tag not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse(tag.toJson());
    }

    async function handleBlogCategoryBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const type = url.searchParams.get('type') || 'post';
        const category = await PostCategory.findBySlug(slug, { appId, type, organizationId });
        if (!category) {
            return errorResponse('Category not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse(category.toJson());
    }

    async function handleBlogSeriesBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const series = await PostSeries.findBySlug(slug, { appId, organizationId });
        if (!series) {
            return errorResponse('Series not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse(series.toJson());
    }

    // ============================================================
    // RELATED POSTS
    // ============================================================

    async function handleBlogRelatedPosts(context: Ctx, postId: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = url.searchParams.get('appId') || null;
        const organizationId = await resolveTenant(context);
        const limit = Math.min(10, Math.max(1, parseInt(url.searchParams.get('limit') || '4', 10)));

        const post = await Post.find(postId);
        if (!post) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Gather category IDs from junction table for junction-aware related lookup
        const categoryLinks = await PostCategoryLink.where({ postId });
        const categoryIds = categoryLinks.map((cl) => cl.get('categoryId') as string);

        const related = await Post.related(postId, {
            categoryIds,
            contentType: post.get('contentType') as string,
            appId: appId ?? undefined,
            organizationId,
            limit,
        });

        const data = await Promise.all(related.map((r) => publicPostJson(r, { enrichTags: true, enrichAuthor: true })));
        return jsonResponse(data);
    }

    // ============================================================
    // RSS FEED
    // ============================================================

    async function handleBlogRssFeed(context: Ctx): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = url.searchParams.get('appId') || null;
        const organizationId = await resolveTenant(context);
        const contentType = url.searchParams.get('contentType') || null;
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));

        const where: Record<string, unknown> = { status: 'published' };
        if (appId) where.appId = appId;
        if (organizationId !== undefined) where.organizationId = organizationId;
        if (contentType) {
            where.contentType = contentType;
        } else {
            where.contentType = { $ne: 'changelog' };
        }

        const posts = await Post.where(where, {
            orderBy: 'publishedAt',
            orderDirection: 'desc',
            limit,
        });

        // Load author names from User model via authorId relationship
        // Collect unique authorIds and fetch users in one batch
        const authorIds = [
            ...new Set(posts.map((p) => p.get('authorId') as string | null).filter(Boolean)),
        ] as string[];
        const authorMap = new Map<string, string>();
        if (authorIds.length > 0) {
            const { User } = await import('@ottabase/ottaorm');
            const authors = await User.whereIn('id', authorIds, { select: ['id', 'name'] });
            for (const author of authors) {
                const id = author.get('id') as string;
                const name = author.get('name') as string;
                if (id && name) authorMap.set(id, name);
            }
        }

        // Derive the site URL from the request
        const siteUrl = `${url.protocol}//${url.host}`;
        const feedTitle = url.searchParams.get('title') || 'Blog';
        const feedDescription = url.searchParams.get('description') || 'Latest posts';

        const escapeXml = (str: string): string =>
            str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

        const items = posts
            .map((post) => {
                const title = escapeXml((post.get('title') as string) || '');
                const slug = post.get('slug') as string;
                const excerpt = escapeXml((post.get('excerpt') as string) || '');
                // Get author name from User relationship (via authorId)
                const authorId = post.get('authorId') as string | null;
                const authorName = authorId ? escapeXml(authorMap.get(authorId) || '') : '';
                const publishedAt = post.get('publishedAt') as number | null;
                const pubDate = publishedAt ? new Date(publishedAt).toUTCString() : '';
                const heroImage = post.get('heroImage') as { url?: string } | null;

                return `    <item>
      <title>${title}</title>
      <link>${escapeXml(siteUrl)}/blog/${escapeXml(slug)}</link>
      <guid isPermaLink="true">${escapeXml(siteUrl)}/blog/${escapeXml(slug)}</guid>
      <description>${excerpt}</description>
      ${authorName ? `<dc:creator>${authorName}</dc:creator>` : ''}
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
      ${heroImage?.url ? `<enclosure url="${escapeXml(heroImage.url)}" type="image/jpeg" />` : ''}
    </item>`;
            })
            .join('\n');

        const lastBuildDate =
            posts.length > 0
                ? new Date((posts[0].get('publishedAt') as number) || Date.now()).toUTCString()
                : new Date().toUTCString();

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(siteUrl)}/blog</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/blog/rss" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

        return new Response(rss, {
            headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }

    // ============================================================
    // SITEMAP
    // ============================================================

    async function handleBlogSitemap(context: Ctx): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = url.searchParams.get('appId') || null;
        const organizationId = await resolveTenant(context);
        const where: Record<string, unknown> = { status: 'published', contentType: { $ne: 'changelog' } };
        if (appId) where.appId = appId;
        if (organizationId !== undefined) where.organizationId = organizationId;

        const posts = await Post.where(where, {
            orderBy: 'publishedAt',
            orderDirection: 'desc',
        });

        const siteUrl = `${url.protocol}//${url.host}`;

        const escapeXml = (str: string): string =>
            str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const urls = posts
            .map((post) => {
                const slug = post.get('slug') as string;
                const updatedAt = post.get('updatedAt') as number;
                const lastmod = updatedAt ? new Date(updatedAt).toISOString().split('T')[0] : '';
                return `  <url>
    <loc>${escapeXml(siteUrl)}/blog/${escapeXml(slug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
            })
            .join('\n');

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(siteUrl)}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${urls}
</urlset>`;

        return new Response(sitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }

    // ============================================================
    // SCHEDULED POST PUBLISHING (cron handler)
    // ============================================================

    async function handleBlogPublishScheduled(context: Ctx): Promise<Response> {
        const { env, request, url } = context;

        if (!config.checkCronAuth(request, env)) {
            return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
        }

        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = url.searchParams.get('appId') || null;
        const published = await Post.publishScheduled({ appId: appId ?? undefined });

        return jsonResponse({
            published: published.length,
            posts: published.map((p) => ({
                id: p.get('id'),
                title: p.get('title'),
                slug: p.get('slug'),
            })),
        });
    }

    async function handleBlogKitchensink(context: Ctx): Promise<Response> {
        const auth = await config.requireAdmin(context);
        if (auth instanceof Response) return auth;

        if (!config.kitchensinkContent) {
            return errorResponse('Kitchensink content not configured', 404, { code: 'NOT_FOUND' });
        }

        const { env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const KITCHENSINK_CONTENT = {
            ...config.kitchensinkContent,
            time: Date.now(),
        };

        const kitchensinkPublishedAt = new Date().toISOString();

        const currentUserId = auth.session?.user?.id ?? null;
        const currentOrganizationId = resolveOrgId(context.request, auth.session?.user?.organizationId ?? null);
        const currentAppId = resolveAppId(context);

        const existing = await Post.findBySlug('kitchensink-ottablog', { appId: currentAppId });
        if (existing) {
            existing.set('title', 'The Kitchensink of Ottablog');
            existing.set(
                'excerpt',
                'A demo post showcasing every block type available in OttaEditor — use this to test rendering, styling, and export.',
            );
            existing.set('content', KITCHENSINK_CONTENT);
            existing.set('contentType', 'blog');
            existing.set('status', 'published');
            existing.set('wordCount', 200);
            // Always reassign to the requesting user so they can edit/delete it and appear as author
            if (currentUserId) {
                existing.set('userId', currentUserId);
                existing.set('authorId', currentUserId);
            }
            existing.set('organizationId', currentOrganizationId);
            existing.set('appId', currentAppId);
            if (!existing.get('publishedAt')) {
                existing.set('publishedAt', kitchensinkPublishedAt);
            }

            await existing.save();

            return jsonResponse({ status: 'upserted', id: existing.get('id'), slug: existing.get('slug') });
        }

        let post;
        try {
            post = await Post.create({
                title: 'The Kitchensink of Ottablog',
                slug: 'kitchensink-ottablog',
                excerpt:
                    'A demo post showcasing every block type available in OttaEditor — use this to test rendering, styling, and export.',
                content: KITCHENSINK_CONTENT,
                contentType: 'blog',
                status: 'published',
                publishedAt: kitchensinkPublishedAt,
                wordCount: 200,
                userId: currentUserId,
                authorId: currentUserId,
                organizationId: currentOrganizationId,
                appId: currentAppId,
            });
        } catch (error) {
            // If a concurrent request created the same slug, upsert onto that row.
            const message = error instanceof Error ? error.message : String(error);
            const isUniqueViolation = /unique|constraint|duplicate/i.test(message);
            if (isUniqueViolation) {
                const concurrent = await Post.findBySlug('kitchensink-ottablog', { appId: currentAppId });
                if (concurrent) {
                    concurrent.set('title', 'The Kitchensink of Ottablog');
                    concurrent.set(
                        'excerpt',
                        'A demo post showcasing every block type available in OttaEditor — use this to test rendering, styling, and export.',
                    );
                    concurrent.set('content', KITCHENSINK_CONTENT);
                    concurrent.set('contentType', 'blog');
                    concurrent.set('status', 'published');
                    concurrent.set('wordCount', 200);
                    if (currentUserId) {
                        concurrent.set('userId', currentUserId);
                        concurrent.set('authorId', currentUserId);
                    }
                    concurrent.set('organizationId', currentOrganizationId);
                    concurrent.set('appId', currentAppId);
                    if (!concurrent.get('publishedAt')) {
                        concurrent.set('publishedAt', kitchensinkPublishedAt);
                    }

                    await concurrent.save();

                    return jsonResponse({
                        status: 'upserted',
                        id: concurrent.get('id'),
                        slug: concurrent.get('slug'),
                    });
                }
            }
            throw error;
        }

        return jsonResponse({ status: 'created', id: post.get('id'), slug: post.get('slug') });
    }

    /**
     * POST /posts/preview-token — mint a signed draft-preview link.
     * Gated by the editorial guard (requireContentEditor, falling back to
     * requireAdmin). 404 when no preview secret is configured.
     */
    async function handleBlogPreviewTokenMint(context: Ctx): Promise<Response> {
        const guard = config.requireContentEditor ?? config.requireAdmin;
        const auth = await guard(context);
        if (auth instanceof Response) return auth;

        const secret = config.previewTokenSecret?.(context.env);
        if (!secret) {
            return errorResponse('Preview tokens are not configured', 404, { code: 'NOT_FOUND' });
        }

        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        const body = await readJson<{ slug?: string; ttlMs?: number }>(context.request);
        const slug = body?.slug?.trim();
        if (!slug) {
            return errorResponse('slug is required', 400, { code: 'VALIDATION_ERROR' });
        }

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);

        // The post must exist in the caller's scope (any status — that is the point).
        const where: Record<string, unknown> = { slug, appId };
        if (organizationId !== undefined) where.organizationId = organizationId;
        const post = await Post.first(where);
        if (!post) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Clamp TTL to [1 minute, 7 days]; default 24h lives in signPreviewToken.
        const ttlMs =
            typeof body?.ttlMs === 'number' && Number.isFinite(body.ttlMs)
                ? Math.min(7 * 24 * 60 * 60 * 1000, Math.max(60 * 1000, body.ttlMs))
                : undefined;

        const { token, expiresAt } = await signPreviewToken(secret, { slug, appId, organizationId, ttlMs });
        return jsonResponse({
            token,
            expiresAt,
            path: `/blog/${encodeURIComponent(slug)}?preview=${encodeURIComponent(token)}`,
        });
    }

    return {
        handleBlogStudioState,
        handleBlogStudioActivateTheme,
        handleBlogStudioPluginEnable,
        handleBlogStudioPluginConfig,
        handleBlogPostsList,
        handleBlogPostBySlug,
        handleBlogPostUnlock,
        handleBlogTagBySlug,
        handleBlogCategoryBySlug,
        handleBlogSeriesBySlug,
        handleBlogRelatedPosts,
        handleBlogRssFeed,
        handleBlogSitemap,
        handleBlogPublishScheduled,
        handleBlogKitchensink,
        handleBlogPreviewTokenMint,
    };
}
