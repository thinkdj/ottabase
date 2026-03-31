import { describe, it, expect } from 'vitest';
import { HomepageDataSchema, ExposedPageSchema, SectionSchema, DisplaySchema } from '../schemas';

describe('@ottabase/homepage-contract schemas', () => {
    it('validates a complete payload', () => {
        const payload = {
            sections: [
                {
                    id: 'sec-1',
                    slot: 'hero',
                    title: 'Welcome',
                    subtitle: 'Build fast',
                    body: null,
                    githubUrl: null,
                    icon: 'Sparkles',
                    enabled: true,
                    cssClasses: null,
                    metadata: null,
                    sortOrder: 0,
                    features: [],
                    actions: [{ label: 'Start', href: '/start', variant: 'default', icon: null, external: false }],
                },
            ],
            display: {
                variantBySlot: { hero: 'centered', features: 'grid' },
                themePreset: 'neo',
                fallbackThemePresetId: null,
            },
            exposedPages: [{ slug: 'pricing', title: 'Pricing' }],
        };
        const result = HomepageDataSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.sections).toHaveLength(1);
            expect(result.data.sections[0].slot).toBe('hero');
            expect(result.data.display.themePreset).toBe('neo');
            expect(result.data.exposedPages[0].slug).toBe('pricing');
        }
    });

    it('applies defaults for missing optional fields', () => {
        const minimal = {
            sections: [],
            display: { variantBySlot: null, themePreset: null, fallbackThemePresetId: null },
            exposedPages: [],
        };
        const result = HomepageDataSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });

    it('rejects invalid section (missing id)', () => {
        const result = SectionSchema.safeParse({ slot: 'hero', title: 'Test' });
        expect(result.success).toBe(false);
    });

    it('rejects invalid display (missing variantBySlot)', () => {
        const result = DisplaySchema.safeParse({ themePreset: 'neo' });
        expect(result.success).toBe(false);
    });

    it('validates exposed page', () => {
        const result = ExposedPageSchema.safeParse({ slug: 'about', title: 'About Us' });
        expect(result.success).toBe(true);
    });

    it('infers correct types from schemas', () => {
        const payload = HomepageDataSchema.parse({
            sections: [],
            display: { variantBySlot: null, themePreset: null, fallbackThemePresetId: null },
            exposedPages: [],
        });
        // Type-level check — these properties must exist
        expect(payload.sections).toBeDefined();
        expect(payload.display).toBeDefined();
        expect(payload.exposedPages).toBeDefined();
        expect(payload.display.variantBySlot).toBeNull();
    });
});
