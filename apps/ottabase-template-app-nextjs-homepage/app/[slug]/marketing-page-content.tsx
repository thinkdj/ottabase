import { SlotRendererStatic } from '../../components/SlotRenderer';

export function MarketingPageContent({ page }: { page: any }) {
    return (
        <div className="space-y-4">
            {page.status === 'draft' ? (
                <div className="mx-auto max-w-6xl rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
                    Draft preview mode
                </div>
            ) : null}
            {page.sections.map((section: any) => {
                if (
                    section.slot === 'hero' ||
                    section.slot === 'features' ||
                    section.slot === 'cta' ||
                    section.slot === 'navbar' ||
                    section.slot === 'footer'
                ) {
                    return (
                        <SlotRendererStatic
                            key={section.id}
                            slot={section.slot}
                            variantId={section.variant}
                            data={section}
                        />
                    );
                }

                return (
                    <section key={section.id} className="mx-auto max-w-5xl rounded-lg border p-6">
                        <h2 className="text-2xl font-semibold">{section.title || section.slot}</h2>
                        {section.body ? <p className="mt-3 text-muted-foreground">{section.body}</p> : null}
                    </section>
                );
            })}
        </div>
    );
}
