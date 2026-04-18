import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from '@ottabase/ui-shadcn';
import { MenuRenderer, type MenuForRender, type MenuItemDto, type MenuRenderType } from '@ottabase/ottamenu';
import { IconLayoutNavbar, IconMenu2 } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

const DEMO_ITEMS: MenuItemDto[] = [
    { id: 'home', menuId: 'demo-menu', name: 'Home', link: '/' },
    { id: 'docs', menuId: 'demo-menu', name: 'Docs', link: '/docs' },
    { id: 'products', menuId: 'demo-menu', name: 'Products', link: '#', sortOrder: 1 },
    { id: 'ui-kit', menuId: 'demo-menu', parentId: 'products', name: 'UI Kit', link: '/demo/shadcn' },
    { id: 'forms', menuId: 'demo-menu', parentId: 'products', name: 'Forms', link: '/demo/ottaforms' },
    { id: 'advanced', menuId: 'demo-menu', parentId: 'products', name: 'Advanced', link: '#', sortOrder: 3 },
    { id: 'renderer', menuId: 'demo-menu', parentId: 'advanced', name: 'Renderer', link: '/demo/renderer' },
    { id: 'menus', menuId: 'demo-menu', parentId: 'advanced', name: 'Menus', link: '/demo/menus' },
    { id: 'pricing', menuId: 'demo-menu', name: 'Pricing', link: '/pricing' },
    { id: 'admin', menuId: 'demo-menu', name: 'Admin', link: '/admin', authRequired: true },
];

const RENDER_TYPES: MenuRenderType[] = ['flyout', 'mega', 'navbar', 'dropdown', 'sidebar', 'footer'];

export function MenusDemoPage() {
    const [renderType, setRenderType] = useState<MenuRenderType>('flyout');
    const [pathname, setPathname] = useState('/demo/menus');
    const [simulateAuth, setSimulateAuth] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const menu = useMemo<MenuForRender>(() => ({ items: DEMO_ITEMS }), []);

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Menus Demo</h1>
                <p className="text-muted-foreground">
                    Interactive renderer playground for <code>@ottabase/ottamenu</code>. Uses mock menu data so it works
                    without login.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconMenu2 className="h-5 w-5" />
                        Controls
                    </CardTitle>
                    <CardDescription>Switch renderers, active path, and auth filtering behavior.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {RENDER_TYPES.map((type) => (
                            <Button
                                key={type}
                                variant={renderType === type ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setRenderType(type)}
                            >
                                {type}
                            </Button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['/demo/menus', '/demo/renderer', '/admin', '/docs'].map((path) => (
                            <Button
                                key={path}
                                variant={pathname === path ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPathname(path)}
                            >
                                {path}
                            </Button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Switch checked={simulateAuth} onCheckedChange={setSimulateAuth} />
                            Simulate authenticated user
                        </label>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Switch checked={expanded} onCheckedChange={setExpanded} />
                            Expanded mode (mega/navbar)
                        </label>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconLayoutNavbar className="h-5 w-5" />
                        Renderer Output
                    </CardTitle>
                    <CardDescription>
                        Current type: <code>{renderType}</code> · Pathname: <code>{pathname}</code> · Auth:{' '}
                        <code>{simulateAuth ? 'true' : 'false'}</code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border bg-background p-4">
                        <MenuRenderer
                            menu={menu}
                            type={renderType}
                            options={{ pathname, isAuthenticated: simulateAuth, expanded }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
