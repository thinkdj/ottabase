// ---------------------------------------------------------------------------
// Blog theme – scoped token CSS injection for blog HTML documents.
// The active blog theme row may carry sparse CSS-variable overrides (tokens);
// they apply under [data-brand-scope="blog"] so the blog "room" can diverge
// from the app shell without fighting it. Injected at the edge so first paint
// matches the client (zero FOUC), mirroring the brand-injection contract.
// Runs only on /blog document navigations — one D1 read on those paths, none
// anywhere else. No tokens (the seeded default) injects nothing.
// ---------------------------------------------------------------------------

import { OttablogTheme } from '@ottabase/ottablog';
import { blogThemeTokensToCss, type BlogThemeTokens } from '@ottabase/ottablog';
import { sanitizeCssForStyleTag } from '@ottabase/utils/sanitize';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { resolveBlogOrganizationIdCached } from '../routes/blog';
import { ensureDbConnection } from './db-utils';

/** Style-tag id shared with the client applier (BlogStudioContext replaces this element). */
export const BLOG_THEME_STYLE_ID = 'ottablog-theme-scope';

function isBlogDocumentPath(pathname: string): boolean {
    return pathname === '/blog' || pathname.startsWith('/blog/');
}

/**
 * If the response is an HTML document on a blog path and the active blog theme
 * defines tokens, inject the scoped token CSS into <head>. Returns the original
 * response untouched in every other case (non-HTML, non-blog path, no active
 * theme, no tokens, any error).
 */
export async function injectBlogThemeCss(response: Response, request: Request, env: CloudflareEnv): Promise<Response> {
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.includes('text/html') || !response.ok) return response;

    try {
        const config = getOttabaseConfig(env);
        if (!config.packages.ottablog) return response;

        const url = new URL(request.url);
        if (!isBlogDocumentPath(url.pathname)) return response;
        if (!env.OBCF_D1) return response;

        ensureDbConnection(env);

        const organizationId =
            config.features.ottablog.mode === 'org'
                ? await resolveBlogOrganizationIdCached({ request, env, url })
                : undefined;

        const activeTheme = await OttablogTheme.active({ appId: config.appId, organizationId });
        if (!activeTheme) return response;

        const tokens = activeTheme.get('tokens') as BlogThemeTokens | null;
        const css = blogThemeTokensToCss(tokens);
        if (!css) return response;

        // Defense in depth: serializer output is validated, but tokens are
        // admin-authored — run the same sanitizer every brand style tag gets.
        const safeCss = sanitizeCssForStyleTag(css);
        if (!safeCss) return response;

        const [forRead, fallback] = [response.clone(), response];
        const html = await forRead.text();

        const styleTag = `<style id="${BLOG_THEME_STYLE_ID}">${safeCss}</style>`;
        // Replacer function per the house rule for admin-authored content.
        const injectedHtml = html.replace('</head>', () => `${styleTag}\n    </head>`);

        // Same policy as brand/SEO injection: per-request-personalized HTML is
        // never served against the original asset's validators.
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
