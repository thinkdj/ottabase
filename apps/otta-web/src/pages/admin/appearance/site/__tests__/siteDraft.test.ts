import type { FullBrandConfig } from '@ottabase/brand-engine-react';
import { LAYOUT_PRESET_IDS } from '@ottabase/ottalayout';
import { describe, expect, it } from 'vitest';
import { configForPath, describePath, layoutFor, resolveSlots, samplePath, withDraft } from '../siteDraft';

const theme = (name: string) => ({ name, tokens: {} }) as never;
const full: FullBrandConfig = {
    kit: 'a',
    routeMappings: [{ pathPattern: '/**', layoutTemplateId: 'homepage', brandKitId: 'a', priority: 0 }],
    layoutTemplatesMap: {},
    brandKitsMap: {
        a: {
            brandName: 'Acme',
            logos: {},
            theme: theme('a'),
            defaultColorScheme: 'light',
            allowDarkModeToggle: true,
            hideOttabaseBranding: false,
        },
        b: {
            brandName: 'Blog co',
            logos: {},
            theme: theme('b'),
            defaultColorScheme: 'light',
            allowDarkModeToggle: true,
            hideOttabaseBranding: false,
        },
    },
};
const [first, second] = LAYOUT_PRESET_IDS;
const kits = [
    { id: 'a', name: 'Acme kit' },
    { id: 'b', name: 'Blog kit' },
];
const layouts = [
    { id: first, name: 'First', componentKey: first },
    { id: second, name: 'Second', componentKey: second },
];

describe('samplePath', () => {
    it('turns a pattern into a path it matches', () => {
        expect(samplePath('/**')).toBe('/');
        expect(samplePath('/blog/**')).toBe('/blog');
        expect(samplePath('/docs/*')).toBe('/docs/page');
        expect(samplePath('about')).toBe('/about');
    });
});

describe('resolveSlots', () => {
    it('joins assignments with their menus, in order, and drops what has no menu', () => {
        const menus = [
            { id: 'm1', appId: null, name: 'Main', slug: 'main', type: 'navbar' as const, items: [] },
            { id: 'm2', appId: null, name: 'Legal', slug: 'legal', type: 'footer' as const, items: [] },
        ];
        const slots = resolveSlots(
            [
                { slotName: 'footer-nav', menuId: 'm2', renderType: 'footer', sortOrder: 1 },
                { slotName: 'footer-nav', menuId: 'm1', renderType: 'footer', sortOrder: 0 },
                { slotName: 'header-nav', menuId: 'gone', renderType: 'navbar' },
                { slotName: '', menuId: 'm1', renderType: 'navbar' },
            ],
            menus,
        );
        expect(Object.keys(slots)).toEqual(['footer-nav']);
        expect(slots['footer-nav'].map((s) => s.menu.name)).toEqual(['Main', 'Legal']);
    });
});

describe('the draft over the live config', () => {
    const draft = withDraft(full, {
        mappings: [
            { pathPattern: '/blog/**', layoutTemplateId: second, brandKitId: 'b', priority: 10 },
            { pathPattern: '/**', layoutTemplateId: first, brandKitId: 'a', priority: 0 },
        ],
        menuSlots: {},
    });

    it('resolves a path to the draft kit and layout', () => {
        expect(configForPath(draft, '/blog/hello', 'light')?.brandName).toBe('Blog co');
        expect(configForPath(draft, '/', 'light')?.brandName).toBe('Acme');
        expect(configForPath(draft, '/blog', 'light')?.layoutTemplateId).toBe(second);
        expect(layoutFor(configForPath(draft, '/', 'light'))).toBeDefined();
    });

    it('names what a path gets', () => {
        expect(describePath(draft, '/blog', kits, layouts)).toEqual({ kit: 'Blog kit', layout: 'Second' });
        expect(describePath(draft, '/pricing', kits, layouts)).toEqual({ kit: 'Acme kit', layout: 'First' });
    });
});
