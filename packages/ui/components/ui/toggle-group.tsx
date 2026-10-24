'use client';

import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { type VariantProps } from 'class-variance-authority';

import { cn } from '@ottabase/ui/lib/utils';
import { toggleVariants } from './toggle';

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
    size: 'default',
    variant: 'default',
});

const ToggleGroup = React.forwardRef<
    React.ElementRef<typeof ToggleGroupPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
    <ToggleGroupPrimitive.Root
        ref={ref}
        data-slot="toggle-group"
        data-variant={variant ?? 'default'}
        data-size={size ?? 'default'}
        className={cn(
            // The segmented control track: the subtle fill with a hairline; the pressed segment lifts onto the surface.
            variant === 'outline'
                ? 'inline-flex items-center gap-1'
                : 'inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-[3px]',
            className,
        )}
        {...props}
    >
        <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
));

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
    React.ElementRef<typeof ToggleGroupPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext);
    // A default group is a segmented control: its items are segments on the track it draws
    const chosen = context.variant || variant;
    const itemVariant = !chosen || chosen === 'default' ? 'segment' : chosen;

    return (
        <ToggleGroupPrimitive.Item
            ref={ref}
            data-slot="toggle-group-item"
            data-variant={itemVariant}
            data-size={(context.size || size) ?? 'default'}
            className={cn(
                toggleVariants({
                    variant: itemVariant,
                    size: context.size || size,
                }),
                className,
            )}
            {...props}
        >
            {children}
        </ToggleGroupPrimitive.Item>
    );
});

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
