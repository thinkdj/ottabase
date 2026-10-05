'use client';

import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { useBrandComponent } from '@ottabase/ui-shadcn/brand-components';

/*
 * Theming hooks (BrandEngine): data-slot stamps on every part let theme CSS
 * reshape cards ([data-slot=card] { … }); `relative` positions the
 * [data-decor] span themes can enable for texture/ornament layers.
 */
const CARD_VARIANTS = {
    /** The house surface: a muted tint, no border, no shadow */
    default: 'bg-muted/40',
    /** A bordered card on the page background, for standalone or nested cases */
    outline: 'border border-border bg-card',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: keyof typeof CARD_VARIANTS;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'default', children, ...props }, ref) => {
        // Tier-2 escape hatch: a fork may register a wholly different card
        const Override = useBrandComponent('card');
        if (Override) {
            return (
                <Override ref={ref} className={className} {...props}>
                    {children}
                </Override>
            );
        }

        return (
            <div
                ref={ref}
                data-slot="card"
                data-variant={variant}
                className={cn('relative rounded-xl text-card-foreground', CARD_VARIANTS[variant], className)}
                {...props}
            >
                {children}
                {/* Effect carrier for themes (hidden by default via shadcn.css) */}
                <span aria-hidden="true" data-decor />
            </div>
        );
    },
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} data-slot="card-header" className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
    ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3
            ref={ref}
            data-slot="card-title"
            className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
            {...props}
        />
    ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p
            ref={ref}
            data-slot="card-description"
            className={cn('text-sm text-muted-foreground', className)}
            {...props}
        />
    ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} data-slot="card-content" className={cn('p-6 pt-0', className)} {...props} />
    ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} data-slot="card-footer" className={cn('flex items-center p-6 pt-0', className)} {...props} />
    ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
