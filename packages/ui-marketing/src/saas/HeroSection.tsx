'use client';

import type { HeroSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — HeroSection
 *
 * Centered, airy layout with pill badge, large headline, soft shadow CTAs,
 * and generous whitespace. Modern SaaS feel — no gradients, no harsh borders.
 */
export function SaaSHeroSection({
    badge,
    headline,
    subheadline,
    primaryCta,
    secondaryCta,
    image,
    socialProof,
    className,
}: HeroSectionProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-5xl px-6 py-24 md:py-32 text-center">
                {badge && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 mb-8">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-medium text-primary">{badge}</span>
                    </div>
                )}

                <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                    {headline}
                </h1>

                {subheadline && (
                    <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        {subheadline}
                    </p>
                )}

                {(primaryCta || secondaryCta) && (
                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        {primaryCta && (
                            <a
                                href={primaryCta.href}
                                onClick={primaryCta.onClick}
                                className="inline-flex items-center justify-center h-11 px-7 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {primaryCta.label}
                            </a>
                        )}
                        {secondaryCta && (
                            <a
                                href={secondaryCta.href}
                                onClick={secondaryCta.onClick}
                                className="inline-flex items-center justify-center h-11 px-7 rounded-full bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {secondaryCta.label}
                            </a>
                        )}
                    </div>
                )}

                {socialProof && (
                    <p className="mt-8 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{socialProof.count}</span>{' '}
                        {socialProof.label}
                    </p>
                )}

                {image && (
                    <div className="mt-16 rounded-2xl overflow-hidden shadow-2xl shadow-black/10 bg-muted">
                        <img src={image.src} alt={image.alt} className="w-full h-auto block" />
                    </div>
                )}
            </div>
        </section>
    );
}
