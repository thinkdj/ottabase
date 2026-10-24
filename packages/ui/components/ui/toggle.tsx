'use client';

import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@ottabase/ui/lib/utils';

/*
 * Design System v1 toggles.
 *   default  a toggle on its own (a toolbar's bold or a "show archived"): quiet until hovered,
 *            the soft brand fill when pressed, so it reads as a control on any surface
 *   outline  the same, with the field edge
 *   segment  one segment of a segmented control: the pressed one lifts onto the surface. It needs
 *            the track ToggleGroup draws behind it, and ToggleGroup gives its items this look.
 */
const toggleVariants = cva(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium text-subtle-foreground transition duration-fast ease-theme hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default:
                    'rounded-md bg-transparent hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
                outline:
                    'rounded-md border border-input bg-card shadow-xs hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:shadow-none',
                segment:
                    'rounded-sm bg-transparent data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-xs',
            },
            // Segment heights: the track adds its 3px padding and border around them
            size: {
                default: 'h-7 px-3',
                sm: 'h-6 px-2 text-xs',
                lg: 'h-8 px-4',
            },
        },
        // A toggle on its own stands as tall as a whole segmented control (and a field) of its size
        compoundVariants: [
            { variant: ['default', 'outline'], size: 'default', className: 'h-9' },
            { variant: ['default', 'outline'], size: 'sm', className: 'h-8' },
            { variant: ['default', 'outline'], size: 'lg', className: 'h-10' },
        ],
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
