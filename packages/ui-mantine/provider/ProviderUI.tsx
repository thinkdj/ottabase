"use client";

import { ReactNode, useMemo } from "react";
// Mantine
import {
  createTheme,
  MantineColorsTuple,
  MantineProvider,
  MantineThemeOverride,
  mergeMantineTheme,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
//import {SpotlightProvider} from '@mantine/spotlight';
import { rem } from "@mantine/core";

// Import theme presets
import mantineAurora from "../themes/mantine-aurora";
import mantineAzure from "../themes/mantine-azure";
import mantineGraphite from "../themes/mantine-graphite";
import mantineSlate from "../themes/mantine-slate";

/* Import Mantine CSS */
import "@mantine/carousel/styles.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

export type MantineThemePreset =
  | "mantine-slate"
  | "mantine-graphite"
  | "mantine-azure"
  | "mantine-aurora";

interface ProviderUIMantineProps {
  children: ReactNode;
  // Configuration props
  storagePrefix?: string;
  themeColors?: Record<string, MantineColorsTuple>;
  primaryColor?: string;
  scale?: number;
  // Base theme preset to use
  baseTheme?: MantineThemePreset;
  // Theme override - allows apps to provide their own complete theme
  themeOverride?: MantineThemeOverride;
  /** Explicitly set the color scheme. Overrides internal management. */
  colorScheme?: "light" | "dark";
}

export type ThemeColors = Record<string, MantineColorsTuple>;

const ProviderUIMantine = ({
  children,
  storagePrefix = "ottabase",
  themeColors = {},
  primaryColor = "blue",
  scale = 1.0,
  baseTheme = "mantine-slate",
  themeOverride,
  colorScheme,
}: ProviderUIMantineProps) => {
  /**
   * NOTE: Theme is now managed by global state (themeAtom) in @ottabase/state
   * The color scheme should be passed directly to this provider via the `colorScheme` prop.
   */

  // Get the base theme preset
  const themePresets: Record<MantineThemePreset, MantineThemeOverride> = {
    "mantine-slate": mantineSlate,
    "mantine-graphite": mantineGraphite,
    "mantine-azure": mantineAzure,
    "mantine-aurora": mantineAurora,
  };

  const selectedBaseTheme = themePresets[baseTheme] || mantineSlate;

  const mantineDefaultTheme: MantineThemeOverride = {
    defaultRadius: "sm",
    colors: themeColors,
    primaryColor: primaryColor,
    scale: scale,
    focusRing: "auto",
    fontSmoothing: true,
    respectReducedMotion: true,
    autoContrast: true,
    luminanceThreshold: 0.35, // https://mantine.dev/theming/theme-object/#luminancethreshold
    cursorType: "pointer", // For interactive elements
    fontSizes: {
      xs: rem(12),
      sm: rem(14),
      md: rem(16),
      lg: rem(18),
      xl: rem(20),
      xxl: rem(28),
    },
  };

  // Merge the selected base theme with any custom theme colors/settings
  const finalTheme = useMemo(() => {
    if (themeOverride) {
      // If a complete theme override is provided, use it
      return themeOverride;
    } else {
      // Merge the base theme preset with custom settings
      const baseThemeInstance = createTheme(selectedBaseTheme);
      return mergeMantineTheme(
        baseThemeInstance as any,
        mantineDefaultTheme as any,
      );
    }
  }, [baseTheme, themeColors, primaryColor, scale, themeOverride]);

  const mantineTheme = createTheme(finalTheme);

  return (
    <MantineProvider
      forceColorScheme={colorScheme}
      withCssVariables={true}
      deduplicateCssVariables={true}
      classNamesPrefix="cdc-mt"
      withStaticClasses={false} // Static class = cdc-mtn-Button-inner | Dynamic class = m-a25b86ee
      theme={mantineTheme}
    >
      {/* Modals manager */}
      <ModalsProvider>
        {/*<SpotlightProvider shortcut={['mod + K', '/']}
								   transitionProps={{duration: 128}} actions={[]}
								   actionsWrapperComponent={ActionsWrapper}
						>*/}
        {children}
        {/*</SpotlightProvider>*/}
      </ModalsProvider>
      {/* Notifications system */}
      <Notifications position="top-right" limit={5} zIndex={10010} />
    </MantineProvider>
  );
};

export default ProviderUIMantine;
