import type { FooterMarketingProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Atlas — FooterMarketing
 *
 * 4-column grid footer: brand description left, link groups center-right.
 * Bottom bar with copyright and optional social/legal links.
 */
export function AtlasFooterMarketing({
    brand,
    sections,
    social,
    legal,
    className,
}: FooterMarketingProps) {
    return (
        <footer className={cn('bg-background border-t border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-12">
                {/* Top row */}
                <div className={cn(
                    'grid grid-cols-2 gap-8',
                    sections.length <= 2
                        ? 'md:grid-cols-[1.5fr_repeat(2,1fr)]'
                        : sections.length === 3
                        ? 'md:grid-cols-[1.5fr_repeat(3,1fr)]'
                        : 'md:grid-cols-[1.5fr_repeat(4,1fr)]',
                )}>
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        {brand.logo ? (
                            <div className="mb-3">{brand.logo}</div>
                        ) : (
                            <p className="font-heading text-sm font-semibold text-foreground mb-3">
                                {brand.name}
                            </p>
                        )}
                        {brand.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                                {brand.description}
                            </p>
                        )}

                        {/* Social icons */}
                        {social && social.length > 0 && (
                            <div className="mt-5 flex items-center gap-2">
                                {social.map((s) => (
                                    <a
                                        key={s.name}
                                        href={s.href}
                                        aria-label={s.name}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    >
                                        {s.icon ?? <span className="text-xs">{s.name[0]}</span>}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Link sections */}
                    {sections.map((section) => (
                        <div key={section.title}>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {section.title}
                            </p>
                            <ul className="flex flex-col gap-2">
                                {section.links.map((link) => (
                                    <li key={link.href}>
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

                {/* Bottom bar */}
                <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                        {legal?.copyright ?? `© ${new Date().getFullYear()} ${brand.name}. All rights reserved.`}
                    </p>

                    {legal?.links && legal.links.length > 0 && (
                        <div className="flex items-center gap-4">
                            {legal.links.map((link) => (
                                <a
                                    key={link.href}
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
