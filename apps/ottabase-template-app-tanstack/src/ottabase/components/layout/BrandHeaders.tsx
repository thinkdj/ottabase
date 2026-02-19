import { useSession } from '@/lib/auth';
import { APP_META } from '@/ottabase/config/app.config';
import { Button } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { memo } from 'react';
import { ControlsSection } from './ControlsSection';
import { UserSection } from './UserSection';
import { NAV_LINKS } from './layout.constants';

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

    const navLinks = NAV_LINKS.filter((l) => !l.authRequired || isAuthenticated);

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

                {showNav && (
                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
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
});

export const MinimalHeader = memo(function MinimalHeader({
    containerClass,
    leading,
}: {
    containerClass: string;
    leading?: React.ReactNode;
}) {
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
});
