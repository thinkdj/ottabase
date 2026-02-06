import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import type { BrandTheme, LayoutConfig, ResolvedBrandTheme } from '@ottabase/brand-engine';
import { ThemeProviderContext } from './ThemeContext';
import { applyTheme, getTheme } from '../utils/theme.loader';

const LAYOUT_OVERRIDES_KEY = 'ottabase-layout-overrides';

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: string;
    storageKey?: string;
};

function loadLayoutOverrides(): Partial<LayoutConfig> {
    try {
        const stored = localStorage.getItem(LAYOUT_OVERRIDES_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function mergeLayout(base: LayoutConfig | undefined | null, overrides: Partial<LayoutConfig>): LayoutConfig | null {
    if (!base) return null;
    if (Object.keys(overrides).length === 0) return base;
    return { ...base, ...overrides };
}

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
    const [layoutOverrides, setLayoutOverridesState] = useState<Partial<LayoutConfig>>(loadLayoutOverrides);

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

    const setTheme = useCallback(
        (newTheme: string) => {
            localStorage.setItem(`${storageKey}-name`, newTheme);
            setThemeState(newTheme);
        },
        [storageKey],
    );

    const setLayoutOverrides = useCallback((overrides: Partial<LayoutConfig>) => {
        setLayoutOverridesState(overrides);
        try {
            localStorage.setItem(LAYOUT_OVERRIDES_KEY, JSON.stringify(overrides));
        } catch {
            // storage full – silent fail
        }
    }, []);

    const resetLayoutOverrides = useCallback(() => {
        setLayoutOverridesState({});
        localStorage.removeItem(LAYOUT_OVERRIDES_KEY);
    }, []);

    const layout = useMemo(() => mergeLayout(resolved?.layout, layoutOverrides), [resolved?.layout, layoutOverrides]);

    const value = useMemo(
        () => ({
            theme,
            setTheme,
            config,
            resolved,
            layout,
            layoutOverrides,
            setLayoutOverrides,
            resetLayoutOverrides,
        }),
        [theme, setTheme, config, resolved, layout, layoutOverrides, setLayoutOverrides, resetLayoutOverrides],
    );

    return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}
