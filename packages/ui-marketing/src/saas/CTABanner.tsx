import type { CTABannerProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — CTABanner
 *
 * Full-width tinted background with centered content and pill CTAs.
 * Soft rounded container with primary tint. No hard borders.
 */
export function SaaSCTABanner({
    headline,
    subheadline,
    primaryCta,
    secondaryCta,
    className,
}: CTABannerProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className="rounded-3xl bg-primary/5 px-8 py-14 md:px-16 text-center">
                    <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                        {headline}
                    </h2>
                    {subheadline && (
                        <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                            {subheadline}
                        </p>
                    )}

                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href={primaryCta.href}
                            onClick={primaryCta.onClick}
                            className="inline-flex items-center justify-center h-11 px-7 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:shadow-lg transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {primaryCta.label}
                        </a>
                        {secondaryCta && (
                            <a
                                href={secondaryCta.href}
                                onClick={secondaryCta.onClick}
                                className="inline-flex items-center justify-center h-11 px-7 rounded-full bg-background text-foreground text-sm font-medium shadow-sm hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
