import { useSession } from '@/lib/auth';
import { Link, useLocation } from '@tanstack/react-router';
import { memo } from 'react';
import { NAV_LINKS } from './layout.constants';

/** Map width class to px value for responsive inline style */
const WIDTH_MAP: Record<string, string> = {
    'w-48': '12rem',
    'w-56': '14rem',
    'w-64': '16rem',
    'w-80': '20rem',
};

/** Static CSS for sidebar width — hoisted to avoid re-injecting on every render */
const SIDEBAR_WIDTH_CSS = `@media (min-width: 768px) { aside[style*="--sidebar-width"] { width: var(--sidebar-width); } }`;

export const SidebarNav = memo(function SidebarNav({ widthClass = 'w-56' }: { widthClass?: string }) {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const links = NAV_LINKS.filter((l) => !l.authRequired || isAuthenticated);
    const desktopWidth = WIDTH_MAP[widthClass] ?? '14rem';

    return (
        <aside
            className="w-full border-b bg-sidebar md:shrink-0 md:border-b-0 md:border-r md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:overflow-y-auto"
            style={{ '--sidebar-width': desktopWidth } as React.CSSProperties}
        >
            <style>{SIDEBAR_WIDTH_CSS}</style>
            <nav className="flex gap-1 p-2 overflow-x-auto md:flex-col md:gap-0.5 md:p-3 md:overflow-x-visible">
                {links.map((link) => {
                    const isActive =
                        location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
                    return (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap md:whitespace-normal ${
                                isActive
                                    ? 'bg-accent text-accent-foreground font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            }`}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
});
