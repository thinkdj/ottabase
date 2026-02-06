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
    /** Active layout configuration (shorthand for resolved.layout) */
    layout: LayoutConfig | null;
}

const initialState: ThemeProviderState = {
    theme: 'default',
    setTheme: () => null,
    config: {} as BrandTheme,
    resolved: null,
    layout: null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

    return context;
};
