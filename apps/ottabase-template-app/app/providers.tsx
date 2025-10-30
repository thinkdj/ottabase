"use client";

import { appConfig, THEME_COLORS } from "@/ottabase/config/app.config";
import { appFontsConfig, fontOptions } from "@/ottabase/config/fonts.config";
import { ProviderNextThemes } from "@/ottabase/providers";
import { ProviderState } from "@ottabase/state";
import { ProviderCodeHighlight } from "@ottabase/ui-code-highlight";
import { ProviderUIBase } from "@ottabase/ui-base";
import { ProviderFont, extractFontFamilies } from "@ottabase/ui-fonts";
import { ProviderUIMantine } from "@ottabase/ui-mantine";
import { ShadcnProviders } from "@ottabase/ui-shadcn/providers";

export function Providers({ children }: { children: React.ReactNode }) {
  // Extract font families from the centralized font configuration
  const fontFamilies = extractFontFamilies(appFontsConfig);

  return (
    <ProviderState>
      {/* ProviderFont wraps everything to ensure fonts are loaded first */}
      <ProviderFont
        fonts={appFontsConfig}
        enforceWithImportant={fontOptions.enforceWithImportant}
        applyToBody={fontOptions.applyToBody}
      >
        <ProviderUIBase
          preventFOUC={appConfig.ui.preventFOUC}
          preventFOUCInsideIframe={appConfig.ui.preventFOUCInsideIframe}
          fontFamilies={fontFamilies}
        >
          <ProviderUIMantine
            storagePrefix={appConfig.storage.prefix}
            themeColors={THEME_COLORS}
            primaryColor={appConfig.theme.colorDefault}
          >
            <ProviderNextThemes storagePrefix={appConfig.storage.prefix}>
              <ShadcnProviders enableThemeProvider={false} enableToaster>
                <ProviderCodeHighlight>{children}</ProviderCodeHighlight>
              </ShadcnProviders>
            </ProviderNextThemes>
          </ProviderUIMantine>
        </ProviderUIBase>
      </ProviderFont>
    </ProviderState>
  );
}
