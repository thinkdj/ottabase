'use client';

import { applyBrandTheme } from '@ottabase/brand-engine';
import type { FullBrandConfig } from '@ottabase/brand-engine-react';
import { BrandProvider } from '@ottabase/brand-engine-react';
import { ShadcnProviders } from '@ottabase/ui-shadcn';
import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react';

export function Providers({
    children,
    initialBrandConfig,
}: {
    children: React.ReactNode;
    initialBrandConfig: FullBrandConfig;
}) {
    // Handle theme switching for dark/light mode
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const applyCorrectTheme = () => {
            const isDark = document.documentElement.classList.contains('dark');
            const brandKit = (initialBrandConfig as any).brandKitsMap?.default;

            if (brandKit) {
                // Use stored light/dark themes if available
                const themeToApply = isDark
                    ? brandKit._darkTheme || brandKit.theme
                    : brandKit._lightTheme || brandKit.theme;

                applyBrandTheme(themeToApply);
            }
        };

        // Apply correct theme on mount
        applyCorrectTheme();

        // Watch for dark mode class changes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    applyCorrectTheme();
                }
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, [initialBrandConfig]);

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <BrandProvider initialConfig={initialBrandConfig}>
                <ShadcnProviders enableThemeProvider={false} enableToaster>
                    {children}
                </ShadcnProviders>
            </BrandProvider>
        </ThemeProvider>
    );
}
