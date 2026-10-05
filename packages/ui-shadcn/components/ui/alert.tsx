import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@ottabase/ui-shadcn/lib/utils';

/*
 * The one notice box: a tinted panel in the tone's colour. Children can be
 * plain text, or AlertTitle + AlertDescription. An icon placed first sits in
 * the left gutter and the box pads itself to make room.
 */
const alertVariants = cva(
    'relative w-full rounded-lg border p-3 text-sm has-[>svg]:pl-10 [&>svg]:absolute [&>svg]:left-3 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg]:text-current',
    {
        variants: {
            variant: {
                default: 'border-border bg-muted/40 text-foreground',
                destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
                warning: 'border-warning/40 bg-warning/10 text-warning',
                success: 'border-success/40 bg-success/10 text-success',
                info: 'border-info/40 bg-info/10 text-info',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>;

function Alert({
    className,
    variant,
    role,
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
    const tone: AlertVariant = variant ?? 'default';
    return (
        <div
            data-slot="alert"
            data-variant={tone}
            // Problems interrupt; good news and context only announce politely
            role={role ?? (tone === 'destructive' || tone === 'warning' ? 'alert' : 'status')}
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return <div data-slot="alert-title" className={cn('mb-0.5 font-medium leading-snug', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return <div data-slot="alert-description" className={cn('[&_p]:leading-relaxed', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
