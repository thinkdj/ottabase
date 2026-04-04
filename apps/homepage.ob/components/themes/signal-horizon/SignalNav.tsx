'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export type SignalNavActive = 'packages' | 'philosophy' | 'docs' | null;

type Props = {
    active?: SignalNavActive;
};

export function SignalNav({ active }: Props) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const dark = mounted && resolvedTheme === 'dark';

    return (
        <nav className={`hp-nav${scrolled ? ' is-scrolled' : ''}`} id="hp-nav" role="navigation" aria-label="Main">
            <div className="hp-container hp-nav-inner">
                <Link href="/" className="hp-mark" aria-label="Ottabase home">
                    <span className="hp-mark-ot">otta</span>
                    <span className="hp-mark-base">base</span>
                    <span className="hp-mark-tag">oss</span>
                </Link>
                <div className={`hp-nav-links${menuOpen ? ' is-open' : ''}`} id="hp-nav-links">
                    <Link href="/packages" aria-current={active === 'packages' ? 'page' : undefined}>
                        Packages
                    </Link>
                    <Link href="/philosophy" aria-current={active === 'philosophy' ? 'page' : undefined}>
                        Philosophy
                    </Link>
                    <Link href="/docs" aria-current={active === 'docs' ? 'page' : undefined}>
                        Docs
                    </Link>
                </div>
                <div className="hp-nav-actions">
                    <button
                        type="button"
                        className="hp-icon-btn"
                        id="hp-theme-toggle"
                        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                        title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                        onClick={() => setTheme(dark ? 'light' : 'dark')}
                    >
                        <svg
                            className="hp-theme-icon hp-theme-icon--moon"
                            width={18}
                            height={18}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden
                        >
                            <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                        </svg>
                        <svg
                            className="hp-theme-icon hp-theme-icon--sun"
                            width={18}
                            height={18}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden
                        >
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                        </svg>
                    </button>
                    <a
                        href="https://github.com/thinkdj/ottabase"
                        className="hp-btn hp-btn--ghost"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        GitHub
                    </a>
                    <a
                        href="https://github.com/thinkdj/ottabase"
                        className="hp-btn hp-btn--primary"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Star
                    </a>
                </div>
                <button
                    type="button"
                    className="hp-hamburger"
                    id="hp-hamburger"
                    aria-label="Toggle menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((o) => !o)}
                >
                    <span />
                    <span />
                    <span />
                </button>
            </div>
        </nav>
    );
}
