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
        <svg className="h-4 w-4 text-border shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
    );
}

/**
 * Atlas — PricingTable
 *
 * Card-per-plan layout with monthly/annual billing toggle.
 * Highlighted plan uses border-primary. No gradients.
 */
export function AtlasPricingTable({
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
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-10 text-center">
                    {eyebrow && (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                            {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                        {headline}
                    </h2>
                    {subheadline && (
                        <p className="mt-3 text-base text-muted-foreground max-w-xl mx-auto">
                            {subheadline}
                        </p>
                    )}

                    {/* Billing toggle */}
                    {hasAnnual && (
                        <div className="mt-6 inline-flex items-center border border-border rounded-md p-0.5 gap-0.5 bg-muted">
                            {(['monthly', 'annual'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setBilling(period)}
                                    className={cn(
                                        'px-4 py-1.5 text-sm font-medium rounded-sm transition-colors',
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

                {/* Plans */}
                <div className={cn(
                    'grid grid-cols-1 gap-4',
                    plans.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' :
                    plans.length === 3 ? 'md:grid-cols-3' :
                    'md:grid-cols-2 lg:grid-cols-4',
                )}>
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={cn(
                                'relative flex flex-col rounded-lg border bg-card p-6',
                                plan.highlighted
                                    ? 'border-primary ring-1 ring-primary'
                                    : 'border-border',
                            )}
                        >
                            {/* Badge */}
                            {plan.badge && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            {/* Plan name + desc */}
                            <div className="mb-4">
                                <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                                {plan.description && (
                                    <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                                )}
                            </div>

                            {/* Price */}
                            <div className="mb-6">
                                <span className="font-heading text-4xl font-semibold text-foreground tabular-nums">
                                    {billing === 'annual' && plan.price.annual
                                        ? plan.price.annual
                                        : plan.price.monthly}
                                </span>
                                <span className="ml-1 text-sm text-muted-foreground">
                                    {plan.price.suffix ?? '/month'}
                                </span>
                            </div>

                            {/* CTA */}
                            <a
                                href={plan.cta.href}
                                onClick={plan.cta.onClick}
                                className={cn(
                                    'mb-6 flex h-9 items-center justify-center rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    plan.highlighted
                                        ? 'bg-primary text-primary-foreground border-primary hover:opacity-90'
                                        : 'bg-background text-foreground border-border hover:bg-muted',
                                )}
                            >
                                {plan.cta.label}
                            </a>

                            {/* Features */}
                            <ul className="flex flex-col gap-2.5">
                                {plan.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2.5">
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
