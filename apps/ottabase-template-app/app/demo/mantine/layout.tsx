"use client";

import { appConfig, THEME_COLORS } from "@/ottabase/config/app.config";
import { ProviderUIMantine } from "@ottabase/ui-mantine";
import { useAtomValue } from "jotai";
import { themeAtom, mantineThemePresetAtom } from "@/ottabase/state/appGlobalState";

export default function MantineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const globalTheme = useAtomValue(themeAtom);
  const mantineThemePreset = useAtomValue(mantineThemePresetAtom);

  // Ensure the theme is only 'light' or 'dark' to satisfy the provider's prop type.
  const validTheme =
    globalTheme === "light" || globalTheme === "dark" ? globalTheme : "light";

  return (
    <ProviderUIMantine
      storagePrefix={appConfig.storage.prefix}
      themeColors={THEME_COLORS}
      primaryColor={appConfig.theme.colorDefault}
      baseTheme={mantineThemePreset}
      // Explicitly set the color scheme based on the global Jotai atom.
      // This makes Mantine a controlled component regarding the theme.
      colorScheme={validTheme}
    >
      {children}
    </ProviderUIMantine>
  );
}
