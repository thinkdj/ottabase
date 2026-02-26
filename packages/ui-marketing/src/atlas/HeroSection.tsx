'use client';

import type { HeroSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Atlas — HeroSection
 *
 * Centered layout with badge, headline, subheadline, dual CTAs and optional
 * product screenshot. Clean, systematic, Notion/Atlassian feel.
 * No gradients. Relies entirely on brand CSS variables via Tailwind.
 */
export function AtlasHeroSection({
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
            {/* Subtle top rule */}
            <div className="border-b border-border" />

            <div className="mx-auto max-w-5xl px-6 py-20 md:py-28 text-center">
                {/* Badge */}
                {badge && (
                    <div className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-1 mb-6">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-xs font-medium text-muted-foreground tracking-wide">
                            {badge}
                        </span>
                    </div>
                )}

                {/* Headline */}
                <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground leading-tight tracking-tight">
                    {headline}
                </h1>

                {/* Subheadline */}
                {subheadline && (
                    <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        {subheadline}
                    </p>
                )}

                {/* CTAs */}
                {(primaryCta || secondaryCta) && (
                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                        {primaryCta && (
                            <a
                                href={primaryCta.href}
                                onClick={primaryCta.onClick}
                                className="inline-flex items-center justify-center h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {primaryCta.label}
                            </a>
                        )}
                        {secondaryCta && (
                            <a
                                href={secondaryCta.href}
                                onClick={secondaryCta.onClick}
                                className="inline-flex items-center justify-center h-10 px-5 rounded-md border border-border bg-background text-foreground text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {secondaryCta.label}
                            </a>
                        )}
                    </div>
                )}

                {/* Social proof */}
                {socialProof && (
                    <p className="mt-6 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{socialProof.count}</span>{' '}
                        {socialProof.label}
                    </p>
                )}

                {/* Product image */}
                {image && (
                    <div className="mt-14 border border-border rounded-lg overflow-hidden bg-muted">
                        <img
                            src={image.src}
                            alt={image.alt}
                            className="w-full h-auto block"
                        />
                    </div>
                )}
            </div>
        </section>
    );
}
