/**
 * Homepage Admin Navigation
 *
 * Tab navigation for the homepage management section.
 * Pattern: follows BlogAdminNav.tsx.
 */
import { Link, useRouterState } from '@tanstack/react-router';

const TABS = [
    { href: '/admin/homepage', label: 'Sections', exact: true },
    { href: '/admin/homepage/display', label: 'Display Settings' },
] as const;

export function HomepageAdminNav() {
    const { location } = useRouterState();
    const pathname = location.pathname;

    return (
        <nav className="flex gap-1 border-b pb-2" aria-label="Homepage admin navigation">
            {TABS.map(({ href, label, exact }) => {
                const isActive = exact ? pathname === href : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        to={href}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
