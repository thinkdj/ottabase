/**
 * AdminLayout
 *
 * Wraps every /admin/* and /admin-platform/* page with a left
 * sidebar. The nav variant is picked from the current pathname:
 *   - /admin/*           → TENANT_ADMIN_NAV_GROUPS (org admin)
 *   - /admin-platform/*  → ADMIN_PLATFORM_NAV_GROUPS (superadmin)
 *
 * Adding a new admin page only requires (1) a route in
 * router.tsx and (2) one entry in admin-nav.
 */

import { resolveAdminSurface } from '@/ottabase/config/admin-nav';
import { Input } from '@ottabase/ui-shadcn';
import { Link, useLocation } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';
import { memo, useMemo, useState, type ReactNode } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
}

export const AdminLayout = memo(function AdminLayout({ children }: AdminLayoutProps) {
    const { pathname } = useLocation();
    const surface = useMemo(() => resolveAdminSurface(pathname), [pathname]);
    const [search, setSearch] = useState('');

    const filteredGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) {
            return surface.groups.map((group) => ({
                ...group,
                items: group.items.filter((item) => !item.external),
            }));
        }

        return surface.groups
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
    }, [surface.groups, search]);

    const OverviewIcon = surface.overviewIcon;

    return (
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
            <aside className="w-full md:w-60 md:shrink-0">
                <nav className="flex flex-col gap-4 md:sticky md:top-20">
                    <div className="px-0.5">
                        <div className="relative">
                            <Search className="pointer-events-none absolute h-3.5 w-3.5 left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder={`Search ${surface.label.toLowerCase()}...`}
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
                    </div>

                    {!search && (
                        <Link
                            to={surface.rootPath as never}
                            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                pathname === surface.rootPath
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-foreground hover:bg-accent/50'
                            }`}
                        >
                            <OverviewIcon className="h-4 w-4" />
                            Overview
                        </Link>
                    )}

                    {filteredGroups.map((group) => (
                        <div key={group.id} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                                <group.icon className="h-3.5 w-3.5" />
                                {group.label}
                            </div>
                            {group.items
                                .filter((item) => !item.external)
                                .map((item) => {
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== surface.rootPath && pathname.startsWith(`${item.href}/`));
                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href as never}
                                            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                                                isActive
                                                    ? 'bg-accent text-accent-foreground font-medium'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                            }`}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            {item.title}
                                        </Link>
                                    );
                                })}
                        </div>
                    ))}

                    {search && filteredGroups.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                    )}
                </nav>
            </aside>

            <main className="min-w-0 flex-1">{children}</main>
        </div>
    );
});
