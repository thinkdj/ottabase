import { describe, expect, it } from 'vitest';
import { DEMO_GROUPS, DEMO_ITEMS, groupDemos, searchDemos } from '@/pages/demo/demoItems';

describe('Demo gallery', () => {
    it('lists every Cloudflare page, not just the overview', () => {
        const paths = new Set(DEMO_ITEMS.map((item) => item.to));
        for (const path of [
            'd1',
            'kv',
            'r2',
            'images',
            'hyperdrive',
            'queues',
            'rate-limiting',
            'realtime',
            'ai',
            'pdf',
            'pdf/playground',
            'file-upload',
        ]) {
            expect(paths.has(`/demo/cloudflare/${path}`)).toBe(true);
        }
        expect(paths.size).toBe(DEMO_ITEMS.length);
    });

    it('puts every item in a known group, and groups keep gallery order', () => {
        const ids = new Set(DEMO_GROUPS.map((group) => group.id));
        for (const item of DEMO_ITEMS) expect(ids.has(item.group)).toBe(true);
        const sections = groupDemos();
        expect(sections.map((section) => section.group.id)).toEqual(DEMO_GROUPS.map((group) => group.id));
        expect(sections.reduce((count, section) => count + section.items.length, 0)).toBe(DEMO_ITEMS.length);
    });

    it('finds demos by label, title or description', () => {
        expect(searchDemos('kv').map((item) => item.to)).toContain('/demo/cloudflare/kv');
        expect(searchDemos('fuzzy').map((item) => item.to)).toContain('/demo/ottadate');
        expect(searchDemos('')).toHaveLength(DEMO_ITEMS.length);
        expect(groupDemos(searchDemos('zzz-nothing'))).toEqual([]);
    });
});
