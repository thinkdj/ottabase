import { themeAtom } from "@/ottabase/state/appGlobalState";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";

// Define the theme type for clarity and reuse.
type Theme = "light" | "dark";

const STORAGE_KEY = "ottabase-theme";

/**
 * useThemeManager - TanStack-compatible theme manager hook
 * 
 * Unlike next-themes, this hook directly manages the theme state
 * without relying on Next.js-specific features.
 * 
 * Features:
 * - Reads theme from localStorage on mount
 * - Syncs theme changes to localStorage and document class
 * - Provides the current theme state to the app
 */
export function useThemeManager(): void {
  const [globalTheme, setGlobalTheme] = useAtom(themeAtom);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme: Theme = stored ?? (systemPrefersDark ? "dark" : "light");

    if (globalTheme !== initialTheme) {
      setGlobalTheme(initialTheme);
    }
    setIsHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync theme changes to localStorage and document
  useEffect(() => {
    if (!isHydrated) return;
    if (typeof window === "undefined") return;

    // Update localStorage
    localStorage.setItem(STORAGE_KEY, globalTheme);

    // Update document class for Tailwind dark mode
    const root = document.documentElement;
    if (globalTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [globalTheme, isHydrated]);
}

/**
 * useTheme - Get and set the current theme
 * 
 * @returns Object containing:
 * - theme: Current theme ("light" | "dark")
 * - setTheme: Function to set the theme
 * - toggleTheme: Function to toggle between light and dark
 */
export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}
