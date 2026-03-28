import { PACKAGES_ENABLED } from '@/ottabase/config';

export interface NavLink {
    to: string;
    label: string;
    authRequired?: boolean;
}

/** All nav links [filtered by package in getNavLinks() below]. */
const NAV_LINKS_ALL: NavLink[] = [
    { to: '/', label: 'Home' },
    { to: '/changelog', label: "What's New" },
    { to: '/blog', label: 'Blog' },
    { to: '/demo', label: 'Demo' },
    { to: '/shortlinks', label: 'Links' },
    { to: '/analytics', label: 'Analytics', authRequired: true },
    { to: '/admin', label: 'Admin' },
    { to: '/dashboard', label: 'Dashboard', authRequired: true },
    { to: '/referrals', label: 'Referrals', authRequired: true },
];

const PACKAGE_ROUTE_MAP: Partial<Record<string, keyof typeof PACKAGES_ENABLED>> = {
    '/blog': 'ottablog',
    '/shortlinks': 'shortlinks',
    '/referrals': 'referrals',
};

/** Nav links filtered by enabled packages (SSOT). */
export function getNavLinks(): NavLink[] {
    return NAV_LINKS_ALL.filter((link) => {
        const pkg = PACKAGE_ROUTE_MAP[link.to];
        return !pkg || PACKAGES_ENABLED[pkg];
    });
}
