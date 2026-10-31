import { describe, expect, it } from 'vitest';
import { buildPostSeoTags, escapeHtml, extractBlogSlugFromPath, jsonForScriptTag, replaceDocumentTitle } from '../seo';
import { configureMedia } from '@ottabase/utils/media';

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
            image: 'https://img.test/hero.jpg',
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
        const tags = buildPostSeoTags({ ...base, image: 'javascript:alert(1)' });
        expect(tags).toContain('<meta name="twitter:card" content="summary"');
        expect(tags).not.toContain('og:image');
    });

    it('resolves application-relative media URLs against the canonical origin', () => {
        const tags = buildPostSeoTags({ ...base, image: '/media/hero.jpg' });
        expect(tags).toContain('<meta property="og:image" content="https://x.test/media/hero.jpg"');
        expect(tags).toContain('"image":["https://x.test/media/hero.jpg"]');
    });

    it('gives a stored file as the absolute URL of its original, never a WebP rendition', () => {
        const key = `app/media/${'c'.repeat(32)}.jpg`;
        configureMedia({ publicUrl: 'https://files.x.test' });
        try {
            const tags = buildPostSeoTags({ ...base, image: { key, variants: ['thumb', 'card', 'full'] } });
            expect(tags).toContain(`<meta property="og:image" content="https://files.x.test/${key}"`);
            expect(tags).toContain(`<meta name="twitter:image" content="https://files.x.test/${key}"`);
            expect(tags).toContain(`"image":["https://files.x.test/${key}"]`);
            expect(tags).not.toContain('.webp');
        } finally {
            configureMedia({});
        }
        // With the app-relative default base, it still resolves to an absolute URL.
        expect(buildPostSeoTags({ ...base, image: { key } })).toContain(
            `<meta property="og:image" content="https://x.test/api/files/public/${key}"`,
        );
    });

    it('omits date meta for invalid timestamps', () => {
        const tags = buildPostSeoTags({ ...base, publishedAt: 'not-a-date' });
        expect(tags).not.toContain('article:published_time');
    });

    it('uses SocialMediaPosting structured data for blurbs', () => {
        const tags = buildPostSeoTags({ ...base, contentType: 'blurb' });
        expect(tags).toContain('"@type":"SocialMediaPosting"');
        expect(tags).not.toContain('"@type":"Article"');
    });

    it('describes photo journals as an ordered image collection', () => {
        const tags = buildPostSeoTags({
            ...base,
            contentType: 'photo',
            photoAlbum: [
                {
                    image: '/media/kyoto-rain.jpg',
                    alt: 'Lanterns reflected in a wet Kyoto lane',
                    caption: 'After the last train',
                    location: 'Kyoto, Japan',
                    takenAt: '2026-05-12T18:00:00.000Z',
                },
                { image: { key: `app/media/${'d'.repeat(32)}.jpg`, width: 1800, height: 1200 } },
            ],
        });

        expect(tags).toContain('"@type":"CollectionPage"');
        expect(tags).toContain('"hasPart":[{"@type":"ImageObject"');
        expect(tags).toContain('"contentUrl":"https://x.test/media/kyoto-rain.jpg"');
        expect(tags).toContain('"contentLocation":{"@type":"Place","name":"Kyoto, Japan"}');
        expect(tags).toContain('"representativeOfPage":true');
        // A stored photograph carries its own size.
        expect(tags).toContain(
            `"contentUrl":"https://x.test/api/files/public/app/media/${'d'.repeat(32)}.jpg","position":2,"width":1800,"height":1200`,
        );
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
