'use client';

import { MoonStar, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

import { cn } from '@ottabase/ui/lib/utils';
import { Button } from './button';

export interface DarkModeToggleProps {
    type: 'toggle-switch' | 'button';
    title?: string;
}

/** How long every colour eases when the theme flips (Design System v1: --duration-theme, 320ms + slack). */
const THEME_EASE_MS = 420;

/**
 * A self-contained theme switch on `next-themes`, so it needs a next-themes provider above it
 * (`UIProviders` or `ThemeProvider` from this package, or the app's own).
 *
 * The icon shows the destination, not the state: a moon in light mode, a sun
 * in dark. Flipping adds `.theming` to <html> for the length of the switch so
 * `styles/ui.css` eases every colour once instead of snapping.
 */
function DarkModeToggle({ type, title = 'Toggle color scheme' }: DarkModeToggleProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // The theme is only known on the client: render nothing until mounted to avoid a hydration mismatch.
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    const isDarkMode = resolvedTheme === 'dark';

    const toggleTheme = () => {
        const root = document.documentElement;
        root.classList.add('theming');
        setTheme(isDarkMode ? 'light' : 'dark');
        window.setTimeout(() => root.classList.remove('theming'), THEME_EASE_MS);
    };

    if (type === 'toggle-switch') {
        return (
            <button
                type="button"
                role="switch"
                data-slot="dark-mode-toggle"
                aria-checked={isDarkMode}
                aria-label={title}
                onClick={toggleTheme}
                className={cn(
                    'relative inline-flex h-5 w-[34px] items-center rounded-full p-0.5 transition duration-normal ease-theme',
                    isDarkMode ? 'bg-primary' : 'bg-input',
                )}
                title={title}
            >
                <span
                    className={cn(
                        'inline-flex size-4 transform items-center justify-center rounded-full bg-white text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-normal ease-theme',
                        isDarkMode ? 'translate-x-[14px]' : 'translate-x-0',
                    )}
                >
                    {isDarkMode ? (
                        <MoonStar size={11} strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                        <Sun size={11} strokeWidth={2.5} aria-hidden="true" />
                    )}
                </span>
            </button>
        );
    }

    return (
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} title={title} aria-label={title}>
            <span className="relative block size-4 overflow-hidden">
                <MoonStar
                    size={16}
                    aria-hidden="true"
                    className={cn(
                        'absolute inset-0 transition duration-slow ease-theme',
                        isDarkMode ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100',
                    )}
                />
                <Sun
                    size={16}
                    aria-hidden="true"
                    className={cn(
                        'absolute inset-0 transition duration-slow ease-theme',
                        isDarkMode ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0',
                    )}
                />
            </span>
        </Button>
    );
}

export { DarkModeToggle };
