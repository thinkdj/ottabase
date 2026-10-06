/**
 * AdminLayout
 *
 * Wraps every /admin/* page with navigation built from
 * `apps/otta-web/src/ottabase/config/admin-nav.ts` (SSOT).
 *
 * - Desktop: a sticky left sidebar with grouped sections and a filter box.
 * - Phone: one compact "current page" bar that opens the same nav in a sheet,
 *   instead of ~24 links stacked above every page.
 * - The active item is highlighted and marked aria-current="page".
 * - Adding a new admin page only requires (1) a route in router.tsx and
 *   (2) one entry in admin-nav.
 */

import { isOrgAdmin, isPlatformAdmin, useSession } from '@/lib/auth';
import { SEOHead } from '@/components/SEOHead';
import { APP_META } from '@/ottabase/config';
import { getEnabledAdminNav, type AdminNavGroup } from '@/ottabase/config/admin-nav';
import { Button, Input, Sheet, SheetContent, SheetHeader, SheetTitle } from '@ottabase/ui-shadcn';
import { Link, useLocation } from '@tanstack/react-router';
import { LayoutDashboard, Menu, Search, X } from 'lucide-react';
import { memo, useMemo, useState, type ReactNode } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
}

interface AdminNavListProps {
    groups: AdminNavGroup[];
    pathname: string;
    activeHref: string | null;
    /** Called after a link is followed (closes the mobile sheet) */
    onNavigate?: () => void;
}

/** Filter box + Overview + grouped links; shared by the desktop sidebar and the mobile sheet */
function AdminNavList({ groups, pathname, activeHref, onNavigate }: AdminNavListProps) {
    const [search, setSearch] = useState('');

    const filteredGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const visible = groups.map((group) => ({ ...group, items: group.items.filter((item) => !item.external) }));
        if (!q) return visible;
        return visible
            .map((group) => ({
                ...group,
                items: group.items.filter(
                    (item) =>
                        item.title.toLowerCase().includes(q) ||
                        item.description.toLowerCase().includes(q) ||
                        group.label.toLowerCase().includes(q),
                ),
            }))
            .filter((group) => group.items.length > 0);
    }, [groups, search]);

    const isOverview = pathname === '/admin';

    return (
        <div className="flex flex-col gap-4">
            <div className="relative px-0.5">
                <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    placeholder="Filter admin pages…"
                    aria-label="Filter admin pages"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 pr-8 text-sm"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear filter"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {!search && (
                <Link
                    to={'/admin' as never}
                    onClick={onNavigate}
                    aria-current={isOverview ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isOverview ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                    }`}
                >
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    Overview
                </Link>
            )}

            {filteredGroups.map((group) => (
                <div key={group.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                        <group.icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {group.label}
                    </div>
                    {group.items.map((item) => {
                        const isActive = item.href === activeHref;
                        return (
                            <Link
                                key={item.href}
                                to={item.href as never}
                                onClick={onNavigate}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                                    isActive
                                        ? 'bg-accent font-medium text-accent-foreground'
                                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                }`}
                            >
                                <item.icon className="h-4 w-4" aria-hidden="true" />
                                {item.title}
                            </Link>
                        );
                    })}
                </div>
            ))}

            {search && filteredGroups.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No matching admin pages</p>
            )}
        </div>
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
    const [mobileOpen, setMobileOpen] = useState(false);

    // Longest matching href wins, so a parent (/admin/content/blog) doesn't stay
    // highlighted when a nested sibling (/admin/content/blog/studio) is active.
    const active = useMemo(() => {
        let best: { href: string; title: string; group: string } | null = null;
        for (const group of groups) {
            for (const item of group.items) {
                if (item.href === '/admin') continue;
                if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
                    if (!best || item.href.length > best.href.length) {
                        best = { href: item.href, title: item.title, group: group.label };
                    }
                }
            }
        }
        return best;
    }, [groups, pathname]);

    const activeHref = active?.href ?? null;
    const tabTitle = `${active ? `${active.title} · ` : ''}Admin · ${APP_META.appName}`;
    const currentTitle = pathname === '/admin' ? 'Overview' : (active?.title ?? 'Admin');

    return (
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
            <SEOHead title={tabTitle} />
            {/* Phone: one compact bar; the full nav opens in a sheet */}
            <div className="md:hidden">
                <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setMobileOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={mobileOpen}
                >
                    <Menu className="h-4 w-4" aria-hidden="true" />
                    <span className="truncate">
                        {active ? <span className="text-muted-foreground">{active.group} · </span> : null}
                        {currentTitle}
                    </span>
                </Button>
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetContent side="left" className="w-[18rem] overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>Admin</SheetTitle>
                        </SheetHeader>
                        <nav aria-label="Admin" className="mt-4">
                            <AdminNavList
                                groups={groups}
                                pathname={pathname}
                                activeHref={activeHref}
                                onNavigate={() => setMobileOpen(false)}
                            />
                        </nav>
                    </SheetContent>
                </Sheet>
            </div>

            <aside className="hidden md:block md:w-60 md:shrink-0">
                <nav aria-label="Admin" className="md:sticky md:top-20">
                    <AdminNavList groups={groups} pathname={pathname} activeHref={activeHref} />
                </nav>
            </aside>

            {/* Not a <main>: the app shell already renders one around every page */}
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
});
