import { describe, expect, it } from 'vitest';
import { mergeExposedPagesIntoNavbar } from '../lib/merge-exposed-pages-nav';

describe('mergeExposedPagesIntoNavbar', () => {
    it('appends /page/:slug links and skips duplicate hrefs', () => {
        const out = mergeExposedPagesIntoNavbar(
            {
                title: 'Site',
                links: [
                    { href: '/about', label: 'About' },
                    { href: '/page/legal', label: 'Legal' },
                ],
            },
            [
                { slug: 'legal', title: 'Legal dup' },
                { slug: 'privacy', title: 'Privacy' },
            ],
        );
        expect(out.links?.map((l) => l.href)).toEqual(['/about', '/page/legal', '/page/privacy']);
        expect(out.links?.find((l) => l.href === '/page/privacy')?.label).toBe('Privacy');
    });

    it('returns navbar unchanged when exposedPages is empty', () => {
        const nav = { title: 'X', links: [{ href: '/', label: 'Home' }] };
        expect(mergeExposedPagesIntoNavbar(nav, [])).toEqual(nav);
    });
});
