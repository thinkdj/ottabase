import { describe, expect, it } from 'vitest';
import { getLongestNavMatch, isNavLinkActive } from '../layout.constants';

describe('isNavLinkActive', () => {
    it('returns true on exact match', () => {
        expect(isNavLinkActive('/admin', '/admin')).toBe(true);
    });

    it('returns true on nested path under the link', () => {
        expect(isNavLinkActive('/admin/users', '/admin')).toBe(true);
    });

    it('respects segment boundaries (does not match prefix-only overlap)', () => {
        // Regression: "/admin" should NOT light up when on "/admin-platform/*".
        expect(isNavLinkActive('/admin-platform', '/admin')).toBe(false);
        expect(isNavLinkActive('/admin-platform/organizations', '/admin')).toBe(false);
    });

    it('never matches root path "/" for non-root pages', () => {
        expect(isNavLinkActive('/admin', '/')).toBe(false);
    });

    it('matches root path "/" only when pathname is exactly "/"', () => {
        expect(isNavLinkActive('/', '/')).toBe(true);
    });
});

describe('getLongestNavMatch', () => {
    it('returns the exact match when present', () => {
        expect(getLongestNavMatch('/demo/cloudflare', ['/demo', '/demo/cloudflare', '/demo/cloudflare/ai'])).toBe(
            '/demo/cloudflare',
        );
    });

    it('returns the longest prefix when pathname is a descendant', () => {
        // Regression: on /demo/cloudflare/ai, only "/demo/cloudflare/ai" should win —
        // NOT both "/demo/cloudflare" and "/demo/cloudflare/ai".
        expect(getLongestNavMatch('/demo/cloudflare/ai', ['/demo', '/demo/cloudflare', '/demo/cloudflare/ai'])).toBe(
            '/demo/cloudflare/ai',
        );
    });

    it('prefers a shorter prefix when no deeper item matches', () => {
        expect(getLongestNavMatch('/demo/cloudflare/other', ['/demo', '/demo/cloudflare', '/demo/cloudflare/ai'])).toBe(
            '/demo/cloudflare',
        );
    });

    it('returns null when nothing matches', () => {
        expect(getLongestNavMatch('/elsewhere', ['/demo', '/demo/cloudflare'])).toBe(null);
    });

    it('does not falsely match sibling paths sharing a prefix', () => {
        // "/admin" is not a prefix of "/admin-platform" at a segment boundary.
        expect(getLongestNavMatch('/admin-platform', ['/admin'])).toBe(null);
    });

    it('treats items equal to "/" as non-prefixes', () => {
        // Root item would otherwise match every path via startsWith logic.
        expect(getLongestNavMatch('/admin/users', ['/', '/admin'])).toBe('/admin');
    });

    it('handles the admin content regression (Posts vs Content Studio)', () => {
        // On /admin/content/blog/studio, Content Studio wins — not the Posts root.
        const hrefs = ['/admin/content/blog', '/admin/content/blog/studio'];
        expect(getLongestNavMatch('/admin/content/blog/studio', hrefs)).toBe('/admin/content/blog/studio');
        // On /admin/content/blog itself, Posts wins.
        expect(getLongestNavMatch('/admin/content/blog', hrefs)).toBe('/admin/content/blog');
        // On a Post slug page, Posts (the parent) should still highlight.
        expect(getLongestNavMatch('/admin/content/blog/some-post', hrefs)).toBe('/admin/content/blog');
    });
});
