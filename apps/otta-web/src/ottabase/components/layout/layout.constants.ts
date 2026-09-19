import { PACKAGES_ENABLED } from '@/ottabase/config';

export interface NavLink {
    to: string;
    label: string;
    authRequired?: boolean;
    /** When true, only render for users with admin permission. */
    adminOnly?: boolean;
}

/**
 * Public personal-blog navigation. Studio/Admin stay reachable for people who
 * can actually use them; generic SaaS demo/docs/shortlink chrome stays off
 * the public header.
 */
const NAV_LINKS_ALL: NavLink[] = [
    { to: '/', label: 'Writing' },
    { to: '/about', label: 'About' },
    { to: '/studio', label: 'Studio', authRequired: true },
    { to: '/admin', label: 'Admin', authRequired: true, adminOnly: true },
];

const PACKAGE_ROUTE_MAP: Partial<Record<string, keyof typeof PACKAGES_ENABLED>> = {
    '/studio': 'ottablog',
};

/**
 * Returns the visible nav links for the current viewer.
 * Filters by enabled package, auth state, and admin permission.
 */
export function getNavLinks(opts: { isAuthenticated?: boolean; isAdmin?: boolean } = {}): NavLink[] {
    const { isAuthenticated = false, isAdmin = false } = opts;
    return NAV_LINKS_ALL.filter((link) => {
        const pkg = PACKAGE_ROUTE_MAP[link.to];
        if (pkg && !PACKAGES_ENABLED[pkg]) return false;
        if (link.authRequired && !isAuthenticated) return false;
        if (link.adminOnly && !isAdmin) return false;
        return true;
    });
}
