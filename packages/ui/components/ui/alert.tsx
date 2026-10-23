import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@ottabase/ui/lib/utils';
import type { Tone } from './status-language';

/*
 * Design System v1 alert: the tone's soft fill, its hairline, a 3px solid bar
 * on the left, the icon and the title in the tone's text colour, the body in
 * the page's. A grace license is amber, a failed run red, a running migration
 * blue, an activated license green. Nothing else earns a banner.
 */
const TONE_BY_VARIANT: Record<string, Tone> = {
    default: 'blue',
    info: 'blue',
    success: 'green',
    warning: 'amber',
    destructive: 'red',
    smoke: 'smoke',
};

const alertVariants = cva(
    'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-md border border-[color:var(--t-line)] border-l-[3px] border-l-[color:var(--t-solid)] bg-[color:var(--t-bg)] px-4 py-3 text-sm text-foreground has-[>svg]:grid-cols-[1.125rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-[18px] [&>svg]:translate-y-0.5 [&>svg]:text-[color:var(--t-fg)]',
    {
        variants: {
            variant: {
                default: '',
                info: '',
                success: '',
                warning: '',
                destructive: '',
                smoke: '',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
    const resolved = variant ?? 'default';
    return (
        <div
            data-slot="alert"
            data-variant={resolved}
            data-tone={TONE_BY_VARIANT[resolved]}
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-title"
            className={cn('col-start-2 min-h-4 font-semibold tracking-[-0.01em] text-[color:var(--t-fg)]', className)}
            {...props}
        />
    );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-description"
            className={cn(
                'col-start-2 grid justify-items-start gap-1 text-sm text-subtle-foreground [&_p]:leading-relaxed',
                className,
            )}
            {...props}
        />
    );
}

export { Alert, AlertTitle, AlertDescription };
