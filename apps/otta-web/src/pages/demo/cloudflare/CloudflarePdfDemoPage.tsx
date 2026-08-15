import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { DemoPageHeader } from '../DemoPageHeader';

/**
 * The public demo-gallery entrypoint is intentionally a primer. The complete
 * workbench is shipped by @ottabase/cf-pdf/react and opened through the link
 * below, where the app supplies its authenticated API adapter.
 */
export function CloudflarePdfDemoPage() {
    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Cloudflare PDF"
                description="A 101 guide to secure HTML-to-PDF export on Cloudflare Workers."
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare Demos"
            />

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">What this package does</CardTitle>
                    <CardDescription>
                        @ottabase/cf-pdf turns a rendered browser document into a bounded, downloadable PDF.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 text-sm leading-relaxed text-muted-foreground">
                    <p>
                        The browser captures a selected DOM element as static HTML. The Worker then authenticates the
                        caller, validates the request, and uses Cloudflare Browser Rendering with JavaScript disabled.
                    </p>
                    <ol className="list-decimal space-y-2 pl-5">
                        <li>Render the document in your app.</li>
                        <li>
                            Call <code>captureDomAsHtml</code> from the package&apos;s client entrypoint.
                        </li>
                        <li>Send the request through your authenticated API client.</li>
                        <li>Download the returned PDF Blob.</li>
                    </ol>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button asChild>
                            <a href="/demo/cloudflare/pdf/playground">Open interactive workbench</a>
                        </Button>
                        <Button asChild variant="outline">
                            <a href="/docs/packages/cf-pdf">Read package docs</a>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                {[
                    [
                        'Client capture',
                        'Scripts, handlers, and unapproved external resources are removed before the request leaves the browser.',
                    ],
                    [
                        'Worker boundary',
                        'The host owns authentication, request bounds, rate limits, and the Browser Rendering binding.',
                    ],
                    [
                        'Safe response',
                        'The package returns a no-store PDF attachment with sanitized filename and conservative metadata.',
                    ],
                ].map(([title, description]) => (
                    <Card key={title} className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">{title}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-relaxed text-muted-foreground">
                            {description}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
