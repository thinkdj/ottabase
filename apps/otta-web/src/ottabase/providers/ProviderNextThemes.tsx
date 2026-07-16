import { ReactNode } from 'react';
import { useBrand } from '@ottabase/brand-engine-react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

interface NextThemesWrapperProps {
    children: ReactNode;
    storagePrefix?: string;
}

/**
 * next-themes wrapper honoring the brand kit's dark-mode configuration:
 * `defaultColorScheme` ('light' | 'dark' | 'system') sets the default room.
 * A returning visitor's stored choice (storageKey) still wins — next-themes
 * only uses defaultTheme when no stored value exists.
 */
const ProviderNextThemes = ({ children }: NextThemesWrapperProps) => {
    const { config } = useBrand();
    const defaultScheme = config?.defaultColorScheme ?? 'light';

    return (
        <NextThemesProvider
            attribute="class"
            storageKey="ottabase.theme"
            defaultTheme={defaultScheme}
            enableSystem={defaultScheme === 'system'}
            disableTransitionOnChange={false}
        >
            {children}
        </NextThemesProvider>
    );
};

export default ProviderNextThemes;
