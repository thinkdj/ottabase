'use client';

import { useState } from 'react';
import type { TestimonialsCarouselProps } from '../types';
import { cn } from '../lib/utils';

function StarRow({ rating = 5 }: { rating?: number }) {
    return (
        <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={cn('h-3.5 w-3.5', i < rating ? 'text-foreground' : 'text-border')} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L2.2 5.7l4-.6L8 1.5z" />
                </svg>
            ))}
        </div>
    );
}

/**
 * Atlas — TestimonialsCarousel
 *
 * Paginated 3-up grid of bordered testimonial cards with avatar,
 * star rating, quote, and author. Prev/next navigation.
 */
export function AtlasTestimonialsCarousel({
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
        <section className={cn('bg-muted border-y border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        {eyebrow && (
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                                {eyebrow}
                            </p>
                        )}
                        {headline && (
                            <h2 className="font-heading text-3xl font-semibold text-foreground tracking-tight">
                                {headline}
                            </h2>
                        )}
                    </div>

                    {/* Navigation */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                aria-label="Previous"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {visible.map((t, i) => (
                        <div
                            key={i}
                            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
                        >
                            <StarRow rating={t.rating} />
                            <p className="text-sm text-foreground leading-relaxed flex-1">
                                &ldquo;{t.quote}&rdquo;
                            </p>
                            <div className="flex items-center gap-3 pt-2 border-t border-border">
                                {t.avatar ? (
                                    <img
                                        src={t.avatar}
                                        alt={t.author}
                                        className="h-8 w-8 rounded-full object-cover border border-border shrink-0"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
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
