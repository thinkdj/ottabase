export interface NavLink {
    to: string;
    label: string;
    /** Only show when authenticated */
    authRequired?: boolean;
    /** Only show when NOT authenticated */
    guestOnly?: boolean;
    /** Only show when user has *:* (superadmin) permission */
    superAdminOnly?: boolean;
}

/**
 * ResumeMe nav links — matches actual app routes from router.tsx.
 * Kept in one place so header, mobile drawer, and sidebar all stay in sync.
 */
const NAV_LINKS: NavLink[] = [
    { to: '/', label: 'Home' },
    { to: '/my-resume', label: 'My Resume Data', authRequired: true },
    { to: '/my-resumes', label: 'My Resumes', authRequired: true },
    { to: '/builder', label: 'Resume Builder', authRequired: true },
    { to: '/dossier', label: 'Application Dossier', authRequired: true },
    { to: '/guest', label: 'Try Free', guestOnly: true },
    { to: '/admin', label: 'Admin', authRequired: true, superAdminOnly: true },
];

/** Nav links filtered by auth state and permissions. */
export function getNavLinks(isAuthenticated = false, permissions: string[] = []): NavLink[] {
    const isSuperAdmin = permissions.includes('*:*');
    return NAV_LINKS.filter((link) => {
        if (link.authRequired && !isAuthenticated) return false;
        if (link.guestOnly && isAuthenticated) return false;
        if (link.superAdminOnly && !isSuperAdmin) return false;
        return true;
    });
}
