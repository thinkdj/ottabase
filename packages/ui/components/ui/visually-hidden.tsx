import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@ottabase/ui/lib/utils';

/*
 * Content for screen readers only: a label for an icon-only control, the
 * word behind a symbol, a live-region message. It stays in the accessibility
 * tree and out of the layout. `asChild` hides an element of your own instead
 * of wrapping it in a span.
 */
export interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
    asChild?: boolean;
}

const VisuallyHidden = React.forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
    ({ asChild, className, ...props }, ref) => {
        const Comp = asChild ? Slot : 'span';
        return <Comp ref={ref} data-slot="visually-hidden" className={cn('sr-only', className)} {...props} />;
    },
);
VisuallyHidden.displayName = 'VisuallyHidden';

export { VisuallyHidden };
