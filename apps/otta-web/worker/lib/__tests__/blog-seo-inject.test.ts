import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPostFirst, mockGetOttabaseConfig, mockEnsureDbConnection, mockResolveBlogOrganizationId } = vi.hoisted(
    () => ({
        mockPostFirst: vi.fn(),
        mockGetOttabaseConfig: vi.fn(),
        mockEnsureDbConnection: vi.fn(),
        mockResolveBlogOrganizationId: vi.fn(),
    }),
);

vi.mock('@ottabase/ottablog', () => ({
    Post: { first: mockPostFirst },
}));

vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: mockGetOttabaseConfig,
}));

vi.mock('../db-utils', () => ({
    ensureDbConnection: mockEnsureDbConnection,
}));

vi.mock('../../routes/blog', () => ({
    resolveBlogOrganizationId: mockResolveBlogOrganizationId,
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

const PLATFORM_CONFIG = {
    appId: 'otta-web',
    appName: 'Ottabase Demo',
    packages: { ottablog: true },
    features: { ottablog: { mode: 'platform' } },
};

describe('injectBlogPostSeo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOttabaseConfig.mockReturnValue(PLATFORM_CONFIG);
        mockResolveBlogOrganizationId.mockResolvedValue(null);
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
        // Platform mode: no org dimension in the lookup, resolver never called.
        const where = mockPostFirst.mock.calls[0][0];
        expect('organizationId' in where).toBe(false);
        expect(mockResolveBlogOrganizationId).not.toHaveBeenCalled();
    });

    it('strips asset validators and forbids caching on injected documents', async () => {
        const response = await injectBlogPostSeo(htmlResponse(), requestFor('https://demo.test/blog/hello-world'), env);

        expect(response.headers.get('ETag')).toBeNull();
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('returns the original response for non-detail paths', async () => {
        for (const path of ['/blog', '/blog/tag/x', '/about', '/']) {
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

    it('returns the original response when ottablog is disabled or the response is not HTML', async () => {
        mockGetOttabaseConfig.mockReturnValue({ ...PLATFORM_CONFIG, packages: { ottablog: false } });
        const gated = htmlResponse();
        expect(await injectBlogPostSeo(gated, requestFor('https://demo.test/blog/hello-world'), env)).toBe(gated);

        mockGetOttabaseConfig.mockReturnValue(PLATFORM_CONFIG);
        const json = new Response('{}', { headers: { 'Content-Type': 'application/json' } });
        expect(await injectBlogPostSeo(json, requestFor('https://demo.test/blog/hello-world'), env)).toBe(json);
    });

    it('scopes the lookup by organization in org mode', async () => {
        mockGetOttabaseConfig.mockReturnValue({
            ...PLATFORM_CONFIG,
            features: { ottablog: { mode: 'org' } },
        });
        mockResolveBlogOrganizationId.mockResolvedValue('org-1');

        await injectBlogPostSeo(htmlResponse(), requestFor('https://acme.demo.test/blog/hello-world'), env);

        expect(mockPostFirst).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
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
});
