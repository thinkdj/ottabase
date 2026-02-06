import { useEffect, useState } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import type { BrandTheme, ResolvedBrandTheme } from '@ottabase/brand-engine';
import { ThemeProviderContext } from './ThemeContext';
import { applyTheme, getTheme } from '../utils/theme.loader';

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

    const [config, setConfig] = useState<BrandTheme>(getTheme(theme));
    const [resolved, setResolved] = useState<ResolvedBrandTheme | null>(null);

    useEffect(() => {
        // Apply the active theme configuration whenever theme or mode changes
        const mode = resolvedTheme === 'dark' ? 'dark' : 'light';

        if (import.meta.env.DEV) {
            console.log(`[ProviderTheme] Updating theme: ${theme} | mode: ${mode} (resolved: ${resolvedTheme})`);
        }

        const resolvedThemeResult = applyTheme(theme, mode);
        setConfig(getTheme(theme));
        setResolved(resolvedThemeResult);
    }, [theme, resolvedTheme]);

    const setTheme = (newTheme: string) => {
        localStorage.setItem(`${storageKey}-name`, newTheme);
        setThemeState(newTheme);
    };

    const value = {
        theme,
        setTheme,
        config,
        resolved,
        layout: resolved?.layout ?? null,
    };

    return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}
