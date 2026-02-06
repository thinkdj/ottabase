export interface NavLink {
    to: string;
    label: string;
    authRequired?: boolean;
}

export const NAV_LINKS: NavLink[] = [
    { to: '/', label: 'Home' },
    { to: '/blog', label: 'Blog' },
    { to: '/demo', label: 'Demo' },
    { to: '/shortlinks', label: 'Links' },
    { to: '/admin', label: 'Admin' },
    { to: '/dashboard', label: 'Dashboard', authRequired: true },
    { to: '/referrals', label: 'Referrals', authRequired: true },
];
