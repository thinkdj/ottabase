'use client';

import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@ottabase/ui-shadcn/lib/utils';

/* A segment of the Design System v1 segmented control: the pressed one lifts onto the surface. */
const toggleVariants = cva(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-sm font-medium text-subtle-foreground transition duration-fast ease-theme hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-xs [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'bg-transparent',
                outline:
                    'rounded-md border border-input bg-card shadow-xs hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:shadow-none',
            },
            size: {
                default: 'h-7 px-3',
                sm: 'h-6 px-2 text-xs',
                lg: 'h-8 px-4',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

const Toggle = React.forwardRef<
    React.ElementRef<typeof TogglePrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
    <TogglePrimitive.Root
        ref={ref}
        data-slot="toggle"
        data-variant={variant ?? 'default'}
        data-size={size ?? 'default'}
        className={cn(toggleVariants({ variant, size, className }))}
        {...props}
    />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
