import { Button, Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';

export function CloudflareHyperdriveDemoPage() {
    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo/cloudflare">← Back to Cloudflare Features</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">Hyperdrive Demo</h1>
                <p className="text-muted-foreground">
                    Accelerate access to your existing databases from Cloudflare Workers
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Production-only Feature</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        Hyperdrive requires deployment to Cloudflare Workers. For local testing, connect directly to
                        your database or use remote dev.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
