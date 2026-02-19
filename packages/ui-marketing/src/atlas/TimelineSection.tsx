import type { TimelineSectionProps } from '../types';
import { cn } from '../lib/utils';

export function AtlasTimelineSection({ eyebrow, headline, subheadline, events, className }: TimelineSectionProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className="mb-12 text-center">
                    {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
                    <h2 className="font-heading text-3xl font-semibold text-foreground">{headline}</h2>
                    {subheadline && <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{subheadline}</p>}
                </div>
                <div className="relative mx-auto max-w-3xl">
                    {/* Vertical line */}
                    <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-px" aria-hidden="true" />
                    <div className="space-y-12">
                        {events.map((event, i) => {
                            const isLeft = i % 2 === 0;
                            return (
                                <div key={i} className={cn('relative grid grid-cols-[32px_1fr] md:grid-cols-[1fr_32px_1fr] gap-4 md:gap-6 items-start')}>
                                    {/* Left content (desktop only) */}
                                    <div className={cn('hidden md:block', isLeft ? 'text-right' : '')}>
                                        {isLeft && (
                                            <div className="pr-4">
                                                {event.tag && <span className="inline-block mb-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{event.tag}</span>}
                                                <p className="text-xs font-medium text-muted-foreground mb-1">{event.date}</p>
                                                <h3 className="font-heading text-sm font-semibold text-foreground">{event.title}</h3>
                                                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                                            </div>
                                        )}
                                    </div>
                                    {/* Dot */}
                                    <div className="relative flex justify-center">
                                        <div className="h-3 w-3 rounded-full border-2 border-primary bg-background ring-4 ring-background" />
                                    </div>
                                    {/* Right content (or mobile) */}
                                    <div className={cn(!isLeft ? 'pl-0 md:pl-4' : 'md:hidden')}>
                                        {(!isLeft || true) && (
                                            <div className="md:hidden">
                                                {event.tag && <span className="inline-block mb-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{event.tag}</span>}
                                                <p className="text-xs font-medium text-muted-foreground mb-1">{event.date}</p>
                                                <h3 className="font-heading text-sm font-semibold text-foreground">{event.title}</h3>
                                                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                                            </div>
                                        )}
                                        {!isLeft && (
                                            <div className="hidden md:block pl-4">
                                                {event.tag && <span className="inline-block mb-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{event.tag}</span>}
                                                <p className="text-xs font-medium text-muted-foreground mb-1">{event.date}</p>
                                                <h3 className="font-heading text-sm font-semibold text-foreground">{event.title}</h3>
                                                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                                            </div>
                                        )}
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
