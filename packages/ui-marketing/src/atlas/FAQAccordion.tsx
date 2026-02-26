'use client';

import { useState } from 'react';
import type { FAQAccordionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Atlas — FAQAccordion
 *
 * Two-column layout: header left, accordion items right.
 * Border separator between items; chevron toggles on open state.
 */
export function AtlasFAQAccordion({
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
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr] gap-12 md:gap-16">
                    {/* Left: header */}
                    <div className="md:sticky md:top-8 self-start">
                        {eyebrow && (
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                                {eyebrow}
                            </p>
                        )}
                        <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                            {headline}
                        </h2>
                        {subheadline && (
                            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                                {subheadline}
                            </p>
                        )}
                    </div>

                    {/* Right: accordion */}
                    <div className="divide-y divide-border border-t border-border">
                        {items.map((item, i) => (
                            <div key={i}>
                                <button
                                    onClick={() => setOpen(open === i ? null : i)}
                                    className="flex w-full items-start justify-between gap-4 py-5 text-left focus-visible:outline-none"
                                    aria-expanded={open === i}
                                >
                                    <span className="text-sm font-medium text-foreground">
                                        {item.question}
                                    </span>
                                    <svg
                                        className={cn(
                                            'h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform duration-200',
                                            open === i && 'rotate-180',
                                        )}
                                        viewBox="0 0 16 16"
                                        fill="none"
                                    >
                                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>

                                {open === i && (
                                    <div className="pb-5 text-sm text-muted-foreground leading-relaxed">
                                        {item.answer}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
