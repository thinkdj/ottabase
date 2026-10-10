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

const store = vi.hoisted(() => ({ findSite: vi.fn(), findPage: vi.fn() }));
vi.mock('@ottabase/ottalanding', async (importOriginal) => {
    const real = await importOriginal<typeof import('@ottabase/ottalanding')>();
    return {
        ...real,
        LandingSite: { findForApp: store.findSite },
        LandingPage: { findPublished: store.findPage },
    };
});
// React's per-request cache() is a no-op outside a server render; keep it transparent here.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<object>()), cache: <T,>(fn: T) => fn }));

import LandingRoute, { generateMetadata } from '../app/[[...slug]]/page';
import RootLayout from '../app/layout';
import NotFound from '../app/not-found';
import { getSite, toPath } from '../lib/content';

const site = { getSettings: () => ({ ...DEFAULT_SITE, theme: 'editorial' }) };
const home = {
    toPage: () => ({ ...DEFAULT_PAGES[0], id: 'home', sections: parseSections(DEFAULT_PAGES[0].sections) }),
};
const html = (node: unknown) => renderToStaticMarkup(node as React.ReactElement);
const params = (slug?: string[]) => ({ params: Promise.resolve({ slug }) });

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

    it('does not touch pages in metadata before the tables exist (no error page instead of setup steps)', async () => {
        store.findSite.mockResolvedValue(null);
        store.findPage.mockRejectedValue(new Error('D1_ERROR: no such table: landing_pages'));
        expect(await generateMetadata(params())).toEqual({});
        expect(store.findPage).not.toHaveBeenCalled();
    });

    it('shows setup steps until the site exists', async () => {
        store.findSite.mockResolvedValue(null);
        const out = html(await LandingRoute(params()));
        expect(out).toContain('has no content yet');
        expect(store.findPage).not.toHaveBeenCalled();
    });

    it('renders the 404 inside the site’s own theme and navigation', async () => {
        const out = html(await NotFound());
        expect(out).toContain('This page doesn’t exist');
        expect(out).toContain('href="/about"');
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
