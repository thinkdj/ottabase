export interface NavLink {
    to: string;
    label: string;
    /** Only show when authenticated */
    authRequired?: boolean;
    /** Only show when NOT authenticated */
    guestOnly?: boolean;
}

/**
 * ResumeMe nav links — matches actual app routes from router.tsx.
 * Kept in one place so header, mobile drawer, and sidebar all stay in sync.
 */
const NAV_LINKS: NavLink[] = [
    { to: '/', label: 'Home' },
    { to: '/builder', label: 'Resume Builder', authRequired: true },
    { to: '/guest', label: 'Try Free', guestOnly: true },
    { to: '/admin', label: 'Admin', authRequired: true },
];

/** Nav links filtered by auth state. */
export function getNavLinks(isAuthenticated = false): NavLink[] {
    return NAV_LINKS.filter((link) => {
        if (link.authRequired && !isAuthenticated) return false;
        if (link.guestOnly && isAuthenticated) return false;
        return true;
    });
}
