import { PACKAGES_ENABLED } from '@/ottabase/config';

export interface NavLink {
    to: string;
    label: string;
}

/**
 * Top-level app navigation: the public, visitor-facing surface only.
 * Signed-in destinations (Profile, Media Library, package pages such as Referrals,
 * Studio, Admin) live in the account menu (`AccountMenu`), not here.
 */
const NAV_LINKS_ALL: NavLink[] = [
    { to: '/', label: 'Home' },
    { to: '/demo', label: 'Demo' },
    { to: '/docs', label: 'Docs' },
    { to: '/blog', label: 'Blog' },
    { to: '/changelog', label: "What's New" },
];

const PACKAGE_ROUTE_MAP: Partial<Record<string, keyof typeof PACKAGES_ENABLED>> = {
    '/blog': 'ottablog',
};

/** Returns the visible nav links, filtered by enabled package. */
export function getNavLinks(): NavLink[] {
    return NAV_LINKS_ALL.filter((link) => {
        const pkg = PACKAGE_ROUTE_MAP[link.to];
        return !pkg || PACKAGES_ENABLED[pkg];
    });
}
