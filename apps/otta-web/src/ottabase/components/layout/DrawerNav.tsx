import { isAdminUser, useSession } from '@/lib/auth';
import { useBrand } from '@ottabase/brand-engine-react';
import type { ResolvedMenuSlotData } from '@ottabase/ottamenu/render';
import { MenuSlotRenderer } from '@ottabase/ottamenu/render';
import { APP_META } from '@/ottabase/config';
import { Button } from '@ottabase/ui-shadcn';
import { Link, useLocation } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getNavLinks } from './layout.constants';

export function DrawerNav() {
    const { isAuthenticated, user } = useSession();
    const location = useLocation();
    const { config } = useBrand();
    const [open, setOpen] = useState(false);

    const isAdmin = isAdminUser(user);
    const links = getNavLinks({ isAuthenticated, isAdmin });
    const staticNav = links.map((link) => {
        const isActive = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
        return (
            <Link
                key={link.to}
                to={link.to}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-2 text-sm rounded-lg transition-colors duration-normal ${
                    isActive
                        ? 'bg-background text-foreground font-medium ring-1 ring-border'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
                onClick={() => setOpen(false)}
            >
                {link.label}
            </Link>
        );
    });

    const navContent = config?.menuSlots ? (
        <MenuSlotRenderer
            slot="mobile-nav"
            menuSlots={config.menuSlots as Record<string, ResolvedMenuSlotData[]> | undefined}
            options={{ isAuthenticated: !!isAuthenticated, pathname: location.pathname }}
            fallback={staticNav}
            className="flex flex-col gap-0.5"
        />
    ) : (
        staticNav
    );

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
                        <div
                            className="fixed inset-0 bg-black/40 z-50"
                            onClick={() => setOpen(false)}
                            role="presentation"
                        />
                        <div
                            className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-border/60 shadow-lg z-50 flex flex-col animate-in slide-in-from-left duration-normal"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Navigation Menu"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-border/60">
                                <span className="text-sm font-semibold">{APP_META.appName}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 px-0"
                                    onClick={() => setOpen(false)}
                                    aria-label="Close menu"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <nav className="flex flex-col gap-0.5 p-3 overflow-y-auto flex-1">{navContent}</nav>
                        </div>
                    </>,
                    document.body,
                )}
        </>
    );
}
