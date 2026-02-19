import type { StatsSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — StatsSection
 *
 * Clean row of metrics with large values. Soft dividers between items.
 * No borders or cards — just clean typography on a tinted background.
 */
export function SaaSStatsSection({ eyebrow, headline, stats, className }: StatsSectionProps) {
    return (
        <section className={cn('bg-muted/30', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
                {(eyebrow || headline) && (
                    <div className="mb-10 text-center">
                        {eyebrow && (
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {eyebrow}
                            </p>
                        )}
                        {headline && (
                            <h2 className="font-heading text-2xl font-bold text-foreground">{headline}</h2>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-center divide-x divide-border">
                    {stats.map((stat, i) => (
                        <div key={i} className="px-10 py-4 text-center">
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
