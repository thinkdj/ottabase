import { PACKAGES_ENABLED } from '@/ottabase/config';

export interface NavLink {
    to: string;
    label: string;
    authRequired?: boolean;
    /** When true, only render for users with admin permission. */
    adminOnly?: boolean;
    /** When true, only render for users with systemAdmin flag (platform superadmin). */
    systemAdminOnly?: boolean;
}

/**
 * Top-level app navigation. Admin users see an extra `Admin` entry that
 * deep-links into the dedicated `/admin` console (which has its own sidebar).
 * Superadmins (systemAdmin=true) additionally see a `Superadmin` entry for
 * the /admin-platform surface.
 */
const NAV_LINKS_ALL: NavLink[] = [
    { to: '/', label: 'Home' },
    { to: '/demo', label: 'Demo' },
    { to: '/docs', label: 'Docs' },
    { to: '/blog', label: 'Blog' },
    { to: '/changelog', label: "What's New" },
    { to: '/shortlinks', label: 'Shortlinks' },
    { to: '/dashboard', label: 'Profile Information', authRequired: true },
    { to: '/referrals', label: 'Referrals', authRequired: true },
    { to: '/analytics', label: 'Analytics', authRequired: true, adminOnly: true },
    { to: '/admin', label: 'Admin', authRequired: true, adminOnly: true },
    { to: '/admin-platform', label: 'Superadmin', authRequired: true, systemAdminOnly: true },
];

const PACKAGE_ROUTE_MAP: Partial<Record<string, keyof typeof PACKAGES_ENABLED>> = {
    '/blog': 'ottablog',
    '/shortlinks': 'shortlinks',
    '/referrals': 'referrals',
};

/**
 * Returns true when `pathname` should highlight the nav link for `to`.
 * Uses strict segment-boundary matching to prevent `/admin` from matching `/admin-platform`.
 */
export function isNavLinkActive(pathname: string, to: string): boolean {
    if (pathname === to) return true;
    if (to === '/') return false;
    return pathname.startsWith(`${to}/`);
}

/**
 * Returns the visible nav links for the current viewer.
 * Filters by enabled package, auth state, admin permission, and system-admin flag.
 */
export function getNavLinks(
    opts: { isAuthenticated?: boolean; isAdmin?: boolean; isSystemAdmin?: boolean } = {},
): NavLink[] {
    const { isAuthenticated = false, isAdmin = false, isSystemAdmin = false } = opts;
    return NAV_LINKS_ALL.filter((link) => {
        const pkg = PACKAGE_ROUTE_MAP[link.to];
        if (pkg && !PACKAGES_ENABLED[pkg]) return false;
        if (link.authRequired && !isAuthenticated) return false;
        if (link.adminOnly && !isAdmin) return false;
        if (link.systemAdminOnly && !isSystemAdmin) return false;
        return true;
    });
}
