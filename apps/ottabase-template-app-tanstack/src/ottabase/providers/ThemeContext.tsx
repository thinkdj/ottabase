import { createContext, useContext } from 'react';
import type { BrandTheme, ResolvedBrandTheme, LayoutConfig } from '@ottabase/brand-engine';

export interface ThemeProviderState {
    /** Current theme name */
    theme: string;
    /** Change the active theme */
    setTheme: (theme: string) => void;
    /** The raw BrandTheme definition */
    config: BrandTheme;
    /** Fully resolved theme (tokens + layout + defaults applied) */
    resolved: ResolvedBrandTheme | null;
    /** Active layout configuration (merged: theme defaults + admin overrides) */
    layout: LayoutConfig | null;
    /** Admin layout overrides (partial, persisted to localStorage) */
    layoutOverrides: Partial<LayoutConfig>;
    /** Set admin layout overrides – merged on top of theme layout */
    setLayoutOverrides: (overrides: Partial<LayoutConfig>) => void;
    /** Reset layout overrides back to theme defaults */
    resetLayoutOverrides: () => void;
}

const initialState: ThemeProviderState = {
    theme: 'default',
    setTheme: () => null,
    config: {} as BrandTheme,
    resolved: null,
    layout: null,
    layoutOverrides: {},
    setLayoutOverrides: () => null,
    resetLayoutOverrides: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

    return context;
};
