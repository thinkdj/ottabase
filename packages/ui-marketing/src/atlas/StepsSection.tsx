import type { StepsSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Atlas — StepsSection
 *
 * "How it works" section with numbered steps, optional icons,
 * and a connector line between steps on desktop.
 */
export function AtlasStepsSection({ eyebrow, headline, subheadline, steps, className }: StepsSectionProps) {
    const cols = steps.length === 2 ? 'md:grid-cols-2' : steps.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';

    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-12 text-center">
                    {eyebrow && (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-3xl font-semibold text-foreground">{headline}</h2>
                    {subheadline && (
                        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                            {subheadline}
                        </p>
                    )}
                </div>

                {/* Steps grid */}
                <div className={cn('grid gap-8', cols)}>
                    {steps.map((step, i) => (
                        <div key={i} className="relative flex flex-col">
                            {/* Connector line — hidden on mobile, shown on desktop between steps */}
                            {i < steps.length - 1 && (
                                <div
                                    className="absolute top-4 left-[calc(50%+1.5rem)] right-[-1rem] hidden h-px bg-border md:block"
                                    aria-hidden="true"
                                />
                            )}
                            {/* Step badge + icon row */}
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                    {i + 1}
                                </div>
                                {step.icon && (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                                        {step.icon}
                                    </div>
                                )}
                            </div>
                            <h3 className="font-heading text-base font-semibold text-foreground">{step.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
