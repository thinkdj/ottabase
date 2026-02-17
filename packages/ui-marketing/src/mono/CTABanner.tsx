import type { CTABannerProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — CTABanner
 *
 * Full-width inverted section (bg-foreground, text-background).
 * Left-aligned. Hard edges. Single primary CTA in inverse colors.
 * The most striking section on the page — use once, at the bottom.
 */
export function MonoCTABanner({
    headline,
    subheadline,
    primaryCta,
    secondaryCta,
    className,
}: CTABannerProps) {
    return (
        <section className={cn('bg-foreground', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
                    {/* Text */}
                    <div>
                        <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-semibold text-background tracking-tight leading-tight">
                            {headline}
                        </h2>
                        {subheadline && (
                            <p className="mt-4 text-base text-background/60 max-w-lg leading-relaxed">
                                {subheadline}
                            </p>
                        )}
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-start md:items-center gap-3 shrink-0">
                        <a
                            href={primaryCta.href}
                            onClick={primaryCta.onClick}
                            className="inline-flex items-center justify-center h-10 px-6 bg-background text-foreground text-sm font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
                        >
                            {primaryCta.label}
                        </a>
                        {secondaryCta && (
                            <a
                                href={secondaryCta.href}
                                onClick={secondaryCta.onClick}
                                className="inline-flex items-center justify-center h-10 px-6 border border-background/40 text-background text-sm font-medium hover:border-background/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
                            >
                                {secondaryCta.label}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
