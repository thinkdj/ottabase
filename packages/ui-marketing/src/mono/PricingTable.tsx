'use client';

import { useState } from 'react';
import type { PricingTableProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — PricingTable
 *
 * Full-width comparison table: features as rows, plans as columns.
 * Monospaced pricing. Optional billing toggle. Stark, grid-based design.
 */
export function MonoPricingTable({
    eyebrow,
    headline,
    subheadline,
    plans,
    defaultBilling = 'monthly',
    className,
}: PricingTableProps) {
    const [billing, setBilling] = useState<'monthly' | 'annual'>(defaultBilling);
    const hasAnnual = plans.some((p) => p.price.annual);

    // Collect all unique feature labels in order
    const allFeatures = Array.from(
        new Map(plans.flatMap((p) => p.features.map((f) => [f.label, f])).map(([k, v]) => [k, v])).keys(),
    );

    return (
        <section className={cn('bg-background border-t border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-12">
                    {eyebrow && (
                        <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            — {eyebrow}
                        </p>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div>
                            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                                {headline}
                            </h2>
                            {subheadline && (
                                <p className="mt-2 text-base text-muted-foreground">{subheadline}</p>
                            )}
                        </div>

                        {hasAnnual && (
                            <div className="flex items-center gap-0 border border-border shrink-0">
                                {(['monthly', 'annual'] as const).map((period) => (
                                    <button
                                        key={period}
                                        onClick={() => setBilling(period)}
                                        className={cn(
                                            'px-4 py-2 text-xs font-mono font-medium tracking-wider uppercase transition-colors',
                                            billing === period
                                                ? 'bg-foreground text-background'
                                                : 'text-muted-foreground hover:text-foreground bg-background',
                                        )}
                                    >
                                        {period}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="py-4 pr-8 text-left text-xs font-mono uppercase tracking-widest text-muted-foreground w-1/4">
                                    Feature
                                </th>
                                {plans.map((plan) => (
                                    <th key={plan.name} className="py-4 px-4 text-left align-top">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-semibold text-foreground">
                                                    {plan.name}
                                                </span>
                                                {plan.badge && (
                                                    <span className="font-mono text-xs bg-foreground text-background px-1.5 py-0.5">
                                                        {plan.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-mono text-2xl font-semibold text-foreground tabular-nums">
                                                {billing === 'annual' && plan.price.annual
                                                    ? plan.price.annual
                                                    : plan.price.monthly}
                                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                                    {plan.price.suffix ?? '/mo'}
                                                </span>
                                            </p>
                                            {plan.description && (
                                                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-border">
                            {allFeatures.map((featureLabel) => (
                                <tr key={featureLabel} className="group">
                                    <td className="py-3.5 pr-8 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                        {featureLabel}
                                    </td>
                                    {plans.map((plan) => {
                                        const f = plan.features.find((x) => x.label === featureLabel);
                                        return (
                                            <td key={plan.name} className="py-3.5 px-4 text-sm">
                                                {!f || f.included === false ? (
                                                    <span className="text-border">—</span>
                                                ) : typeof f.included === 'string' ? (
                                                    <span className="font-mono text-xs font-medium text-foreground">
                                                        {f.included}
                                                    </span>
                                                ) : (
                                                    <svg className="h-4 w-4 text-foreground" viewBox="0 0 16 16" fill="none">
                                                        <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            {/* CTA row */}
                            <tr className="border-t-2 border-border">
                                <td className="pt-6 pr-8" />
                                {plans.map((plan) => (
                                    <td key={plan.name} className="pt-6 px-4">
                                        <a
                                            href={plan.cta.href}
                                            onClick={plan.cta.onClick}
                                            className={cn(
                                                'inline-flex h-9 items-center justify-center px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                plan.highlighted
                                                    ? 'bg-foreground text-background hover:opacity-80'
                                                    : 'border border-border text-foreground hover:bg-muted',
                                            )}
                                        >
                                            {plan.cta.label}
                                        </a>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
