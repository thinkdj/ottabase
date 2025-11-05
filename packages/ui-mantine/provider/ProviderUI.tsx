"use client";

import React, { ReactNode } from "react";
// Mantine
import {
  MantineProvider,
  createTheme,
  MantineThemeOverride,
  MantineColorsTuple,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
//import {SpotlightProvider} from '@mantine/spotlight';
import { Group, Text, Anchor, rem } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";

/* Import Mantine CSS */
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/carousel/styles.css";

interface ProviderUIMantineProps {
  children: ReactNode;
  // Configuration props
  storagePrefix?: string;
  themeColors?: Record<string, MantineColorsTuple>;
  primaryColor?: string;
  scale?: number;
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
  themeOverride,
  colorScheme,
}: ProviderUIMantineProps) => {
  /**
   * NOTE: Theme is now managed by global state (themeAtom) in @ottabase/state
   * The color scheme should be passed directly to this provider via the `colorScheme` prop.
   */
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

  // Use theme override if provided, otherwise use the default theme
  const finalTheme = themeOverride ? themeOverride : mantineDefaultTheme;
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

// Spotlight actions wrapper
function ActionsWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {children}
      <Group
      //position="apart"
      //px={15}
      //py="xs"
      //sx={(theme) => ({
      //	borderTop: `${rem(1)} solid ${
      //		theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[2]
      //	}`,
      //})
      //}
      >
        <Text size="xs" c="dimmed">
          Looking for detailed search?
        </Text>
        <Anchor size="xs" href="#">
          Advanced search
        </Anchor>
      </Group>
    </div>
  );
}

export default ProviderUIMantine;
