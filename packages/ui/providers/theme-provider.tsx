'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps as NextThemeProviderProps } from 'next-themes';

import { TooltipProvider } from '../components/ui/tooltip';
import { Toaster } from '../components/ui/toaster';

export interface ThemeProviderProps extends Omit<NextThemeProviderProps, 'children'> {
    children: React.ReactNode;
}

export interface UIProvidersProps extends ThemeProviderProps {
    /**
     * Enables the Radix tooltip provider so that the package tooltips work out of the box.
     * Enabled by default.
     */
    enableTooltipProvider?: boolean;
    /**
     * Adds the Sonner toaster component to render toast notifications.
     * Disabled by default to avoid duplicate toasters.
     */
    enableToaster?: boolean;
    /**
     * Wrap children in the included next-themes provider. Disable when an app already
     * supplies its own NextThemes provider higher in the tree.
     */
    enableThemeProvider?: boolean;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    // Enforce unified theme storage and behavior across apps/packages
    const providerProps: NextThemeProviderProps = {
        attribute: 'class',
        storageKey: 'ottabase.theme',
        defaultTheme: 'light',
        enableSystem: false,
        forcedTheme: undefined,
        disableTransitionOnChange: true,
        ...props, // allow explicit overrides if a specific app needs it
    };

    return <NextThemesProvider {...providerProps}>{children}</NextThemesProvider>;
}

export function UIProviders({
    children,
    enableTooltipProvider = true,
    enableToaster = false,
    enableThemeProvider = true,
    ...themeProps
}: UIProvidersProps) {
    const content = enableTooltipProvider ? <TooltipProvider>{children}</TooltipProvider> : <>{children}</>;

    if (!enableThemeProvider) {
        return (
            <>
                {content}
                {enableToaster ? <Toaster /> : null}
            </>
        );
    }

    return (
        <ThemeProvider {...themeProps}>
            {content}
            {enableToaster ? <Toaster /> : null}
        </ThemeProvider>
    );
}
