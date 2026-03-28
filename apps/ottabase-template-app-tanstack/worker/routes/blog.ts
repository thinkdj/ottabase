import { verifyPassword } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import {
    OttablogPlugin,
    OttablogTheme,
    Post,
    PostCategory,
    PostCategoryLink,
    PostSeries,
    PostTag,
    PostTagLink,
    StudioManager,
} from '@ottabase/ottablog';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { readJson } from '../lib/utils';

export interface BlogRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

function ensureD1(env: CloudflareEnv): Response | null {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }
    return null;
}

/**
 * Convert a Post model to a public-safe JSON object.
 * Strips privateNotes. Strips content from protected posts unless explicitly included.
 * Optionally enriches with tags and category name.
 */
async function publicPostJson(
    record: Post,
    options?: { includeContent?: boolean; enrichTags?: boolean; enrichCategory?: boolean; enrichSeries?: boolean },
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

export async function handleBlogStudioState(context: BlogRouteContext): Promise<Response> {
    const { request, env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId: string | null = null;
    const state = await StudioManager.getState(appId);

    if (state.themes.length === 0) {
        await OttablogTheme.create({
            themeId: 'default',
            name: 'Default',
            description: 'Clean, modern default theme with dark mode support',
            version: '1.0.0',
            appId,
            isActive: true,
        });
        await OttablogTheme.create({
            themeId: 'minimal',
            name: 'Minimal',
            description: 'Clean, minimalist theme focused on typography and readability',
            version: '1.0.0',
            author: 'Ottabase',
            appId,
            isActive: false,
        });
    }
    if (state.plugins.length === 0) {
        await OttablogPlugin.create({
            pluginId: 'content-injector-plugin',
            name: 'Content Injector Plugin',
            description: 'Injects custom content into posts',
            appId,
            enabled: false,
        });
    }

    const finalState = await StudioManager.getState(appId);
    return jsonResponse(finalState);
}

export async function handleBlogStudioActivateTheme(context: BlogRouteContext): Promise<Response> {
    const { request, env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId: string | null = null;
    const body = await readJson<{ themeId: string }>(request);
    const themeId = body?.themeId;
    if (!themeId) {
        return errorResponse('themeId is required', 400, { code: 'VALIDATION_ERROR' });
    }

    let themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined });
    if (!themeRow) {
        await OttablogTheme.create({
            themeId,
            name: themeId,
            appId,
            isActive: false,
        });
        themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined });
    }
    if (themeRow) {
        await themeRow.activate({ appId: appId ?? undefined });
    }
    return jsonResponse({ success: true });
}

export async function handleBlogStudioPluginEnable(context: BlogRouteContext): Promise<Response> {
    const { request, env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId: string | null = null;
    const body = await readJson<{ pluginId: string; enabled: boolean }>(request);
    const pluginId = body?.pluginId;
    const enabled = body?.enabled ?? true;

    if (!pluginId) {
        return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
    }

    let pluginRow = await OttablogPlugin.findByPluginId(pluginId, { appId: appId ?? undefined });
    if (!pluginRow) {
        await OttablogPlugin.create({
            pluginId,
            name: pluginId,
            appId,
            enabled,
        });
    } else {
        pluginRow.set('enabled', enabled);
        await pluginRow.save();
    }
    return jsonResponse({ success: true });
}

export async function handleBlogStudioPluginConfig(context: BlogRouteContext): Promise<Response> {
    const { request, env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId: string | null = null;
    const body = await readJson<{ pluginId: string; config: Record<string, unknown> }>(request);
    const pluginId = body?.pluginId;
    const config = body?.config;

    if (!pluginId) {
        return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
    }

    const pluginRow = await OttablogPlugin.findByPluginId(pluginId, { appId: appId ?? undefined });
    if (!pluginRow) {
        return errorResponse('Plugin not found', 404, { code: 'NOT_FOUND' });
    }

    await pluginRow.updateConfig(config ?? {});
    return jsonResponse({ success: true });
}

export async function handleBlogPostsList(context: BlogRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

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

    const where: Record<string, unknown> = { status: 'published' };
    if (appId) where.appId = appId;
    if (contentType) {
        where.contentType = contentType;
    } else {
        // Dedicated changelog lives at /changelog (changelog_entries); keep blog list blog-only
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

    // Enrich all posts with tags and category name
    const data = await Promise.all(
        result.data.map((r) =>
            publicPostJson(r as Post, { enrichTags: true, enrichCategory: true, enrichSeries: true }),
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

export async function handleBlogPostBySlug(context: BlogRouteContext, slug: string): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;
    const where: Record<string, unknown> = { slug, status: 'published' };
    if (appId) where.appId = appId;
    const record = await Post.first(where);
    if (!record) {
        return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
    }

    if (record.get('contentType') === 'changelog') {
        return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
    }

    // View tracking disabled by default (D1 write cost per view).
    // Call POST /api/blog/posts/:slug/track-view explicitly when needed.

    const data = await publicPostJson(record, {
        enrichTags: true,
        enrichCategory: true,
        enrichSeries: true,
    });
    return jsonResponse(data);
}

export async function handleBlogPostUnlock(context: BlogRouteContext): Promise<Response> {
    const { request, env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{ slug: string; password: string }>(request);
    const slug = body?.slug?.trim();
    const password = body?.password;

    if (!slug || password === undefined || password === null) {
        return errorResponse('slug and password are required', 400, { code: 'VALIDATION_ERROR' });
    }

    const appId = url.searchParams.get('appId') || null;
    const where: Record<string, unknown> = { slug, status: 'published' };
    if (appId) where.appId = appId;
    const record = await Post.first(where);
    if (!record) {
        return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
    }

    if (record.get('contentType') === 'changelog') {
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
        });
        return jsonResponse(data);
    }

    const valid = await verifyPassword(String(password), String(passwordHash));
    if (!valid) {
        return errorResponse('Invalid password', 401, { code: 'INVALID_PASSWORD' });
    }

    const data = await publicPostJson(record, {
        includeContent: true,
        enrichTags: true,
        enrichCategory: true,
        enrichSeries: true,
    });
    return jsonResponse(data);
}

// ============================================================
// ARCHIVE PAGES: tag, category, series by slug
// ============================================================

/**
 * GET /api/blog/tags/by-slug/:slug
 * Returns tag details by slug.
 */
export async function handleBlogTagBySlug(context: BlogRouteContext, slug: string): Promise<Response> {
    const { env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const tag = await PostTag.first({ slug });
    if (!tag) {
        return errorResponse('Tag not found', 404, { code: 'NOT_FOUND' });
    }
    return jsonResponse(tag.toJson());
}

/**
 * GET /api/blog/categories/by-slug/:slug
 * Returns category details by slug.
 */
export async function handleBlogCategoryBySlug(context: BlogRouteContext, slug: string): Promise<Response> {
    const { env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const category = await PostCategory.first({ slug });
    if (!category) {
        return errorResponse('Category not found', 404, { code: 'NOT_FOUND' });
    }
    return jsonResponse(category.toJson());
}

/**
 * GET /api/blog/series/by-slug/:slug
 * Returns series details by slug.
 */
export async function handleBlogSeriesBySlug(context: BlogRouteContext, slug: string): Promise<Response> {
    const { env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const series = await PostSeries.first({ slug });
    if (!series) {
        return errorResponse('Series not found', 404, { code: 'NOT_FOUND' });
    }
    return jsonResponse(series.toJson());
}

// ============================================================
// RELATED POSTS
// ============================================================

/**
 * GET /api/blog/posts/:id/related
 * Returns up to 4 posts related to the given post (same category, then content type).
 */
export async function handleBlogRelatedPosts(context: BlogRouteContext, postId: string): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;
    const limit = Math.min(10, Math.max(1, parseInt(url.searchParams.get('limit') || '4', 10)));

    const post = await Post.find(postId);
    if (!post) {
        return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
    }

    // Gather category IDs from junction table for junction-aware related lookup
    const categoryLinks = await PostCategoryLink.where({ postId });
    const categoryIds = categoryLinks.map((cl) => cl.get('categoryId') as string);

    const related = await Post.related(postId, {
        categoryId: post.get('categoryId') as string | null,
        categoryIds,
        contentType: post.get('contentType') as string,
        appId: appId ?? undefined,
        limit,
    });

    const data = await Promise.all(related.map((r) => publicPostJson(r, { enrichTags: true })));
    return jsonResponse(data);
}

// ============================================================
// RSS FEED
// ============================================================

/**
 * GET /api/blog/rss
 * Generates an RSS 2.0 XML feed of published posts.
 */
export async function handleBlogRssFeed(context: BlogRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;
    const contentType = url.searchParams.get('contentType') || null;
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));

    const where: Record<string, unknown> = { status: 'published' };
    if (appId) where.appId = appId;
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
            const authorName = escapeXml((post.get('authorName') as string) || '');
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

/**
 * GET /api/blog/sitemap.xml
 * Generates a sitemap XML for all published posts.
 */
export async function handleBlogSitemap(context: BlogRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;
    const where: Record<string, unknown> = { status: 'published', contentType: { $ne: 'changelog' } };
    if (appId) where.appId = appId;

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

/**
 * POST /api/blog/publish-scheduled
 * Publishes all posts whose scheduled publishAt time has passed.
 * Intended to be called from a cron/scheduled worker.
 */
export async function handleBlogPublishScheduled(context: BlogRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

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
