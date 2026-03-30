'use client';

import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import Link from 'next/link';
import type { NavbarData } from './types';

/**
 * Minimal navbar — logo and dark-mode toggle only. No navigation links.
 */
export function NavbarMinimal({ title = 'Ottabase' }: NavbarData) {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
            <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                <Link href="/" className="font-heading text-lg font-bold text-foreground">
                    {title}
                </Link>
                <DarkModeToggle type="button" title="Toggle dark/light mode" />
            </nav>
        </header>
    );
}
