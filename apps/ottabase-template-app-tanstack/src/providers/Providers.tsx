import { api } from '@/lib/api';
import { appConfig } from '@/ottabase/config/app.config';
import {
    headingFontFamily,
    monospaceFontFamily,
    primaryFontFamily,
    ProviderFont,
    ProviderNextThemes,
} from '@/ottabase/providers';
import { ThemeProvider } from '@/ottabase/providers/ProviderTheme';
import { SidebarStateManager } from '@/ottabase/providers/SidebarStateManager';
import { ThemeManager } from '@/ottabase/providers/ThemeManager';
import { ZoomManager } from '@/ottabase/providers/ZoomManager';
import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { SpotlightProvider } from '@ottabase/spotlight';
import { ProviderState } from '@ottabase/state';
import { ProviderUIBase } from '@ottabase/ui-base';
import { ProviderCodeHighlight } from '@ottabase/ui-code-highlight';
import { ShadcnProviders } from '@ottabase/ui-shadcn/providers';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    const fontFamilies = {
        primary: primaryFontFamily.style.fontFamily,
        heading: headingFontFamily.style.fontFamily,
        monospace: monospaceFontFamily.style.fontFamily,
    };

    return (
        <ProviderState>
            <OttaQueryProvider apiClient={api}>
                <ProviderUIBase
                    preventFOUC={appConfig.ui.preventFOUC}
                    preventFOUCInsideIframe={appConfig.ui.preventFOUCInsideIframe}
                    fontFamilies={fontFamilies}
                >
                    <ProviderFont enforceGoogleFonts={appConfig.ui.enforceGoogleFonts}>
                        <ProviderNextThemes storagePrefix={appConfig.storage.prefix}>
                            <ThemeProvider>
                                <ThemeManager />
                                <ZoomManager />
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
        </ProviderState>
    );
}
