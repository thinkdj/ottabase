import { useSession } from '@/lib/auth';
import { useBrand } from '@ottabase/brand-engine-react';
import type { ResolvedMenuSlotData } from '@ottabase/ottamenu';
import { MenuSlotRenderer } from '@ottabase/ottamenu';
import { APP_META } from '@/ottabase/config';
import { Button } from '@ottabase/ui-shadcn';
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
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const { config } = useBrand();

    const navLinks = getNavLinks().filter((l) => !l.authRequired || isAuthenticated);
    const staticNav = (
        <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
                <Button asChild variant="ghost" size="sm" key={link.to}>
                    <Link to={link.to}>{link.label}</Link>
                </Button>
            ))}
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
            className={`border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${sticky ? 'sticky top-0' : ''} z-40`}
        >
            <div className={`mx-auto flex items-center justify-between px-4 py-3 ${containerClass}`}>
                <div className="flex items-center gap-2">
                    {leading}
                    <Link to="/" className="font-semibold">
                        {APP_META.appName}
                    </Link>
                    <span className="text-xs text-muted-foreground">TanStack</span>
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
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const { config } = useBrand();

    const navLinks = getNavLinks().filter((l) => !l.authRequired || isAuthenticated);
    const staticNav = (
        <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
                <Button asChild variant="ghost" size="sm" key={link.to}>
                    <Link to={link.to}>{link.label}</Link>
                </Button>
            ))}
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
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className={`mx-auto flex items-center justify-between px-4 py-2 ${containerClass}`}>
                <div className="flex items-center gap-2">
                    {leading}
                    <Link to="/" className="font-semibold text-sm">
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
