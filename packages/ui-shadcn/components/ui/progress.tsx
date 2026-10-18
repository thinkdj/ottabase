'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@ottabase/ui-shadcn/lib/utils';

/* A progress bar is work with a real percentage behind it; a Meter is a limit with a number in front. Neither is decorative. */
const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        data-slot="progress"
        className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)}
        {...props}
    >
        <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className="h-full w-full flex-1 rounded-full bg-primary transition-transform duration-slow ease-theme"
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
