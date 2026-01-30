import { Link } from '@tanstack/react-router';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui-shadcn';

export function CloudflareImagesDemoPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo/cloudflare">← Back to Cloudflare Features</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">Images Demo</h1>
                <p className="text-muted-foreground">Image upload, transformation, and optimization</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cloud-only Service</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        Cloudflare Images is a cloud-only service. It requires API authentication and uploads go
                        directly to Cloudflare&apos;s CDN.
                    </p>
                    <p className="font-medium text-foreground">Setup steps:</p>
                    <ol className="list-decimal space-y-1 pl-5">
                        <li>Enable Cloudflare Images in your dashboard (Images &gt; Overview)</li>
                        <li>Copy your Account ID from the dashboard URL or sidebar</li>
                        <li>Create an API token with &quot;Cloudflare Images&quot; permissions</li>
                        <li>Add these environment variables to your worker:</li>
                    </ol>
                    <div className="mt-2 rounded-md bg-muted p-3 font-mono text-xs">
                        <div>CLOUDFLARE_ACCOUNT_ID=&lt;your-account-id&gt;</div>
                        <div>CLOUDFLARE_IMAGES_TOKEN=&lt;your-api-token&gt;</div>
                    </div>
                    <p className="mt-2 text-xs">
                        See the{' '}
                        <a
                            href="https://developers.cloudflare.com/images/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2"
                        >
                            Cloudflare Images documentation
                        </a>{' '}
                        for more details.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
