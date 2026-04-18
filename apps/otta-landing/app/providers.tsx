'use client';

import { applyBrandTheme, getThemeByName, registerBuiltInThemes, resolveTheme } from '@ottabase/brand-engine';
import type { FullBrandConfig } from '@ottabase/brand-engine-react';
import { BrandProvider } from '@ottabase/brand-engine-react';
import { ShadcnProviders } from '@ottabase/ui-shadcn';
import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react';
import { THEME_STORAGE_KEY } from '../components/ThemePresetSwitcher';
import { HomepageConfigProvider } from '../lib/homepage-config-context';

export function Providers({
    children,
    initialBrandConfig,
}: {
    children: React.ReactNode;
    initialBrandConfig: FullBrandConfig;
}) {
    // Handle theme switching for dark/light mode + restore saved preset
    useEffect(() => {
        if (typeof document === 'undefined') return;

        // Check for a saved preset in localStorage
        const savedPreset = localStorage.getItem(THEME_STORAGE_KEY);

        const applyCorrectTheme = () => {
            const isDark = document.documentElement.classList.contains('dark');
            const mode = isDark ? 'dark' : 'light';

            if (savedPreset) {
                // Apply the saved preset instead of the SSR default
                registerBuiltInThemes();
                const base = getThemeByName(savedPreset);
                if (base) {
                    const resolved = resolveTheme({ base, tenantOverrides: {}, mode });
                    applyBrandTheme(resolved);
                    return;
                }
            }

            // Fall back to the SSR brand config
            const brandKit = (initialBrandConfig as any).brandKitsMap?.default;
            if (brandKit) {
                const themeToApply = isDark ? brandKit.darkTheme || brandKit.theme : brandKit.theme;
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
                    <HomepageConfigProvider>{children}</HomepageConfigProvider>
                </ShadcnProviders>
            </BrandProvider>
        </ThemeProvider>
    );
}
