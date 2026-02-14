import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Slash } from 'lucide-react';

export function BreadcrumbsDemoPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        Navigation
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight">Smart Breadcrumbs</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Automatic breadcrumb navigation that intelligently uses route metadata and generates human-readable
                    labels from URLs. Fully integrated with TanStack Router.
                </p>
            </div>

            {/* Current Breadcrumbs */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Page Breadcrumbs</CardTitle>
                    <CardDescription>Automatically generated from your current location</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4">
                        <Breadcrumbs />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Navigate to different pages to see the breadcrumbs update automatically.
                    </p>
                </CardContent>
            </Card>

            {/* Variants */}
            <Card>
                <CardHeader>
                    <CardTitle>Variants</CardTitle>
                    <CardDescription>Different configurations and display options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Default */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Default</div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <Breadcrumbs />
                        </div>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{'<Breadcrumbs />'}</code>
                    </div>

                    {/* With Home Icon */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium">With Home Icon</div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <Breadcrumbs homeIcon />
                        </div>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{'<Breadcrumbs homeIcon />'}</code>
                    </div>

                    {/* Max Items (Ellipsis) */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Limited Items (shows ellipsis for long paths)</div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <Breadcrumbs maxItems={3} />
                        </div>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{'<Breadcrumbs maxItems={3} />'}</code>
                        <p className="text-xs text-muted-foreground">
                            Shows first, last, and limited middle segments. Useful for deep navigation.
                        </p>
                    </div>

                    {/* Custom Separator */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Custom Separator</div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <Breadcrumbs separator={<Slash className="h-3.5 w-3.5" />} />
                        </div>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                            {'<Breadcrumbs separator={<Slash />} />'}
                        </code>
                    </div>
                </CardContent>
            </Card>

            {/* Features */}
            <Card>
                <CardHeader>
                    <CardTitle>Key Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="grid gap-3 text-sm">
                        <li className="flex gap-2">
                            <span className="text-primary">✓</span>
                            <div>
                                <strong>Automatic Generation:</strong> No manual configuration needed - breadcrumbs are
                                built from current route
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">✓</span>
                            <div>
                                <strong>Smart Labeling:</strong> Uses route metadata and custom labels instead of raw
                                URLs
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">✓</span>
                            <div>
                                <strong>Human-Readable:</strong> Converts kebab-case paths like{' '}
                                <code className="text-xs">/demo/cloudflare/rate-limiting</code> to "Cloudflare Services
                                → Rate Limiting"
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">✓</span>
                            <div>
                                <strong>Configurable:</strong> Home icons, custom separators, ellipsis for long paths
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">✓</span>
                            <div>
                                <strong>Accessible:</strong> Proper ARIA attributes and semantic HTML
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-primary">✓</span>
                            <div>
                                <strong>TanStack Router Native:</strong> Uses router context, no extra state needed
                            </div>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            {/* Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Custom Route Labels</CardTitle>
                    <CardDescription>Configure display names in the component</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            The component includes a <code className="text-xs bg-muted px-1 rounded">ROUTE_LABELS</code>{' '}
                            configuration object for path-to-label mapping:
                        </p>
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <pre className="text-xs overflow-x-auto">
                                <code>{`const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/demo': 'Demos',
  '/demo/ottaorm': 'OttaORM',
  '/demo/cloudflare/d1': 'D1 Database',
  // ... add your custom labels
};`}</code>
                            </pre>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Fallback: If no custom label exists, the component automatically generates one from the path
                            segment (kebab-case → Title Case).
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Usage */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage Examples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Basic Implementation</div>
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <pre className="text-xs overflow-x-auto">
                                <code>{`import { Breadcrumbs } from '@/components/Breadcrumbs';

function MyPage() {
  return (
    <div>
      <Breadcrumbs />
      {/* Your page content */}
    </div>
  );
}`}</code>
                            </pre>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-medium">In Layout Component</div>
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <pre className="text-xs overflow-x-auto">
                                <code>{`function Layout() {
  return (
    <div>
      <header>
        <Breadcrumbs homeIcon />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}`}</code>
                            </pre>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Test Links */}
            <Card>
                <CardHeader>
                    <CardTitle>Test Navigation</CardTitle>
                    <CardDescription>Navigate to these pages to see breadcrumbs in action</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Button asChild variant="outline" size="sm">
                            <Link to="/">Home</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link to="/demo">Demos</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <a href="/demo/ottaorm">OttaORM</a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <a href="/demo/cloudflare">Cloudflare Services</a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <a href="/demo/cloudflare/d1">D1 Database</a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <a href="/demo/cloudflare/rate-limiting">Rate Limiting</a>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* API Props */}
            <Card>
                <CardHeader>
                    <CardTitle>Component Props</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b">
                                <tr className="text-left">
                                    <th className="pb-2 font-medium">Prop</th>
                                    <th className="pb-2 font-medium">Type</th>
                                    <th className="pb-2 font-medium">Default</th>
                                    <th className="pb-2 font-medium">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-muted-foreground">
                                <tr>
                                    <td className="py-2">
                                        <code className="text-xs">className</code>
                                    </td>
                                    <td className="py-2">string</td>
                                    <td className="py-2">-</td>
                                    <td className="py-2">Custom className for nav element</td>
                                </tr>
                                <tr>
                                    <td className="py-2">
                                        <code className="text-xs">homeIcon</code>
                                    </td>
                                    <td className="py-2">boolean</td>
                                    <td className="py-2">false</td>
                                    <td className="py-2">Show home icon instead of "Home" text</td>
                                </tr>
                                <tr>
                                    <td className="py-2">
                                        <code className="text-xs">maxItems</code>
                                    </td>
                                    <td className="py-2">number</td>
                                    <td className="py-2">0</td>
                                    <td className="py-2">
                                        Max segments to show (0 = unlimited). Shows ellipsis when exceeded
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-2">
                                        <code className="text-xs">separator</code>
                                    </td>
                                    <td className="py-2">ReactNode</td>
                                    <td className="py-2">ChevronRight</td>
                                    <td className="py-2">Custom separator between items</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
