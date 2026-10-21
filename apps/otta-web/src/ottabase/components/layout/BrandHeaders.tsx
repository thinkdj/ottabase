import { useSession } from '@/lib/auth';
import { useBrand } from '@ottabase/brand-engine-react';
import type { ResolvedMenuSlotData } from '@ottabase/ottamenu/render';
import { MenuSlotRenderer } from '@ottabase/ottamenu/render';
import { APP_META } from '@/ottabase/config';
import { Link, useLocation } from '@tanstack/react-router';
import { memo } from 'react';
import { ControlsSection } from './ControlsSection';
import { AccountMenu } from './AccountMenu';
import { getNavLinks } from './layout.constants';

export const TopbarHeader = memo(function TopbarHeader({
    showNav,
    containerClass,
    leading,
    sticky = true,
}: {
    showNav: boolean;
    containerClass: string;
    leading?: React.ReactNode;
    sticky?: boolean;
}) {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const { config } = useBrand();

    const navLinks = getNavLinks();
    const staticNav = (
        <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
                const isActive =
                    location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
                return (
                    <Link
                        key={link.to}
                        to={link.to}
                        aria-current={isActive ? 'page' : undefined}
                        className={`h-8 px-2.5 text-sm font-medium rounded-md inline-flex items-center transition duration-fast ease-theme ${
                            isActive
                                ? 'bg-accent font-semibold text-accent-foreground'
                                : 'text-subtle-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        {link.label}
                    </Link>
                );
            })}
        </nav>
    );

    // Menu slot takes precedence: when menuSlots exists, always try header-nav (even if nav is in sidebar).
    // Fallback: static nav only when showNav (navigation === 'topbar').
    const headerNav = config?.menuSlots ? (
        <MenuSlotRenderer
            slot="header-nav"
            menuSlots={config.menuSlots as Record<string, ResolvedMenuSlotData[]> | undefined}
            options={{ isAuthenticated: !!isAuthenticated, pathname: location.pathname }}
            fallback={showNav ? staticNav : null}
            className="hidden md:flex items-center gap-1"
        />
    ) : showNav ? (
        staticNav
    ) : null;

    return (
        <header
            className={`border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 ${sticky ? 'sticky top-0' : ''} z-40`}
        >
            <div className={`mx-auto flex h-[52px] items-center justify-between gap-2 px-4 ${containerClass}`}>
                {/* min-w-0 lets the app name ellipsize instead of wrapping the header onto extra lines */}
                <div className="flex min-w-0 items-center gap-2.5">
                    {leading}
                    <Link
                        to="/"
                        className="truncate text-sm font-semibold tracking-tight transition-colors duration-normal hover:text-foreground sm:text-base"
                    >
                        {APP_META.appName}
                    </Link>
                    {/* Optional positioning line from ottabase.config meta.tagline — omitted when unset */}
                    {APP_META.tagline && (
                        <span className="hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.06em] text-faint-foreground md:inline">
                            {APP_META.tagline}
                        </span>
                    )}
                </div>

                {headerNav}

                <div className="flex shrink-0 items-center gap-2">
                    <ControlsSection />
                    <AccountMenu />
                </div>
            </div>
        </header>
    );
});

export const MinimalHeader = memo(function MinimalHeader({
    containerClass,
    leading,
    showNav = false,
}: {
    containerClass: string;
    leading?: React.ReactNode;
    /** When true, render header-nav menu slot (or static nav) — e.g. homepage with navigation: topbar */
    showNav?: boolean;
}) {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const { config } = useBrand();

    const navLinks = getNavLinks();
    const staticNav = (
        <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
                const isActive =
                    location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
                return (
                    <Link
                        key={link.to}
                        to={link.to}
                        aria-current={isActive ? 'page' : undefined}
                        className={`h-8 px-2.5 text-sm font-medium rounded-md inline-flex items-center transition duration-fast ease-theme ${
                            isActive
                                ? 'bg-accent font-semibold text-accent-foreground'
                                : 'text-subtle-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        {link.label}
                    </Link>
                );
            })}
        </nav>
    );

    const headerNav =
        config?.menuSlots && showNav ? (
            <MenuSlotRenderer
                slot="header-nav"
                menuSlots={config.menuSlots as Record<string, ResolvedMenuSlotData[]> | undefined}
                options={{ isAuthenticated: !!isAuthenticated, pathname: location.pathname }}
                fallback={staticNav}
                className="hidden md:flex items-center gap-1"
            />
        ) : showNav ? (
            staticNav
        ) : null;

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
            <div className={`mx-auto flex h-12 items-center justify-between gap-2 px-4 ${containerClass}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                    {leading}
                    <Link
                        to="/"
                        className="truncate text-sm font-semibold tracking-tight transition-colors duration-normal hover:text-foreground"
                    >
                        {APP_META.appName}
                    </Link>
                </div>
                {headerNav}
                <div className="flex shrink-0 items-center gap-2">
                    <ControlsSection />
                    <AccountMenu variant="compact" />
                </div>
            </div>
        </header>
    );
});
