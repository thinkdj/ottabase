import { describe, expect, it } from 'vitest';
import { BLOCK_REGISTRY, handleBlocksRegistry } from '../marketing-pages';

describe('marketing pages block registry', () => {
    it('exposes built-in and app custom blocks', async () => {
        expect(BLOCK_REGISTRY.some((block) => block.id === 'hero')).toBe(true);
        expect(BLOCK_REGISTRY.some((block) => block.id === 'app-value-grid')).toBe(true);

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
});
