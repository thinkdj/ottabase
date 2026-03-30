/**
 * Homepage Admin Navigation
 *
 * Tab navigation for the homepage management section.
 * Uses shadcn Tabs for a polished, consistent admin experience.
 */
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { Home, Layout, Monitor, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@ottabase/ui-shadcn';

const TABS = [
    { href: '/admin/homepage', label: 'Sections', icon: Layout, exact: true },
    { href: '/admin/homepage/display', label: 'Display', icon: Monitor },
    { href: '/admin/homepage/pages', label: 'Pages', icon: FileText },
] as const;

export function HomepageAdminNav() {
    const { location } = useRouterState();
    const navigate = useNavigate();
    const pathname = location.pathname;

    // Determine the active tab value from the current path
    const activeTab =
        TABS.find((tab) => ('exact' in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)))
            ?.href ?? TABS[0].href;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-2">
                    <Home className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Homepage Manager</h2>
                    <p className="text-xs text-muted-foreground">Configure sections, display settings, and CMS pages</p>
                </div>
            </div>
            <Tabs value={activeTab} onValueChange={(v) => navigate({ to: v })}>
                <TabsList className="w-full justify-start">
                    {TABS.map(({ href, label, icon: Icon }) => (
                        <TabsTrigger key={href} value={href} className="gap-1.5" asChild>
                            <Link to={href}>
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </Link>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );
}
