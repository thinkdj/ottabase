'use client';

import { useState } from 'react';
import type { PricingTableProps } from '../types';
import { cn } from '../lib/utils';

function CheckIcon() {
    return (
        <svg className="h-4 w-4 text-primary shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function DashIcon() {
    return (
        <svg className="h-4 w-4 text-muted-foreground/40 shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
    );
}

/**
 * SaaS — PricingTable
 *
 * Rounded-2xl cards with subtle shadows. Highlighted plan gets a
 * primary ring + shadow glow. Pill-shaped billing toggle and CTAs.
 */
export function SaaSPricingTable({
    eyebrow,
    headline,
    subheadline,
    plans,
    defaultBilling = 'monthly',
    className,
}: PricingTableProps) {
    const [billing, setBilling] = useState<'monthly' | 'annual'>(defaultBilling);
    const hasAnnual = plans.some((p) => p.price.annual);

    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className="mb-12 text-center">
                    {eyebrow && (
                        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                            {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                        {headline}
                    </h2>
                    {subheadline && (
                        <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
                            {subheadline}
                        </p>
                    )}

                    {hasAnnual && (
                        <div className="mt-8 inline-flex items-center rounded-full bg-muted p-1 gap-1">
                            {(['monthly', 'annual'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setBilling(period)}
                                    className={cn(
                                        'px-5 py-2 text-sm font-medium rounded-full transition-all',
                                        billing === period
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {period === 'monthly' ? 'Monthly' : 'Annual'}
                                    {period === 'annual' && (
                                        <span className="ml-1.5 text-xs text-primary font-semibold">Save 20%</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className={cn(
                    'grid grid-cols-1 gap-6',
                    plans.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' :
                    plans.length === 3 ? 'md:grid-cols-3' :
                    'md:grid-cols-2 lg:grid-cols-4',
                )}>
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={cn(
                                'relative flex flex-col rounded-2xl bg-card p-7',
                                plan.highlighted
                                    ? 'ring-2 ring-primary shadow-lg shadow-primary/10'
                                    : 'shadow-sm',
                            )}
                        >
                            {plan.badge && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            <div className="mb-5">
                                <p className="text-base font-semibold text-foreground">{plan.name}</p>
                                {plan.description && (
                                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                                )}
                            </div>

                            <div className="mb-7">
                                <span className="font-heading text-4xl font-bold text-foreground tabular-nums">
                                    {billing === 'annual' && plan.price.annual
                                        ? plan.price.annual
                                        : plan.price.monthly}
                                </span>
                                <span className="ml-1 text-sm text-muted-foreground">
                                    {plan.price.suffix ?? '/month'}
                                </span>
                            </div>

                            <a
                                href={plan.cta.href}
                                onClick={plan.cta.onClick}
                                className={cn(
                                    'mb-7 flex h-10 items-center justify-center rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    plan.highlighted
                                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg'
                                        : 'bg-muted text-foreground hover:bg-muted/80',
                                )}
                            >
                                {plan.cta.label}
                            </a>

                            <ul className="flex flex-col gap-3">
                                {plan.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        {f.included === false ? <DashIcon /> : <CheckIcon />}
                                        <span className={cn(
                                            'text-sm',
                                            f.included === false ? 'text-muted-foreground' : 'text-foreground',
                                        )}>
                                            {typeof f.included === 'string' ? (
                                                <><strong>{f.included}</strong> {f.label}</>
                                            ) : f.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
