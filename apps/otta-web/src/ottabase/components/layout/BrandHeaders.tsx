import { isAdminUser, useSession } from '@/lib/auth';
import { useBrand } from '@ottabase/brand-engine-react';
import type { ResolvedMenuSlotData } from '@ottabase/ottamenu/render';
import { MenuSlotRenderer } from '@ottabase/ottamenu/render';
import { APP_META } from '@/ottabase/config';
import { Link, useLocation } from '@tanstack/react-router';
import { memo } from 'react';
import { ControlsSection } from './ControlsSection';
import { UserSection } from './UserSection';
import { getNavLinks } from './layout.constants';
import { isNavActive, navLinkClass } from './nav-styles';

function SiteWordmark() {
    return (
        <Link
            to="/"
            className="truncate font-serif text-[1.05rem] tracking-[-0.02em] text-foreground transition-colors duration-normal hover:text-foreground/80 sm:text-lg"
        >
            {APP_META.appName}
        </Link>
    );
}

function StaticNav({ navLinks, pathname }: { navLinks: ReturnType<typeof getNavLinks>; pathname: string }) {
    return (
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {navLinks.map((link) => {
                const isActive = isNavActive(pathname, link.to);
                return (
                    <Link
                        key={link.to}
                        to={link.to}
                        aria-current={isActive ? 'page' : undefined}
                        className={navLinkClass(isActive)}
                    >
                        {link.label}
                    </Link>
                );
            })}
        </nav>
    );
}

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
    const staticNav = <StaticNav navLinks={navLinks} pathname={location.pathname} />;

    // Menu slot takes precedence: when menuSlots exists, always try header-nav (even if nav is in sidebar).
    // Fallback: static nav only when showNav (navigation === 'topbar').
    const headerNav = config?.menuSlots ? (
        <MenuSlotRenderer
            slot="header-nav"
            menuSlots={config.menuSlots as Record<string, ResolvedMenuSlotData[]> | undefined}
            options={{ isAuthenticated: !!isAuthenticated, pathname: location.pathname }}
            fallback={showNav ? staticNav : null}
            className="hidden items-center gap-6 md:flex"
        />
    ) : showNav ? (
        staticNav
    ) : null;

    return (
        <header className={`${sticky ? 'sticky top-0' : ''} z-40 bg-background/85 backdrop-blur-md`}>
            <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-5 ${containerClass}`}>
                {/* min-w-0 lets the app name ellipsize instead of wrapping the header onto extra lines */}
                <div className="flex min-w-0 items-center gap-3">
                    {leading}
                    <SiteWordmark />
                    {/* Optional positioning line from ottabase.config meta.tagline — omitted when unset */}
                    {APP_META.tagline && (
                        <span className="hidden whitespace-nowrap text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground md:inline">
                            {APP_META.tagline}
                        </span>
                    )}
                </div>

                {headerNav}

                <div className="flex shrink-0 items-center gap-3">
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
    const staticNav = <StaticNav navLinks={navLinks} pathname={location.pathname} />;

    const headerNav =
        config?.menuSlots && showNav ? (
            <MenuSlotRenderer
                slot="header-nav"
                menuSlots={config.menuSlots as Record<string, ResolvedMenuSlotData[]> | undefined}
                options={{ isAuthenticated: !!isAuthenticated, pathname: location.pathname }}
                fallback={staticNav}
                className="hidden items-center gap-6 md:flex"
            />
        ) : showNav ? (
            staticNav
        ) : null;

    return (
        <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
            <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-5 ${containerClass}`}>
                <div className="flex min-w-0 items-center gap-3">
                    {leading}
                    <SiteWordmark />
                </div>
                {headerNav}
                <div className="flex shrink-0 items-center gap-3">
                    <ControlsSection />
                    <UserSection compact />
                </div>
            </div>
        </header>
    );
});
