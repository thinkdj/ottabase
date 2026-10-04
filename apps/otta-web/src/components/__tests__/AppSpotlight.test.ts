import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
    isAdminUser: () => false,
    isOrgAdmin: () => false,
    isPlatformAdmin: () => false,
    useSession: () => ({}),
}));
vi.mock('next-themes', () => ({ useTheme: () => ({}) }));

import { rankDestinations, type Destination } from '../AppSpotlight';
import { appNavigate, registerAppNavigate } from '@/lib/app-navigate';

const d = (label: string, group: string, extra: Partial<Destination> = {}): Destination => ({
    href: `/${label.toLowerCase().replace(/\s+/g, '-')}`,
    label,
    group,
    ...extra,
});

describe('rankDestinations', () => {
    const list = [
        d('Blog posts', 'Admin', { description: 'Write and publish' }),
        d('Media library', 'Admin', { keywords: ['images', 'uploads'] }),
        d('Blog', 'Pages'),
        d('Fuzzy dates', 'Demos', { description: 'Half-remembered dates in a zooming panel' }),
    ];

    it('prefers label prefixes and keeps groups together', () => {
        const ranked = rankDestinations(list, 'blog').map((x) => `${x.group}:${x.label}`);
        // Both "Blog" matches are prefixes; their groups stay contiguous
        expect(ranked).toEqual(['Admin:Blog posts', 'Pages:Blog']);
    });

    it('matches descriptions and keywords after labels', () => {
        expect(rankDestinations(list, 'images').map((x) => x.label)).toEqual(['Media library']);
        expect(rankDestinations(list, 'zooming').map((x) => x.label)).toEqual(['Fuzzy dates']);
    });

    it('returns nothing for an empty query or no match', () => {
        expect(rankDestinations(list, '  ')).toEqual([]);
        expect(rankDestinations(list, 'banana')).toEqual([]);
    });
});

describe('appNavigate', () => {
    it('uses the registered router navigation', () => {
        const navigate = vi.fn();
        registerAppNavigate(navigate);
        appNavigate('/admin');
        expect(navigate).toHaveBeenCalledWith('/admin');
    });
});
