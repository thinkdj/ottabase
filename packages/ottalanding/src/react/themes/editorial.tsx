// Editorial — long-form magazine. Persistent side navigation, large left-aligned serif,
// logos written as a sentence, features as a definition list, pricing as a menu of rows,
// FAQ fully open, drop cap on prose.

import {
    focusRing,
    isCurrent,
    MobileMenu,
    paragraphs,
    safeSrc,
    SiteLink,
    type Action,
    type ThemeComponents,
} from '../shared';
import { SchemeToggle } from '../scheme-toggle';

const column = 'w-full max-w-3xl px-6 sm:px-10';
const link = `underline decoration-primary/40 decoration-2 underline-offset-[6px] transition-colors hover:decoration-primary ${focusRing}`;

function Actions({ actions }: { actions?: Action[] }) {
    if (!actions?.length) return null;
    return (
        <p className="flex flex-wrap gap-x-8 gap-y-3 text-lg font-semibold">
            {actions.map((a, i) => (
                <SiteLink key={a.href + a.label} href={a.href} className={i === 0 ? `${link} text-primary` : link}>
                    {a.label}
                </SiteLink>
            ))}
        </p>
    );
}

function Title({ children }: { children?: string }) {
    if (!children) return null;
    return <h2 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl">{children}</h2>;
}

/** "A, B, C and D" */
function sentence(names: string[]): string {
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export const editorial: ThemeComponents = {
    Shell({ site, currentPath, children }) {
        return (
            <div className="md:grid md:grid-cols-[15rem_1fr] lg:grid-cols-[17rem_1fr]">
                <aside className="border-b border-border md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
                    <div className="flex items-center justify-between px-6 py-5 md:h-full md:flex-col md:items-start md:justify-start md:px-8 md:py-10">
                        <SiteLink href="/" className={`font-heading text-2xl font-semibold leading-none ${focusRing}`}>
                            {site.name}
                        </SiteLink>
                        {site.tagline && (
                            <p className="mt-3 hidden font-heading text-sm italic leading-snug text-muted-foreground md:block">
                                {site.tagline}
                            </p>
                        )}
                        <nav className="mt-12 hidden flex-col gap-3 md:flex">
                            {site.nav?.map((l) => (
                                <SiteLink
                                    key={l.href + l.label}
                                    href={l.href}
                                    aria-current={isCurrent(l.href, currentPath) ? 'page' : undefined}
                                    className={`w-fit text-[0.95rem] text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground ${focusRing}`}
                                >
                                    {l.label}
                                </SiteLink>
                            ))}
                        </nav>
                        {site.navCtaHref && site.navCtaLabel && (
                            <SiteLink
                                href={site.navCtaHref}
                                className={`${link} mt-10 hidden font-semibold text-primary md:inline`}
                            >
                                {site.navCtaLabel}
                            </SiteLink>
                        )}
                        <div className="flex items-center gap-1 md:mt-auto">
                            <SchemeToggle />
                            <MobileMenu site={site} className="md:hidden" />
                        </div>
                    </div>
                </aside>
                <div className="min-w-0">
                    <main className="pb-16">{children}</main>
                    <footer className={`${column} border-t border-border py-10 text-sm text-muted-foreground`}>
                        <nav className="flex flex-wrap gap-x-6 gap-y-2">
                            {site.footerLinks?.map((l) => (
                                <SiteLink
                                    key={l.href + l.label}
                                    href={l.href}
                                    className={`hover:text-foreground ${focusRing}`}
                                >
                                    {l.label}
                                </SiteLink>
                            ))}
                        </nav>
                        {site.footerNote && <p className="mt-4">{site.footerNote}</p>}
                    </footer>
                </div>
            </div>
        );
    },

    sections: {
        hero({ eyebrow, title, subtitle, actions, imageUrl }) {
            const src = safeSrc(imageUrl);
            return (
                <header className={`${column} pb-14 pt-16 sm:pt-24`}>
                    {eyebrow && <p className="mb-6 font-heading text-lg italic text-primary">{eyebrow}</p>}
                    <h1 className="font-heading text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-8 max-w-2xl font-heading text-xl leading-relaxed text-muted-foreground sm:text-2xl">
                            {subtitle}
                        </p>
                    )}
                    <div className="mt-10">
                        <Actions actions={actions} />
                    </div>
                    {src && <img src={src} alt="" className="mt-14 w-full rounded-sm" />}
                </header>
            );
        },

        logos({ title, items }) {
            if (!items?.length) return null;
            const withImages = items.filter((l) => safeSrc(l.logoUrl));
            return (
                <div className={`${column} py-8`}>
                    <p className="border-l-2 border-primary pl-5 font-heading text-xl leading-relaxed">
                        {title ? `${title} ` : ''}
                        <span className="font-semibold">{sentence(items.map((l) => l.name))}</span>.
                    </p>
                    {withImages.length > 0 && (
                        <div className="mt-6 flex flex-wrap items-center gap-8 pl-6">
                            {withImages.map((l) => (
                                <img
                                    key={l.name}
                                    src={safeSrc(l.logoUrl)}
                                    alt={l.name}
                                    className="h-6 w-auto opacity-60 grayscale"
                                />
                            ))}
                        </div>
                    )}
                </div>
            );
        },

        features({ title, subtitle, items }) {
            return (
                <div className={`${column} py-14`}>
                    <Title>{title}</Title>
                    {subtitle && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{subtitle}</p>}
                    <dl className="mt-10 space-y-8">
                        {items?.map((f) => (
                            <div key={f.title} className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:gap-8">
                                <dt className="font-heading text-lg font-semibold">{f.title}</dt>
                                <dd className="leading-relaxed text-muted-foreground">{f.description}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            );
        },

        testimonials({ title, items }) {
            return (
                <div className={`${column} py-14`}>
                    <Title>{title}</Title>
                    <div className="mt-10 space-y-14">
                        {items?.map((t) => (
                            <figure key={t.quote} className="relative pl-10">
                                <span
                                    className="absolute -left-1 -top-4 font-heading text-7xl leading-none text-primary/30"
                                    aria-hidden
                                >
                                    “
                                </span>
                                <blockquote className="font-heading text-2xl leading-snug sm:text-[1.7rem]">
                                    {t.quote}
                                </blockquote>
                                <figcaption className="mt-4 text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">{t.author}</span>
                                    {t.role && <span className="italic">, {t.role}</span>}
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            );
        },

        pricing({ title, subtitle, plans }) {
            return (
                <div className={`${column} py-14`}>
                    <Title>{title}</Title>
                    {subtitle && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{subtitle}</p>}
                    <div className="mt-10 border-t-2 border-foreground">
                        {plans?.map((p) => (
                            <div
                                key={p.name}
                                className={`grid gap-4 border-b border-border py-8 sm:grid-cols-[1fr_auto] sm:gap-10 ${p.featured ? 'bg-primary/[0.05] px-5 sm:-mx-5' : ''}`}
                            >
                                <div>
                                    <h3 className="font-heading text-2xl font-semibold">
                                        {p.name}
                                        {p.featured && (
                                            <span className="ml-3 align-middle text-sm font-normal italic text-primary">
                                                our pick
                                            </span>
                                        )}
                                    </h3>
                                    {p.description && <p className="mt-1 text-muted-foreground">{p.description}</p>}
                                    {p.features?.length ? (
                                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                            {p.features.join(', ')}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex items-baseline gap-4 sm:flex-col sm:items-end sm:gap-2">
                                    <p className="font-heading text-3xl font-semibold">
                                        {p.price}
                                        {p.period && (
                                            <span className="ml-1 text-base font-normal text-muted-foreground">
                                                {p.period}
                                            </span>
                                        )}
                                    </p>
                                    {p.ctaHref && p.ctaLabel && (
                                        <SiteLink href={p.ctaHref} className={`${link} text-sm font-semibold`}>
                                            {p.ctaLabel}
                                        </SiteLink>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        },

        faq({ title, items }) {
            return (
                <div className={`${column} py-14`}>
                    <Title>{title}</Title>
                    <dl className="mt-10 space-y-8">
                        {items?.map((q) => (
                            <div key={q.question}>
                                <dt className="font-heading text-xl font-semibold">{q.question}</dt>
                                <dd className="mt-2 leading-relaxed text-muted-foreground">{q.answer}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            );
        },

        cta({ title, subtitle, actions }) {
            return (
                <div className={`${column} py-16`}>
                    <div className="border-y-2 border-foreground py-12">
                        <h2 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">{title}</h2>
                        {subtitle && (
                            <p className="mt-4 font-heading text-xl italic text-muted-foreground">{subtitle}</p>
                        )}
                        <div className="mt-8">
                            <Actions actions={actions} />
                        </div>
                    </div>
                </div>
            );
        },

        text({ title, body }) {
            return (
                <article className={`${column} py-12`}>
                    <Title>{title}</Title>
                    <div className="mt-6 space-y-6 font-heading text-lg leading-[1.8] first-letter:float-left first-letter:mr-3 first-letter:font-heading first-letter:text-7xl first-letter:font-semibold first-letter:leading-[0.8] first-letter:text-primary">
                        {paragraphs(body).map((p) => (
                            <p key={p}>{p}</p>
                        ))}
                    </div>
                </article>
            );
        },
    },
};
