import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    /** A red asterisk after the label; the field itself still declares `required`. */
    required?: boolean;
    /** What "optional" means here, instead of the word itself: "https only", "the app's FLEET_TOKEN". */
    hint?: React.ReactNode;
}

/* Labels sit above fields, semibold. Required gets a red asterisk; optional says what it means. */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
    ({ className, required, hint, children, ...props }, ref) => (
        <label
            ref={ref}
            data-slot="label"
            className={cn(
                'inline-flex items-baseline gap-1.5 text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                className,
            )}
            {...props}
        >
            {children}
            {required ? (
                <span aria-hidden="true" className="font-bold text-destructive-text">
                    *
                </span>
            ) : null}
            {hint ? <span className="text-xs font-normal text-faint-foreground">{hint}</span> : null}
        </label>
    ),
);
Label.displayName = 'Label';

export { Label };
