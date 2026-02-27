import { api } from '@/lib/api';
import enApp from '@/locales/en/app.json';
import { BlogStudioProvider } from '@/ottabase/blog/BlogStudioContext';
import { APP_ID, appConfig, PACKAGES_ENABLED } from '@/ottabase/config';
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
import { globalStore } from '@/ottabase/state/appState';
import { ApiError } from '@ottabase/api';
import { BrandProvider } from '@ottabase/brand-engine-react';
import { I18nProvider } from '@ottabase/i18n/react';
import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { SpotlightProvider } from '@ottabase/spotlight';
import { ProviderState } from '@ottabase/state';
import { ProviderUIBase } from '@ottabase/ui-base';
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
        <ProviderState store={globalStore}>
            <ProvidersContent queryConfig={queryConfig} fontFamilies={fontFamilies}>
                {children}
            </ProvidersContent>
        </ProviderState>
    );
}

function ProvidersContent({
    children,
    queryConfig,
    fontFamilies,
}: {
    children: React.ReactNode;
    queryConfig: {
        defaultOptions: {
            queries: {
                retry: (failureCount: number, error: unknown) => boolean;
            };
        };
    };
    fontFamilies: {
        primary: string;
        heading: string;
        monospace: string;
    };
}) {
    return (
        <I18nProvider
            defaultLanguage={i18nConfig.defaultLanguage}
            supportedLngs={i18nConfig.enabledLanguages}
            fallbackLng={i18nConfig.fallbackLanguage}
            resources={appResources}
        >
            <LanguageManager />
            {PACKAGES_ENABLED.ottablog ? (
                <BlogStudioProvider>
                    <ProvidersInner fontFamilies={fontFamilies} queryConfig={queryConfig}>
                        {children}
                    </ProvidersInner>
                </BlogStudioProvider>
            ) : (
                <ProvidersInner fontFamilies={fontFamilies} queryConfig={queryConfig}>
                    {children}
                </ProvidersInner>
            )}
        </I18nProvider>
    );
}

function ProvidersInner({
    children,
    fontFamilies,
    queryConfig,
}: {
    children: React.ReactNode;
    fontFamilies: { primary: string; heading: string; monospace: string };
    queryConfig: { defaultOptions: { queries: { retry: (n: number, err: unknown) => boolean } } };
}) {
    return (
        <BrandProvider apiEndpoint="/api/brand" appId={APP_ID}>
            <ProvidersCore fontFamilies={fontFamilies} queryConfig={queryConfig}>
                {children}
            </ProvidersCore>
        </BrandProvider>
    );
}

function ProvidersCore({
    children,
    fontFamilies,
    queryConfig,
}: {
    children: React.ReactNode;
    fontFamilies: { primary: string; heading: string; monospace: string };
    queryConfig: { defaultOptions: { queries: { retry: (n: number, err: unknown) => boolean } } };
}) {
    return (
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
                                    {children}
                                </SpotlightProvider>
                            </ShadcnProviders>
                        </ThemeProvider>
                    </ProviderNextThemes>
                </ProviderFont>
            </ProviderUIBase>
            <ReactQueryDevtools initialIsOpen={false} />
        </OttaQueryProvider>
    );
}
