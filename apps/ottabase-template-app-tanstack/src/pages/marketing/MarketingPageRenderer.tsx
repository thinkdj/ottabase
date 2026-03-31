import { api } from '@/lib/api';
import { Button } from '@ottabase/ui-shadcn';
import { useParams, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

export function MarketingPageRenderer() {
    const { slug } = useParams({ from: '/pages/$slug' });
    const search = useSearch({ from: '/pages/$slug' }) as { preview?: boolean };

    const pageQuery = useQuery({
        queryKey: ['marketing-page', slug, search.preview],
        queryFn: () => api<{ page: any }>(`/api/pages/${slug}${search.preview ? '?preview=true' : ''}`),
    });

    const page = pageQuery.data?.page;

    if (!page) {
        return <div className="p-10">Page not found.</div>;
    }

    return (
        <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
            {page.status === 'draft' && (
                <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">Draft preview</div>
            )}
            {page.sections.map((section: any) => (
                <section key={section.id} className="rounded-lg border p-6">
                    <h2 className="text-2xl font-semibold">{section.title || section.slot}</h2>
                    {section.subtitle ? <p className="mt-2 text-muted-foreground">{section.subtitle}</p> : null}
                    {section.body ? <p className="mt-4">{section.body}</p> : null}
                    {section.features?.length ? (
                        <ul className="mt-4 list-disc space-y-1 pl-5">
                            {section.features.map((feature: any) => (
                                <li key={feature.id}>{feature.title}</li>
                            ))}
                        </ul>
                    ) : null}
                    {section.actions?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {section.actions.map((action: any) => (
                                <Button
                                    asChild
                                    key={action.id}
                                    variant={action.variant === 'secondary' ? 'secondary' : 'default'}
                                >
                                    <a href={action.href}>{action.label}</a>
                                </Button>
                            ))}
                        </div>
                    ) : null}
                </section>
            ))}
        </div>
    );
}
