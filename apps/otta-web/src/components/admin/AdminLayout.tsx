/**
 * AdminLayout
 *
 * Wraps every /admin/* page with the Design System v1 admin frame: a sticky
 * sidebar built from `apps/otta-web/src/ottabase/config/admin-nav.ts` (SSOT),
 * grouped the way the manifests group pages, a lock on Premium Package
 * entries, and the page beside it. On narrow screens the sidebar becomes a
 * left drawer behind a Menu button.
 *
 * - The active item is highlighted on the accent fill; a parent never stays
 *   lit when a nested sibling is active (longest href wins).
 * - Page content fades up once per navigation (the one entrance motion).
 * - The layout is intentionally thin — adding a new admin page only
 *   requires (1) a route in router.tsx and (2) one entry in admin-nav.
 */

import { isOrgAdmin, isPlatformAdmin, useSession } from '@/lib/auth';
import { getEnabledAdminNav, type AdminNavGroup } from '@/ottabase/config/admin-nav';
import { Button, Input, PremiumMark, Sheet, SheetContent, SheetTitle, SheetTrigger } from '@ottabase/ui';
import { Link, useLocation } from '@tanstack/react-router';
import { LayoutDashboard, Menu, Search, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
}

const NAV_ITEM =
    'flex h-[34px] shrink-0 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition duration-fast ease-theme';
const NAV_ITEM_IDLE = 'text-sidebar-foreground hover:bg-muted hover:text-foreground';
const NAV_ITEM_ACTIVE = 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground';

function AdminNav({
    groups,
    activeHref,
    pathname,
    search,
    onSearch,
    onNavigate,
}: {
    groups: AdminNavGroup[];
    activeHref: string | null;
    pathname: string;
    search: string;
    onSearch: (value: string) => void;
    onNavigate?: () => void;
}) {
    const isOverview = pathname === '/admin';
    return (
        <>
            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint-foreground" />
                <Input
                    placeholder="Filter pages"
                    aria-label="Filter admin pages"
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    className="h-8 pl-8 pr-8 text-sm"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => onSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear filter"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>

            {!search && (
                <Link
                    to={'/admin' as never}
                    aria-current={isOverview ? 'page' : undefined}
                    onClick={onNavigate}
                    className={`${NAV_ITEM} ${isOverview ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`}
                >
                    <LayoutDashboard className="size-4 shrink-0" />
                    Overview
                </Link>
            )}

            {groups.map((group) => (
                <div key={group.id} className="flex flex-col gap-px">
                    <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint-foreground">
                        {group.label}
                    </div>
                    {group.items.map((item) => {
                        const isActive = item.href === activeHref;
                        return (
                            <Link
                                key={item.href}
                                to={item.href as never}
                                aria-current={isActive ? 'page' : undefined}
                                onClick={onNavigate}
                                className={`${NAV_ITEM} ${isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`}
                            >
                                <item.icon className="size-4 shrink-0" />
                                <span className="truncate">{item.title}</span>
                                {item.premium && <PremiumMark iconOnly className="ml-auto" />}
                            </Link>
                        );
                    })}
                </div>
            ))}

            {search && groups.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">No pages match</p>
            )}
        </>
    );
}

export const AdminLayout = memo(function AdminLayout({ children }: AdminLayoutProps) {
    const { user } = useSession();
    // Show only the sections the caller can actually use: platform admins see everything, org
    // admins see just their own-tenant sections (rather than a wall of control-plane pages).
    const groups = useMemo(
        () => getEnabledAdminNav({ isPlatformAdmin: isPlatformAdmin(user), isOrgAdmin: isOrgAdmin(user) }),
        [user],
    );
    const { pathname } = useLocation();
    const [search, setSearch] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const pageRef = useRef<HTMLElement>(null);

    const filteredGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) {
            return groups.map((group) => ({
                ...group,
                items: group.items.filter((item) => !item.external),
            }));
        }

        return groups
            .map((group) => ({
                ...group,
                items: group.items.filter(
                    (item) =>
                        !item.external &&
                        (item.title.toLowerCase().includes(q) ||
                            item.description.toLowerCase().includes(q) ||
                            group.label.toLowerCase().includes(q)),
                ),
            }))
            .filter((group) => group.items.length > 0);
    }, [groups, search]);

    // Longest matching href wins, so a parent (/admin/content/blog) doesn't stay
    // highlighted when a nested sibling (/admin/content/blog/studio) is active.
    const activeHref = useMemo(() => {
        let best: string | null = null;
        for (const group of groups) {
            for (const item of group.items) {
                if (item.href === '/admin') continue;
                if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
                    if (!best || item.href.length > best.length) best = item.href;
                }
            }
        }
        return best;
    }, [groups, pathname]);

    const activeTitle = useMemo(() => {
        if (pathname === '/admin') return 'Overview';
        for (const group of groups) {
            const hit = group.items.find((item) => item.href === activeHref);
            if (hit) return hit.title;
        }
        return 'Admin';
    }, [groups, activeHref, pathname]);

    // The one entrance: page content fades up once per navigation. Web Animations
    // rather than a keyed remount, so a page keeps its state across nested routes.
    useEffect(() => {
        const el = pageRef.current;
        if (!el || typeof el.animate !== 'function') return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        el.animate(
            [
                { opacity: 0, transform: 'translateY(8px)' },
                { opacity: 1, transform: 'none' },
            ],
            {
                duration: 360,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            },
        );
    }, [pathname]);

    const nav = (onNavigate?: () => void) => (
        <AdminNav
            groups={filteredGroups}
            activeHref={activeHref}
            pathname={pathname}
            search={search}
            onSearch={setSearch}
            onNavigate={onNavigate}
        />
    );

    return (
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:gap-6">
            <aside className="hidden w-60 shrink-0 md:block" aria-label="Admin navigation">
                <nav className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col gap-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {nav()}
                </nav>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex items-center gap-3 md:hidden">
                    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm" aria-label="Open admin navigation">
                                <Menu className="size-4" />
                                Menu
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-72 gap-4 overflow-y-auto p-4 sm:max-w-xs">
                            <SheetTitle className="text-sm">Admin</SheetTitle>
                            <nav className="flex flex-col gap-4" aria-label="Admin navigation">
                                {nav(() => setDrawerOpen(false))}
                            </nav>
                        </SheetContent>
                    </Sheet>
                    <span className="truncate text-sm font-semibold">{activeTitle}</span>
                </div>

                <main ref={pageRef} className="min-w-0 flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
});
