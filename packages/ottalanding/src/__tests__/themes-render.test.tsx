import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGES, DEFAULT_SITE } from '../defaults';
import { LandingPreview, LandingView, THEME_COMPONENTS } from '../react';
import { parseSections } from '../sections';
import { THEMES } from '../themes';

const home = parseSections(DEFAULT_PAGES[0].sections);
const render = (theme: string, sections = home, currentPath = '/about') =>
    renderToStaticMarkup(
        <LandingView site={{ ...DEFAULT_SITE, theme: theme as never }} sections={sections} currentPath={currentPath} />,
    );

describe.each(THEMES.map((t) => t.id))('theme "%s"', (theme) => {
    const html = render(theme);

    it('implements every section type', () => {
        expect(Object.keys(THEME_COMPONENTS[theme].sections).sort()).toEqual(
            ['cta', 'faq', 'features', 'hero', 'logos', 'pricing', 'testimonials', 'text'].sort(),
        );
    });

    it('renders the site chrome and every section of the starter home page', () => {
        expect(html).toContain(`data-landing-theme="${theme}"`);
        expect(html).toContain(DEFAULT_SITE.name);
        for (const section of home) {
            const d = section.data as Record<string, unknown>;
            const text = (d.title ?? (d.items as { name: string }[] | undefined)?.[0]?.name) as string;
            expect(html, section.type).toContain(text.replace(/’/g, '&#x27;').replace(/'/g, '&#x27;').slice(0, 20));
        }
    });

    it('gives the first section of each type an anchor for in-page links', () => {
        for (const id of ['hero', 'features', 'pricing', 'faq']) expect(html).toContain(`id="${id}"`);
    });

    it('marks the current nav link', () => {
        expect(html).toMatch(/aria-current="page"[^>]*>About|href="\/about"[^>]*aria-current="page"/);
    });

    it('neutralises unsafe links and opens external ones in a new tab', () => {
        const out = render(theme, [
            {
                id: 'x',
                type: 'cta',
                data: {
                    title: 'T',
                    actions: [
                        { label: 'Bad', href: 'javascript:alert(1)' },
                        { label: 'Ext', href: 'https://x.dev' },
                    ],
                },
            },
        ]);
        expect(out).not.toContain('javascript:');
        expect(out).toMatch(/href="https:\/\/x\.dev" target="_blank" rel="noopener noreferrer"/);
    });

    it('offers a light/dark switch in the navigation', () => {
        expect(html).toMatch(/<button[^>]*aria-label="Dark mode"[^>]*aria-pressed="false"/);
    });

    it('renders items that share a title (or are still empty) instead of collapsing them', () => {
        const out = render(theme, [
            {
                id: 'f',
                type: 'features',
                data: {
                    items: [
                        { title: 'Same', description: 'one' },
                        { title: 'Same', description: 'two' },
                    ],
                },
            },
        ]);
        expect(out).toContain('one');
        expect(out).toContain('two');
    });

    it('gives every page exactly one <h1>: the first hero, or a hidden title when there is no hero', () => {
        const h1s = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;
        const hero = (id: string, title: string) => ({ id, type: 'hero' as const, data: { title } });
        expect(h1s(html)).toBe(1);

        const twoHeroes = render(theme, [hero('a', 'First'), hero('b', 'Second')]);
        expect(h1s(twoHeroes)).toBe(1);
        expect(twoHeroes).toMatch(/<h1[^>]*>First<\/h1>/);
        expect(twoHeroes).toMatch(/<h2[^>]*>Second<\/h2>/);

        const noHero = renderToStaticMarkup(
            <LandingView
                site={{ ...DEFAULT_SITE, theme: theme as never }}
                sections={[{ id: 't', type: 'text', data: { body: 'x' } }]}
                title="Legal"
            />,
        );
        expect(noHero).toMatch(/<h1 class="sr-only">Legal<\/h1>/);
    });

    it('describes the hero image for screen readers when given, and treats it as decorative otherwise', () => {
        const withImage = (data: object) =>
            render(theme, [
                { id: 'h', type: 'hero', data: { title: 'T', imageUrl: 'https://x.dev/shot.png', ...data } },
            ]);
        expect(withImage({ imageAlt: 'Dashboard with three charts' })).toContain('alt="Dashboard with three charts"');
        expect(withImage({})).toMatch(/<img src="https:\/\/x\.dev\/shot\.png" alt=""/);
    });

    it('renders an empty page without crashing', () => {
        expect(render(theme, [])).toContain(DEFAULT_SITE.name);
    });
});

describe('LandingPreview', () => {
    it('scopes each preview to itself, so several previews on one page keep their own themes', () => {
        const out = renderToStaticMarkup(
            <>
                <LandingPreview site={{ ...DEFAULT_SITE, theme: 'launch' }} sections={home} />
                <LandingPreview site={{ ...DEFAULT_SITE, theme: 'bold' }} sections={home} />
            </>,
        );
        const scopes = [...out.matchAll(/data-landing-preview="([^"]+)"/g)].map((m) => m[1]);
        expect(new Set(scopes).size).toBe(2);
        // Each preview's stylesheet targets exactly its own scope (quotes may be HTML-escaped in markup).
        const css = out.replaceAll('&quot;', '"');
        for (const scope of scopes)
            expect(css).toContain(`[data-landing-preview="${scope}"][data-scheme="dark"]{color-scheme:dark;`);
    });
});
