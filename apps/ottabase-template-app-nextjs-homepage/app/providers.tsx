'use client';

import { applyBrandTheme, getThemeByName, registerBuiltInThemes, resolveTheme } from '@ottabase/brand-engine';
import type { FullBrandConfig } from '@ottabase/brand-engine-react';
import { BrandProvider } from '@ottabase/brand-engine-react';
import { ShadcnProviders } from '@ottabase/ui-shadcn';
import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react';
import { THEME_STORAGE_KEY } from '../components/ThemePresetSwitcher';
import { HomepageConfigProvider } from '../lib/homepage-config-context';

export interface ProvidersProps {
    children: React.ReactNode;
    initialBrandConfig: FullBrandConfig;
    /** DB-driven variant-by-slot from GET /api/homepage/data display settings */
    initialHomepageConfig?: Record<string, string> | null;
    /** DB-driven theme preset ID (e.g. 'neo', 'warm') */
    themePresetId?: string | null;
}

export function Providers({ children, initialBrandConfig, initialHomepageConfig, themePresetId }: ProvidersProps) {
    // Handle theme switching for dark/light mode + restore saved preset
    useEffect(() => {
        if (typeof document === 'undefined') return;

        // Priority: localStorage saved preset > DB themePresetId > SSR brand config
        const savedPreset = localStorage.getItem(THEME_STORAGE_KEY);

        const applyCorrectTheme = () => {
            const isDark = document.documentElement.classList.contains('dark');
            const mode = isDark ? 'dark' : 'light';

            // Try localStorage preset first (user's explicit choice)
            if (savedPreset) {
                registerBuiltInThemes();
                const base = getThemeByName(savedPreset);
                if (base) {
                    const resolved = resolveTheme({ base, tenantOverrides: {}, mode });
                    applyBrandTheme(resolved);
                    return;
                }
            }

            // Try DB-driven theme preset (admin-configured)
            if (themePresetId) {
                registerBuiltInThemes();
                const base = getThemeByName(themePresetId);
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

        applyCorrectTheme();

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
    }, [initialBrandConfig, themePresetId]);

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <BrandProvider initialConfig={initialBrandConfig}>
                <ShadcnProviders enableThemeProvider={false} enableToaster>
                    <HomepageConfigProvider initialVariantBySlot={initialHomepageConfig}>
                        {children}
                    </HomepageConfigProvider>
                </ShadcnProviders>
            </BrandProvider>
        </ThemeProvider>
    );
}
