// ---------------------------------------------------------------------------
// Blog SEO – per-post meta injection for HTML document navigations.
// For /blog/:slug documents, loads the published post and splices real
// <title>/description/canonical/OG/Twitter/JSON-LD into <head> so crawlers
// and link unfurlers see the article instead of the SPA shell.
// Piggybacks the brand-injection pipeline (runs right after it) and follows
// the same rules: clone-before-read, replacer-function splices, no-store on
// per-request-personalized HTML.
// ---------------------------------------------------------------------------

import { Post } from '@ottabase/ottablog';
import { buildPostSeoTags, extractBlogSlugFromPath, replaceDocumentTitle } from '@ottabase/ottablog/seo';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { resolveBlogOrganizationId } from '../routes/blog';
import { ensureDbConnection } from './db-utils';

/**
 * If the response is an HTML document for a blog detail path and the slug
 * resolves to a published post, inject per-post SEO meta. Returns the original
 * response untouched in every other case (non-HTML, no slug, post missing,
 * changelog content, any error).
 */
export async function injectBlogPostSeo(response: Response, request: Request, env: CloudflareEnv): Promise<Response> {
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.includes('text/html') || !response.ok) return response;

    try {
        const config = getOttabaseConfig(env);
        if (!config.packages.ottablog) return response;

        const url = new URL(request.url);
        const slug = extractBlogSlugFromPath(url.pathname);
        if (!slug) return response;

        if (!env.OBCF_D1) return response;
        ensureDbConnection(env);

        // Same discrimination as the public by-slug API: appId always; the org
        // dimension only in org mode (null = platform-owned content).
        const where: Record<string, unknown> = { slug, status: 'published', appId: config.appId };
        if (config.features.ottablog.mode === 'org') {
            where.organizationId = await resolveBlogOrganizationId({ request, env, url });
        }
        const post = await Post.first(where);
        if (!post) return response;
        // Changelog posts are hidden from /blog/* (they live at /changelog).
        if (post.get('contentType') === 'changelog') return response;

        const title = (post.get('title') as string) || '';
        if (!title) return response;

        // Author name for JSON-LD — best effort, never fails the injection.
        let authorName: string | null = null;
        try {
            const author = await post.author(['id', 'name']);
            authorName = (author?.get('name') as string) ?? null;
        } catch {
            authorName = null;
        }

        const heroImage = post.get('heroImage') as { url?: string } | null;
        const canonicalUrl = `${url.protocol}//${url.host}/blog/${encodeURIComponent(
            (post.get('slug') as string) || slug,
        )}`;

        const seoTags = buildPostSeoTags({
            title,
            excerpt: (post.get('excerpt') as string) || null,
            canonicalUrl,
            imageUrl: heroImage?.url ?? null,
            publishedAt: post.get('publishedAt') as number | string | null,
            updatedAt: post.get('updatedAt') as number | string | null,
            authorName,
            siteName: config.appName || null,
        });

        // Clone before consuming: on any later throw the untouched original
        // streams instead of a consumed body (same fix as the brand injector).
        const [forRead, fallback] = [response.clone(), response];
        let html = await forRead.text();

        // Replace the SPA's static <title>; if the document somehow has none,
        // include a title tag in the injected head block instead.
        const titled = replaceDocumentTitle(html, title);
        html = titled.html;
        const escapedTitle = titled.replaced ? null : title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const headInjection = escapedTitle ? `<title>${escapedTitle}</title>\n    ${seoTags}` : seoTags;

        // Replacer FUNCTION, not a replacement string: author-authored titles
        // and excerpts may carry $-sequences.
        const injectedHtml = html.replace('</head>', () => `${headInjection}\n    </head>`);

        // Per-request-personalized HTML must never be cached against the
        // original asset's validators (same policy as brand injection).
        const headers = new Headers(fallback.headers);
        headers.delete('ETag');
        headers.delete('Last-Modified');
        headers.set('Cache-Control', 'no-store');

        return new Response(injectedHtml, {
            status: fallback.status,
            statusText: fallback.statusText,
            headers,
        });
    } catch {
        return response;
    }
}
