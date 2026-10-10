// Launch — product-forward SaaS. Frosted sticky nav, centered display headline,
// split "heading left / features right" layout, tiered pricing, solid closing panel.

import {
    focusRing,
    initials,
    isCurrent,
    MobileMenu,
    paragraphs,
    safeSrc,
    SiteLink,
    type Action,
    type ThemeComponents,
} from '../shared';
import { SchemeToggle } from '../scheme-toggle';

const wrap = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const narrow = 'mx-auto w-full max-w-3xl px-5 sm:px-8';
const btn = `inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors ${focusRing}`;
const btnSmall = `inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 ${focusRing}`;
const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`;
const btnSecondary = `${btn} border border-border bg-background text-foreground hover:bg-muted`;

function Actions({ actions, center }: { actions?: Action[]; center?: boolean }) {
    if (!actions?.length) return null;
    return (
        <div className={`flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>
            {actions.map((a, i) => (
                <SiteLink key={i} href={a.href} className={i === 0 ? btnPrimary : btnSecondary}>
                    {a.label}
                </SiteLink>
            ))}
        </div>
    );
}

function Heading({ title, subtitle, center }: { title?: string; subtitle?: string; center?: boolean }) {
    if (!title && !subtitle) return null;
    return (
        <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
            {title && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>}
            {subtitle && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
    );
}

export const launch: ThemeComponents = {
    Shell({ site, currentPath, children }) {
        return (
            <>
                <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
                    <div className={`${wrap} flex h-16 items-center justify-between gap-6`}>
                        <SiteLink href="/" className={`font-heading text-lg font-semibold tracking-tight ${focusRing}`}>
                            {site.name}
                        </SiteLink>
                        <nav className="hidden items-center gap-1 md:flex">
                            {site.nav?.map((l, i) => (
                                <SiteLink
                                    key={i}
                                    href={l.href}
                                    aria-current={isCurrent(l.href, currentPath) ? 'page' : undefined}
                                    className={`rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground ${focusRing}`}
                                >
                                    {l.label}
                                </SiteLink>
                            ))}
                        </nav>
                        <div className="flex items-center gap-2">
                            <SchemeToggle />
                            {site.navCtaHref && site.navCtaLabel && (
                                <SiteLink href={site.navCtaHref} className={`${btnSmall} max-md:hidden`}>
                                    {site.navCtaLabel}
                                </SiteLink>
                            )}
                            <MobileMenu site={site} className="md:hidden" />
                        </div>
                    </div>
                </header>
                <main>{children}</main>
                <footer className="mt-24 border-t border-border">
                    <div className={`${wrap} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
                        <div>
                            <p className="font-heading font-semibold">{site.name}</p>
                            {site.tagline && <p className="mt-1 text-sm text-muted-foreground">{site.tagline}</p>}
                        </div>
                        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            {site.footerLinks?.map((l, i) => (
                                <SiteLink key={i} href={l.href} className={`hover:text-foreground ${focusRing}`}>
                                    {l.label}
                                </SiteLink>
                            ))}
                        </nav>
                    </div>
                    {site.footerNote && (
                        <p className={`${wrap} pb-10 text-xs text-muted-foreground`}>{site.footerNote}</p>
                    )}
                </footer>
            </>
        );
    },

    sections: {
        hero({ eyebrow, title, subtitle, actions, imageUrl }) {
            const src = safeSrc(imageUrl);
            return (
                <div className={`${wrap} pb-16 pt-20 text-center sm:pt-28`}>
                    {eyebrow && (
                        <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                            {eyebrow}
                        </p>
                    )}
                    <h1 className="mx-auto max-w-4xl font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                            {subtitle}
                        </p>
                    )}
                    <div className="mt-10">
                        <Actions actions={actions} center />
                    </div>
                    {src && (
                        <div className="mx-auto mt-16 max-w-5xl rounded-2xl border border-border bg-muted/40 p-2 shadow-2xl shadow-primary/10">
                            <img src={src} alt="" className="w-full rounded-xl" />
                        </div>
                    )}
                </div>
            );
        },

        logos({ title, items }) {
            return (
                <div className={`${wrap} py-12`}>
                    {title && <p className="text-center text-sm text-muted-foreground">{title}</p>}
                    <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
                        {items?.map((l, i) => {
                            const src = safeSrc(l.logoUrl);
                            return (
                                <li key={i} className="text-lg font-semibold text-muted-foreground/80">
                                    {src ? (
                                        <img src={src} alt={l.name} className="h-7 w-auto opacity-70 grayscale" />
                                    ) : (
                                        l.name
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            );
        },

        features({ title, subtitle, items }) {
            return (
                <div className={`${wrap} grid gap-12 py-20 lg:grid-cols-[1fr_1.6fr]`}>
                    <div className="lg:sticky lg:top-28 lg:self-start">
                        <Heading title={title} subtitle={subtitle} />
                    </div>
                    <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
                        {items?.map((f, i) => (
                            <div key={i} className="border-t border-border pt-6">
                                <dt className="flex items-center gap-3 font-heading text-lg font-semibold">
                                    <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
                                    {f.title}
                                </dt>
                                <dd className="mt-2 leading-relaxed text-muted-foreground">{f.description}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            );
        },

        testimonials({ title, items }) {
            const [lead, ...rest] = items ?? [];
            if (!lead) return null;
            return (
                <div className={`${wrap} py-20`}>
                    <Heading title={title} center />
                    <figure className="mx-auto mt-12 max-w-3xl text-center">
                        <blockquote className="font-heading text-2xl font-medium leading-snug sm:text-3xl">
                            “{lead.quote}”
                        </blockquote>
                        <figcaption className="mt-6 text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{lead.author}</span>
                            {lead.role && <>, {lead.role}</>}
                        </figcaption>
                    </figure>
                    {rest.length > 0 && (
                        <div className="mt-14 grid gap-6 md:grid-cols-2">
                            {rest.map((t, i) => {
                                const src = safeSrc(t.avatarUrl);
                                return (
                                    <figure key={i} className="rounded-2xl border border-border p-6">
                                        <blockquote className="leading-relaxed">“{t.quote}”</blockquote>
                                        <figcaption className="mt-5 flex items-center gap-3 text-sm">
                                            {src ? (
                                                <img src={src} alt="" className="h-9 w-9 rounded-full object-cover" />
                                            ) : (
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                    {initials(t.author)}
                                                </span>
                                            )}
                                            <span>
                                                <span className="block font-semibold">{t.author}</span>
                                                {t.role && <span className="text-muted-foreground">{t.role}</span>}
                                            </span>
                                        </figcaption>
                                    </figure>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        },

        pricing({ title, subtitle, plans }) {
            return (
                <div className={`${wrap} py-20`}>
                    <Heading title={title} subtitle={subtitle} center />
                    <div
                        className={`mx-auto mt-14 grid max-w-5xl gap-6 ${(plans?.length ?? 0) >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}
                    >
                        {plans?.map((p, i) => (
                            <div
                                key={i}
                                className={`relative flex flex-col rounded-3xl border p-8 ${p.featured ? 'border-primary bg-primary/[0.04] shadow-xl shadow-primary/10' : 'border-border'}`}
                            >
                                {p.featured && (
                                    <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                                        Most popular
                                    </span>
                                )}
                                <h3 className="font-heading text-lg font-semibold">{p.name}</h3>
                                {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                                <p className="mt-6 flex items-baseline gap-1">
                                    <span className="font-heading text-5xl font-semibold tracking-tight">
                                        {p.price}
                                    </span>
                                    {p.period && <span className="text-sm text-muted-foreground">{p.period}</span>}
                                </p>
                                <ul className="mt-8 flex-1 space-y-3 text-sm">
                                    {p.features?.map((f, i) => (
                                        <li key={i} className="flex gap-3">
                                            <span
                                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                                                aria-hidden
                                            />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                {p.ctaHref && p.ctaLabel && (
                                    <SiteLink
                                        href={p.ctaHref}
                                        className={`${p.featured ? btnPrimary : btnSecondary} mt-8 w-full`}
                                    >
                                        {p.ctaLabel}
                                    </SiteLink>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        },

        faq({ title, items }) {
            return (
                <div className={`${narrow} py-20`}>
                    <Heading title={title} center />
                    <div className="mt-10 divide-y divide-border border-y border-border">
                        {items?.map((q, i) => (
                            <details key={i} className="group py-5">
                                <summary
                                    className={`flex cursor-pointer list-none items-center justify-between gap-6 font-medium [&::-webkit-details-marker]:hidden ${focusRing}`}
                                >
                                    {q.question}
                                    <span
                                        className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45"
                                        aria-hidden
                                    >
                                        +
                                    </span>
                                </summary>
                                <p className="mt-3 leading-relaxed text-muted-foreground">{q.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            );
        },

        cta({ title, subtitle, actions }) {
            return (
                <div className={`${wrap} py-16`}>
                    <div className="rounded-[2rem] bg-primary px-8 py-16 text-center text-primary-foreground sm:px-16">
                        <h2 className="mx-auto max-w-2xl font-heading text-3xl font-semibold tracking-tight sm:text-5xl">
                            {title}
                        </h2>
                        {subtitle && <p className="mx-auto mt-4 max-w-xl text-lg opacity-85">{subtitle}</p>}
                        {actions?.length ? (
                            <div className="mt-10 flex flex-wrap justify-center gap-3">
                                {actions.map((a, i) => (
                                    <SiteLink
                                        key={i}
                                        href={a.href}
                                        className={`${btn} ${i === 0 ? 'bg-primary-foreground text-primary hover:opacity-90' : 'border border-primary-foreground/40 hover:bg-primary-foreground/10'}`}
                                    >
                                        {a.label}
                                    </SiteLink>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            );
        },

        text({ title, body }) {
            return (
                <div className={`${narrow} py-14`}>
                    {title && <h2 className="font-heading text-3xl font-semibold tracking-tight">{title}</h2>}
                    <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted-foreground">
                        {paragraphs(body).map((p, i) => (
                            <p key={i}>{p}</p>
                        ))}
                    </div>
                </div>
            );
        },
    },
};
