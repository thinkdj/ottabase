import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { useBrandComponent } from '@ottabase/ui-shadcn/brand-components';

/*
 * Theming hooks (BrandEngine):
 *  - data-slot="button" + data-variant/data-size stamps let theme CSS restyle
 *    any variant ([data-slot=button][data-variant=outline]:hover { … }).
 *  - `transition` (not transition-colors) so --hover-transform/--press-*
 *    interaction tokens animate. `relative` positions the [data-decor] span
 *    themes can enable for shine/ornament effects.
 *  - Focus-visible styling comes from the GLOBAL --focus-ring-* rule in
 *    shadcn.css (no per-component ring recipe).
 */
const buttonVariants = cva(
    'relative inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition duration-fast ease-theme disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
                destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
                outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                ghost: 'hover:bg-accent hover:text-accent-foreground',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 rounded-md px-3',
                lg: 'h-11 rounded-md px-8',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, children, ...props }, ref) => {
        // Tier-2 escape hatch: a fork may register a wholly different button
        const Override = useBrandComponent('button');
        if (Override) {
            return (
                <Override ref={ref} className={className} variant={variant} size={size} asChild={asChild} {...props}>
                    {children}
                </Override>
            );
        }

        const stamps = {
            'data-slot': 'button',
            'data-variant': variant ?? 'default',
            'data-size': size ?? 'default',
        } as const;

        // Slot requires EXACTLY one child — no decor carrier on asChild
        // (even a falsy conditional child breaks React.Children.only).
        if (asChild) {
            return (
                <Slot {...stamps} className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
                    {children}
                </Slot>
            );
        }

        return (
            <button {...stamps} className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
                {children}
                {/* Effect carrier for themes (hidden by default via shadcn.css) */}
                <span aria-hidden="true" data-decor />
            </button>
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
