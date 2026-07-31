import { api, reportApiError } from '@/lib/api';
import { AuthSessionBootstrap } from '@/components/AuthSessionBootstrap';
import enApp from '@/locales/en/app.json';
import { BlogStudioProvider } from '@/ottabase/blog/BlogStudioContext';
import { APP_ID, MEDIA_LIBRARY_ENABLED, appConfig, PACKAGES_ENABLED } from '@/ottabase/config';
import { MediaLibraryPickerBridge } from '@/components/media-library/MediaLibraryPickerBridge';
import { MediaGalleryConfirmBridge } from '@/components/editor/MediaGalleryConfirmBridge';
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
import { appIdAtom, globalStore, organizationIdAtom, userAtom } from '@/ottabase/state/appState';
import { INITIAL_CONFIG_ELEMENT_ID } from '@ottabase/brand-engine';
import type { FullBrandConfig } from '@ottabase/brand-engine-react';
import { BrandProvider } from '@ottabase/brand-engine-react';
import { I18nProvider } from '@ottabase/i18n/react';
import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { SpotlightProvider } from '@ottabase/spotlight/react';
import { ProviderState } from '@ottabase/state';
import { ProviderUIBase } from '@ottabase/ui-base';
import { ShadcnProviders } from '@ottabase/ui-shadcn/providers';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useAtomValue } from 'jotai';
import React from 'react';

const appResources = {
    en: {
        common: enApp,
    },
};

/**
 * Reads the brand config the edge Worker already resolved and embedded in the
 * HTML (see worker/lib/brand-html-inject.ts), so BrandProvider can hydrate
 * synchronously instead of re-fetching /api/brand on mount. Read once at
 * module load — this is a one-shot handoff, not a live data source.
 * Exported for tests.
 */
export function readInjectedBrandConfig(): FullBrandConfig | undefined {
    if (typeof document === 'undefined') return undefined;
    const el = document.getElementById(INITIAL_CONFIG_ELEMENT_ID);
    if (!el?.textContent) return undefined;
    try {
        return JSON.parse(el.textContent) as FullBrandConfig;
    } catch {
        return undefined;
    }
}

const injectedBrandConfig = readInjectedBrandConfig();

export function Providers({ children }: { children: React.ReactNode }) {
    const fontFamilies = {
        primary: primaryFontFamily.style.fontFamily,
        heading: headingFontFamily.style.fontFamily,
        monospace: monospaceFontFamily.style.fontFamily,
    };
    return (
        <ProviderState store={globalStore}>
            <ProvidersContent fontFamilies={fontFamilies}>{children}</ProvidersContent>
        </ProviderState>
    );
}

function ProvidersContent({
    children,
    fontFamilies,
}: {
    children: React.ReactNode;
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
                    <ProvidersInner fontFamilies={fontFamilies}>{children}</ProvidersInner>
                </BlogStudioProvider>
            ) : (
                <ProvidersInner fontFamilies={fontFamilies}>{children}</ProvidersInner>
            )}
        </I18nProvider>
    );
}

function ProvidersInner({
    children,
    fontFamilies,
}: {
    children: React.ReactNode;
    fontFamilies: { primary: string; heading: string; monospace: string };
}) {
    return (
        <BrandProvider
            apiEndpoint="/api/brand"
            // Prefer the appId the edge resolved the injected config for, so a
            // deployment-time APP_ID env override can't make refresh()/fetch
            // swap in a different app's brand mid-session.
            appId={injectedBrandConfig?.appId ?? APP_ID}
            initialConfig={injectedBrandConfig}
        >
            <ProvidersCore fontFamilies={fontFamilies}>{children}</ProvidersCore>
        </BrandProvider>
    );
}

function ProvidersCore({
    children,
    fontFamilies,
}: {
    children: React.ReactNode;
    fontFamilies: { primary: string; heading: string; monospace: string };
}) {
    const appId = useAtomValue(appIdAtom) ?? APP_ID;
    const organizationId = useAtomValue(organizationIdAtom) ?? null;
    const user = useAtomValue(userAtom);
    const authorizationVersion = React.useMemo(() => {
        const scopedUser = user as { roles?: string[]; permissions?: string[]; platformAdmin?: boolean } | null;
        return JSON.stringify({
            roles: [...(scopedUser?.roles ?? [])].sort(),
            permissions: [...(scopedUser?.permissions ?? [])].sort(),
            platformAdmin: scopedUser?.platformAdmin === true,
        });
    }, [user]);

    return (
        <>
            {/* Session bootstrap must outlive authorization-scope remounts. */}
            <AuthSessionBootstrap />
            <OttaQueryProvider
                apiClient={api}
                visibilityScope={{
                    appId,
                    organizationId,
                    principalId: user?.id ?? null,
                    authorizationVersion,
                }}
                errorReporter={reportApiError}
            >
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
                                        {MEDIA_LIBRARY_ENABLED && <MediaLibraryPickerBridge />}
                                        {/* Provides shadcn AlertDialog confirmation for MediaGalleryTool delete/clear actions */}
                                        <MediaGalleryConfirmBridge />
                                    </SpotlightProvider>
                                </ShadcnProviders>
                            </ThemeProvider>
                        </ProviderNextThemes>
                    </ProviderFont>
                </ProviderUIBase>
                <ReactQueryDevtools initialIsOpen={false} />
            </OttaQueryProvider>
        </>
    );
}
