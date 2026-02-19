import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';

const emptyVariants = cva(
    'flex flex-col items-center justify-center rounded-lg border border-dashed px-8 py-12 text-center animate-in fade-in-50',
    {
        variants: {
            variant: {
                default: 'border-muted-foreground/25 bg-muted/50',
                dashed: 'border-dashed border-muted-foreground/25',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export interface EmptyProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof emptyVariants> {}

const Empty = React.forwardRef<HTMLDivElement, EmptyProps>(({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(emptyVariants({ variant }), className)} {...props} />
));
Empty.displayName = 'Empty';

const EmptyIcon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn('mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted', className)}
            {...props}
        />
    ),
);
EmptyIcon.displayName = 'EmptyIcon';

const EmptyTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn('mt-4 text-lg font-semibold', className)} {...props} />
    ),
);
EmptyTitle.displayName = 'EmptyTitle';

const EmptyDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('mb-4 mt-2 text-sm text-muted-foreground', className)} {...props} />
    ),
);
EmptyDescription.displayName = 'EmptyDescription';

const EmptyContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => <div ref={ref} className={cn('mt-4', className)} {...props} />,
);
EmptyContent.displayName = 'EmptyContent';

export { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle };
