'use client';

import * as React from 'react';
import { Crown, type LucideIcon } from 'lucide-react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { statusOf, type StatusDomain, type StatusValue, type Tone } from './status-language';

/*
 * The small record-level pieces of Design System v1. Each one stamps a
 * data-slot (theme CSS hook) and, where it carries state, a data-tone that
 * the tone map in shadcn.css turns into --t-fg / --t-bg / --t-line / --t-solid.
 *
 *   StatusChip   a record's state: soft pill, leading dot (or icon), word
 *   Tag          quiet metadata: a group, a package key, a version
 *   EnvName      an exact variable name, mono, with the `$` saying "a name"
 *   CountBadge   a count beside a tab or nav item
 *   PremiumMark  a crown and a word, never a colour of its own
 *   LiveDot      a realtime connection or a beacon answering
 */

const TONE_SURFACE = 'border-[color:var(--t-line)] bg-[color:var(--t-bg)] text-[color:var(--t-fg)]';

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
    tone?: Tone;
    /** Render this icon in place of the dot (mobile, tight cells). */
    icon?: LucideIcon;
    size?: 'default' | 'lg';
}

export const StatusChip = React.forwardRef<HTMLSpanElement, StatusChipProps>(
    ({ tone = 'neutral', icon: Icon, size = 'default', className, children, ...props }, ref) => (
        <span
            ref={ref}
            data-slot="status-chip"
            data-tone={tone}
            data-size={size}
            className={cn(
                'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-semibold leading-none',
                TONE_SURFACE,
                size === 'lg' && 'h-[26px] px-2.5 text-sm',
                className,
            )}
            {...props}
        >
            {Icon ? (
                <Icon aria-hidden="true" className="size-[13px] shrink-0 [stroke-width:2]" />
            ) : (
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[color:var(--t-solid)]" />
            )}
            {children}
        </span>
    ),
);
StatusChip.displayName = 'StatusChip';

export interface StatusProps<D extends StatusDomain> extends Omit<StatusChipProps, 'tone' | 'icon' | 'children'> {
    /** Which enum the value belongs to: license · health · cron · fleet · job · billing. */
    domain: D;
    value: StatusValue<D> | string;
    /** Show the state's icon instead of the dot. */
    withIcon?: boolean;
    /** Override the label (e.g. "2 failing" for a health summary). */
    label?: React.ReactNode;
}

/** A StatusChip whose tone, label and icon come from the one status map. */
export function Status<D extends StatusDomain>({ domain, value, withIcon, label, ...props }: StatusProps<D>) {
    const entry = statusOf(domain, value);
    return (
        <StatusChip tone={entry.tone} icon={withIcon ? entry.icon : undefined} {...props}>
            {label ?? entry.label}
        </StatusChip>
    );
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Keys, versions and ids are mono. */
    mono?: boolean;
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(({ mono, className, ...props }, ref) => (
    <span
        ref={ref}
        data-slot="tag"
        className={cn(
            'inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-sm border border-border bg-muted px-1.5 text-xs font-medium text-subtle-foreground [&_svg]:size-[13px] [&_svg]:text-muted-foreground',
            mono && 'font-mono',
            className,
        )}
        {...props}
    />
));
Tag.displayName = 'Tag';

export const EnvName = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ className, ...props }, ref) => (
        <code
            ref={ref}
            data-slot="env"
            className={cn(
                "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-sm border border-input bg-card px-[7px] font-mono text-[11.5px] font-medium text-foreground before:text-faint-foreground before:content-['$']",
                className,
            )}
            {...props}
        />
    ),
);
EnvName.displayName = 'EnvName';

export interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** The brand fill: a count that needs someone (e.g. "Needs attention 2"). */
    brand?: boolean;
}

export const CountBadge = React.forwardRef<HTMLSpanElement, CountBadgeProps>(({ brand, className, ...props }, ref) => (
    <span
        ref={ref}
        data-slot="count"
        data-variant={brand ? 'brand' : 'default'}
        className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums leading-none',
            brand ? 'bg-primary text-primary-foreground' : 'bg-secondary text-subtle-foreground',
            className,
        )}
        {...props}
    />
));
CountBadge.displayName = 'CountBadge';

export interface PremiumMarkProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Just the crown (nav entries, table cells); the word stays for screen readers. */
    iconOnly?: boolean;
}

export const PremiumMark = React.forwardRef<HTMLSpanElement, PremiumMarkProps>(
    ({ iconOnly, className, children, ...props }, ref) => (
        <span
            ref={ref}
            data-slot="premium"
            title="Premium Package"
            className={cn(
                'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground',
                className,
            )}
            {...props}
        >
            <Crown aria-hidden="true" className="size-3 shrink-0 [stroke-width:2.25]" />
            <span className={iconOnly ? 'sr-only' : undefined}>{children ?? 'Premium'}</span>
        </span>
    ),
);
PremiumMark.displayName = 'PremiumMark';

export interface LiveDotProps extends React.HTMLAttributes<HTMLSpanElement> {
    tone?: Extract<Tone, 'green' | 'amber' | 'red' | 'smoke'>;
}

export const LiveDot = React.forwardRef<HTMLSpanElement, LiveDotProps>(
    ({ tone = 'green', className, ...props }, ref) => (
        <span
            ref={ref}
            data-slot="live"
            data-tone={tone}
            className={cn(
                'inline-block size-2 shrink-0 rounded-full bg-[color:var(--t-solid)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--t-solid)_22%,transparent)]',
                className,
            )}
            {...props}
        />
    ),
);
LiveDot.displayName = 'LiveDot';

export type { Tone };
