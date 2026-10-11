'use client';

import { IconMoonStars, IconSun } from '@tabler/icons-react';
import { Button } from '@ottabase/ui-shadcn';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type DarkModeToggleProps = {
    type: 'toggle-switch' | 'button';
    title?: string;
};

/**
 * A self-contained, theme-switching component for Next.js applications
 * using `next-themes`. It includes the "use client" directive and handles
 * its own state, making it a simple, plug-and-play component.
 */
const DarkModeToggle = (props: DarkModeToggleProps) => {
    const { type, title = 'Toggle color scheme' } = props;
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoids hydration mismatch by ensuring the component only renders
    // on the client where the theme is known.
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        // On the server, return a placeholder or null to avoid mismatch.
        return null;
    }

    const isDarkMode = resolvedTheme === 'dark';

    const toggleTheme = () => {
        setTheme(isDarkMode ? 'light' : 'dark');
    };

    return type === 'toggle-switch' ? (
        <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
            }`}
            title={title}
        >
            <span
                className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
            >
                {isDarkMode ? <IconMoonStars size={14} stroke={2.5} /> : <IconSun size={14} stroke={2.5} />}
            </span>
        </button>
    ) : (
        <Button variant="ghost" size="sm" onClick={toggleTheme} title={title} aria-label={title}>
            {isDarkMode ? <IconSun size={16} /> : <IconMoonStars size={16} />}
        </Button>
    );
};

export default DarkModeToggle;
