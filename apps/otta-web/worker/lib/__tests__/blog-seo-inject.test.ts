import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPostFirst, mockSettingsFor, mockGetOttabaseConfig, mockEnsureDbConnection, mockFindOrgBySlug } = vi.hoisted(
    () => ({
        mockPostFirst: vi.fn(),
        mockSettingsFor: vi.fn(),
        mockGetOttabaseConfig: vi.fn(),
        mockEnsureDbConnection: vi.fn(),
        mockFindOrgBySlug: vi.fn(),
    }),
);

vi.mock('@ottabase/ottablog', () => ({
    Post: { first: mockPostFirst },
    OttablogSettings: { forBlog: mockSettingsFor },
}));

vi.mock('@ottabase/ottaorm', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ottaorm')>()),
    Organization: { findBySlug: mockFindOrgBySlug },
}));

vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: mockGetOttabaseConfig,
}));

vi.mock('../db-utils', () => ({
    ensureDbConnection: mockEnsureDbConnection,
}));

import { injectBlogPostSeo } from '../blog-seo-inject';

const HTML = '<html><head><title>App Shell</title></head><body>SPA</body></html>';

function htmlResponse(body = HTML, headers: Record<string, string> = {}) {
    return new Response(body, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"asset-v1"', ...headers },
    });
}

function requestFor(url: string) {
    return new Request(url, { headers: { Accept: 'text/html' } });
}

function fakePost(fields: Record<string, unknown>) {
    return {
        get: (key: string) => fields[key] ?? null,
        author: vi.fn(async () => ({ get: (k: string) => (k === 'name' ? 'Ada' : 'u1') })),
    };
}

const env = { OBCF_D1: {} } as any;

const CONFIG = {
    appId: 'otta-web',
    appName: 'Ottabase Demo',
    packages: { ottablog: true },
    features: { ottablog: { orgBlogs: true } },
};

describe('injectBlogPostSeo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOttabaseConfig.mockReturnValue(CONFIG);
        mockFindOrgBySlug.mockResolvedValue({ id: 'org-1', slug: 'acme', name: 'Acme', status: 'active' });
        mockPostFirst.mockResolvedValue(
            fakePost({
                title: 'Hello World',
                slug: 'hello-world',
                excerpt: 'A first post',
                contentType: 'blog',
                publishedAt: 1700000000000,
                updatedAt: 1700000100000,
                heroImage: { url: 'https://img.test/hero.jpg' },
            }),
        );
    });

    it('injects title, meta, and JSON-LD for a published post document', async () => {
        const response = await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blog/hello-world'), env);

        const html = await response.text();
        expect(html).toContain('<title>Hello World</title>');
        expect(html).not.toContain('<title>App Shell</title>');
        expect(html).toContain('meta name="description" content="A first post"');
        expect(html).toContain('rel="canonical" href="https://demo.test/blog/hello-world"');
        expect(html).toContain('og:image');
        expect(html).toContain('application/ld+json');
        expect(mockPostFirst).toHaveBeenCalledWith(
            expect.objectContaining({ slug: 'hello-world', status: 'published', appId: 'otta-web' }),
        );
    });

    it('uses the blurb text and SocialMediaPosting metadata for thoughts', async () => {
        mockPostFirst.mockResolvedValue(
            fakePost({
                title: 'Internal generated title',
                slug: 'blurb-1',
                excerpt: 'Short fallback',
                blurbText: 'Watched xyz today. It stayed with me.',
                contentType: 'blurb',
                publishedAt: 1700000000000,
            }),
        );

        const response = await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blog/blurb-1'), env);
        const html = await response.text();

        expect(html).toContain('<title>Thought by Ada</title>');
        expect(html).toContain('content="Watched xyz today. It stayed with me."');
        expect(html).toContain('"@type":"SocialMediaPosting"');
        expect(html).not.toContain('<title>Internal generated title</title>');
    });

    it('uses the field note and ordered CollectionPage metadata for photo journals', async () => {
        mockPostFirst.mockResolvedValue(
            fakePost({
                title: 'Kyoto, in the rain',
                slug: 'kyoto-rain',
                excerpt: 'Fallback excerpt',
                photoNote: 'A quiet blue hour.',
                photoAlbum: [
                    {
                        id: 'p1',
                        url: '/media/kyoto.jpg',
                        alt: 'Lanterns reflected in a wet lane',
                        caption: 'After the last train',
                        location: 'Kyoto, Japan',
                    },
                ],
                contentType: 'photo',
                publishedAt: 1700000000000,
                heroImage: { url: 'https://img.test/kyoto.jpg' },
            }),
        );

        const response = await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blog/kyoto-rain'), env);
        const html = await response.text();

        expect(html).toContain('<title>Kyoto, in the rain</title>');
        expect(html).toContain('content="A quiet blue hour."');
        expect(html).toContain('"@type":"CollectionPage"');
        expect(html).toContain('"hasPart":[{"@type":"ImageObject"');
        expect(html).toContain('"contentUrl":"https://demo.test/media/kyoto.jpg"');
    });

    it('strips asset validators and forbids caching on injected documents', async () => {
        const response = await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blog/hello-world'), env);

        expect(response.headers.get('ETag')).toBeNull();
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('returns the original response for non-detail paths', async () => {
        for (const path of ['/blog', '/blog/tag/x', '/blogs/acme', '/blogs/acme/tag/x', '/about', '/']) {
            const original = htmlResponse();
            const result = await injectBlogPostSeo(original, requestFor(`https://demo.test${path}`), env);
            expect(result).toBe(original);
        }
        expect(mockPostFirst).not.toHaveBeenCalled();
    });

    it('returns the original response when the post is missing or is a changelog', async () => {
        mockPostFirst.mockResolvedValue(null);
        const missing = htmlResponse();
        expect(await injectBlogPostSeo(missing, requestFor('https://demo.test/blog/nope'), env)).toBe(missing);

        mockPostFirst.mockResolvedValue(fakePost({ title: 'CL', slug: 'cl', contentType: 'changelog' }));
        const changelog = htmlResponse();
        expect(await injectBlogPostSeo(changelog, requestFor('https://demo.test/blog/cl'), env)).toBe(changelog);
    });

    it('returns the original response when the response is not HTML', async () => {
        const json = new Response('{}', { headers: { 'Content-Type': 'application/json' } });
        expect(await injectBlogPostSeo(json, requestFor('https://demo.test/blog/hello-world'), env)).toBe(json);
    });

    it('reads a site blog post from the site blog only', async () => {
        await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blog/hello-world'), env);

        expect(mockPostFirst).toHaveBeenCalledWith({
            slug: 'hello-world',
            status: 'published',
            appId: 'otta-web',
            organizationId: null,
        });
        expect(mockFindOrgBySlug).not.toHaveBeenCalled();
    });

    it("reads an organization blog post from that organization's blog, with its own canonical URL", async () => {
        const html = await (
            await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blogs/acme/hello-world'), env)
        ).text();

        expect(mockFindOrgBySlug).toHaveBeenCalledWith('acme');
        expect(mockPostFirst).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
        expect(html).toContain('https://demo.test/blogs/acme/hello-world');
    });

    it('serves no organization blog when they are off, or the organization is unknown or inactive', async () => {
        mockGetOttabaseConfig.mockReturnValue({ ...CONFIG, features: { ottablog: { orgBlogs: false } } });
        const off = htmlResponse();
        expect(await injectBlogPostSeo(off, requestFor('https://demo.test/blogs/acme/hello-world'), env)).toBe(off);

        mockGetOttabaseConfig.mockReturnValue(CONFIG);
        mockFindOrgBySlug.mockResolvedValue(undefined);
        const unknown = htmlResponse();
        expect(await injectBlogPostSeo(unknown, requestFor('https://demo.test/blogs/nope/hello-world'), env)).toBe(
            unknown,
        );

        mockFindOrgBySlug.mockResolvedValue({ id: 'org-2', slug: 'gone', name: 'Gone', status: 'suspended' });
        const inactive = htmlResponse();
        expect(await injectBlogPostSeo(inactive, requestFor('https://demo.test/blogs/gone/hello-world'), env)).toBe(
            inactive,
        );
        expect(mockPostFirst).not.toHaveBeenCalled();
    });

    it('survives author-authored $-sequences and HTML in titles', async () => {
        mockPostFirst.mockResolvedValue(
            fakePost({
                title: `$' </head> <script>alert(1)</script>`,
                slug: 'evil',
                excerpt: null,
                contentType: 'blog',
            }),
        );

        const response = await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blog/evil'), env);
        const html = await response.text();

        expect(html).not.toContain('<script>alert');
        // Document structure intact: exactly one closing head, body untouched.
        expect(html.match(/<\/head>/g)).toHaveLength(1);
        expect(html).toContain('<body>SPA</body>');
    });

    it('returns the original response when the post lookup throws', async () => {
        mockPostFirst.mockRejectedValue(new Error('d1 down'));
        const original = htmlResponse();
        const result = await injectBlogPostSeo(original, requestFor('https://demo.test/blog/hello-world'), env);
        expect(result).toBe(original);
        expect(await result.text()).toContain('App Shell');
    });

    describe('locked (invite-only) posts', () => {
        const locked = (fields: Record<string, unknown> = {}) =>
            fakePost({
                title: 'A letter to my father',
                slug: 'a-letter',
                excerpt: 'Some things I never said.',
                contentType: 'blog',
                heroImage: { url: 'https://img.test/private.jpg' },
                lockKey: '|c-life|',
                ...fields,
            });
        const teaser = (fields: string[]) => mockSettingsFor.mockResolvedValue({ lockedTeaser: () => fields });

        it('injects nothing when teasers are off', async () => {
            mockPostFirst.mockResolvedValue(locked());
            teaser([]);
            const original = htmlResponse();

            const response = await injectBlogPostSeo(original, requestFor('https://demo.test/blog/a-letter'), env);

            expect(response).toBe(original);
        });

        it('injects only the teaser fields the blog allows', async () => {
            mockPostFirst.mockResolvedValue(locked());
            teaser(['title']);

            const html = await (
                await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blog/a-letter'), env)
            ).text();

            expect(html).toContain('<title>A letter to my father</title>');
            expect(html).not.toContain('Some things I never said.');
            expect(html).not.toContain('private.jpg');
        });

        it('never teases a locked blurb (its title is its text)', async () => {
            mockPostFirst.mockResolvedValue(locked({ contentType: 'blurb', blurbText: 'private thought' }));
            teaser(['title', 'excerpt']);
            const original = htmlResponse();

            expect(await injectBlogPostSeo(original, requestFor('https://demo.test/blog/a-letter'), env)).toBe(
                original,
            );
        });
    });
});
