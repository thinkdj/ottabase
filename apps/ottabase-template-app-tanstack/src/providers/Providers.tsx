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
import { ProviderState } from "@ottabase/state";
import { ProviderCodeHighlight } from "@ottabase/ui-code-highlight";
import { ProviderUIBase } from "@ottabase/ui-base";
import { ShadcnProviders } from "@ottabase/ui-shadcn/providers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    const fontFamilies = {
        primary: primaryFontFamily.style.fontFamily,
        heading: headingFontFamily.style.fontFamily,
        monospace: monospaceFontFamily.style.fontFamily,
    };

    return (
        <ProviderState>
            <QueryClientProvider client={queryClient}>
                <ProviderUIBase
                    preventFOUC={appConfig.ui.preventFOUC}
                    preventFOUCInsideIframe={appConfig.ui.preventFOUCInsideIframe}
                    fontFamilies={fontFamilies}
                >
                    <ProviderFont enforceGoogleFonts={appConfig.ui.enforceGoogleFonts}>
                        <ProviderNextThemes storagePrefix={appConfig.storage.prefix}>
                            <ThemeManager />
                            <ShadcnProviders enableThemeProvider={false} enableToaster>
                                <ProviderCodeHighlight>{children}</ProviderCodeHighlight>
                            </ShadcnProviders>
                        </ProviderNextThemes>
                    </ProviderFont>
                </ProviderUIBase>
            </QueryClientProvider>
        </ProviderState>
    );
}
