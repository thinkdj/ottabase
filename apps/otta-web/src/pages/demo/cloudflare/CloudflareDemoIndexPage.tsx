import { DemoCard } from '../DemoCard';
import { DEMO_ITEMS } from '../demoItems';
import { DemoPageHeader } from '../DemoPageHeader';

/** The Cloudflare section of the gallery, as its own page: the same entries as the index */
export function CloudflareDemoIndexPage() {
    const demos = DEMO_ITEMS.filter((item) => item.group === 'cloudflare');

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Cloudflare"
                description="Every binding the worker uses, exercised through @ottabase/cf and the app's own routes."
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {demos.map((item) => (
                    <DemoCard key={item.to} item={item} />
                ))}
            </div>

            <div className="rounded-xl bg-muted/40 p-4">
                <h3 className="mb-1.5 text-[0.9375rem] font-semibold">Before you start</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    The bindings are declared in <code>wrangler.jsonc</code>, and the live pages (D1, KV, R2, Queues,
                    Rate limiting, Realtime) only answer a signed-in platform admin. Images and Hyperdrive are setup
                    guides.
                </p>
            </div>
        </div>
    );
}
