import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button, Input } from '@ottabase/ui-shadcn';
import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { Layout, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_GROUPS, DEMO_ITEMS, groupDemos, searchDemos } from './demoItems';
import './demo.css';

export function DemoLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const contentRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        // Keep demo navigation predictable: every /demo/* page starts at top.
        // Scroll both the <main> element and the window since the actual scroll
        // container depends on the parent layout (ottalayout may use window scroll).
        contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }, [location.pathname]);

    const sections = useMemo(() => groupDemos(searchDemos(search)), [search]);
    const linkClass = (active: boolean) =>
        cn(
            'h-8 w-full justify-start gap-2.5 font-normal',
            active
                ? 'bg-muted font-medium text-foreground hover:bg-muted'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        );
    const current =
        DEMO_ITEMS.find((item) => location.pathname === item.to)?.to ??
        DEMO_GROUPS.find((group) => group.overview === location.pathname)?.overview ??
        '/demo';

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
                                placeholder="Search"
                                aria-label="Filter demos"
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
                    <nav className="-mr-1 space-y-4 overflow-y-auto pr-1" aria-label="Demos">
                        {!search && (
                            <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className={linkClass(location.pathname === '/demo' || location.pathname === '/demo/')}
                            >
                                <Link to="/demo">
                                    <Layout className="h-4 w-4 shrink-0 opacity-80" />
                                    Overview
                                </Link>
                            </Button>
                        )}
                        {sections.map(({ group, items }) => (
                            <div key={group.id} className="space-y-0.5">
                                <h3 className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                                    {group.label}
                                </h3>
                                {group.overview && !search && (
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="sm"
                                        className={linkClass(location.pathname === group.overview)}
                                    >
                                        <Link to={group.overview}>
                                            <Layout className="h-4 w-4 shrink-0 opacity-80" />
                                            Overview
                                        </Link>
                                    </Button>
                                )}
                                {items.map((item) => (
                                    <Button
                                        key={item.to}
                                        asChild
                                        variant="ghost"
                                        size="sm"
                                        className={linkClass(location.pathname === item.to)}
                                    >
                                        <Link to={item.to}>
                                            <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                                            {item.label}
                                        </Link>
                                    </Button>
                                ))}
                            </div>
                        ))}
                        {search && sections.length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                        )}
                    </nav>
                </div>
            </aside>

            {/* Content */}
            <main ref={contentRef} className="min-w-0 flex-1 overflow-auto bg-background">
                <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <Breadcrumbs />
                        {/* Phones have no sidebar: the same list as a select */}
                        <label className="md:hidden">
                            <span className="sr-only">Jump to a demo</span>
                            <select
                                value={current}
                                onChange={(e) => void navigate({ to: e.target.value as never })}
                                className="h-9 max-w-[60vw] rounded-lg border border-input bg-background px-2 text-sm"
                            >
                                <option value="/demo">All demos</option>
                                {groupDemos().map(({ group, items }) => (
                                    <optgroup key={group.id} label={group.label}>
                                        {group.overview && <option value={group.overview}>Overview</option>}
                                        {items.map((item) => (
                                            <option key={item.to} value={item.to}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </label>
                    </div>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
