import { isAdminUser, useSession } from '@/lib/auth';
import { useBrand } from '@ottabase/brand-engine-react';
import type { ResolvedMenuSlotData } from '@ottabase/ottamenu';
import { MenuSlotRenderer } from '@ottabase/ottamenu';
import { APP_META } from '@/ottabase/config';
import { Link, useLocation } from '@tanstack/react-router';
import { memo } from 'react';
import { ControlsSection } from './ControlsSection';
import { UserSection } from './UserSection';
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
    const { isAuthenticated, user } = useSession();
    const location = useLocation();
    const { config } = useBrand();

    const isAdmin = isAdminUser(user);
    const navLinks = getNavLinks({ isAuthenticated, isAdmin });
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
                        className={`px-3 py-2 text-sm rounded-lg transition-colors duration-normal ${
                            isActive
                                ? 'bg-background text-foreground font-medium ring-1 ring-border'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
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
            className={`border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${sticky ? 'sticky top-0' : ''} z-40`}
        >
            <div className={`mx-auto flex items-center justify-between px-4 py-3 ${containerClass}`}>
                <div className="flex items-center gap-2.5">
                    {leading}
                    <Link
                        to="/"
                        className="font-semibold tracking-tight transition-colors duration-normal hover:text-foreground"
                    >
                        {APP_META.appName}
                    </Link>
                    {/* Optional positioning line from ottabase.config meta.tagline — omitted when unset */}
                    {APP_META.tagline && (
                        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            {APP_META.tagline}
                        </span>
                    )}
                </div>

                {headerNav}

                <div className="flex items-center gap-2">
                    <ControlsSection />
                    <UserSection />
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
    const { isAuthenticated, user } = useSession();
    const location = useLocation();
    const { config } = useBrand();

    const isAdmin = isAdminUser(user);
    const navLinks = getNavLinks({ isAuthenticated, isAdmin });
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
                        className={`px-3 py-2 text-sm rounded-lg transition-colors duration-normal ${
                            isActive
                                ? 'bg-background text-foreground font-medium ring-1 ring-border'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
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
        <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className={`mx-auto flex items-center justify-between px-4 py-2 ${containerClass}`}>
                <div className="flex items-center gap-2.5">
                    {leading}
                    <Link
                        to="/"
                        className="text-sm font-semibold tracking-tight transition-colors duration-normal hover:text-foreground"
                    >
                        {APP_META.appName}
                    </Link>
                </div>
                {headerNav}
                <div className="flex items-center gap-2">
                    <ControlsSection />
                    <UserSection compact />
                </div>
            </div>
        </header>
    );
});
