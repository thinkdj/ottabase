import type { StatsSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — StatsSection
 *
 * Key metrics in a grid with monospace tabular numbers.
 * Uses an outer border + gap-based inner dividers for the strict-grid look.
 */
export function MonoStatsSection({ eyebrow, headline, stats, className }: StatsSectionProps) {
    const cols =
        stats.length === 2
            ? 'grid-cols-2'
            : stats.length === 3
              ? 'grid-cols-1 sm:grid-cols-3'
              : 'grid-cols-2 md:grid-cols-4';

    return (
        <section className={cn('bg-background border-y border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16">
                {(eyebrow || headline) && (
                    <div className="mb-10">
                        {eyebrow && (
                            <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                                — {eyebrow}
                            </p>
                        )}
                        {headline && <h2 className="font-heading text-xl font-semibold text-foreground">{headline}</h2>}
                    </div>
                )}

                <div className={cn('grid border-t border-l border-border', cols)}>
                    {stats.map((stat, i) => (
                        <div key={i} className="border-b border-r border-border px-8 py-10">
                            <p className="font-mono text-4xl font-bold tabular-nums text-foreground tracking-tight">
                                {stat.value}
                            </p>
                            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                {stat.label}
                            </p>
                            {stat.description && (
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{stat.description}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
