import type { FeaturesGridProps } from '../types';
import { cn } from '../lib/utils';

const colMap = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
};

/**
 * Atlas — FeaturesGrid
 *
 * Bordered card grid with optional icon box, title, and description.
 * Each card uses bg-card with border-border. Grid adapts from 2–4 columns.
 */
export function AtlasFeaturesGrid({
    eyebrow,
    headline,
    subheadline,
    features,
    columns = 3,
    className,
}: FeaturesGridProps) {
    return (
        <section className={cn('bg-background border-y border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-12 max-w-2xl">
                    {eyebrow && (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                            {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                        {headline}
                    </h2>
                    {subheadline && (
                        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                            {subheadline}
                        </p>
                    )}
                </div>

                {/* Grid */}
                <div className={cn('grid grid-cols-1 gap-px bg-border', colMap[columns])}>
                    {features.map((feature, i) => (
                        <div
                            key={i}
                            className="bg-card p-6 flex flex-col gap-4"
                        >
                            {/* Icon */}
                            {feature.icon && (
                                <div className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background text-foreground shrink-0">
                                    {feature.icon}
                                </div>
                            )}

                            <div>
                                <h3 className="font-heading text-sm font-semibold text-foreground mb-1">
                                    {feature.title}
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
