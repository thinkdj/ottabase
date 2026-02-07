import { useSession } from '@/lib/auth';
import { APP_META } from '@/ottabase/config/app.config';
import { Button } from '@ottabase/ui-shadcn';
import { Link, useLocation } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NAV_LINKS } from './layout.constants';

export function DrawerNav() {
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
                        <div
                            className="fixed inset-0 bg-black/40 z-50"
                            onClick={() => setOpen(false)}
                            role="presentation"
                        />
                        <div
                            className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r z-50 flex flex-col animate-in slide-in-from-left duration-200"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Navigation Menu"
                        >
                            <div className="flex items-center justify-between p-4 border-b">
                                <span className="font-semibold text-sm">{APP_META.appName}</span>
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
