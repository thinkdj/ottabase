import { describe, expect, it } from 'vitest';
import { BLOCK_REGISTRY, getBlockRegistry, handleBlocksRegistry, registerCustomBlock } from '../marketing-pages';

describe('marketing pages block registry', () => {
    it('exposes built-in and app custom blocks', async () => {
        const blocks = getBlockRegistry();
        expect(blocks.some((block) => block.id === 'hero')).toBe(true);
        expect(blocks.some((block) => block.id === 'about')).toBe(true);
        expect(blocks.some((block) => block.id === 'app-value-grid')).toBe(true);

        const response = await handleBlocksRegistry({
            request: new Request('http://localhost/api/blocks'),
            env: {} as any,
            url: new URL('http://localhost/api/blocks'),
            route: '/api/blocks',
            method: 'GET',
            corsHeaders: {},
            withAuthCors: (value) => value,
        });
        const payload = (await response.json()) as { blocks: Array<{ id: string }> };
        expect(payload.blocks.length).toBeGreaterThan(3);
    });

    it('supports registering custom blocks at runtime', () => {
        const before = getBlockRegistry().length;
        registerCustomBlock({
            id: 'test-custom',
            label: 'Test Custom',
            category: 'custom',
            variants: [{ id: 'default', label: 'Default' }],
            fields: [],
        });
        expect(getBlockRegistry().length).toBe(before + 1);
        expect(getBlockRegistry().some((block) => block.id === 'test-custom')).toBe(true);

        // Duplicate registration should be idempotent
        registerCustomBlock({
            id: 'test-custom',
            label: 'Test Custom',
            category: 'custom',
            variants: [{ id: 'default', label: 'Default' }],
            fields: [],
        });
        expect(getBlockRegistry().length).toBe(before + 1);
    });

    it('includes all 6 core slot types', () => {
        const coreSlots = ['hero', 'features', 'cta', 'about', 'navbar', 'footer'];
        for (const slot of coreSlots) {
            expect(BLOCK_REGISTRY.some((b) => b.id === slot)).toBe(true);
        }
    });

    it('each block has at least one variant', () => {
        for (const block of getBlockRegistry()) {
            expect(block.variants.length).toBeGreaterThanOrEqual(1);
        }
    });
});
