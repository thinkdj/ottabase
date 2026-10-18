'use client';

import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { useBrandComponent } from '@ottabase/ui-shadcn/brand-components';

/*
 * Design System v1 card: the surface, a hairline, 10px corners, the smallest
 * shadow. Head (title 14/600, one-line sub), body, and a foot on the subtle
 * fill for the line that qualifies the card ("Free tier: five kept").
 *
 * Theming hooks (BrandEngine): data-slot stamps on every part let theme CSS
 * reshape cards ([data-slot=card] { … }); `relative` positions the
 * [data-decor] span themes can enable for texture/ornament layers.
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
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
                className={cn(
                    'relative flex flex-col rounded-lg border bg-card text-card-foreground shadow-xs',
                    className,
                )}
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
        <div
            ref={ref}
            data-slot="card-header"
            className={cn('flex flex-col gap-1 px-5 pb-3 pt-4', className)}
            {...props}
        />
    ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3
            ref={ref}
            data-slot="card-title"
            className={cn('text-sm font-semibold leading-snug tracking-[-0.01em]', className)}
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
        <div ref={ref} data-slot="card-content" className={cn('px-5 pb-5 pt-0', className)} {...props} />
    ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="card-footer"
            className={cn(
                'mt-auto flex items-center gap-3 rounded-b-[inherit] border-t bg-muted px-5 py-3 text-sm text-subtle-foreground',
                className,
            )}
            {...props}
        />
    ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
