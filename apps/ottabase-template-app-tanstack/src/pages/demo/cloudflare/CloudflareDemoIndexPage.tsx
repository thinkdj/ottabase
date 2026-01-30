import { Link } from '@tanstack/react-router';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';

export function CloudflareDemoIndexPage() {
    const demos = [
        {
            name: 'D1 Database',
            description: 'SQLite database with CRUD operations',
            href: '/demo/cloudflare/d1',
        },
        {
            name: 'KV Storage',
            description: 'Key-value storage with TTL support',
            href: '/demo/cloudflare/kv',
        },
        {
            name: 'R2 Storage',
            description: 'Object storage for file uploads',
            href: '/demo/cloudflare/r2',
        },
        {
            name: 'File Upload Package',
            description: 'Drag-and-drop file uploader with progress tracking',
            href: '/demo/cloudflare/file-upload',
        },
        {
            name: 'Images',
            description: 'Image upload and transformation (docs)',
            href: '/demo/cloudflare/images',
        },
        {
            name: 'Hyperdrive',
            description: 'Database connection pooling and acceleration (docs)',
            href: '/demo/cloudflare/hyperdrive',
        },
        {
            name: 'Queues',
            description: 'Message queue processing',
            href: '/demo/cloudflare/queues',
        },
        {
            name: 'Rate Limiting',
            description: 'Request throttling and protection',
            href: '/demo/cloudflare/rate-limiting',
        },
        {
            name: 'Realtime Pub/Sub',
            description: 'WebSocket-based real-time messaging with offline support',
            href: '/demo/cloudflare/realtime',
        },
    ];

    return (
        <div className="mx-auto max-w-4xl space-y-8 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demo Gallery</Link>
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Cloudflare Features</h1>
                <p className="text-muted-foreground">
                    Explore working examples of Cloudflare bindings with @ottabase/cf.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {demos.map((demo) => (
                    <Card key={demo.href} className="transition-colors">
                        <CardHeader>
                            <CardTitle className="text-lg">{demo.name}</CardTitle>
                            <CardDescription>{demo.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline" className="w-full">
                                <Link to={demo.href}>Open</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
                <h3 className="mb-2 text-sm font-medium">Setup Required</h3>
                <p className="text-sm text-muted-foreground">
                    Configure bindings in <code>wrangler.jsonc</code> for the Worker.
                </p>
            </div>
        </div>
    );
}
