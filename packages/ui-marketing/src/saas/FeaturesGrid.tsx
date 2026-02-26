import type { FeaturesGridProps } from '../types';
import { cn } from '../lib/utils';

const colMap = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
};

/**
 * SaaS — FeaturesGrid
 *
 * Soft shadow cards with generous padding and rounded-2xl corners.
 * Icon sits in a tinted circle. No hard borders.
 */
export function SaaSFeaturesGrid({
    eyebrow,
    headline,
    subheadline,
    features,
    columns = 3,
    className,
}: FeaturesGridProps) {
    return (
        <section className={cn('bg-muted/30', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className="mb-14 text-center max-w-2xl mx-auto">
                    {eyebrow && (
                        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                            {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                        {headline}
                    </h2>
                    {subheadline && (
                        <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                            {subheadline}
                        </p>
                    )}
                </div>

                <div className={cn('grid grid-cols-1 gap-6', colMap[columns])}>
                    {features.map((feature, i) => (
                        <div
                            key={i}
                            className="rounded-2xl bg-card p-7 shadow-sm hover:shadow-md transition-shadow"
                        >
                            {feature.icon && (
                                <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary mb-4">
                                    {feature.icon}
                                </div>
                            )}
                            <h3 className="font-heading text-base font-semibold text-foreground mb-2">
                                {feature.title}
                            </h3>
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
