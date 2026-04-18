import { describe, expect, it } from 'vitest';
import { DEMO_ITEMS } from '@/pages/demo/demoItems';

describe('Demo gallery coverage', () => {
    it('includes all package coverage additions in demo items', () => {
        const demoPaths = new Set(DEMO_ITEMS.map((item) => item.to));
        const requiredPaths = [
            '/demo/spotlight',
            '/demo/menus',
            '/demo/medialibrary',
            '/demo/analytics',
            '/demo/auth',
            '/demo/brand-engine',
            '/demo/layout',
        ];

        requiredPaths.forEach((path) => {
            expect(demoPaths.has(path)).toBe(true);
        });
    });
});
