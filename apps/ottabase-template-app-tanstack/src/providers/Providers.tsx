import { api } from '@/lib/api';
import enApp from '@/locales/en/app.json';
import { BlogStudioProvider } from '@/ottabase/blog/BlogStudioContext';
import { appConfig } from '@/ottabase/config/app.config';
import { i18nConfig } from '@/ottabase/config/i18n.config';
import {
    headingFontFamily,
    monospaceFontFamily,
    primaryFontFamily,
    ProviderFont,
    ProviderNextThemes,
} from '@/ottabase/providers';
import { BrandThemeApplicator } from '@/ottabase/providers/BrandThemeApplicator';
import { LanguageManager } from '@/ottabase/providers/LanguageManager';
import { ThemeProvider } from '@/ottabase/providers/ProviderTheme';
import { ScaleManager } from '@/ottabase/providers/ScaleManager';
import { SidebarStateManager } from '@/ottabase/providers/SidebarStateManager';
import { ThemeManager } from '@/ottabase/providers/ThemeManager';
import { ZoomManager } from '@/ottabase/providers/ZoomManager';
import { ApiError } from '@ottabase/api';
import { BrandProvider } from '@ottabase/brand-engine-react';
import { I18nProvider } from '@ottabase/i18n/react';
import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { SpotlightProvider } from '@ottabase/spotlight';
import { ProviderState } from '@ottabase/state';
import { ProviderUIBase } from '@ottabase/ui-base';
import { ProviderCodeHighlight } from '@ottabase/ui-code-highlight';
import { ShadcnProviders } from '@ottabase/ui-shadcn/providers';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';

const appResources = {
    en: {
        common: enApp,
    },
};

export function Providers({ children }: { children: React.ReactNode }) {
    const fontFamilies = {
        primary: primaryFontFamily.style.fontFamily,
        heading: headingFontFamily.style.fontFamily,
        monospace: monospaceFontFamily.style.fontFamily,
    };
    const queryConfig = {
        defaultOptions: {
            queries: {
                retry: (failureCount: number, error: unknown) => {
                    const status =
                        error instanceof ApiError ? error.status : (error as { status?: number } | null)?.status;
                    if (status === 403) return false;
                    return failureCount < 3;
                },
            },
        },
    };

    return (
        <ProviderState>
            <I18nProvider
                defaultLanguage={i18nConfig.defaultLanguage}
                supportedLngs={i18nConfig.enabledLanguages}
                fallbackLng={i18nConfig.fallbackLanguage}
                resources={appResources}
            >
                <LanguageManager />
                <BlogStudioProvider>
                    <BrandProvider apiEndpoint="/api/brand">
                        <OttaQueryProvider apiClient={api} config={queryConfig}>
                            <ProviderUIBase
                                preventFOUC={appConfig.ui.preventFOUC}
                                preventFOUCInsideIframe={appConfig.ui.preventFOUCInsideIframe}
                                fontFamilies={fontFamilies}
                                fontVarsFromRoot
                            >
                                <ProviderFont enforceGoogleFonts={appConfig.ui.enforceGoogleFonts}>
                                    <ProviderNextThemes storagePrefix={appConfig.storage.prefix}>
                                        <ThemeProvider>
                                            <BrandThemeApplicator />
                                            <ThemeManager />
                                            <ZoomManager />
                                            <ScaleManager />
                                            <SidebarStateManager />
                                            <ShadcnProviders enableThemeProvider={false} enableToaster>
                                                <SpotlightProvider
                                                    enabled={appConfig.features.spotlight.enabled}
                                                    shortcuts={appConfig.features.spotlight.shortcuts}
                                                >
                                                    <ProviderCodeHighlight>{children}</ProviderCodeHighlight>
                                                </SpotlightProvider>
                                            </ShadcnProviders>
                                        </ThemeProvider>
                                    </ProviderNextThemes>
                                </ProviderFont>
                            </ProviderUIBase>
                            <ReactQueryDevtools initialIsOpen={false} />
                        </OttaQueryProvider>
                    </BrandProvider>
                </BlogStudioProvider>
            </I18nProvider>
        </ProviderState>
    );
}
