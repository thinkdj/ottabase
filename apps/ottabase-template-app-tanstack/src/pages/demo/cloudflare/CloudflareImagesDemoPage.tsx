import { Link } from "@tanstack/react-router";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@ottabase/ui-shadcn";

export function CloudflareImagesDemoPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo/cloudflare">← Back to Cloudflare Features</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">Images Demo</h1>
                <p className="text-muted-foreground">
                    Image upload, transformation, and optimization
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cloud-only Service</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        Cloudflare Images is a cloud-only service. It requires API
                        authentication and uploads go directly to Cloudflare.
                    </p>
                    <ol className="list-decimal space-y-1 pl-5">
                        <li>Enable Cloudflare Images in your dashboard</li>
                        <li>Get your Account ID</li>
                        <li>Create an API token with Images permissions</li>
                        <li>Add credentials to your environment variables</li>
                    </ol>
                </CardContent>
            </Card>
        </div>
    );
}
