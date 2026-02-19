import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@ottabase/ui-shadcn';
import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { Layout } from 'lucide-react';
import { DEMO_ITEMS } from './demoItems';

export function DemoLayout() {
    const location = useLocation();

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)]">
            {/* Sidebar */}
            <aside className="w-64 shrink-0 border-r bg-muted/10 hidden md:block">
                <div className="flex h-full flex-col gap-2 py-6 px-3">
                    <div className="px-3 mb-2">
                        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-4">
                            Demos
                        </h2>
                    </div>
                    <div className="space-y-1">
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
                        {DEMO_ITEMS.map((item) => (
                            <Button
                                key={item.to}
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
