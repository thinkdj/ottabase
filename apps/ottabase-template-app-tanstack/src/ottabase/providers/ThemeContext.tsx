import { createContext, useContext } from 'react';
import { ThemeConfig } from '../config/theme.types';

export interface ThemeProviderState {
    theme: string;
    setTheme: (theme: string) => void;
    config: ThemeConfig;
}

const initialState: ThemeProviderState = {
    theme: 'default',
    setTheme: () => null,
    config: {} as ThemeConfig,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

    return context;
};
