'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { useBrandComponent } from '@ottabase/ui-shadcn/brand-components';

/*
 * Design System v1 buttons. One primary per view (`default`); `outline` is the
 * everyday secondary; `ghost` for toolbars; `danger` is the outline-in-place
 * destructive action; `destructive` (solid red) lives only inside a confirm
 * and repeats the loss in its own label. 36px default, 32 dense, 44 touch.
 *
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
    'group/button relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold leading-none transition duration-fast ease-theme disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default:
                    'border border-primary bg-primary text-primary-foreground shadow-xs hover:border-primary-hover hover:bg-primary-hover active:bg-primary-active',
                destructive:
                    'border border-destructive bg-destructive text-destructive-foreground shadow-xs hover:brightness-[0.92]',
                outline: 'border border-input bg-card text-foreground shadow-xs hover:bg-muted active:bg-secondary',
                secondary: 'border border-transparent bg-secondary text-secondary-foreground hover:bg-muted',
                ghost: 'text-subtle-foreground hover:bg-muted hover:text-foreground',
                danger: 'border border-destructive-line bg-card text-destructive-text shadow-xs hover:bg-destructive-soft',
                link: 'font-medium text-accent-foreground underline-offset-[3px] hover:underline',
            },
            size: {
                default: 'h-9 px-4',
                sm: 'h-8 px-3',
                lg: 'h-11 px-5 text-base',
                icon: 'h-9 w-9',
                'icon-sm': 'h-8 w-8',
                'icon-lg': 'h-11 w-11',
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
    /** The one spinner: a button mid-request keeps its width and its label goes quiet. */
    loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
        // Tier-2 escape hatch: a fork may register a wholly different button
        const Override = useBrandComponent('button');
        if (Override) {
            return (
                <Override
                    ref={ref}
                    className={className}
                    variant={variant}
                    size={size}
                    asChild={asChild}
                    loading={loading}
                    disabled={disabled}
                    {...props}
                >
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
            <button
                {...stamps}
                className={cn(buttonVariants({ variant, size, className }), loading && 'text-transparent')}
                ref={ref}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                {...props}
            >
                {children}
                {loading ? (
                    <Loader2
                        aria-hidden="true"
                        data-slot="spinner"
                        className="absolute size-4 animate-spin text-muted-foreground group-data-[variant=default]/button:text-primary-foreground group-data-[variant=destructive]/button:text-destructive-foreground"
                    />
                ) : null}
                {/* Effect carrier for themes (hidden by default via shadcn.css) */}
                <span aria-hidden="true" data-decor />
            </button>
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
