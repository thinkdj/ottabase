'use client';

import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { useBrandComponent } from '@ottabase/ui-shadcn/brand-components';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/*
 * Theming hooks (BrandEngine): data-slot="input" for theme CSS; focus-visible
 * styling comes from the GLOBAL --focus-ring-* rule in shadcn.css.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
    // Tier-2 escape hatch: a fork may register a wholly different input
    const Override = useBrandComponent('input');
    if (Override) {
        return <Override ref={ref} className={className} type={type} {...props} />;
    }

    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition duration-fast ease-theme file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            ref={ref}
            {...props}
        />
    );
});
Input.displayName = 'Input';

export { Input };
