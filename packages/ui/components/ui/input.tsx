'use client';

import * as React from 'react';

import { cn } from '@ottabase/ui/lib/utils';
import { useBrandComponent } from '@ottabase/ui/brand-components';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/*
 * Design System v1 field: 36px, 7px corners, the strong border, the surface
 * behind it. Hover darkens the edge; focus swaps the ring for a 3px halo
 * (the global [data-slot=input]:focus rule in styles/ui.css). Anything a person
 * pastes into wrangler gets `font-mono` from the caller.
 *
 * Theming hooks (BrandEngine): data-slot="input" for theme CSS.
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
                'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs transition duration-fast ease-theme file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-faint-foreground hover:border-faint-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint-foreground aria-[invalid=true]:border-destructive',
                className,
            )}
            ref={ref}
            {...props}
        />
    );
});
Input.displayName = 'Input';

export { Input };
