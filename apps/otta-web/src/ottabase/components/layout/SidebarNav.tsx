import { useSession } from '@/lib/auth';
import { useBrand } from '@ottabase/brand-engine-react';
import type { ResolvedMenuSlotData } from '@ottabase/ottamenu/render';
import { MenuSlotRenderer } from '@ottabase/ottamenu/render';
import { Link, useLocation } from '@tanstack/react-router';
import { memo } from 'react';
import { AccountMenu } from './AccountMenu';
import { getNavLinks } from './layout.constants';

/** Map width class to px value for responsive inline style */
const WIDTH_MAP: Record<string, string> = {
    'w-48': '12rem',
    'w-56': '14rem',
    'w-64': '16rem',
    'w-80': '20rem',
};

/** Static CSS for sidebar width — hoisted to avoid re-injecting on every render */
const SIDEBAR_WIDTH_CSS = `@media (min-width: 768px) { aside[style*="--sidebar-width"] { width: var(--sidebar-width); } }`;

/**
 * `withAccount` is the headerless layout: the sidebar is the only chrome, so it runs the full
 * height and carries the account menu at its foot (see `accountPlacement`).
 */
export const SidebarNav = memo(function SidebarNav({
    widthClass = 'w-56',
    withAccount = false,
}: {
    widthClass?: string;
    withAccount?: boolean;
}) {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const { config } = useBrand();
    const links = getNavLinks();

    const staticContent = links.map((link) => {
        const isActive = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
        return (
            <Link
                key={link.to}
                to={link.to}
                aria-current={isActive ? 'page' : undefined}
                className={`h-8 px-2.5 text-sm font-medium rounded-md inline-flex items-center transition duration-fast ease-theme whitespace-nowrap md:whitespace-normal ${
                    isActive
                        ? 'bg-accent font-semibold text-accent-foreground'
                        : 'text-subtle-foreground hover:bg-muted hover:text-foreground'
                }`}
            >
                {link.label}
            </Link>
        );
    });

    const menuContent = config?.menuSlots ? (
        <MenuSlotRenderer
            slot="sidebar-nav"
            menuSlots={config.menuSlots as Record<string, ResolvedMenuSlotData[]> | undefined}
            options={{ isAuthenticated: !!isAuthenticated, pathname: location.pathname }}
            fallback={staticContent}
        />
    ) : (
        staticContent
    );

    const desktopWidth = WIDTH_MAP[widthClass] ?? '14rem';

    return (
        <aside
            className={`flex w-full items-center border-b border-border/60 bg-sidebar md:shrink-0 md:flex-col md:items-stretch md:border-b-0 md:border-r md:border-border/60 md:sticky ${
                withAccount ? 'md:top-0 md:h-dvh' : 'md:top-14 md:h-[calc(100dvh-3.5rem)]'
            }`}
            style={{ '--sidebar-width': desktopWidth } as React.CSSProperties}
        >
            <style>{SIDEBAR_WIDTH_CSS}</style>
            <nav className="flex min-w-0 flex-1 gap-1 p-2 overflow-x-auto md:flex-col md:gap-0.5 md:p-3 md:overflow-y-auto md:overflow-x-visible">
                {menuContent}
            </nav>
            {withAccount && (
                <div className="shrink-0 border-l border-border/60 p-2 md:border-l-0 md:border-t md:p-3">
                    <AccountMenu variant="sidebar" />
                </div>
            )}
        </aside>
    );
});
