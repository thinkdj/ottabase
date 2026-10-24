'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { cn } from '@ottabase/ui/lib/utils';

const RadioGroup = React.forwardRef<
    React.ElementRef<typeof RadioGroupPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
    return (
        <RadioGroupPrimitive.Root
            data-slot="radio-group"
            className={cn('grid gap-2', className)}
            {...props}
            ref={ref}
        />
    );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

/*
 * Theming hooks (BrandEngine): data-slot stamps for theme CSS; focus-visible
 * styling comes from the GLOBAL --focus-ring-* rule in styles/ui.css.
 */
const RadioGroupItem = React.forwardRef<
    React.ElementRef<typeof RadioGroupPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
    return (
        <RadioGroupPrimitive.Item
            ref={ref}
            data-slot="radio-group-item"
            // Mirrors Checkbox: the field edge on the surface, the brand fill once chosen. shrink-0 keeps a
            // flex row from squeezing it into an oval; the dot is a CSS circle centred by the grid, crisp
            // at any zoom where an icon would sit off-centre and blur.
            className={cn(
                'grid size-4 shrink-0 place-items-center rounded-full border border-input bg-card shadow-xs transition duration-fast ease-theme hover:border-faint-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive data-[state=checked]:border-primary data-[state=checked]:bg-primary',
                className,
            )}
            {...props}
        >
            <RadioGroupPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="block size-1.5 rounded-full bg-primary-foreground"
            />
        </RadioGroupPrimitive.Item>
    );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
