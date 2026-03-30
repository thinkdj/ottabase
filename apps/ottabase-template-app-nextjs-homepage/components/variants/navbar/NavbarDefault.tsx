'use client';

import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Button } from '@ottabase/ui-shadcn';
import { ExternalLink, Github, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavbarData, NavLink } from './types';

const DEFAULT_NAV_LINKS: NavLink[] = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/theme-demo', label: 'Themes' },
];

/**
 * Default navbar — logo left, nav links + dark-mode toggle right, mobile hamburger.
 */
export function NavbarDefault({ title = 'Ottabase', links = DEFAULT_NAV_LINKS, githubUrl }: NavbarData) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
            <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                <Link href="/" className="font-heading text-lg font-bold text-foreground">
                    {title}
                </Link>

                <div className="hidden items-center gap-1 md:flex">
                    {links.map((link) =>
                        link.external ? (
                            <Button key={link.href} asChild variant="ghost" size="sm">
                                <a href={link.href} target="_blank" rel="noopener noreferrer">
                                    {link.label}
                                </a>
                            </Button>
                        ) : (
                            <Button
                                key={link.href}
                                asChild
                                variant={pathname === link.href ? 'secondary' : 'ghost'}
                                size="sm"
                            >
                                <Link href={link.href}>{link.label}</Link>
                            </Button>
                        ),
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {githubUrl && (
                        <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                            <a
                                href={githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open on GitHub (new tab)"
                            >
                                <Github className="mr-1.5 h-4 w-4" />
                                GitHub
                                <ExternalLink className="ml-1 h-3 w-3 opacity-60" />
                            </a>
                        </Button>
                    )}
                    <DarkModeToggle type="button" title="Toggle dark/light mode" />
                    <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </nav>

            {mobileOpen && (
                <div className="border-t border-border bg-background px-4 py-3 md:hidden">
                    <div className="flex flex-col gap-1">
                        {links.map((link) =>
                            link.external ? (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                    onClick={() => setMobileOpen(false)}
                                >
                                    {link.label}
                                </a>
                            ) : (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-foreground ${
                                        pathname === link.href
                                            ? 'bg-secondary text-secondary-foreground'
                                            : 'text-muted-foreground'
                                    }`}
                                    onClick={() => setMobileOpen(false)}
                                >
                                    {link.label}
                                </Link>
                            ),
                        )}
                        {githubUrl && (
                            <a
                                href={githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                onClick={() => setMobileOpen(false)}
                            >
                                <Github className="h-4 w-4" />
                                GitHub
                                <ExternalLink className="h-3 w-3 opacity-60" />
                            </a>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
