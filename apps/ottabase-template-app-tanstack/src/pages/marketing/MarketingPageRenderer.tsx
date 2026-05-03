import { api } from '@/lib/api';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Badge, Button } from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useLocation } from '@tanstack/react-router';
import { useParams, useSearch } from '@tanstack/react-router';
import { ExternalLink, Github, Menu, Rocket, X } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';

type SectionAction = {
    id?: string;
    href: string;
    label: ReactNode;
    variant?: 'default' | 'secondary' | 'outline' | 'ghost';
    external?: boolean;
};

type MarketingSection = {
    id: string;
    slot: string;
    variant?: string;
    title?: ReactNode;
    subtitle?: string;
    body?: string;
    mediaUrl?: string;
    mediaAlt?: string;
    features?: Array<{ id?: string; title: string; description?: string; mediaUrl?: string; mediaAlt?: string }>;
    actions?: SectionAction[];
};

function ActionButtons({ actions, className }: { actions?: SectionAction[]; className?: string }) {
    if (!actions?.length) return null;

    return (
        <div className={`flex flex-wrap items-center gap-3 ${className || ''}`}>
            {actions.map((action, idx) => (
                <Button
                    key={action.id || `${action.href}-${idx}`}
                    asChild
                    variant={action.variant ?? 'default'}
                    size="lg"
                >
                    <a
                        href={action.href}
                        target={action.external ? '_blank' : undefined}
                        rel={action.external ? 'noopener noreferrer' : undefined}
                    >
                        {action.label}
                        {action.external ? <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-70" /> : null}
                    </a>
                </Button>
            ))}
        </div>
    );
}

function HeroCentered({ section }: { section: MarketingSection }) {
    return (
        <section className="flex w-full flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
            {section.mediaUrl ? (
                <div className="mx-auto mb-2 w-full max-w-4xl overflow-hidden rounded-xl border">
                    <img
                        src={section.mediaUrl}
                        alt={section.mediaAlt || ''}
                        className="h-56 w-full object-cover md:h-72"
                    />
                </div>
            ) : null}
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                {section.title}
            </h1>
            {section.subtitle ? (
                <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">{section.subtitle}</p>
            ) : null}
            {section.body ? (
                <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{section.body}</p>
            ) : null}
            <ActionButtons actions={section.actions} className="mt-4 justify-center" />
        </section>
    );
}

function HeroSplit({ section }: { section: MarketingSection }) {
    return (
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            <div className="flex flex-col gap-5">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                    {section.title}
                </h1>
                {section.subtitle ? <p className="text-lg text-muted-foreground">{section.subtitle}</p> : null}
                {section.body ? (
                    <p className="text-base leading-relaxed text-muted-foreground">{section.body}</p>
                ) : null}
                <ActionButtons actions={section.actions} className="mt-2" />
            </div>
            {section.mediaUrl ? (
                <div className="hidden overflow-hidden rounded-xl border md:block">
                    <img src={section.mediaUrl} alt={section.mediaAlt || ''} className="h-full w-full object-cover" />
                </div>
            ) : (
                <div className="hidden aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 md:flex">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-xl bg-primary/20" />
                        <div className="h-3 w-24 rounded bg-muted" />
                        <div className="h-3 w-16 rounded bg-muted/60" />
                    </div>
                </div>
            )}
        </section>
    );
}

function HeroMinimal({ section }: { section: MarketingSection }) {
    return (
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-20 md:py-24">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                {section.title}
            </h1>
            {section.subtitle ? <p className="text-lg text-muted-foreground md:text-xl">{section.subtitle}</p> : null}
            <div className="h-px w-16 bg-border" />
            <ActionButtons actions={section.actions} className="mt-2" />
        </section>
    );
}

function FeaturesGrid({ section }: { section: MarketingSection }) {
    const features = section.features ?? [];
    return (
        <section className="mx-auto w-full max-w-3xl px-4 py-14">
            {section.title ? (
                <h2 className="mb-6 font-heading text-lg font-semibold text-foreground">{section.title}</h2>
            ) : null}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {features.map((f, idx) => (
                    <div key={f.id || `${f.title}-${idx}`} className="border-l-2 border-primary/40 py-1 pl-4">
                        <p className="font-heading text-sm font-semibold text-foreground">{f.title}</p>
                        {f.description ? <p className="mt-0.5 text-sm text-muted-foreground">{f.description}</p> : null}
                    </div>
                ))}
            </div>
        </section>
    );
}

function FeaturesCards({ section }: { section: MarketingSection }) {
    const features = section.features ?? [];
    return (
        <section className="mx-auto w-full max-w-4xl px-4 py-14">
            {section.title ? (
                <h2 className="mb-8 text-center font-heading text-lg font-semibold text-foreground">{section.title}</h2>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((f, idx) => (
                    <div
                        key={f.id || `${f.title}-${idx}`}
                        className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
                    >
                        {f.mediaUrl ? (
                            <div className="mb-3 overflow-hidden rounded-md border">
                                <img src={f.mediaUrl} alt={f.mediaAlt || ''} className="h-28 w-full object-cover" />
                            </div>
                        ) : null}
                        <h3 className="font-heading text-sm font-semibold text-card-foreground">{f.title}</h3>
                        {f.description ? (
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </section>
    );
}

function FeaturesList({ section }: { section: MarketingSection }) {
    const features = section.features ?? [];
    return (
        <section className="mx-auto w-full max-w-3xl px-4 py-14">
            {section.title ? (
                <h2 className="mb-6 font-heading text-lg font-semibold text-foreground">{section.title}</h2>
            ) : null}
            <ul className="divide-y divide-border">
                {features.map((f, i) => (
                    <li
                        key={f.id || `${f.title}-${i}`}
                        className={`flex flex-col gap-1 px-4 py-4 ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                    >
                        {f.mediaUrl ? (
                            <img
                                src={f.mediaUrl}
                                alt={f.mediaAlt || ''}
                                className="mb-2 h-24 w-full rounded border object-cover"
                            />
                        ) : null}
                        <span className="font-heading text-sm font-semibold text-foreground">{f.title}</span>
                        {f.description ? <span className="text-sm text-muted-foreground">{f.description}</span> : null}
                    </li>
                ))}
            </ul>
        </section>
    );
}

function CTADefault({ section }: { section: MarketingSection }) {
    return (
        <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
            <h2 className="font-heading text-3xl font-bold text-foreground">{section.title}</h2>
            {section.body ? <p className="mt-3 text-base text-muted-foreground">{section.body}</p> : null}
            <ActionButtons actions={section.actions} className="mt-6 justify-center" />
        </section>
    );
}

function CTABanner({ section }: { section: MarketingSection }) {
    return (
        <section className="w-full bg-primary/5 px-4 py-14">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
                <div>
                    <h2 className="font-heading text-2xl font-bold text-foreground">{section.title}</h2>
                    {section.body ? <p className="mt-1 text-sm text-muted-foreground">{section.body}</p> : null}
                </div>
                <ActionButtons actions={section.actions} />
            </div>
        </section>
    );
}

function CTAMinimal({ section }: { section: MarketingSection }) {
    return (
        <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">{section.title}</h2>
                {section.body ? <p className="mt-0.5 text-sm text-muted-foreground">{section.body}</p> : null}
            </div>
            <ActionButtons actions={section.actions} />
        </section>
    );
}

function NavbarDefault({ section }: { section: MarketingSection }) {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const links = section.actions ?? [];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
            <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                <RouterLink to="/" className="font-heading text-lg font-bold text-foreground">
                    {section.title || 'Ottabase'}
                </RouterLink>

                <div className="hidden items-center gap-1 md:flex">
                    {links.map((link, idx) => (
                        <Button
                            key={link.id || `${link.href}-${idx}`}
                            asChild
                            variant={location.pathname === link.href ? 'secondary' : 'ghost'}
                            size="sm"
                        >
                            <a
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                            >
                                {link.label}
                            </a>
                        </Button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <DarkModeToggle type="button" title="Toggle dark/light mode" />
                    <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </nav>

            {mobileOpen ? (
                <div className="border-t border-border bg-background px-4 py-3 md:hidden">
                    <div className="flex flex-col gap-1">
                        {links.map((link, idx) => (
                            <a
                                key={link.id || `${link.href}-${idx}`}
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                onClick={() => setMobileOpen(false)}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                </div>
            ) : null}
        </header>
    );
}

function NavbarCentered({ section }: { section: MarketingSection }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const links = section.actions ?? [];
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
            <nav className="mx-auto flex h-14 max-w-5xl flex-col items-center justify-center px-4 sm:flex-row sm:justify-between">
                <div className="flex w-full items-center justify-between sm:w-auto">
                    <RouterLink to="/" className="font-heading text-lg font-bold text-foreground">
                        {section.title || 'Ottabase'}
                    </RouterLink>
                    <div className="flex items-center gap-2 sm:hidden">
                        <DarkModeToggle type="button" title="Toggle dark/light mode" />
                        <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            aria-label="Toggle menu"
                        >
                            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                <div className="hidden flex-1 items-center justify-center gap-1 sm:flex">
                    {links.map((link, idx) => (
                        <Button key={link.id || `${link.href}-${idx}`} asChild variant="ghost" size="sm">
                            <a
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                            >
                                {link.label}
                            </a>
                        </Button>
                    ))}
                </div>

                <div className="hidden items-center gap-2 sm:flex">
                    <DarkModeToggle type="button" title="Toggle dark/light mode" />
                </div>
            </nav>

            {mobileOpen ? (
                <div className="border-t border-border bg-background px-4 py-3 sm:hidden">
                    <div className="flex flex-col gap-1">
                        {links.map((link, idx) => (
                            <a
                                key={link.id || `${link.href}-${idx}`}
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                onClick={() => setMobileOpen(false)}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                </div>
            ) : null}
        </header>
    );
}

function NavbarMinimal({ section }: { section: MarketingSection }) {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
            <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                <RouterLink to="/" className="font-heading text-lg font-bold text-foreground">
                    {section.title || 'Ottabase'}
                </RouterLink>
                <DarkModeToggle type="button" title="Toggle dark/light mode" />
            </nav>
        </header>
    );
}

function FooterDefault({ section }: { section: MarketingSection }) {
    const links = section.actions ?? [];
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
                <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} {section.title || 'Ottabase'}. Open Source.
                    </p>
                    {section.body ? <p className="mt-1 text-xs text-muted-foreground/70">{section.body}</p> : null}
                </div>
                {links.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-4">
                        {links.map((link, idx) => (
                            <a
                                key={link.id || `${link.href}-${idx}`}
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>
        </footer>
    );
}

function FooterMinimal({ section }: { section: MarketingSection }) {
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto max-w-5xl px-4 py-4 text-center">
                <p className="text-xs text-muted-foreground">
                    © {new Date().getFullYear()} {section.title || 'Ottabase'}
                </p>
            </div>
        </footer>
    );
}

function FooterColumns({ section }: { section: MarketingSection }) {
    const links = section.actions ?? [];
    const mid = Math.ceil(links.length / 2);
    const leftLinks = links.slice(0, mid);
    const rightLinks = links.slice(mid);
    const siteName = String(section.title || 'Ottabase');

    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-3">
                <div>
                    <p className="font-heading text-sm font-semibold text-foreground">{siteName}</p>
                    {section.body ? <p className="mt-1 text-xs text-muted-foreground">{section.body}</p> : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                        © {new Date().getFullYear()} {siteName}
                    </p>
                </div>

                {leftLinks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Links</p>
                        {leftLinks.map((link, idx) => (
                            <a
                                key={link.id || `${link.href}-${idx}`}
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                ) : null}

                {rightLinks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">More</p>
                        {rightLinks.map((link, idx) => (
                            <a
                                key={link.id || `${link.href}-${idx}`}
                                href={link.href}
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>
        </footer>
    );
}

function AboutDefault({ section }: { section: MarketingSection }) {
    const features = section.features ?? [];
    return (
        <div className="mx-auto max-w-4xl px-4 py-16">
            <div className="space-y-8">
                <div>
                    <h1 className="font-heading pb-2.5 text-4xl font-bold text-foreground">
                        {section.title || (
                            <span>
                                <span className="text-primary">About</span> this page
                            </span>
                        )}
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        {section.subtitle || section.body || 'A modern, production-ready page.'}
                    </p>
                </div>
                {features.length > 0 ? (
                    <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                        {features.map((f, idx) => (
                            <li key={f.id || `${f.title}-${idx}`}>
                                {f.title}
                                {f.description ? ` - ${f.description}` : ''}
                            </li>
                        ))}
                    </ul>
                ) : null}
                <ActionButtons actions={section.actions} className="mt-4" />
            </div>
        </div>
    );
}

function AboutMinimal({ section }: { section: MarketingSection }) {
    return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
            <h1 className="font-heading text-3xl font-bold text-foreground">
                {section.title || (
                    <span>
                        <span className="text-primary">About</span> this page
                    </span>
                )}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                {section.subtitle || section.body || 'A concise page overview.'}
            </p>
            <ActionButtons actions={section.actions} className="mt-8 justify-center" />
        </div>
    );
}

function AboutDetailed({ section }: { section: MarketingSection }) {
    const features = section.features ?? [];
    return (
        <div className="mx-auto max-w-5xl px-4 py-16">
            <div className="space-y-12">
                <div className="text-center">
                    <h1 className="font-heading text-4xl font-bold text-foreground">
                        {section.title || (
                            <span>
                                <span className="text-primary">About</span> this page
                            </span>
                        )}
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        {section.subtitle || section.body || 'A detailed page overview.'}
                    </p>
                </div>
                {features.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((f, idx) => (
                            <div
                                key={f.id || `${f.title}-${idx}`}
                                className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
                            >
                                <h3 className="font-heading text-lg font-semibold text-card-foreground">{f.title}</h3>
                                {f.description ? (
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                        {f.description}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : null}
                <div className="flex flex-wrap justify-center gap-4">
                    <Button asChild size="lg">
                        <a href="https://github.com/thinkdj/ottabase" target="_blank" rel="noopener noreferrer">
                            <Github className="mr-2 h-5 w-5" />
                            View on GitHub
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                        </a>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <RouterLink to="/">
                            <Rocket className="mr-2 h-5 w-5" />
                            Back to Home
                        </RouterLink>
                    </Button>
                </div>
            </div>
        </div>
    );
}

function GenericSection({ section }: { section: MarketingSection }) {
    return (
        <section className="px-4 py-12">
            <div className="mx-auto max-w-4xl">
                <h2 className="text-2xl font-semibold">{section.title || section.slot}</h2>
                {section.subtitle ? <p className="mt-2 text-muted-foreground">{section.subtitle}</p> : null}
                {section.body ? <p className="mt-4">{section.body}</p> : null}
                {section.features?.length ? (
                    <ul className="mt-4 list-disc space-y-1 pl-5">
                        {section.features.map((f, idx) => (
                            <li key={f.id || `${f.title}-${idx}`}>{f.title}</li>
                        ))}
                    </ul>
                ) : null}
                <ActionButtons actions={section.actions} className="mt-6" />
            </div>
        </section>
    );
}

function resolveRenderer(section: MarketingSection): ComponentType<{ section: MarketingSection }> {
    const variant = section.variant || '';

    if (section.slot === 'hero') {
        if (variant === 'split') return HeroSplit;
        if (variant === 'minimal') return HeroMinimal;
        return HeroCentered;
    }

    if (section.slot === 'features') {
        if (variant === 'cards') return FeaturesCards;
        if (variant === 'list') return FeaturesList;
        return FeaturesGrid;
    }

    if (section.slot === 'cta') {
        if (variant === 'banner') return CTABanner;
        if (variant === 'minimal') return CTAMinimal;
        return CTADefault;
    }

    if (section.slot === 'navbar') {
        if (variant === 'centered') return NavbarCentered;
        if (variant === 'minimal') return NavbarMinimal;
        return NavbarDefault;
    }

    if (section.slot === 'footer') {
        if (variant === 'columns') return FooterColumns;
        if (variant === 'minimal') return FooterMinimal;
        return FooterDefault;
    }

    if (section.slot === 'about') {
        if (variant === 'minimal') return AboutMinimal;
        if (variant === 'detailed') return AboutDetailed;
        return AboutDefault;
    }

    return GenericSection;
}

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
            {page.sections.map((section: MarketingSection) => {
                const Renderer = resolveRenderer(section);
                return <Renderer key={section.id} section={section} />;
            })}
        </div>
    );
}
