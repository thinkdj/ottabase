import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { DemoPageHeader } from '../DemoPageHeader';

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
        {
            name: 'AI chat (BYOK)',
            description: 'Tenant-aware chat via AI Gateway — user key → org key → platform floor, gated server-side',
            href: '/demo/cloudflare/ai',
        },
    ];

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Cloudflare Services"
                description="Explore working examples of Cloudflare bindings with @ottabase/cf."
            />

            <div className="grid gap-4 md:grid-cols-2">
                {demos.map((demo) => (
                    <Card
                        key={demo.href}
                        className="rounded-xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal hover:bg-muted/70"
                    >
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">{demo.name}</CardTitle>
                            <CardDescription className="leading-relaxed">{demo.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline" className="w-full bg-background">
                                <Link to={demo.href}>Open</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="rounded-xl bg-muted/40 p-4">
                <h3 className="mb-1.5 text-[0.9375rem] font-semibold">Setup Required</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    Configure bindings in <code>wrangler.jsonc</code> for the Worker.
                </p>
            </div>
        </div>
    );
}
