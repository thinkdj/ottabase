import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import type { Tone } from './status-language';

/*
 * Design System v1 empty state: five kinds, one shape. First run (brand tone,
 * the primary action is the whole point), all clear (green, no action), error
 * (red, say what is safe and offer retry), locked (smoke, what unlocks it),
 * no match (neutral, echo the query). Titles are plain sentences; the second
 * line names the way out. `dashed` (default) stands on its own; `plain` sits
 * inside a card that already has edges.
 */
const emptyVariants = cva(
    'flex flex-col items-center justify-center gap-2 px-5 py-8 text-center text-subtle-foreground',
    {
        variants: {
            variant: {
                dashed: 'rounded-lg border border-dashed border-input bg-muted/60',
                default: 'rounded-lg border border-dashed border-input bg-muted/60',
                plain: '',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export interface EmptyProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof emptyVariants> {
    tone?: Tone;
}

const Empty = React.forwardRef<HTMLDivElement, EmptyProps>(({ className, variant, tone, ...props }, ref) => (
    <div
        ref={ref}
        data-slot="empty"
        data-variant={variant ?? 'default'}
        data-tone={tone}
        className={cn(emptyVariants({ variant }), className)}
        {...props}
    />
));
Empty.displayName = 'Empty';

const EmptyIcon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="empty-icon"
            className={cn(
                'mb-1 flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground [[data-tone]_&]:bg-[color:var(--t-bg)] [[data-tone]_&]:text-[color:var(--t-fg)] [&_svg]:size-6',
                className,
            )}
            {...props}
        />
    ),
);
EmptyIcon.displayName = 'EmptyIcon';

const EmptyTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3
            ref={ref}
            data-slot="empty-title"
            className={cn('text-sm font-semibold text-foreground', className)}
            {...props}
        />
    ),
);
EmptyTitle.displayName = 'EmptyTitle';

const EmptyDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p
            ref={ref}
            data-slot="empty-description"
            className={cn('max-w-[38ch] text-sm text-subtle-foreground', className)}
            {...props}
        />
    ),
);
EmptyDescription.displayName = 'EmptyDescription';

const EmptyContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="empty-content"
            className={cn('mt-2 flex flex-wrap items-center justify-center gap-2', className)}
            {...props}
        />
    ),
);
EmptyContent.displayName = 'EmptyContent';

export { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle };
