import { useEffect, useState } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { ThemeProviderContext } from './ThemeContext';
import { applyTheme, getTheme } from '../utils/theme.loader';
import { ThemeConfig } from '../config/theme.types';

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: string;
    storageKey?: string;
};

export function ThemeProvider({
    children,
    defaultTheme = 'default',
    storageKey = 'ottabase-ui-theme', // Key for the *theme name*, not mode
}: ThemeProviderProps) {
    const { resolvedTheme } = useNextTheme();

    // Initialize state from localStorage or defaults
    const [theme, setThemeState] = useState<string>(() => {
        return localStorage.getItem(`${storageKey}-name`) || defaultTheme;
    });

    const [config, setConfig] = useState<ThemeConfig>(getTheme(theme));

    useEffect(() => {
        // Apply the active theme configuration whenever theme or mode changes
        const mode = resolvedTheme === 'dark' ? 'dark' : 'light';

        if (import.meta.env.DEV) {
            console.log(`[ProviderTheme] Updating theme: ${theme} | mode: ${mode} (resolved: ${resolvedTheme})`);
        }

        applyTheme(theme, mode);
        setConfig(getTheme(theme));
    }, [theme, resolvedTheme]);

    const setTheme = (newTheme: string) => {
        localStorage.setItem(`${storageKey}-name`, newTheme);
        setThemeState(newTheme);
    };

    const value = {
        theme,
        setTheme,
        config,
    };

    return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}
