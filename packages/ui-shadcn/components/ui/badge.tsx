import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { useBrandComponent } from '../../providers/brand-components';

/*
 * Theming hooks (BrandEngine): data-slot="badge" + data-variant stamps let
 * theme CSS restyle any variant; focus-visible styling comes from the GLOBAL
 * --focus-ring-* rule in shadcn.css (no per-component ring recipe).
 * `transition` (not transition-colors) so interaction tokens can animate.
 */
const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-primary text-primary-foreground shadow',
                secondary: 'border-transparent bg-secondary text-secondary-foreground',
                destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
                outline: 'text-foreground',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => {
    // Tier-2 escape hatch: a fork may register a wholly different badge
    const Override = useBrandComponent('badge');
    if (Override) {
        return <Override ref={ref} className={className} variant={variant} {...props} />;
    }

    return (
        <div
            ref={ref}
            data-slot="badge"
            data-variant={variant ?? 'default'}
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
});
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
