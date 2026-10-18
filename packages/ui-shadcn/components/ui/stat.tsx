'use client';

import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import type { Tone } from './status-language';

/*
 * The stat tile of Design System v1: label, value, context. Numbers before
 * narrative — "3 of 5" reads before the bar, the list or the record. A tile
 * with an onClick is a button that filters the list below it; `pressed` marks
 * the active filter.
 */
export interface StatProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
    label: React.ReactNode;
    value: React.ReactNode;
    /** The denominator or unit after the number: " of 5", " runs". */
    unit?: React.ReactNode;
    /** One line of context under the number. */
    foot?: React.ReactNode;
    /** Only an exception earns a tone; a healthy count stays neutral. */
    tone?: Tone;
    pressed?: boolean;
}

export const Stat = React.forwardRef<HTMLElement, StatProps>(
    ({ label, value, unit, foot, tone, pressed, className, onClick, ...props }, ref) => {
        const Comp = onClick ? 'button' : 'div';
        return (
            <Comp
                ref={ref as React.Ref<HTMLButtonElement & HTMLDivElement>}
                data-slot="stat"
                data-tone={tone}
                type={onClick ? 'button' : undefined}
                aria-pressed={onClick ? !!pressed : undefined}
                onClick={onClick}
                className={cn(
                    'flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-4 text-left text-card-foreground shadow-xs',
                    onClick && 'transition duration-fast ease-theme hover:border-input',
                    pressed && 'border-primary shadow-[inset_0_0_0_1px_hsl(var(--primary))]',
                    className,
                )}
                {...props}
            >
                <span
                    data-slot="stat-label"
                    className="flex items-center gap-1.5 text-sm font-medium text-subtle-foreground"
                >
                    {tone ? (
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[color:var(--t-solid)]" />
                    ) : null}
                    {label}
                </span>
                <span
                    data-slot="stat-value"
                    className="text-3xl font-semibold leading-none tracking-[-0.015em] tabular-nums"
                >
                    {value}
                    {unit ? <small className="ml-0.5 text-base font-medium text-muted-foreground">{unit}</small> : null}
                </span>
                {foot ? (
                    <span data-slot="stat-foot" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {foot}
                    </span>
                ) : null}
            </Comp>
        );
    },
);
Stat.displayName = 'Stat';
