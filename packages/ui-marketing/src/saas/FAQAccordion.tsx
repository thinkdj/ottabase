'use client';

import { useState } from 'react';
import type { FAQAccordionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — FAQAccordion
 *
 * Centered layout with soft shadow accordion items. Each item is a
 * rounded-2xl card. Clean expand/collapse with plus/minus icon.
 */
export function SaaSFAQAccordion({
    eyebrow,
    headline,
    subheadline,
    items,
    className,
}: FAQAccordionProps) {
    const [open, setOpen] = useState<number | null>(null);

    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
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
                        <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                            {subheadline}
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    {items.map((item, i) => (
                        <div
                            key={i}
                            className={cn(
                                'rounded-2xl bg-card shadow-sm transition-shadow',
                                open === i && 'shadow-md',
                            )}
                        >
                            <button
                                onClick={() => setOpen(open === i ? null : i)}
                                className="flex w-full items-center justify-between gap-4 p-6 text-left focus-visible:outline-none"
                                aria-expanded={open === i}
                            >
                                <span className="text-sm font-medium text-foreground">{item.question}</span>
                                <div className={cn(
                                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors',
                                    open === i && 'bg-primary/10 text-primary',
                                )}>
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                                        {open === i ? (
                                            <path d="M2 7h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                                        ) : (
                                            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                                        )}
                                    </svg>
                                </div>
                            </button>

                            {open === i && (
                                <div className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed">
                                    {item.answer}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
