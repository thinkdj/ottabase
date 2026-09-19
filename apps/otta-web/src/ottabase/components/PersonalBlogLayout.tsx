import { useSession } from '@/lib/auth';
import { APP_META } from '@/ottabase/config';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { Link, useLocation } from '@tanstack/react-router';
import { ArrowUpRight, Menu, Rss, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { UserSection } from './layout/UserSection';

const rssUrl = sanitizeUrl('/api/blog/rss?title=Slices.&description=Essays%2C%20observations%2C%20and%20photographs');

export function PersonalBlogLayout({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const { user } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);

    const isBlog = pathname === '/' || pathname.startsWith('/blog');
    const isStudio = pathname.startsWith('/studio');

    return (
        <div className="personal-publication min-h-screen">
            <a className="personal-skip-link" href="#main-content">
                Skip to content
            </a>

            <header className="personal-site-header">
                <div className="personal-site-header__inner">
                    <Link to="/" className="personal-wordmark" onClick={() => setMenuOpen(false)}>
                        <span>{APP_META.appName}</span>
                    </Link>

                    <nav
                        id="personal-primary-navigation"
                        className={`personal-site-nav ${menuOpen ? 'is-open' : ''}`}
                        aria-label="Primary navigation"
                    >
                        <Link to="/blog" className={isBlog ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>
                            Writing
                        </Link>
                        <Link
                            to="/about"
                            className={pathname === '/about' ? 'is-active' : ''}
                            onClick={() => setMenuOpen(false)}
                        >
                            About
                        </Link>
                    </nav>

                    <div className="personal-site-actions">
                        <ThemeSwitcher />
                        {user && <UserSection compact />}
                        {user && isStudio && <span className="personal-site-actions__status">Studio</span>}
                        <button
                            type="button"
                            className="personal-menu-button"
                            aria-expanded={menuOpen}
                            aria-controls="personal-primary-navigation"
                            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
                            onClick={() => setMenuOpen((open) => !open)}
                        >
                            {menuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>
            </header>

            <main id="main-content" className="personal-site-main">
                {children}
            </main>

            <footer className="personal-site-footer">
                <div className="personal-site-footer__inner">
                    <div>
                        <p className="personal-footer-kicker">A small corner of the internet</p>
                        <p className="personal-footer-note">
                            Essays, observations, and photographs — made slowly, shared occasionally.
                        </p>
                    </div>
                    <div className="personal-footer-links">
                        <Link to="/blog">
                            All writing <ArrowUpRight size={14} />
                        </Link>
                        <Link to="/about">
                            About <ArrowUpRight size={14} />
                        </Link>
                        <a href={rssUrl} target="_blank" rel="noreferrer">
                            Feed <ArrowUpRight size={14} />
                        </a>
                    </div>
                    <div className="personal-footer-bottom">
                        <span>
                            © {new Date().getFullYear()} {APP_META.appName}
                        </span>
                        <span className="personal-footer-dot">·</span>
                        <span>Made for reading</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
