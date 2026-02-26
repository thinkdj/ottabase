import type { FeaturesGridProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — FeaturesGrid
 *
 * Numbered rows (01, 02 …) with title and description in a two-column layout.
 * Border between each row. No icons, no card boxes — pure type hierarchy.
 */
export function MonoFeaturesGrid({
    eyebrow,
    headline,
    subheadline,
    features,
    className,
}: FeaturesGridProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-8 pb-12 border-b border-border">
                    <div>
                        {eyebrow && (
                            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                — {eyebrow}
                            </p>
                        )}
                        <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                            {headline}
                        </h2>
                    </div>
                    {subheadline && (
                        <p className="text-base text-muted-foreground leading-relaxed self-end">
                            {subheadline}
                        </p>
                    )}
                </div>

                {/* Feature rows */}
                <div className="divide-y divide-border">
                    {features.map((feature, i) => (
                        <div
                            key={i}
                            className="grid grid-cols-1 md:grid-cols-[80px_1fr_2fr] gap-4 md:gap-8 py-8"
                        >
                            {/* Number */}
                            <span className="font-mono text-sm font-medium text-muted-foreground tabular-nums">
                                {String(i + 1).padStart(2, '0')}
                            </span>

                            {/* Title */}
                            <h3 className="font-heading text-sm font-semibold text-foreground">
                                {feature.title}
                            </h3>

                            {/* Description */}
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
