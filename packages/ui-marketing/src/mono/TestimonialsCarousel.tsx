'use client';

import { useState } from 'react';
import type { TestimonialsCarouselProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — TestimonialsCarousel
 *
 * Single full-width testimonial with a large typographic quote mark.
 * Numbered indicator (1 / N) and prev/next arrow navigation.
 * Typography-driven, stark design.
 */
export function MonoTestimonialsCarousel({
    eyebrow,
    headline,
    testimonials,
    className,
}: TestimonialsCarouselProps) {
    const [index, setIndex] = useState(0);
    const current = testimonials[index];
    if (!current) return null;

    return (
        <section className={cn('bg-background border-y border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Top bar */}
                <div className="flex items-end justify-between mb-10 pb-8 border-b border-border">
                    <div>
                        {eyebrow && (
                            <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                — {eyebrow}
                            </p>
                        )}
                        {headline && (
                            <h2 className="font-heading text-2xl font-semibold text-foreground tracking-tight">
                                {headline}
                            </h2>
                        )}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {String(index + 1).padStart(2, '0')} / {String(testimonials.length).padStart(2, '0')}
                        </span>
                        <button
                            onClick={() => setIndex((i) => Math.max(0, i - 1))}
                            disabled={index === 0}
                            aria-label="Previous testimonial"
                            className="inline-flex h-8 w-8 items-center justify-center border border-border text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setIndex((i) => Math.min(testimonials.length - 1, i + 1))}
                            disabled={index === testimonials.length - 1}
                            aria-label="Next testimonial"
                            className="inline-flex h-8 w-8 items-center justify-center border border-border text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Quote */}
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-10">
                    {/* Typographic quote mark */}
                    <span
                        className="font-heading text-8xl leading-none text-border select-none"
                        aria-hidden="true"
                    >
                        &ldquo;
                    </span>

                    <div>
                        <p className="font-heading text-xl md:text-2xl text-foreground leading-snug tracking-tight">
                            {current.quote}
                        </p>

                        <div className="mt-8 flex items-center gap-4">
                            {current.avatar ? (
                                <img
                                    src={current.avatar}
                                    alt={current.author}
                                    className="h-10 w-10 object-cover border border-border shrink-0"
                                />
                            ) : (
                                <div className="h-10 w-10 border border-border flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                                    {current.author[0]}
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-semibold text-foreground">{current.author}</p>
                                {(current.role || current.company) && (
                                    <p className="font-mono text-xs text-muted-foreground">
                                        {[current.role, current.company].filter(Boolean).join(' · ')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
