import { useSession } from '@/lib/auth';
import { Link, useLocation } from '@tanstack/react-router';
import { NAV_LINKS } from './layout.constants';

export function SidebarNav() {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const links = NAV_LINKS.filter((l) => !l.authRequired || isAuthenticated);

    return (
        <aside className="w-full border-b bg-sidebar md:w-56 md:shrink-0 md:border-b-0 md:border-r md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:overflow-y-auto">
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
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                            }`}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
