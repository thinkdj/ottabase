import { appConfig } from "@/ottabase/config/app.config";
import {
  ProviderFont,
  primaryFontFamily,
  headingFontFamily,
  monospaceFontFamily,
} from "@/ottabase/providers";
import { ThemeManager } from "@/ottabase/providers/ThemeManager";
import { ProviderState } from "@ottabase/state";
import { ProviderCodeHighlight } from "@ottabase/ui-code-highlight";
import { ProviderUIBase } from "@ottabase/ui-base";
import { ShadcnProviders } from "@ottabase/ui-shadcn/providers";

export function Providers({ children }: { children: React.ReactNode }) {
  const fontFamilies = {
    primary: `"${primaryFontFamily}", sans-serif`,
    heading: `"${headingFontFamily}", sans-serif`,
    monospace: `"${monospaceFontFamily}", monospace`,
  };

  return (
    <ProviderState>
      <ProviderUIBase
        preventFOUC={appConfig.ui.preventFOUC}
        preventFOUCInsideIframe={appConfig.ui.preventFOUCInsideIframe}
        fontFamilies={fontFamilies}
      >
        <ProviderFont enforceGoogleFonts={appConfig.ui.enforceGoogleFonts}>
          <ThemeManager />
          <ShadcnProviders enableThemeProvider={false} enableToaster>
            <ProviderCodeHighlight>{children}</ProviderCodeHighlight>
          </ShadcnProviders>
        </ProviderFont>
      </ProviderUIBase>
    </ProviderState>
  );
}
