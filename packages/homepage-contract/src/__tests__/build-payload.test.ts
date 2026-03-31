import { describe, expect, it } from 'vitest';
import { buildHomepagePublicPayloadV1 } from '../build-payload';
import { homepagePublicPayloadV1Schema } from '../schemas';

describe('buildHomepagePublicPayloadV1', () => {
    it('returns valid v1 payload for empty sections', () => {
        const p = buildHomepagePublicPayloadV1([], null, 'neo');
        expect(homepagePublicPayloadV1Schema.safeParse(p).success).toBe(true);
        expect(p.version).toBe(1);
        expect(p.themePresetId).toBe('neo');
        expect(p.slots.features.items).toEqual([]);
        expect(p.exposedPages).toEqual([]);
    });

    it('maps hero actions and feature items deterministically', () => {
        const p = buildHomepagePublicPayloadV1(
            [
                {
                    id: 'h1',
                    slot: 'hero',
                    title: 'Hello',
                    subtitle: 'Sub',
                    isActive: true,
                    features: [],
                    actions: [
                        {
                            id: 'a1',
                            label: 'Go',
                            href: '/x',
                            variant: 'outline',
                            isExternal: false,
                        },
                    ],
                },
                {
                    id: 'f1',
                    slot: 'features',
                    title: 'Why us',
                    isActive: true,
                    features: [
                        { id: 'fi1', title: 'Fast', description: 'Edge', sortOrder: 1 },
                        { id: 'fi0', title: 'Safe', description: 'RLS', sortOrder: 0 },
                    ],
                    actions: [],
                },
            ],
            { themePresetId: 'crisp', variantBySlotJson: { hero: 'split' } },
            'crisp',
        );
        expect(p.slots.hero.title).toBe('Hello');
        expect(p.slots.hero.actions[0].variant).toBe('outline');
        expect(p.slots.features.items.map((i) => i.title)).toEqual(['Safe', 'Fast']);
        expect(p.variantBySlot.hero).toBe('split');
    });

    it('includes exposedPages when provided', () => {
        const p = buildHomepagePublicPayloadV1([], null, 'crisp', {
            exposedPages: [
                { slug: 'legal', title: 'Legal' },
                { slug: 'privacy', title: 'Privacy' },
            ],
        });
        expect(p.exposedPages).toHaveLength(2);
        expect(p.exposedPages[0].slug).toBe('legal');
        expect(p.exposedPages[1].title).toBe('Privacy');
    });
});
