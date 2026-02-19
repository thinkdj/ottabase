'use client';

import { useState } from 'react';
import type { TestimonialsCarouselProps } from '../types';
import { cn } from '../lib/utils';

function StarRow({ rating = 5 }: { rating?: number }) {
    return (
        <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={cn('h-3.5 w-3.5', i < rating ? 'text-primary' : 'text-muted-foreground/30')} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L2.2 5.7l4-.6L8 1.5z" />
                </svg>
            ))}
        </div>
    );
}

/**
 * SaaS — TestimonialsCarousel
 *
 * Soft shadow cards on a tinted background. Rounded-2xl with generous
 * padding. Stars use primary color. Avatar + author in a clean row.
 */
export function SaaSTestimonialsCarousel({
    eyebrow,
    headline,
    testimonials,
    className,
}: TestimonialsCarouselProps) {
    const pageSize = 3;
    const [page, setPage] = useState(0);
    const totalPages = Math.ceil(testimonials.length / pageSize);
    const visible = testimonials.slice(page * pageSize, page * pageSize + pageSize);

    return (
        <section className={cn('bg-muted/30', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className="mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        {eyebrow && (
                            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                                {eyebrow}
                            </p>
                        )}
                        {headline && (
                            <h2 className="font-heading text-3xl font-bold text-foreground tracking-tight">
                                {headline}
                            </h2>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                aria-label="Previous"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background text-foreground shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {page + 1} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page === totalPages - 1}
                                aria-label="Next"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background text-foreground shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {visible.map((t, i) => (
                        <div
                            key={i}
                            className="flex flex-col gap-5 rounded-2xl bg-card p-7 shadow-sm"
                        >
                            <StarRow rating={t.rating} />
                            <p className="text-sm text-foreground leading-relaxed flex-1">
                                &ldquo;{t.quote}&rdquo;
                            </p>
                            <div className="flex items-center gap-3">
                                {t.avatar ? (
                                    <img
                                        src={t.avatar}
                                        alt={t.author}
                                        className="h-9 w-9 rounded-full object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                                        {t.author[0]}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{t.author}</p>
                                    {(t.role || t.company) && (
                                        <p className="text-xs text-muted-foreground truncate">
                                            {[t.role, t.company].filter(Boolean).join(', ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
