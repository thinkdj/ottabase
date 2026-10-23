'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@ottabase/ui/lib/utils';
import { useBrandComponent } from '@ottabase/ui/brand-components';

/*
 * Design System v1 chips. `default` is the brand chip (a flag worth noticing,
 * used sparingly), `secondary` the quiet tag, `destructive` a soft red pill,
 * `outline` a neutral pill on the surface. A record's STATE is a StatusChip
 * (./status), which carries its tone from the one status map.
 *
 * Theming hooks (BrandEngine): data-slot="badge" + data-variant stamps let
 * theme CSS restyle any variant; focus-visible styling comes from the GLOBAL
 * --focus-ring-* rule in styles/ui.css (no per-component ring recipe).
 * `transition` (not transition-colors) so interaction tokens can animate.
 */
const badgeVariants = cva(
    'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-semibold leading-none transition [&_svg]:size-[13px] [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'border-accent-line bg-accent text-accent-foreground',
                secondary: 'rounded-sm border-border bg-muted font-medium text-subtle-foreground',
                destructive: 'border-destructive-line bg-destructive-soft text-destructive-text',
                outline: 'border-input bg-card font-medium text-subtle-foreground',
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
