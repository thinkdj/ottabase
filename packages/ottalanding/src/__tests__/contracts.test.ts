import { BUILTIN_THEME_NAMES } from '@ottabase/brand-engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGES, DEFAULT_SITE } from '../defaults';
import * as root from '../index';
import {
    newSection,
    SCHEME_STORAGE_KEY,
    schemeInitScript,
    PageInputSchema,
    SECTION_TYPES,
    SectionSchema,
    SiteSettingsSchema,
    THEMES,
    themeStyles,
} from '../index';
import type { SectionData } from '../sections';

describe('content contracts', () => {
    it('the starter content is valid', () => {
        expect(SiteSettingsSchema.safeParse(DEFAULT_SITE).success).toBe(true);
        for (const page of DEFAULT_PAGES) expect(PageInputSchema.safeParse(page).success, page.path).toBe(true);
    });

    it('the starter home page shows off every section type', () => {
        const used = new Set(DEFAULT_PAGES[0].sections?.map((s) => s.type));
        for (const type of SECTION_TYPES.filter((t) => t !== 'text')) expect(used.has(type), type).toBe(true);
    });

    it('a new section is a draft: valid shape, required fields still empty', () => {
        const draft = newSection('cta');
        expect(draft).toMatchObject({ type: 'cta', data: {} });
        expect(SectionSchema.safeParse(draft).success).toBe(false);
    });

    it('accepts the href forms people actually use and nothing else', () => {
        const hero = (href: string) => ({
            id: 'h',
            type: 'hero',
            data: { title: 't', actions: [{ label: 'l', href }] },
        });
        for (const ok of ['https://x.dev', '/about', '#pricing', 'mailto:a@b.co', 'tel:+1']) {
            expect(SectionSchema.safeParse(hero(ok)).success, ok).toBe(true);
        }
        for (const bad of [
            'javascript:alert(1)',
            'data:text/html,x',
            'ftp://x',
            'about',
            '//evil.com',
            '/\\evil.com',
        ]) {
            expect(SectionSchema.safeParse(hero(bad)).success, bad).toBe(false);
        }
    });

    it('derives precise types from the descriptors', () => {
        const ok: SectionData<'pricing'> = { plans: [{ name: 'Pro', price: '$9', featured: true, features: ['a'] }] };
        // @ts-expect-error — a plan needs a price
        const missing: SectionData<'pricing'> = { plans: [{ name: 'Pro' }] };
        // @ts-expect-error — featured is a boolean
        const wrong: SectionData<'pricing'> = { plans: [{ name: 'Pro', price: '$9', featured: 'yes' }] };
        expect([ok, missing, wrong]).toHaveLength(3);
    });
});

describe('themes', () => {
    it('every theme is backed by a built-in Brand Engine preset', () => {
        for (const theme of THEMES) expect(BUILTIN_THEME_NAMES).toContain(theme.preset);
    });

    it('emits both palettes: the theme default on the selector, either one pinnable via data-scheme', () => {
        const { css } = themeStyles('bold', '[data-preview]');
        expect(css.startsWith('[data-preview],[data-preview][data-scheme="dark"]{color-scheme:dark;')).toBe(true);
        expect(css).toContain('}[data-preview][data-scheme="light"]{color-scheme:light;');
        // The two palettes really differ (light and dark backgrounds).
        const backgrounds = [...css.matchAll(/--background:([^;]+);/g)].map((m) => m[1]);
        expect(new Set(backgrounds).size).toBe(2);
        expect(themeStyles('unknown').css.startsWith(':root,:root[data-scheme="light"]{color-scheme:light;')).toBe(
            true,
        );
    });

    it('applies a saved choice before paint, accepting only light or dark', () => {
        const script = schemeInitScript();
        expect(script).toContain(`localStorage.getItem("${SCHEME_STORAGE_KEY}")`);
        expect(script).toContain("s==='light'||s==='dark'");
        expect(script).not.toMatch(/<\/script/i);
    });
});

describe('package boundary', () => {
    it('the root entry exports no React components', () => {
        for (const [name, value] of Object.entries(root)) {
            const looksLikeComponent =
                typeof value === 'function' && /^[A-Z]/.test(name) && !/^Landing(Site|Page)$/.test(name);
            expect(looksLikeComponent, name).toBe(false);
        }
    });
});
