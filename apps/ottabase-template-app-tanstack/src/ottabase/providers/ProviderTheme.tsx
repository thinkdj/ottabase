import type { BrandTheme, ResolvedBrandTheme } from '@ottabase/brand-engine';
import { getThemeOrDefault, resolveTheme } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import type { LayoutConfig } from '@ottabase/ottalayout';
import { useTheme as useNextTheme } from 'next-themes';
import { useCallback, useMemo, useState } from 'react';
import { ThemeProviderContext } from './ThemeContext';

const LAYOUT_OVERRIDES_KEY = 'ottabase.layout-overrides';

type ThemeProviderProps = {
    children: React.ReactNode;
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

/** Theme is app-level (Brand Engine). User can only switch light/dark. */
export function ThemeProvider({ children }: ThemeProviderProps) {
    const { config } = useBrand();
    const { resolvedTheme } = useNextTheme();
    const [layoutOverrides, setLayoutOverridesState] = useState<Partial<LayoutConfig>>(loadLayoutOverrides);

    const {
        theme: themeBase,
        config: brandConfig,
        resolved,
    } = useMemo(() => {
        if (!config) {
            return {
                theme: 'default',
                config: {} as BrandTheme,
                resolved: null as ResolvedBrandTheme | null,
            };
        }
        const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
        const base = getThemeOrDefault(config.themeBase || 'default');
        const rLight = resolveTheme({ base, tenantOverrides: config.tenantTheme ?? {}, mode: 'light' });
        const rDark = resolveTheme({ base, tenantOverrides: config.tenantTheme ?? {}, mode: 'dark' });
        // Current mode's resolved theme — reuse already-computed value instead of a third resolveTheme call
        const r = mode === 'dark' ? rDark : rLight;
        const syntheticConfig = {
            name: r.name,
            tokens: {
                color: { light: rLight.colors, dark: rDark.colors },
                typography: r.typography,
                spacing: r.spacing,
                radius: r.radius,
                shadow: r.shadows,
                motion: r.motion,
            },
            layout: r.layout,
            cursors: r.cursors,
        } as BrandTheme;
        // Flat shape for demo/legacy consumers
        (syntheticConfig as Record<string, unknown>).typography = r.typography;
        (syntheticConfig as Record<string, unknown>).colors = { light: rLight.colors, dark: rDark.colors };
        (syntheticConfig as Record<string, unknown>).radius = r.radius;
        (syntheticConfig as Record<string, unknown>).spacing = r.spacing;
        return {
            theme: config.themeBase || 'default',
            config: syntheticConfig,
            resolved: r,
        };
    }, [config, resolvedTheme]);

    const setTheme = useCallback(() => {
        // Theme is app-level; no user switching. Kept for API compat.
    }, []);

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
            theme: themeBase,
            setTheme,
            config: brandConfig,
            resolved,
            layout,
            layoutOverrides,
            setLayoutOverrides,
            resetLayoutOverrides,
        }),
        [themeBase, setTheme, brandConfig, resolved, layout, layoutOverrides, setLayoutOverrides, resetLayoutOverrides],
    );

    return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}
