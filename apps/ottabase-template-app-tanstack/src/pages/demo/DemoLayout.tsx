import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button, Input } from '@ottabase/ui-shadcn';
import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { Layout, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEMO_ITEMS } from './demoItems';

export function DemoLayout() {
    const location = useLocation();
    const [search, setSearch] = useState('');

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return DEMO_ITEMS;
        return DEMO_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
    }, [search]);

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)]">
            {/* Sidebar */}
            <aside className="w-64 shrink-0 border-r bg-muted/10 hidden md:block">
                <div className="flex h-full flex-col gap-2 py-6 px-3">
                    <div className="px-0.5 mb-1.5">
                        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
                            Demos
                        </h2>
                        {/* Search (local filter) */}
                        <div className="relative">
                            <Search className="pointer-events-none absolute h-3.5 w-3.5 left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search…"
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
                    <div className="space-y-1 overflow-y-auto">
                        {/* Overview link – always shown */}
                        {!search && (
                            <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'w-full justify-start gap-2',
                                    location.pathname === '/demo' || location.pathname === '/demo/'
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Link to="/demo">
                                    <Layout className="h-4 w-4" />
                                    Overview
                                </Link>
                            </Button>
                        )}
                        {filteredItems.map((item, index) => (
                            <Button
                                key={String(index) + '-' + String(item.to)}
                                asChild
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'w-full justify-start gap-2',
                                    location.pathname.startsWith(item.to)
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Link to={item.to}>
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            </Button>
                        ))}
                        {search && filteredItems.length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                        )}
                    </div>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 overflow-auto bg-background/50">
                <div className="container mx-auto px-6 py-12 max-w-7xl">
                    <div className="mb-6">
                        <Breadcrumbs />
                    </div>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
