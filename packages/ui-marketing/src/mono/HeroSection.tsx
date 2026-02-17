import type { HeroSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — HeroSection
 *
 * Left-aligned, typography-first. Large headline with tight tracking,
 * monospace label prefix, single CTA, optional inline metrics row.
 * Full-bleed bottom border. No gradients, no centered layout.
 */
export function MonoHeroSection({
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
            <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-28 md:pb-20">
                {/* Mono label */}
                {badge && (
                    <p className="mb-6 font-mono text-xs font-medium text-muted-foreground tracking-widest uppercase">
                        — {badge}
                    </p>
                )}

                {/* Headline */}
                <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold text-foreground leading-[1.05] tracking-tight max-w-4xl">
                    {headline}
                </h1>

                {/* Subheadline + CTAs row */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
                    {subheadline && (
                        <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                            {subheadline}
                        </p>
                    )}

                    {(primaryCta || secondaryCta) && (
                        <div className="flex items-center gap-2 shrink-0">
                            {primaryCta && (
                                <a
                                    href={primaryCta.href}
                                    onClick={primaryCta.onClick}
                                    className="inline-flex items-center justify-center h-10 px-5 bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {primaryCta.label}
                                </a>
                            )}
                            {secondaryCta && (
                                <a
                                    href={secondaryCta.href}
                                    onClick={secondaryCta.onClick}
                                    className="inline-flex items-center justify-center h-10 px-5 border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {secondaryCta.label}
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* Social proof */}
                {socialProof && (
                    <div className="mt-10 flex items-center gap-3">
                        <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
                            {socialProof.count}
                        </span>
                        <span className="text-sm text-muted-foreground">{socialProof.label}</span>
                    </div>
                )}

                {/* Product image */}
                {image && (
                    <div className="mt-14 border border-border overflow-hidden bg-muted">
                        <img src={image.src} alt={image.alt} className="w-full h-auto block" />
                    </div>
                )}
            </div>

            {/* Full-bleed bottom rule */}
            <div className="border-b border-border" />
        </section>
    );
}
