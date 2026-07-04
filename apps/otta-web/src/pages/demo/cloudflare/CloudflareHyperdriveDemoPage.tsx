import { Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { DemoPageHeader } from '../DemoPageHeader';

export function CloudflareHyperdriveDemoPage() {
    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Hyperdrive"
                description="Accelerate access to your existing databases from Cloudflare Workers"
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare Features"
            />

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
