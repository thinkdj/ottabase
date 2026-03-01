// ---------------------------------------------------------------------------
// ResumeMeLayout — Custom app shell for the ResumeMe app.
// Clean header-focused layout with inline nav links (no sidebar).
// ---------------------------------------------------------------------------

import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSession } from '@/lib/auth';
import { getNavLinks } from '@/ottabase/components/layout/layout.constants';
import { APP_META } from '@/ottabase/config';
import { organizationIdAtom } from '@/ottabase/state/appState';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@ottabase/ui-shadcn';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useSetAtom } from 'jotai';
import { LogIn, LogOut, Menu, X } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

// ── Organization selection hook ──
function useOrganizationSelection() {
    const [currentOrgId, setCurrentOrgId] = useLocalStorage<string>('ottabase.current-org-id');
    const setOrganizationId = useSetAtom(organizationIdAtom);
    const setOrganization = (orgId: string) => {
        setCurrentOrgId(orgId);
        setOrganizationId(orgId);
    };
    return { currentOrgId, setOrganization };
}

// ── User avatar + logout button ──
const UserSection = memo(function UserSection() {
    const { isAuthenticated, user, logout } = useSession({ skipAutoSync: true });
    const navigate = useNavigate();

    const handleLogout = useCallback(() => {
        logout();
        navigate({ to: '/' });
    }, [logout, navigate]);

    const userInitials = user?.name?.trim()
        ? user.name
              .split(' ')
              .filter(Boolean)
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
        : (user?.email?.[0]?.toUpperCase() ?? '?');

    if (!isAuthenticated) {
        return (
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                    <Link to="/auth/signup">Sign up</Link>
                </Button>
                <Button asChild variant="default" size="sm">
                    <Link to="/auth/signin" className="flex items-center gap-1.5">
                        <LogIn className="h-4 w-4" />
                        Login
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
                <Link to="/user/profile" className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                        {user?.image && <AvatarImage src={user.image} />}
                        <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                    {user?.name || user?.email}
                </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
            </Button>
        </div>
    );
});

// ── Mobile nav drawer ──
function MobileNav() {
    const { isAuthenticated } = useSession({ skipAutoSync: true });
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const links = getNavLinks(!!isAuthenticated);

    const overlay = open
        ? createPortal(
              <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />
                  {/* Drawer panel */}
                  <nav className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r shadow-lg flex flex-col p-4 gap-1">
                      <div className="flex items-center justify-between mb-4">
                          <span className="font-semibold text-sm">{APP_META.appName}</span>
                          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                              <X className="h-4 w-4" />
                          </Button>
                      </div>
                      {links.map((link) => {
                          const active =
                              location.pathname === link.to ||
                              (link.to !== '/' && location.pathname.startsWith(link.to));
                          return (
                              <Link
                                  key={link.to}
                                  to={link.to}
                                  onClick={() => setOpen(false)}
                                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                                      active
                                          ? 'bg-accent text-accent-foreground font-medium'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                  }`}
                              >
                                  {link.label}
                              </Link>
                          );
                      })}
                  </nav>
              </>,
              document.body,
          )
        : null;

    return (
        <>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
                <Menu className="h-5 w-5" />
            </Button>
            {overlay}
        </>
    );
}

// ── Main layout ──
export const ResumeMeLayout = memo(function ResumeMeLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useSession({ skipAutoSync: true });
    const { currentOrgId, setOrganization } = useOrganizationSelection();
    const location = useLocation();
    const links = getNavLinks(!!isAuthenticated);

    return (
        <div className="min-h-screen bg-background font-sans flex flex-col">
            {/* ── Header ── */}
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
                <div className="mx-auto flex items-center justify-between px-4 py-2.5 max-w-screen-2xl">
                    {/* Left: mobile hamburger + logo */}
                    <div className="flex items-center gap-2">
                        <MobileNav />
                        <Link to="/" className="flex items-center gap-2">
                            <span className="font-semibold">{APP_META.appName}</span>
                        </Link>
                    </div>

                    {/* Centre: desktop nav links */}
                    <nav className="hidden md:flex items-center gap-1">
                        {links.map((link) => {
                            const active =
                                location.pathname === link.to ||
                                (link.to !== '/' && location.pathname.startsWith(link.to));
                            return (
                                <Button asChild variant={active ? 'secondary' : 'ghost'} size="sm" key={link.to}>
                                    <Link to={link.to}>{link.label}</Link>
                                </Button>
                            );
                        })}
                    </nav>

                    {/* Right: controls + user */}
                    <div className="flex items-center gap-1.5">
                        <DarkModeToggle type="button" title="Toggle dark/light mode" />
                        {isAuthenticated && (
                            <OrganizationSwitcher currentOrgId={currentOrgId} onOrgChange={setOrganization} />
                        )}
                        <UserSection />
                    </div>
                </div>
            </header>

            {/* ── Main content ── */}
            <main className="flex-1">{children}</main>

            {/* ── Footer ── */}
            <footer className="border-t mt-auto">
                <div className="mx-auto px-4 py-6 text-center text-xs text-muted-foreground max-w-screen-2xl">
                    Built with Ottabase
                </div>
            </footer>
        </div>
    );
});
