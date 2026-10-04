import { PACKAGES_ENABLED } from '@/ottabase/config';

export interface NavLink {
    to: string;
    label: string;
    authRequired?: boolean;
    /** When true, only render for users with admin permission. */
    adminOnly?: boolean;
}

/**
 * Top-level app navigation. Admin users see an extra `Admin` entry that
 * deep-links into the dedicated `/admin` console (which has its own sidebar).
 */
const NAV_LINKS_ALL: NavLink[] = [
    { to: '/', label: 'Home' },
    { to: '/demo', label: 'Demo' },
    { to: '/docs', label: 'Docs' },
    { to: '/blog', label: 'Blog' },
    { to: '/changelog', label: "What's New" },
    { to: '/shortlinks', label: 'Shortlinks' },
    { to: '/dashboard', label: 'Dashboard', authRequired: true },
    { to: '/referrals', label: 'Referrals', authRequired: true },
    { to: '/analytics', label: 'Analytics', authRequired: true, adminOnly: true },
    { to: '/admin', label: 'Admin', authRequired: true, adminOnly: true },
];

const PACKAGE_ROUTE_MAP: Partial<Record<string, keyof typeof PACKAGES_ENABLED>> = {
    '/blog': 'ottablog',
    '/shortlinks': 'shortlinks',
    '/referrals': 'referrals',
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
