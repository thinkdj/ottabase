import { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

interface NextThemesWrapperProps {
    children: ReactNode;
    storagePrefix?: string;
}

const ProviderNextThemes = ({ children }: NextThemesWrapperProps) => {
    return (
        <NextThemesProvider
            attribute="class"
            storageKey="ottabase-theme"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange={false}
        >
            {children}
        </NextThemesProvider>
    );
};

export default ProviderNextThemes;
