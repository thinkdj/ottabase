import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockThemeActive, mockGetOttabaseConfig, mockEnsureDbConnection, mockFindOrgBySlug, mockSanitize } = vi.hoisted(
    () => ({
        mockThemeActive: vi.fn(),
        mockGetOttabaseConfig: vi.fn(),
        mockEnsureDbConnection: vi.fn(),
        mockFindOrgBySlug: vi.fn(),
        mockSanitize: vi.fn((css: string) => css),
    }),
);

vi.mock('@ottabase/ottablog', async () => {
    const actual = await vi.importActual<typeof import('@ottabase/ottablog')>('@ottabase/ottablog');
    return {
        OttablogTheme: { active: mockThemeActive },
        blogThemeTokensToCss: actual.blogThemeTokensToCss,
    };
});

vi.mock('@ottabase/utils/sanitize', () => ({
    sanitizeCssForStyleTag: mockSanitize,
}));

vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: mockGetOttabaseConfig,
}));

vi.mock('../db-utils', () => ({
    ensureDbConnection: mockEnsureDbConnection,
}));

vi.mock('@ottabase/ottaorm', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ottaorm')>()),
    Organization: { findBySlug: mockFindOrgBySlug },
}));

import { BLOG_THEME_STYLE_ID, injectBlogThemeCss } from '../blog-theme-inject';

const HTML = '<html><head><title>App</title></head><body>SPA</body></html>';

function htmlResponse() {
    return new Response(HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"v1"' },
    });
}

const env = { OBCF_D1: {} } as any;

const CONFIG = {
    appId: 'otta-web',
    packages: { ottablog: true },
    features: { ottablog: { orgBlogs: true } },
};

function themeRow(tokens: unknown) {
    return { get: (k: string) => (k === 'tokens' ? tokens : null) };
}

describe('injectBlogThemeCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSanitize.mockImplementation((css: string) => css);
        mockGetOttabaseConfig.mockReturnValue(CONFIG);
        mockFindOrgBySlug.mockResolvedValue({ id: 'org-1', slug: 'acme', name: 'Acme', status: 'active' });
        mockThemeActive.mockResolvedValue(themeRow({ light: { '--primary': '265 89% 66%' } }));
    });

    it('injects scoped token CSS on blog documents', async () => {
        const response = await injectBlogThemeCss(htmlResponse(), new Request('https://x.test/blog'), env);
        const html = await response.text();

        expect(html).toContain(`id="${BLOG_THEME_STYLE_ID}"`);
        expect(html).toContain('[data-brand-scope="blog"]');
        expect(html).toContain('--primary: 265 89% 66%;');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('ETag')).toBeNull();
    });

    it('does nothing for non-blog paths or when the theme has no tokens', async () => {
        const original = htmlResponse();
        expect(await injectBlogThemeCss(original, new Request('https://x.test/about'), env)).toBe(original);

        mockThemeActive.mockResolvedValue(themeRow(null));
        const noTokens = htmlResponse();
        expect(await injectBlogThemeCss(noTokens, new Request('https://x.test/blog/post'), env)).toBe(noTokens);
    });

    it("uses the site blog's theme on /blog and the organization's own on /blogs/{org}", async () => {
        await injectBlogThemeCss(htmlResponse(), new Request('https://x.test/blog'), env);
        expect(mockThemeActive).toHaveBeenLastCalledWith({ appId: 'otta-web', organizationId: null });

        await injectBlogThemeCss(htmlResponse(), new Request('https://x.test/blogs/acme/a-post'), env);
        expect(mockFindOrgBySlug).toHaveBeenCalledWith('acme');
        expect(mockThemeActive).toHaveBeenLastCalledWith({ appId: 'otta-web', organizationId: 'org-1' });
    });

    it('injects nothing for an organization blog that is not served', async () => {
        mockFindOrgBySlug.mockResolvedValue(undefined);
        const original = htmlResponse();
        expect(await injectBlogThemeCss(original, new Request('https://x.test/blogs/nope'), env)).toBe(original);
        expect(mockThemeActive).not.toHaveBeenCalled();
    });

    it('returns the original response when the sanitizer strips everything or a lookup throws', async () => {
        mockSanitize.mockReturnValue('');
        const stripped = htmlResponse();
        expect(await injectBlogThemeCss(stripped, new Request('https://x.test/blog'), env)).toBe(stripped);

        mockSanitize.mockImplementation((css: string) => css);
        mockThemeActive.mockRejectedValue(new Error('d1 down'));
        const errored = htmlResponse();
        expect(await injectBlogThemeCss(errored, new Request('https://x.test/blog'), env)).toBe(errored);
    });
});
