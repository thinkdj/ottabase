'use client';

import { useEffect, useState } from 'react';
import { SCHEME_STORAGE_KEY } from '../scheme';
import { focusRing } from './shared';

/**
 * Light/dark switch for the live site: flips `data-scheme` on <html> and remembers the choice.
 * Icons follow the nearest `data-scheme` through CSS, so the server render is already right —
 * including inside the admin preview, whose frame carries its own `data-scheme`.
 */
export function SchemeToggle({ className = '' }: { className?: string }) {
    const [dark, setDark] = useState(false);
    useEffect(() => setDark(document.documentElement.getAttribute('data-scheme') === 'dark'), []);

    const toggle = () => {
        const next = document.documentElement.getAttribute('data-scheme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-scheme', next);
        setDark(next === 'dark');
        try {
            localStorage.setItem(SCHEME_STORAGE_KEY, next);
        } catch {
            // private mode / blocked storage: the switch still works for this page view
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label="Dark mode"
            aria-pressed={dark}
            title="Switch between light and dark"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${focusRing} ${className}`}
        >
            {/* Sun (shown in dark mode: "switch to light") */}
            <svg
                viewBox="0 0 24 24"
                className="hidden h-[18px] w-[18px] [[data-scheme=dark]_&]:block"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
            >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            {/* Moon (shown in light mode: "switch to dark") */}
            <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px] [[data-scheme=dark]_&]:hidden"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
            >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
        </button>
    );
}
