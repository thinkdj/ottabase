import type { CTABannerProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Atlas — CTABanner
 *
 * Bordered card with centered headline, subtext, and dual CTAs.
 * Subtle bg-muted background to lift it from the page.
 */
export function AtlasCTABanner({
    headline,
    subheadline,
    primaryCta,
    secondaryCta,
    className,
}: CTABannerProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className="rounded-lg border border-border bg-card px-8 py-12 md:px-16 text-center">
                    <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                        {headline}
                    </h2>
                    {subheadline && (
                        <p className="mt-3 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                            {subheadline}
                        </p>
                    )}

                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <a
                            href={primaryCta.href}
                            onClick={primaryCta.onClick}
                            className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {primaryCta.label}
                        </a>
                        {secondaryCta && (
                            <a
                                href={secondaryCta.href}
                                onClick={secondaryCta.onClick}
                                className="inline-flex items-center justify-center h-10 px-6 rounded-md border border-border bg-background text-foreground text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
