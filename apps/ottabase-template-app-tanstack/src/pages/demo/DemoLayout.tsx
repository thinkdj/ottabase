import { Button } from '@ottabase/ui-shadcn';
import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import {
    Clock,
    Cloud,
    Code,
    Database,
    Mail,
    FileText,
    Layout,
    List,
    Palette,
    Settings,
    Type,
    Upload,
    Zap,
} from 'lucide-react';

interface DemoLinkProps {
    to: string;
    icon: React.ElementType;
    label: string;
}

const DEMO_LINKS: DemoLinkProps[] = [
    { to: '/demo/state', icon: Settings, label: 'State Management' },
    { to: '/demo/mantine', icon: Layout, label: 'Mantine UI' },
    { to: '/demo/shadcn', icon: Palette, label: 'shadcn/ui' },
    { to: '/demo/ottaeditor', icon: Type, label: 'OttaEditor' },
    { to: '/demo/ottaorm', icon: Database, label: 'OttaORM' },
    { to: '/demo/ottaforms', icon: FileText, label: 'OttaForms' },
    { to: '/demo/ottaselect', icon: List, label: 'OttaSelect' },
    { to: '/demo/cloudflare', icon: Cloud, label: 'Cloudflare Services' },
    { to: '/demo/cloudflare/file-upload', icon: Upload, label: 'File Upload' },
    { to: '/demo/timezone', icon: Clock, label: 'Timezone Utils' },
    { to: '/demo/api', icon: Zap, label: 'API Client' },
    { to: '/demo/renderer', icon: Code, label: 'Content Renderer' },
    { to: '/demo/email', icon: Mail, label: 'Email Templates' },
];

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
                        {DEMO_LINKS.map((link) => (
                            <Button
                                key={link.to}
                                asChild
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'w-full justify-start gap-2',
                                    location.pathname.startsWith(link.to)
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Link to={link.to}>
                                    <link.icon className="h-4 w-4" />
                                    {link.label}
                                </Link>
                            </Button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 overflow-auto bg-background/50">
                <div className="container mx-auto py-8 pr-8 lg:pr-12">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
