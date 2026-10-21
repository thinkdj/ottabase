/**
 * The package pages in `src/ottabase/config/packages.ts` (written by `otta add`) are lazy: a wrong
 * module or export name is a blank screen the first time someone opens the page, and no type
 * check sees it. Load every one, and check the router mounted them all.
 */
import { DEFAULT_ROUTE_MAPPINGS } from '@ottabase/brand-engine';
import { describe, expect, it } from 'vitest';
import { getNavLinks } from '@/ottabase/components/layout/layout.constants';
import { getEnabledAdminNav } from '@/ottabase/config/admin-nav';
import { PACKAGE_ACCOUNT_LINKS, PACKAGE_ADMIN_PAGES, PACKAGE_ROUTES } from '@/ottabase/config/packages';
import { router } from '@/router';

/** The route a path lands on, or undefined when it is the 404 page (a prefix match does not count). */
const landsOn = (pathname: string) => {
    const matches = router.matchRoutes(pathname, {});
    return matches.some((match) => match.globalNotFound) ? undefined : matches.at(-1)?.routeId;
};

describe('package pages', () => {
    it('every admin page and route loads and exports the component it names', async () => {
        for (const page of [...PACKAGE_ADMIN_PAGES, ...PACKAGE_ROUTES]) {
            const module = await page.load();
            expect(typeof module[page.exportName], `${page.pkg} ${page.path} exports ${page.exportName}`).toBe(
                'function',
            );
        }
    }, 60_000);

    it('the router mounts every one of them, once', () => {
        const paths = Object.keys(router.routesByPath);
        for (const page of [...PACKAGE_ADMIN_PAGES, ...PACKAGE_ROUTES]) expect(paths).toContain(page.path);
    });

    it('links only routed pages from the account menu', () => {
        expect(PACKAGE_ACCOUNT_LINKS.map((link) => link.path)).toEqual(
            PACKAGE_ROUTES.filter((route) => route.menu).map((route) => route.path),
        );
        expect(PACKAGE_ACCOUNT_LINKS).toContainEqual(expect.objectContaining({ path: '/referrals', pkg: 'referrals' }));
    });
});

// Every link the shell renders must land on a page, not the 404: moving a page (as /shortlinks
// and /analytics moved under /admin/growth) without its link is the bug this catches.
describe('shell links', () => {
    it('every top nav link is routed', () => {
        for (const link of getNavLinks()) expect(landsOn(link.to), link.to).toBeDefined();
    });

    it('every admin nav entry is routed, for a platform and an org admin', () => {
        const groups = getEnabledAdminNav({ isPlatformAdmin: true, isOrgAdmin: true });
        const items = groups.flatMap((group) => group.items).filter((item) => !item.external);
        expect(items.length).toBeGreaterThan(10);
        for (const item of items) expect(landsOn(item.href), item.href).toBeDefined();
    });

    it('every account menu destination is routed, and the deleted pages stay gone', () => {
        for (const path of [
            '/profile',
            '/media-library',
            '/studio',
            '/admin',
            ...PACKAGE_ACCOUNT_LINKS.map((l) => l.path),
        ]) {
            expect(landsOn(path), path).toBeDefined();
        }
        for (const gone of ['/dashboard', '/shortlinks', '/analytics', '/admin/growth/referrals']) {
            expect(landsOn(gone), gone).toBeUndefined();
        }
    });

    it('every default layout mapping a new install is seeded with names a routed page', () => {
        // `/admin/**` is checked at `/admin`, `/blog/*` at `/blog/sample`; the catch-all `/**` needs no page.
        const patterns = DEFAULT_ROUTE_MAPPINGS.map((mapping) => mapping.pathPattern).filter(
            (pattern) => pattern !== '/**',
        );
        for (const pattern of patterns) {
            const path = pattern.replace(/\/\*\*$/, '').replace(/\*/g, 'sample') || '/';
            expect(landsOn(path), pattern).toBeDefined();
        }
    });
});
