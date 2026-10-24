import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@ottabase/ui/lib/utils';
import type { Tone } from './status-language';

/*
 * Design System v1 timeline (ob-tl): events in order, each with a marker on a
 * hairline rail, newest first by convention. A marker is a ringed dot, or a
 * soft tone disc with an icon; only an event that needs someone earns a tone.
 *
 * The list is a two-column grid and every item a subgrid row, so the marker
 * column takes the width of the widest marker: dots and icon discs mixed in
 * one timeline still share one straight rail.
 *
 * Theming hooks (BrandEngine): data-slot on every part, data-tone on toned
 * items (the tone map in styles/ui.css supplies --t-fg/--t-bg/--t-line/--t-solid).
 */

const Timeline = React.forwardRef<HTMLOListElement, React.OlHTMLAttributes<HTMLOListElement>>(
    ({ className, ...props }, ref) => (
        <ol
            ref={ref}
            data-slot="timeline"
            className={cn('grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-sm', className)}
            {...props}
        />
    ),
);
Timeline.displayName = 'Timeline';

export interface TimelineItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
    /** Colours the marker. Leave it off for routine events. */
    tone?: Tone;
    /** Swap the dot for a disc carrying this icon. */
    icon?: LucideIcon;
}

const TimelineItem = React.forwardRef<HTMLLIElement, TimelineItemProps>(
    ({ tone, icon: Icon, className, children, ...props }, ref) => (
        <li
            ref={ref}
            data-slot="timeline-item"
            data-tone={tone}
            className={cn('group/timeline-item col-span-2 grid grid-cols-subgrid', className)}
            {...props}
        >
            <span aria-hidden="true" className="flex flex-col items-center">
                {Icon ? (
                    <span
                        data-slot="timeline-marker"
                        className={cn(
                            // -mt-0.5 centres the 24px disc on the 20px first line, as the dot is
                            '-mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border',
                            tone
                                ? 'border-[color:var(--t-line)] bg-[color:var(--t-bg)] text-[color:var(--t-fg)]'
                                : 'border-border bg-muted text-muted-foreground',
                        )}
                    >
                        <Icon className="size-3.5 [stroke-width:2.25]" />
                    </span>
                ) : (
                    <span
                        data-slot="timeline-marker"
                        className={cn(
                            'mt-0.5 size-4 shrink-0 rounded-full border-2 bg-card',
                            tone ? 'border-[color:var(--t-solid)]' : 'border-input',
                        )}
                    />
                )}
                <span data-slot="timeline-rail" className="w-px flex-1 bg-border group-last/timeline-item:hidden" />
            </span>
            <div
                data-slot="timeline-content"
                className="flex min-w-0 flex-col gap-1 pb-4 group-last/timeline-item:pb-0"
            >
                {children}
            </div>
        </li>
    ),
);
TimelineItem.displayName = 'TimelineItem';

/** The first line of an event: its title and, at the end of the line, its time. */
const TimelineHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="timeline-header"
            className={cn('flex min-h-5 flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}
            {...props}
        />
    ),
);
TimelineHeader.displayName = 'TimelineHeader';

const TimelineTitle = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
        <span
            ref={ref}
            data-slot="timeline-title"
            className={cn('font-medium text-foreground', className)}
            {...props}
        />
    ),
);
TimelineTitle.displayName = 'TimelineTitle';

/** A `<time>`: pass `dateTime` so the moment stays machine-readable. */
const TimelineTime = React.forwardRef<HTMLTimeElement, React.TimeHTMLAttributes<HTMLElement>>(
    ({ className, ...props }, ref) => (
        <time
            ref={ref}
            data-slot="timeline-time"
            className={cn('text-xs tabular-nums text-muted-foreground', className)}
            {...props}
        />
    ),
);
TimelineTime.displayName = 'TimelineTime';

const TimelineDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="timeline-description"
            className={cn('text-subtle-foreground', className)}
            {...props}
        />
    ),
);
TimelineDescription.displayName = 'TimelineDescription';

export { Timeline, TimelineItem, TimelineHeader, TimelineTitle, TimelineTime, TimelineDescription };
