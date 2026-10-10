// Bold — dark, loud launch page. Oversized headline, a logo ticker (the one moving thing,
// paused for reduced motion), bento features led by one big cell, inverted featured plan,
// full-bleed closing block.

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

const wrap = 'mx-auto w-full max-w-7xl px-5 sm:px-8';
const btn = `inline-flex h-12 items-center justify-center rounded-xl px-7 text-base font-semibold transition-transform active:scale-[0.98] ${focusRing}`;

function Actions({ actions }: { actions?: Action[] }) {
    if (!actions?.length) return null;
    return (
        <div className="flex flex-wrap gap-3">
            {actions.map((a, i) => (
                <SiteLink
                    key={i}
                    href={a.href}
                    className={`${btn} ${i === 0 ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-2 border-border hover:border-foreground'}`}
                >
                    {a.label}
                </SiteLink>
            ))}
        </div>
    );
}

function Heading({ title, subtitle }: { title?: string; subtitle?: string }) {
    if (!title && !subtitle) return null;
    return (
        <div className="max-w-3xl">
            {title && (
                <h2 className="font-heading text-4xl font-bold leading-[0.95] tracking-tight sm:text-6xl">{title}</h2>
            )}
            {subtitle && <p className="mt-5 text-lg text-muted-foreground">{subtitle}</p>}
        </div>
    );
}

const TICKER_CSS = `
@keyframes otl-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
.otl-ticker { animation: otl-ticker 40s linear infinite; }
.otl-ticker-wrap:hover .otl-ticker { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .otl-ticker { animation: none; } }
`;

export const bold: ThemeComponents = {
    Shell({ site, currentPath, children }) {
        return (
            <>
                <header className={`${wrap} flex h-20 items-center justify-between gap-6`}>
                    <SiteLink href="/" className={`font-heading text-xl font-bold tracking-tight ${focusRing}`}>
                        {site.name}
                    </SiteLink>
                    <nav className="hidden items-center gap-8 md:flex">
                        {site.nav?.map((l, i) => (
                            <SiteLink
                                key={i}
                                href={l.href}
                                aria-current={isCurrent(l.href, currentPath) ? 'page' : undefined}
                                className={`text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-primary ${focusRing}`}
                            >
                                {l.label}
                            </SiteLink>
                        ))}
                    </nav>
                    <div className="flex items-center gap-2">
                        <SchemeToggle />
                        {site.navCtaHref && site.navCtaLabel && (
                            <SiteLink
                                href={site.navCtaHref}
                                className={`inline-flex h-10 items-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background max-md:hidden ${focusRing}`}
                            >
                                {site.navCtaLabel}
                            </SiteLink>
                        )}
                        <MobileMenu site={site} className="md:hidden" />
                    </div>
                </header>
                <main>{children}</main>
                <footer
                    className={`${wrap} mt-10 flex flex-col gap-6 border-t border-border py-12 md:flex-row md:items-end md:justify-between`}
                >
                    <div>
                        <p className="font-heading text-3xl font-bold tracking-tight">{site.name}</p>
                        {site.tagline && <p className="mt-2 text-muted-foreground">{site.tagline}</p>}
                    </div>
                    <div className="md:text-right">
                        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium md:justify-end">
                            {site.footerLinks?.map((l, i) => (
                                <SiteLink key={i} href={l.href} className={`hover:text-primary ${focusRing}`}>
                                    {l.label}
                                </SiteLink>
                            ))}
                        </nav>
                        {site.footerNote && <p className="mt-3 text-xs text-muted-foreground">{site.footerNote}</p>}
                    </div>
                </footer>
            </>
        );
    },

    sections: {
        hero({ eyebrow, title, subtitle, actions, imageUrl }) {
            const src = safeSrc(imageUrl);
            return (
                <div className={`${wrap} pb-20 pt-14 sm:pt-24`}>
                    {eyebrow && (
                        <p className="mb-8 inline-block rounded-full border border-primary/50 px-4 py-1.5 text-sm font-medium text-primary">
                            {eyebrow}
                        </p>
                    )}
                    <h1 className="max-w-5xl font-heading text-6xl font-bold leading-[0.9] tracking-tighter sm:text-7xl lg:text-[7.5rem]">
                        {title}
                    </h1>
                    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                        {subtitle && (
                            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                                {subtitle}
                            </p>
                        )}
                        <Actions actions={actions} />
                    </div>
                    {src && <img src={src} alt="" className="mt-16 w-full rounded-3xl border border-border" />}
                </div>
            );
        },

        logos({ title, items }) {
            if (!items?.length) return null;
            const row = (hidden: boolean) =>
                items.map((l, i) => {
                    const src = safeSrc(l.logoUrl);
                    return (
                        <li
                            key={`${hidden}-${i}`}
                            aria-hidden={hidden || undefined}
                            className="flex shrink-0 items-center px-8"
                        >
                            {src ? (
                                <img
                                    src={src}
                                    alt={hidden ? '' : l.name}
                                    className="h-8 w-auto opacity-70 brightness-0 [[data-scheme=dark]_&]:invert"
                                />
                            ) : (
                                <span className="font-heading text-2xl font-bold text-muted-foreground">{l.name}</span>
                            )}
                        </li>
                    );
                });
            return (
                <div className="border-y border-border py-8">
                    <style>{TICKER_CSS}</style>
                    {title && <p className={`${wrap} mb-6 text-sm text-muted-foreground`}>{title}</p>}
                    <div className="otl-ticker-wrap overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
                        <ul className="otl-ticker flex w-max">
                            {row(false)}
                            {row(true)}
                        </ul>
                    </div>
                </div>
            );
        },

        features({ title, subtitle, items }) {
            const [lead, ...rest] = items ?? [];
            return (
                <div className={`${wrap} py-20`}>
                    <Heading title={title} subtitle={subtitle} />
                    {lead && (
                        <div className="mt-12 grid gap-4 md:grid-cols-3">
                            <div className="flex flex-col justify-end rounded-3xl bg-primary p-8 text-primary-foreground md:col-span-2 md:row-span-2 md:p-10">
                                <h3 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                                    {lead.title}
                                </h3>
                                <p className="mt-3 max-w-md text-lg opacity-90">{lead.description}</p>
                            </div>
                            {rest.map((f, i) => (
                                <div key={i} className="rounded-3xl border border-border bg-muted/40 p-7">
                                    <h3 className="font-heading text-xl font-bold">{f.title}</h3>
                                    <p className="mt-2 text-muted-foreground">{f.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        },

        testimonials({ title, items }) {
            return (
                <div className={`${wrap} py-20`}>
                    <Heading title={title} />
                    <div className="mt-12 gap-4 [column-fill:_balance] sm:columns-2 lg:columns-3">
                        {items?.map((t, i) => {
                            const src = safeSrc(t.avatarUrl);
                            return (
                                <figure
                                    key={i}
                                    className="mb-4 break-inside-avoid rounded-3xl border border-border p-7"
                                >
                                    <blockquote className="text-lg leading-relaxed">{t.quote}</blockquote>
                                    <figcaption className="mt-6 flex items-center gap-3">
                                        {src ? (
                                            <img src={src} alt="" className="h-10 w-10 rounded-full object-cover" />
                                        ) : (
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                                {initials(t.author)}
                                            </span>
                                        )}
                                        <span className="text-sm">
                                            <span className="block font-bold">{t.author}</span>
                                            {t.role && <span className="text-muted-foreground">{t.role}</span>}
                                        </span>
                                    </figcaption>
                                </figure>
                            );
                        })}
                    </div>
                </div>
            );
        },

        pricing({ title, subtitle, plans }) {
            return (
                <div className={`${wrap} py-20`}>
                    <Heading title={title} subtitle={subtitle} />
                    <div
                        className={`mt-12 grid gap-4 ${(plans?.length ?? 0) >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}
                    >
                        {plans?.map((p, i) => (
                            <div
                                key={i}
                                className={`flex flex-col rounded-3xl p-8 ${p.featured ? 'bg-foreground text-background' : 'border border-border'}`}
                            >
                                <h3 className="font-heading text-xl font-bold">{p.name}</h3>
                                {p.description && <p className="mt-1 text-sm opacity-70">{p.description}</p>}
                                <p className="mt-8 font-heading text-6xl font-bold tracking-tighter">
                                    {p.price}
                                    {p.period && (
                                        <span className="ml-1 text-base font-medium tracking-normal opacity-60">
                                            {p.period}
                                        </span>
                                    )}
                                </p>
                                <ul className="mt-8 flex-1 space-y-2.5">
                                    {p.features?.map((f, i) => (
                                        <li key={i} className="flex gap-3">
                                            <span className="text-primary" aria-hidden>
                                                ✓
                                            </span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                {p.ctaHref && p.ctaLabel && (
                                    <SiteLink
                                        href={p.ctaHref}
                                        className={`${btn} mt-10 w-full ${p.featured ? 'bg-primary text-primary-foreground' : 'border-2 border-border hover:border-foreground'}`}
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
                <div className={`${wrap} grid gap-10 py-20 lg:grid-cols-[1fr_1.5fr]`}>
                    <Heading title={title} />
                    <div className="space-y-3">
                        {items?.map((q, i) => (
                            <details
                                key={i}
                                className="group rounded-2xl border border-border px-6 py-5 open:bg-muted/40"
                            >
                                <summary
                                    className={`flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-bold [&::-webkit-details-marker]:hidden ${focusRing}`}
                                >
                                    {q.question}
                                    <span
                                        className="text-2xl leading-none text-primary transition-transform group-open:rotate-45"
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
                <div className="mt-10 bg-primary py-24 text-primary-foreground">
                    <div className={wrap}>
                        <h2 className="max-w-4xl font-heading text-5xl font-bold leading-[0.95] tracking-tighter sm:text-7xl">
                            {title}
                        </h2>
                        {subtitle && <p className="mt-6 max-w-xl text-xl opacity-85">{subtitle}</p>}
                        {actions?.length ? (
                            <div className="mt-10 flex flex-wrap gap-3">
                                {actions.map((a, i) => (
                                    <SiteLink
                                        key={i}
                                        href={a.href}
                                        className={`${btn} ${i === 0 ? 'bg-primary-foreground text-primary' : 'border-2 border-primary-foreground/50'}`}
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
                <div className={`${wrap} grid gap-8 py-16 lg:grid-cols-[1fr_2fr]`}>
                    {title ? (
                        <h2 className="font-heading text-4xl font-bold leading-[0.95] tracking-tight">{title}</h2>
                    ) : (
                        <span />
                    )}
                    <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-muted-foreground">
                        {paragraphs(body).map((p, i) => (
                            <p key={i}>{p}</p>
                        ))}
                    </div>
                </div>
            );
        },
    },
};
