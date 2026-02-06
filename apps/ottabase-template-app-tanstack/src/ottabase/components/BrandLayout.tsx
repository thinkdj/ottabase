import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { ReferralTracker } from '@/components/ReferralTracker';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSession } from '@/lib/auth';
import { ThemeSwitcher } from '@/ottabase/components/ThemeSwitcher';
import { APP_META } from '@/ottabase/config/app.config';
import { i18nConfig } from '@/ottabase/config/i18n.config';
import { useTheme } from '@/ottabase/providers/ThemeContext';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@ottabase/ui-shadcn';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { LogIn, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { LayoutConfig } from '@ottabase/brand-engine';

// ---------------------------------------------------------------------------
// Nav link definitions (shared across all layout variants)
// ---------------------------------------------------------------------------

interface NavLink {
    to: string;
    label: string;
    authRequired?: boolean;
}

const NAV_LINKS: NavLink[] = [
    { to: '/', label: 'Home' },
    { to: '/blog', label: 'Blog' },
    { to: '/demo', label: 'Demo' },
    { to: '/shortlinks', label: 'Links' },
    { to: '/admin', label: 'Admin' },
    { to: '/dashboard', label: 'Dashboard', authRequired: true },
    { to: '/referrals', label: 'Referrals', authRequired: true },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentWidthClass(contentWidth: LayoutConfig['contentWidth']): string {
    switch (contentWidth) {
        case 'fixed':
            return 'max-w-5xl';
        case 'fluid':
            return 'max-w-7xl';
        case 'full':
            return 'w-full';
        default:
            return 'max-w-5xl';
    }
}

function densityPadding(density: LayoutConfig['density']): string {
    return density === 'compact' ? 'py-4' : 'py-10';
}

// ---------------------------------------------------------------------------
// User info
// ---------------------------------------------------------------------------

function UserSection({ compact }: { compact?: boolean }) {
    const { isAuthenticated, user, logout } = useSession();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate({ to: '/' });
    };

    const userInitials =
        user?.name && user.name.trim().length > 0
            ? user.name
                  .split(' ')
                  .filter((n: string) => n.length > 0)
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()
            : user?.email && user.email.length > 0
              ? user.email[0].toUpperCase()
              : '?';

    if (!isAuthenticated) {
        return (
            <div className={`flex items-center gap-2 ${compact ? '' : 'ml-2'}`}>
                <Button asChild variant="ghost" size="sm">
                    <Link to="/register">Sign up</Link>
                </Button>
                <Button asChild variant="default" size="sm">
                    <Link to="/login" className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Login
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 ${compact ? '' : 'ml-2 pl-2 border-l'}`}>
            <Button asChild variant="ghost" size="sm">
                <Link to="/profile" className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                        {user?.image && <AvatarImage src={user.image} />}
                        <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                    {!compact && (user?.name || user?.email)}
                </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
            </Button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Controls (theme switcher, dark mode, language, org)
// ---------------------------------------------------------------------------

function ControlsSection() {
    const { isAuthenticated } = useSession();
    const [currentOrgId, setCurrentOrgId] = useLocalStorage<string>('currentOrgId');

    return (
        <div className="flex items-center gap-1">
            <ThemeSwitcher />
            <DarkModeToggle type="button" title="Toggle dark/light mode" />
            <LanguageSwitcher languages={i18nConfig.enabledLanguages} showLabel={false} />
            {isAuthenticated && (
                <OrganizationSwitcher currentOrgId={currentOrgId} onOrgChange={setCurrentOrgId} />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Drawer Navigation (mobile-first hamburger menu)
// ---------------------------------------------------------------------------

function DrawerNav() {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={() => setOpen(true)} title="Open menu">
                <Menu className="h-5 w-5" />
            </Button>

            {/* Portal to document.body so the overlay is not clipped by the
                sticky header's backdrop-blur stacking context */}
            {open &&
                createPortal(
                    <>
                        <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setOpen(false)} />
                        <div className="fixed inset-y-0 left-0 w-64 bg-sidebar-background border-r z-50 flex flex-col animate-in slide-in-from-left duration-200">
                            <div className="flex items-center justify-between p-4 border-b">
                                <span className="font-semibold text-sm">{APP_META.appName}</span>
                                <Button variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={() => setOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <nav className="flex flex-col gap-0.5 p-3 overflow-y-auto flex-1">
                                {NAV_LINKS.filter((l) => !l.authRequired || isAuthenticated).map((link) => {
                                    const isActive =
                                        location.pathname === link.to ||
                                        (link.to !== '/' && location.pathname.startsWith(link.to));
                                    return (
                                        <Link
                                            key={link.to}
                                            to={link.to}
                                            className={`px-3 py-2 text-sm rounded-md transition-colors ${
                                                isActive
                                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                            }`}
                                            onClick={() => setOpen(false)}
                                        >
                                            {link.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    </>,
                    document.body,
                )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Sidebar Navigation (desktop persistent sidebar)
// ---------------------------------------------------------------------------

function SidebarNav() {
    const { isAuthenticated } = useSession();
    const location = useLocation();
    const links = NAV_LINKS.filter((l) => !l.authRequired || isAuthenticated);

    return (
        <aside className="w-full border-b bg-sidebar-background md:w-56 md:shrink-0 md:border-b-0 md:border-r md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:overflow-y-auto">
            <nav className="flex gap-1 p-2 overflow-x-auto md:flex-col md:gap-0.5 md:p-3 md:overflow-x-visible">
                {links.map((link) => {
                    const isActive =
                        location.pathname === link.to ||
                        (link.to !== '/' && location.pathname.startsWith(link.to));
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

// ---------------------------------------------------------------------------
// Header variants
// ---------------------------------------------------------------------------

function TopbarHeader({
    showNav,
    containerClass,
    leading,
}: {
    showNav: boolean;
    containerClass: string;
    leading?: React.ReactNode;
}) {
    const { isAuthenticated } = useSession();

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className={`mx-auto flex items-center justify-between px-4 py-3 ${containerClass}`}>
                <div className="flex items-center gap-2">
                    {leading}
                    <Link to="/" className="font-semibold">
                        {APP_META.appName}
                    </Link>
                    <span className="text-xs text-muted-foreground">TanStack</span>
                </div>

                {showNav && (
                    <nav className="hidden md:flex items-center gap-1">
                        {NAV_LINKS.filter((l) => !l.authRequired || isAuthenticated).map((link) => (
                            <Button asChild variant="ghost" size="sm" key={link.to}>
                                <Link to={link.to}>{link.label}</Link>
                            </Button>
                        ))}
                    </nav>
                )}

                <div className="flex items-center gap-2">
                    <ControlsSection />
                    <UserSection />
                </div>
            </div>
        </header>
    );
}

function MinimalHeader({ containerClass, leading }: { containerClass: string; leading?: React.ReactNode }) {
    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className={`mx-auto flex items-center justify-between px-4 py-2 ${containerClass}`}>
                <div className="flex items-center gap-2">
                    {leading}
                    <Link to="/" className="font-semibold text-sm">
                        {APP_META.appName}
                    </Link>
                </div>
                <div className="flex items-center gap-2">
                    <ControlsSection />
                    <UserSection compact />
                </div>
            </div>
        </header>
    );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function BrandFooter({ containerClass }: { containerClass: string }) {
    return (
        <footer className="border-t mt-auto">
            <div className={`mx-auto px-4 py-6 text-center text-xs text-muted-foreground ${containerClass}`}>
                Built with Ottabase
            </div>
        </footer>
    );
}

// ---------------------------------------------------------------------------
// BrandLayout – the root layout component driven by BrandEngine config
// ---------------------------------------------------------------------------

export function BrandLayout() {
    const { layout } = useTheme();

    const header = layout?.header ?? 'topbar';
    const navigation = layout?.navigation ?? 'topbar';
    const cw = layout?.contentWidth ?? 'fixed';
    const showFooter = layout?.footer ?? true;
    const density = layout?.density ?? 'comfy';

    const cwClass = contentWidthClass(cw);
    const paddingClass = densityPadding(density);

    const hasSidebar = navigation === 'sidebar';
    const hasDrawer = navigation === 'drawer';
    const navInHeader = navigation === 'topbar';

    // Drawer trigger shown in header for drawer navigation mode
    const drawerTrigger = hasDrawer ? <DrawerNav /> : undefined;

    return (
        <div className="min-h-screen bg-background font-sans flex flex-col">
            <ReferralTracker />

            {/* Header */}
            {header === 'topbar' && (
                <TopbarHeader showNav={navInHeader} containerClass={cwClass} leading={drawerTrigger} />
            )}
            {header === 'sidebar' && (
                <TopbarHeader showNav={false} containerClass="w-full" leading={drawerTrigger} />
            )}
            {header === 'minimal' && <MinimalHeader containerClass={cwClass} leading={drawerTrigger} />}
            {/* header === 'none' renders nothing above the content */}
            {header === 'none' && hasDrawer && (
                <div className="fixed top-4 left-4 z-40">
                    <DrawerNav />
                </div>
            )}

            {/* Body: optional sidebar + content */}
            <div className="flex flex-col md:flex-row flex-1">
                {hasSidebar && <SidebarNav />}

                <main
                    className={`flex-1 min-w-0 mx-auto px-4 ${paddingClass} ${hasSidebar ? 'max-w-none w-full' : cwClass}`}
                >
                    <Outlet />
                </main>
            </div>

            {/* Footer */}
            {showFooter && <BrandFooter containerClass={cwClass} />}
        </div>
    );
}
