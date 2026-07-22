import { describe, expect, it } from 'vitest';
import { buildPostSeoTags, escapeHtml, extractBlogSlugFromPath, jsonForScriptTag, replaceDocumentTitle } from '../seo';

describe('extractBlogSlugFromPath', () => {
    it('extracts the slug from a detail path', () => {
        expect(extractBlogSlugFromPath('/blog/hello-world')).toBe('hello-world');
    });

    it('decodes percent-encoded slugs', () => {
        expect(extractBlogSlugFromPath('/blog/hello%20world')).toBe('hello world');
    });

    it('returns null for the list page, archives, and deeper paths', () => {
        expect(extractBlogSlugFromPath('/blog')).toBeNull();
        expect(extractBlogSlugFromPath('/blog/')).toBeNull();
        expect(extractBlogSlugFromPath('/blog/tag/x')).toBeNull();
        expect(extractBlogSlugFromPath('/blog/category/x')).toBeNull();
        expect(extractBlogSlugFromPath('/blog/series/x')).toBeNull();
        expect(extractBlogSlugFromPath('/other/hello')).toBeNull();
    });

    it('returns null for malformed percent-encoding instead of throwing', () => {
        expect(extractBlogSlugFromPath('/blog/%E0%A4%A')).toBeNull();
    });

    it('honors a custom base path', () => {
        expect(extractBlogSlugFromPath('/news/story-1', '/news')).toBe('story-1');
        expect(extractBlogSlugFromPath('/blog/story-1', '/news')).toBeNull();
    });
});

describe('buildPostSeoTags', () => {
    const base = {
        title: 'Hello World',
        excerpt: 'A first post',
        canonicalUrl: 'https://x.test/blog/hello-world',
    };

    it('emits description, canonical, OG, Twitter, and JSON-LD', () => {
        const tags = buildPostSeoTags({
            ...base,
            imageUrl: 'https://img.test/hero.jpg',
            publishedAt: 1700000000000,
            updatedAt: 1700000100000,
            authorName: 'Ada',
            siteName: 'My App',
            tags: ['edge', 'blog'],
        });

        expect(tags).toContain('<meta name="description" content="A first post"');
        expect(tags).toContain('<link rel="canonical" href="https://x.test/blog/hello-world"');
        expect(tags).toContain('<meta property="og:type" content="article"');
        expect(tags).toContain('<meta property="og:image" content="https://img.test/hero.jpg"');
        expect(tags).toContain('<meta property="og:site_name" content="My App"');
        expect(tags).toContain('article:published_time');
        expect(tags).toContain('<meta property="article:tag" content="edge"');
        expect(tags).toContain('<meta name="twitter:card" content="summary_large_image"');
        expect(tags).toContain('application/ld+json');
        expect(tags).toContain('"@type":"Article"');
        expect(tags).toContain('"author":{"@type":"Person","name":"Ada"}');
    });

    it('escapes author-authored text so it cannot break out of attributes', () => {
        const tags = buildPostSeoTags({
            ...base,
            title: '"><script>alert(1)</script>',
            excerpt: 'x" onmouseover="evil()',
        });

        expect(tags).not.toContain('<script>alert');
        expect(tags).toContain('&quot;&gt;&lt;script&gt;');
        expect(tags).toContain('x&quot; onmouseover=&quot;evil()');
    });

    it('escapes JSON-LD so </script> in a title cannot close the tag', () => {
        const tags = buildPostSeoTags({ ...base, title: 'x</script><img src=x>' });
        const jsonLd = tags.slice(tags.indexOf('application/ld+json'));
        expect(jsonLd).not.toContain('</script><img');
        expect(jsonLd).toContain('\\u003c/script\\u003e');
    });

    it('uses summary card and omits image tags when there is no valid image', () => {
        const tags = buildPostSeoTags({ ...base, imageUrl: 'javascript:alert(1)' });
        expect(tags).toContain('<meta name="twitter:card" content="summary"');
        expect(tags).not.toContain('og:image');
    });

    it('omits date meta for invalid timestamps', () => {
        const tags = buildPostSeoTags({ ...base, publishedAt: 'not-a-date' });
        expect(tags).not.toContain('article:published_time');
    });
});

describe('replaceDocumentTitle', () => {
    it('replaces an existing title and reports it', () => {
        const { html, replaced } = replaceDocumentTitle('<head><title>App</title></head>', 'Post Title');
        expect(replaced).toBe(true);
        expect(html).toContain('<title>Post Title</title>');
        expect(html).not.toContain('<title>App</title>');
    });

    it('does not expand $-sequences in titles', () => {
        const { html } = replaceDocumentTitle('<head><title>App</title>REST</head>', `$' $\` $$`);
        // `$'` would splice trailing content, `` $` `` leading content, `$$` a literal $ —
        // the replacer function must pass them through verbatim (escaped).
        expect(html).toContain('REST');
        expect(html).toContain(`<title>$&#39; $\` $$</title>`);
    });

    it('reports when no title tag exists', () => {
        const { html, replaced } = replaceDocumentTitle('<head></head>', 'Post');
        expect(replaced).toBe(false);
        expect(html).toBe('<head></head>');
    });
});

describe('escapeHtml / jsonForScriptTag', () => {
    it('escapes the five HTML-significant characters', () => {
        expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    });

    it('escapes script-breaking characters and JS line separators in JSON', () => {
        const out = jsonForScriptTag({ a: '</script>', b: '\u2028\u2029' });
        expect(out).not.toContain('</script>');
        expect(out).toContain('\\u003c');
        expect(out).toContain('\\u2028');
        expect(out).toContain('\\u2029');
    });
});
