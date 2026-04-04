'use client';

import { IconBrandGithub, IconMoon, IconSun } from '@tabler/icons-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export type NavActive = 'packages' | 'philosophy' | 'docs' | null;

type Props = {
    active?: NavActive;
};

export function SiteNav({ active }: Props) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const dark = mounted && resolvedTheme === 'dark';

    return (
        <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="nav" role="navigation" aria-label="Main">
            <div className="container nav-inner">
                <Link href="/" className="nav-logo" aria-label="Ottabase home">
                    <span className="logo-otta">otta</span>
                    <span className="logo-base">base</span>
                </Link>

                <div className={`nav-links${menuOpen ? ' open' : ''}`} id="nav-links">
                    <Link href="/packages" style={active === 'packages' ? { color: 'var(--text)' } : undefined}>
                        Packages
                    </Link>
                    <Link href="/philosophy" style={active === 'philosophy' ? { color: 'var(--text)' } : undefined}>
                        Philosophy
                    </Link>
                    <Link href="/docs" style={active === 'docs' ? { color: 'var(--text)' } : undefined}>
                        Docs
                    </Link>
                </div>

                <div className="nav-tools">
                    <button
                        type="button"
                        className="nav-theme-toggle"
                        id="theme-toggle"
                        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                        title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                        onClick={() => setTheme(dark ? 'light' : 'dark')}
                    >
                        <IconMoon className="nav-theme-icon nav-theme-icon--moon" size={18} stroke={2} aria-hidden />
                        <IconSun className="nav-theme-icon nav-theme-icon--sun" size={18} stroke={2} aria-hidden />
                    </button>
                    <div className="nav-actions">
                        <a
                            href="https://github.com/thinkdj/ottabase"
                            className="btn btn-ghost"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <IconBrandGithub size={16} stroke={1.5} aria-hidden />
                            GitHub
                        </a>
                        <a
                            href="https://github.com/thinkdj/ottabase"
                            className="btn btn-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ⭐ Star
                        </a>
                    </div>
                    <button
                        type="button"
                        className="hamburger"
                        id="hamburger"
                        aria-label="Toggle menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((o) => !o)}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>
            </div>
        </nav>
    );
}
