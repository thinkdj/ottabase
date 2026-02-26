'use client';

import { useState } from 'react';
import type { NavbarProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Atlas — Navbar
 *
 * Sticky top navigation with brand, nav links, and CTA.
 * Responsive: collapses to a hamburger menu on mobile.
 */
export function AtlasNavbar({ brand, links, cta, className }: NavbarProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className={cn('sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border', className)}>
            <div className="mx-auto max-w-6xl px-6">
                <div className="flex h-16 items-center justify-between gap-6">
                    {/* Brand */}
                    <a href={brand.href ?? '/'} className="flex shrink-0 items-center gap-2">
                        {brand.logo ? (
                            brand.logo
                        ) : (
                            <span className="font-heading text-sm font-semibold text-foreground">{brand.name}</span>
                        )}
                    </a>

                    {/* Desktop nav */}
                    {links && links.length > 0 && (
                        <nav className="hidden md:flex items-center gap-6">
                            {links.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </nav>
                    )}

                    {/* Right side: CTA + mobile toggle */}
                    <div className="flex shrink-0 items-center gap-3">
                        {cta && (
                            <a
                                href={cta.href}
                                onClick={cta.onClick}
                                className="hidden sm:inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                {cta.label}
                            </a>
                        )}
                        {links && links.length > 0 && (
                            <button
                                className="inline-flex items-center justify-center md:hidden h-9 w-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                onClick={() => setMenuOpen((o) => !o)}
                                aria-label="Toggle menu"
                            >
                                {menuOpen ? (
                                    <svg
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M4 6h16M4 12h16M4 18h16"
                                        />
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile menu */}
                {menuOpen && links && (
                    <nav className="md:hidden border-t border-border py-3 flex flex-col gap-1 pb-4">
                        {links.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="block px-2 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                {link.label}
                            </a>
                        ))}
                        {cta && (
                            <a
                                href={cta.href}
                                className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                {cta.label}
                            </a>
                        )}
                    </nav>
                )}
            </div>
        </header>
    );
}
