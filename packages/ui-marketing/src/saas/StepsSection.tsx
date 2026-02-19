import type { StepsSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — StepsSection
 *
 * "How it works" with numbered circles connected by a dashed line.
 * Each step is a soft shadow card with rounded-2xl.
 */
export function SaaSStepsSection({ eyebrow, headline, subheadline, steps, className }: StepsSectionProps) {
    const cols = steps.length === 2 ? 'md:grid-cols-2' : steps.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';

    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className="mb-14 text-center">
                    {eyebrow && (
                        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-3xl font-bold text-foreground">{headline}</h2>
                    {subheadline && (
                        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                            {subheadline}
                        </p>
                    )}
                </div>

                <div className={cn('grid gap-8', cols)}>
                    {steps.map((step, i) => (
                        <div key={i} className="relative text-center">
                            {/* Dashed connector */}
                            {i < steps.length - 1 && (
                                <div
                                    className="absolute top-5 left-[calc(50%+2rem)] right-[-1rem] hidden h-px border-t-2 border-dashed border-border md:block"
                                    aria-hidden="true"
                                />
                            )}
                            <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/20">
                                {i + 1}
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
