"use client";

import { ProviderUIBase } from "@ottabase/ui-base";
import { ProviderUIMantine } from "@ottabase/ui-mantine";
import { ProviderCodeHighlight } from "@ottabase/ui-code-highlight";
import { ProviderFont, extractFontFamilies } from "@ottabase/ui-fonts";
import { appFontsConfig, fontOptions } from "@/ottabase/config/fonts.config";
import { ProviderNextThemes } from "@/ottabase/providers";
import { appConfig, THEME_COLORS } from "@/ottabase/config/app.config";
import { useTheme } from "../lib/themeContext";

export function DemoProviders({ children }: { children: React.ReactNode }) {
  const { currentMantineTheme } = useTheme();
  const fontFamilies = extractFontFamilies(appFontsConfig);

  return (
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
          themeOverride={currentMantineTheme}
        >
          <ProviderNextThemes storagePrefix={appConfig.storage.prefix}>
            <ProviderCodeHighlight>{children}</ProviderCodeHighlight>
          </ProviderNextThemes>
        </ProviderUIMantine>
      </ProviderUIBase>
    </ProviderFont>
  );
}
