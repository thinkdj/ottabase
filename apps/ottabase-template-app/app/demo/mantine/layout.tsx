"use client";

import { appConfig, THEME_COLORS } from "@/ottabase/config/app.config";
import { MantineThemeSwitcher, ProviderUIMantine } from "@ottabase/ui-mantine";
import { useAtomValue } from "jotai";
import { themeAtom } from "@/ottabase/state/appGlobalState";

export default function MantineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const globalTheme = useAtomValue(themeAtom);

  // Ensure the theme is only 'light' or 'dark' to satisfy the provider's prop type.
  const validTheme =
    globalTheme === "light" || globalTheme === "dark" ? globalTheme : "light";

  return (
    <ProviderUIMantine
      storagePrefix={appConfig.storage.prefix}
      themeColors={THEME_COLORS}
      primaryColor={appConfig.theme.colorDefault}
      // Explicitly set the color scheme based on the global Jotai atom.
      // This makes Mantine a controlled component regarding the theme.
      colorScheme={validTheme}
    >
      {/* Mantine Theme Switcher - Fixed top-right, replaces generic DarkModeToggle */}
      <div
        style={{
          position: "fixed",
          top: "1.25rem",
          right: "1.25rem",
          zIndex: 1000,
        }}
      >
        <MantineThemeSwitcher variant="button" size="lg" />
      </div>
      {children}
    </ProviderUIMantine>
  );
}
