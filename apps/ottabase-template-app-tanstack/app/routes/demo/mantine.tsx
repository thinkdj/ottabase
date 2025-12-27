import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ProviderMantine } from "@ottabase/ui-mantine";
import {
  mantineThemePresetAtom,
  themeAtom,
} from "@/ottabase/state/appGlobalState";
import { useAtomValue } from "jotai";
import { mantineThemeConfig } from "@/ottabase/config/theme.mantine";

export const Route = createFileRoute("/demo/mantine")({
  component: MantineLayout,
});

/**
 * Mantine Layout
 *
 * This layout wraps Mantine demo routes and provides the Mantine context.
 * It uses the theme preset from global state to switch between different
 * Mantine theme configurations.
 */
function MantineLayout() {
  const mantineTheme = useAtomValue(mantineThemePresetAtom);
  const globalTheme = useAtomValue(themeAtom);

  return (
    <ProviderMantine
      themeConfig={mantineThemeConfig}
      themePreset={mantineTheme}
      colorScheme={globalTheme}
      withNotifications
      withModals
    >
      <Outlet />
    </ProviderMantine>
  );
}
