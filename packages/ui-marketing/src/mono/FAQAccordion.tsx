'use client';

import { useState } from 'react';
import type { FAQAccordionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — FAQAccordion
 *
 * Full-width numbered accordion. Monospace question numbers, border-top per item,
 * +/− toggle indicator. Single-column, no decorative sidebar.
 */
export function MonoFAQAccordion({
    eyebrow,
    headline,
    subheadline,
    items,
    className,
}: FAQAccordionProps) {
    const [open, setOpen] = useState<number | null>(null);

    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-12 pb-12 border-b border-border">
                    {eyebrow && (
                        <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            — {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                        {headline}
                    </h2>
                    {subheadline && (
                        <p className="mt-3 text-base text-muted-foreground max-w-xl">{subheadline}</p>
                    )}
                </div>

                {/* Items */}
                <div className="divide-y divide-border">
                    {items.map((item, i) => (
                        <div key={i}>
                            <button
                                onClick={() => setOpen(open === i ? null : i)}
                                className="flex w-full items-start gap-6 py-6 text-left focus-visible:outline-none"
                                aria-expanded={open === i}
                            >
                                {/* Number */}
                                <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums pt-0.5 shrink-0 w-6">
                                    {String(i + 1).padStart(2, '0')}
                                </span>

                                {/* Question */}
                                <span className="flex-1 text-sm font-medium text-foreground">
                                    {item.question}
                                </span>

                                {/* Toggle */}
                                <span
                                    className={cn(
                                        'font-mono text-base leading-none text-muted-foreground shrink-0 transition-transform duration-200',
                                        open === i ? 'rotate-0' : 'rotate-0',
                                    )}
                                    aria-hidden="true"
                                >
                                    {open === i ? '−' : '+'}
                                </span>
                            </button>

                            {open === i && (
                                <div className="pl-12 pb-6 text-sm text-muted-foreground leading-relaxed">
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
