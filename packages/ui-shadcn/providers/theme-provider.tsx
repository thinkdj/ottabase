"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps as NextThemeProviderProps,
} from "next-themes";

import { TooltipProvider } from "../components/ui/tooltip";

export interface ThemeProviderProps
  extends Omit<NextThemeProviderProps, "children"> {
  children: React.ReactNode;
}

export interface ShadcnThemeProviderProps extends ThemeProviderProps {
  /**
   * Enables the Radix tooltip provider so that shadcn tooltips work out of the box.
   * Enabled by default.
   */
  enableTooltipProvider?: boolean;
  /**
   * Wrap children in the included next-themes provider. Disable when an app already
   * supplies its own NextThemes provider higher in the tree.
   */
  enableThemeProvider?: boolean;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Enforce unified theme storage and behavior across apps/packages
  const providerProps: NextThemeProviderProps = {
    attribute: "class",
    storageKey: "ottabase-theme",
    defaultTheme: "light",
    enableSystem: false,
    forcedTheme: undefined,
    disableTransitionOnChange: true,
    ...props, // allow explicit overrides if a specific app needs it
  };

  return <NextThemesProvider {...providerProps}>{children}</NextThemesProvider>;
}

export function ShadcnProviders({
  children,
  enableTooltipProvider = true,
  enableThemeProvider = true,
  ...themeProps
}: ShadcnThemeProviderProps) {
  const content = enableTooltipProvider ? (
    <TooltipProvider>{children}</TooltipProvider>
  ) : (
    <>{children}</>
  );

  if (!enableThemeProvider) {
    return <>{content}</>;
  }

  return <ThemeProvider {...themeProps}>{content}</ThemeProvider>;
}
