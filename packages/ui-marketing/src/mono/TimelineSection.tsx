import type { TimelineSectionProps } from '../types';
import { cn } from '../lib/utils';

export function MonoTimelineSection({ eyebrow, headline, subheadline, events, className }: TimelineSectionProps) {
    return (
        <section className={cn('bg-background border-t border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className="mb-12">
                    {eyebrow && <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">— {eyebrow}</p>}
                    <h2 className="font-heading text-3xl font-semibold text-foreground">{headline}</h2>
                    {subheadline && <p className="mt-3 max-w-2xl text-muted-foreground">{subheadline}</p>}
                </div>
                <div className="divide-y divide-border">
                    {events.map((event, i) => (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-[120px_1fr_2fr] gap-4 sm:gap-6 py-8 items-start">
                            <div>
                                <span className="font-mono text-xs font-bold text-muted-foreground tabular-nums">{event.date}</span>
                                {event.tag && <span className="ml-2 sm:ml-0 sm:mt-1 sm:block font-mono text-[10px] uppercase tracking-widest text-primary">{event.tag}</span>}
                            </div>
                            <h3 className="font-heading text-sm font-semibold text-foreground pt-px">{event.title}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">{event.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
