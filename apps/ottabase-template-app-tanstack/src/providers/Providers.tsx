import React from "react";
import { appConfig } from "@/ottabase/config/app.config";
import {
    headingFontFamily,
    monospaceFontFamily,
    primaryFontFamily,
    ProviderFont,
    ProviderNextThemes,
} from "@/ottabase/providers";
import { ThemeManager } from "@/ottabase/providers/ThemeManager";
import { ThemeProvider } from "@/ottabase/providers/ProviderTheme";
import { ProviderState } from "@ottabase/state";
import { ProviderCodeHighlight } from "@ottabase/ui-code-highlight";
import { ProviderUIBase } from "@ottabase/ui-base";
import { ShadcnProviders } from "@ottabase/ui-shadcn/providers";
import { OttaQueryProvider } from "@ottabase/ottaorm/client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { api } from "@/lib/api";

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
                                <ShadcnProviders enableThemeProvider={false} enableToaster>
                                    <ProviderCodeHighlight>{children}</ProviderCodeHighlight>
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
