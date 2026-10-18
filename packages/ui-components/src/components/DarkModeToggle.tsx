import { IconMoonStars, IconSun } from '@tabler/icons-react';
import { Button } from '@ottabase/ui-shadcn';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type DarkModeToggleProps = {
    type: 'toggle-switch' | 'button';
    title?: string;
};

/** How long every colour eases when the theme flips (Design System v1: --duration-theme, 320ms + slack). */
const THEME_EASE_MS = 420;

/**
 * A self-contained, theme-switching component using `next-themes`.
 *
 * The icon shows the destination, not the state: a moon in light mode, a sun
 * in dark. Flipping adds `.theming` to <html> for the length of the switch so
 * shadcn.css eases every colour once instead of snapping.
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
        const root = document.documentElement;
        root.classList.add('theming');
        setTheme(isDarkMode ? 'light' : 'dark');
        window.setTimeout(() => root.classList.remove('theming'), THEME_EASE_MS);
    };

    return type === 'toggle-switch' ? (
        <button
            type="button"
            role="switch"
            aria-checked={isDarkMode}
            onClick={toggleTheme}
            className={`relative inline-flex h-5 w-[34px] items-center rounded-full p-0.5 transition duration-normal ease-theme ${
                isDarkMode ? 'bg-primary' : 'bg-input'
            }`}
            title={title}
        >
            <span
                className={`inline-flex size-4 transform items-center justify-center rounded-full bg-white text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-normal ease-theme ${
                    isDarkMode ? 'translate-x-[14px]' : 'translate-x-0'
                }`}
            >
                {isDarkMode ? <IconMoonStars size={11} stroke={2.5} /> : <IconSun size={11} stroke={2.5} />}
            </span>
        </button>
    ) : (
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} title={title} aria-label={title}>
            <span className="relative block size-4 overflow-hidden">
                <IconMoonStars
                    size={16}
                    aria-hidden="true"
                    className={`absolute inset-0 transition duration-slow ease-theme ${
                        isDarkMode ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
                    }`}
                />
                <IconSun
                    size={16}
                    aria-hidden="true"
                    className={`absolute inset-0 transition duration-slow ease-theme ${
                        isDarkMode ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
                    }`}
                />
            </span>
        </Button>
    );
};

export default DarkModeToggle;
