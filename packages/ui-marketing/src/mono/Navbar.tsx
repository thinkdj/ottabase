'use client';

import { useState } from 'react';
import type { NavbarProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — Navbar
 *
 * Minimal sticky header. Brand name left, monospace nav links right.
 * Responsive: text-based mobile toggle.
 */
export function MonoNavbar({ brand, links, cta, className }: NavbarProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className={cn('sticky top-0 z-50 bg-background border-b border-border', className)}>
            <div className="mx-auto max-w-6xl px-6">
                <div className="flex h-12 items-center justify-between gap-6">
                    {/* Brand */}
                    <a
                        href={brand.href ?? '/'}
                        className="shrink-0 font-heading text-sm font-semibold text-foreground tracking-tight"
                    >
                        {brand.name}
                    </a>

                    {/* Desktop nav */}
                    {links && links.length > 0 && (
                        <nav className="hidden md:flex items-center gap-7">
                            {links.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </nav>
                    )}

                    {/* CTA + mobile toggle */}
                    <div className="flex shrink-0 items-center gap-5">
                        {cta && (
                            <a
                                href={cta.href}
                                onClick={cta.onClick}
                                className="hidden sm:inline font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground border-b border-current pb-px transition-colors"
                            >
                                {cta.label} →
                            </a>
                        )}
                        {links && links.length > 0 && (
                            <button
                                className="md:hidden font-mono text-base text-muted-foreground hover:text-foreground transition-colors leading-none"
                                onClick={() => setMenuOpen((o) => !o)}
                                aria-label="Toggle menu"
                            >
                                {menuOpen ? '×' : '≡'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile menu */}
                {menuOpen && links && (
                    <nav className="md:hidden border-t border-border py-4 flex flex-col gap-3">
                        {links.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                {link.label}
                            </a>
                        ))}
                        {cta && (
                            <a
                                href={cta.href}
                                className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground border-b border-current pb-px transition-colors w-fit"
                            >
                                {cta.label} →
                            </a>
                        )}
                    </nav>
                )}
            </div>
        </header>
    );
}
