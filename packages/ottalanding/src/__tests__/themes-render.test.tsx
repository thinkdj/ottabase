import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGES, DEFAULT_SITE } from '../defaults';
import { THEME_COMPONENTS, LandingView } from '../react';
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

    it('renders an empty page without crashing', () => {
        expect(render(theme, [])).toContain(DEFAULT_SITE.name);
    });
});
