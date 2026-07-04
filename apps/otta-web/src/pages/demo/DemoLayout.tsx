import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button, Input } from '@ottabase/ui-shadcn';
import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { Layout, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_ITEMS } from './demoItems';
import './demo.css';

export function DemoLayout() {
    const location = useLocation();
    const [search, setSearch] = useState('');
    const contentRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        // Keep demo navigation predictable: every /demo/* page starts at top.
        // Scroll both the <main> element and the window since the actual scroll
        // container depends on the parent layout (ottalayout may use window scroll).
        contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }, [location.pathname]);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return DEMO_ITEMS;
        return DEMO_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
    }, [search]);

    return (
        <div className="otta-demo flex min-h-[calc(100vh-3.5rem)]">
            {/* Sidebar */}
            <aside className="hidden w-64 shrink-0 border-r md:block">
                <div className="sticky top-0 flex max-h-[calc(100vh-3.5rem)] flex-col gap-3 px-3 py-6">
                    <div className="px-0.5">
                        <h2 className="mb-3 px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Demos
                        </h2>
                        {/* Search (local filter) */}
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                    aria-label="Clear filter"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                    <nav className="-mr-1 space-y-1 overflow-y-auto pr-1">
                        {/* Overview link – always shown */}
                        {!search && (
                            <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'h-8 w-full justify-start gap-2.5 font-normal',
                                    location.pathname === '/demo' || location.pathname === '/demo/'
                                        ? 'bg-muted font-medium text-foreground hover:bg-muted'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                )}
                            >
                                <Link to="/demo">
                                    <Layout className="h-4 w-4 shrink-0 opacity-80" />
                                    Overview
                                </Link>
                            </Button>
                        )}
                        {filteredItems.map((item, index) => {
                            const active = location.pathname.startsWith(item.to);
                            return (
                                <Button
                                    key={String(index) + '-' + String(item.to)}
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        'h-8 w-full justify-start gap-2.5 font-normal',
                                        active
                                            ? 'bg-muted font-medium text-foreground hover:bg-muted'
                                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                    )}
                                >
                                    <Link to={item.to}>
                                        <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                                        {item.label}
                                    </Link>
                                </Button>
                            );
                        })}
                        {search && filteredItems.length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                        )}
                    </nav>
                </div>
            </aside>

            {/* Content */}
            <main ref={contentRef} className="min-w-0 flex-1 overflow-auto bg-background">
                <div className="container mx-auto max-w-6xl px-8 py-10">
                    <div className="mb-6">
                        <Breadcrumbs />
                    </div>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
