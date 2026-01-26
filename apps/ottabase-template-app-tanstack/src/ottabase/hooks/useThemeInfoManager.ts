/**
 * Hook to sync theme info from ThemeContext to global state
 * Only syncs the theme name, not the mode (mode is synced by useThemeManager)
 */
import { useEffect } from "react";
import { useAtom } from "jotai";
import { themeInfoAtom } from "@/ottabase/state/appState";
import { useTheme } from "@/ottabase/providers/ThemeContext";

export function useThemeInfoManager(): void {
  const [, setGlobalThemeInfo] = useAtom(themeInfoAtom);
  const { theme: themeName } = useTheme();

  useEffect(() => {
    setGlobalThemeInfo({
      name: themeName,
    });
  }, [themeName, setGlobalThemeInfo]);
}
