/**
 * Hook to sync theme details from ThemeContext to global state
 */
import { useEffect } from "react";
import { useAtom } from "jotai";
import { themeDetailsAtom } from "@/ottabase/state/appState";
import { useTheme } from "@/ottabase/providers/ThemeContext";
import { useTheme as useNextTheme } from "next-themes";

export function useThemeDetailsManager(): void {
  const [, setGlobalThemeDetails] = useAtom(themeDetailsAtom);
  const { theme: themeName } = useTheme();
  const { resolvedTheme } = useNextTheme();

  useEffect(() => {
    const mode = (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark";

    setGlobalThemeDetails({
      name: themeName,
      mode: mode,
    });
  }, [themeName, resolvedTheme, setGlobalThemeDetails]);
}
