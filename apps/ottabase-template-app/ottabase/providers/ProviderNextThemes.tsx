"use client";

import { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface NextThemesWrapperProps {
  children: ReactNode;
  storagePrefix?: string;
}

/**
 * ProviderNextThemes - Provides TailwindCSS dark mode using `next-themes`.
 *
 * This component wraps the `NextThemesProvider`. It is intentionally kept simple.
 * The actual theme state management and switching logic are handled by the
 * `useThemeManager` hook, which synchronizes the global Jotai state with `next-themes`.
 *
 * - `storageKey` is set to ensure `next-themes` uses the same localStorage item as our Jotai atom.
 * - `enableSystem` is false because we are managing the theme explicitly.
 */
const ProviderNextThemes = ({ children }: NextThemesWrapperProps) => {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey="ottabase-theme" // Must match Jotai atom's storage key
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
};

export default ProviderNextThemes;
