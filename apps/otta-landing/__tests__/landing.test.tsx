/**
 * The public landing app is a read-only view of the D1 rows otta-web's admin writes.
 * These tests pin its behaviour: which app's content it reads, the not-yet-set-up state,
 * published-only pages, real 404s, and server-rendered theme tokens.
 */
import { DEFAULT_PAGES, DEFAULT_SITE, parseSections } from '@ottabase/ottalanding';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: env.value }) }));
vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: (d1: unknown) => ({ d1 }) }));
vi.mock('@ottabase/ottaorm', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    registerConnection: vi.fn(),
}));

const request = vi.hoisted(() => ({ headers: new Headers({ host: 'landing.acme.test' }) }));
vi.mock('next/headers', () => ({ headers: async () => request.headers }));

const store = vi.hoisted(() => ({
    findSite: vi.fn(),
    findPage: vi.fn(),
    findPreview: vi.fn(),
    publishedPaths: vi.fn(),
    submitLead: vi.fn(),
}));
vi.mock('@ottabase/ottalanding', async (importOriginal) => {
    const real = await importOriginal<typeof import('@ottabase/ottalanding')>();
    return {
        ...real,
        LandingSite: { findForApp: store.findSite },
        LandingPage: {
            findPublished: store.findPage,
            findForPreview: store.findPreview,
            publishedPaths: store.publishedPaths,
        },
        LandingLead: { submit: store.submitLead },
    };
});
// React's per-request cache() is a no-op outside a server render; keep it transparent here.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<object>()), cache: <T,>(fn: T) => fn }));

import LandingRoute, { generateMetadata } from '../app/[[...slug]]/page';
import RootLayout, { generateMetadata as layoutMetadata } from '../app/layout';
import { POST as postLead } from '../app/api/leads/route';
import NotFound from '../app/not-found';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { DomainValidationError } from '@ottabase/ottaorm';
import { getSite, toPath } from '../lib/content';

const site = { getSettings: () => ({ ...DEFAULT_SITE, theme: 'editorial' }) };
const home = {
    toPage: () => ({ ...DEFAULT_PAGES[0], id: 'home', sections: parseSections(DEFAULT_PAGES[0].sections) }),
};
const html = (node: unknown) => renderToStaticMarkup(node as React.ReactElement);
const params = (slug?: string[], preview?: string) => ({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(preview === undefined ? {} : { preview }),
});

beforeEach(() => {
    vi.clearAllMocks();
    env.value = { OBCF_D1: {}, APP_ID: 'acme' };
    store.findSite.mockResolvedValue(site);
    store.findPage.mockResolvedValue(null);
});

describe('content', () => {
    it('maps catch-all segments to page paths', () => {
        expect(toPath()).toBe('/');
        expect(toPath(['docs', 'intro'])).toBe('/docs/intro');
    });

    it('reads the app named by APP_ID, defaulting to otta-web', async () => {
        await getSite();
        expect(store.findSite).toHaveBeenCalledWith('acme');
        env.value = { OBCF_D1: {} };
        await getSite();
        expect(store.findSite).toHaveBeenLastCalledWith('otta-web');
    });

    it('treats missing tables (before otta-web migrates) as "not set up", but surfaces other failures', async () => {
        store.findSite.mockRejectedValueOnce(
            Object.assign(new Error('query failed'), { cause: new Error('D1_ERROR: no such table: landing_sites') }),
        );
        expect(await getSite()).toBeNull();
        store.findSite.mockRejectedValueOnce(new Error('D1 is down'));
        await expect(getSite()).rejects.toThrow('D1 is down');
    });

    it('fails loudly when the D1 binding is missing', async () => {
        env.value = {};
        await expect(getSite()).rejects.toThrow(/OBCF_D1/);
    });
});

describe('pages', () => {
    it('renders a published page in the site theme', async () => {
        store.findPage.mockResolvedValue(home);
        const out = html(await LandingRoute(params()));
        expect(store.findPage).toHaveBeenCalledWith('acme', '/');
        expect(out).toContain('data-landing-theme="editorial"');
        expect(out).toContain('Ship the product, not the plumbing.');
    });

    it('404s for a path with no published page', async () => {
        await expect(LandingRoute(params(['secret-draft']))).rejects.toThrow(
            /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/,
        );
        expect(store.findPage).toHaveBeenCalledWith('acme', '/secret-draft');
    });

    it('shows setup steps, not an error page, before the tables exist', async () => {
        store.findSite.mockResolvedValue(null);
        store.findPage.mockRejectedValue(new Error('D1_ERROR: no such table: landing_pages'));
        expect(await generateMetadata(params())).toEqual({});
        expect(html(await LandingRoute(params()))).toContain('has no content yet');
    });

    it('reads the site and the page in parallel (one database round trip, not two)', async () => {
        let releaseSite!: (value: unknown) => void;
        store.findSite.mockReturnValue(new Promise((resolve) => (releaseSite = resolve)));
        store.findPage.mockResolvedValue(home);
        const rendering = LandingRoute(params());
        await vi.waitFor(() => expect(store.findPage).toHaveBeenCalled()); // before the site has answered
        releaseSite(site);
        expect(html(await rendering)).toContain('<h1');
    });

    it('shows setup steps until the site exists', async () => {
        store.findSite.mockResolvedValue(null);
        const out = html(await LandingRoute(params()));
        expect(out).toContain('has no content yet');
    });

    it('renders the 404 inside the site’s own theme and navigation', async () => {
        const out = html(await NotFound());
        expect(out).toContain('This page doesn’t exist');
        expect(out).toContain('href="/about"');
    });
});

describe('metadata', () => {
    it('lets only the production deployment be indexed', async () => {
        env.value = { ...env.value, ENVIRONMENT: 'preview' };
        expect((await layoutMetadata()).robots).toBe('noindex, nofollow');
        env.value = { ...env.value, ENVIRONMENT: 'production' };
        expect((await layoutMetadata()).robots).toBe('index, follow');
    });

    it('builds canonical and Open Graph URLs from the public site URL', async () => {
        store.findSite.mockResolvedValue({ getSettings: () => ({ ...DEFAULT_SITE, siteUrl: 'https://acme.dev' }) });
        store.findPage.mockResolvedValue(home);
        expect((await layoutMetadata()).metadataBase?.toString()).toBe('https://acme.dev/');
        const meta = await generateMetadata(params());
        expect(meta.alternates).toEqual({ canonical: '/' });
        expect(meta.openGraph).toMatchObject({ siteName: 'Ottabase', url: '/', title: DEFAULT_PAGES[0].title });
    });

    it('omits canonical URLs without a public URL, but resolves images against the request origin', async () => {
        store.findPage.mockResolvedValue(home);
        const meta = await generateMetadata(params());
        expect(meta.alternates).toBeUndefined();
        expect(meta.openGraph).not.toHaveProperty('url');
        expect((await layoutMetadata()).metadataBase?.toString()).toBe('https://landing.acme.test/');

        // A stored address that doesn't parse never throws; the request origin stands in.
        store.findSite.mockResolvedValue({ getSettings: () => ({ ...DEFAULT_SITE, siteUrl: 'https://[bad' }) });
        expect((await layoutMetadata()).metadataBase?.toString()).toBe('https://landing.acme.test/');
    });

    it('shares the page’s own social image, else the site’s, as a large card', async () => {
        const siteImage = '/api/upload/file/landing/acme/share/site.png?v=1';
        store.findSite.mockResolvedValue({
            getSettings: () => ({ ...DEFAULT_SITE, share: { imageUrl: siteImage } }),
        });
        store.findPage.mockResolvedValue(home);
        let meta = await generateMetadata(params());
        expect(meta.openGraph).toMatchObject({
            images: [{ url: siteImage, width: 1200, height: 630, alt: 'Ottabase' }],
        });
        expect(meta.twitter).toMatchObject({ card: 'summary_large_image', images: [{ url: siteImage }] });

        const own = { imageUrl: '/api/upload/file/landing/acme/share/home.png?v=2', heading: 'Ship it' };
        store.findPage.mockResolvedValue({ toPage: () => ({ ...home.toPage(), share: own }) });
        meta = await generateMetadata(params());
        expect(meta.openGraph).toMatchObject({ images: [{ url: own.imageUrl, alt: 'Ship it' }] });

        store.findSite.mockResolvedValue(site);
        store.findPage.mockResolvedValue(home);
        meta = await generateMetadata(params());
        expect(meta.openGraph).not.toHaveProperty('images');
        expect(meta.twitter).toMatchObject({ card: 'summary' });
    });
});

describe('draft previews', () => {
    const draft = { toPage: () => ({ ...home.toPage(), path: '/launch', title: 'Launch', published: false }) };

    it('shows a draft to its preview link, marked as a preview and kept out of search', async () => {
        store.findPreview.mockResolvedValue(draft);
        const out = html(await LandingRoute(params(['launch'], 'tok')));
        expect(store.findPreview).toHaveBeenCalledWith('acme', '/launch', 'tok');
        expect(out).toContain('Preview: this page isn’t published yet');
        expect(await generateMetadata(params(['launch'], 'tok'))).toEqual({
            title: 'Launch',
            robots: 'noindex, nofollow',
        });
    });

    it('404s a draft for a wrong token, without the token reaching any other lookup', async () => {
        store.findPreview.mockResolvedValue(null);
        store.findPage.mockResolvedValue(null);
        await expect(LandingRoute(params(['launch'], 'wrong'))).rejects.toThrow();
        expect(store.findPage).toHaveBeenCalledWith('acme', '/launch');
    });

    it('still shows a published page (without the banner) when an old preview link is opened', async () => {
        store.findPreview.mockResolvedValue(null);
        store.findPage.mockResolvedValue(home);
        const out = html(await LandingRoute(params(undefined, 'stale')));
        expect(out).not.toContain('Preview:');
        expect(out).toContain('<h1');
    });

    it('ignores a repeated ?preview= rather than guessing which one counts', async () => {
        store.findPage.mockResolvedValue(home);
        await LandingRoute({ params: Promise.resolve({}), searchParams: Promise.resolve({ preview: ['a', 'b'] }) });
        expect(store.findPreview).not.toHaveBeenCalled();
    });
});

describe('sitemap and robots', () => {
    it('lists every published page at the public URL, with when it changed', async () => {
        store.findSite.mockResolvedValue({ getSettings: () => ({ ...DEFAULT_SITE, siteUrl: 'https://acme.dev/' }) });
        const changed = new Date('2026-10-01T00:00:00Z');
        store.publishedPaths.mockResolvedValue([{ path: '/', updatedAt: changed }, { path: '/about' }]);
        expect(await sitemap()).toEqual([
            { url: 'https://acme.dev/', lastModified: changed },
            { url: 'https://acme.dev/about' },
        ]);
        expect(store.publishedPaths).toHaveBeenCalledWith('acme');
    });

    it('is empty before the site exists', async () => {
        store.findSite.mockResolvedValue(null);
        expect(await sitemap()).toEqual([]);
    });

    it('invites crawlers only in production, pointing them at the sitemap', async () => {
        env.value = { ...env.value, ENVIRONMENT: 'preview' };
        expect(await robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
        env.value = { ...env.value, ENVIRONMENT: 'production' };
        expect(await robots()).toEqual({
            rules: { userAgent: '*', allow: '/' },
            sitemap: 'https://landing.acme.test/sitemap.xml',
        });
    });
});

describe('layout', () => {
    it('server-renders both palettes, defaulting to the theme scheme, so the first paint is on-brand', async () => {
        const out = html(await RootLayout({ children: null }));
        expect(out).toMatch(/<html lang="en" data-scheme="light">/);
        expect(out).toMatch(
            /<style id="landing-theme">:root,:root\[data-scheme="light"\]\{color-scheme:light;[^<]*--primary:/,
        );
        expect(out).toContain(':root[data-scheme="dark"]{color-scheme:dark;');
    });

    it("applies the visitor's saved light/dark choice before the stylesheet paints", async () => {
        const out = html(await RootLayout({ children: null }));
        expect(out.indexOf('<script>try{var s=localStorage.getItem("ottalanding.scheme")')).toBeGreaterThan(-1);
        expect(out.indexOf('<script>')).toBeLessThan(out.indexOf('<style id="landing-theme">'));
    });
});

describe('POST /api/leads', () => {
    const post = (body: string, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
        postLead(new Request('http://localhost/api/leads', { method: 'POST', body, headers }));
    const entry = JSON.stringify({ kind: 'signup', email: 'a@b.co', elapsedMs: 5000 });

    it('stores an entry for the configured app, keyed by a hash of the network rather than the IP', async () => {
        store.submitLead.mockResolvedValue('stored');
        const res = await post(entry, { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        const [appId, body, { ipHash }] = store.submitLead.mock.calls[0];
        expect(appId).toBe('acme');
        expect(body).toEqual(JSON.parse(entry));
        expect(ipHash).toMatch(/^[0-9a-f]{32}$/);
        expect(ipHash).not.toContain('203.0.113.7');
    });

    it('answers a likely bot exactly like a person', async () => {
        store.submitLead.mockResolvedValue('ignored');
        expect(await (await post(entry)).json()).toEqual({ ok: true });
    });

    it('turns validation failures into field errors and floods into 429', async () => {
        store.submitLead.mockRejectedValueOnce(
            new DomainValidationError('Please fix the highlighted fields.', {
                fieldErrors: { email: ['Enter an email'] },
            }),
        );
        const invalid = await post(entry);
        expect(invalid.status).toBe(422);
        expect(await invalid.json()).toMatchObject({ fieldErrors: { email: ['Enter an email'] } });

        store.submitLead.mockResolvedValueOnce('rate-limited');
        expect((await post(entry)).status).toBe(429);
    });

    it('accepts JSON only, of a sane size, and never reaches the database otherwise', async () => {
        expect((await post('email=a@b.co', { 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
        expect((await post('{nope')).status).toBe(400);
        expect((await post(JSON.stringify({ message: 'x'.repeat(40_000) }))).status).toBe(413);
        expect(store.submitLead).not.toHaveBeenCalled();
    });
});
