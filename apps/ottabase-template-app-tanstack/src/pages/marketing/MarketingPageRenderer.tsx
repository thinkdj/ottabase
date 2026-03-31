import { api } from '@/lib/api';
import { Badge, Button } from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';

// -- Slot-aware section renderers --

function HeroSection({ section }: { section: any }) {
    const variant = section.variant || 'centered';
    const isSplit = variant === 'split';
    return (
        <section className="bg-gradient-to-b from-primary/5 to-background px-4 py-20 text-center">
            <div className={`mx-auto max-w-4xl ${isSplit ? 'grid items-center gap-8 text-left md:grid-cols-2' : ''}`}>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{section.title}</h1>
                    {section.subtitle && <p className="mt-4 text-lg text-muted-foreground">{section.subtitle}</p>}
                    {section.body && <p className="mt-4 text-muted-foreground">{section.body}</p>}
                    <ActionButtons actions={section.actions} className="mt-8" />
                </div>
            </div>
        </section>
    );
}

function FeaturesSection({ section }: { section: any }) {
    const variant = section.variant || 'grid';
    return (
        <section className="px-4 py-16">
            <div className="mx-auto max-w-5xl">
                {section.title && <h2 className="mb-2 text-center text-3xl font-bold">{section.title}</h2>}
                {section.subtitle && <p className="mb-10 text-center text-muted-foreground">{section.subtitle}</p>}
                <div
                    className={
                        variant === 'list'
                            ? 'space-y-4'
                            : variant === 'cards'
                              ? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'
                              : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'
                    }
                >
                    {section.features?.map((feature: any) => (
                        <div
                            key={feature.id}
                            className={
                                variant === 'list'
                                    ? 'flex items-start gap-3'
                                    : 'rounded-lg border bg-card p-6 transition-shadow hover:shadow-md'
                            }
                        >
                            {feature.icon && (
                                <span className="text-xl" role="img" aria-label={feature.title}>
                                    {feature.icon}
                                </span>
                            )}
                            <div>
                                <h3 className="font-semibold">{feature.title}</h3>
                                {feature.description && (
                                    <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function CTASection({ section }: { section: any }) {
    const variant = section.variant || 'default';
    const isBanner = variant === 'banner';
    return (
        <section className={`px-4 py-16 ${isBanner ? 'bg-primary text-primary-foreground' : ''}`}>
            <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-3xl font-bold">{section.title}</h2>
                {section.body && <p className="mt-4 text-muted-foreground">{section.body}</p>}
                <ActionButtons actions={section.actions} className="mt-8 justify-center" />
            </div>
        </section>
    );
}

function NavbarSection({ section }: { section: any }) {
    return (
        <nav className="border-b px-4 py-3">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
                <span className="text-lg font-semibold">{section.title}</span>
                <ActionButtons actions={section.actions} />
            </div>
        </nav>
    );
}

function FooterSection({ section }: { section: any }) {
    return (
        <footer className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            <p>{section.title || '© 2026'}</p>
            {section.body && <p className="mt-2">{section.body}</p>}
        </footer>
    );
}

function AboutSection({ section }: { section: any }) {
    const variant = section.variant || 'default';
    const isDetailed = variant === 'detailed';
    return (
        <section className="bg-muted/30 px-4 py-16">
            <div className={`mx-auto ${isDetailed ? 'max-w-5xl' : 'max-w-3xl'} text-center`}>
                {section.title && <h2 className="text-3xl font-bold">{section.title}</h2>}
                {section.subtitle && <p className="mt-3 text-lg text-muted-foreground">{section.subtitle}</p>}
                {section.body && <p className="mt-4 text-muted-foreground">{section.body}</p>}
                {section.features?.length > 0 && (
                    <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
                        {section.features.map((f: any) => (
                            <div key={f.id} className="rounded-lg border bg-card p-4">
                                <h3 className="font-semibold">{f.title}</h3>
                                {f.description && <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>}
                            </div>
                        ))}
                    </div>
                )}
                <ActionButtons actions={section.actions} className="mt-8 justify-center" />
            </div>
        </section>
    );
}

function GenericSection({ section }: { section: any }) {
    return (
        <section className="px-4 py-12">
            <div className="mx-auto max-w-4xl">
                <h2 className="text-2xl font-semibold">{section.title || section.slot}</h2>
                {section.subtitle && <p className="mt-2 text-muted-foreground">{section.subtitle}</p>}
                {section.body && <p className="mt-4">{section.body}</p>}
                {section.features?.length > 0 && (
                    <ul className="mt-4 list-disc space-y-1 pl-5">
                        {section.features.map((f: any) => (
                            <li key={f.id}>{f.title}</li>
                        ))}
                    </ul>
                )}
                <ActionButtons actions={section.actions} className="mt-6" />
            </div>
        </section>
    );
}

/** Render action buttons for a section. */
function ActionButtons({ actions, className }: { actions?: any[]; className?: string }) {
    if (!actions?.length) return null;
    return (
        <div className={`flex flex-wrap gap-3 ${className || ''}`}>
            {actions.map((action: any) => (
                <Button
                    key={action.id}
                    asChild
                    variant={
                        action.variant === 'secondary'
                            ? 'secondary'
                            : action.variant === 'outline'
                              ? 'outline'
                              : 'default'
                    }
                >
                    <a
                        href={action.href}
                        target={action.external ? '_blank' : undefined}
                        rel={action.external ? 'noreferrer' : undefined}
                    >
                        {action.label}
                        {action.external && <ExternalLink className="ml-1.5 h-3.5 w-3.5" />}
                    </a>
                </Button>
            ))}
        </div>
    );
}

/** Map slot names to their specialised renderer. */
const SLOT_RENDERERS: Record<string, React.ComponentType<{ section: any }>> = {
    hero: HeroSection,
    features: FeaturesSection,
    cta: CTASection,
    about: AboutSection,
    navbar: NavbarSection,
    footer: FooterSection,
};

export function MarketingPageRenderer() {
    const { slug } = useParams({ from: '/pages/$slug' });
    const search = useSearch({ from: '/pages/$slug' }) as { preview?: boolean };

    const pageQuery = useQuery({
        queryKey: ['marketing-page', slug, search.preview],
        queryFn: () => api<{ page: any }>(`/api/pages/${slug}${search.preview ? '?preview=true' : ''}`),
    });

    const page = pageQuery.data?.page;

    if (pageQuery.isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        );
    }

    if (!page) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <p className="text-muted-foreground">Page not found.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {page.status === 'draft' && (
                <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm dark:bg-amber-950/30 dark:border-amber-800">
                    <Badge variant="outline" className="mr-2 border-amber-400 text-amber-700 dark:text-amber-300">
                        Draft
                    </Badge>
                    Preview mode — this page is not published yet.
                </div>
            )}
            {page.sections.map((section: any) => {
                const Renderer = SLOT_RENDERERS[section.slot] || GenericSection;
                return <Renderer key={section.id} section={section} />;
            })}
        </div>
    );
}
