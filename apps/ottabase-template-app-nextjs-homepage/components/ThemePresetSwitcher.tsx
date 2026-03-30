'use client';

import type { ResolvedBrandTheme } from '@ottabase/brand-engine';
import {
    applyBrandTheme,
    BUILTIN_THEME_NAMES,
    getThemeByName,
    PRESET_MAP,
    registerBuiltInThemes,
    resolveTheme,
} from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';

// Ensure themes are registered client-side so getThemeByName() works
let registered = false;
function ensureRegistered() {
    if (!registered) {
        registerBuiltInThemes();
        registered = true;
    }
}

export const THEME_STORAGE_KEY = 'ottabase.homepage.theme-preset';

export type ThemeSwitchInfo = {
    presetName: string;
    resolvedTheme: ResolvedBrandTheme;
};

type ThemePresetSwitcherProps = {
    /** Called after a preset is applied with the new preset name and resolved theme */
    onSwitch?: (info: ThemeSwitchInfo) => void;
};

/**
 * Visual theme preset picker.
 * Shows all 8 built-in presets as selectable cards with live color swatches.
 * Selecting a preset applies its CSS variables instantly (no page reload).
 */
export function ThemePresetSwitcher({ onSwitch }: ThemePresetSwitcherProps = {}) {
    const { config } = useBrand();
    const { resolvedTheme } = useTheme();

    const getInitialPreset = useCallback((): string => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved && BUILTIN_THEME_NAMES.includes(saved)) return saved;
        }
        const configThemeBase = (config as any)?.themeBase;
        if (configThemeBase && BUILTIN_THEME_NAMES.includes(configThemeBase)) {
            return configThemeBase;
        }
        return 'default';
    }, [config]);

    // Initialize from localStorage if available, then config fallback
    const [activePreset, setActivePreset] = useState<string>(() => 'default');

    useEffect(() => {
        ensureRegistered();
    }, []);

    // Keep active preset/theme in sync with persisted or SSR config on first load and mode changes
    useEffect(() => {
        ensureRegistered();

        const presetName = getInitialPreset();
        const base = getThemeByName(presetName);
        if (!base) return;

        const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
        const resolved = resolveTheme({ base, tenantOverrides: {}, mode });
        applyBrandTheme(resolved);
        setActivePreset(presetName);
        onSwitch?.({ presetName, resolvedTheme: resolved });
    }, [getInitialPreset, resolvedTheme, onSwitch]);

    const handleSelect = useCallback(
        (presetName: string) => {
            ensureRegistered();
            const base = getThemeByName(presetName);
            if (!base) return;

            const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
            const resolved = resolveTheme({ base, tenantOverrides: {}, mode });
            applyBrandTheme(resolved);

            // Update local state for active indicator
            setActivePreset(presetName);

            // Persist to localStorage
            localStorage.setItem(THEME_STORAGE_KEY, presetName);

            // Update the stored config so other components reflect the new preset
            if (config) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (config as any).themeBase = presetName;
            }

            // Notify parent with resolved theme data
            onSwitch?.({ presetName, resolvedTheme: resolved });
        },
        [config, resolvedTheme, onSwitch],
    );

    return (
        <div className="grid grid-cols-2 gap-2">
            {BUILTIN_THEME_NAMES.map((name) => {
                // Use PRESET_MAP (static JSON) for swatch colors — always available without registry
                const presetColors = PRESET_MAP[name]?.colors?.light as Record<string, string> | undefined;
                const isActive = activePreset === name;

                return (
                    <button
                        key={name}
                        type="button"
                        onClick={() => handleSelect(name)}
                        aria-label={`Select ${name} theme preset`}
                        className={`group relative flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-2.5 text-xs transition-all ${
                            isActive
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                        }`}
                    >
                        {/* Color swatches — stacked circles */}
                        <div className="flex gap-1">
                            {['primary', 'secondary', 'accent'].map((token) => {
                                const hsl = presetColors?.[token];
                                return (
                                    <span
                                        key={token}
                                        className={`h-5 w-5 rounded-full shadow-sm ${isActive ? 'ring-1 ring-primary/30' : 'ring-1 ring-border/40'}`}
                                        style={{
                                            backgroundColor: hsl ? `hsl(${hsl})` : 'transparent',
                                        }}
                                    />
                                );
                            })}
                        </div>
                        {/* Preset name */}
                        <span
                            className={`font-medium capitalize truncate ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                        >
                            {name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
