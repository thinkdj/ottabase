import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Slash } from 'lucide-react';
import { DemoPageHeader } from '../DemoPageHeader';

export function BreadcrumbsDemoPage() {
    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Smart Breadcrumbs"
                description="Automatic breadcrumb navigation that intelligently uses route metadata and generates human-readable labels from URLs. Fully integrated with TanStack Router."
                actions={
                    <Badge
                        variant="outline"
                        className="rounded-full border-transparent bg-background text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border"
                    >
                        Navigation
                    </Badge>
                }
            />

            {/* Current Breadcrumbs */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Current Page Breadcrumbs</CardTitle>
                    <CardDescription>Automatically generated from your current location</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                        <Breadcrumbs />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Navigate to different pages to see the breadcrumbs update automatically.
                    </p>
                </CardContent>
            </Card>

            {/* Variants */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Variants</CardTitle>
                    <CardDescription>Different configurations and display options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Default */}
                    <div className="space-y-2">
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Default
                        </div>
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <Breadcrumbs />
                        </div>
                        <code className="rounded bg-muted px-2 py-1 text-xs">{'<Breadcrumbs />'}</code>
                    </div>

                    {/* With Home Icon */}
                    <div className="space-y-2">
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            With Home Icon
                        </div>
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <Breadcrumbs homeIcon />
                        </div>
                        <code className="rounded bg-muted px-2 py-1 text-xs">{'<Breadcrumbs homeIcon />'}</code>
                    </div>

                    {/* Max Items (Ellipsis) */}
                    <div className="space-y-2">
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Limited Items (shows ellipsis for long paths)
                        </div>
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <Breadcrumbs maxItems={3} />
                        </div>
                        <code className="rounded bg-muted px-2 py-1 text-xs">{'<Breadcrumbs maxItems={3} />'}</code>
                        <p className="text-xs text-muted-foreground">
                            Shows first, last, and limited middle segments. Useful for deep navigation.
                        </p>
                    </div>

                    {/* Custom Separator */}
                    <div className="space-y-2">
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Custom Separator
                        </div>
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <Breadcrumbs separator={<Slash className="h-3.5 w-3.5" />} />
                        </div>
                        <code className="rounded bg-muted px-2 py-1 text-xs">
                            {'<Breadcrumbs separator={<Slash />} />'}
                        </code>
                    </div>
                </CardContent>
            </Card>

            {/* Features */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Key Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="grid gap-3 text-sm">
                        <li className="flex gap-2">
                            <span className="text-success">✓</span>
                            <div>
                                <strong>Automatic Generation:</strong> No manual configuration needed - breadcrumbs are
                                built from current route
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-success">✓</span>
                            <div>
                                <strong>Smart Labeling:</strong> Uses route metadata and custom labels instead of raw
                                URLs
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-success">✓</span>
                            <div>
                                <strong>Human-Readable:</strong> Converts kebab-case paths like{' '}
                                <code className="text-xs">/demo/cloudflare/rate-limiting</code> to "Cloudflare Services
                                → Rate Limiting"
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-success">✓</span>
                            <div>
                                <strong>Configurable:</strong> Home icons, custom separators, ellipsis for long paths
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-success">✓</span>
                            <div>
                                <strong>Accessible:</strong> Proper ARIA attributes and semantic HTML
                            </div>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-success">✓</span>
                            <div>
                                <strong>TanStack Router Native:</strong> Uses router context, no extra state needed
                            </div>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            {/* Configuration */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Custom Route Labels</CardTitle>
                    <CardDescription>Configure display names in the component</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            The component includes a <code className="text-xs bg-muted px-1 rounded">ROUTE_LABELS</code>{' '}
                            configuration object for path-to-label mapping:
                        </p>
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
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
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Usage Examples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Basic Implementation
                        </div>
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
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
                        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            In Layout Component
                        </div>
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
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
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Test Navigation</CardTitle>
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
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Component Props</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-lg bg-background ring-1 ring-border">
                        <table className="min-w-full divide-y divide-border/60 text-sm">
                            <thead>
                                <tr className="text-left">
                                    <th className="px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Prop
                                    </th>
                                    <th className="px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Type
                                    </th>
                                    <th className="px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Default
                                    </th>
                                    <th className="px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Description
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 text-muted-foreground">
                                <tr>
                                    <td className="px-4 py-3">
                                        <code className="text-xs">className</code>
                                    </td>
                                    <td className="px-4 py-3">string</td>
                                    <td className="px-4 py-3">-</td>
                                    <td className="px-4 py-3">Custom className for nav element</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3">
                                        <code className="text-xs">homeIcon</code>
                                    </td>
                                    <td className="px-4 py-3">boolean</td>
                                    <td className="px-4 py-3">false</td>
                                    <td className="px-4 py-3">Show home icon instead of "Home" text</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3">
                                        <code className="text-xs">maxItems</code>
                                    </td>
                                    <td className="px-4 py-3">number</td>
                                    <td className="px-4 py-3">0</td>
                                    <td className="px-4 py-3">
                                        Max segments to show (0 = unlimited). Shows ellipsis when exceeded
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3">
                                        <code className="text-xs">separator</code>
                                    </td>
                                    <td className="px-4 py-3">ReactNode</td>
                                    <td className="px-4 py-3">ChevronRight</td>
                                    <td className="px-4 py-3">Custom separator between items</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
