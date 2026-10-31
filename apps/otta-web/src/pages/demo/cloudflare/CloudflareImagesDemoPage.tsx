import { Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui';
import { DemoPageHeader } from '../DemoPageHeader';

export function CloudflareImagesDemoPage() {
    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Images"
                description="WebP variants of every uploaded image, through the Images binding"
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare Features"
            />

            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">The OBCF_IMAGES binding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        When a purpose asks for variants (the media library and avatars do), the files service renders
                        fixed-width WebP copies at upload time: thumb 160 px, card 640 px, full 1600 px, each only when
                        narrower than the original. They live next to the original in R2 and are served like any other
                        file, so nobody can mint new sizes on your bill. Content keeps the file&apos;s key, and every
                        image is rendered with a srcset, so each screen downloads the copy that fits it.
                    </p>
                    <p>
                        The binding is already in <code className="font-mono text-xs">wrangler.jsonc</code>; local dev
                        runs it through sharp. Without it, uploads keep only their original and every thumbnail URL is
                        the original&apos;s.
                    </p>
                    <div className="mt-2 rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                        <div>&quot;images&quot;: &#123; &quot;binding&quot;: &quot;OBCF_IMAGES&quot; &#125;</div>
                    </div>
                    <p className="mt-2 text-xs">
                        Try it on the{' '}
                        <a href="/demo/cloudflare/file-upload" className="text-primary underline underline-offset-2">
                            file upload demo
                        </a>
                        , or see the{' '}
                        <a
                            href="https://developers.cloudflare.com/images/transform-images/bindings/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2"
                        >
                            Images binding documentation
                        </a>
                        .
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
