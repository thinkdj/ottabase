/**
 * Per-post SEO meta for edge injection — pure, React-free builders.
 *
 * The app's worker detects a blog detail document navigation, loads the
 * published post, and splices `buildPostSeoTags(...)` into `<head>` so
 * crawlers and link unfurlers see real metadata instead of the SPA shell.
 * Everything here is escaping-first: titles/excerpts are author-authored
 * free text and must never break out of an attribute or script tag.
 */

/** Escape a string for use inside an HTML attribute or text node. */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Serialize JSON for embedding inside a <script> tag. Escapes the characters
 * that could close the tag or corrupt the document (`<`, `>`, `&`) plus the
 * JS line separators U+2028/U+2029 — same treatment as the brand hydration
 * payload.
 */
export function jsonForScriptTag(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

/**
 * Extract the post slug from a blog detail pathname.
 * Matches exactly `<basePath>/<slug>` — `/blog` itself and deeper paths like
 * `/blog/tag/x` (archive routes) return null. The returned slug is decoded.
 */
export function extractBlogSlugFromPath(pathname: string, basePath = '/blog'): string | null {
    const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    if (!pathname.startsWith(`${base}/`)) return null;
    const rest = pathname.slice(base.length + 1);
    if (!rest || rest.includes('/')) return null;
    try {
        return decodeURIComponent(rest);
    } catch {
        return null;
    }
}

export interface PostSeoInput {
    title: string;
    /** Plain-text summary; used for description, OG, and JSON-LD. */
    excerpt?: string | null;
    /** Absolute canonical URL of the post page. */
    canonicalUrl: string;
    /** Absolute URL of the hero/OG image, if any. */
    imageUrl?: string | null;
    /** Publish timestamp (ms epoch or ISO string). */
    publishedAt?: number | string | null;
    /** Last-modified timestamp (ms epoch or ISO string). */
    updatedAt?: number | string | null;
    authorName?: string | null;
    /** Site/app name for og:site_name. */
    siteName?: string | null;
    tags?: string[];
}

function toIso(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Build the `<head>` block for a blog post: description, canonical, OpenGraph,
 * Twitter card, and an Article JSON-LD script. Returns fully escaped HTML.
 * The document `<title>` is handled separately (it usually needs a REPLACE of
 * the SPA's static tag, not an append) — see `replaceDocumentTitle`.
 */
export function buildPostSeoTags(input: PostSeoInput): string {
    const title = escapeHtml(input.title);
    const description = input.excerpt ? escapeHtml(input.excerpt) : null;
    const canonical = escapeHtml(input.canonicalUrl);
    const image = input.imageUrl && /^https?:\/\//.test(input.imageUrl) ? escapeHtml(input.imageUrl) : null;
    const publishedIso = toIso(input.publishedAt);
    const modifiedIso = toIso(input.updatedAt);

    const lines: string[] = [];

    if (description) lines.push(`<meta name="description" content="${description}" data-blog-seo>`);
    lines.push(`<link rel="canonical" href="${canonical}" data-blog-seo>`);

    // OpenGraph
    lines.push(`<meta property="og:type" content="article" data-blog-seo>`);
    lines.push(`<meta property="og:title" content="${title}" data-blog-seo>`);
    if (description) lines.push(`<meta property="og:description" content="${description}" data-blog-seo>`);
    lines.push(`<meta property="og:url" content="${canonical}" data-blog-seo>`);
    if (input.siteName)
        lines.push(`<meta property="og:site_name" content="${escapeHtml(input.siteName)}" data-blog-seo>`);
    if (image) lines.push(`<meta property="og:image" content="${image}" data-blog-seo>`);
    if (publishedIso) lines.push(`<meta property="article:published_time" content="${publishedIso}" data-blog-seo>`);
    if (modifiedIso) lines.push(`<meta property="article:modified_time" content="${modifiedIso}" data-blog-seo>`);
    for (const tag of input.tags ?? []) {
        lines.push(`<meta property="article:tag" content="${escapeHtml(tag)}" data-blog-seo>`);
    }

    // Twitter card
    lines.push(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" data-blog-seo>`);
    lines.push(`<meta name="twitter:title" content="${title}" data-blog-seo>`);
    if (description) lines.push(`<meta name="twitter:description" content="${description}" data-blog-seo>`);
    if (image) lines.push(`<meta name="twitter:image" content="${image}" data-blog-seo>`);

    // Article JSON-LD
    const jsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.title,
        url: input.canonicalUrl,
    };
    if (input.excerpt) jsonLd.description = input.excerpt;
    if (image) jsonLd.image = [input.imageUrl];
    if (publishedIso) jsonLd.datePublished = publishedIso;
    if (modifiedIso) jsonLd.dateModified = modifiedIso;
    if (input.authorName) jsonLd.author = { '@type': 'Person', name: input.authorName };
    lines.push(`<script type="application/ld+json" data-blog-seo>${jsonForScriptTag(jsonLd)}</script>`);

    return lines.join('\n    ');
}

/**
 * Replace the document's static `<title>` with the post title, or return the
 * HTML unchanged when no title tag exists (the caller then appends one via the
 * head injection). Uses a replacer function so author-authored titles with `$`
 * sequences can never be expanded as replacement patterns.
 */
export function replaceDocumentTitle(html: string, title: string): { html: string; replaced: boolean } {
    const escaped = escapeHtml(title);
    let replaced = false;
    const next = html.replace(/<title>[\s\S]*?<\/title>/i, () => {
        replaced = true;
        return `<title>${escaped}</title>`;
    });
    return { html: next, replaced };
}
