import type { TimelineSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — TimelineSection
 *
 * Vertical timeline with soft-shadow event cards. Dot connectors
 * with primary color. Alternating left/right on desktop, stacked on mobile.
 */
export function SaaSTimelineSection({ eyebrow, headline, subheadline, events, className }: TimelineSectionProps) {
    return (
        <section className={cn('bg-muted/30', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className="mb-14 text-center">
                    {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
                    <h2 className="font-heading text-3xl font-bold text-foreground">{headline}</h2>
                    {subheadline && <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{subheadline}</p>}
                </div>
                <div className="relative mx-auto max-w-3xl">
                    {/* Vertical line */}
                    <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-px" aria-hidden="true" />
                    <div className="space-y-10">
                        {events.map((event, i) => {
                            const isLeft = i % 2 === 0;
                            return (
                                <div key={i} className={cn('relative grid grid-cols-[40px_1fr] md:grid-cols-[1fr_40px_1fr] gap-4 md:gap-6 items-start')}>
                                    {/* Left content (desktop) */}
                                    <div className={cn('hidden md:block', isLeft ? 'text-right' : '')}>
                                        {isLeft && (
                                            <div className="pr-4 rounded-2xl bg-card p-5 shadow-sm">
                                                {event.tag && <span className="inline-block mb-2 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">{event.tag}</span>}
                                                <p className="text-xs font-medium text-muted-foreground mb-1">{event.date}</p>
                                                <h3 className="font-heading text-sm font-semibold text-foreground">{event.title}</h3>
                                                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                                            </div>
                                        )}
                                    </div>
                                    {/* Dot */}
                                    <div className="relative flex justify-center">
                                        <div className="h-3.5 w-3.5 rounded-full bg-primary shadow-md shadow-primary/30 ring-4 ring-background" />
                                    </div>
                                    {/* Right content (or mobile) */}
                                    <div className={cn(!isLeft ? '' : 'md:hidden')}>
                                        <div className="rounded-2xl bg-card p-5 shadow-sm">
                                            {event.tag && <span className="inline-block mb-2 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">{event.tag}</span>}
                                            <p className="text-xs font-medium text-muted-foreground mb-1">{event.date}</p>
                                            <h3 className="font-heading text-sm font-semibold text-foreground">{event.title}</h3>
                                            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
