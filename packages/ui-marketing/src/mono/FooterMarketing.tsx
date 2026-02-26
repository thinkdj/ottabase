import type { FooterMarketingProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — FooterMarketing
 *
 * Ultra-minimal. Brand name and nav links in a single row.
 * Section groups rendered inline. Copyright in a bottom strip.
 * No column grids — just a flat, horizontal layout.
 */
export function MonoFooterMarketing({ brand, sections, social, legal, className }: FooterMarketingProps) {
    const allLinks = sections.flatMap((s) => s.links);

    return (
        <footer className={cn('bg-background border-t border-border', className)}>
            <div className="mx-auto max-w-6xl px-6">
                {/* Main row */}
                <div className="py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    {/* Brand */}
                    <div className="flex items-center gap-4">
                        {brand.logo ? (
                            brand.logo
                        ) : (
                            <span className="font-heading text-sm font-semibold text-foreground">{brand.name}</span>
                        )}
                        {brand.description && (
                            <span className="hidden md:inline text-xs text-muted-foreground">
                                — {brand.description}
                            </span>
                        )}
                    </div>

                    {/* Navigation links — flat list */}
                    <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {sections.map((section, si) => (
                            <div key={section.title} className="flex items-center gap-5">
                                {si > 0 && (
                                    <span className="text-border font-mono text-xs" aria-hidden="true">
                                        ·
                                    </span>
                                )}
                                {section.links.map((link) => (
                                    <a
                                        key={link.label}
                                        href={link.href}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {link.label}
                                    </a>
                                ))}
                            </div>
                        ))}
                    </nav>
                </div>

                {/* Bottom strip */}
                <div className="py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="font-mono text-xs text-muted-foreground">
                        {legal?.copyright ?? `© ${new Date().getFullYear()} ${brand.name}`}
                    </p>

                    <div className="flex items-center gap-4">
                        {/* Legal links */}
                        {legal?.links?.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}

                        {/* Social icons */}
                        {social?.map((s) => (
                            <a
                                key={s.name}
                                href={s.href}
                                aria-label={s.name}
                                className="h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {s.icon ?? <span className="font-mono text-xs">{s.name[0]}</span>}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
