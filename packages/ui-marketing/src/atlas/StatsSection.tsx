import type { StatsSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Atlas — StatsSection
 *
 * A row of key metrics displayed in a bordered card grid.
 * Uses the gap-px bg-border pattern for hairline dividers between cards.
 */
export function AtlasStatsSection({ eyebrow, headline, stats, className }: StatsSectionProps) {
    const cols =
        stats.length === 2
            ? 'grid-cols-2'
            : stats.length === 3
              ? 'grid-cols-1 sm:grid-cols-3'
              : 'grid-cols-2 md:grid-cols-4';

    return (
        <section className={cn('border-y border-border bg-muted/30', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16">
                {(eyebrow || headline) && (
                    <div className="mb-10 text-center">
                        {eyebrow && (
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {eyebrow}
                            </p>
                        )}
                        {headline && (
                            <h2 className="font-heading text-2xl font-semibold text-foreground">{headline}</h2>
                        )}
                    </div>
                )}

                <div className={cn('grid gap-px rounded-lg overflow-hidden bg-border', cols)}>
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-background px-8 py-10 text-center">
                            <p className="font-heading text-4xl font-bold tracking-tight text-foreground">
                                {stat.value}
                            </p>
                            <p className="mt-1.5 text-sm font-medium text-foreground">{stat.label}</p>
                            {stat.description && (
                                <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
