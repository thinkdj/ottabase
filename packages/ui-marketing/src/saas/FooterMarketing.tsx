import type { FooterMarketingProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — FooterMarketing
 *
 * Clean footer with brand left, link columns right. No heavy borders.
 * Soft divider line. Social icons as rounded pills.
 */
export function SaaSFooterMarketing({ brand, sections, social, legal, className }: FooterMarketingProps) {
    return (
        <footer className={cn('bg-muted/30', className)}>
            <div className="mx-auto max-w-6xl px-6 py-14">
                <div
                    className={cn(
                        'grid grid-cols-2 gap-8',
                        sections.length <= 2
                            ? 'md:grid-cols-[1.5fr_repeat(2,1fr)]'
                            : sections.length === 3
                              ? 'md:grid-cols-[1.5fr_repeat(3,1fr)]'
                              : 'md:grid-cols-[1.5fr_repeat(4,1fr)]',
                    )}
                >
                    <div className="col-span-2 md:col-span-1">
                        {brand.logo ? (
                            <div className="mb-3">{brand.logo}</div>
                        ) : (
                            <p className="font-heading text-base font-bold text-foreground mb-3">{brand.name}</p>
                        )}
                        {brand.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                                {brand.description}
                            </p>
                        )}

                        {social && social.length > 0 && (
                            <div className="mt-5 flex items-center gap-2">
                                {social.map((s) => (
                                    <a
                                        key={s.name}
                                        href={s.href}
                                        aria-label={s.name}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                    >
                                        {s.icon ?? <span className="text-xs">{s.name[0]}</span>}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {sections.map((section) => (
                        <div key={section.title}>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {section.title}
                            </p>
                            <ul className="flex flex-col gap-2.5">
                                {section.links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-12 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                        {legal?.copyright ?? `\u00A9 ${new Date().getFullYear()} ${brand.name}. All rights reserved.`}
                    </p>

                    {legal?.links && legal.links.length > 0 && (
                        <div className="flex items-center gap-4">
                            {legal.links.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </footer>
    );
}
