import type { StepsSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — StepsSection
 *
 * "How it works" as a numbered list of rows.
 * Three-column grid: step number left, title center, description right.
 */
export function MonoStepsSection({ eyebrow, headline, subheadline, steps, className }: StepsSectionProps) {
    return (
        <section className={cn('bg-background border-t border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-12">
                    {eyebrow && (
                        <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                            — {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-3xl font-semibold text-foreground">{headline}</h2>
                    {subheadline && <p className="mt-3 max-w-2xl text-muted-foreground">{subheadline}</p>}
                </div>

                {/* Steps rows */}
                <div className="flex flex-col divide-y divide-border">
                    {steps.map((step, i) => (
                        <div
                            key={i}
                            className="py-8 grid grid-cols-1 sm:grid-cols-[56px_1fr_2fr] gap-4 sm:gap-6 items-start"
                        >
                            <span className="font-mono text-lg font-bold tabular-nums text-muted-foreground">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <h3 className="font-heading text-sm font-semibold text-foreground pt-px">{step.title}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
